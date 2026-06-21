// ==============================
// MUSIFY — MOBILE CORE LOGIC
// ==============================

// State
let state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user')) || null,
  tracks: [],
  isPlaying: false,
  playlists: [],
  likedTrackIds: new Set(),
  currentTab: 'home',
  currentPlaylistId: null,
  activeQueue: [],
  originalQueue: [],
  queueIndex: -1,
  volume: parseFloat(localStorage.getItem('volume') || '0.8'),
  isMuted: false,
  isShuffle: false,
  isRepeat: false,
  globalSearchResults: [],
  directorPreferences: []  // saved music director IDs
};

// ── SMOOTH ROTATION (requestAnimationFrame) ──────────────
let _rotRafId = null;
let _rotDeg   = 0;
let _rotLast  = null;
const ROT_SPD  = 360 / 28; // 1 full revolution per 28 seconds

function _rotFrame(now) {
  const dt = (now - _rotLast) / 1000;
  _rotLast = now;
  _rotDeg = (_rotDeg + dt * ROT_SPD) % 360;
  if (playerCover) playerCover.style.transform = `rotate(${_rotDeg}deg)`;
  if (state.isPlaying) _rotRafId = requestAnimationFrame(_rotFrame);
  else _rotRafId = null;
}

function startRotation() {
  if (_rotRafId) return;
  _rotLast = performance.now();
  _rotRafId = requestAnimationFrame(_rotFrame);
}

function stopRotation() {
  if (_rotRafId) { cancelAnimationFrame(_rotRafId); _rotRafId = null; }
}

// ── DOM References ──────────────────────────────────────
const authScreen          = document.getElementById('auth-screen');
const appScreen           = document.getElementById('app-screen');
const loginForm           = document.getElementById('login-form');
const registerForm        = document.getElementById('register-form');
const switchToRegister    = document.getElementById('switch-to-register');
const switchToLogin       = document.getElementById('switch-to-login');
const profileUsername     = document.getElementById('profile-username');
const logoutBtn           = document.getElementById('logout-btn');

const navItems            = document.querySelectorAll('.nav-item');
const tabContents         = document.querySelectorAll('.tab-content');
const tracksGrid          = document.getElementById('tracks-grid');
const searchInput         = document.getElementById('search-input');
const headerSearchBar     = document.getElementById('header-search-bar');
const searchInputLargeField = document.getElementById('search-input-large-field');
const searchResultsGrid   = document.getElementById('search-results-list'); // renamed to list
const searchResultsTitle  = document.getElementById('search-results-title');
const likedCountText      = document.getElementById('liked-count-text');
const likedSongsListContainer = document.getElementById('liked-songs-list-container');
const playlistList        = document.getElementById('playlist-list');
const createPlaylistBtn   = document.getElementById('create-playlist-btn');
const playlistDetailTitle = document.getElementById('playlist-detail-title');
const playlistDetailCount = document.getElementById('playlist-detail-count');
const deleteCurrentPlaylistBtn = document.getElementById('delete-current-playlist-btn');
const playlistSongsListContainer = document.getElementById('playlist-songs-list-container');
const welcomeMessage      = document.getElementById('welcome-message');
const heroPlayBtn         = document.getElementById('hero-play-btn');
const toastNotification   = document.getElementById('toast-notification');
const toastMessage        = document.getElementById('toast-message');

// Player
const audioPlayer         = document.getElementById('audio-player');
const playBtn             = document.getElementById('play-btn');
const prevBtn             = document.getElementById('prev-btn');
const nextBtn             = document.getElementById('next-btn');
const shuffleBtn          = document.getElementById('shuffle-btn');
const repeatBtn           = document.getElementById('repeat-btn');
const progressSlider      = document.getElementById('progress-slider');
const currentTimeLabel    = document.getElementById('current-time');
const totalTimeLabel      = document.getElementById('total-time');
const volumeSlider        = document.getElementById('volume-slider');
const muteBtn             = document.getElementById('mute-btn');
const playerCover         = document.getElementById('player-cover');
const playerTitle         = document.getElementById('player-title');
const playerArtist        = document.getElementById('player-artist');
const playerLikeBtn       = document.getElementById('player-like-btn');
const miniVisualizer      = document.getElementById('mini-visualizer'); // kept for compat

// Mobile-specific
const miniPlayer          = document.getElementById('mini-player');
const miniCoverImg        = document.getElementById('mini-cover-img');
const miniTitle           = document.getElementById('mini-title');
const miniArtist          = document.getElementById('mini-artist');
const miniPlayBtn         = document.getElementById('mini-play-btn');
const miniProgressFill    = document.getElementById('mini-progress-fill');
const nowPlayingScreen    = document.getElementById('now-playing-screen');
const npBackdrop          = document.getElementById('np-backdrop');
const npArtworkWrapper    = document.getElementById('np-artwork-wrapper');
const headerAvatarBtn     = document.getElementById('header-avatar-btn');
const profileDropdown     = document.getElementById('profile-dropdown');

// ── YouTube IFrame API ──────────────────────────────────
const ytTag = document.createElement('script');
ytTag.src = 'https://www.youtube.com/iframe_api';
document.getElementsByTagName('script')[0].parentNode.insertBefore(ytTag, document.getElementsByTagName('script')[0]);

let ytPlayer = null;
let ytPlayerReady = false;
let ytProgressInterval = null;

window.onYouTubeIframeAPIReady = function () {
  ytPlayer = new YT.Player('yt-player-container', {
    height: '1', width: '1', videoId: '',
    playerVars: { playsinline: 1, controls: 0, disablekb: 1, fs: 0, rel: 0 },
    events: {
      onReady: (e) => { ytPlayerReady = true; ytPlayer.setVolume(state.volume * 100); },
      onStateChange: onYTStateChange,
      onError: () => { showToast('Stream error. Skipping...'); playNext(); }
    }
  });
};

function onYTStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    state.isPlaying = true;
    updatePlayerUI();
    startYtProgressLoop();
  } else if (event.data === YT.PlayerState.PAUSED) {
    state.isPlaying = false;
    updatePlayerUI();
    stopYtProgressLoop();
  } else if (event.data === YT.PlayerState.ENDED) {
    playNext();
  }
}

function isCurrentTrackYoutube() {
  const t = state.activeQueue[state.queueIndex];
  return t && t.audio_url && t.audio_url.startsWith('youtube:');
}

function startYtProgressLoop() {
  stopYtProgressLoop();
  ytProgressInterval = setInterval(() => {
    if (!ytPlayer || !ytPlayerReady || !state.isPlaying || !isCurrentTrackYoutube()) return;
    const cur = ytPlayer.getCurrentTime();
    const dur = ytPlayer.getDuration();
    if (dur) {
      const pct = (cur / dur) * 100;
      progressSlider.value = pct;
      currentTimeLabel.textContent = formatTime(cur);
      totalTimeLabel.textContent = formatTime(dur);
      miniProgressFill.style.width = pct + '%';
      updateCoverRotation(cur);
    }
  }, 300);
}

function stopYtProgressLoop() {
  if (ytProgressInterval) { clearInterval(ytProgressInterval); ytProgressInterval = null; }
}

// ── API Helper ──────────────────────────────────────────
async function apiRequest(url, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  try {
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (err) {
    showToast(err.message);
    throw err;
  }
}

function showToast(msg) {
  toastMessage.textContent = msg;
  toastNotification.classList.remove('hidden');
  toastNotification.classList.add('show');
  setTimeout(() => {
    toastNotification.classList.remove('show');
    setTimeout(() => toastNotification.classList.add('hidden'), 300);
  }, 3000);
}

function formatTime(s) {
  if (isNaN(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

// ── AUTH ────────────────────────────────────────────────
switchToRegister.addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.classList.remove('active');
  registerForm.classList.add('active');
});
switchToLogin.addEventListener('click', (e) => {
  e.preventDefault();
  registerForm.classList.remove('active');
  loginForm.classList.add('active');
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  try {
    const data = await apiRequest('/api/auth/login', 'POST', { username, password });
    loginUser(data.token, data.user);
    showToast(`Welcome back, ${data.user.username}!`);
  } catch (_) {}
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('register-username').value;
  const password = document.getElementById('register-password').value;
  try {
    const data = await apiRequest('/api/auth/register', 'POST', { username, password });
    loginUser(data.token, data.user);
    showToast(`Welcome, ${data.user.username}!`);
  } catch (_) {}
});

function loginUser(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  profileUsername.textContent = user.username;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  welcomeMessage.textContent = `${greet}, ${user.username} 👋`;
  initApp();
  // Check if user has set preferences; if not, show onboarding after a short delay
  setTimeout(async () => {
    try {
      const prefs = await apiRequest('/api/preferences');
      state.directorPreferences = prefs.directors || [];
      if (state.directorPreferences.length === 0) {
        showOnboarding();
      } else {
        loadForYouRecommendations();
      }
    } catch (_) {}
  }, 600);
}

function logout() {
  state.token = null; state.user = null;
  state.playlists = []; state.likedTrackIds.clear();
  localStorage.removeItem('token'); localStorage.removeItem('user');
  audioPlayer.pause();
  if (ytPlayer && ytPlayerReady) ytPlayer.pauseVideo();
  stopYtProgressLoop();
  state.isPlaying = false;
  appScreen.classList.add('hidden');
  authScreen.classList.remove('hidden');
  loginForm.reset(); registerForm.reset();
  loginForm.classList.add('active');
  registerForm.classList.remove('active');
  profileDropdown.classList.add('hidden');
}

logoutBtn.addEventListener('click', logout);

// Profile dropdown toggle
headerAvatarBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  profileDropdown.classList.toggle('hidden');
});
document.addEventListener('click', () => profileDropdown.classList.add('hidden'));

// ── APP INIT ────────────────────────────────────────────
async function initApp() {
  try {
    await fetchTracks();
    await fetchPlaylists();
    await fetchLikedSongs();
    renderTracksGrid();
    renderPlaylists();
  } catch (e) { console.error('Init error:', e); }
}

// ── ONBOARDING ───────────────────────────────────────────────────────────────
const onboardingScreen  = document.getElementById('onboarding-screen');
const obDirectorsList   = document.getElementById('ob-directors-list');
const obContinueBtn     = document.getElementById('ob-continue-btn');
const obSkipBtn         = document.getElementById('ob-skip-btn');
const obCountEl         = document.getElementById('ob-count');

const obSelectedIds = new Set(); // tracks which director IDs are selected

function showOnboarding() {
  renderOnboarding();
  onboardingScreen.classList.remove('hidden');
  lucide.createIcons();
}
function hideOnboarding() {
  onboardingScreen.classList.add('hidden');
}

function renderOnboarding() {
  // Group directors by category
  const categories = {};
  for (const d of MUSIC_DIRECTORS) {
    if (!categories[d.category]) categories[d.category] = [];
    categories[d.category].push(d);
  }

  // Pre-select any already-saved preferences
  obSelectedIds.clear();
  for (const pref of (state.directorPreferences || [])) {
    obSelectedIds.add(pref.director_id);
  }

  let html = '';
  for (const [cat, dirs] of Object.entries(categories)) {
    html += `<div class="ob-category-label">${escapeHtml(cat)}</div>`;
    html += `<div class="ob-directors-grid">`;
    for (const d of dirs) {
      const sel = obSelectedIds.has(d.id) ? 'selected' : '';
      html += `
        <div class="ob-director-card ${sel}" id="ob-card-${d.id}"
          style="background: ${d.gradient};"
          onclick="toggleDirectorCard('${d.id}','${escapeHtml(d.name).replace(/'/g, '&apos;')}')">
          <div class="ob-card-check">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20,6 9,17 4,12"/>
            </svg>
          </div>
          <span class="ob-card-emoji">${d.emoji}</span>
          <div class="ob-card-name">${escapeHtml(d.name)}</div>
          <div class="ob-card-known">${escapeHtml(d.knownFor)}</div>
        </div>`;
    }
    html += `</div>`;
  }
  obDirectorsList.innerHTML = html;
  updateObCount();
}

function toggleDirectorCard(dirId, dirName) {
  const card = document.getElementById(`ob-card-${dirId}`);
  if (!card) return;
  if (obSelectedIds.has(dirId)) {
    obSelectedIds.delete(dirId);
    card.classList.remove('selected');
  } else {
    obSelectedIds.add(dirId);
    card.classList.add('selected');
  }
  updateObCount();
}

function updateObCount() {
  const n = obSelectedIds.size;
  if (obCountEl) {
    obCountEl.textContent = n === 0
      ? 'Select at least 1 director'
      : `${n} director${n > 1 ? 's' : ''} selected`;
  }
  if (obContinueBtn) obContinueBtn.disabled = n === 0;
}

async function savePreferences() {
  const selected = MUSIC_DIRECTORS
    .filter(d => obSelectedIds.has(d.id))
    .map(d => ({ id: d.id, name: d.name }));
  try {
    await apiRequest('/api/preferences', 'POST', { directors: selected });
    state.directorPreferences = selected.map(d => ({ director_id: d.id, director_name: d.name }));
    hideOnboarding();
    showToast(`Taste saved! Loading your songs...`);
    loadForYouRecommendations();
  } catch (_) {
    showToast('Could not save preferences.');
  }
}

obContinueBtn && obContinueBtn.addEventListener('click', savePreferences);
obSkipBtn && obSkipBtn.addEventListener('click', () => {
  hideOnboarding();
  showToast('You can edit your taste anytime from home.');
});

// ── FOR YOU RECOMMENDATIONS ───────────────────────────────────────────────────
async function loadForYouRecommendations() {
  const forYouSection = document.getElementById('for-you-section');
  const forYouRows    = document.getElementById('for-you-rows');
  if (!forYouSection || !forYouRows || !state.directorPreferences.length) return;

  forYouSection.style.display = '';

  // Show top 4 selected directors
  const topDirs = state.directorPreferences.slice(0, 4);

  // Render skeleton rows first
  forYouRows.innerHTML = topDirs.map(pref => {
    const meta = MUSIC_DIRECTORS.find(d => d.id === pref.director_id) || {};
    const dotColor = (meta.gradient || '').match(/#[0-9a-f]{6}/i)?.[0] || '#8b5cf6';
    return `
      <div class="fy-director-row" id="fy-row-${pref.director_id}">
        <div class="fy-row-header">
          <div class="fy-row-label">
            <div class="fy-row-dot" style="background:${dotColor}"></div>
            <span class="fy-row-name">${escapeHtml(pref.director_name)}</span>
            <span class="fy-row-genre">${escapeHtml(meta.category || '')}</span>
          </div>
        </div>
        <div class="fy-songs-scroll" id="fy-scroll-${pref.director_id}">
          ${[1,2,3,4].map(() => `
            <div class="fy-skeleton">
              <div class="fy-skeleton-img"></div>
              <div class="fy-skeleton-text" style="margin-top:8px"></div>
              <div class="fy-skeleton-text" style="width:60%;margin-top:4px"></div>
            </div>`).join('')}
        </div>
      </div>`;
  }).join('');

  // Fetch songs for each director in parallel
  await Promise.allSettled(topDirs.map(async pref => {
    const meta = MUSIC_DIRECTORS.find(d => d.id === pref.director_id) || {};
    const query = meta.searchQuery || `${pref.director_name} songs`;
    const scrollEl = document.getElementById(`fy-scroll-${pref.director_id}`);
    if (!scrollEl) return;
    try {
      const results = await apiRequest(
        `/api/tracks/global-search?q=${encodeURIComponent(query)}`
      );
      const songs = results.slice(0, 6);
      if (!songs.length) {
        scrollEl.innerHTML = `<p class="empty-hint" style="font-size:0.78rem;padding:12px 4px;">No songs found.</p>`;
        return;
      }
      scrollEl.innerHTML = songs.map((t, i) => createFySongCardHTML(t, i, songs)).join('');
      lucide.createIcons();
    } catch (_) {
      scrollEl.innerHTML = `<p class="empty-hint" style="font-size:0.78rem;padding:12px 4px;">Couldn't load songs.</p>`;
    }
  }));
}

function createFySongCardHTML(track, index, trackList) {
  const cover = escapeHtml(track.cover_url || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=300');
  const tracksJSON = JSON.stringify(trackList).replace(/"/g, '&quot;');
  return `
    <div class="fy-song-card" onclick="playFromTableList(${JSON.stringify(track.id)},${index},${tracksJSON})">
      <div class="fy-song-img-wrap">
        <img src="${cover}" alt="" loading="lazy">
        <div class="fy-song-overlay">
          <button class="fy-play-circle" title="Play">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
              fill="currentColor" stroke="none"><polygon points="5,3 19,12 5,21"/></svg>
          </button>
        </div>
      </div>
      <div class="fy-song-info">
        <div class="fy-song-title">${escapeHtml(track.title)}</div>
        <div class="fy-song-artist">${escapeHtml(track.artist)}</div>
      </div>
    </div>`;
}

async function fetchTracks(search = '') {
  const data = await apiRequest(`/api/tracks?search=${encodeURIComponent(search)}`);
  state.tracks = data;
  return data;
}
async function fetchPlaylists() {
  state.playlists = await apiRequest('/api/playlists');
}
async function fetchLikedSongs() {
  const data = await apiRequest('/api/tracks/liked');
  state.likedTrackIds = new Set(data.map(t => t.id));
}

// ── RENDER ──────────────────────────────────────────────
function renderTracksGrid() {
  tracksGrid.innerHTML = state.tracks.map(t => createSongCardHTML(t)).join('');
  lucide.createIcons();
}

function createSongCardHTML(track) {
  return `
    <div class="song-card" onclick="playSongDirectly(${track.id})">
      <div class="card-img-wrap">
        <img src="${track.cover_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400'}"
             alt="${escapeHtml(track.title)}" loading="lazy">
        <div class="card-play-overlay">
          <button class="card-play-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5,3 19,12 5,21"/></svg>
          </button>
        </div>
      </div>
      <div class="card-info">
        <span class="card-title">${escapeHtml(track.title)}${langBadge(track.language)}</span>
        <span class="card-artist">${escapeHtml(track.artist)}</span>
      </div>
    </div>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Returns a small language badge pill — only shown for non-English to avoid noise
function langBadge(lang) {
  if (!lang || lang === 'English') return '';
  return `<span class="lang-badge">${escapeHtml(lang)}</span>`;
}

function renderPlaylists() {
  if (state.playlists.length === 0) {
    playlistList.innerHTML = `<li style="padding: 16px 0; color: var(--text-muted); font-size: 0.85rem; text-align: center;">No playlists yet. Create one!</li>`;
    return;
  }
  playlistList.innerHTML = state.playlists.map(pl => `
    <li class="playlist-item ${state.currentPlaylistId === pl.id ? 'active' : ''}" onclick="viewPlaylist(${pl.id})">
      <div class="playlist-item-icon">
        <i data-lucide="music-2"></i>
      </div>
      <div class="playlist-item-info">
        <span class="playlist-item-name">${escapeHtml(pl.name)}</span>
        <span class="playlist-item-meta">Playlist &bull; ${pl.track_count || 0} songs</span>
      </div>
    </li>
  `).join('');
  lucide.createIcons();
}

// ── TABS ────────────────────────────────────────────────
function switchTab(tabId) {
  state.currentTab = tabId;
  navItems.forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-tab') === tabId);
  });
  tabContents.forEach(el => {
    el.classList.toggle('active', el.id === `tab-${tabId}`);
  });
  if (tabId === 'search') {
    headerSearchBar.classList.remove('hidden');
    searchInputLargeField.focus();
  } else {
    headerSearchBar.classList.add('hidden');
  }
  if (tabId === 'liked') loadLikedSongsView();
  else if (tabId === 'home') { state.currentPlaylistId = null; initApp(); }
  else if (tabId === 'library') { fetchPlaylists().then(renderPlaylists); }
}

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab(item.getAttribute('data-tab'));
  });
});

// ── NOW PLAYING SCREEN ──────────────────────────────────
function openNowPlaying() {
  if (state.activeQueue.length === 0) return;
  nowPlayingScreen.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeNowPlaying() {
  nowPlayingScreen.classList.add('hidden');
  document.body.style.overflow = '';
}

// ── SEARCH ──────────────────────────────────────────────
async function performSearch(query) {
  const browseHint     = document.getElementById('search-browse-hint');
  const albumsSection  = document.getElementById('search-albums-section');
  const albumContainer = document.getElementById('search-albums-container');
  const songsSection   = document.getElementById('search-songs-section');
  const songsList      = document.getElementById('search-results-list');
  const globalSection  = document.getElementById('global-results-section');
  const globalGrid     = document.getElementById('global-search-results-grid');

  if (!query.trim()) {
    browseHint    && (browseHint.style.display = '');
    albumsSection && (albumsSection.style.display = 'none');
    songsSection  && (songsSection.style.display = 'none');
    globalSection && (globalSection.style.display = 'none');
    return;
  }

  browseHint && (browseHint.style.display = 'none');

  try {
    const local = await apiRequest(`/api/tracks?search=${encodeURIComponent(query)}`);


    // ── 1. ALBUM SECTION (shown first, auto-expanded) ────
    const albumNamesFromResults = [...new Set(local.map(t => t.album).filter(Boolean))];
    const qLow = query.toLowerCase();
    // Also match albums by their name even if no song title matched
    const albumNamesFromDirectMatch = [...new Set(
      state.tracks
        .filter(t => t.album && t.album.toLowerCase().includes(qLow))
        .map(t => t.album)
    )];
    const allAlbumNames = [...new Set([...albumNamesFromResults, ...albumNamesFromDirectMatch])];

    if (allAlbumNames.length && albumsSection && albumContainer) {
      const albumHTML = allAlbumNames.map(album => {
        const allSongs = state.tracks.filter(t => t.album === album);
        if (!allSongs.length) return '';
        const cover    = escapeHtml(allSongs[0].cover_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400');
        const artist   = escapeHtml(allSongs[0].artist || '');
        const totalMin = Math.round(allSongs.reduce((s, t) => s + (t.duration || 0), 0) / 60);
        return `
          <div class="album-full-card">
            <div class="album-full-backdrop" style="background-image:url('${cover}')"></div>
            <div class="album-full-header">
              <img class="album-full-cover" src="${cover}" alt="${escapeHtml(album)}">
              <div class="album-full-meta">
                <span class="album-full-label">ALBUM</span>
                <div class="album-full-name">${escapeHtml(album)}</div>
                <div class="album-full-sub">${artist} &bull; ${allSongs.length} songs &bull; ${totalMin} min</div>
                <div class="album-full-actions">
                  <button class="album-play-all-btn"
                    onclick="playAlbum('${escapeHtml(album).replace(/'/g, "&apos;")}')"
                    title="Play All">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5,3 19,12 5,21"/></svg>
                    Play All
                  </button>
                  <button class="album-collapse-btn" onclick="toggleAlbumCollapse(this)" title="Collapse">
                    <i data-lucide="chevron-up"></i>
                  </button>
                </div>
              </div>
            </div>
            <div class="album-full-tracks">
              ${allSongs.map((t, i) => createSearchListItemHTML(t, i, allSongs)).join('')}
            </div>
          </div>`;
      }).filter(Boolean).join('');
      albumContainer.innerHTML = albumHTML;
      albumsSection.style.display = '';
    } else if (albumsSection) {
      albumsSection.style.display = 'none';
    }

    // ── 2. SONGS SECTION (songs not already in an album above) ───
    const shownIds = new Set(
      allAlbumNames.flatMap(a => state.tracks.filter(t => t.album === a).map(t => t.id))
    );
    const standaloneSongs = local.filter(t => !shownIds.has(t.id));
    if (standaloneSongs.length && songsSection && songsList) {
      searchResultsTitle.textContent = `Songs matching "${query}"`;
      songsList.innerHTML = standaloneSongs.map((t, i) => createSearchListItemHTML(t, i, standaloneSongs)).join('');
      songsSection.style.display = '';
    } else if (songsSection) {
      songsSection.style.display = 'none';
    }

    // ── 3. GLOBAL SECTION ────────────────────────────────
    globalSection && (globalSection.style.display = '');
    globalGrid.innerHTML = `<p class="empty-hint">Searching globally...</p>`;
    const global = await apiRequest(`/api/tracks/global-search?q=${encodeURIComponent(query)}`);
    state.globalSearchResults = global;
    globalGrid.innerHTML = global.length
      ? global.map((t, i) => createGlobalListItemHTML(t, i)).join('')
      : `<p class="empty-hint">No global results found.</p>`;

    lucide.createIcons();
  } catch (e) { console.error('Search error:', e); }
}

function toggleAlbumCollapse(btn) {
  const card   = btn.closest('.album-full-card');
  const tracks = card.querySelector('.album-full-tracks');
  const icon   = btn.querySelector('i');
  const isHidden = tracks.style.display === 'none';
  tracks.style.display = isHidden ? '' : 'none';
  icon.setAttribute('data-lucide', isHidden ? 'chevron-up' : 'chevron-down');
  lucide.createIcons();
}

function toggleAlbumExpand(header) {
  const tracks = header.nextElementSibling;
  const chevron = header.querySelector('.album-search-chevron');
  if (!tracks) return;
  tracks.classList.toggle('hidden');
  if (chevron) chevron.style.transform = tracks.classList.contains('hidden') ? '' : 'rotate(180deg)';
}

function playAlbum(albumName) {
  const songs = state.tracks.filter(t => t.album === albumName);
  if (songs.length) playTrackNow(songs[0], songs);
}

function createSearchListItemHTML(track, index, trackList) {
  const cover = escapeHtml(track.cover_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=80');
  const trackJSON = JSON.stringify(track).replace(/"/g, '&quot;');
  const listJSON  = JSON.stringify(trackList).replace(/"/g, '&quot;');
  return `
    <div class="search-list-item" onclick="playFromTableList(${track.id},${index},${JSON.stringify(trackList).replace(/"/g, '&quot;')})">
      <img class="sli-cover" src="${cover}" alt="">
      <div class="sli-details">
        <div class="sli-title">${escapeHtml(track.title)}${langBadge(track.language)}</div>
        <div class="sli-artist">${escapeHtml(track.artist)}${track.album ? ' &bull; ' + escapeHtml(track.album) : ''}</div>
      </div>
      <div class="sli-actions" onclick="event.stopPropagation()">
        <button class="sli-three-dot" title="More options"
          onclick="openContextMenu(${trackJSON}, ${index}, ${listJSON}, false)">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
            fill="currentColor" stroke="none">
            <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
          </svg>
        </button>
      </div>
    </div>`;
}

function createGlobalListItemHTML(track, index) {
  const cover = escapeHtml(track.cover_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=80');
  const trackJSON = JSON.stringify(track).replace(/"/g, '&quot;');
  const listJSON  = JSON.stringify(state.globalSearchResults).replace(/"/g, '&quot;');
  return `
    <div class="search-list-item" onclick="playGlobalSong(${index})">
      <img class="sli-cover" src="${cover}" alt="">
      <div class="sli-details">
        <div class="sli-title">${escapeHtml(track.title)}${langBadge(track.language)}</div>
        <div class="sli-artist">${escapeHtml(track.artist)}${track.album ? ' &bull; ' + escapeHtml(track.album) : ''}</div>
      </div>
      <div class="sli-actions" onclick="event.stopPropagation()">
        <button class="sli-three-dot" title="More options"
          onclick="openContextMenu(${trackJSON}, ${index}, ${listJSON}, false)">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
            fill="currentColor" stroke="none">
            <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
          </svg>
        </button>
      </div>
    </div>`;
}

searchInputLargeField.addEventListener('input', (e) => {
  searchInput.value = e.target.value;
  performSearch(e.target.value);
});
searchInput.addEventListener('input', (e) => {
  searchInputLargeField.value = e.target.value;
  performSearch(e.target.value);
});

// ── LIKED SONGS ─────────────────────────────────────────
async function loadLikedSongsView() {
  try {
    const data = await apiRequest('/api/tracks/liked');
    likedCountText.textContent = `${data.length} songs`;
    renderTracksTable(data, likedSongsListContainer, false);
  } catch (_) {}
}

// ── PLAYLISTS ────────────────────────────────────────────
createPlaylistBtn.addEventListener('click', async () => {
  const name = prompt('Enter playlist name:');
  if (!name || !name.trim()) return;
  try {
    await apiRequest('/api/playlists', 'POST', { name: name.trim() });
    await fetchPlaylists();
    renderPlaylists();
    showToast(`Playlist "${name}" created!`);
  } catch (_) {}
});

async function viewPlaylist(playlistId) {
  try {
    const data = await apiRequest(`/api/playlists/${playlistId}/tracks`);
    state.currentPlaylistId = playlistId;
    playlistDetailTitle.textContent = data.playlist.name;
    playlistDetailCount.textContent = `${data.tracks.length} songs`;
    switchTab('playlist-detail');
    renderTracksTable(data.tracks, playlistSongsListContainer, true);
    renderPlaylists();
  } catch (_) {}
}

deleteCurrentPlaylistBtn.addEventListener('click', async () => {
  if (!state.currentPlaylistId) return;
  if (!confirm('Delete this playlist?')) return;
  try {
    await apiRequest(`/api/playlists/${state.currentPlaylistId}`, 'DELETE');
    showToast('Playlist deleted.');
    state.currentPlaylistId = null;
    await fetchPlaylists();
    renderPlaylists();
    switchTab('library');
  } catch (_) {}
});

// ── TRACKS TABLE ─────────────────────────────────────────
function renderTracksTable(tracks, container, isPlaylistView = false) {
  if (!tracks.length) {
    container.innerHTML = `<p class="text-muted">No songs here yet.</p>`;
    return;
  }
  const tracksJSON = JSON.stringify(tracks).replace(/"/g, '&quot;');
  let html = `
    <table class="songs-table">
      <thead><tr>
        <th class="table-index">#</th>
        <th>Title</th>
        <th class="table-album">Album</th>
        <th class="table-actions"></th>
      </tr></thead>
      <tbody>`;

  tracks.forEach((track, i) => {
    const isLiked = state.likedTrackIds.has(track.id);
    const plOptions = state.playlists.map(pl =>
      `<a href="#" onclick="addTrackToPlaylist(event,${track.id},${pl.id})">${escapeHtml(pl.name)}</a>`
    ).join('');

    html += `
      <tr onclick="playFromTableList(${track.id},${i},${tracksJSON})">
        <td class="table-index">${i + 1}</td>
        <td>
          <div class="table-title-col">
            <img class="table-cover" src="${track.cover_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=80'}" alt="">
            <div>
              <div class="table-song-title">${escapeHtml(track.title)}${langBadge(track.language)}</div>
              <div class="table-song-artist">${escapeHtml(track.artist)}</div>
            </div>
          </div>
        </td>
        <td class="table-album">${escapeHtml(track.album || '-')}</td>
        <td class="table-actions" onclick="event.stopPropagation()">
          ${isPlaylistView ? `
            <button class="table-action-btn" onclick="removeTrackFromCurrentPlaylist(${track.id},event)" title="Remove">
              <i data-lucide="trash-2"></i>
            </button>
          ` : ''}
          <button class="table-action-btn"
            title="More options"
            onclick="ctxOpenForTable(${JSON.stringify(track).replace(/"/g,'&quot;')}, ${i}, '${JSON.stringify(tracks).replace(/"/g,'&quot;')}', ${isPlaylistView})">
            <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24"
              fill="currentColor" stroke="none">
              <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>
        </td>
      </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
  lucide.createIcons();
}

// ── CONTEXT MENU (Bottom Sheet) ──────────────────────────────────────────────
let _ctxTrack      = null;  // currently shown track
let _ctxTrackList  = null;  // queue context
let _ctxTrackIndex = 0;
let _ctxIsPlaylist = false; // whether opened from playlist view

const ctxOverlay       = document.getElementById('ctx-overlay');
const ctxSheet         = document.getElementById('ctx-sheet');
const ctxMainView      = document.getElementById('ctx-main-view');
const ctxPlaylistView  = document.getElementById('ctx-playlist-view');
const ctxPlOptions     = document.getElementById('ctx-playlist-options');
const ctxRemoveOpt     = document.getElementById('ctx-remove-opt');
const ctxHeartSvg      = document.getElementById('ctx-heart-svg');
const ctxLikeBtn       = document.getElementById('ctx-like-btn');

function openContextMenu(track, index, trackList, isPlaylistView) {
  _ctxTrack      = track;
  _ctxTrackList  = Array.isArray(trackList) ? trackList : [track];
  _ctxTrackIndex = index || 0;
  _ctxIsPlaylist = !!isPlaylistView;

  // Populate song info
  document.getElementById('ctx-song-img').src =
    track.cover_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120';
  document.getElementById('ctx-song-title').textContent  = track.title  || 'Unknown';
  document.getElementById('ctx-song-artist').textContent = track.artist || '';

  // Update like button state
  _ctxRefreshLikeBtn();

  // Show/hide remove-from-playlist option
  if (ctxRemoveOpt) ctxRemoveOpt.style.display = _ctxIsPlaylist ? '' : 'none';

  // Reset to main view
  ctxMainView && ctxMainView.classList.remove('hidden');
  ctxPlaylistView && ctxPlaylistView.classList.add('hidden');

  // Reveal
  ctxOverlay && ctxOverlay.classList.remove('hidden');
  requestAnimationFrame(() => {
    ctxOverlay && ctxOverlay.classList.add('open');
    ctxSheet   && ctxSheet.classList.add('open');
  });
  lucide.createIcons();
}

function _ctxRefreshLikeBtn() {
  if (!_ctxTrack || !ctxHeartSvg || !ctxLikeBtn) return;
  const liked = state.likedTrackIds.has(_ctxTrack.id);
  ctxHeartSvg.setAttribute('fill', liked ? '#ef4444' : 'none');
  ctxHeartSvg.setAttribute('stroke', liked ? '#ef4444' : 'currentColor');
  ctxLikeBtn.classList.toggle('liked', liked);
}

function closeContextMenu() {
  ctxOverlay && ctxOverlay.classList.remove('open');
  ctxSheet   && ctxSheet.classList.remove('open');
  setTimeout(() => {
    ctxOverlay && ctxOverlay.classList.add('hidden');
  }, 320);
}

// Called from table row 3-dot button (needs string→JSON parsing due to inline attr limits)
function ctxOpenForTable(track, index, tracksJSONStr, isPlaylistView) {
  let list = [track];
  if (tracksJSONStr) {
    try { list = JSON.parse(tracksJSONStr.replace(/&quot;/g, '"')); } catch (_) {}
  }
  openContextMenu(track, index, list, isPlaylistView);
}

// ── Context menu actions ──────────────────────────────────────────────────────

function ctxPlayNow() {
  closeContextMenu();
  if (_ctxTrack) playTrackNow(_ctxTrack, _ctxTrackList);
}

function ctxPlayNext() {
  if (!_ctxTrack) return;
  playNextInQueue(_ctxTrack);
  closeContextMenu();
}

function ctxAddToQueue() {
  if (!_ctxTrack) return;
  addToQueue(_ctxTrack);
  closeContextMenu();
}

async function ctxToggleLike() {
  if (!_ctxTrack) return;
  await toggleLikeTrack(_ctxTrack.id || _ctxTrack, null);
  _ctxRefreshLikeBtn();
}

function ctxGoToPlaylist() {
  // Switch to playlist sub-view
  ctxMainView  && ctxMainView.classList.add('hidden');
  ctxPlaylistView && ctxPlaylistView.classList.remove('hidden');
  // Render playlist options
  if (ctxPlOptions) {
    if (!state.playlists.length) {
      ctxPlOptions.innerHTML = `<p style="padding:16px;color:var(--text-muted);font-size:0.85rem;text-align:center;">No playlists yet. Create one from the Library tab.</p>`;
    } else {
      ctxPlOptions.innerHTML = state.playlists.map(pl => `
        <button class="ctx-pl-option" onclick="ctxAddToSpecificPlaylist(${pl.id})">
          <div class="ctx-pl-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
          </div>
          <span>${escapeHtml(pl.name)}</span>
          <span style="font-size:0.72rem;color:var(--text-muted)">${pl.track_count || 0} songs</span>
        </button>`).join('');
    }
  }
  lucide.createIcons();
}

async function ctxAddToSpecificPlaylist(playlistId) {
  if (!_ctxTrack) return;
  // Register global track first if needed
  let trackId = _ctxTrack.id;
  if (!trackId && _ctxTrack.global) {
    try {
      const r = await apiRequest('/api/tracks/register', 'POST', _ctxTrack);
      trackId = r.id;
    } catch (_) { showToast('Could not add track.'); closeContextMenu(); return; }
  }
  try {
    await apiRequest(`/api/playlists/${playlistId}/tracks`, 'POST', { trackId });
    const pl = state.playlists.find(p => p.id === playlistId);
    showToast(`Added to "${pl ? pl.name : 'Playlist'}"`);
    closeContextMenu();
  } catch (_) { showToast('Could not add to playlist.'); }
}

function ctxBackToMain() {
  ctxPlaylistView && ctxPlaylistView.classList.add('hidden');
  ctxMainView     && ctxMainView.classList.remove('hidden');
}

function ctxShare() {
  if (!_ctxTrack) return;
  const text = `${_ctxTrack.title} — ${_ctxTrack.artist}`;
  if (navigator.share) {
    navigator.share({ title: text, text: `Listen to ${text} on Musify!` }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!')).catch(() => showToast(`${text}`));
  }
  closeContextMenu();
}

async function ctxRemoveFromPlaylist() {
  if (!_ctxTrack || !state.currentPlaylistId) return;
  try {
    await apiRequest(`/api/playlists/${state.currentPlaylistId}/tracks/${_ctxTrack.id}`, 'DELETE');
    showToast('Removed from playlist');
    closeContextMenu();
    viewPlaylist(state.currentPlaylistId);
  } catch (_) { showToast('Could not remove.'); }
}

// ── Queue manipulation ────────────────────────────────────────────────────────

function addToQueue(track) {
  if (!state.activeQueue.length) {
    // Nothing playing — just start playing
    playTrackNow(track, [track]);
    showToast(`Playing "${track.title}"`);
    return;
  }
  state.activeQueue.push(track);
  if (state.originalQueue) state.originalQueue.push(track);
  showToast(`"${track.title}" added to queue`);
}

function playNextInQueue(track) {
  if (!state.activeQueue.length) {
    playTrackNow(track, [track]);
    showToast(`Playing "${track.title}"`);
    return;
  }
  const insertAt = state.queueIndex + 1;
  state.activeQueue.splice(insertAt, 0, track);
  if (state.originalQueue) state.originalQueue.splice(insertAt, 0, track);
  showToast(`"${track.title}" plays next`);
  if (!document.getElementById('queue-overlay').classList.contains('hidden')) renderQueue();
}

// ── Queue View UI ─────────────────────────────────────────────────────────────

function openQueueView() {
  const overlay = document.getElementById('queue-overlay');
  const sheet = document.getElementById('queue-sheet');
  overlay.classList.remove('hidden');
  requestAnimationFrame(() => {
    overlay.classList.add('open');
    sheet.classList.add('open');
  });
  renderQueue();
}

function closeQueueView() {
  const overlay = document.getElementById('queue-overlay');
  const sheet = document.getElementById('queue-sheet');
  overlay.classList.remove('open');
  sheet.classList.remove('open');
  setTimeout(() => { overlay.classList.add('hidden'); }, 320);
}

function renderQueue() {
  const container = document.getElementById('queue-list-container');
  if (!container) return;
  
  if (!state.activeQueue || state.activeQueue.length === 0) {
    container.innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:20px;font-size:0.9rem;">The queue is empty.</p>`;
    return;
  }

  // Show only from the current index onwards
  const queueItems = state.activeQueue.map((track, i) => {
    const isActive = i === state.queueIndex;
    const isPast = i < state.queueIndex;
    if (isPast) return ''; // don't show past songs in the generic "Playing Next" queue for simplicity, or we can show them with low opacity.
    
    const cover = escapeHtml(track.cover_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=80');
    return `
      <div class="queue-item ${isActive ? 'active-q' : ''}" onclick="playFromQueue(${i})">
        <img class="queue-item-img" src="${cover}" alt="">
        <div class="queue-item-info">
          <div class="queue-item-title">${escapeHtml(track.title)}</div>
          <div class="queue-item-artist">${escapeHtml(track.artist)}</div>
        </div>
        <div class="queue-item-actions" onclick="event.stopPropagation()">
          ${!isActive ? `<button class="queue-item-remove" onclick="removeFromQueue(${i})" title="Remove"><i data-lucide="x"></i></button>` : `<i data-lucide="bar-chart-2" color="var(--primary)"></i>`}
        </div>
      </div>
    `;
  }).filter(Boolean).join('');

  container.innerHTML = queueItems;
  lucide.createIcons();
}

function playFromQueue(index) {
  state.queueIndex = index;
  playTrack(state.activeQueue[index]);
  closeQueueView();
}

function removeFromQueue(index) {
  if (index === state.queueIndex) return; // can't remove currently playing this easily
  
  const track = state.activeQueue[index];
  state.activeQueue.splice(index, 1);
  if (state.originalQueue) {
    const origIndex = state.originalQueue.findIndex(t => t.id === track.id);
    if (origIndex > -1) state.originalQueue.splice(origIndex, 1);
  }
  
  if (index < state.queueIndex) {
    state.queueIndex--;
  }
  
  renderQueue();
  showToast('Removed from queue');
}

async function addTrackToPlaylist(e, trackId, playlistId) {
  e.preventDefault();

  try {
    await apiRequest(`/api/playlists/${playlistId}/tracks`, 'POST', { trackId });
    showToast('Added to playlist!');
    if (state.currentPlaylistId === playlistId) viewPlaylist(playlistId);
  } catch (_) {}
}

async function removeTrackFromCurrentPlaylist(trackId, e) {
  if (e) e.stopPropagation();
  if (!state.currentPlaylistId) return;
  try {
    await apiRequest(`/api/playlists/${state.currentPlaylistId}/tracks/${trackId}`, 'DELETE');
    showToast('Removed from playlist.');
    viewPlaylist(state.currentPlaylistId);
    fetchPlaylists();
  } catch (_) {}
}

// ── LIKE ─────────────────────────────────────────────────
async function toggleLikeTrack(trackOrId, e) {
  if (e) e.stopPropagation();
  let trackId, isLiked, trackObj = null;

  if (typeof trackOrId === 'object') {
    trackObj = trackOrId;
    const existing = state.tracks.find(t => t.audio_url === trackObj.audio_url);
    trackId = existing ? existing.id : null;
    isLiked = trackId ? state.likedTrackIds.has(trackId) : false;
  } else {
    trackId = trackOrId;
    isLiked = state.likedTrackIds.has(trackId);
  }

  if (!trackId && trackObj) {
    try {
      const r = await apiRequest('/api/tracks/register', 'POST', trackObj);
      trackId = r.id;
      await fetchTracks();
    } catch (_) { showToast('Failed to like track.'); return; }
  }

  try {
    await apiRequest(`/api/tracks/${trackId}/like`, isLiked ? 'DELETE' : 'POST');
    isLiked ? state.likedTrackIds.delete(trackId) : state.likedTrackIds.add(trackId);
    showToast(isLiked ? 'Removed from Liked Songs' : 'Added to Liked Songs');

    if (state.currentTab === 'liked') loadLikedSongsView();
    else if (state.currentTab === 'home') initApp();
    else if (state.currentTab === 'search') performSearch(searchInputLargeField.value);
    else if (state.currentTab === 'playlist-detail') viewPlaylist(state.currentPlaylistId);

    const cur = state.activeQueue[state.queueIndex];
    if (cur && cur.id === trackId) updatePlayerUI();
  } catch (_) {}
}

// ── PLAYBACK ─────────────────────────────────────────────
function playSongDirectly(trackId) {
  const track = state.tracks.find(t => t.id === trackId);
  if (track) playTrackNow(track, state.tracks);
}

function playFromTableList(trackId, index, trackList) {
  const track = trackList.find ? trackList.find(t => t.id === trackId) : null;
  if (track) playTrackNow(track, trackList);
}

async function playGlobalSong(index) {
  const track = state.globalSearchResults[index];
  if (!track) return;
  showToast('Streaming...');
  await playTrackNow(track, state.globalSearchResults);
}

async function playTrackNow(track, contextQueue = null) {
  let activeTrack = track;

  if (track.global) {
    try {
      activeTrack = await apiRequest('/api/tracks/register', 'POST', track);
      await fetchTracks();
      if (contextQueue) {
        const idx = contextQueue.findIndex(t => t.audio_url === track.audio_url);
        if (idx !== -1) contextQueue[idx] = activeTrack;
      }
    } catch (_) { showToast('Could not play this track.'); return; }
  }

  state.originalQueue = contextQueue ? [...contextQueue] : [activeTrack];

  if (state.isShuffle) {
    shuffleQueue(state.originalQueue, activeTrack);
  } else {
    state.activeQueue = [...state.originalQueue];
    state.queueIndex = state.activeQueue.findIndex(t => t.id === activeTrack.id);
  }

  playTrack(activeTrack);
  openNowPlaying(); // Only open when user explicitly clicks a song
}

function playTrack(track) {
  if (!track) return;
  const isYt = track.audio_url && track.audio_url.startsWith('youtube:');

  // Reset rotation
  stopRotation();
  _rotDeg = 0;

  if (isYt) {
    audioPlayer.pause();
    const videoId = track.audio_url.split(':')[1];
    if (ytPlayer && ytPlayerReady) {
      ytPlayer.loadVideoById(videoId);
      ytPlayer.setVolume(state.volume * 100);
      ytPlayer.playVideo();
      startYtProgressLoop();
    } else {
      showToast('Player loading...');
      setTimeout(() => playTrack(track), 1200);
      return;
    }
  } else {
    if (ytPlayer && ytPlayerReady) ytPlayer.pauseVideo();
    stopYtProgressLoop();
    audioPlayer.src = track.audio_url;
    audioPlayer.load();
    audioPlayer.play()
      .then(() => { state.isPlaying = true; updatePlayerUI(); })
      .catch(err => { console.error(err); showToast('Audio error.'); });
  }

  // Update metadata
  playerTitle.textContent = track.title;
  playerArtist.textContent = track.artist;
  playerCover.src = track.cover_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500';
  document.title = `${track.title} — ${track.artist} | Musify`;

  // Update mini player
  miniTitle.textContent = track.title;
  miniArtist.textContent = track.artist;
  miniCoverImg.src = track.cover_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120';

  // Update backdrop
  npBackdrop.style.backgroundImage = `url('${track.cover_url || ''}')`;

  state.isPlaying = true;
  miniPlayer.classList.remove('hidden');
  updatePlayerUI();
}

// ── COVER ROTATION → handled by rAF (see startRotation/stopRotation) ────

// ── PLAYER UI ────────────────────────────────────────────
function updatePlayerUI() {
  const playing = state.isPlaying;

  // Main play button (now playing screen)
  if (playing) {
    playBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`;
  } else {
    playBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5,3 19,12 5,21"/></svg>`;
  }

  // Mini player play button
  if (miniPlayBtn) {
    miniPlayBtn.innerHTML = playing
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5,3 19,12 5,21"/></svg>`;
  }

  // Artwork state + rotation
  if (npArtworkWrapper) {
    npArtworkWrapper.classList.toggle('paused', !playing);
  }
  if (playing) startRotation(); else stopRotation();

  // Like button in player
  const cur = state.activeQueue[state.queueIndex];
  if (cur) {
    const liked = state.likedTrackIds.has(cur.id);
    playerLikeBtn.classList.toggle('liked', liked);
    playerLikeBtn.innerHTML = liked
      ? `<i data-lucide="heart" fill="#ef4444"></i>`
      : `<i data-lucide="heart"></i>`;
  }

  // Shuffle / Repeat
  shuffleBtn.classList.toggle('active', state.isShuffle);
  repeatBtn.classList.toggle('active', !!state.isRepeat);
  if (state.isRepeat === 'one') {
    repeatBtn.innerHTML = `<i data-lucide="repeat-1"></i>`;
  } else {
    repeatBtn.innerHTML = `<i data-lucide="repeat"></i>`;
  }

  lucide.createIcons();
  
  // Update Queue View if it's open
  const qOverlay = document.getElementById('queue-overlay');
  if (qOverlay && !qOverlay.classList.contains('hidden')) {
    renderQueue();
  }
}

// Toggle from mini player
function togglePlayPause() {
  if (state.activeQueue.length === 0) {
    if (state.tracks.length) playSongDirectly(state.tracks[0].id);
    return;
  }
  const cur = state.activeQueue[state.queueIndex];
  const isYt = cur && cur.audio_url && cur.audio_url.startsWith('youtube:');

  if (state.isPlaying) {
    state.isPlaying = false;
    isYt ? ytPlayer?.pauseVideo() : audioPlayer.pause();
    if (isYt) stopYtProgressLoop();
  } else {
    state.isPlaying = true;
    isYt ? ytPlayer?.playVideo() : audioPlayer.play();
    if (isYt) startYtProgressLoop();
  }
  updatePlayerUI();
}

// Main play button in now-playing
playBtn.addEventListener('click', togglePlayPause);

// ── NEXT / PREV ──────────────────────────────────────────
function playNext() {
  if (!state.activeQueue.length) return;
  if (state.isRepeat === 'one') { playTrack(state.activeQueue[state.queueIndex]); return; }
  state.queueIndex++;
  if (state.queueIndex >= state.activeQueue.length) {
    if (state.isRepeat === 'all') { state.queueIndex = 0; }
    else { state.queueIndex = state.activeQueue.length - 1; state.isPlaying = false; updatePlayerUI(); return; }
  }
  playTrack(state.activeQueue[state.queueIndex]);
}

nextBtn.addEventListener('click', playNext);

prevBtn.addEventListener('click', () => {
  if (!state.activeQueue.length) return;
  const cur = state.activeQueue[state.queueIndex];
  const isYt = cur && cur.audio_url && cur.audio_url.startsWith('youtube:');
  const elapsed = isYt ? (ytPlayerReady ? ytPlayer.getCurrentTime() : 0) : audioPlayer.currentTime;

  if (elapsed > 3) {
    isYt ? ytPlayer?.seekTo(0, true) : (audioPlayer.currentTime = 0);
    return;
  }
  state.queueIndex = Math.max(0, state.queueIndex - 1);
  if (state.isRepeat === 'all' && state.queueIndex === 0 && elapsed <= 3) {
    state.queueIndex = state.activeQueue.length - 1;
  }
  playTrack(state.activeQueue[state.queueIndex]);
});

// ── SHUFFLE / REPEAT ─────────────────────────────────────
shuffleBtn.addEventListener('click', () => {
  state.isShuffle = !state.isShuffle;
  const cur = state.activeQueue[state.queueIndex];
  if (state.isShuffle) { shuffleQueue(state.originalQueue, cur); showToast('Shuffle on'); }
  else { state.activeQueue = [...state.originalQueue]; state.queueIndex = state.activeQueue.findIndex(t => t.id === cur?.id); showToast('Shuffle off'); }
  updatePlayerUI();
});

function shuffleQueue(queue, active) {
  let s = [...queue];
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  if (active) { s = s.filter(t => t.id !== active.id); s.unshift(active); }
  state.activeQueue = s; state.queueIndex = 0;
}

repeatBtn.addEventListener('click', () => {
  if (!state.isRepeat) { state.isRepeat = 'all'; showToast('Repeat all'); }
  else if (state.isRepeat === 'all') { state.isRepeat = 'one'; showToast('Repeat song'); }
  else { state.isRepeat = false; showToast('Repeat off'); }
  updatePlayerUI();
});

// ── LIKE from player ─────────────────────────────────────
playerLikeBtn.addEventListener('click', () => {
  const cur = state.activeQueue[state.queueIndex];
  if (cur) toggleLikeTrack(cur.id);
});

// ── AUDIO HTML5 EVENTS ───────────────────────────────────
audioPlayer.addEventListener('timeupdate', () => {
  if (!isCurrentTrackYoutube() && audioPlayer.duration) {
    const pct = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressSlider.value = pct;
    currentTimeLabel.textContent = formatTime(audioPlayer.currentTime);
    miniProgressFill.style.width = pct + '%';
  }
});

audioPlayer.addEventListener('durationchange', () => {
  if (!isCurrentTrackYoutube()) totalTimeLabel.textContent = formatTime(audioPlayer.duration);
});

audioPlayer.addEventListener('ended', () => { if (!isCurrentTrackYoutube()) playNext(); });

audioPlayer.addEventListener('play', () => { state.isPlaying = true; updatePlayerUI(); });
audioPlayer.addEventListener('pause', () => { state.isPlaying = false; updatePlayerUI(); });

// ── SEEK ─────────────────────────────────────────────────
progressSlider.addEventListener('input', (e) => {
  const cur = state.activeQueue[state.queueIndex];
  const isYt = cur && cur.audio_url && cur.audio_url.startsWith('youtube:');
  if (isYt && ytPlayer && ytPlayerReady) {
    const dur = ytPlayer.getDuration();
    if (dur) { ytPlayer.seekTo((e.target.value / 100) * dur, true); }
  } else if (audioPlayer.duration) {
    audioPlayer.currentTime = (e.target.value / 100) * audioPlayer.duration;
  }
});

// ── VOLUME ───────────────────────────────────────────────
volumeSlider.addEventListener('input', (e) => {
  const vol = e.target.value / 100;
  state.volume = vol;
  state.isMuted = vol === 0;
  audioPlayer.volume = vol;
  if (ytPlayer && ytPlayerReady) ytPlayer.setVolume(vol * 100);
  localStorage.setItem('volume', vol);
  updateVolumeUI();
});

muteBtn.addEventListener('click', () => {
  state.isMuted = !state.isMuted;
  audioPlayer.muted = state.isMuted;
  if (ytPlayer && ytPlayerReady) {
    state.isMuted ? ytPlayer.mute() : (ytPlayer.unMute(), ytPlayer.setVolume(state.volume * 100));
  }
  updateVolumeUI();
});

function updateVolumeUI() {
  const muteIcon = muteBtn.querySelector('i');
  const vol = state.isMuted ? 0 : state.volume;
  const icon = vol === 0 ? 'volume-x' : vol < 0.4 ? 'volume-1' : 'volume-2';
  if (muteIcon) muteIcon.setAttribute('data-lucide', icon);
  volumeSlider.value = state.isMuted ? 0 : state.volume * 100;
  lucide.createIcons();
}

// ── HERO PLAY ────────────────────────────────────────────
heroPlayBtn.addEventListener('click', () => {
  if (state.tracks.length) playSongDirectly(state.tracks[0].id);
});

// ── GLOBAL SEARCH ACTIONS ────────────────────────────────
async function toggleLikeGlobalSong(index, e) {
  if (e) e.stopPropagation();
  const t = state.globalSearchResults[index];
  if (t) await toggleLikeTrack(t, e);
}

async function addGlobalTrackToPlaylist(e, index, playlistId) {
  if (e) e.preventDefault();
  const t = state.globalSearchResults[index];
  if (!t) return;
  try {
    const r = await apiRequest('/api/tracks/register', 'POST', t);
    await fetchTracks();
    await apiRequest(`/api/playlists/${playlistId}/tracks`, 'POST', { trackId: r.id });
    showToast('Added to playlist!');
    performSearch(searchInputLargeField.value);
  } catch (_) {}
}

// ── AUTH CHECK ON LOAD ───────────────────────────────────
async function checkAuthOnLoad() {
  audioPlayer.volume = state.volume;
  volumeSlider.value = state.volume * 100;
  updateVolumeUI();

  if (state.token && state.user) {
    try {
      await apiRequest('/api/auth/me');
      loginUser(state.token, state.user);
    } catch (_) { logout(); }
  } else {
    logout();
  }
}

checkAuthOnLoad();
