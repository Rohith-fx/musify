const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'musify_super_secret_key_1337';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = decoded;
    next();
  });
}

// Optional Authentication (for public routes that might show 'liked' state if logged in)
function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (!err) {
        req.user = decoded;
      }
      next();
    });
  } else {
    next();
  }
}

// AUTH API ENDPOINTS

// Register
app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (username.length < 3 || password.length < 6) {
    return res.status(400).json({ error: 'Username must be at least 3 chars, password at least 6 chars' });
  }

  try {
    const checkUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (checkUser) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const result = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, passwordHash);
    const userId = result.lastInsertRowid;

    const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: userId, username }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get profile
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// ── PREFERENCES API ──────────────────────────────────────────────────────────

// Get user's selected music directors
app.get('/api/preferences', authenticateToken, (req, res) => {
  try {
    const rows = db.prepare(
      'SELECT director_id, director_name FROM user_preferences WHERE user_id = ?'
    ).all(req.user.id);
    res.json({ directors: rows });
  } catch (err) {
    console.error('Preferences fetch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Save user's selected music directors (replaces existing selections)
app.post('/api/preferences', authenticateToken, (req, res) => {
  const { directors } = req.body; // [{ id, name }, ...]
  if (!Array.isArray(directors)) {
    return res.status(400).json({ error: 'directors must be an array' });
  }
  try {
    // Replace all existing preferences for this user
    db.prepare('DELETE FROM user_preferences WHERE user_id = ?').run(req.user.id);
    const insert = db.prepare(
      'INSERT OR IGNORE INTO user_preferences (user_id, director_id, director_name) VALUES (?, ?, ?)'
    );
    for (const d of directors) {
      if (d.id && d.name) insert.run(req.user.id, d.id, d.name);
    }
    res.json({ saved: directors.length });
  } catch (err) {
    console.error('Preferences save error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// TRACKS API ENDPOINTS

// Helper to search YouTube and extract track info
async function searchYouTube(query) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    const regex = /var ytInitialData = ({.*?});/s;
    const match = html.match(regex);
    if (!match) return [];

    const data = JSON.parse(match[1]);
    const contents = data.contents?.twoColumnBrowseResultsRenderer || data.contents?.twoColumnSearchResultsRenderer;
    if (!contents) return [];

    let videoRows = [];
    try {
      // Navigate down standard YouTube search results tree
      videoRows = contents.primaryContents?.sectionListRenderer?.contents[0]?.itemSectionRenderer?.contents || [];
    } catch (e) {
      return [];
    }

    const results = [];
    for (const row of videoRows) {
      if (row.videoRenderer) {
        const video = row.videoRenderer;
        const title = video.title?.runs?.[0]?.text || "Unknown Title";
        const videoId = video.videoId;
        if (!videoId) continue;

        const artist = video.ownerText?.runs?.[0]?.text || "YouTube Music";

        // Simple duration parser: "5:12" -> 312 seconds
        let durationSec = 180;
        const durationText = video.lengthText?.simpleText;
        if (durationText) {
          const parts = durationText.split(':').map(Number);
          if (parts.length === 2) {
            durationSec = parts[0] * 60 + parts[1];
          } else if (parts.length === 3) {
            durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
          }
        }

        const coverUrl = video.thumbnail?.thumbnails?.[0]?.url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500";

        results.push({
          title,
          artist,
          album: "Global Album",
          duration: durationSec,
          cover_url: coverUrl,
          audio_url: `youtube:${videoId}`,
          global: true
        });
      }
    }
    return results;
  } catch (err) {
    console.error("YouTube search error:", err);
    return [];
  }
}

// Global search YouTube API
app.get('/api/tracks/global-search', (req, res) => {
  const query = req.query.q || '';
  if (!query) {
    return res.json([]);
  }

  searchYouTube(query)
    .then(results => res.json(results))
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch global tracks' });
    });
});

// Register global track into SQLite
app.post('/api/tracks/register', (req, res) => {
  const { title, artist, album, duration, cover_url, audio_url, language } = req.body;

  if (!audio_url) {
    return res.status(400).json({ error: 'Audio URL (audio_url) is required' });
  }

  // Block non-English registrations
  const lang = language || 'English';

  try {
    const existing = db.prepare('SELECT * FROM tracks WHERE audio_url = ?').get(audio_url);
    if (existing) {
      return res.json(existing);
    }

    const result = db.prepare(`
      INSERT INTO tracks (title, artist, album, duration, cover_url, audio_url, language)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      title || 'Unknown Title',
      artist || 'Unknown Artist',
      album || 'Global Stream',
      duration || 180,
      cover_url || '',
      audio_url,
      lang
    );

    const newTrack = db.prepare('SELECT * FROM tracks WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newTrack);
  } catch (error) {
    console.error('Error registering global track:', error);
    res.status(500).json({ error: 'Server error registering track' });
  }
});

// Get all tracks — English only, with optional search and likes metadata
app.get('/api/tracks', optionalAuthenticate, (req, res) => {
  const search = req.query.search || '';
  const userId = req.user ? req.user.id : null;

  try {
    let tracks;
    if (userId) {
      if (search) {
        tracks = db.prepare(`
          SELECT t.*, (l.user_id IS NOT NULL) AS liked
          FROM tracks t
          LEFT JOIN likes l ON t.id = l.track_id AND l.user_id = ?
          WHERE (t.language IS NULL OR t.language = 'English')
            AND (t.title LIKE ? OR t.artist LIKE ? OR t.album LIKE ?)
        `).all(userId, `%${search}%`, `%${search}%`, `%${search}%`);
      } else {
        tracks = db.prepare(`
          SELECT t.*, (l.user_id IS NOT NULL) AS liked
          FROM tracks t
          LEFT JOIN likes l ON t.id = l.track_id AND l.user_id = ?
          WHERE (t.language IS NULL OR t.language = 'English')
        `).all(userId);
      }
    } else {
      if (search) {
        tracks = db.prepare(`
          SELECT *, 0 AS liked
          FROM tracks
          WHERE (language IS NULL OR language = 'English')
            AND (title LIKE ? OR artist LIKE ? OR album LIKE ?)
        `).all(`%${search}%`, `%${search}%`, `%${search}%`);
      } else {
        tracks = db.prepare(`
          SELECT *, 0 AS liked FROM tracks
          WHERE (language IS NULL OR language = 'English')
        `).all();
      }
    }

    tracks = tracks.map(t => ({ ...t, liked: !!t.liked }));
    res.json(tracks);
  } catch (error) {
    console.error('Error fetching tracks:', error);
    res.status(500).json({ error: 'Server error fetching tracks' });
  }
});


// LIKES API ENDPOINTS

// Like a track
app.post('/api/tracks/:id/like', authenticateToken, (req, res) => {
  const trackId = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    // Check if track exists
    const track = db.prepare('SELECT id FROM tracks WHERE id = ?').get(trackId);
    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }

    // Insert like
    db.prepare('INSERT OR IGNORE INTO likes (user_id, track_id) VALUES (?, ?)').run(userId, trackId);
    res.json({ message: 'Track liked successfully', trackId });
  } catch (error) {
    console.error('Error liking track:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Unlike a track
app.delete('/api/tracks/:id/like', authenticateToken, (req, res) => {
  const trackId = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    db.prepare('DELETE FROM likes WHERE user_id = ? AND track_id = ?').run(userId, trackId);
    res.json({ message: 'Track unliked successfully', trackId });
  } catch (error) {
    console.error('Error unliking track:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all liked tracks for the user
app.get('/api/tracks/liked', authenticateToken, (req, res) => {
  const userId = req.user.id;

  try {
    const tracks = db.prepare(`
      SELECT t.*, 1 AS liked
      FROM tracks t
      JOIN likes l ON t.id = l.track_id
      WHERE l.user_id = ?
    `).all(userId);

    res.json(tracks);
  } catch (error) {
    console.error('Error fetching liked tracks:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PLAYLISTS API ENDPOINTS

// Get user playlists
app.get('/api/playlists', authenticateToken, (req, res) => {
  const userId = req.user.id;

  try {
    const playlists = db.prepare(`
      SELECT p.*, COUNT(pt.track_id) AS track_count
      FROM playlists p
      LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
      WHERE p.user_id = ?
      GROUP BY p.id
    `).all(userId);
    res.json(playlists);
  } catch (error) {
    console.error('Error fetching playlists:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a playlist
app.post('/api/playlists', authenticateToken, (req, res) => {
  const { name } = req.body;
  const userId = req.user.id;

  if (!name) {
    return res.status(400).json({ error: 'Playlist name is required' });
  }

  try {
    const result = db.prepare('INSERT INTO playlists (name, user_id) VALUES (?, ?)').run(name, userId);
    res.status(201).json({
      id: result.lastInsertRowid,
      name,
      user_id: userId,
      track_count: 0
    });
  } catch (error) {
    console.error('Error creating playlist:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a playlist
app.delete('/api/playlists/:id', authenticateToken, (req, res) => {
  const playlistId = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    // Verify ownership
    const playlist = db.prepare('SELECT id FROM playlists WHERE id = ? AND user_id = ?').get(playlistId, userId);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found or unauthorized' });
    }

    db.prepare('DELETE FROM playlists WHERE id = ?').run(playlistId);
    res.json({ message: 'Playlist deleted successfully', playlistId });
  } catch (error) {
    console.error('Error deleting playlist:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get tracks in a playlist
app.get('/api/playlists/:id/tracks', authenticateToken, (req, res) => {
  const playlistId = parseInt(req.params.id);
  const userId = req.user.id;

  try {
    // Verify ownership
    const playlist = db.prepare('SELECT id, name FROM playlists WHERE id = ? AND user_id = ?').get(playlistId, userId);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found or unauthorized' });
    }

    const tracks = db.prepare(`
      SELECT t.*, (l.user_id IS NOT NULL) AS liked
      FROM tracks t
      JOIN playlist_tracks pt ON t.id = pt.track_id
      LEFT JOIN likes l ON t.id = l.track_id AND l.user_id = ?
      WHERE pt.playlist_id = ?
    `).all(userId, playlistId);

    const formattedTracks = tracks.map(t => ({ ...t, liked: !!t.liked }));
    res.json({
      playlist,
      tracks: formattedTracks
    });
  } catch (error) {
    console.error('Error fetching playlist tracks:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add track to a playlist
app.post('/api/playlists/:id/tracks', authenticateToken, (req, res) => {
  const playlistId = parseInt(req.params.id);
  const { trackId } = req.body;
  const userId = req.user.id;

  if (!trackId) {
    return res.status(400).json({ error: 'Track ID is required' });
  }

  try {
    // Verify ownership
    const playlist = db.prepare('SELECT id FROM playlists WHERE id = ? AND user_id = ?').get(playlistId, userId);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found or unauthorized' });
    }

    // Verify track exists
    const track = db.prepare('SELECT id FROM tracks WHERE id = ?').get(trackId);
    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }

    db.prepare('INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id) VALUES (?, ?)').run(playlistId, trackId);
    res.json({ message: 'Track added to playlist', playlistId, trackId });
  } catch (error) {
    console.error('Error adding track to playlist:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove track from playlist
app.delete('/api/playlists/:id/tracks/:trackId', authenticateToken, (req, res) => {
  const playlistId = parseInt(req.params.id);
  const trackId = parseInt(req.params.trackId);
  const userId = req.user.id;

  try {
    // Verify ownership
    const playlist = db.prepare('SELECT id FROM playlists WHERE id = ? AND user_id = ?').get(playlistId, userId);
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found or unauthorized' });
    }

    db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?').run(playlistId, trackId);
    res.json({ message: 'Track removed from playlist', playlistId, trackId });
  } catch (error) {
    console.error('Error removing track from playlist:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Wildcard fallback to serve index.html for frontend routing (if needed)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`Musify premium server running on http://localhost:${PORT}`);
  console.log(`Enjoy clean, ad-free music!`);
  console.log(`===================================================`);
});
