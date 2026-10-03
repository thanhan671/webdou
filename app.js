(() => {
  'use strict';

  const STORAGE_KEY = 'webdou.state.v2';

  const DEFAULT_STATE = {
    ratio: 65,
    defaultRatio: 65,
    orientation: 'auto',
    locked: false,
    activePane: 'left',
    mapsKey: '',
    youtubeKey: '',
    autoHide: true,
    focusOnTap: true,
    expandedPane: null,
    panes: {
      left: {
        url: 'webdou://maps', history: [], historyIndex: -1, mode: 'maps',
        mapQuery: '', mapLat: null, mapLng: null, mapView: 'map',
        youtubeQuery: '', youtubeVideoId: '', youtubeResults: []
      },
      right: {
        url: 'webdou://youtube', history: [], historyIndex: -1, mode: 'youtube',
        mapQuery: '', mapLat: null, mapLng: null, mapView: 'map',
        youtubeQuery: '', youtubeVideoId: '', youtubeResults: []
      }
    },
    favorites: [
      { id: 'fav-radio', name: 'Radio Garden', url: 'https://radio.garden/', icon: '📻' },
      { id: 'fav-vtv', name: 'VTV Go', url: 'https://vtvgo.vn/', icon: '📺' }
    ]
  };

  const QUICK_APPS = [
    { id: 'maps', label: 'Google Maps', icon: '🗺️', desc: 'Mở bản đồ ngay, tìm kiếm trong pane', action: 'maps' },
    { id: 'youtube', label: 'YouTube', icon: '▶️', desc: 'Mở trình duyệt YouTube trong pane', action: 'youtube' },
    { id: 'ytmusic', label: 'YouTube Music', icon: '🎵', desc: 'Thử mở YouTube Music Web', url: 'https://music.youtube.com/' },
    { id: 'spotify', label: 'Spotify', icon: '🟢', desc: 'Thử mở Spotify Web Player', url: 'https://open.spotify.com/' },
    { id: 'google', label: 'Google', icon: '🔎', desc: 'Tìm kiếm web', url: 'https://www.google.com/' },
    { id: 'custom', label: 'Website', icon: '🌐', desc: 'Nhập địa chỉ bất kỳ', action: 'custom' },
    { id: 'blank', label: 'Trang nhanh', icon: '⌂', desc: 'Quay lại màn hình lối tắt', action: 'home' },
    { id: 'external', label: 'Mở ngoài', icon: '↗️', desc: 'Mở URL hiện tại ở tab khác', action: 'external' }
  ];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clone = obj => JSON.parse(JSON.stringify(obj));

  let state = loadState();
  let quickPane = 'left';
  let dragState = null;

  const app = $('#app');
  const workspace = $('#workspace');
  const splitter = $('#splitter');
  const quickSheet = $('#quickSheet');
  const settingsModal = $('#settingsModal');
  const favoriteModal = $('#favoriteModal');

  function mergeDeep(base, incoming) {
    if (!incoming || typeof incoming !== 'object') return base;
    for (const [k, v] of Object.entries(incoming)) {
      if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        mergeDeep(base[k], v);
      } else {
        base[k] = v;
      }
    }
    return base;
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return mergeDeep(clone(DEFAULT_STATE), saved || {});
    } catch {
      return clone(DEFAULT_STATE);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function normalizeRatio(value) {
    const n = Number(value);
    return Math.max(20, Math.min(80, Number.isFinite(n) ? n : 50));
  }

  function effectiveOrientation() {
    if (state.orientation !== 'auto') return state.orientation;
    return window.matchMedia('(orientation: portrait)').matches ? 'vertical' : 'horizontal';
  }

  function applyLayout() {
    const orientation = effectiveOrientation();
    app.dataset.orientation = orientation;
    app.dataset.autoOrientation = state.orientation === 'auto' ? 'true' : 'false';
    app.style.setProperty('--split', `${normalizeRatio(state.ratio)}%`);
    splitter.setAttribute('aria-orientation', orientation === 'horizontal' ? 'vertical' : 'horizontal');
    $$('.preset').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.ratio) === Number(state.ratio)));
    $$('.pane').forEach(p => p.classList.toggle('active-pane', p.dataset.pane === state.activePane));
    app.classList.toggle('locked', !!state.locked);
    $('#unlockBtn').classList.toggle('hidden', !state.locked);
    $$('.pane').forEach(p => p.classList.toggle('expanded', state.expandedPane === p.dataset.pane));
    document.body.classList.toggle('pane-expanded', !!state.expandedPane);
  }

  function paneEls(pane) {
    return {
      section: $(`.pane[data-pane="${pane}"]`),
      input: $(`[data-pane-url="${pane}"]`),
      frame: $(`[data-frame="${pane}"]`),
      launcher: $(`[data-launcher="${pane}"]`),
      service: $(`[data-service-shell="${pane}"]`),
      status: $(`[data-frame-status="${pane}"]`)
    };
  }

  function hidePaneSurfaces(pane) {
    const els = paneEls(pane);
    els.launcher.classList.add('hidden');
    els.service.classList.add('hidden');
    els.frame.classList.add('hidden');
    els.status.classList.add('hidden');
  }

  function renderLauncher(pane) {
    const el = paneEls(pane).launcher;
    el.innerHTML = `
      <div class="launcher-wrap">
        <div class="launcher-kicker">WEBDOU · ${pane === 'left' ? 'BÊN TRÁI' : 'BÊN PHẢI'}</div>
        <h1>Chạm là mở ngay</h1>
        <p>Google Maps và YouTube mở thành giao diện riêng ngay trong cửa sổ, không hỏi điểm đến và không yêu cầu dán link.</p>
        <div class="launcher-grid">
          ${QUICK_APPS.slice(0,6).map(item => `
            <button class="launcher-card" data-launcher-action="${item.action || 'url'}" data-launcher-url="${item.url || ''}">
              <span class="quick-icon">${item.icon}</span>
              <strong>${item.label}</strong>
              <small>${item.desc}</small>
            </button>
          `).join('')}
        </div>
        <div class="launcher-note">
          <strong>Web thuần có giới hạn:</strong> website nào cấm iframe sẽ không thể trở thành một tab Chrome đầy đủ trong nửa màn hình. Với Maps/YouTube, WebDou dùng giao diện tích hợp để thao tác trực tiếp trong pane.
        </div>
      </div>`;

    $$('[data-launcher-action]', el).forEach(btn => {
      btn.addEventListener('click', () => {
        selectPane(pane);
        runQuickAction(pane, btn.dataset.launcherAction, btn.dataset.launcherUrl);
      });
    });
  }

  function showLauncher(pane) {
    hidePaneSurfaces(pane);
    const els = paneEls(pane);
    state.panes[pane].mode = 'launcher';
    state.panes[pane].url = '';
    els.launcher.classList.remove('hidden');
    setUrlInput(pane, '');
    saveState();
  }

  function showFrame(pane) {
    hidePaneSurfaces(pane);
    const els = paneEls(pane);
    state.panes[pane].mode = 'frame';
    els.frame.classList.remove('hidden');
  }

  function showServiceShell(pane, mode) {
    hidePaneSurfaces(pane);
    const els = paneEls(pane);
    state.panes[pane].mode = mode;
    els.service.classList.remove('hidden');
  }

  function setUrlInput(pane, value) {
    paneEls(pane).input.value = value || '';
  }

  function isProbablySearch(text) {
    return !/^([a-z]+:\/\/|www\.)/i.test(text) && !/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(text);
  }

  function ensureUrl(text) {
    let value = String(text || '').trim();
    if (!value) return '';
    if (isProbablySearch(value)) return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
    if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
    return value;
  }

  function parseYouTube(raw) {
    try {
      const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      const host = u.hostname.replace(/^www\./, '');
      if (!['youtube.com', 'm.youtube.com', 'youtu.be', 'music.youtube.com'].includes(host)) return null;
      let videoId = '';
      if (host === 'youtu.be') videoId = u.pathname.split('/').filter(Boolean)[0] || '';
      if (u.pathname === '/watch') videoId = u.searchParams.get('v') || '';
      if (u.pathname.startsWith('/shorts/')) videoId = u.pathname.split('/')[2] || '';
      if (u.pathname.startsWith('/embed/')) videoId = u.pathname.split('/')[2] || '';
      const list = u.searchParams.get('list') || '';
      if (videoId) {
        const qs = new URLSearchParams({ autoplay: '1', playsinline: '1', rel: '0' });
        if (list) qs.set('list', list);
        return { type: 'video', videoId, embed: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${qs.toString()}` };
      }
      if (list) return { type: 'playlist', videoId: '', embed: `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(list)}&playsinline=1` };
      return null;
    } catch {
      return null;
    }
  }

  function parseGoogleMaps(raw) {
    try {
      const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      if (!/(^|\.)google\.[^/]+$/.test(u.hostname) && !/(^|\.)maps\.app\.goo\.gl$/.test(u.hostname)) return null;
      if (!u.pathname.includes('/maps') && u.hostname !== 'maps.google.com') return null;
      if (u.searchParams.get('output') === 'embed' || u.pathname.includes('/maps/embed')) return u.toString();
      const q = u.searchParams.get('q');
      if (q) return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
      return null;
    } catch {
      return null;
    }
  }

  function transformForEmbed(raw) {
    const yt = parseYouTube(raw);
    if (yt) return { displayUrl: raw, frameUrl: yt.embed, kind: 'youtube' };
    const gm = parseGoogleMaps(raw);
    if (gm) return { displayUrl: raw, frameUrl: gm, kind: 'maps' };
    const normalized = ensureUrl(raw);
    return { displayUrl: normalized, frameUrl: normalized, kind: 'web' };
  }

  function addHistory(pane, url) {
    const p = state.panes[pane];
    const existingCurrent = p.history[p.historyIndex];
    if (existingCurrent === url) return;
    p.history = p.history.slice(0, p.historyIndex + 1);
    p.history.push(url);
    if (p.history.length > 30) p.history.shift();
    p.historyIndex = p.history.length - 1;
  }

  function navigate(pane, raw, { pushHistory = true } = {}) {
    const value = String(raw || '').trim();
    if (!value) return showLauncher(pane);
    selectPane(pane);

    const yt = parseYouTube(value);
    if (yt) {
      openYouTubeApp(pane, { videoId: yt.videoId || '', embedUrl: yt.embed });
      return;
    }

    if (/google\.[^/]+\/maps|maps\.google|maps\.app\.goo\.gl/i.test(value)) {
      openMapsApp(pane);
      const q = extractMapQuery(value);
      if (q) mapSearch(pane, q);
      return;
    }

    const result = transformForEmbed(value);
    const els = paneEls(pane);
    if (pushHistory) addHistory(pane, result.displayUrl);
    state.panes[pane].url = result.displayUrl;
    setUrlInput(pane, result.displayUrl);
    showFrame(pane);
    els.frame.src = result.frameUrl;
    els.frame.dataset.kind = result.kind;
    saveState();
  }

  function selectPane(pane) {
    state.activePane = pane;
    $$('.pane').forEach(p => p.classList.toggle('active-pane', p.dataset.pane === pane));
    saveState();
  }

  function goBack(pane) {
    const p = state.panes[pane];
    if (p.mode === 'youtube' && p.youtubeVideoId) {
      p.youtubeVideoId = '';
      renderYouTubeApp(pane);
      saveState();
      return;
    }
    if (p.mode === 'maps' || p.mode === 'youtube') return showLauncher(pane);
    if (p.historyIndex <= 0) return showLauncher(pane);
    p.historyIndex -= 1;
    const url = p.history[p.historyIndex];
    p.url = url;
    navigate(pane, url, { pushHistory: false });
  }

  function reloadPane(pane) {
    const p = state.panes[pane];
    if (p.mode === 'maps') return renderMapsApp(pane);
    if (p.mode === 'youtube') return renderYouTubeApp(pane);
    const els = paneEls(pane);
    if (p.mode !== 'frame' || !els.frame.src) return;
    els.frame.src = els.frame.src;
  }

  function externalOpen(pane) {
    const p = state.panes[pane];
    let url = p.url;
    if (p.mode === 'maps') {
      url = p.mapQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.mapQuery)}` : 'https://www.google.com/maps';
    } else if (p.mode === 'youtube') {
      url = p.youtubeVideoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(p.youtubeVideoId)}` : 'https://www.youtube.com/';
    }
    if (!url || url.startsWith('webdou://')) return;
    window.open(ensureUrl(url), '_blank', 'noopener,noreferrer');
  }

  function extractMapQuery(raw) {
    try {
      const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      return u.searchParams.get('q') || u.searchParams.get('query') || '';
    } catch {
      return '';
    }
  }

  function mapEmbedUrl(pane) {
    const p = state.panes[pane];
    if (p.mapLat != null && p.mapLng != null && !p.mapQuery) {
      return `https://www.google.com/maps?q=${encodeURIComponent(`${p.mapLat},${p.mapLng}`)}&z=16&output=embed`;
    }
    const query = p.mapQuery || 'Vietnam';
    if (state.mapsKey) {
      return `https://www.google.com/maps/embed/v1/search?key=${encodeURIComponent(state.mapsKey)}&q=${encodeURIComponent(query)}&zoom=14`;
    }
    return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  }

  function openMapsApp(pane) {
    selectPane(pane);
    const p = state.panes[pane];
    p.mode = 'maps';
    p.url = 'webdou://maps';
    setUrlInput(pane, 'Google Maps');
    showServiceShell(pane, 'maps');
    renderMapsApp(pane);
    saveState();
  }

  function renderMapsApp(pane) {
    const p = state.panes[pane];
    const root = paneEls(pane).service;
    root.innerHTML = `
      <div class="service-browser maps-browser">
        <div class="service-nav">
          <div class="service-brand"><span>🗺️</span><strong>Maps</strong></div>
          <form class="service-search" data-map-search-form="${pane}">
            <input data-map-search-input="${pane}" value="${escapeAttr(p.mapQuery || '')}" placeholder="Tìm địa điểm, địa chỉ, quán ăn…" autocomplete="off" />
            <button type="submit">Tìm</button>
          </form>
          <button class="service-icon-btn" data-map-location="${pane}" title="Vị trí hiện tại">◎</button>
          <button class="service-icon-btn" data-map-external="${pane}" title="Mở Google Maps đầy đủ">↗</button>
        </div>
        <div class="service-body map-body">
          <iframe class="service-map-frame" data-map-frame="${pane}" src="${mapEmbedUrl(pane)}" allow="geolocation" referrerpolicy="no-referrer-when-downgrade" title="Google Maps"></iframe>
          <div class="service-hint">Tìm trực tiếp ở thanh phía trên. Nút ◎ dùng vị trí của thiết bị khi trình duyệt cho phép.</div>
        </div>
      </div>`;

    $(`[data-map-search-form="${pane}"]`, root).addEventListener('submit', e => {
      e.preventDefault();
      const q = $(`[data-map-search-input="${pane}"]`, root).value.trim();
      if (q) mapSearch(pane, q);
    });
    $(`[data-map-location="${pane}"]`, root).addEventListener('click', () => locateMap(pane));
    $(`[data-map-external="${pane}"]`, root).addEventListener('click', () => externalOpen(pane));
  }

  function mapSearch(pane, query) {
    const p = state.panes[pane];
    p.mapQuery = String(query || '').trim();
    p.mapLat = null;
    p.mapLng = null;
    p.url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.mapQuery)}`;
    setUrlInput(pane, p.url);
    const frame = $(`[data-map-frame="${pane}"]`, paneEls(pane).service);
    const input = $(`[data-map-search-input="${pane}"]`, paneEls(pane).service);
    if (input) input.value = p.mapQuery;
    if (frame) frame.src = mapEmbedUrl(pane);
    saveState();
  }

  function locateMap(pane) {
    if (!navigator.geolocation) return showServiceToast(pane, 'Trình duyệt này không hỗ trợ lấy vị trí.');
    showServiceToast(pane, 'Đang lấy vị trí…', 1200);
    navigator.geolocation.getCurrentPosition(pos => {
      const p = state.panes[pane];
      p.mapLat = Number(pos.coords.latitude.toFixed(6));
      p.mapLng = Number(pos.coords.longitude.toFixed(6));
      p.mapQuery = '';
      p.url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.mapLat},${p.mapLng}`)}`;
      setUrlInput(pane, p.url);
      renderMapsApp(pane);
      saveState();
    }, err => {
      showServiceToast(pane, err.code === 1 ? 'Bạn chưa cấp quyền vị trí cho trình duyệt.' : 'Không lấy được vị trí hiện tại.');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 });
  }

  function openYouTubeApp(pane, options = {}) {
    selectPane(pane);
    const p = state.panes[pane];
    p.mode = 'youtube';
    p.url = 'webdou://youtube';
    if (options.videoId) p.youtubeVideoId = options.videoId;
    p.youtubeEmbedUrl = options.embedUrl || '';
    setUrlInput(pane, p.youtubeVideoId ? `https://www.youtube.com/watch?v=${p.youtubeVideoId}` : 'YouTube');
    showServiceShell(pane, 'youtube');
    renderYouTubeApp(pane);
    saveState();
    if (!p.youtubeVideoId && state.youtubeKey && !p.youtubeResults.length) loadPopularYouTube(pane);
  }

  function renderYouTubeApp(pane) {
    const p = state.panes[pane];
    const root = paneEls(pane).service;
    const hasKey = !!state.youtubeKey;

    if (p.youtubeVideoId || p.youtubeEmbedUrl) {
      const embed = p.youtubeEmbedUrl || `https://www.youtube-nocookie.com/embed/${encodeURIComponent(p.youtubeVideoId)}?autoplay=1&playsinline=1&rel=0`;
      root.innerHTML = `
        <div class="service-browser youtube-browser">
          <div class="service-nav">
            <button class="service-icon-btn" data-youtube-back="${pane}" title="Quay lại kết quả">←</button>
            <div class="service-brand youtube"><span>▶</span><strong>YouTube</strong></div>
            <form class="service-search" data-youtube-search-form="${pane}">
              <input data-youtube-search-input="${pane}" value="${escapeAttr(p.youtubeQuery || '')}" placeholder="Tìm video, phim, hoạt hình…" autocomplete="off" />
              <button type="submit">Tìm</button>
            </form>
            <button class="service-icon-btn" data-youtube-external="${pane}" title="Mở trên YouTube">↗</button>
          </div>
          <div class="youtube-player-wrap">
            <iframe class="youtube-player" src="${embed}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="YouTube player"></iframe>
          </div>
        </div>`;
      bindYouTubeNav(pane, root);
      return;
    }

    root.innerHTML = `
      <div class="service-browser youtube-browser">
        <div class="service-nav">
          <div class="service-brand youtube"><span>▶</span><strong>YouTube</strong></div>
          <form class="service-search" data-youtube-search-form="${pane}">
            <input data-youtube-search-input="${pane}" value="${escapeAttr(p.youtubeQuery || '')}" placeholder="Tìm video, phim, hoạt hình…" autocomplete="off" />
            <button type="submit">Tìm</button>
          </form>
          <button class="service-icon-btn" data-youtube-popular="${pane}" title="Video phổ biến">★</button>
          <button class="service-icon-btn" data-youtube-external="${pane}" title="Mở YouTube đầy đủ">↗</button>
        </div>
        <div class="youtube-results" data-youtube-results="${pane}">
          ${hasKey ? renderYouTubeResults(p.youtubeResults) : renderYouTubeKeyNotice()}
        </div>
      </div>`;

    bindYouTubeNav(pane, root);
    $$('[data-video-id]', root).forEach(card => card.addEventListener('click', () => playYouTubeVideo(pane, card.dataset.videoId)));
    const settingsBtn = $('[data-open-youtube-settings]', root);
    if (settingsBtn) settingsBtn.addEventListener('click', () => { loadSettingsForm(); openModal('settingsModal'); });
  }

  function bindYouTubeNav(pane, root) {
    const form = $(`[data-youtube-search-form="${pane}"]`, root);
    if (form) form.addEventListener('submit', e => {
      e.preventDefault();
      const value = $(`[data-youtube-search-input="${pane}"]`, root).value.trim();
      if (!value) return;
      const parsed = parseYouTube(value);
      if (parsed) {
        const p = state.panes[pane];
        p.youtubeVideoId = parsed.videoId || '';
        p.youtubeEmbedUrl = parsed.embed;
        renderYouTubeApp(pane);
        saveState();
        return;
      }
      searchYouTube(pane, value);
    });
    const back = $(`[data-youtube-back="${pane}"]`, root);
    if (back) back.addEventListener('click', () => {
      const p = state.panes[pane];
      p.youtubeVideoId = '';
      p.youtubeEmbedUrl = '';
      renderYouTubeApp(pane);
      saveState();
    });
    const popular = $(`[data-youtube-popular="${pane}"]`, root);
    if (popular) popular.addEventListener('click', () => loadPopularYouTube(pane));
    const ext = $(`[data-youtube-external="${pane}"]`, root);
    if (ext) ext.addEventListener('click', () => externalOpen(pane));
  }

  function renderYouTubeKeyNotice() {
    return `
      <div class="youtube-empty">
        <div class="youtube-empty-icon">▶</div>
        <h3>YouTube đã mở</h3>
        <p>Để tìm và duyệt video ngay trong nửa màn hình, nhập <strong>YouTube Data API key</strong> một lần trong Cài đặt. Sau đó bạn chỉ việc gõ từ khóa như trên ứng dụng YouTube, không cần dán link.</p>
        <button class="primary-btn" data-open-youtube-settings>Cài API key</button>
        <small>Link video/playlist vẫn có thể dán trực tiếp vào ô tìm kiếm phía trên và phát ngay mà không cần API key.</small>
      </div>`;
  }

  function renderYouTubeResults(results) {
    if (!results || !results.length) {
      return `<div class="youtube-empty compact"><div class="youtube-empty-icon">▶</div><h3>Tìm video ngay tại đây</h3><p>Nhập tên phim, bài hát hoặc hoạt hình ở thanh tìm kiếm phía trên.</p></div>`;
    }
    return `<div class="video-grid">${results.map(item => `
      <button class="video-card" data-video-id="${escapeAttr(item.videoId)}">
        <span class="video-thumb-wrap"><img src="${escapeAttr(item.thumbnail)}" alt="" loading="lazy" /><span class="video-play">▶</span></span>
        <span class="video-title">${escapeHtml(item.title)}</span>
        <span class="video-channel">${escapeHtml(item.channelTitle || '')}</span>
      </button>`).join('')}</div>`;
  }

  async function searchYouTube(pane, query) {
    const p = state.panes[pane];
    p.youtubeQuery = query;
    p.youtubeVideoId = '';
    p.youtubeEmbedUrl = '';
    if (!state.youtubeKey) {
      renderYouTubeApp(pane);
      return;
    }
    setYouTubeLoading(pane, `Đang tìm “${query}”…`);
    try {
      const params = new URLSearchParams({
        part: 'snippet', type: 'video', maxResults: '18', q: query,
        key: state.youtubeKey, safeSearch: 'moderate', relevanceLanguage: getLanguageCode()
      });
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'YouTube API error');
      p.youtubeResults = (data.items || []).map(x => ({
        videoId: x.id?.videoId || '',
        title: x.snippet?.title || 'Video',
        channelTitle: x.snippet?.channelTitle || '',
        thumbnail: x.snippet?.thumbnails?.medium?.url || x.snippet?.thumbnails?.default?.url || ''
      })).filter(x => x.videoId);
      saveState();
      renderYouTubeApp(pane);
    } catch (err) {
      setYouTubeError(pane, err.message || 'Không tải được kết quả YouTube.');
    }
  }

  async function loadPopularYouTube(pane) {
    const p = state.panes[pane];
    if (!state.youtubeKey) return renderYouTubeApp(pane);
    p.youtubeQuery = '';
    p.youtubeVideoId = '';
    p.youtubeEmbedUrl = '';
    setYouTubeLoading(pane, 'Đang tải video phổ biến…');
    try {
      const params = new URLSearchParams({
        part: 'snippet', chart: 'mostPopular', maxResults: '18',
        regionCode: getRegionCode(), key: state.youtubeKey
      });
      const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'YouTube API error');
      p.youtubeResults = (data.items || []).map(x => ({
        videoId: x.id || '',
        title: x.snippet?.title || 'Video',
        channelTitle: x.snippet?.channelTitle || '',
        thumbnail: x.snippet?.thumbnails?.medium?.url || x.snippet?.thumbnails?.default?.url || ''
      })).filter(x => x.videoId);
      saveState();
      renderYouTubeApp(pane);
    } catch (err) {
      setYouTubeError(pane, err.message || 'Không tải được video phổ biến.');
    }
  }

  function setYouTubeLoading(pane, text) {
    const root = paneEls(pane).service;
    const results = $(`[data-youtube-results="${pane}"]`, root);
    if (results) results.innerHTML = `<div class="youtube-empty compact"><div class="loading-ring"></div><p>${escapeHtml(text)}</p></div>`;
  }

  function setYouTubeError(pane, message) {
    const root = paneEls(pane).service;
    const results = $(`[data-youtube-results="${pane}"]`, root);
    if (results) results.innerHTML = `<div class="youtube-empty compact"><div class="youtube-empty-icon">!</div><h3>Không tải được YouTube</h3><p>${escapeHtml(message)}</p><button class="primary-btn" data-open-youtube-settings>Cài đặt API key</button></div>`;
    const settingsBtn = $('[data-open-youtube-settings]', root);
    if (settingsBtn) settingsBtn.addEventListener('click', () => { loadSettingsForm(); openModal('settingsModal'); });
  }

  function playYouTubeVideo(pane, videoId) {
    const p = state.panes[pane];
    p.youtubeVideoId = videoId;
    p.youtubeEmbedUrl = '';
    p.url = `https://www.youtube.com/watch?v=${videoId}`;
    setUrlInput(pane, p.url);
    renderYouTubeApp(pane);
    saveState();
  }

  function getLanguageCode() {
    const lang = String(navigator.language || 'vi').split('-')[0].toLowerCase();
    return /^[a-z]{2}$/.test(lang) ? lang : 'vi';
  }

  function getRegionCode() {
    const parts = String(navigator.language || 'vi-VN').split('-');
    const region = parts.find(x => /^[A-Z]{2}$/.test(x));
    return region || 'VN';
  }

  function showServiceToast(pane, message, duration = 2600) {
    const root = paneEls(pane).service;
    const old = $('.service-toast', root);
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.className = 'service-toast';
    toast.textContent = message;
    root.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  }

  function runQuickAction(pane, action, url = '') {
    closeModal('quickSheet');
    switch (action) {
      case 'maps': return openMapsApp(pane);
      case 'youtube': return openYouTubeApp(pane);
      case 'custom': paneEls(pane).input.focus(); return;
      case 'home': return showLauncher(pane);
      case 'external': return externalOpen(pane);
      case 'url': return navigate(pane, url);
      default: if (url) navigate(pane, url);
    }
  }

  function renderQuickSheet() {
    $('#quickTitle').textContent = quickPane === 'left' ? 'Mở ở bên trái' : 'Mở ở bên phải';
    const grid = $('#quickGrid');
    grid.innerHTML = QUICK_APPS.map(item => `
      <button class="quick-tile" data-quick-action="${item.action || 'url'}" data-quick-url="${item.url || ''}">
        <span class="quick-icon">${item.icon}</span>
        <span class="quick-label">${item.label}</span>
        <span class="quick-desc">${item.desc}</span>
      </button>`).join('');
    $$('[data-quick-action]', grid).forEach(btn => btn.addEventListener('click', () => runQuickAction(quickPane, btn.dataset.quickAction, btn.dataset.quickUrl)));
    renderFavorites();
  }

  function renderFavorites() {
    const root = $('#favoriteGrid');
    if (!state.favorites.length) {
      root.innerHTML = '<div class="launcher-note" style="grid-column:1/-1">Chưa có lối tắt yêu thích.</div>';
      return;
    }
    root.innerHTML = state.favorites.map(f => `
      <div class="favorite-wrap">
        <button class="favorite-tile" data-favorite-open="${f.id}">
          <span class="quick-icon">${escapeHtml(f.icon || '★')}</span>
          <span class="quick-label">${escapeHtml(f.name)}</span>
          <span class="quick-desc">${escapeHtml(f.url)}</span>
        </button>
        <button class="favorite-delete" data-favorite-delete="${f.id}" title="Xóa">×</button>
      </div>`).join('');
    $$('[data-favorite-open]', root).forEach(btn => btn.addEventListener('click', () => {
      const fav = state.favorites.find(f => f.id === btn.dataset.favoriteOpen);
      if (fav) navigate(quickPane, fav.url);
      closeModal('quickSheet');
    }));
    $$('[data-favorite-delete]', root).forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      state.favorites = state.favorites.filter(f => f.id !== btn.dataset.favoriteDelete);
      saveState();
      renderFavorites();
    }));
  }

  function escapeHtml(v) {
    return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function escapeAttr(v) {
    return escapeHtml(v).replace(/`/g, '&#96;');
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }

  function setRatio(n) {
    state.ratio = normalizeRatio(n);
    applyLayout();
    saveState();
  }

  function swapPanes() {
    const tmp = state.panes.left;
    state.panes.left = state.panes.right;
    state.panes.right = tmp;
    restorePane('left');
    restorePane('right');
    saveState();
  }

  function focusActive() {
    const target = state.activePane === 'left' ? 70 : 30;
    setRatio(target);
  }

  function toggleOrientation() {
    const current = effectiveOrientation();
    state.orientation = current === 'horizontal' ? 'vertical' : 'horizontal';
    applyLayout();
    saveState();
  }

  function toggleLock(force) {
    state.locked = typeof force === 'boolean' ? force : !state.locked;
    if (state.locked && state.expandedPane) state.expandedPane = null;
    applyLayout();
    saveState();
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      // Một số browser trong màn hình xe không hỗ trợ Fullscreen API.
    }
  }

  function togglePaneExpand(pane) {
    state.expandedPane = state.expandedPane === pane ? null : pane;
    applyLayout();
    saveState();
  }

  function loadSettingsForm() {
    $('#defaultRatioSelect').value = String(state.defaultRatio || 50);
    $('#defaultOrientationSelect').value = state.orientation || 'auto';
    $('#mapsKeyInput').value = state.mapsKey || '';
    $('#youtubeKeyInput').value = state.youtubeKey || '';
    $('#autoHideToggle').checked = state.autoHide !== false;
    $('#focusOnTapToggle').checked = state.focusOnTap !== false;
  }

  function saveSettingsForm() {
    state.defaultRatio = Number($('#defaultRatioSelect').value);
    state.orientation = $('#defaultOrientationSelect').value;
    state.mapsKey = $('#mapsKeyInput').value.trim();
    state.youtubeKey = $('#youtubeKeyInput').value.trim();
    state.autoHide = $('#autoHideToggle').checked;
    state.focusOnTap = $('#focusOnTapToggle').checked;
    state.ratio = state.defaultRatio;
    saveState();
    applyLayout();
    closeModal('settingsModal');
    if (state.panes.left.mode === 'youtube') openYouTubeApp('left');
    if (state.panes.right.mode === 'youtube') openYouTubeApp('right');
    if (state.panes.left.mode === 'maps') openMapsApp('left');
    if (state.panes.right.mode === 'maps') openMapsApp('right');
  }

  function resetState() {
    if (!confirm('Khôi phục toàn bộ cài đặt và yêu thích về mặc định?')) return;
    state = clone(DEFAULT_STATE);
    saveState();
    restoreAll();
    closeModal('settingsModal');
  }

  function restorePane(pane) {
    const p = state.panes[pane];
    if (p.mode === 'maps') return openMapsApp(pane);
    if (p.mode === 'youtube') return openYouTubeApp(pane, { videoId: p.youtubeVideoId || '', embedUrl: p.youtubeEmbedUrl || '' });
    setUrlInput(pane, p.url || '');
    if (p.mode === 'frame' && p.url) navigate(pane, p.url, { pushHistory: false });
    else showLauncher(pane);
  }

  function restoreAll() {
    renderLauncher('left');
    renderLauncher('right');
    restorePane('left');
    restorePane('right');
    selectPane(state.activePane || 'left');
    applyLayout();
  }

  function attachEvents() {
    $$('.pane').forEach(p => p.addEventListener('pointerdown', () => selectPane(p.dataset.pane), { passive: true }));

    $$('[data-pane-form]').forEach(form => form.addEventListener('submit', e => {
      e.preventDefault();
      const pane = form.dataset.paneForm;
      navigate(pane, paneEls(pane).input.value);
    }));

    $$('[data-pane-action]').forEach(btn => btn.addEventListener('click', () => {
      const pane = btn.closest('.pane')?.dataset.pane || state.activePane;
      selectPane(pane);
      switch (btn.dataset.paneAction) {
        case 'quick': quickPane = pane; renderQuickSheet(); openModal('quickSheet'); break;
        case 'back': goBack(pane); break;
        case 'reload': reloadPane(pane); break;
        case 'home': showLauncher(pane); break;
        case 'expand': togglePaneExpand(pane); break;
        case 'external': externalOpen(pane); break;
      }
    }));

    $$('.preset').forEach(btn => btn.addEventListener('click', () => setRatio(btn.dataset.ratio)));
    $('#orientationBtn').addEventListener('click', toggleOrientation);
    $('#swapBtn').addEventListener('click', swapPanes);
    $('#focusBtn').addEventListener('click', focusActive);
    $('#lockBtn').addEventListener('click', () => toggleLock());
    $('#unlockBtn').addEventListener('click', () => toggleLock(false));
    $('#fullscreenBtn').addEventListener('click', toggleFullscreen);
    $('#settingsBtn').addEventListener('click', () => { loadSettingsForm(); openModal('settingsModal'); });
    $('#saveSettingsBtn').addEventListener('click', saveSettingsForm);
    $('#resetBtn').addEventListener('click', resetState);

    $$('[data-close-modal]').forEach(btn => btn.addEventListener('click', () => closeModal(btn.dataset.closeModal)));
    $$('.modal-backdrop').forEach(modal => modal.addEventListener('pointerdown', e => { if (e.target === modal) closeModal(modal.id); }));

    $('#addFavoriteBtn').addEventListener('click', () => {
      $('#favoriteName').value = '';
      $('#favoriteUrl').value = '';
      $('#favoriteIcon').value = '★';
      openModal('favoriteModal');
    });

    $('#favoriteForm').addEventListener('submit', e => {
      e.preventDefault();
      const name = $('#favoriteName').value.trim();
      const url = ensureUrl($('#favoriteUrl').value.trim());
      const icon = $('#favoriteIcon').value.trim() || '★';
      if (!name || !url) return;
      state.favorites.push({ id: `fav-${Date.now()}`, name, url, icon });
      saveState();
      closeModal('favoriteModal');
      renderFavorites();
    });

    splitter.addEventListener('pointerdown', e => {
      splitter.setPointerCapture(e.pointerId);
      dragState = { pointerId: e.pointerId };
      splitter.classList.add('dragging');
      e.preventDefault();
    });
    splitter.addEventListener('pointermove', e => {
      if (!dragState || dragState.pointerId !== e.pointerId) return;
      const rect = workspace.getBoundingClientRect();
      const horizontal = effectiveOrientation() === 'horizontal';
      const position = horizontal ? e.clientX - rect.left : e.clientY - rect.top;
      const total = horizontal ? rect.width : rect.height;
      setRatio((position / total) * 100);
    });
    const stopDrag = e => {
      if (!dragState || (e.pointerId != null && e.pointerId !== dragState.pointerId)) return;
      dragState = null;
      splitter.classList.remove('dragging');
    };
    splitter.addEventListener('pointerup', stopDrag);
    splitter.addEventListener('pointercancel', stopDrag);

    splitter.addEventListener('keydown', e => {
      const delta = e.shiftKey ? 10 : 2;
      if (['ArrowLeft','ArrowUp'].includes(e.key)) { e.preventDefault(); setRatio(state.ratio - delta); }
      if (['ArrowRight','ArrowDown'].includes(e.key)) { e.preventDefault(); setRatio(state.ratio + delta); }
    });

    window.addEventListener('orientationchange', () => { if (state.orientation === 'auto') setTimeout(applyLayout, 100); });
    window.addEventListener('resize', () => { if (state.orientation === 'auto') applyLayout(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (state.expandedPane) { state.expandedPane = null; applyLayout(); saveState(); return; }
        $$('.modal-backdrop:not(.hidden)').forEach(m => closeModal(m.id));
      }
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
    }
  }

  attachEvents();
  restoreAll();
  registerServiceWorker();
})();
