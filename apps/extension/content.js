(() => {
  if (window.__tongOverlayBooted) return;
  window.__tongOverlayBooted = true;

  const DEFAULT_API_BASE = 'http://localhost:8787';
  const API_BASE_KEY = 'tongApiBase';
  const LANG = 'ko';
  const FIXTURE_CYCLE_PADDING_MS = 2000;
  const LOG_PREFIX = '[TongExt]';

  function log(...args) {
    console.log(LOG_PREFIX, ...args);
  }

  function warn(...args) {
    console.warn(LOG_PREFIX, ...args);
  }

  function errorLog(...args) {
    console.error(LOG_PREFIX, ...args);
  }

  class TongYouTubeOverlay {
    constructor() {
      this.apiBase = DEFAULT_API_BASE;
      this.video = null;
      this.videoId = null;
      this.captions = [];
      this.activeSegment = null;
      this.activeSegmentIndex = -1;
      this.overlayEnabled = true;
      this.hasShownLoopModeStatus = false;
      this.dictionaryCache = new Map();

      this.overlayRoot = null;
      this.toolbar = null;
      this.toggleButton = null;
      this.scriptLine = null;
      this.romanizedLine = null;
      this.englishLine = null;
      this.tokenRow = null;
      this.dictionaryPanel = null;
      this.statusLine = null;

      this.lastUrl = window.location.href;
      this.navigationPollTimer = null;
      this.syncInFlight = false;
      this.needsResync = false;
      this.captionsAbortController = null;

      this.onTimeUpdate = this.onTimeUpdate.bind(this);
      this.handleNavigationSignal = this.handleNavigationSignal.bind(this);
      this.handleStorageChange = this.handleStorageChange.bind(this);
      this.handleKeydown = this.handleKeydown.bind(this);
      this.handleRuntimeMessage = this.handleRuntimeMessage.bind(this);

      log('Content script booted on', window.location.href);
    }

    async init() {
      log('Initializing overlay runtime...');
      this.apiBase = await this.readApiBase();
      log('API base:', this.apiBase);
      this.installNavigationHooks();
      this.installStorageHooks();
      this.installControlHooks();
      await this.syncWithPageState();
      log('Initialization complete');
    }

    installNavigationHooks() {
      log('Installing YouTube navigation hooks');
      document.addEventListener('yt-navigate-finish', this.handleNavigationSignal);
      window.addEventListener('popstate', this.handleNavigationSignal);

      // YouTube is an SPA. Poll URL as a fallback for edge navigation paths.
      this.navigationPollTimer = window.setInterval(() => {
        this.handleNavigationSignal();
      }, 700);
    }

    installStorageHooks() {
      if (!chrome || !chrome.storage || !chrome.storage.onChanged) {
        warn('chrome.storage.onChanged unavailable');
        return;
      }
      chrome.storage.onChanged.addListener(this.handleStorageChange);
      log('Storage hook installed');
    }

    installControlHooks() {
      window.addEventListener('keydown', this.handleKeydown);
      log('Keyboard shortcut installed (Alt+T)');

      if (chrome && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener(this.handleRuntimeMessage);
        log('Runtime message hook installed');
      }
    }

    handleKeydown(event) {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      if (String(event.key || '').toLowerCase() !== 't') {
        return;
      }

      event.preventDefault();
      this.toggleOverlayEnabled('keyboard');
    }

    handleRuntimeMessage(message, _sender, sendResponse) {
      if (!message || typeof message !== 'object') {
        return false;
      }

      if (message.type === 'TOGGLE_TONG_OVERLAY') {
        const enabled = this.toggleOverlayEnabled('popup');
        sendResponse({ ok: true, enabled });
        return false;
      }

      if (message.type === 'SET_TONG_OVERLAY') {
        const enabled = this.setOverlayEnabled(Boolean(message.enabled), 'popup');
        sendResponse({ ok: true, enabled });
        return false;
      }

      if (message.type === 'GET_TONG_OVERLAY_STATE') {
        sendResponse({
          ok: true,
          enabled: this.overlayEnabled,
          videoId: this.videoId,
          captionCount: this.captions.length,
          activeSegmentIndex: this.activeSegmentIndex,
        });
        return false;
      }

      return false;
    }

    async handleStorageChange(changes, areaName) {
      if (areaName !== 'sync' || !changes[API_BASE_KEY]) {
        return;
      }

      const nextBase = this.normalizeApiBase(changes[API_BASE_KEY].newValue);
      if (!nextBase || nextBase === this.apiBase) {
        return;
      }

      this.apiBase = nextBase;
      log('Detected API base storage update:', this.apiBase);
      this.setStatus(`API endpoint switched to ${this.apiBase}`);

      if (this.isWatchPage() && this.videoId) {
        await this.reloadCaptions(this.videoId);
      }
    }

    async readApiBase() {
      if (!chrome || !chrome.storage || !chrome.storage.sync) {
        return DEFAULT_API_BASE;
      }

      return new Promise((resolve) => {
        chrome.storage.sync.get([API_BASE_KEY], (result) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            warn('Failed to read API base from storage; using default');
            resolve(DEFAULT_API_BASE);
            return;
          }
          const configured = this.normalizeApiBase(result[API_BASE_KEY]);
          resolve(configured || DEFAULT_API_BASE);
        });
      });
    }

    normalizeApiBase(value) {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      if (!trimmed) return null;
      return trimmed.replace(/\/$/, '');
    }

    handleNavigationSignal() {
      if (window.location.href === this.lastUrl) {
        return;
      }
      log('Navigation detected:', this.lastUrl, '->', window.location.href);
      this.lastUrl = window.location.href;
      void this.syncWithPageState();
    }

    async syncWithPageState() {
      if (this.syncInFlight) {
        this.needsResync = true;
        log('syncWithPageState requested during active sync; queueing resync');
        return;
      }

      this.syncInFlight = true;
      do {
        this.needsResync = false;
        await this.syncOnce();
      } while (this.needsResync);
      this.syncInFlight = false;
    }

    async syncOnce() {
      if (!this.isWatchPage()) {
        log('Non-watch route detected; overlay hidden');
        this.videoId = null;
        this.captions = [];
        this.activeSegment = null;
        this.activeSegmentIndex = -1;
        this.detachVideoListeners();
        this.ensureOverlay();
        this.setVisibility(false);
        this.renderSegment(null);
        this.setStatus('Open a YouTube watch page to start Tong overlay.');
        return;
      }

      this.ensureOverlay();
      this.setVisibility(true);

      const videoId = this.getVideoId();
      if (!videoId) {
        log('Watch page without videoId yet');
        this.setStatus('Waiting for video ID...');
        return;
      }

      const video = await this.waitForVideo(15000);
      if (!video) {
        warn('Video element not found before timeout');
        this.setStatus('Waiting for YouTube player...');
        return;
      }

      if (video !== this.video) {
        log('Video element bound');
        this.detachVideoListeners();
        this.video = video;
        this.video.addEventListener('timeupdate', this.onTimeUpdate);
        this.video.addEventListener('seeking', this.onTimeUpdate);
        this.video.addEventListener('ratechange', this.onTimeUpdate);
      }

      if (this.videoId !== videoId || this.captions.length === 0) {
        log('Loading caption data for videoId:', videoId);
        this.videoId = videoId;
        await this.reloadCaptions(videoId);
      }

      this.onTimeUpdate();
    }

    isWatchPage() {
      return window.location.pathname.startsWith('/watch');
    }

    getVideoId() {
      return new URL(window.location.href).searchParams.get('v') || null;
    }

    async waitForVideo(timeoutMs) {
      const startedAt = Date.now();

      while (Date.now() - startedAt < timeoutMs) {
        const video = document.querySelector('video');
        if (video) {
          return video;
        }
        await this.sleep(250);
      }

      warn('waitForVideo timeout after', timeoutMs, 'ms');
      return null;
    }

    ensureOverlay() {
      const container =
        document.querySelector('#movie_player') || document.querySelector('.html5-video-player') || document.body;

      if (!container) {
        warn('Overlay container not found');
        return;
      }

      if (!this.overlayRoot) {
        log('Creating overlay DOM');
        this.overlayRoot = document.createElement('div');
        this.overlayRoot.id = 'tong-overlay-root';

        const card = document.createElement('div');
        card.className = 'tong-overlay-card';

        this.toolbar = document.createElement('div');
        this.toolbar.className = 'tong-toolbar';

        this.statusLine = document.createElement('div');
        this.statusLine.className = 'tong-status';

        this.toggleButton = document.createElement('button');
        this.toggleButton.type = 'button';
        this.toggleButton.className = 'tong-toggle';
        this.toggleButton.addEventListener('click', () => {
          this.toggleOverlayEnabled('in-page');
        });

        this.scriptLine = document.createElement('div');
        this.scriptLine.className = 'tong-script';

        this.romanizedLine = document.createElement('div');
        this.romanizedLine.className = 'tong-romanized';

        this.englishLine = document.createElement('div');
        this.englishLine.className = 'tong-english';

        this.tokenRow = document.createElement('div');
        this.tokenRow.className = 'tong-token-row';

        this.dictionaryPanel = document.createElement('div');
        this.dictionaryPanel.className = 'tong-dictionary tong-overlay-hidden';

        this.toolbar.appendChild(this.statusLine);
        this.toolbar.appendChild(this.toggleButton);

        card.appendChild(this.toolbar);
        card.appendChild(this.scriptLine);
        card.appendChild(this.romanizedLine);
        card.appendChild(this.englishLine);
        card.appendChild(this.tokenRow);
        card.appendChild(this.dictionaryPanel);

        this.overlayRoot.appendChild(card);
      }

      if (this.overlayRoot.parentElement !== container) {
        this.overlayRoot.remove();
        container.appendChild(this.overlayRoot);
        log('Overlay attached to container:', container.id || container.className || container.tagName);
      }

      this.syncToggleButtonLabel();
    }

    async reloadCaptions(videoId) {
      if (!videoId) return;

      if (this.captionsAbortController) {
        this.captionsAbortController.abort();
      }

      this.captionsAbortController = new AbortController();
      const signal = this.captionsAbortController.signal;

      this.setStatus(`Loading captions for ${videoId}...`);
      this.activeSegment = null;
      this.activeSegmentIndex = -1;
      this.hasShownLoopModeStatus = false;
      this.renderSegment(null);
      this.hideDictionaryPanel();

      try {
        const url = `${this.apiBase}/api/v1/captions/enriched?videoId=${encodeURIComponent(videoId)}&lang=${LANG}`;
        log('Fetching captions:', url);
        const response = await fetch(
          url,
          {
            signal,
            cache: 'no-store',
          },
        );

        if (!response.ok) {
          throw new Error(`captions_request_failed_${response.status}`);
        }

        const payload = await response.json();
        const segments = Array.isArray(payload.segments) ? payload.segments : [];
        this.captions = segments;
        log('Caption fetch success:', segments.length, 'segments');

        if (segments.length === 0) {
          this.setStatus(`No caption segments returned for ${videoId}.`);
          return;
        }

        this.setStatus(`Loaded ${segments.length} caption segments.`);
      } catch (error) {
        if (error && error.name === 'AbortError') {
          log('Caption fetch aborted');
          return;
        }
        this.captions = [];
        this.activeSegment = null;
        this.renderSegment(null);
        this.setStatus(
          'Could not load captions. Confirm Tong API is running at ' +
            `${this.apiBase} and allows CORS.`,
        );
        errorLog('Failed to load captions', error);
      }
    }

    setStatus(text) {
      if (!this.statusLine) return;
      this.statusLine.textContent = text;
      log('Status:', text);
    }

    syncToggleButtonLabel() {
      if (!this.toggleButton) return;
      this.toggleButton.textContent = this.overlayEnabled ? 'Overlay On' : 'Overlay Off';
    }

    setOverlayEnabled(enabled, source = 'unknown') {
      const nextEnabled = Boolean(enabled);
      if (nextEnabled === this.overlayEnabled) {
        this.syncToggleButtonLabel();
        return this.overlayEnabled;
      }

      this.overlayEnabled = nextEnabled;
      this.syncToggleButtonLabel();
      if (this.overlayRoot) {
        this.overlayRoot.classList.toggle('tong-overlay-disabled', !this.overlayEnabled);
      }

      log('Overlay', this.overlayEnabled ? 'enabled' : 'disabled', `(source: ${source})`);

      if (this.overlayEnabled) {
        this.setStatus('Overlay resumed.');
        this.onTimeUpdate();
      } else {
        this.renderSegment(null);
        this.hideDictionaryPanel();
        this.setStatus('Overlay paused. Click toggle or press Alt+T.');
      }

      return this.overlayEnabled;
    }

    toggleOverlayEnabled(source = 'unknown') {
      return this.setOverlayEnabled(!this.overlayEnabled, source);
    }

    setVisibility(visible) {
      if (!this.overlayRoot) return;
      this.overlayRoot.classList.toggle('tong-overlay-hidden-root', !visible);
    }

    onTimeUpdate() {
      if (!this.overlayEnabled || !this.video || this.captions.length === 0) {
        return;
      }

      const currentMs = Math.floor(this.video.currentTime * 1000);
      const next = this.resolveSegmentForTime(currentMs);
      if (!next) {
        if (this.activeSegmentIndex === -1) {
          return;
        }
        this.activeSegment = null;
        this.activeSegmentIndex = -1;
        this.renderSegment(null);
        return;
      }

      if (this.activeSegmentIndex === next.index) {
        return;
      }

      this.activeSegment = next.segment;
      this.activeSegmentIndex = next.index;
      this.renderSegment(next.segment, next);

      if (next.looped && !this.hasShownLoopModeStatus) {
        this.hasShownLoopModeStatus = true;
        this.setStatus(
          `Loaded ${this.captions.length} caption segments (fixture loop mode active).`,
        );
      }
    }

    findSegmentIndex(currentMs) {
      for (let i = 0; i < this.captions.length; i += 1) {
        const segment = this.captions[i];
        if (currentMs >= segment.startMs && currentMs <= segment.endMs) {
          return i;
        }
      }
      return -1;
    }

    resolveSegmentForTime(currentMs) {
      const exactIndex = this.findSegmentIndex(currentMs);
      if (exactIndex >= 0) {
        return {
          index: exactIndex,
          segment: this.captions[exactIndex],
          looped: false,
          normalizedMs: currentMs,
        };
      }

      if (this.captions.length === 0) {
        return null;
      }

      // Fixture captions are short. Loop them across full playback timeline.
      const firstStart = Number(this.captions[0].startMs || 0);
      const lastEnd = Number(this.captions[this.captions.length - 1].endMs || firstStart + 1);
      const cycleMs = Math.max(lastEnd + FIXTURE_CYCLE_PADDING_MS, firstStart + 1000);
      const normalizedMs = currentMs % cycleMs;

      let loopIndex = this.findSegmentIndex(normalizedMs);
      if (loopIndex < 0) {
        // Hold the nearest previous segment in the cycle to avoid blank overlay windows.
        loopIndex = 0;
        for (let i = 0; i < this.captions.length; i += 1) {
          if (normalizedMs >= this.captions[i].startMs) {
            loopIndex = i;
          }
        }
      }

      return {
        index: loopIndex,
        segment: this.captions[loopIndex],
        looped: true,
        normalizedMs,
      };
    }

    renderSegment(segment, meta) {
      if (!this.scriptLine || !this.romanizedLine || !this.englishLine || !this.tokenRow) {
        return;
      }

      this.tokenRow.innerHTML = '';

      if (!segment) {
        this.scriptLine.textContent = '';
        this.romanizedLine.textContent = '';
        this.englishLine.textContent = 'No active subtitle at this moment.';
        log('Render: no active segment');
        return;
      }

      this.scriptLine.textContent = segment.surface || '';
      this.romanizedLine.textContent = segment.romanized || '';
      this.englishLine.textContent = segment.english || '';
      if (meta && meta.looped) {
        log(
          'Render segment (looped):',
          `${segment.startMs}-${segment.endMs}`,
          `normalized=${meta.normalizedMs}ms`,
          segment.surface || '(empty)',
        );
      } else {
        log('Render segment:', `${segment.startMs}-${segment.endMs}`, segment.surface || '(empty)');
      }

      const tokens = Array.isArray(segment.tokens) ? segment.tokens : [];
      tokens.forEach((token) => {
        const label = typeof token.text === 'string' ? token.text : '';
        const lookupTerm = token.lemma || label;
        if (!label || !lookupTerm) {
          return;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tong-token';
        button.textContent = label;
        button.addEventListener('click', () => {
          void this.openDictionary(lookupTerm);
        });
        this.tokenRow.appendChild(button);
      });
    }

    async openDictionary(term) {
      if (!this.dictionaryPanel || !term) {
        return;
      }

      log('Dictionary lookup requested:', term);
      this.dictionaryPanel.classList.remove('tong-overlay-hidden');

      const cached = this.dictionaryCache.get(term);
      if (cached) {
        log('Dictionary cache hit:', term);
        this.renderDictionaryEntry(cached);
        return;
      }

      this.renderDictionaryMessage('Loading dictionary...');

      try {
        const url = `${this.apiBase}/api/v1/dictionary/entry?term=${encodeURIComponent(term)}&lang=${LANG}`;
        log('Fetching dictionary:', url);
        const response = await fetch(
          url,
          {
            cache: 'no-store',
          },
        );

        if (!response.ok) {
          throw new Error(`dictionary_request_failed_${response.status}`);
        }

        const entry = await response.json();
        this.dictionaryCache.set(term, entry);
        log('Dictionary fetch success:', term);
        this.renderDictionaryEntry(entry);
      } catch (error) {
        this.renderDictionaryMessage('Dictionary lookup failed.');
        errorLog('Dictionary fetch failed for term:', term, error);
      }
    }

    hideDictionaryPanel() {
      if (!this.dictionaryPanel) return;
      this.dictionaryPanel.classList.add('tong-overlay-hidden');
      this.dictionaryPanel.textContent = '';
    }

    renderDictionaryMessage(text) {
      if (!this.dictionaryPanel) return;
      this.dictionaryPanel.textContent = text;
    }

    renderDictionaryEntry(entry) {
      if (!this.dictionaryPanel) return;

      this.dictionaryPanel.innerHTML = '';

      const term = document.createElement('strong');
      term.textContent = entry.term || '-';

      const meaning = document.createElement('div');
      meaning.textContent = entry.meaning || '-';

      const readings = document.createElement('div');
      const ko = entry.readings && entry.readings.ko ? entry.readings.ko : '-';
      const zh = entry.readings && entry.readings.zhPinyin ? entry.readings.zhPinyin : '-';
      const ja = entry.readings && entry.readings.jaRomaji ? entry.readings.jaRomaji : '-';
      readings.textContent = `KO: ${ko} · ZH: ${zh} · JA: ${ja}`;

      const mapping = document.createElement('div');
      const zhHans = entry.crossCjk && entry.crossCjk.zhHans ? entry.crossCjk.zhHans : '-';
      const jaMap = entry.crossCjk && entry.crossCjk.ja ? entry.crossCjk.ja : '-';
      mapping.textContent = `Cross-CJK: ${zhHans} / ${jaMap}`;

      this.dictionaryPanel.appendChild(term);
      this.dictionaryPanel.appendChild(meaning);
      this.dictionaryPanel.appendChild(readings);
      this.dictionaryPanel.appendChild(mapping);
    }

    detachVideoListeners() {
      if (!this.video) {
        return;
      }
      this.video.removeEventListener('timeupdate', this.onTimeUpdate);
      this.video.removeEventListener('seeking', this.onTimeUpdate);
      this.video.removeEventListener('ratechange', this.onTimeUpdate);
      log('Detached old video listeners');
      this.video = null;
    }

    sleep(ms) {
      return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
      });
    }
  }

  const overlay = new TongYouTubeOverlay();
  window.addEventListener('error', (event) => {
    errorLog('Unhandled window error:', event.error || event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    errorLog('Unhandled promise rejection:', event.reason);
  });
  window.__tongOverlayDebug = overlay;
  log('Debug handle exposed as window.__tongOverlayDebug');
  void overlay.init();
})();
