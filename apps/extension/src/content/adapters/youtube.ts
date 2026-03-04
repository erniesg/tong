import type { SubtitleCue } from '@tong/core';
import type { PlatformAdapter, SubtitleTrackInfo, PlaybackState } from './types';

/**
 * YouTube platform adapter
 *
 * Strategy: The interceptor is injected at document_start (via early-inject.js)
 * BEFORE YouTube's JS loads. This lets us passively capture YouTube's own
 * timedtext fetches (which include POT tokens we can't generate ourselves).
 * For track switching, we trigger caption loading via the YouTube player API.
 */
export class YouTubeAdapter implements PlatformAdapter {
  readonly platform = 'youtube';

  private video: HTMLVideoElement | null = null;
  private timeUpdateCallbacks: Set<(time: number) => void> = new Set();
  private rateChangeCallbacks: Set<(rate: number) => void> = new Set();

  // Caption data received from interceptor
  private interceptedCaptions: Map<string, SubtitleCue[]> = new Map();
  private captionResolvers: Map<string, (cues: SubtitleCue[]) => void> = new Map();
  private captionListeners: Set<(lang: string, cues: SubtitleCue[]) => void> = new Set();

  // Raw track data from YouTube
  private rawTrackData: Map<string, any> = new Map();

  // Map trackId (vssId) → languageCode for correct lang extraction
  private trackLanguageMap: Map<string, string> = new Map();

  constructor() {
    // Interceptor is already injected at document_start by early-inject.js.
    // We just need to listen for the data it captures.
    this.listenForInterceptedData();
  }

  /**
   * Listen for caption data dispatched by the interceptor.
   */
  private listenForInterceptedData() {
    window.addEventListener('tong-caption-intercepted', ((event: CustomEvent) => {
      const { lang, data, format } = event.detail;
      console.log('[YouTube] Received intercepted caption:', lang, format, data.length, 'bytes');

      let cues: SubtitleCue[];
      if (format === 'json3') {
        cues = this.parseJson3(data);
      } else {
        cues = this.parseXml(data);
      }

      console.log('[YouTube] Parsed', cues.length, 'cues from intercepted data');

      // Store and resolve any pending requests
      this.interceptedCaptions.set(lang, cues);
      const resolver = this.captionResolvers.get(lang);
      if (resolver) {
        resolver(cues);
        this.captionResolvers.delete(lang);
      }

      // Notify late listeners (overlay subscribes in case initial load timed out)
      this.captionListeners.forEach(cb => cb(lang, cues));
    }) as EventListener);
  }

  /**
   * Reset state for a new video. Called on SPA navigation before setup().
   */
  resetForNewVideo() {
    this.interceptedCaptions.clear();
    this.rawTrackData.clear();
    this.trackLanguageMap.clear();
    this.captionResolvers.clear();
  }

  async waitForVideo(): Promise<HTMLVideoElement | null> {
    const video = document.querySelector('video');
    if (video) {
      this.video = video;
      this.setupEventListeners();
      return video;
    }

    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        const video = document.querySelector('video');
        if (video) {
          observer.disconnect();
          this.video = video;
          this.setupEventListeners();
          resolve(video);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(null); }, 30000);
    });
  }

  private setupEventListeners() {
    if (!this.video) return;
    this.video.addEventListener('timeupdate', () => {
      const time = (this.video?.currentTime || 0) * 1000;
      this.timeUpdateCallbacks.forEach((cb) => cb(time));
    });
    this.video.addEventListener('ratechange', () => {
      const rate = this.video?.playbackRate || 1;
      this.rateChangeCallbacks.forEach((cb) => cb(rate));
    });
  }

  getVideoId(): string | null {
    return new URL(window.location.href).searchParams.get('v');
  }

  getVideoTitle(): string | null {
    for (const sel of ['h1.ytd-watch-metadata', '#title h1', 'meta[property="og:title"]']) {
      const el = document.querySelector(sel);
      if (el) return el instanceof HTMLMetaElement ? el.content : el.textContent?.trim() || null;
    }
    return null;
  }

  /**
   * Get subtitle tracks via background executeScript in MAIN world,
   * with HTML parsing as fallback.
   */
  async getSubtitleTracks(): Promise<SubtitleTrackInfo[]> {
    console.log('[YouTube] Getting subtitle tracks...');

    // Method 1: ask background to use executeScript MAIN world
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_YT_CAPTION_TRACKS' });
      if (response.success && response.data?.length > 0) {
        const tracks = response.data;
        console.log('[YouTube] Got', tracks.length, 'tracks via MAIN world');
        return tracks.map((t: any) => {
          const id = t.vssId || t.languageCode;
          // Store raw track data for direct fetch fallback
          this.rawTrackData.set(id, t);
          // Map trackId → languageCode for correct lang extraction in getSubtitles()
          this.trackLanguageMap.set(id, t.languageCode);
          return {
            id,
            label: t.name?.simpleText || t.name?.runs?.[0]?.text || t.languageCode,
            language: t.languageCode,
            isAutoGenerated: t.kind === 'asr',
            isDefault: t.isDefault || false,
          };
        });
      }
    } catch (e) {
      console.warn('[YouTube] MAIN world track extraction failed:', e);
    }

    // Method 2: parse from HTML
    const htmlTracks = this.extractTracksFromHTML();
    if (htmlTracks.length > 0) {
      console.log('[YouTube] Got', htmlTracks.length, 'tracks from HTML');
      return htmlTracks;
    }

    console.log('[YouTube] No subtitle tracks found');
    return [];
  }

  private extractTracksFromHTML(): SubtitleTrackInfo[] {
    try {
      const html = document.documentElement.innerHTML;
      const marker = '"captionTracks":';
      const idx = html.indexOf(marker);
      if (idx === -1) return [];

      const start = html.indexOf('[', idx + marker.length);
      if (start === -1 || start > idx + marker.length + 5) return [];

      let depth = 0, end = -1;
      for (let i = start; i < html.length && i < start + 50000; i++) {
        if (html[i] === '[') depth++;
        else if (html[i] === ']') { depth--; if (depth === 0) { end = i + 1; break; } }
      }
      if (end === -1) return [];

      const tracks = JSON.parse(html.substring(start, end));
      return tracks.map((t: any) => {
        const id = t.vssId || t.languageCode;
        // Store raw track data (includes baseUrl) for direct fetch
        this.rawTrackData.set(id, t);
        // Map trackId → languageCode for correct lang extraction in getSubtitles()
        this.trackLanguageMap.set(id, t.languageCode);
        return {
          id,
          label: t.name?.simpleText || t.name?.runs?.[0]?.text || t.languageCode,
          language: t.languageCode,
          isAutoGenerated: t.kind === 'asr',
          isDefault: t.isDefault || false,
        };
      });
    } catch { return []; }
  }

  /**
   * Get subtitles for a track.
   * Strategy:
   *   1. Check if interceptor already captured this language
   *   2. Wait briefly for passive/auto capture
   *   3. Direct fetch via baseUrl from captionTracks (most reliable)
   *   4. Fall back to CC toggle via interceptor
   */
  async getSubtitles(trackId: string): Promise<SubtitleCue[]> {
    // Use trackLanguageMap for correct lang extraction (vssId → languageCode)
    const lang = this.trackLanguageMap.get(trackId) || trackId;
    console.log('[YouTube] Getting subtitles for lang:', lang, '(from trackId:', trackId, ')');

    // 1. Check if interceptor already captured this language
    const existing = this.interceptedCaptions.get(lang);
    if (existing && existing.length > 0) {
      console.log('[YouTube] Using captured data:', existing.length, 'cues');
      return existing;
    }

    // 2. Wait briefly for auto-trigger capture (interceptor may be clicking CC)
    const passiveCues = await this.waitForPassiveCapture(lang, 2000);
    if (passiveCues.length > 0) {
      return passiveCues;
    }

    // 3. Direct fetch via baseUrl (includes POT tokens, fetched in MAIN world)
    console.log('[YouTube] Trying direct fetch via baseUrl for:', lang);
    const directCues = await this.fetchSubtitlesDirectly(trackId, lang);
    if (directCues.length > 0) {
      return directCues;
    }

    // 4. Fall back to CC toggle via interceptor
    console.log('[YouTube] Direct fetch failed, triggering CC toggle for:', lang);
    const cues = await this.fetchSubtitlesViaInterceptor(lang);
    if (cues.length > 0) {
      return cues;
    }

    // 5. Retry: wait for YouTube data to settle, then try direct fetch + interceptor once more
    console.log('[YouTube] All strategies failed, retrying after delay...');
    await new Promise(r => setTimeout(r, 3000));

    const retryCues = await this.fetchSubtitlesDirectly(trackId, lang);
    if (retryCues.length > 0) {
      return retryCues;
    }

    return this.fetchSubtitlesViaInterceptor(lang);
  }

  /**
   * Fetch subtitles directly using the baseUrl from captionTracks.
   * The baseUrl includes POT tokens and signature — fetched in MAIN world
   * via background executeScript so it has the right cookies/origin.
   */
  private async fetchSubtitlesDirectly(trackId: string, lang: string): Promise<SubtitleCue[]> {
    const rawTrack = this.rawTrackData.get(trackId);
    if (!rawTrack?.baseUrl) {
      console.log('[YouTube] No baseUrl for track:', trackId);
      return [];
    }

    try {
      // Replace fmt param via regex — URL() re-encoding breaks YouTube's auth tokens
      let url = rawTrack.baseUrl;
      if (/[?&]fmt=/.test(url)) {
        url = url.replace(/([?&]fmt=)[^&]*/, '$1json3');
      } else {
        url += (url.includes('?') ? '&' : '?') + 'fmt=json3';
      }

      console.log('[YouTube] Direct fetching:', lang, '(' + url.substring(0, 80) + '...)');
      const response = await chrome.runtime.sendMessage({
        type: 'FETCH_YT_SUBTITLES',
        payload: { url },
      });

      if (response.success && response.data?.text) {
        const text = response.data.text;
        const cues = this.parseJson3(text);
        if (cues.length > 0) {
          console.log('[YouTube] Direct fetch got', cues.length, 'cues for', lang);
          this.interceptedCaptions.set(lang, cues);
          return cues;
        }
        console.log('[YouTube] Direct fetch returned data but 0 parsed cues');
      } else {
        console.log('[YouTube] Direct fetch failed:', response.error || 'empty response');
      }
    } catch (e) {
      console.warn('[YouTube] Direct fetch error:', e);
    }

    return [];
  }

  /**
   * Wait for passively intercepted data (captured by early-inject.js).
   */
  private async waitForPassiveCapture(lang: string, timeoutMs: number): Promise<SubtitleCue[]> {
    return new Promise<SubtitleCue[]>((resolve) => {
      // Check immediately
      const existing = this.interceptedCaptions.get(lang);
      if (existing && existing.length > 0) {
        resolve(existing);
        return;
      }

      // Set up resolver for when data arrives
      this.captionResolvers.set(lang, resolve);

      setTimeout(() => {
        if (this.captionResolvers.has(lang)) {
          this.captionResolvers.delete(lang);
          // Check one more time
          const late = this.interceptedCaptions.get(lang);
          resolve(late && late.length > 0 ? late : []);
        }
      }, timeoutMs);
    });
  }

  /**
   * Trigger CC toggle to force YouTube to fetch captions for a specific track.
   * Used when switching tracks or when passive capture didn't get the language we need.
   */
  private async fetchSubtitlesViaInterceptor(lang: string): Promise<SubtitleCue[]> {
    const captionPromise = new Promise<SubtitleCue[]>((resolve) => {
      this.captionResolvers.set(lang, resolve);
      // 25s timeout — allows time for the interceptor's settings menu fallback
      // which takes ~12s (8s initial CC toggle wait + ~4s menu navigation)
      setTimeout(() => {
        if (this.captionResolvers.has(lang)) {
          this.captionResolvers.delete(lang);
          console.warn('[YouTube] Interceptor timeout for:', lang);
          resolve([]);
        }
      }, 25000);
    });

    console.log('[YouTube] Requesting interceptor caption fetch for:', lang);
    window.dispatchEvent(
      new CustomEvent('tong-request-captions', { detail: { lang } })
    );

    const cues = await captionPromise;
    console.log('[YouTube] Interceptor got', cues.length, 'cues');
    return cues;
  }

  private parseJson3(jsonText: string): SubtitleCue[] {
    try {
      const data = JSON.parse(jsonText);
      return (data.events || [])
        .filter((e: any) => e.segs && e.tStartMs !== undefined)
        .map((e: any, i: number) => ({
          id: `cue-${i}`,
          startTime: e.tStartMs,
          endTime: e.tStartMs + (e.dDurationMs || 0),
          text: e.segs.map((s: any) => s.utf8 || '').join('').trim(),
        }))
        .filter((c: any) => c.text);
    } catch (e) {
      console.error('[YouTube] Error parsing json3:', e);
      return [];
    }
  }

  private parseXml(xmlText: string): SubtitleCue[] {
    try {
      const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
      return Array.from(doc.querySelectorAll('text')).map((el, i) => {
        const start = parseFloat(el.getAttribute('start') || '0') * 1000;
        const dur = parseFloat(el.getAttribute('dur') || '0') * 1000;
        const textarea = document.createElement('textarea');
        textarea.innerHTML = el.textContent || '';
        return {
          id: `cue-${i}`,
          startTime: start,
          endTime: start + dur,
          text: textarea.value.trim(),
        };
      }).filter(c => c.text);
    } catch (e) {
      console.error('[YouTube] Error parsing XML:', e);
      return [];
    }
  }

  /**
   * Get languages for which we already have intercepted caption data.
   * Used by the overlay to prefer tracks that already have data available.
   */
  getInterceptedLanguages(): string[] {
    return [...this.interceptedCaptions.keys()].filter(
      lang => (this.interceptedCaptions.get(lang)?.length ?? 0) > 0
    );
  }

  getOverlayContainer(): HTMLElement | null {
    return document.querySelector('#movie_player') || document.querySelector('.html5-video-container');
  }

  onTimeUpdate(callback: (time: number) => void): () => void {
    this.timeUpdateCallbacks.add(callback);
    return () => this.timeUpdateCallbacks.delete(callback);
  }

  onPlaybackRateChange(callback: (rate: number) => void): () => void {
    this.rateChangeCallbacks.add(callback);
    return () => this.rateChangeCallbacks.delete(callback);
  }

  onCaptionsReceived(callback: (lang: string, cues: SubtitleCue[]) => void): () => void {
    this.captionListeners.add(callback);
    return () => this.captionListeners.delete(callback);
  }

  getPlaybackState(): PlaybackState {
    return {
      currentTime: (this.video?.currentTime || 0) * 1000,
      playbackRate: this.video?.playbackRate || 1,
      isPlaying: this.video ? !this.video.paused : false,
      isFullscreen: document.fullscreenElement !== null,
    };
  }
}
