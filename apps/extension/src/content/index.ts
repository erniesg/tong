/**
 * Tong Content Script
 * Injected into video pages to display subtitle overlay
 */

import { YouTubeAdapter } from './adapters/youtube';
import { SubtitleOverlay } from './overlay';
import type { PlatformAdapter } from './adapters/types';

class TongContent {
  private adapter: PlatformAdapter | null = null;
  private overlay: SubtitleOverlay | null = null;
  private currentVideoId: string | null = null;

  constructor() {
    // Register message listener immediately so popup can always reach us
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      this.handleMessage(message, sendResponse);
      return true;
    });

    this.init();
  }

  private async init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }

    // Handle YouTube SPA navigation
    document.addEventListener('yt-navigate-finish', () => {
      console.log('[Tong] YouTube SPA navigation detected');
      this.onNavigate();
    });

    // Also watch for URL changes via popstate
    window.addEventListener('popstate', () => {
      console.log('[Tong] popstate navigation detected');
      this.onNavigate();
    });
  }

  private async onNavigate() {
    // Check if we're on a watch page
    if (!window.location.pathname.startsWith('/watch')) {
      console.log('[Tong] Not a watch page, skipping');
      return;
    }

    // Check if video ID changed
    const newVideoId = new URL(window.location.href).searchParams.get('v');
    if (newVideoId === this.currentVideoId) {
      return;
    }

    console.log('[Tong] New video detected:', newVideoId);

    // Clean up old overlay
    this.overlay?.destroy();
    this.overlay = null;

    // Clear stale caption data from previous video
    if (this.adapter && 'resetForNewVideo' in this.adapter) {
      (this.adapter as any).resetForNewVideo();
    }

    // Small delay for YouTube to set up the new video's player data
    await new Promise((r) => setTimeout(r, 2000));

    // Reinitialize
    await this.setup();
  }

  private async setup() {
    console.log('[Tong] Content script initializing...');

    // Detect platform and create adapter
    this.adapter = this.detectPlatform();
    if (!this.adapter) {
      console.log('[Tong] Not a supported video platform');
      return;
    }

    this.currentVideoId = this.adapter.getVideoId();
    console.log('[Tong] Video ID:', this.currentVideoId);

    // Wait for video element
    const video = await this.adapter.waitForVideo();
    if (!video) {
      console.log('[Tong] Video element not found');
      return;
    }
    console.log('[Tong] Video element found');

    // Create subtitle overlay
    this.overlay = new SubtitleOverlay(video, this.adapter);
    await this.overlay.init();

    console.log('[Tong] Content script ready');

    // If overlay has no cues, schedule a retry
    if (this.overlay.getCueCount() === 0) {
      setTimeout(() => this.retrySubtitles(), 4000);
    }
  }

  private async retrySubtitles() {
    if (!this.overlay || this.overlay.getCueCount() > 0) return;
    console.log('[Tong] Retrying subtitle load...');
    await this.overlay.reloadSubtitles();
  }

  private detectPlatform(): PlatformAdapter | null {
    const url = window.location.href;

    if (url.includes('youtube.com')) {
      return new YouTubeAdapter();
    }

    return null;
  }

  private handleMessage(
    message: { type: string; payload?: unknown },
    sendResponse: (response: unknown) => void,
  ) {
    switch (message.type) {
      case 'TOGGLE_OVERLAY': {
        const isVisible = this.overlay?.toggle() ?? false;
        sendResponse({ success: true, data: { isVisible } });
        break;
      }

      case 'GET_OVERLAY_STATE':
        sendResponse({
          success: true,
          data: {
            isVisible: this.overlay?.getIsVisible() ?? false,
            hasOverlay: this.overlay !== null,
            detectedLanguage: this.overlay?.getDetectedLanguage() ?? null,
            selectedTrackId: this.overlay?.getSelectedTrackId() ?? null,
          },
        });
        break;

      case 'GET_TRACKS':
        sendResponse({
          success: true,
          data: {
            tracks: this.overlay?.getAvailableTracks() ?? [],
            selectedTrackId: this.overlay?.getSelectedTrackId() ?? null,
            detectedLanguage: this.overlay?.getDetectedLanguage() ?? null,
          },
        });
        break;

      case 'CHANGE_TRACK': {
        const trackId = (message.payload as { trackId: string })?.trackId;
        if (!trackId || !this.overlay) {
          sendResponse({ success: false, error: 'No track ID or overlay' });
          break;
        }
        this.overlay.switchTrack(trackId).then(() => {
          sendResponse({
            success: true,
            data: {
              detectedLanguage: this.overlay?.getDetectedLanguage() ?? null,
              selectedTrackId: trackId,
            },
          });
        });
        break;
      }

      case 'UPDATE_PREFERENCES':
        this.overlay?.updatePreferences();
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  }
}

// Initialize content script
new TongContent();
