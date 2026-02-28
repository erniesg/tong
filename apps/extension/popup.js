(() => {
  const API_BASE_KEY = 'tongApiBase';
  const DEFAULT_API_BASE = 'http://localhost:8787';
  const LOG_PREFIX = '[TongExt][Popup]';

  function log(...args) {
    console.log(LOG_PREFIX, ...args);
  }

  function warn(...args) {
    console.warn(LOG_PREFIX, ...args);
  }

  const apiBaseInput = document.getElementById('apiBase');
  const statusText = document.getElementById('statusText');
  const saveButton = document.getElementById('saveApiBase');
  const testButton = document.getElementById('testConnection');
  const openYouTube = document.getElementById('openYouTube');
  const toggleOverlay = document.getElementById('toggleOverlay');
  const overlayState = document.getElementById('overlayState');

  function normalizeApiBase(value) {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/\/$/, '');
  }

  function setStatus(text, tone) {
    statusText.textContent = text;
    statusText.className = tone ? `status ${tone}` : 'status';
    log('Status:', text);
  }

  function readStoredApiBase() {
    return new Promise((resolve) => {
      chrome.storage.sync.get([API_BASE_KEY], (result) => {
        const stored = normalizeApiBase(result[API_BASE_KEY]);
        resolve(stored || DEFAULT_API_BASE);
      });
    });
  }

  function saveStoredApiBase(value) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [API_BASE_KEY]: value }, resolve);
    });
  }

  async function checkHealth(apiBase) {
    const response = await fetch(`${apiBase}/health`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`health_${response.status}`);
    }
    const payload = await response.json();
    if (!payload || payload.ok !== true) {
      throw new Error('health_payload_invalid');
    }
    return payload;
  }

  async function getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs && tabs.length > 0 ? tabs[0] : null;
  }

  function setOverlayStateText(text, tone) {
    if (!overlayState) return;
    overlayState.textContent = text;
    overlayState.className = tone ? `status ${tone}` : 'status';
  }

  async function refreshOverlayState() {
    const tab = await getActiveTab();
    if (!tab || !tab.id || !tab.url || !tab.url.includes('youtube.com')) {
      setOverlayStateText('Open an active YouTube tab to inspect overlay state.', 'warn');
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_TONG_OVERLAY_STATE' });
      if (!response || !response.ok) {
        setOverlayStateText('Overlay state unavailable. Refresh the YouTube tab.', 'warn');
        return;
      }

      const stateText = response.enabled ? 'ON' : 'OFF';
      const sourceText = response.source || 'none';
      const captionCount = Number(response.captionCount || 0);
      setOverlayStateText(`Overlay ${stateText} · source: ${sourceText} · cues: ${captionCount}`, 'ok');
      toggleOverlay.textContent = response.enabled
        ? 'Turn Overlay Off (Active Tab)'
        : 'Turn Overlay On (Active Tab)';
    } catch (err) {
      warn('Could not fetch overlay state:', err);
      setOverlayStateText('Cannot reach content script. Refresh YouTube tab once.', 'warn');
    }
  }

  async function init() {
    log('Popup initialized');
    const initialBase = await readStoredApiBase();
    apiBaseInput.value = initialBase;
    log('Loaded API base:', initialBase);

    try {
      await checkHealth(initialBase);
      setStatus(`Connected to ${initialBase}`, 'ok');
    } catch {
      warn('Health check failed for', initialBase);
      setStatus(`Cannot reach ${initialBase}. Start server with npm run dev:server.`, 'warn');
    }

    await refreshOverlayState();
  }

  saveButton.addEventListener('click', async () => {
    const nextBase = normalizeApiBase(apiBaseInput.value) || DEFAULT_API_BASE;
    apiBaseInput.value = nextBase;
    log('Saving API base:', nextBase);

    await saveStoredApiBase(nextBase);
    setStatus(`Saved API endpoint: ${nextBase}`, 'ok');
  });

  testButton.addEventListener('click', async () => {
    const base = normalizeApiBase(apiBaseInput.value) || DEFAULT_API_BASE;
    log('Testing API base:', base);
    setStatus('Checking API health...', 'pending');

    try {
      await checkHealth(base);
      setStatus(`Connected to ${base}`, 'ok');
    } catch {
      warn('API health check failed for', base);
      setStatus(`Failed to reach ${base}`, 'warn');
    }
  });

  openYouTube.addEventListener('click', async () => {
    log('Opening YouTube test video');
    await chrome.tabs.create({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    window.close();
  });

  toggleOverlay.addEventListener('click', async () => {
    const tab = await getActiveTab();
    if (!tab || !tab.id || !tab.url || !tab.url.includes('youtube.com')) {
      setStatus('Open an active YouTube watch tab first.', 'warn');
      return;
    }

    try {
      log('Sending TOGGLE_TONG_OVERLAY to tab', tab.id);
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_TONG_OVERLAY' });
      if (response && response.ok) {
        setStatus(`Overlay ${response.enabled ? 'enabled' : 'disabled'} in active tab.`, 'ok');
        setOverlayStateText(
          `Overlay ${response.enabled ? 'ON' : 'OFF'} · source: active-tab`,
          response.enabled ? 'ok' : 'warn',
        );
        toggleOverlay.textContent = response.enabled
          ? 'Turn Overlay Off (Active Tab)'
          : 'Turn Overlay On (Active Tab)';
      } else {
        setStatus('Toggle request did not return overlay state.', 'warn');
      }
    } catch (err) {
      warn('Failed to toggle overlay in active tab:', err);
      setStatus('Could not reach content script. Refresh the YouTube tab once.', 'warn');
    }
  });

  void init();
})();
