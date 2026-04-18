import type { YouTubeWatchTelemetryRequest } from '@tong/core';
import type { PlatformAdapter } from './adapters/types';

interface OverlayStateSnapshot {
  detectedLanguage: string | null;
  selectedTrackId: string | null;
}

interface YouTubeWatchTelemetryReporterOptions {
  video: HTMLVideoElement;
  adapter: PlatformAdapter;
  getOverlayState: () => OverlayStateSnapshot;
}

const POLICY_VERSION = 'youtube-watch-telemetry-v1';
const RETENTION_DAYS = 30;
const MIN_ACTIVE_WATCH_MS = 5000;
const HEARTBEAT_INTERVAL_MS = 30000;

const createSessionId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `yt_session_${Math.random().toString(36).slice(2, 10)}`;
};

export class YouTubeWatchTelemetryReporter {
  private video: HTMLVideoElement;
  private adapter: PlatformAdapter;
  private getOverlayState: () => OverlayStateSnapshot;

  private sessionId = createSessionId();
  private sessionStartedAtIso = new Date().toISOString();
  private consentGrantedAtIso = new Date().toISOString();
  private activeSegmentStartedAtMs: number | null = null;
  private activeWatchMs = 0;
  private consentEnabled = false;
  private heartbeatTimer: ReturnType<typeof window.setInterval> | null = null;
  private lastSentSignature: string | null = null;
  private destroyed = false;

  private readonly handlePlaybackChange = () => {
    this.syncActiveSegment();
  };

  private readonly handleVisibilityChange = () => {
    this.syncActiveSegment();
    if (document.hidden) {
      void this.flushTelemetry();
    }
  };

  private readonly handlePageHide = () => {
    this.syncActiveSegment();
    void this.flushTelemetry();
  };

  constructor(options: YouTubeWatchTelemetryReporterOptions) {
    this.video = options.video;
    this.adapter = options.adapter;
    this.getOverlayState = options.getOverlayState;
  }

  async init() {
    await this.updatePreferences();

    this.video.addEventListener('play', this.handlePlaybackChange);
    this.video.addEventListener('pause', this.handlePlaybackChange);
    this.video.addEventListener('waiting', this.handlePlaybackChange);
    this.video.addEventListener('seeking', this.handlePlaybackChange);
    this.video.addEventListener('seeked', this.handlePlaybackChange);
    this.video.addEventListener('ended', this.handlePageHide);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('pagehide', this.handlePageHide);

    this.heartbeatTimer = window.setInterval(() => {
      this.syncActiveSegment();
      void this.flushTelemetry();
    }, HEARTBEAT_INTERVAL_MS);

    this.syncActiveSegment();
  }

  async updatePreferences() {
    const response = await chrome.runtime.sendMessage({ type: 'GET_PREFERENCES' });
    const nextConsentEnabled = Boolean(response?.success && response.data?.youtubeWatchTelemetryOptIn);

    if (nextConsentEnabled && !this.consentEnabled) {
      this.consentGrantedAtIso = new Date().toISOString();
      this.resetSession();
    }

    if (!nextConsentEnabled && this.consentEnabled) {
      this.finishActiveSegment();
      this.resetSession();
    }

    this.consentEnabled = nextConsentEnabled;
    this.syncActiveSegment();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    this.syncActiveSegment();
    void this.flushTelemetry();

    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.video.removeEventListener('play', this.handlePlaybackChange);
    this.video.removeEventListener('pause', this.handlePlaybackChange);
    this.video.removeEventListener('waiting', this.handlePlaybackChange);
    this.video.removeEventListener('seeking', this.handlePlaybackChange);
    this.video.removeEventListener('seeked', this.handlePlaybackChange);
    this.video.removeEventListener('ended', this.handlePageHide);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('pagehide', this.handlePageHide);
  }

  private syncActiveSegment() {
    if (this.shouldCountPlayback()) {
      if (this.activeSegmentStartedAtMs === null) {
        this.activeSegmentStartedAtMs = Date.now();
      }
      return;
    }

    this.finishActiveSegment();
  }

  private finishActiveSegment() {
    if (this.activeSegmentStartedAtMs === null) return;
    this.activeWatchMs += Math.max(0, Date.now() - this.activeSegmentStartedAtMs);
    this.activeSegmentStartedAtMs = null;
  }

  private shouldCountPlayback() {
    const playback = this.adapter.getPlaybackState();
    return this.consentEnabled && playback.isPlaying && !document.hidden && !this.video.ended;
  }

  private buildPayload(): YouTubeWatchTelemetryRequest | null {
    const videoId = this.adapter.getVideoId();
    if (!videoId || this.activeWatchMs < MIN_ACTIVE_WATCH_MS) {
      return null;
    }

    const nowIso = new Date().toISOString();
    const currentTime = Math.max(0, this.video.currentTime || 0);
    const duration = Number.isFinite(this.video.duration) && this.video.duration > 0 ? this.video.duration : 0;
    const completionRatio = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
    const overlayState = this.getOverlayState();

    return {
      consent: {
        enabled: true,
        grantedAtIso: this.consentGrantedAtIso,
        policyVersion: POLICY_VERSION,
        retentionDays: RETENTION_DAYS,
      },
      events: [{
        eventId: this.sessionId,
        sessionId: this.sessionId,
        videoId,
        videoUrl: window.location.href,
        title: this.adapter.getVideoTitle() || document.title,
        lang: overlayState.detectedLanguage || undefined,
        subtitleTrack: overlayState.selectedTrackId || undefined,
        sessionStartedAtIso: this.sessionStartedAtIso,
        sessionEndedAtIso: nowIso,
        activeWatchMs: Math.round(this.activeWatchMs),
        completionRatio: Number(completionRatio.toFixed(4)),
        eventCapturedAtIso: nowIso,
      }],
    };
  }

  private async flushTelemetry() {
    const payload = this.buildPayload();
    if (!payload) return;

    const event = payload.events[0];
    const signature = [
      event.sessionId,
      event.activeWatchMs,
      event.completionRatio,
      event.sessionEndedAtIso,
    ].join(':');

    if (signature === this.lastSentSignature) {
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: 'INGEST_YOUTUBE_WATCH_TELEMETRY',
      payload,
    });

    if (response?.success) {
      this.lastSentSignature = signature;
    }
  }

  private resetSession() {
    this.sessionId = createSessionId();
    this.sessionStartedAtIso = new Date().toISOString();
    this.activeSegmentStartedAtMs = null;
    this.activeWatchMs = 0;
    this.lastSentSignature = null;
  }
}
