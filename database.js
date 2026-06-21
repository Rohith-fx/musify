const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, 'musify.db');
const db = new DatabaseSync(dbPath);

console.log(`Database initialized at: ${dbPath}`);

// ─── Schema ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT,
    duration INTEGER NOT NULL,
    cover_url TEXT,
    audio_url TEXT NOT NULL,
    language TEXT DEFAULT 'English'
  );

  CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id INTEGER,
    track_id INTEGER,
    PRIMARY KEY(playlist_id, track_id),
    FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY(track_id) REFERENCES tracks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS likes (
    user_id INTEGER,
    track_id INTEGER,
    PRIMARY KEY(user_id, track_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(track_id) REFERENCES tracks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INTEGER NOT NULL,
    director_id TEXT NOT NULL,
    director_name TEXT NOT NULL,
    PRIMARY KEY(user_id, director_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Migration: add language column if missing
try {
  db.exec(`ALTER TABLE tracks ADD COLUMN language TEXT DEFAULT 'English'`);
  console.log('Added language column to tracks.');
} catch (_) { /* already exists */ }

// ─── Seed real songs ──────────────────────────────────────────────────────────
function seedTracks() {
  const existing = db.prepare('SELECT COUNT(*) AS count FROM tracks').get();

  if (existing.count > 0) {
    // Check if tracks are already real YouTube songs
    const sample = db.prepare("SELECT audio_url FROM tracks LIMIT 1").get();
    if (sample && sample.audio_url && sample.audio_url.startsWith('youtube:')) {
      console.log('Real YouTube songs already seeded. Skipping.');
      return;
    }
    // Wipe old synthetic/soundhelix tracks and replace with real songs
    console.log('Wiping old synthetic tracks. Re-seeding with real songs...');
    try { db.exec('DELETE FROM likes'); } catch (_) {}
    try { db.exec('DELETE FROM playlist_tracks'); } catch (_) {}
    db.exec('DELETE FROM tracks');
    try { db.exec("DELETE FROM sqlite_sequence WHERE name='tracks'"); } catch (_) {}
  } else {
    console.log('Seeding real popular English songs...');
  }

  const insert = db.prepare(`
    INSERT INTO tracks (title, artist, album, duration, cover_url, audio_url, language)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // ── 16 real popular English songs — 4 albums × 4 tracks ──────────────────
  const tracks = [

    // ── Album 1: Pop Hits ────────────────────────────────────────────────────
    {
      title: "Blinding Lights",
      artist: "The Weeknd",
      album: "Pop Hits",
      duration: 200,
      cover_url: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=500",
      audio_url: "youtube:4NRXx6U8ABQ",
      language: "English"
    },
    {
      title: "Levitating",
      artist: "Dua Lipa",
      album: "Pop Hits",
      duration: 203,
      cover_url: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=500",
      audio_url: "youtube:TUVcZfQe-Kw",
      language: "English"
    },
    {
      title: "Watermelon Sugar",
      artist: "Harry Styles",
      album: "Pop Hits",
      duration: 174,
      cover_url: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=500",
      audio_url: "youtube:E07s5ZYygMg",
      language: "English"
    },
    {
      title: "bad guy",
      artist: "Billie Eilish",
      album: "Pop Hits",
      duration: 194,
      cover_url: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=500",
      audio_url: "youtube:DyDfgMOUjCI",
      language: "English"
    },

    // ── Album 2: Chart Toppers ───────────────────────────────────────────────
    {
      title: "Shape of You",
      artist: "Ed Sheeran",
      album: "Chart Toppers",
      duration: 234,
      cover_url: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500",
      audio_url: "youtube:JGwWNGJdvx8",
      language: "English"
    },
    {
      title: "Uptown Funk",
      artist: "Mark Ronson ft. Bruno Mars",
      album: "Chart Toppers",
      duration: 270,
      cover_url: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500",
      audio_url: "youtube:OPf0YbXqDm0",
      language: "English"
    },
    {
      title: "Shake It Off",
      artist: "Taylor Swift",
      album: "Chart Toppers",
      duration: 219,
      cover_url: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500",
      audio_url: "youtube:nfWlot6h_JM",
      language: "English"
    },
    {
      title: "Attention",
      artist: "Charlie Puth",
      album: "Chart Toppers",
      duration: 210,
      cover_url: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500",
      audio_url: "youtube:nfs8NYg7yQM",
      language: "English"
    },

    // ── Album 3: Soul & R&B ──────────────────────────────────────────────────
    {
      title: "Rolling in the Deep",
      artist: "Adele",
      album: "Soul & R&B",
      duration: 228,
      cover_url: "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=500",
      audio_url: "youtube:rYEDA3JcQqw",
      language: "English"
    },
    {
      title: "Stay With Me",
      artist: "Sam Smith",
      album: "Soul & R&B",
      duration: 172,
      cover_url: "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=500",
      audio_url: "youtube:pB-5XG-DbAA",
      language: "English"
    },
    {
      title: "Someone You Loved",
      artist: "Lewis Capaldi",
      album: "Soul & R&B",
      duration: 222,
      cover_url: "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=500",
      audio_url: "youtube:zABZyoQOzgw",
      language: "English"
    },
    {
      title: "Talk",
      artist: "Khalid",
      album: "Soul & R&B",
      duration: 211,
      cover_url: "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=500",
      audio_url: "youtube:GkNJvbILlNc",
      language: "English"
    },

    // ── Album 4: Chill Vibes ─────────────────────────────────────────────────
    {
      title: "Yellow",
      artist: "Coldplay",
      album: "Chill Vibes",
      duration: 268,
      cover_url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500",
      audio_url: "youtube:yKNxeF4KMsY",
      language: "English"
    },
    {
      title: "Circles",
      artist: "Post Malone",
      album: "Chill Vibes",
      duration: 215,
      cover_url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500",
      audio_url: "youtube:wXhTHyIgQ_U",
      language: "English"
    },
    {
      title: "Peaches",
      artist: "Justin Bieber",
      album: "Chill Vibes",
      duration: 198,
      cover_url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500",
      audio_url: "youtube:tQ0yjYUFKAE",
      language: "English"
    },
    {
      title: "Heat Waves",
      artist: "Glass Animals",
      album: "Chill Vibes",
      duration: 238,
      cover_url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500",
      audio_url: "youtube:mRD0-GxqHVo",
      language: "English"
    }
  ];

  for (const t of tracks) {
    insert.run(t.title, t.artist, t.album, t.duration, t.cover_url, t.audio_url, t.language);
  }

  console.log(`✓ Seeded ${tracks.length} real YouTube songs across 4 albums.`);
}

seedTracks();

module.exports = db;
