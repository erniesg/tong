(() => {
  if (window.__tongOverlayBooted) return;
  window.__tongOverlayBooted = true;

  const API_BASE = 'http://localhost:8787';

  let video = null;
  let captions = [];
  let activeSegment = null;
  let overlayRoot = null;
  let scriptLine = null;
  let romanizedLine = null;
  let englishLine = null;
  let tokenRow = null;
  let dictionaryPanel = null;

  function getVideoId() {
    return new URL(window.location.href).searchParams.get('v') || 'karina-variety-demo';
  }

  function createOverlayRoot() {
    if (overlayRoot) return;

    const container = document.querySelector('#movie_player') || document.body;
    overlayRoot = document.createElement('div');
    overlayRoot.id = 'tong-overlay-root';

    const card = document.createElement('div');
    card.className = 'tong-overlay-card';

    scriptLine = document.createElement('div');
    scriptLine.className = 'tong-script';

    romanizedLine = document.createElement('div');
    romanizedLine.className = 'tong-romanized';

    englishLine = document.createElement('div');
    englishLine.className = 'tong-english';

    tokenRow = document.createElement('div');
    tokenRow.className = 'tong-token-row';

    dictionaryPanel = document.createElement('div');
    dictionaryPanel.className = 'tong-dictionary tong-overlay-hidden';

    card.appendChild(scriptLine);
    card.appendChild(romanizedLine);
    card.appendChild(englishLine);
    card.appendChild(tokenRow);
    card.appendChild(dictionaryPanel);

    overlayRoot.appendChild(card);
    container.appendChild(overlayRoot);
  }

  function renderSegment(segment) {
    if (!scriptLine || !romanizedLine || !englishLine || !tokenRow) return;

    if (!segment) {
      scriptLine.textContent = '';
      romanizedLine.textContent = '';
      englishLine.textContent = '';
      tokenRow.innerHTML = '';
      return;
    }

    scriptLine.textContent = segment.surface || '';
    romanizedLine.textContent = segment.romanized || '';
    englishLine.textContent = segment.english || '';

    tokenRow.innerHTML = '';
    (segment.tokens || []).forEach((token) => {
      const button = document.createElement('button');
      button.className = 'tong-token';
      button.textContent = token.text;
      button.addEventListener('click', () => {
        void openDictionary(token.lemma || token.text);
      });
      tokenRow.appendChild(button);
    });
  }

  function findSegment(currentMs) {
    return captions.find((segment) => currentMs >= segment.startMs && currentMs <= segment.endMs) || null;
  }

  async function loadCaptions() {
    const videoId = getVideoId();
    try {
      const response = await fetch(
        `${API_BASE}/api/v1/captions/enriched?videoId=${encodeURIComponent(videoId)}&lang=ko`,
      );
      const payload = await response.json();
      captions = payload.segments || [];
      activeSegment = null;
      renderSegment(null);
    } catch (error) {
      console.warn('[Tong Extension] Failed to load captions', error);
    }
  }

  async function openDictionary(term) {
    if (!dictionaryPanel) return;

    dictionaryPanel.classList.remove('tong-overlay-hidden');
    dictionaryPanel.textContent = 'Loading...';

    try {
      const response = await fetch(
        `${API_BASE}/api/v1/dictionary/entry?term=${encodeURIComponent(term)}&lang=ko`,
      );
      const entry = await response.json();

      dictionaryPanel.innerHTML = `
        <strong>${entry.term}</strong>
        <div>${entry.meaning}</div>
        <div>KO: ${entry.readings?.ko || '-'} · ZH: ${entry.readings?.zhPinyin || '-'} · JA: ${entry.readings?.jaRomaji || '-'}</div>
      `;
    } catch (error) {
      dictionaryPanel.textContent = 'Dictionary lookup failed.';
      console.warn('[Tong Extension] Dictionary fetch failed', error);
    }
  }

  function handleTimeUpdate() {
    if (!video || captions.length === 0) return;
    const currentMs = Math.floor(video.currentTime * 1000);
    const next = findSegment(currentMs);

    if (!next || !activeSegment || next.startMs !== activeSegment.startMs) {
      activeSegment = next;
      renderSegment(activeSegment);
    }
  }

  async function boot() {
    createOverlayRoot();

    video = document.querySelector('video');
    if (!video) {
      setTimeout(boot, 700);
      return;
    }

    await loadCaptions();

    video.removeEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('timeupdate', handleTimeUpdate);
    handleTimeUpdate();
  }

  let lastUrl = window.location.href;
  const navObserver = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      if (!window.location.pathname.startsWith('/watch')) return;
      void boot();
    }
  });

  navObserver.observe(document.documentElement, { childList: true, subtree: true });
  void boot();
})();
