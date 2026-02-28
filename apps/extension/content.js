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

  function isCjkLanguage(languageCode) {
    const code = String(languageCode || '').toLowerCase();
    return code.startsWith('ko') || code.startsWith('ja') || code.startsWith('zh');
  }

  function toReadableName(track) {
    if (!track) return 'unknown';
    const name = track.name;
    if (!name) return track.languageCode || track.vssId || 'unknown';
    if (typeof name.simpleText === 'string' && name.simpleText.trim()) return name.simpleText.trim();
    if (Array.isArray(name.runs) && name.runs.length > 0) {
      return name.runs
        .map((run) => (typeof run.text === 'string' ? run.text : ''))
        .join('')
        .trim();
    }
    return track.languageCode || track.vssId || 'unknown';
  }

  class TongYouTubeOverlay {
    constructor() {
      this.apiBase = DEFAULT_API_BASE;
      this.video = null;
      this.videoId = null;
      this.captions = [];
      this.captionSource = 'none';
      this.activeTrack = null;
      this.activeSegmentIndex = -1;
      this.activeSegment = null;
      this.overlayEnabled = true;
      this.hasShownLoopModeStatus = false;
      this.dictionaryCache = new Map();

      this.overlayRoot = null;
      this.toolbar = null;
      this.toggleButton = null;
      this.statusLine = null;
      this.scriptLine = null;
      this.romanizedLine = null;
      this.englishLine = null;
      this.tokenRow = null;
      this.dictionaryPanel = null;

      this.lastUrl = window.location.href;
      this.navigationPollTimer = null;
      this.syncInFlight = false;
      this.needsResync = false;
      this.captionsAbortController = null;

      this.onTimeUpdate = this.onTimeUpdate.bind(this);
      this.handleNavigationSignal = this.handleNavigationSignal.bind(this);
      this.handleStorageChange = this.handleStorageChange.bind(this);
      this.handleRuntimeMessage = this.handleRuntimeMessage.bind(this);
      this.handleKeydown = this.handleKeydown.bind(this);

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
          source: this.captionSource,
          activeTrack: this.activeTrack,
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
      this.setStatus(`API endpoint switched to ${this.apiBase}`);
      log('Detected API base update:', this.apiBase);

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
        this.captionSource = 'none';
        this.activeTrack = null;
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
        this.setStatus('Waiting for video ID...');
        return;
      }

      const video = await this.waitForVideo(15000);
      if (!video) {
        this.setStatus('Waiting for YouTube player...');
        warn('Video element not found before timeout');
        return;
      }

      if (video !== this.video) {
        this.detachVideoListeners();
        this.video = video;
        this.video.addEventListener('timeupdate', this.onTimeUpdate);
        this.video.addEventListener('seeking', this.onTimeUpdate);
        this.video.addEventListener('ratechange', this.onTimeUpdate);
        log('Video element bound');
      }

      if (this.videoId !== videoId || this.captions.length === 0) {
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
        log('Created overlay DOM');
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
      this.activeSegment = null;
      this.activeSegmentIndex = -1;
      this.hasShownLoopModeStatus = false;

      this.setStatus(`Loading captions for ${videoId}...`);
      this.renderSegment(null);
      this.hideDictionaryPanel();

      const liveSegments = await this.loadYouTubeCaptionSegments();
      if (liveSegments.length > 0) {
        this.captions = liveSegments;
        this.captionSource = 'youtube';
        this.setStatus(
          `Live track: ${this.activeTrack.label} (${this.activeTrack.language}) · ${liveSegments.length} cues`,
        );
        log('Using live YouTube captions:', liveSegments.length, 'segments');
        return;
      }

      warn('Live YouTube caption extraction unavailable; falling back to fixture API');
      const fixtureSegments = await this.loadFixtureCaptionSegments(videoId, this.captionsAbortController.signal);
      if (fixtureSegments.length > 0) {
        this.captions = fixtureSegments;
        this.captionSource = 'fixture';
        this.activeTrack = null;
        this.setStatus(`Loaded ${fixtureSegments.length} fixture segments (loop mode active).`);
        log('Using fixture captions:', fixtureSegments.length, 'segments');
        return;
      }

      this.captions = [];
      this.captionSource = 'none';
      this.activeTrack = null;
      this.setStatus('No subtitles available on this video.');
    }

    async loadYouTubeCaptionSegments() {
      if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
        warn('chrome.runtime.sendMessage unavailable; cannot request live YouTube cues');
        return [];
      }

      try {
        const tracksResponse = await chrome.runtime.sendMessage({ type: 'GET_YT_CAPTION_TRACKS' });
        if (!tracksResponse || !tracksResponse.ok || !Array.isArray(tracksResponse.tracks)) {
          warn('Track response missing or invalid:', tracksResponse);
          return [];
        }

        const tracks = tracksResponse.tracks;
        log('Track list received:', tracks.length);

        const selectedTrack = this.selectTrack(tracks);
        if (!selectedTrack || !selectedTrack.baseUrl) {
          warn('No usable track with baseUrl found');
          return [];
        }

        const subtitleUrl = this.buildSubtitleUrl(selectedTrack.baseUrl);
        log('Fetching selected track:', selectedTrack.languageCode || 'unknown', selectedTrack.kind || 'standard');

        const subtitleResponse = await chrome.runtime.sendMessage({
          type: 'FETCH_YT_SUBTITLES',
          url: subtitleUrl,
        });

        if (!subtitleResponse || !subtitleResponse.ok || typeof subtitleResponse.text !== 'string') {
          warn('Subtitle fetch response invalid:', subtitleResponse);
          return [];
        }

        const segments = this.parseSubtitlePayload(
          subtitleResponse.text,
          selectedTrack.languageCode || selectedTrack.vssId || LANG,
        );

        if (segments.length === 0) {
          warn('Subtitle payload parsed but yielded 0 segments');
          return [];
        }

        this.activeTrack = {
          language: selectedTrack.languageCode || 'unknown',
          label: toReadableName(selectedTrack),
          kind: selectedTrack.kind || 'manual',
          isAutoGenerated: selectedTrack.kind === 'asr',
        };

        return segments;
      } catch (error) {
        errorLog('Live caption loading failed:', error);
        return [];
      }
    }

    selectTrack(tracks) {
      if (!Array.isArray(tracks) || tracks.length === 0) {
        return null;
      }

      const normalized = tracks
        .filter((track) => track && typeof track === 'object')
        .map((track) => ({
          ...track,
          languageCode: String(track.languageCode || '').trim(),
          isAutoGenerated: track.kind === 'asr',
          isDefault: Boolean(track.isDefault),
        }));

      const byScore = [
        (track) => track.languageCode.startsWith('ko') && !track.isAutoGenerated && track.isDefault,
        (track) => track.languageCode.startsWith('ko') && !track.isAutoGenerated,
        (track) => track.languageCode.startsWith('ko'),
        (track) => isCjkLanguage(track.languageCode) && !track.isAutoGenerated && track.isDefault,
        (track) => isCjkLanguage(track.languageCode) && !track.isAutoGenerated,
        (track) => isCjkLanguage(track.languageCode),
        (track) => !track.isAutoGenerated && track.isDefault,
        (track) => !track.isAutoGenerated,
        () => true,
      ];

      for (let i = 0; i < byScore.length; i += 1) {
        const selected = normalized.find(byScore[i]);
        if (selected && selected.baseUrl) {
          return selected;
        }
      }

      return null;
    }

    buildSubtitleUrl(baseUrl) {
      if (!baseUrl || typeof baseUrl !== 'string') {
        return '';
      }

      let url = baseUrl;
      if (/[?&]fmt=/.test(url)) {
        url = url.replace(/([?&]fmt=)[^&]*/, '$1json3');
      } else {
        url += (url.includes('?') ? '&' : '?') + 'fmt=json3';
      }
      return url;
    }

    parseSubtitlePayload(payloadText, languageCode) {
      if (typeof payloadText !== 'string' || !payloadText.trim()) {
        return [];
      }

      const trimmed = payloadText.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const jsonSegments = this.parseJson3Payload(trimmed, languageCode);
        if (jsonSegments.length > 0) {
          return jsonSegments;
        }
      }

      if (trimmed.startsWith('<')) {
        return this.parseXmlPayload(trimmed, languageCode);
      }

      return [];
    }

    parseJson3Payload(jsonText, languageCode) {
      try {
        const parsed = JSON.parse(jsonText);
        const events = Array.isArray(parsed.events) ? parsed.events : [];

        const segments = [];
        for (let i = 0; i < events.length; i += 1) {
          const event = events[i];
          if (!event || !Array.isArray(event.segs)) {
            continue;
          }

          const startMs = Number(event.tStartMs || 0);
          let endMs = startMs + Number(event.dDurationMs || 0);
          if (endMs <= startMs) {
            const nextEvent = events[i + 1];
            if (nextEvent && Number(nextEvent.tStartMs || 0) > startMs) {
              endMs = Number(nextEvent.tStartMs || 0);
            } else {
              endMs = startMs + 1800;
            }
          }

          const surface = this.cleanCaptionText(
            event.segs
              .map((seg) => (seg && typeof seg.utf8 === 'string' ? seg.utf8 : ''))
              .join(' '),
          );

          if (!surface) {
            continue;
          }

          segments.push(this.buildSegment(startMs, endMs, surface, languageCode, i));
        }

        return segments;
      } catch (error) {
        warn('JSON3 parse failed:', error);
        return [];
      }
    }

    parseXmlPayload(xmlText, languageCode) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'text/xml');
        const nodes = Array.from(doc.querySelectorAll('text'));

        const segments = [];
        for (let i = 0; i < nodes.length; i += 1) {
          const node = nodes[i];
          const startSec = Number(node.getAttribute('start') || '0');
          const durationSec = Number(node.getAttribute('dur') || '1.8');
          const startMs = Math.floor(startSec * 1000);
          const endMs = Math.max(startMs + 600, Math.floor((startSec + durationSec) * 1000));

          const textarea = document.createElement('textarea');
          textarea.innerHTML = node.textContent || '';
          const surface = this.cleanCaptionText(textarea.value);
          if (!surface) {
            continue;
          }

          segments.push(this.buildSegment(startMs, endMs, surface, languageCode, i));
        }

        return segments;
      } catch (error) {
        warn('XML parse failed:', error);
        return [];
      }
    }

    cleanCaptionText(text) {
      if (typeof text !== 'string') return '';
      return text
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/[♪♫]/g, '')
        .trim();
    }

    buildSegment(startMs, endMs, surface, languageCode, index) {
      const tokens = this.tokenize(surface, languageCode);
      return {
        startMs,
        endMs,
        surface,
        romanized: '',
        english: '',
        tokens,
        source: 'youtube',
        index,
      };
    }

    tokenize(surface, languageCode) {
      const split = surface
        .split(/\s+/)
        .map((part) => part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').trim())
        .filter(Boolean);

      const unique = [];
      for (let i = 0; i < split.length; i += 1) {
        const token = split[i];
        if (!token) continue;
        unique.push({
          text: token,
          lemma: token,
          pos: 'token',
          dictionaryId: `${languageCode || 'yt'}-auto-${i}`,
        });
        if (unique.length >= 10) break;
      }
      return unique;
    }

    async loadFixtureCaptionSegments(videoId, signal) {
      try {
        const url = `${this.apiBase}/api/v1/captions/enriched?videoId=${encodeURIComponent(videoId)}&lang=${LANG}`;
        log('Fetching fixture fallback captions:', url);

        const response = await fetch(url, { signal, cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`fixture_caption_request_failed_${response.status}`);
        }

        const payload = await response.json();
        const segments = Array.isArray(payload.segments) ? payload.segments : [];
        return segments;
      } catch (error) {
        if (error && error.name === 'AbortError') {
          log('Fixture caption fetch aborted');
          return [];
        }
        errorLog('Fixture caption fetch failed:', error);
        return [];
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
      if (this.overlayEnabled === nextEnabled) {
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
      const resolved = this.resolveSegmentForTime(currentMs);

      if (!resolved) {
        if (this.activeSegmentIndex !== -1) {
          this.activeSegment = null;
          this.activeSegmentIndex = -1;
          this.renderSegment(null);
        }
        return;
      }

      if (this.activeSegmentIndex === resolved.index) {
        return;
      }

      this.activeSegment = resolved.segment;
      this.activeSegmentIndex = resolved.index;
      this.renderSegment(resolved.segment, resolved);

      if (this.captionSource === 'fixture' && resolved.looped && !this.hasShownLoopModeStatus) {
        this.hasShownLoopModeStatus = true;
        this.setStatus(`Loaded ${this.captions.length} fixture segments (loop mode active).`);
      }
    }

    resolveSegmentForTime(currentMs) {
      if (this.captionSource !== 'fixture') {
        const index = this.findSegmentIndex(currentMs);
        if (index < 0) {
          return null;
        }
        return {
          index,
          segment: this.captions[index],
          looped: false,
          normalizedMs: currentMs,
        };
      }

      const directIndex = this.findSegmentIndex(currentMs);
      if (directIndex >= 0) {
        return {
          index: directIndex,
          segment: this.captions[directIndex],
          looped: false,
          normalizedMs: currentMs,
        };
      }

      if (this.captions.length === 0) {
        return null;
      }

      const firstStart = Number(this.captions[0].startMs || 0);
      const lastEnd = Number(this.captions[this.captions.length - 1].endMs || firstStart + 1);
      const cycleMs = Math.max(lastEnd + FIXTURE_CYCLE_PADDING_MS, firstStart + 1000);
      const normalizedMs = currentMs % cycleMs;

      let loopIndex = this.findSegmentIndex(normalizedMs);
      if (loopIndex < 0) {
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

    findSegmentIndex(currentMs) {
      for (let i = 0; i < this.captions.length; i += 1) {
        const segment = this.captions[i];
        if (currentMs >= Number(segment.startMs || 0) && currentMs <= Number(segment.endMs || 0)) {
          return i;
        }
      }
      return -1;
    }

    renderSegment(segment, meta) {
      if (!this.scriptLine || !this.romanizedLine || !this.englishLine || !this.tokenRow) {
        return;
      }

      this.tokenRow.innerHTML = '';

      if (!segment) {
        this.scriptLine.textContent = '';
        this.romanizedLine.style.display = 'none';
        this.englishLine.style.display = '';
        this.englishLine.textContent = 'No active subtitle at this moment.';
        log('Render: no active segment');
        return;
      }

      this.scriptLine.textContent = segment.surface || '';

      const romanized = typeof segment.romanized === 'string' ? segment.romanized.trim() : '';
      const english = typeof segment.english === 'string' ? segment.english.trim() : '';

      this.romanizedLine.textContent = romanized;
      this.romanizedLine.style.display = romanized ? '' : 'none';

      this.englishLine.textContent = english;
      this.englishLine.style.display = english ? '' : 'none';

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

      this.dictionaryPanel.classList.remove('tong-overlay-hidden');
      log('Dictionary lookup requested:', term);

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
        const response = await fetch(url, { cache: 'no-store' });

        if (!response.ok) {
          throw new Error(`dictionary_request_failed_${response.status}`);
        }

        const entry = await response.json();
        this.dictionaryCache.set(term, entry);
        this.renderDictionaryEntry(entry);
        log('Dictionary fetch success:', term);
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
      term.textContent = entry && entry.term ? entry.term : '-';

      const meaning = document.createElement('div');
      meaning.textContent = entry && entry.meaning ? entry.meaning : '-';

      const readings = document.createElement('div');
      const ko = entry && entry.readings && entry.readings.ko ? entry.readings.ko : '-';
      const zh = entry && entry.readings && entry.readings.zhPinyin ? entry.readings.zhPinyin : '-';
      const ja = entry && entry.readings && entry.readings.jaRomaji ? entry.readings.jaRomaji : '-';
      readings.textContent = `KO: ${ko} · ZH: ${zh} · JA: ${ja}`;

      const mapping = document.createElement('div');
      const zhHans = entry && entry.crossCjk && entry.crossCjk.zhHans ? entry.crossCjk.zhHans : '-';
      const jaMap = entry && entry.crossCjk && entry.crossCjk.ja ? entry.crossCjk.ja : '-';
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
      this.video = null;
      log('Detached old video listeners');
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
