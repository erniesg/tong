(() => {
  const API_BASE_KEY = 'tongApiBase';
  const DEFAULT_API_BASE = 'http://localhost:8787';

  const apiBaseInput = document.getElementById('apiBase');
  const statusText = document.getElementById('statusText');
  const saveButton = document.getElementById('saveApiBase');
  const testButton = document.getElementById('testConnection');
  const openYouTube = document.getElementById('openYouTube');

  function normalizeApiBase(value) {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/\/$/, '');
  }

  function setStatus(text, tone) {
    statusText.textContent = text;
    statusText.className = tone ? `status ${tone}` : 'status';
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

  async function init() {
    const initialBase = await readStoredApiBase();
    apiBaseInput.value = initialBase;

    try {
      await checkHealth(initialBase);
      setStatus(`Connected to ${initialBase}`, 'ok');
    } catch {
      setStatus(`Cannot reach ${initialBase}. Start server with npm run dev:server.`, 'warn');
    }
  }

  saveButton.addEventListener('click', async () => {
    const nextBase = normalizeApiBase(apiBaseInput.value) || DEFAULT_API_BASE;
    apiBaseInput.value = nextBase;

    await saveStoredApiBase(nextBase);
    setStatus(`Saved API endpoint: ${nextBase}`, 'ok');
  });

  testButton.addEventListener('click', async () => {
    const base = normalizeApiBase(apiBaseInput.value) || DEFAULT_API_BASE;
    setStatus('Checking API health...', 'pending');

    try {
      await checkHealth(base);
      setStatus(`Connected to ${base}`, 'ok');
    } catch {
      setStatus(`Failed to reach ${base}`, 'warn');
    }
  });

  openYouTube.addEventListener('click', async () => {
    await chrome.tabs.create({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    window.close();
  });

  void init();
})();
