/**
 * Convert seconds to milliseconds
 */
export function secondsToMs(seconds: number): number {
  return Math.round(seconds * 1000);
}

/**
 * Convert milliseconds to seconds
 */
export function msToSeconds(ms: number): number {
  return ms / 1000;
}

/**
 * Format milliseconds as timestamp string (HH:MM:SS.mmm)
 */
export function formatTimestamp(ms: number, includeMs = false): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(hours.toString().padStart(2, '0'));
  }
  parts.push(minutes.toString().padStart(2, '0'));
  parts.push(seconds.toString().padStart(2, '0'));

  let result = parts.join(':');
  if (includeMs) {
    result += '.' + milliseconds.toString().padStart(3, '0');
  }

  return result;
}

/**
 * Parse timestamp string to milliseconds
 * Supports formats: HH:MM:SS.mmm, MM:SS.mmm, SS.mmm, HH:MM:SS, MM:SS
 */
export function parseTimestamp(timestamp: string): number {
  // Handle VTT/SRT format with comma (00:00:00,000)
  timestamp = timestamp.replace(',', '.');

  const parts = timestamp.split(':');
  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (parts.length === 3) {
    hours = parseInt(parts[0], 10);
    minutes = parseInt(parts[1], 10);
    seconds = parseFloat(parts[2]);
  } else if (parts.length === 2) {
    minutes = parseInt(parts[0], 10);
    seconds = parseFloat(parts[1]);
  } else if (parts.length === 1) {
    seconds = parseFloat(parts[0]);
  }

  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}

/**
 * Adjust timestamp by playback rate
 * For a video playing at 1.5x, a subtitle at 10s should appear at 10/1.5 = 6.67s real time
 */
export function adjustForPlaybackRate(timestampMs: number, playbackRate: number): number {
  if (playbackRate <= 0) return timestampMs;
  return Math.round(timestampMs / playbackRate);
}

/**
 * Calculate real-time position from video time
 */
export function videoTimeToRealTime(videoTimeMs: number, playbackRate: number): number {
  return adjustForPlaybackRate(videoTimeMs, playbackRate);
}

/**
 * Calculate video time from real time
 */
export function realTimeToVideoTime(realTimeMs: number, playbackRate: number): number {
  return Math.round(realTimeMs * playbackRate);
}

/**
 * Check if a time falls within a range
 */
export function isTimeInRange(time: number, startTime: number, endTime: number): boolean {
  return time >= startTime && time < endTime;
}

/**
 * Find the current subtitle cue based on playback time
 */
export function findCurrentCue<T extends { startTime: number; endTime: number }>(
  cues: T[],
  currentTimeMs: number
): T | null {
  // Binary search for efficiency with large subtitle files
  let left = 0;
  let right = cues.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const cue = cues[mid];

    if (currentTimeMs >= cue.startTime && currentTimeMs < cue.endTime) {
      return cue;
    } else if (currentTimeMs < cue.startTime) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return null;
}

/**
 * Offset all timestamps in a list of cues
 */
export function offsetCues<T extends { startTime: number; endTime: number }>(
  cues: T[],
  offsetMs: number
): T[] {
  return cues.map((cue) => ({
    ...cue,
    startTime: Math.max(0, cue.startTime + offsetMs),
    endTime: Math.max(0, cue.endTime + offsetMs),
  }));
}
