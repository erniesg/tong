import type { SubtitleCue } from '@tong/core';
import { findCurrentCue, offsetCues, adjustForPlaybackRate } from '@tong/core';

export interface PlaybackState {
  /** Current playback time in milliseconds */
  currentTime: number;
  /** Current playback rate (1.0 = normal) */
  playbackRate: number;
  /** Whether video is playing */
  isPlaying: boolean;
}

export interface SyncResult {
  /** Currently active cue (or null if between cues) */
  currentCue: SubtitleCue | null;
  /** Index of current cue in the array */
  currentIndex: number;
  /** Next cue (for preloading) */
  nextCue: SubtitleCue | null;
  /** Progress through current cue (0-1) */
  progress: number;
}

/**
 * Synchronize subtitles with current playback state
 */
export function syncWithPlayback(cues: SubtitleCue[], state: PlaybackState): SyncResult {
  const adjustedTime = state.currentTime;

  const currentCue = findCurrentCue(cues, adjustedTime);
  const currentIndex = currentCue ? cues.indexOf(currentCue) : -1;

  // Find next cue
  let nextCue: SubtitleCue | null = null;
  if (currentIndex >= 0 && currentIndex < cues.length - 1) {
    nextCue = cues[currentIndex + 1];
  } else if (currentIndex === -1) {
    // Not in a cue, find next upcoming cue
    nextCue = cues.find((cue) => cue.startTime > adjustedTime) || null;
  }

  // Calculate progress through current cue
  let progress = 0;
  if (currentCue) {
    const duration = currentCue.endTime - currentCue.startTime;
    const elapsed = adjustedTime - currentCue.startTime;
    progress = duration > 0 ? Math.min(1, Math.max(0, elapsed / duration)) : 0;
  }

  return {
    currentCue,
    currentIndex,
    nextCue,
    progress,
  };
}

/**
 * Adjust subtitle timing with a global offset
 */
export function adjustTiming(cues: SubtitleCue[], offsetMs: number): SubtitleCue[] {
  return offsetCues(cues, offsetMs);
}

/**
 * Alias for adjustTiming for clarity
 */
export function offsetSubtitles(cues: SubtitleCue[], offsetMs: number): SubtitleCue[] {
  return adjustTiming(cues, offsetMs);
}

/**
 * Scale subtitle timing for different playback rates
 * This is useful when you need to pre-adjust timing for a known playback rate
 */
export function scaleTimingForPlaybackRate(
  cues: SubtitleCue[],
  playbackRate: number
): SubtitleCue[] {
  if (playbackRate === 1) return cues;

  return cues.map((cue) => ({
    ...cue,
    startTime: adjustForPlaybackRate(cue.startTime, playbackRate),
    endTime: adjustForPlaybackRate(cue.endTime, playbackRate),
    words: cue.words?.map((word) => ({
      ...word,
      startTime: adjustForPlaybackRate(word.startTime, playbackRate),
      endTime: adjustForPlaybackRate(word.endTime, playbackRate),
    })),
  }));
}

/**
 * Find cues within a time range (useful for preloading)
 */
export function getCuesInRange(
  cues: SubtitleCue[],
  startTime: number,
  endTime: number
): SubtitleCue[] {
  return cues.filter(
    (cue) =>
      // Cue starts within range
      (cue.startTime >= startTime && cue.startTime < endTime) ||
      // Cue ends within range
      (cue.endTime > startTime && cue.endTime <= endTime) ||
      // Cue spans the entire range
      (cue.startTime <= startTime && cue.endTime >= endTime)
  );
}

/**
 * Estimate the playback time when a cue will appear
 * Useful for scheduling translation/romanization requests
 */
export function estimateCueAppearanceTime(
  cue: SubtitleCue,
  currentTime: number,
  playbackRate: number
): number {
  if (cue.startTime <= currentTime) {
    return 0; // Already appeared
  }

  const timeUntilCue = cue.startTime - currentTime;
  return timeUntilCue / playbackRate;
}
