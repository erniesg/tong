/**
 * Message handling for background service worker
 */

import type { StorageManager } from './storage';
import type { ApiClient } from './api';

export type MessageType =
  | 'GET_PREFERENCES'
  | 'SET_PREFERENCES'
  | 'TRANSLATE'
  | 'ROMANIZE'
  | 'SAVE_VOCABULARY'
  | 'GET_VOCABULARY'
  | 'TOGGLE_OVERLAY'
  | 'GET_OVERLAY_STATE'
  | 'GET_TRACKS'
  | 'CHANGE_TRACK'
  | 'SYNC_STATE'
  | 'GET_YT_CAPTION_TRACKS'
  | 'FETCH_YT_SUBTITLES'
  | 'GOOGLE_TRANSLATE';

export interface Message {
  type: MessageType;
  payload?: unknown;
}

export interface MessageResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

export class MessageHandler {
  constructor(
    private storage: StorageManager,
    private api: ApiClient
  ) {}

  async handle(message: Message, sender: chrome.runtime.MessageSender): Promise<MessageResponse> {
    switch (message.type) {
      case 'GET_PREFERENCES':
        return this.getPreferences();

      case 'SET_PREFERENCES':
        return this.setPreferences(message.payload);

      case 'TRANSLATE':
        return this.translate(message.payload as { text: string; targetLang: string });

      case 'ROMANIZE':
        return this.romanize(message.payload as { text: string; language?: string });

      case 'GET_YT_CAPTION_TRACKS':
        return this.getYtCaptionTracks(sender);

      case 'FETCH_YT_SUBTITLES':
        return this.fetchYtSubtitles(sender, message.payload as { url: string });

      case 'GOOGLE_TRANSLATE':
        return this.googleTranslate(message.payload as { url: string });

      case 'SAVE_VOCABULARY':
        return this.saveVocabulary(message.payload);

      case 'GET_VOCABULARY':
        return this.getVocabulary(message.payload as { language?: string });

      default:
        return { success: false, error: `Unknown message type: ${message.type}` };
    }
  }

  /**
   * Use chrome.scripting.executeScript in the MAIN world to access
   * YouTube's page-level JS variables (ytInitialPlayerResponse).
   * This bypasses the content script's isolated world AND CSP restrictions.
   */
  private async getYtCaptionTracks(sender: chrome.runtime.MessageSender): Promise<MessageResponse> {
    const tabId = sender.tab?.id;
    if (!tabId) {
      return { success: false, error: 'No tab ID' };
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => {
          // This runs in YouTube's page context — can access window globals

          // Try player API first (most up-to-date, works on SPA navigation)
          const player = document.getElementById('movie_player') as any;
          if (player?.getPlayerResponse) {
            try {
              const resp = player.getPlayerResponse();
              if (resp?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
                return resp.captions.playerCaptionsTracklistRenderer.captionTracks;
              }
            } catch (e) { /* ignore */ }
          }

          // Fallback: ytInitialPlayerResponse (works on fresh page load)
          const pr = (window as any).ytInitialPlayerResponse;
          if (pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
            return pr.captions.playerCaptionsTracklistRenderer.captionTracks;
          }

          return null;
        },
      });

      const tracks = results?.[0]?.result;
      if (tracks && tracks.length > 0) {
        console.log('[Background] Got', tracks.length, 'caption tracks from MAIN world');
        return { success: true, data: tracks };
      }

      return { success: false, error: 'No caption tracks found' };
    } catch (error) {
      console.error('[Background] executeScript error:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Fetch subtitle data from YouTube's timedtext API via the MAIN world.
   * This ensures the request includes YouTube's cookies and origin.
   */
  private async fetchYtSubtitles(
    sender: chrome.runtime.MessageSender,
    payload: { url: string }
  ): Promise<MessageResponse> {
    const tabId = sender.tab?.id;
    if (!tabId) {
      return { success: false, error: 'No tab ID' };
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: async (fetchUrl: string) => {
          try {
            const response = await fetch(fetchUrl);
            return await response.text();
          } catch (e) {
            return null;
          }
        },
        args: [payload.url],
      });

      const text = results?.[0]?.result;
      if (text && text.length > 0) {
        console.log('[Background] Fetched subtitle data:', text.length, 'bytes');
        return { success: true, data: { text } };
      }

      return { success: false, error: 'Empty response from subtitle URL' };
    } catch (error) {
      console.error('[Background] executeScript fetch error:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Proxy Google Translate API requests from content scripts.
   * Background service worker has host_permissions so no CORS issues.
   * Catches rate-limit redirects to google.com/sorry (which cause CORS errors).
   */
  private async googleTranslate(payload: { url: string }): Promise<MessageResponse> {
    try {
      const response = await fetch(payload.url);
      if (response.status === 429) {
        return { success: false, error: 'RATE_LIMITED' };
      }

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      // Check if we got redirected to the sorry/CAPTCHA page
      if (response.url && response.url.includes('google.com/sorry')) {
        return { success: false, error: 'RATE_LIMITED' };
      }

      const text = await response.text();
      try {
        const data = JSON.parse(text);
        return { success: true, data };
      } catch {
        // Non-JSON response = probably a CAPTCHA page
        return { success: false, error: 'RATE_LIMITED' };
      }
    } catch (error) {
      const msg = (error as Error).message || '';
      // CORS or network errors from rate-limit redirect
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        return { success: false, error: 'RATE_LIMITED' };
      }
      return { success: false, error: msg };
    }
  }

  private async getPreferences(): Promise<MessageResponse> {
    try {
      const preferences = await this.storage.getPreferences();
      return { success: true, data: preferences };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private async setPreferences(payload: unknown): Promise<MessageResponse> {
    try {
      await this.storage.setPreferences(payload as Record<string, unknown>);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private async translate(payload: { text: string; targetLang: string }): Promise<MessageResponse> {
    try {
      const result = await this.api.translate(payload.text, payload.targetLang);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private async romanize(payload: { text: string; language?: string }): Promise<MessageResponse> {
    try {
      const result = await this.api.romanize(payload.text, payload.language);
      return {
        success: true,
        data: {
          ...result,
          source: 'api',
        },
      };
    } catch (error) {
      console.warn('[Background] API romanization failed, using local fallback:', error);

      try {
        const { romanizeWithSegments } = await import('@tong/romanization');
        const result = romanizeWithSegments(payload.text, {
          language: payload.language as 'zh' | 'ja' | 'ko' | undefined
        });

        const hasKanji = /[\u4E00-\u9FFF]/.test(payload.text);
        if (hasKanji && (payload.language === 'ja' || /[\u3040-\u309F\u30A0-\u30FF]/.test(payload.text))) {
          console.warn('[Background] Japanese kanji detected but API unavailable. Kanji will not be romanized.');
        }

        return {
          success: true,
          data: {
            romanized: result.romanized,
            segments: result.segments,
            source: 'local',
            kanjiNotConverted: hasKanji && payload.language === 'ja',
          },
        };
      } catch (fallbackError) {
        console.error('[Background] Local romanization failed:', fallbackError);
        return {
          success: true,
          data: {
            romanized: payload.text,
            segments: [],
            source: 'error',
          },
        };
      }
    }
  }

  private async saveVocabulary(payload: unknown): Promise<MessageResponse> {
    try {
      const result = await this.api.saveVocabulary(payload);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private async getVocabulary(payload: { language?: string }): Promise<MessageResponse> {
    try {
      const result = await this.api.getVocabulary(payload.language);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}
