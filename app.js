(() => {
  'use strict';

  const STORAGE_KEY = 'webdou.state.v1';
  const DEFAULT_STATE = {
    ratio: 50,
    defaultRatio: 50,
    orientation: 'auto',
    locked: false,
    activePane: 'left',
    mapsKey: '',
    youtubeKey: '',
    autoHide: true,
    focusOnTap: true,
    expandedPane: null,
    panes: {
      left: { url: '', history: [], historyIndex: -1, mode: 'launcher' },
      right: { url: '', history: [], historyIndex: -1, mode: 'launcher' }
    },
    favorites: [
      { id: 'fav-radio', name: 'Radio Garden', url: 'https://radio.garden/', icon: '📻' },
      { id: 'fav-vtv', name: 'VTV Go', url: 'https://vtvgo.vn/', icon: '📺' }
    ]
  };

  const QUICK_APPS = [
    { id: 'maps', label: 'Google Maps', icon: '🗺️', desc: 'Bản đồ / tìm địa điểm', action: 'maps' },
    { id: 'youtube', label: 'YouTube', icon: '▶️', desc: 'Video, phim, hoạt hình', action: 'youtube' },
    { id: 'ytmusic', label: 'YouTube Music', icon: '🎵', desc: 'Mở nhanh dịch vụ nhạc', url: 'https://music.youtube.com/' },
    { id: 'spotify', label: 'Spotify', icon: '🟢', desc: 'Spotify Web Player', url: 'https://open.spotify.com/' },
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
      status: $(`[data-frame-status="${pane}"]`)
    };
  }

  function renderLauncher(pane) {
    const el = paneEls(pane).launcher;
    el.innerHTML = `
      <div class="launcher-wrap">
        <div class="launcher-kicker">WEBDOU · ${pane === 'left' ? 'BÊN TRÁI' : 'BÊN PHẢI'}</div>
        <h1>Chọn nội dung để mở</h1>
        <p>Chạm vào lối tắt. Mỗi bên hoạt động độc lập và ghi nhớ trạng thái riêng.</p>
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
          <strong>Lưu ý:</strong> một số website chặn việc hiển thị trong iframe. Với các trang đó, dùng nút ↗ để mở trực tiếp trong trình duyệt. YouTube video/playlist và Google Maps được WebDou xử lý theo dạng nhúng riêng khi có thể.
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
    const els = paneEls(pane);
    state.panes[pane].mode = 'launcher';
    els.launcher.classList.remove('hidden');
    els.frame.classList.add('hidden');
    els.status.classList.add('hidden');
    saveState();
  }

  function showFrame(pane) {
    const els = paneEls(pane);
    state.panes[pane].mode = 'frame';
    els.launcher.classList.add('hidden');
    els.frame.classList.remove('hidden');
    els.status.classList.add('hidden');
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
        return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${qs.toString()}`;
      }
      if (list) return `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(list)}&playsinline=1`;
      return null;
    } catch {
      return null;
    }
  }

  function parseGoogleMaps(raw) {
    try {
      const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      if (!/(^|\.)google\.[^/]+$/.test(u.hostname) && !/(^|\.)google\.com$/.test(u.hostname) && !/(^|\.)maps\.app\.goo\.gl$/.test(u.hostname)) return null;
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
    if (yt) return { displayUrl: raw, frameUrl: yt, kind: 'youtube' };
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
    if (p.historyIndex <= 0) return showLauncher(pane);
    p.historyIndex -= 1;
    const url = p.history[p.historyIndex];
    p.url = url;
    navigate(pane, url, { pushHistory: false });
  }

  function reloadPane(pane) {
    const els = paneEls(pane);
    if (state.panes[pane].mode !== 'frame' || !els.frame.src) return;
    els.frame.src = els.frame.src;
  }

  function externalOpen(pane) {
    const url = state.panes[pane].url;
    if (!url) return;
    window.open(ensureUrl(url), '_blank', 'noopener,noreferrer');
  }

  function promptMaps(pane) {
    const q = window.prompt('Nhập địa điểm cần mở trên Google Maps:');
    if (!q) return;
    const embed = state.mapsKey
      ? `https://www.google.com/maps/embed/v1/search?key=${encodeURIComponent(state.mapsKey)}&q=${encodeURIComponent(q)}`
      : `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
    const els = paneEls(pane);
    const display = `https://www.google.com/maps/search/${encodeURIComponent(q)}`;
    addHistory(pane, display);
    state.panes[pane].url = display;
    setUrlInput(pane, display);
    showFrame(pane);
    els.frame.src = embed;
    els.frame.dataset.kind = 'maps';
    saveState();
  }

  function promptYouTube(pane) {
    const input = window.prompt('Dán link video/playlist YouTube. Nếu nhập từ khóa, WebDou sẽ mở trang tìm kiếm YouTube ở tab riêng vì trang tìm kiếm YouTube không cho nhúng trực tiếp:');
    if (!input) return;
    const yt = parseYouTube(input);
    if (yt) return navigate(pane, input);
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(input)}`;
    state.panes[pane].url = searchUrl;
    setUrlInput(pane, searchUrl);
    saveState();
    window.open(searchUrl, '_blank', 'noopener,noreferrer');
  }

  function runQuickAction(pane, action, url = '') {
    closeModal('quickSheet');
    switch (action) {
      case 'maps': return promptMaps(pane);
      case 'youtube': return promptYouTube(pane);
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
      // Some embedded browsers do not expose the Fullscreen API.
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
    setUrlInput(pane, p.url || '');
    if (p.mode === 'frame' && p.url) navigate(pane, p.url, { pushHistory: false });
    else showLauncher(pane);
  }

  function restoreAll() {
    renderLauncher('left');
    renderLauncher('right');
    restorePane('left');
    restorePane('right');
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
