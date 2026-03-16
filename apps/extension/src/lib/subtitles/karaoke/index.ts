import type { SubtitleCue, WordTiming } from '@tong/core';

export interface KaraokeState {
  /** Current cue being displayed */
  cue: SubtitleCue | null;
  /** Index of currently highlighted word (-1 if none) */
  currentWordIndex: number;
  /** Progress through current word (0-1) */
  wordProgress: number;
  /** All words with their highlight states */
  words: Array<{
    word: string;
    romanization?: string;
    isHighlighted: boolean;
    isPast: boolean;
    isFuture: boolean;
    progress: number;
  }>;
}

/**
 * Generate word-level timing from a cue
 * This creates estimated timing when actual word timing isn't available
 */
export function generateWordTiming(cue: SubtitleCue): WordTiming[] {
  if (cue.words && cue.words.length > 0) {
    return cue.words;
  }

  const text = cue.text;
  const duration = cue.endTime - cue.startTime;

  // Split text into words/characters based on content type
  const segments = splitIntoSegments(text);
  if (segments.length === 0) return [];

  // Calculate timing for each segment
  const segmentDuration = duration / segments.length;
  const words: WordTiming[] = [];

  for (let i = 0; i < segments.length; i++) {
    words.push({
      word: segments[i],
      startTime: cue.startTime + i * segmentDuration,
      endTime: cue.startTime + (i + 1) * segmentDuration,
    });
  }

  return words;
}

/**
 * Split text into segments for word-level timing
 * Handles CJK (character-by-character) and non-CJK (word-by-word)
 */
function splitIntoSegments(text: string): string[] {
  const segments: string[] = [];
  let currentSegment = '';
  let lastWasCJK = false;

  for (const char of text) {
    const isCJK =
      /[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(char);
    const isWhitespace = /\s/.test(char);

    if (isCJK) {
      // CJK: each character is a segment
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
      // Whitespace: end current segment
      if (currentSegment) {
        segments.push(currentSegment.trim());
        currentSegment = '';
      }
      lastWasCJK = false;
    } else {
      // Non-CJK: accumulate into word
      if (lastWasCJK && currentSegment) {
        segments.push(currentSegment);
        currentSegment = '';
      }
      currentSegment += char;
      lastWasCJK = false;
    }
  }

  // Don't forget last segment
  if (currentSegment.trim()) {
    segments.push(currentSegment.trim());
  }

  return segments.filter((s) => s.length > 0);
}

/**
 * Get the current word highlight state for karaoke display
 */
export function highlightCurrentWord(
  cue: SubtitleCue | null,
  currentTime: number
): KaraokeState {
  if (!cue) {
    return {
      cue: null,
      currentWordIndex: -1,
      wordProgress: 0,
      words: [],
    };
  }

  const wordTimings = cue.words || generateWordTiming(cue);

  // Find current word
  let currentWordIndex = -1;
  let wordProgress = 0;

  for (let i = 0; i < wordTimings.length; i++) {
    const word = wordTimings[i];
    if (currentTime >= word.startTime && currentTime < word.endTime) {
      currentWordIndex = i;
      const wordDuration = word.endTime - word.startTime;
      wordProgress = wordDuration > 0
        ? (currentTime - word.startTime) / wordDuration
        : 0;
      break;
    }
  }

  // Build word states
  const words = wordTimings.map((word, index) => ({
    word: word.word,
    romanization: word.romanization,
    isHighlighted: index === currentWordIndex,
    isPast: currentTime >= word.endTime,
    isFuture: currentTime < word.startTime,
    progress:
      index === currentWordIndex
        ? wordProgress
        : currentTime >= word.endTime
        ? 1
        : 0,
  }));

  return {
    cue,
    currentWordIndex,
    wordProgress,
    words,
  };
}

/**
 * Add romanization to word timings
 */
export function addRomanizationToWords(
  words: WordTiming[],
  romanizations: string[]
): WordTiming[] {
  return words.map((word, index) => ({
    ...word,
    romanization: romanizations[index] || undefined,
  }));
}

/**
 * Interpolate word timing from partial data
 * Useful when you have some words with timing and need to fill gaps
 */
export function interpolateWordTiming(
  words: Array<{ word: string; startTime?: number; endTime?: number }>,
  cueStartTime: number,
  cueEndTime: number
): WordTiming[] {
  if (words.length === 0) return [];

  const result: WordTiming[] = [];
  const cueDuration = cueEndTime - cueStartTime;
  const defaultWordDuration = cueDuration / words.length;

  let lastEndTime = cueStartTime;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const nextWord = words[i + 1];

    const startTime = word.startTime ?? lastEndTime;
    const endTime =
      word.endTime ??
      (nextWord?.startTime ?? startTime + defaultWordDuration);

    result.push({
      word: word.word,
      startTime,
      endTime,
    });

    lastEndTime = endTime;
  }

  return result;
}
