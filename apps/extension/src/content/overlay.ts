/**
 * Subtitle overlay component
 * Renders karaoke-style subtitles on top of video
 */

import type { SubtitleCue, UserPreferences } from '@tong/core';
import { syncWithPlayback, highlightCurrentWord } from '@tong/subtitles';
import { romanizeWithSegments, toRomanizedKorean } from '@tong/romanization';
import type { PlatformAdapter, SubtitleTrackInfo } from './adapters/types';

/** A space-delimited word mapped to its karaoke character indices */
interface WordGroup {
  word: string;
  charIndices: number[];
  romanization: string;
}

/** Character breakdown entry for CJK characters */
interface CharacterBreakdownEntry {
  character: string;
  pinyin?: string;
  hangul?: string;
  japaneseOn?: string[];
  japaneseKun?: string[];
  definition?: string;
  decomposition?: string;
  etymology?: { type: string; hint?: string };
  simplified?: string;
  traditional?: string;
}

/** Cached result from dictionary lookup */
interface WordLookupResult {
  word: string;
  romanization: string;
  translation: string;
  dictEntries: Array<{ pos: string; terms: string[] }>;
  definitions: Array<{ pos: string; meaning: string; example?: string }>;
  examples: string[];
  contextSentence: string;
  characterBreakdown?: CharacterBreakdownEntry[];
  hanja?: { characters: string; perCharacter: CharacterBreakdownEntry[] };
  learningVariant?: string; // word converted to user's learning variant (simplified/traditional)
}

export class SubtitleOverlay {
  private video: HTMLVideoElement;
  private adapter: PlatformAdapter;
  private container: HTMLElement | null = null;
  private subtitleElement: HTMLElement | null = null;

  private cues: SubtitleCue[] = [];
  private processedCues: SubtitleCue[] = [];
  private preferences: UserPreferences | null = null;
  private isVisible = true;
  private detectedLanguage: string | null = null;
  private translationGeneration = 0;
  private availableTracks: SubtitleTrackInfo[] = [];
  private selectedTrackId: string | null = null;

  private unsubscribeTimeUpdate: (() => void) | null = null;
  private unsubscribeRateChange: (() => void) | null = null;
  private unsubscribeCaptions: (() => void) | null = null;

  // Cached icon URL (avoid calling chrome.runtime.getURL on every frame)
  private iconUrl: string = '';
  private contextValid = true;

  // Tooltip state
  private tooltipElement: HTMLElement | null = null;
  private dictionaryCache: Map<string, WordLookupResult> = new Map();
  private currentHoveredGroupIdx: number | null = null;
  private currentWordGroups: WordGroup[] = [];
  private lastRenderedCueId: string | null = null;
  private hideTooltipTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(video: HTMLVideoElement, adapter: PlatformAdapter) {
    this.video = video;
    this.adapter = adapter;
    // Cache extension URLs at construction time (before context can invalidate)
    try {
      this.iconUrl = chrome.runtime.getURL('icons/icon16.png');
    } catch {
      this.iconUrl = '';
      this.contextValid = false;
    }
  }

  async init() {
    // Load preferences
    await this.loadPreferences();

    // Create overlay elements
    this.createOverlay();

    // Load subtitles
    await this.loadSubtitles();

    // Start synchronization
    this.startSync();

    console.log('[Overlay] Initialized');
  }

  private async loadPreferences() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_PREFERENCES' });
      if (response.success) {
        this.preferences = response.data;
      }
    } catch (error) {
      console.warn('[Overlay] Error loading preferences:', error);
      // Fallback: try to read from chrome.storage directly (works even after extension reload)
      try {
        const stored = await chrome.storage.local.get('preferences');
        if (stored.preferences) {
          this.preferences = stored.preferences;
          console.log('[Overlay] Using preferences from storage fallback');
        }
      } catch {
        // Extension context fully invalidated — use sensible defaults
        console.warn('[Overlay] Using default preferences');
        this.contextValid = false;
      }
    }
  }

  private createOverlay() {
    const container = this.adapter.getOverlayContainer();
    if (!container) {
      console.error('[Overlay] Container not found');
      return;
    }

    this.container = container;

    // Create subtitle container
    this.subtitleElement = document.createElement('div');
    this.subtitleElement.id = 'tong-subtitle-overlay';
    this.subtitleElement.className = 'tong-overlay';

    // Apply styles
    this.applyStyles();

    // Insert into page
    container.appendChild(this.subtitleElement);

    // Create tooltip (persistent, outside subtitleElement so it survives innerHTML rebuilds)
    this.createTooltipElement();

    // Set up hover listeners for dictionary tooltip
    this.setupTooltipListeners();

    console.log('[Overlay] Created overlay element');
  }

  private applyStyles() {
    if (!this.subtitleElement) return;

    const prefs = this.preferences?.subtitles;

    Object.assign(this.subtitleElement.style, {
      position: 'absolute',
      bottom: prefs?.position === 'top' ? 'auto' : '90px',
      top: prefs?.position === 'top' ? '10%' : 'auto',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '9999',
      textAlign: 'center',
      pointerEvents: 'none',
      maxWidth: '85%',
      width: 'auto',
      fontFamily: prefs?.fontFamily || 'system-ui, -apple-system, "Segoe UI", sans-serif',
      fontSize: `${prefs?.fontSize || 24}px`,
      color: prefs?.textColor || '#ffffff',
      textShadow: '0 1px 4px rgba(0, 0, 0, 0.8), 0 0 2px rgba(0, 0, 0, 0.6)',
      lineHeight: '1.4',
      padding: '0',
      opacity: '0',
      transition: 'opacity 0.15s ease',
    });
  }

  private async loadSubtitles() {
    try {
      const tracks = await this.adapter.getSubtitleTracks();
      console.log('[Overlay] Available tracks:', tracks);
      this.availableTracks = tracks;

      if (tracks.length === 0) {
        console.log('[Overlay] No subtitle tracks available');
        return;
      }

      // Find best track — strongly prefer the user's LEARNING LANGUAGE.
      // Strategy: exhaust ALL quality tiers for the target language first,
      // then fall back to other CJK languages. This prevents e.g. a
      // Japanese manual track being chosen over a Korean auto-generated
      // track when the user is learning Korean.
      // Quality tiers (best → worst):
      //   1) Intercepted, non-auto    2) Intercepted, any
      //   3) Default, non-auto        4) Default, any
      //   5) Non-auto (manual upload) 6) Auto-generated
      // If no CJK track found, don't show overlay at all.
      const targetLang = this.preferences?.languages?.primaryTarget;
      const cjkLangs = ['ko', 'ja', 'zh', 'zh-Hans', 'zh-Hant'];
      const isCJK = (lang: string) => cjkLangs.some(c => lang === c || lang.startsWith(c + '-'));
      const targetIsCJK = targetLang ? isCJK(targetLang) : false;
      const isTarget = (lang: string) => targetLang ? (lang === targetLang || lang.startsWith(targetLang + '-')) : false;

      // Check what the interceptor has already captured (if adapter supports it)
      const interceptedLangs = 'getInterceptedLanguages' in this.adapter
        ? (this.adapter as any).getInterceptedLanguages() as string[]
        : [];
      const hasIntercepted = (lang: string) => interceptedLangs.some(
        il => il === lang || il.startsWith(lang + '-') || lang.startsWith(il + '-')
      );

      console.log('[Overlay] Track selection: targetLang=', targetLang, 'intercepted=', interceptedLangs);

      let selectedTrack =
        // ── Phase 1: Try TARGET language across all quality tiers ──
        (targetIsCJK && tracks.find((t) => isTarget(t.language) && hasIntercepted(t.language) && !t.isAutoGenerated)) ||
        (targetIsCJK && tracks.find((t) => isTarget(t.language) && hasIntercepted(t.language))) ||
        (targetIsCJK && tracks.find((t) => isTarget(t.language) && t.isDefault && !t.isAutoGenerated)) ||
        (targetIsCJK && tracks.find((t) => isTarget(t.language) && t.isDefault)) ||
        (targetIsCJK && tracks.find((t) => isTarget(t.language) && !t.isAutoGenerated)) ||
        (targetIsCJK && tracks.find((t) => isTarget(t.language))) ||
        // ── Phase 2: Fall back to ANY CJK language across all quality tiers ──
        tracks.find((t) => isCJK(t.language) && hasIntercepted(t.language) && !t.isAutoGenerated) ||
        tracks.find((t) => isCJK(t.language) && hasIntercepted(t.language)) ||
        tracks.find((t) => isCJK(t.language) && t.isDefault && !t.isAutoGenerated) ||
        tracks.find((t) => isCJK(t.language) && t.isDefault) ||
        tracks.find((t) => isCJK(t.language) && !t.isAutoGenerated) ||
        tracks.find((t) => isCJK(t.language)) ||
        null;

      if (!selectedTrack) {
        console.log('[Tong] No CJK captions found — overlay disabled');
        return;
      }

      console.log('[Overlay] Selected track:', selectedTrack);
      this.selectedTrackId = selectedTrack.id;

      // Load subtitles
      this.cues = await this.adapter.getSubtitles(selectedTrack.id);
      console.log('[Overlay] Loaded', this.cues.length, 'cues');

      // Use track language as primary source for CJK; text detection as fallback
      const trackLang = selectedTrack.language || null;
      const textDetected = this.detectLanguageFromText(this.cues);
      const trackIsCJK = trackLang && ['ko', 'ja', 'zh'].some(c => trackLang === c || trackLang.startsWith(c + '-'));
      this.detectedLanguage = trackIsCJK ? trackLang : (textDetected || trackLang);
      console.log('[Overlay] Track language:', trackLang, '→ detected from text:', textDetected, '→ using:', this.detectedLanguage);

      // Use cues immediately so overlay works right away
      this.processedCues = [...this.cues];
      console.log('[Overlay] Ready to display (romanization will happen lazily)');

      // Romanize in background without blocking display
      this.processSubtitlesLazy();

      // If we got 0 cues, subscribe to late-arriving captions
      if (this.cues.length === 0) {
        this.subscribeToLateCaptions();
      }
    } catch (error) {
      console.error('[Overlay] Error loading subtitles:', error);
    }
  }

  /**
   * Detect language from actual subtitle text content.
   * Samples up to 20 cues and checks for script-specific characters.
   * Returns null if undetermined (falls back to track metadata).
   */
  private detectLanguageFromText(cues: SubtitleCue[]): string | null {
    if (cues.length === 0) return null;

    // Sample text from first 20 cues
    const sample = cues.slice(0, 20).map(c => c.text).join('');
    if (sample.length === 0) return null;

    // Count script-specific characters
    const hangulCount = (sample.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g) || []).length;
    const kanaCount = (sample.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length;
    const hanCount = (sample.match(/[\u4E00-\u9FFF\u3400-\u4DBF]/g) || []).length;
    const totalCJK = hangulCount + kanaCount + hanCount;

    if (totalCJK === 0) return null;

    // Korean: has Hangul syllables
    if (hangulCount > 0 && hangulCount >= kanaCount) {
      return 'ko';
    }

    // Japanese: has Hiragana/Katakana (even if also has Kanji)
    if (kanaCount > 0) {
      return 'ja';
    }

    // Chinese: only Han characters (no Hangul, no Kana)
    if (hanCount > 0) {
      return 'zh';
    }

    return null;
  }

  private subscribeToLateCaptions() {
    if (!this.adapter.onCaptionsReceived) return;

    // Unsubscribe previous listener if any
    this.unsubscribeCaptions?.();

    console.log('[Overlay] Subscribing to late-arriving captions...');
    this.unsubscribeCaptions = this.adapter.onCaptionsReceived((_lang, cues) => {
      if (cues.length === 0) return;
      // Only accept if we don't already have cues
      if (this.cues.length > 0) return;

      // Validate that late captions are CJK — skip non-CJK
      const textDetected = this.detectLanguageFromText(cues);
      if (!textDetected) {
        console.log('[Tong] Late captions are not CJK — skipping');
        return;
      }

      console.log('[Overlay] Late captions received:', cues.length, 'cues');
      this.cues = cues;
      this.processedCues = [...cues];

      this.detectedLanguage = textDetected;
      console.log('[Overlay] Late captions language detected:', textDetected);

      this.processSubtitlesLazy();

      // Unsubscribe after receiving
      this.unsubscribeCaptions?.();
      this.unsubscribeCaptions = null;
    });
  }

  /**
   * Romanize subtitles lazily in small batches without blocking the display.
   */
  private async processSubtitlesLazy() {
    const BATCH_SIZE = 10;
    let processed = 0;

    for (let i = 0; i < this.cues.length; i += BATCH_SIZE) {
      const batch = this.cues.slice(i, i + BATCH_SIZE);

      for (let batchIdx = 0; batchIdx < batch.length; batchIdx++) {
        const cue = batch[batchIdx];
        const idx = i + batchIdx;
        const hasCJK = /[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(cue.text);
        if (!hasCJK || cue.romanization) continue;

        try {
          const result = romanizeWithSegments(cue.text);
          const words = this.generateWordsWithSegments(cue, result.segments || []);
          this.processedCues[idx] = {
            ...cue,
            romanization: result.romanized || cue.text,
            words,
          };
          processed++;
        } catch {
          // Romanization failed, keep original cue
        }
      }

      // Yield to let the UI render between batches
      if (i + BATCH_SIZE < this.cues.length) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    if (processed > 0) {
      console.log('[Overlay] Romanized', processed, '/', this.cues.length, 'cues');
    }

    // Translation happens on-demand as cues are displayed (see translateCueOnDemand)
  }

  /**
   * Translate a specific cue immediately (on-demand).
   * Used when the current/upcoming cue doesn't have a translation yet.
   * Returns the cue index so the caller can check if it's still relevant.
   */
  private onDemandInFlight = new Set<number>();

  private async translateCueOnDemand(cueIndex: number): Promise<void> {
    if (cueIndex < 0 || cueIndex >= this.processedCues.length) return;
    if (this.processedCues[cueIndex].translation) return;
    if (this.onDemandInFlight.has(cueIndex)) return;

    const sourceLang = this.detectedLanguage || 'auto';
    const targetLang = this.preferences?.languages?.translationLanguage || 'en';

    if (sourceLang === targetLang) return;

    this.onDemandInFlight.add(cueIndex);

    try {
      const translatedText = await this.translateText(
        this.processedCues[cueIndex].text, sourceLang, targetLang
      );

      if (translatedText && !this.processedCues[cueIndex].translation) {
        const trimmed = translatedText.trim();
        // Skip if Google returned the same text (didn't actually translate)
        if (trimmed && trimmed !== this.processedCues[cueIndex].text.trim()) {
          this.processedCues[cueIndex] = {
            ...this.processedCues[cueIndex],
            translation: trimmed,
          };
        }
      }
    } catch {
      // Silently fail — background translation will retry
    } finally {
      this.onDemandInFlight.delete(cueIndex);
    }
  }

  // Rate-limit backoff — separate counters for subtitle lines vs tooltip lookups.
  // Tooltip lookups fire many requests per hover and hit rate limits first.
  // Subtitle line translations are essential (1 request per cue) and shouldn't be blocked by tooltip rate limits.
  private subtitleBackoffUntil = 0;
  private subtitleBackoffMs = 2000; // starts at 2s, caps at 15s
  private tooltipBackoffUntil = 0;
  private tooltipBackoffMs = 5000; // starts at 5s, caps at 60s

  /**
   * Fetch a Google Translate API URL via the background service worker.
   * This avoids CORS issues since the service worker has host_permissions.
   * Includes rate-limit detection and exponential backoff.
   * @param priority 'subtitle' for essential subtitle line translations, 'tooltip' for hover lookups
   */
  private async fetchGoogleTranslate(url: string, priority: 'subtitle' | 'tooltip' = 'tooltip'): Promise<any | null> {
    const now = Date.now();
    const backoffUntil = priority === 'subtitle' ? this.subtitleBackoffUntil : this.tooltipBackoffUntil;

    // Respect backoff — silently skip
    if (now < backoffUntil) {
      return null;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GOOGLE_TRANSLATE',
        payload: { url },
      });

      if (response?.success) {
        // Success — reset backoff for this priority
        if (priority === 'subtitle') {
          this.subtitleBackoffMs = 2000;
        } else {
          this.tooltipBackoffMs = 5000;
        }
        return response.data;
      }

      // Rate-limited — exponential backoff (separate per priority)
      if (response?.error === 'RATE_LIMITED') {
        if (priority === 'subtitle') {
          console.warn(`[Overlay] Subtitle translation rate-limited, retrying in ${this.subtitleBackoffMs / 1000}s`);
          this.subtitleBackoffUntil = now + this.subtitleBackoffMs;
          this.subtitleBackoffMs = Math.min(this.subtitleBackoffMs * 2, 15000);
        } else {
          console.warn(`[Overlay] Tooltip lookup rate-limited, retrying in ${this.tooltipBackoffMs / 1000}s`);
          this.tooltipBackoffUntil = now + this.tooltipBackoffMs;
          this.tooltipBackoffMs = Math.min(this.tooltipBackoffMs * 2, 60000);
        }
        return null;
      }

      return null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Translate text using Google Translate free API (routed through background).
   */
  private async translateText(text: string, sourceLang: string, targetLang: string): Promise<string | null> {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sourceLang)}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
    const data = await this.fetchGoogleTranslate(url, 'subtitle');
    if (!data || !data[0]) return null;

    return data[0]
      .filter((segment: unknown) => Array.isArray(segment) && segment[0])
      .map((segment: unknown[]) => segment[0])
      .join('');
  }

  private generateWordsWithSegments(
    cue: SubtitleCue,
    segments: Array<{ text: string; reading: string; type: string }>
  ): import('@tong/core').WordTiming[] {
    const duration = cue.endTime - cue.startTime;

    // If we have segments from romanization, use them
    if (segments && segments.length > 0) {
      const words: import('@tong/core').WordTiming[] = [];
      const segmentDuration = duration / segments.length;

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const needsRomanization = segment.type === 'cjk';

        words.push({
          word: segment.text,
          startTime: cue.startTime + i * segmentDuration,
          endTime: cue.startTime + (i + 1) * segmentDuration,
          romanization: needsRomanization ? segment.reading : undefined,
        });
      }

      return words;
    }

    // Fallback: generate words without segment data
    return this.generateWordsWithRomanization(cue);
  }

  private splitIntoSegments(text: string): string[] {
    const segments: string[] = [];
    let currentSegment = '';
    let lastWasCJK = false;

    for (const char of text) {
      const isCJK = /[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(char);
      const isWhitespace = /\s/.test(char);

      if (isCJK) {
        if (currentSegment && !lastWasCJK) {
          segments.push(currentSegment.trim());
          currentSegment = '';
        }
        if (currentSegment) {
          segments.push(currentSegment);
          currentSegment = '';
        }
        segments.push(char);
        lastWasCJK = true;
      } else if (isWhitespace) {
        if (currentSegment) {
          segments.push(currentSegment.trim());
          currentSegment = '';
        }
        lastWasCJK = false;
      } else {
        if (lastWasCJK && currentSegment) {
          segments.push(currentSegment);
          currentSegment = '';
        }
        currentSegment += char;
        lastWasCJK = false;
      }
    }

    if (currentSegment.trim()) {
      segments.push(currentSegment.trim());
    }

    return segments.filter(s => s.length > 0);
  }

  private generateWordsWithRomanization(cue: SubtitleCue): import('@tong/core').WordTiming[] {
    const text = cue.text;
    const duration = cue.endTime - cue.startTime;

    // Split text into segments
    const segments = this.splitIntoSegments(text);
    if (segments.length === 0) return [];

    // Calculate timing for each segment
    const segmentDuration = duration / segments.length;

    // Try to use cue.romanization to extract per-word romanization
    const fullRomanization = cue.romanization || '';
    const romanizationSegments = fullRomanization ? this.splitIntoSegments(fullRomanization) : [];

    const words: import('@tong/core').WordTiming[] = [];

    for (let i = 0; i < segments.length; i++) {
      const word = segments[i];
      const romanization = romanizationSegments[i] || this.getRomanizationForWord(word);

      words.push({
        word,
        startTime: cue.startTime + i * segmentDuration,
        endTime: cue.startTime + (i + 1) * segmentDuration,
        romanization,
      });
    }

    return words;
  }

  private getRomanizationForWord(word: string): string | undefined {
    // Check if word needs romanization
    const hasCJK = /[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(word);
    if (!hasCJK) {
      return undefined;
    }

    // Use local romanization (synchronous fallback)
    // This is a simple heuristic - proper romanization happens at the cue level
    return undefined; // Will be populated from cue.romanization
  }

  private startSync() {
    this.unsubscribeTimeUpdate = this.adapter.onTimeUpdate((time) => {
      this.updateDisplay(time);
    });

    this.unsubscribeRateChange = this.adapter.onPlaybackRateChange((rate) => {
      console.log('[Overlay] Playback rate changed:', rate);
    });
  }

  private updateDisplay(currentTime: number) {
    if (!this.subtitleElement || !this.isVisible) return;

    // Stop the sync loop if the extension context has been invalidated
    if (!this.contextValid) {
      this.unsubscribeTimeUpdate?.();
      this.unsubscribeRateChange?.();
      return;
    }

    const state = this.adapter.getPlaybackState();
    const syncResult = syncWithPlayback(this.processedCues, {
      currentTime,
      playbackRate: state.playbackRate,
      isPlaying: state.isPlaying,
    });

    if (!syncResult.currentCue) {
      this.subtitleElement.style.opacity = '0';
      // Hide tooltip when no cue visible
      if (this.lastRenderedCueId !== null) {
        this.lastRenderedCueId = null;
        this.hideTooltip();
      }
      return;
    }
    this.subtitleElement.style.opacity = '1';

    // Hide tooltip when cue changes (word no longer on screen)
    if (syncResult.currentCue.id !== this.lastRenderedCueId) {
      this.hideTooltip();
    }

    // On-demand translation: if current cue (or next few) lack translations, translate them now
    const showTranslation = this.preferences?.subtitles?.showTranslation ?? true;
    if (showTranslation && syncResult.currentIndex >= 0) {
      const LOOK_AHEAD = 3;
      for (let i = 0; i <= LOOK_AHEAD; i++) {
        this.translateCueOnDemand(syncResult.currentIndex + i);
      }
    }

    // Get karaoke state
    const karaokeState = highlightCurrentWord(syncResult.currentCue, currentTime);

    // Render subtitle
    this.renderSubtitle(syncResult.currentCue, karaokeState);
  }

  private renderSubtitle(cue: SubtitleCue, karaokeState: ReturnType<typeof highlightCurrentWord>) {
    if (!this.subtitleElement) return;

    const prefs = this.preferences?.subtitles;
    const karaokeEnabled = prefs?.karaokeEnabled ?? true;
    const showOriginal = prefs?.showOriginal ?? true;
    const showRomanization = prefs?.showRomanization ?? true;
    const showTranslation = prefs?.showTranslation ?? true;
    const highlightColor = prefs?.karaokeHighlightColor || '#fbbf24';

    // Nothing to show at all
    if (!showOriginal && !showRomanization && !showTranslation) {
      this.subtitleElement.innerHTML = '';
      return;
    }

    // Compute word groups for this cue (maps karaoke chars → space-delimited words)
    this.currentWordGroups = this.computeWordGroups(cue, karaokeState.words);
    this.lastRenderedCueId = cue.id;

    // Build a lookup: karaoke char index → word group index
    const charToGroup = new Map<number, number>();
    this.currentWordGroups.forEach((group, groupIdx) => {
      group.charIndices.forEach((charIdx) => charToGroup.set(charIdx, groupIdx));
    });

    let html = '';

    // Outer wrapper: subtitle content
    html += `<div style="display: inline-flex; align-items: flex-end; background: rgba(0,0,0,0.72); backdrop-filter: blur(6px); padding: 8px 16px; border-radius: 6px; box-shadow: 0 2px 12px rgba(0,0,0,0.4);">`;
    html += '<div style="text-align: center;">';

    if (showOriginal && karaokeEnabled && karaokeState.words.length > 0 && showRomanization) {
      // Karaoke + romanization: two-row per word (original text + romanization above)
      html += '<div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 2px 6px;">';

      karaokeState.words.forEach((wordState, charIdx) => {
        const rom = wordState.romanization || '';
        const wordColor = wordState.isHighlighted
          ? highlightColor
          : wordState.isPast ? 'rgba(255,255,255,0.5)' : '#fff';
        const weight = wordState.isHighlighted ? 'bold' : 'normal';

        const groupIdx = charToGroup.get(charIdx);
        const groupWord = groupIdx !== undefined ? this.currentWordGroups[groupIdx]?.word : '';
        const groupAttr = groupIdx !== undefined
          ? ` data-word-group="${groupIdx}" data-word="${this.escapeAttr(groupWord)}"`
          : '';

        html += `<div style="display: inline-flex; flex-direction: column; align-items: center; pointer-events: auto; cursor: pointer;"${groupAttr}>`;

        if (rom && rom !== wordState.word) {
          html += `<span style="font-size: 0.55em; color: rgba(255,255,255,0.6); line-height: 1.1; letter-spacing: 0.3px;">${this.escapeHtml(rom)}</span>`;
        }

        html += `<span style="color: ${wordColor}; font-weight: ${weight}; transition: color 0.1s;">${this.escapeHtml(wordState.word)}</span>`;
        html += '</div>';
      });

      html += '</div>';
    } else if (showOriginal && karaokeEnabled && karaokeState.words.length > 0) {
      // Karaoke without per-word romanization — original text with highlight
      karaokeState.words.forEach((word, charIdx) => {
        const style = word.isHighlighted
          ? `color: ${highlightColor}; font-weight: bold;`
          : word.isPast ? 'color: rgba(255,255,255,0.5);' : '';

        const groupIdx = charToGroup.get(charIdx);
        const groupWord = groupIdx !== undefined ? this.currentWordGroups[groupIdx]?.word : '';
        const groupAttr = groupIdx !== undefined
          ? ` data-word-group="${groupIdx}" data-word="${this.escapeAttr(groupWord)}"`
          : '';

        html += `<span style="${style} transition: color 0.1s; pointer-events: auto; cursor: pointer;"${groupAttr}>${this.escapeHtml(word.word)}</span>`;
      });

      if (showRomanization && cue.romanization) {
        html += `<div style="font-size: 0.65em; color: rgba(255,255,255,0.55); margin-top: 3px;">${this.escapeHtml(cue.romanization)}</div>`;
      }
    } else if (showOriginal) {
      // Simple mode — original text
      html += `<span>${this.escapeHtml(cue.text)}</span>`;

      if (showRomanization && cue.romanization) {
        html += `<div style="font-size: 0.65em; color: rgba(255,255,255,0.55); margin-top: 3px;">${this.escapeHtml(cue.romanization)}</div>`;
      }
    } else if (!showOriginal && showRomanization) {
      // No original text — show romanization as the primary line
      if (cue.romanization) {
        html += `<span style="font-size: 1em; color: rgba(255,255,255,0.85);">${this.escapeHtml(cue.romanization)}</span>`;
      } else {
        // Fallback: build romanization from karaoke word data
        const rom = karaokeState.words
          .map((w) => w.romanization || w.word)
          .join(' ');
        html += `<span style="font-size: 1em; color: rgba(255,255,255,0.85);">${this.escapeHtml(rom)}</span>`;
      }
    }

    // Translation line
    if (showTranslation && cue.translation) {
      html += `<div style="font-size: 0.8em; color: rgba(255,255,255,0.7); margin-top: 4px; font-style: italic;">${this.escapeHtml(cue.translation)}</div>`;
    }

    html += '</div></div>';

    this.subtitleElement.innerHTML = html;

    // Re-apply word group highlight if tooltip is showing (elements were rebuilt by innerHTML)
    if (this.currentHoveredGroupIdx !== null) {
      this.highlightWordGroup(this.currentHoveredGroupIdx);
      this.positionTooltip(this.currentHoveredGroupIdx);
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private escapeAttr(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * Convert ALL-CAPS romaji (from unihan on'yomi) to katakana.
   * E.g., "GEN" → "ゲン", "ZAI" → "ザイ", "SHI" → "シ"
   */
  private romajiToKatakana(romaji: string): string {
    const map: Record<string, string> = {
      // Compound syllables (match longest first)
      sha: 'シャ', shi: 'シ', shu: 'シュ', sho: 'ショ',
      cha: 'チャ', chi: 'チ', chu: 'チュ', cho: 'チョ',
      tsu: 'ツ',
      kya: 'キャ', kyu: 'キュ', kyo: 'キョ',
      nya: 'ニャ', nyu: 'ニュ', nyo: 'ニョ',
      hya: 'ヒャ', hyu: 'ヒュ', hyo: 'ヒョ',
      mya: 'ミャ', myu: 'ミュ', myo: 'ミョ',
      rya: 'リャ', ryu: 'リュ', ryo: 'リョ',
      gya: 'ギャ', gyu: 'ギュ', gyo: 'ギョ',
      bya: 'ビャ', byu: 'ビュ', byo: 'ビョ',
      pya: 'ピャ', pyu: 'ピュ', pyo: 'ピョ',
      ja: 'ジャ', ju: 'ジュ', jo: 'ジョ',
      // Basic syllables
      ka: 'カ', ki: 'キ', ku: 'ク', ke: 'ケ', ko: 'コ',
      sa: 'サ', si: 'シ', su: 'ス', se: 'セ', so: 'ソ',
      ta: 'タ', ti: 'チ', tu: 'ツ', te: 'テ', to: 'ト',
      na: 'ナ', ni: 'ニ', nu: 'ヌ', ne: 'ネ', no: 'ノ',
      ha: 'ハ', hi: 'ヒ', fu: 'フ', hu: 'フ', he: 'ヘ', ho: 'ホ',
      ma: 'マ', mi: 'ミ', mu: 'ム', me: 'メ', mo: 'モ',
      ya: 'ヤ', yu: 'ユ', yo: 'ヨ',
      ra: 'ラ', ri: 'リ', ru: 'ル', re: 'レ', ro: 'ロ',
      wa: 'ワ', wi: 'ヰ', we: 'ヱ', wo: 'ヲ',
      ga: 'ガ', gi: 'ギ', gu: 'グ', ge: 'ゲ', go: 'ゴ',
      za: 'ザ', ji: 'ジ', zu: 'ズ', ze: 'ゼ', zo: 'ゾ',
      da: 'ダ', di: 'ヂ', du: 'ヅ', de: 'デ', do: 'ド',
      ba: 'バ', bi: 'ビ', bu: 'ブ', be: 'ベ', bo: 'ボ',
      pa: 'パ', pi: 'ピ', pu: 'プ', pe: 'ペ', po: 'ポ',
      // Vowels
      a: 'ア', i: 'イ', u: 'ウ', e: 'エ', o: 'オ',
      // Nasal
      n: 'ン',
    };

    const input = romaji.toLowerCase();
    let result = '';
    let i = 0;
    while (i < input.length) {
      let matched = false;
      // Try 3-char, then 2-char, then 1-char matches
      for (const len of [3, 2, 1]) {
        const chunk = input.slice(i, i + len);
        if (map[chunk]) {
          // Handle 'n' before a vowel or 'y' — it's part of the next syllable, not ン
          if (chunk === 'n' && i + 1 < input.length) {
            const next = input[i + 1];
            if ('aiueoy'.includes(next)) {
              continue; // skip 1-char 'n', let 2-char match handle 'na', 'ni', etc.
            }
          }
          result += map[chunk];
          i += len;
          matched = true;
          break;
        }
      }
      if (!matched) {
        // Double consonant → ッ
        if (i + 1 < input.length && input[i] === input[i + 1] && input[i] !== 'n') {
          result += 'ッ';
          i++;
        } else {
          i++; // skip unknown char
        }
      }
    }
    return result;
  }

  toggle(): boolean {
    this.isVisible = !this.isVisible;
    if (this.subtitleElement) {
      this.subtitleElement.style.display = this.isVisible ? 'block' : 'none';
    }
    if (this.tooltipElement) {
      this.tooltipElement.style.display = this.isVisible ? '' : 'none';
    }
    if (!this.isVisible) {
      this.hideTooltip();
    }
    return this.isVisible;
  }

  getIsVisible(): boolean {
    return this.isVisible;
  }

  getAvailableTracks(): SubtitleTrackInfo[] {
    return this.availableTracks;
  }

  getDetectedLanguage(): string | null {
    return this.detectedLanguage;
  }

  getSelectedTrackId(): string | null {
    return this.selectedTrackId;
  }

  getCueCount(): number {
    return this.cues.length;
  }

  async reloadSubtitles() {
    this.cues = [];
    this.processedCues = [];
    this.unsubscribeCaptions?.();
    this.unsubscribeCaptions = null;
    await this.loadSubtitles();
  }

  /**
   * Switch to a different subtitle track by ID. Reloads cues and re-processes.
   * Preserves visibility state and cleans up stale data.
   */
  async switchTrack(trackId: string): Promise<void> {
    const track = this.availableTracks.find(t => t.id === trackId);
    if (!track) {
      console.warn('[Overlay] Track not found:', trackId);
      return;
    }

    console.log('[Overlay] Switching to track:', track.label, '(' + track.language + ')');
    this.selectedTrackId = trackId;

    // Clear existing state but preserve visibility
    this.hideTooltip();
    this.dictionaryCache.clear();
    this.onDemandInFlight.clear();
    this.translationGeneration++;
    this.unsubscribeCaptions?.();
    this.unsubscribeCaptions = null;

    // Load new cues
    this.cues = await this.adapter.getSubtitles(trackId);
    console.log('[Overlay] Loaded', this.cues.length, 'cues from new track');

    // Use track language as primary for CJK; text detection as fallback
    const trackLang = track.language || null;
    const textDetected = this.detectLanguageFromText(this.cues);
    const trackIsCJK = trackLang && ['ko', 'ja', 'zh'].some(c => trackLang === c || trackLang.startsWith(c + '-'));
    this.detectedLanguage = trackIsCJK ? trackLang : (textDetected || trackLang);
    console.log('[Overlay] Language after track switch:', this.detectedLanguage);

    // Re-process
    this.processedCues = [...this.cues];
    this.processSubtitlesLazy();

    // If 0 cues, subscribe to late-arriving captions (interceptor may still be working)
    if (this.cues.length === 0) {
      this.subscribeToLateCaptions();
    }

    // Force re-render at current time (important when paused — no timeupdate events)
    this.forceRender();
  }

  /**
   * Force a render at the current video time.
   * Used after track switch or preference changes when the video may be paused.
   */
  private forceRender() {
    const state = this.adapter.getPlaybackState();
    this.updateDisplay(state.currentTime);
  }

  async updatePreferences() {
    const oldTranslationLang = this.preferences?.languages?.translationLanguage;
    const oldPrimaryTarget = this.preferences?.languages?.primaryTarget;
    const wasVisible = this.isVisible;

    await this.loadPreferences();
    this.applyStyles();

    // Restore visibility — preference changes should NOT hide the overlay
    if (this.isVisible !== wasVisible) {
      this.isVisible = wasVisible;
    }

    const newPrimaryTarget = this.preferences?.languages?.primaryTarget;
    const newTranslationLang = this.preferences?.languages?.translationLanguage;

    // If learning language changed, try to find a matching track and reload
    if (newPrimaryTarget && newPrimaryTarget !== oldPrimaryTarget && this.availableTracks.length > 0) {
      const matchingTrack = this.availableTracks.find(
        t => t.language === newPrimaryTarget && !t.isAutoGenerated
      ) || this.availableTracks.find(
        t => t.language === newPrimaryTarget
      );

      if (matchingTrack && matchingTrack.id !== this.selectedTrackId) {
        console.log('[Overlay] Learning language changed to', newPrimaryTarget, '→ switching track');
        await this.switchTrack(matchingTrack.id);
        return; // switchTrack already handles re-translation
      }
    }

    // Re-translate if translation language changed — clear cached translations
    // so on-demand translation picks up the new language
    if (newTranslationLang && newTranslationLang !== oldTranslationLang && this.processedCues.length > 0) {
      this.onDemandInFlight.clear();
      this.translationGeneration++;
      for (let i = 0; i < this.processedCues.length; i++) {
        this.processedCues[i] = { ...this.processedCues[i], translation: undefined };
      }
      this.dictionaryCache.clear();
      this.hideTooltip();
      this.forceRender();
    }
  }

  // ── Word Group Computation ───────────────────────────────────────

  /**
   * Map karaoke character indices to space-delimited words from cue.text.
   * Korean has spaces between words; Chinese/Japanese use Intl.Segmenter.
   */
  private computeWordGroups(
    cue: SubtitleCue,
    karaokeWords: Array<{ word: string; romanization?: string }>
  ): WordGroup[] {
    const lang = this.detectedLanguage || 'ko';
    let textWords: string[];

    if (lang === 'ja' || lang === 'zh' || lang.startsWith('zh-')) {
      textWords = this.segmentCJKText(cue.text, lang);
    } else {
      textWords = cue.text.split(/\s+/).filter((w) => w.length > 0);
    }

    if (textWords.length === 0 || karaokeWords.length === 0) return [];

    const groups: WordGroup[] = [];
    let charIdx = 0;

    for (const textWord of textWords) {
      const group: WordGroup = { word: textWord, charIndices: [], romanization: '' };
      let consumed = '';

      // Walk through karaoke chars, consuming until we've matched the full text word
      while (charIdx < karaokeWords.length && consumed.length < textWord.length) {
        const karaokeChar = karaokeWords[charIdx].word;

        // Skip whitespace-only karaoke entries
        if (/^\s+$/.test(karaokeChar)) {
          charIdx++;
          continue;
        }

        // Check if this karaoke char is part of the current text word
        const remaining = textWord.slice(consumed.length);
        if (remaining.startsWith(karaokeChar)) {
          group.charIndices.push(charIdx);
          consumed += karaokeChar;
          charIdx++;
        } else if (karaokeChar.startsWith(remaining)) {
          // Karaoke char contains more than the remaining text (shouldn't happen often)
          group.charIndices.push(charIdx);
          consumed += remaining;
          charIdx++;
        } else {
          // Mismatch — skip this karaoke char (punctuation mismatch, etc.)
          group.charIndices.push(charIdx);
          consumed += karaokeChar;
          charIdx++;
        }
      }

      // Build romanization from constituent karaoke chars
      group.romanization = group.charIndices
        .map((i) => karaokeWords[i]?.romanization || '')
        .filter(Boolean)
        .join('');

      if (group.charIndices.length > 0) {
        groups.push(group);
      }
    }

    // If there are leftover karaoke chars not assigned, create individual groups
    while (charIdx < karaokeWords.length) {
      const kw = karaokeWords[charIdx];
      if (!/^\s+$/.test(kw.word)) {
        groups.push({
          word: kw.word,
          charIndices: [charIdx],
          romanization: kw.romanization || '',
        });
      }
      charIdx++;
    }

    return groups;
  }

  /**
   * Segment CJK text into words using Intl.Segmenter (Chrome 87+).
   * Falls back to space-split if Segmenter is unavailable.
   */
  private segmentCJKText(text: string, language: string): string[] {
    try {
      const segmenter = new Intl.Segmenter(language, { granularity: 'word' });
      return [...segmenter.segment(text)]
        .filter(s => s.isWordLike)
        .map(s => s.segment);
    } catch {
      return text.split(/\s+/).filter(w => w.length > 0);
    }
  }

  // ── Tooltip Element ────────────────────────────────────────────

  private createTooltipElement() {
    if (!this.container) return;

    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'tong-tooltip';
    this.container.appendChild(this.tooltipElement);
  }

  // ── Tooltip Event Delegation ───────────────────────────────────

  private setupTooltipListeners() {
    if (!this.subtitleElement) return;

    this.subtitleElement.addEventListener('mouseover', (e) => {
      const target = (e.target as HTMLElement).closest?.('[data-word-group]') as HTMLElement | null;
      if (!target) return;

      // Cancel pending hide
      if (this.hideTooltipTimeout) {
        clearTimeout(this.hideTooltipTimeout);
        this.hideTooltipTimeout = null;
      }

      const groupIdx = parseInt(target.getAttribute('data-word-group') || '-1', 10);
      if (groupIdx < 0 || groupIdx >= this.currentWordGroups.length) return;

      // Already showing this group
      if (this.currentHoveredGroupIdx === groupIdx) return;

      this.showTooltip(groupIdx);
    });

    this.subtitleElement.addEventListener('mouseout', (e) => {
      const related = (e as MouseEvent).relatedTarget as HTMLElement | null;

      // Check if moving to another char in the same group or to the tooltip
      if (related) {
        const groupEl = related.closest?.('[data-word-group]') as HTMLElement | null;
        if (groupEl) {
          const relGroupIdx = parseInt(groupEl.getAttribute('data-word-group') || '-1', 10);
          if (relGroupIdx === this.currentHoveredGroupIdx) return;
        }
        // Check if moving to tooltip
        if (this.tooltipElement?.contains(related)) return;
      }

      // Debounce hide — 400ms gives user time to move mouse to the tooltip
      this.hideTooltipTimeout = setTimeout(() => {
        this.hideTooltip();
      }, 400);
    });

    // Also hide if leaving the tooltip itself
    if (this.tooltipElement) {
      this.tooltipElement.addEventListener('mouseenter', () => {
        if (this.hideTooltipTimeout) {
          clearTimeout(this.hideTooltipTimeout);
          this.hideTooltipTimeout = null;
        }
      });

      this.tooltipElement.addEventListener('mouseleave', () => {
        this.hideTooltipTimeout = setTimeout(() => {
          this.hideTooltip();
        }, 300);
      });

    }
  }

  // ── Tooltip Lifecycle ──────────────────────────────────────────

  private showTooltip(groupIdx: number) {
    if (!this.tooltipElement) return;

    const group = this.currentWordGroups[groupIdx];
    if (!group) return;

    this.currentHoveredGroupIdx = groupIdx;

    // Highlight all chars in the group
    this.highlightWordGroup(groupIdx);

    // Show loading state immediately
    this.tooltipElement.innerHTML = `
      <div class="tong-tooltip-header">
        <span class="tong-tooltip-word">${this.escapeHtml(group.word)}</span>
        ${group.romanization ? `<span class="tong-tooltip-romanization">${this.escapeHtml(group.romanization)}</span>` : ''}
      </div>
      <div class="tong-tooltip-loading">Looking up...</div>
    `;
    this.tooltipElement.classList.add('visible');

    // Position above the word group
    this.positionTooltip(groupIdx);

    // Fire async lookup — strip punctuation for better dict results
    const srcLang = this.detectedLanguage || 'auto';
    const tgtLang = this.preferences?.languages?.translationLanguage || 'en';
    const lookupWord = group.word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') || group.word;
    this.lookupWord(lookupWord, srcLang, tgtLang).then((result) => {
      // Only update if still hovering the same group
      if (this.currentHoveredGroupIdx !== groupIdx) return;
      this.renderTooltipContent(result, group);
      this.positionTooltip(groupIdx);
    });
  }

  private hideTooltip() {
    if (this.hideTooltipTimeout) {
      clearTimeout(this.hideTooltipTimeout);
      this.hideTooltipTimeout = null;
    }

    this.clearWordGroupHighlight();
    this.currentHoveredGroupIdx = null;

    if (this.tooltipElement) {
      this.tooltipElement.classList.remove('visible');
    }
  }

  // ── Tooltip Positioning ────────────────────────────────────────

  private positionTooltip(groupIdx: number) {
    if (!this.tooltipElement || !this.subtitleElement || !this.container) return;

    const group = this.currentWordGroups[groupIdx];
    if (!group || group.charIndices.length === 0) return;

    // Get bounding rects of all chars in the group
    const charEls = this.subtitleElement.querySelectorAll(`[data-word-group="${groupIdx}"]`);
    if (charEls.length === 0) return;

    // Compute union bounding rect
    let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
    const containerRect = this.container.getBoundingClientRect();

    charEls.forEach((el) => {
      const rect = el.getBoundingClientRect();
      minLeft = Math.min(minLeft, rect.left);
      minTop = Math.min(minTop, rect.top);
      maxRight = Math.max(maxRight, rect.right);
      maxBottom = Math.max(maxBottom, rect.bottom);
    });

    // Tooltip dimensions
    const tooltipRect = this.tooltipElement.getBoundingClientRect();
    const tooltipWidth = tooltipRect.width;
    const tooltipHeight = tooltipRect.height;

    // Center horizontally above the word group
    const groupCenterX = (minLeft + maxRight) / 2;
    let left = groupCenterX - tooltipWidth / 2 - containerRect.left;
    const gap = 8;
    let top = minTop - containerRect.top - tooltipHeight - gap;

    // Flip below if would overflow top
    if (minTop - tooltipHeight - gap < 0) {
      top = maxBottom - containerRect.top + gap;
    }

    // Clamp horizontally within container
    left = Math.max(4, Math.min(left, containerRect.width - tooltipWidth - 4));

    this.tooltipElement.style.left = `${left}px`;
    this.tooltipElement.style.top = `${top}px`;
  }

  // ── Word Group Highlight ───────────────────────────────────────

  private highlightWordGroup(groupIdx: number) {
    if (!this.subtitleElement) return;

    // Clear any previous highlight
    this.clearWordGroupHighlight();

    const charEls = this.subtitleElement.querySelectorAll(`[data-word-group="${groupIdx}"]`);
    charEls.forEach((el) => {
      (el as HTMLElement).style.background = 'rgba(251, 191, 36, 0.25)';
      (el as HTMLElement).style.borderRadius = '3px';
    });
  }

  private clearWordGroupHighlight() {
    if (!this.subtitleElement) return;

    const highlighted = this.subtitleElement.querySelectorAll('[data-word-group]');
    highlighted.forEach((el) => {
      (el as HTMLElement).style.background = '';
      (el as HTMLElement).style.borderRadius = '';
    });
  }

  // ── Dictionary Lookup ──────────────────────────────────────────

  private async lookupWord(word: string, srcLang: string, tgtLang: string): Promise<WordLookupResult> {
    const cacheKey = `${word}:${srcLang}:${tgtLang}`;
    const cached = this.dictionaryCache.get(cacheKey);
    if (cached) return cached;

    const result: WordLookupResult = {
      word,
      romanization: '',
      translation: '',
      dictEntries: [],
      definitions: [],
      examples: [],
      contextSentence: this.lastRenderedCueId
        ? (this.processedCues.find((c) => c.id === this.lastRenderedCueId)?.text || '')
        : '',
    };

    try {
      // STRATEGY: Fetch tl=en for richest POS/dict/definitions/examples.
      // Then fetch tl=userLang for translation + dict entries in their language.
      // Finally, translate all remaining English content to user's language.
      const needsSeparateTranslation = tgtLang !== 'en';

      // Fetch 1: English target for rich dictionary data (POS, definitions, examples)
      const enrichUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(srcLang)}&tl=en&dt=t&dt=bd&dt=md&dt=ex&dt=ss&dt=at&q=${encodeURIComponent(word)}`;
      let enData: any = await this.fetchGoogleTranslate(enrichUrl);

      if (enData) {
        this.parseGoogleTranslateResponse(enData, result);
        // Debug: log what Google gave us
        console.log('[Overlay] Dict lookup for "' + word + '":', {
          translation: result.translation,
          dictEntries: result.dictEntries.length,
          definitions: result.definitions.length,
          examples: result.examples.length,
          hasData13: !!(enData[13]),
          hasData12: !!(enData[12]),
          rawExamples: enData[13]?.[0]?.slice(0, 3),
        });
      }

      // Fetch 2: User's language for translation + dict entries
      if (needsSeparateTranslation) {
        const transUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(srcLang)}&tl=${encodeURIComponent(tgtLang)}&dt=t&dt=bd&dt=ex&dt=md&q=${encodeURIComponent(word)}`;
        const transData = await this.fetchGoogleTranslate(transUrl);

        if (transData) {

          // Override translation with user's language
          if (transData[0]) {
            result.translation = transData[0]
              .filter((seg: unknown) => Array.isArray(seg) && seg[0])
              .map((seg: unknown[]) => seg[0])
              .join('');
          }

          // Use dict entries from user's language
          if (transData[1] && Array.isArray(transData[1])) {
            const userEntries = transData[1]
              .filter((entry: unknown) => Array.isArray(entry) && entry[0] && Array.isArray(entry[1]))
              .map((entry: unknown[]) => ({
                pos: this.translatePOS(String(entry[0]), tgtLang),
                terms: (entry[1] as string[]).slice(0, 5),
              }));
            if (userEntries.length > 0) {
              result.dictEntries = userEntries;
            }
          }

          // Also check for examples in user's language
          if (transData[13] && Array.isArray(transData[13]) && Array.isArray(transData[13][0])) {
            const userExamples: string[] = [];
            for (const ex of transData[13][0]) {
              if (Array.isArray(ex) && ex[0]) {
                userExamples.push(String(ex[0]).replace(/<\/?b>/g, ''));
                if (userExamples.length >= 5) break;
              }
            }
            if (userExamples.length > 0) {
              result.examples = userExamples;
            }
          }
        }
      }

      // Translate dict entry terms + POS labels to user's language
      // (Google may not have bilingual dict for all language pairs like ko→zh)
      if (needsSeparateTranslation && result.dictEntries.length > 0) {
        const allTerms = result.dictEntries.flatMap(e => e.terms);
        // Check if terms are in English (not already in user's language)
        const looksEnglish = allTerms.some(t => /^[a-zA-Z\s,'-]+$/.test(t));
        if (looksEnglish && allTerms.length > 0) {
          try {
            const termsUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(tgtLang)}&dt=t&q=${encodeURIComponent(allTerms.join('\n'))}`;
            const termsData = await this.fetchGoogleTranslate(termsUrl);
            if (termsData?.[0]) {
              const translated = termsData[0]
                .filter((seg: unknown) => Array.isArray(seg) && seg[0])
                .map((seg: unknown[]) => String(seg[0]))
                .join('');
              const translatedTerms = translated.split('\n');
              let idx = 0;
              result.dictEntries = result.dictEntries.map(e => ({
                pos: this.translatePOS(e.pos, tgtLang),
                terms: e.terms.map(() => translatedTerms[idx++] || e.terms[idx - 1] || ''),
              }));
            }
          } catch { /* keep English terms */ }
        } else {
          result.dictEntries = result.dictEntries.map(e => ({
            ...e,
            pos: this.translatePOS(e.pos, tgtLang),
          }));
        }
      }

      // Translate definitions to user's language (they came from en fetch)
      if (needsSeparateTranslation && result.definitions.length > 0) {
        const defsToTranslate = result.definitions.slice(0, 3)
          .map(d => d.meaning).join('\n');
        try {
          const defUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(tgtLang)}&dt=t&q=${encodeURIComponent(defsToTranslate)}`;
          const defData = await this.fetchGoogleTranslate(defUrl);
          if (defData?.[0]) {
            const translated = defData[0]
              .filter((seg: unknown) => Array.isArray(seg) && seg[0])
              .map((seg: unknown[]) => String(seg[0]))
              .join('');
            const lines = translated.split('\n');
            for (let i = 0; i < Math.min(lines.length, result.definitions.length); i++) {
              result.definitions[i] = {
                ...result.definitions[i],
                pos: this.translatePOS(result.definitions[i].pos, tgtLang),
                meaning: lines[i] || result.definitions[i].meaning,
              };
            }
          }
        } catch { /* keep English definitions */ }
      }

      // Pull definition examples as fallback if no dt=ex examples
      if (result.examples.length === 0 && result.definitions.length > 0) {
        for (const def of result.definitions) {
          if (def.example && result.examples.length < 5) {
            result.examples.push(def.example);
          }
        }
      }

      // Translate examples to user's display language
      if (result.examples.length > 0) {
        const exToTranslate = result.examples.slice(0, 4);
        const exTgtLang = needsSeparateTranslation ? tgtLang : 'en';
        // Examples from dt=ex are in the SOURCE (learning) language — translate them
        const exSrcLang = this.detectedLanguage || srcLang;
        if (exSrcLang !== exTgtLang) {
          const exText = exToTranslate.join('\n');
          try {
            const exUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(exSrcLang)}&tl=${encodeURIComponent(exTgtLang)}&dt=t&q=${encodeURIComponent(exText)}`;
            const exData = await this.fetchGoogleTranslate(exUrl);
            if (exData?.[0]) {
              const translated = exData[0]
                .filter((seg: unknown) => Array.isArray(seg) && seg[0])
                .map((seg: unknown[]) => String(seg[0]))
                .join('');
              const translatedLines = translated.split('\n');
              result.examples = exToTranslate.map((ex, i) =>
                translatedLines[i] ? `${ex}\n→ ${translatedLines[i]}` : ex
              );
            }
          } catch { /* keep untranslated */ }
        }
      }

      // CJK character enrichment — add character breakdown for words containing Han characters
      const hasCJK = /[\u4E00-\u9FFF]/.test(word);
      if (hasCJK) {
        try {
          const { lookupHanzi } = await import('@tong/cjk-data');
          const chars = [...word].filter(c => /[\u4E00-\u9FFF]/.test(c));
          const lookups = await Promise.all(chars.map(c => lookupHanzi(c)));
          result.characterBreakdown = lookups
            .filter((r): r is NonNullable<typeof r> => r !== null)
            .map(r => ({
              character: r.character,
              pinyin: r.pinyin?.[0] || r.mandarin,
              hangul: r.hangul,
              japaneseOn: r.japaneseOn,
              japaneseKun: r.japaneseKun,
              definition: r.definition,
              decomposition: r.decomposition,
              etymology: r.etymology ? { type: r.etymology.type, hint: r.etymology.hint } : undefined,
              simplified: r.simplified,
              traditional: r.traditional,
            }));
        } catch (e) {
          console.warn('[Overlay] CJK enrichment failed:', e);
        }
      }

      // Chinese character enrichment for Korean words
      // Shows the Chinese equivalent so learners see Han character connections across CJK
      if (srcLang === 'ko') {
        try {
          const { lookupHanja, lookupHanzi } = await import('@tong/cjk-data');

          const mapCharData = (r: NonNullable<Awaited<ReturnType<typeof lookupHanzi>>>) => ({
            character: r.character,
            pinyin: r.pinyin?.[0] || r.mandarin,
            hangul: r.hangul,
            japaneseOn: r.japaneseOn,
            japaneseKun: r.japaneseKun,
            definition: r.definition,
            decomposition: r.decomposition,
            etymology: r.etymology ? { type: r.etymology.type, hint: r.etymology.hint } : undefined,
            simplified: r.simplified,
            traditional: r.traditional,
          });

          // Try exact kengdic match first (correct for sino-Korean words like 시간→時間)
          const entry = await lookupHanja(word);
          if (entry) {
            const hanjaChars = [...entry.hanja].filter(c => /[\u4E00-\u9FFF]/.test(c));
            const perChar = await Promise.all(hanjaChars.map(c => lookupHanzi(c)));
            result.hanja = {
              characters: entry.hanja,
              perCharacter: perChar
                .filter((r): r is NonNullable<typeof r> => r !== null)
                .map(mapCharData),
            };
          } else {
            // No kengdic match — translate to Chinese to find the real equivalent
            try {
              const zhUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=zh-CN&dt=t&q=${encodeURIComponent(word)}`;
              const zhData = await this.fetchGoogleTranslate(zhUrl);
              const zhWord = zhData?.[0]?.[0]?.[0] as string | undefined;
              if (zhWord) {
                const cjkChars = [...zhWord].filter(c => /[\u4E00-\u9FFF]/.test(c));
                if (cjkChars.length > 0) {
                  const perChar = await Promise.all(cjkChars.map(c => lookupHanzi(c)));
                  const mapped = perChar
                    .filter((r): r is NonNullable<typeof r> => r !== null)
                    .map(mapCharData);
                  if (mapped.length > 0) {
                    result.hanja = {
                      characters: zhWord,
                      perCharacter: mapped,
                    };
                  }
                }
              }
            } catch { /* no Chinese equivalent found */ }
          }
        } catch (e) {
          console.warn('[Overlay] Chinese enrichment failed:', e);
        }
      }

      // Learning variant — convert word to user's preferred Chinese variant
      const learningLang = this.preferences?.languages?.primaryTarget || '';
      const hasCJKForVariant = /[\u4E00-\u9FFF]/.test(word);
      if (hasCJKForVariant && (learningLang === 'zh' || learningLang === 'zh-TW')) {
        try {
          const { toSimplified, toTraditional } = await import('@tong/cjk-data');
          const converted = learningLang === 'zh'
            ? await toSimplified(word)
            : await toTraditional(word);
          if (converted !== word) {
            result.learningVariant = converted;
          }
        } catch (e) {
          console.warn('[Overlay] Variant conversion failed:', e);
        }
      }
    } catch (err) {
      console.warn('[Overlay] Dictionary lookup failed:', err);
    }

    this.dictionaryCache.set(cacheKey, result);
    return result;
  }

  /**
   * Translate English POS labels to the user's language.
   */
  private translatePOS(pos: string, lang: string): string {
    if (!pos) return '';
    const lower = pos.toLowerCase();

    const posMap: Record<string, Record<string, string>> = {
      zh: {
        'noun': '名词', 'verb': '动词', 'adjective': '形容词', 'adverb': '副词',
        'pronoun': '代词', 'preposition': '介词', 'conjunction': '连词',
        'interjection': '感叹词', 'particle': '助词', 'determiner': '限定词',
        'numeral': '数词', 'suffix': '后缀', 'prefix': '前缀',
        'exclamation': '感叹词', 'abbreviation': '缩写',
      },
      ko: {
        'noun': '명사', 'verb': '동사', 'adjective': '형용사', 'adverb': '부사',
        'pronoun': '대명사', 'preposition': '전치사', 'conjunction': '접속사',
        'interjection': '감탄사', 'particle': '조사', 'determiner': '관형사',
        'numeral': '수사', 'suffix': '접미사', 'prefix': '접두사',
        'exclamation': '감탄사', 'abbreviation': '약어',
      },
      ja: {
        'noun': '名詞', 'verb': '動詞', 'adjective': '形容詞', 'adverb': '副詞',
        'pronoun': '代名詞', 'preposition': '前置詞', 'conjunction': '接続詞',
        'interjection': '感動詞', 'particle': '助詞', 'determiner': '限定詞',
        'numeral': '数詞', 'suffix': '接尾辞', 'prefix': '接頭辞',
        'exclamation': '感動詞', 'abbreviation': '略語',
      },
    };

    const base = lang.split('-')[0];
    const map = posMap[base] || posMap[lang];
    if (map) return map[lower] || pos;
    return pos;
  }

  /**
   * Parse Google Translate API response into WordLookupResult fields.
   */
  private parseGoogleTranslateResponse(data: any, result: WordLookupResult) {
    // data[0] → translation segments
    if (data[0]) {
      result.translation = data[0]
        .filter((seg: unknown) => Array.isArray(seg) && seg[0])
        .map((seg: unknown[]) => seg[0])
        .join('');
    }

    // data[1] → bilingual dictionary entries
    if (data[1] && Array.isArray(data[1])) {
      result.dictEntries = data[1]
        .filter((entry: unknown) => Array.isArray(entry) && entry[0] && Array.isArray(entry[1]))
        .map((entry: unknown[]) => ({
          pos: String(entry[0]),
          terms: (entry[1] as string[]).slice(0, 5),
        }));
    }

    // data[5] → alternative translations (fallback)
    if (result.dictEntries.length === 0 && data[5] && Array.isArray(data[5])) {
      for (const group of data[5]) {
        if (!Array.isArray(group) || !group[2] || !Array.isArray(group[2])) continue;
        const alts = group[2]
          .filter((a: unknown) => Array.isArray(a) && a[0])
          .map((a: unknown[]) => String(a[0]))
          .slice(0, 5);
        if (alts.length > 0) {
          result.dictEntries.push({ pos: '', terms: alts });
        }
      }
    }

    // data[11] → synonyms
    if (data[11] && Array.isArray(data[11]) && result.dictEntries.length < 2) {
      for (const group of data[11]) {
        if (!Array.isArray(group) || !Array.isArray(group[1])) continue;
        const pos = group[0] ? String(group[0]) : '';
        for (const synGroup of group[1]) {
          if (!Array.isArray(synGroup)) continue;
          const syns = synGroup.filter((s: unknown) => typeof s === 'string').slice(0, 4);
          if (syns.length > 0 && !result.dictEntries.some(e => e.pos === pos)) {
            result.dictEntries.push({ pos, terms: syns as string[] });
          }
        }
      }
    }

    // data[12] → definitions
    if (data[12] && Array.isArray(data[12])) {
      for (const group of data[12]) {
        if (!Array.isArray(group) || !group[0] || !Array.isArray(group[1])) continue;
        const pos = String(group[0]);
        for (const def of group[1]) {
          if (!Array.isArray(def) || !def[0]) continue;
          result.definitions.push({
            pos,
            meaning: String(def[0]),
            example: def[1] ? String(def[1]) : undefined,
          });
        }
      }
    }

    // data[13] → examples (in source/learning language)
    if (data[13] && Array.isArray(data[13]) && Array.isArray(data[13][0])) {
      for (const ex of data[13][0]) {
        if (Array.isArray(ex) && ex[0]) {
          const clean = String(ex[0]).replace(/<\/?b>/g, '');
          result.examples.push(clean);
          if (result.examples.length >= 5) break;
        }
      }
    }

    // Romanization from data[0]
    if (data[0] && data[0][0] && data[0][0][3]) {
      result.romanization = String(data[0][0][3]);
    }
  }

  // ── Tooltip Content Rendering ──────────────────────────────────

  /**
   * Get localized labels for tooltip sections based on translation language.
   */
  private getTooltipLabels(lang: string): Record<string, string> {
    const labels: Record<string, Record<string, string>> = {
      en: { synonyms: 'Synonyms', definitions: 'Definitions', examples: 'Examples', characters: 'Characters', hanja: 'Chinese' },
      zh: { synonyms: '同义词', definitions: '释义', examples: '例句', characters: '字形分析', hanja: '汉字' },
      ko: { synonyms: '유의어', definitions: '정의', examples: '예문', characters: '한자분석', hanja: '한자' },
      ja: { synonyms: '類義語', definitions: '定義', examples: '例文', characters: '字形分析', hanja: '漢字' },
    };
    const base = lang.split('-')[0];
    return labels[base] || labels[lang] || labels.en;
  }

  private renderTooltipContent(lookup: WordLookupResult, group: WordGroup) {
    if (!this.tooltipElement) return;

    const rom = lookup.romanization || group.romanization;
    const tgtLang = this.preferences?.languages?.translationLanguage || 'en';
    const srcLang = this.detectedLanguage || 'ko';
    const l = this.getTooltipLabels(tgtLang);

    // Determine the primary POS label from dictEntries or definitions
    const posLabel = lookup.dictEntries[0]?.pos || lookup.definitions[0]?.pos || '';

    let html = '';

    // Header: word + romanization + POS badge
    html += '<div class="tong-tooltip-header">';
    html += `<span class="tong-tooltip-word">${this.escapeHtml(lookup.word)}</span>`;
    if (lookup.learningVariant) {
      html += `<span class="tong-tooltip-variant">${this.escapeHtml(lookup.learningVariant)}</span>`;
    }
    if (rom) {
      html += `<span class="tong-tooltip-romanization">${this.escapeHtml(rom)}</span>`;
    }
    if (posLabel) {
      html += `<span class="tong-tooltip-pos-badge">${this.escapeHtml(posLabel)}</span>`;
    }
    html += '</div>';

    // Chinese equivalent line for Korean words (e.g., 시간 → 时间)
    if (lookup.hanja && lookup.hanja.perCharacter.length > 0) {
      const isTraditionalUser = tgtLang === 'zh-TW' || tgtLang === 'zh-HK';
      const traditional = lookup.hanja.characters;
      const simplified = lookup.hanja.perCharacter
        .map(c => c.simplified || c.character)
        .join('');

      let hanjaDisplay: string;
      if (isTraditionalUser) {
        // Traditional Chinese user: show traditional, with simplified in parens if different
        hanjaDisplay = simplified !== traditional ? `${traditional} (${simplified})` : traditional;
      } else {
        // Everyone else: show simplified Chinese first, traditional in parens if different
        hanjaDisplay = simplified !== traditional ? `${simplified} (${traditional})` : simplified;
      }
      html += `<div class="tong-tooltip-hanja-word">${this.escapeHtml(hanjaDisplay)}</div>`;
    }

    // Translation
    if (lookup.translation) {
      html += `<div class="tong-tooltip-translation">${this.escapeHtml(lookup.translation)}</div>`;
    }

    // Dictionary entries (synonyms)
    if (lookup.dictEntries.length > 0) {
      html += `<div class="tong-tooltip-examples-label">${l.synonyms}</div>`;
      for (const entry of lookup.dictEntries.slice(0, 3)) {
        html += '<div class="tong-tooltip-dict">';
        if (entry.pos && entry.pos !== posLabel) {
          html += `<span class="tong-tooltip-dict-pos">${this.escapeHtml(entry.pos)}:</span> `;
        }
        html += this.escapeHtml(entry.terms.join(', '));
        html += '</div>';
      }
    }

    // Definitions
    if (lookup.definitions.length > 0) {
      html += '<div class="tong-tooltip-defs">';
      html += `<div class="tong-tooltip-examples-label">${l.definitions}</div>`;
      for (const def of lookup.definitions.slice(0, 3)) {
        html += '<div class="tong-tooltip-def">';
        if (def.pos && def.pos !== posLabel) {
          html += `<span class="tong-tooltip-dict-pos">${this.escapeHtml(def.pos)}</span> `;
        }
        html += `<span>${this.escapeHtml(def.meaning)}</span>`;
        if (def.example) {
          html += `<div class="tong-tooltip-def-example">${this.escapeHtml(def.example)}</div>`;
        }
        html += '</div>';
      }
      html += '</div>';
    }

    // Usage examples
    if (lookup.examples.length > 0) {
      html += '<div class="tong-tooltip-examples">';
      html += `<div class="tong-tooltip-examples-label">${l.examples}</div>`;
      for (const ex of lookup.examples.slice(0, 4)) {
        const lines = ex.split('\n');
        const original = lines[0] || '';
        const translation = lines[1] || '';
        html += '<div class="tong-tooltip-example">';
        html += this.escapeHtml(original);
        if (translation) {
          html += `<div class="tong-tooltip-example-trans">${this.escapeHtml(translation)}</div>`;
        }
        html += '</div>';
      }
      html += '</div>';
    }

    // Character breakdown section — Hanja per-character or CJK character breakdown
    const charEntries = lookup.hanja?.perCharacter || lookup.characterBreakdown;
    if (charEntries && charEntries.length > 0) {
      html += '<div class="tong-tooltip-chars">';
      html += `<div class="tong-tooltip-examples-label">${srcLang === 'ko' ? l.hanja : l.characters}</div>`;
      for (const entry of charEntries) {
        html += '<div class="tong-tooltip-char-entry">';
        html += `<span class="tong-tooltip-char-glyph">${this.escapeHtml(entry.character)}</span>`;
        html += '<div class="tong-tooltip-char-details">';

        // Readings line: contextual — show source language reading first, then others
        // Helper: romanize Korean hangul for display
        const romanizeHangul = (h: string) => {
          try { const r = toRomanizedKorean(h, { lowercase: true }); return r && r !== h ? `${h} (${r})` : h; } catch { return h; }
        };
        // Helper: format Japanese on'yomi (stored as ALL-CAPS Latin) → katakana + romaji
        const fmtJpOn = (on: string) => {
          const kana = this.romajiToKatakana(on);
          const rom = on.toLowerCase();
          return kana ? `${kana} (${rom})` : rom;
        };

        const readings: string[] = [];
        const srcBase = srcLang.split('-')[0];

        // Primary reading: pinyin (Chinese) — the common thread for all Han characters
        if (entry.pinyin) readings.push(entry.pinyin);

        // Cross-language readings: show how this character is read in each CJK language
        if (entry.hangul) readings.push(`ko: ${romanizeHangul(entry.hangul)}`);
        if (entry.japaneseOn?.length) readings.push(`jp: ${fmtJpOn(entry.japaneseOn[0])}`);

        if (readings.length > 0) {
          html += `<div class="tong-tooltip-char-readings">${this.escapeHtml(readings.join('  '))}</div>`;
        }

        // Definition
        if (entry.definition) {
          html += `<div class="tong-tooltip-char-def">${this.escapeHtml(entry.definition)}</div>`;
        }

        // Decomposition + etymology
        if (entry.decomposition || entry.etymology?.hint) {
          const parts: string[] = [];
          if (entry.decomposition) parts.push(entry.decomposition);
          if (entry.etymology?.hint) parts.push(entry.etymology.hint);
          if (parts.length > 0) {
            html += `<div class="tong-tooltip-char-etym">${this.escapeHtml(parts.join(' — '))}</div>`;
          }
        }

        // Simplified/traditional variant
        if (entry.simplified && entry.simplified !== entry.character) {
          html += `<div class="tong-tooltip-char-etym">simplified: ${this.escapeHtml(entry.simplified)}</div>`;
        }
        if (entry.traditional && entry.traditional !== entry.character) {
          html += `<div class="tong-tooltip-char-etym">traditional: ${this.escapeHtml(entry.traditional)}</div>`;
        }

        html += '</div></div>';
      }
      html += '</div>';
    }

    // Context sentence with the word highlighted
    if (lookup.contextSentence) {
      const escaped = this.escapeHtml(lookup.contextSentence);
      const escapedWord = this.escapeHtml(lookup.word);
      const highlighted = escaped.replace(
        escapedWord,
        `<mark>${escapedWord}</mark>`
      );
      html += `<div class="tong-tooltip-context">${highlighted}</div>`;
    }

    this.tooltipElement.innerHTML = html;
  }

  destroy() {
    this.unsubscribeTimeUpdate?.();
    this.unsubscribeRateChange?.();
    this.unsubscribeCaptions?.();
    if (this.hideTooltipTimeout) clearTimeout(this.hideTooltipTimeout);
    this.tooltipElement?.remove();
    this.subtitleElement?.remove();
  }
}
