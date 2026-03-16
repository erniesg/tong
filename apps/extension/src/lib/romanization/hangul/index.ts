import type { RomanizationResult, RomanizedSegment } from '@tong/core';

export interface KoreanRomanizationOptions {
  /** Romanization system (default: 'rr' for Revised Romanization) */
  system?: 'rr' | 'mr';
  /** Convert to lowercase (default: true) */
  lowercase?: boolean;
  /** Add spaces between syllables (default: false) */
  spacing?: boolean;
}

const DEFAULT_OPTIONS: KoreanRomanizationOptions = {
  system: 'rr',
  lowercase: true,
  spacing: false,
};

// Korean Hangul composition constants
const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

// Initial consonants (초성)
const INITIALS = [
  'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss',
  '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'
];

// Medial vowels (중성)
const MEDIALS = [
  'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa',
  'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'
];

// Final consonants (종성)
const FINALS = [
  '', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'l', 'l',
  'l', 'l', 'l', 'l', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'
];

/**
 * Decompose a Hangul syllable into its components
 */
function decomposeHangul(char: string): { initial: string; medial: string; final: string } | null {
  const code = char.charCodeAt(0);

  if (code < HANGUL_START || code > HANGUL_END) {
    return null;
  }

  const syllableIndex = code - HANGUL_START;
  const initialIndex = Math.floor(syllableIndex / 588);
  const medialIndex = Math.floor((syllableIndex % 588) / 28);
  const finalIndex = syllableIndex % 28;

  return {
    initial: INITIALS[initialIndex],
    medial: MEDIALS[medialIndex],
    final: FINALS[finalIndex],
  };
}

/**
 * Convert Korean Hangul text to Romanization (Revised Romanization)
 */
export function toRomanizedKorean(text: string, options: KoreanRomanizationOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!text || text.trim().length === 0) {
    return '';
  }

  let result = '';

  for (const char of text) {
    const decomposed = decomposeHangul(char);

    if (decomposed) {
      result += decomposed.initial + decomposed.medial + decomposed.final;
      if (opts.spacing) {
        result += ' ';
      }
    } else {
      // Keep non-Hangul characters as is
      result += char;
    }
  }

  result = result.trim();
  return opts.lowercase ? result.toLowerCase() : result;
}

/**
 * Convert Korean text to Romanization with segment information
 */
export function toRomanizedKoreanSegments(
  text: string,
  options: KoreanRomanizationOptions = {}
): RomanizationResult {
  const segments: RomanizedSegment[] = [];

  for (const char of text) {
    const decomposed = decomposeHangul(char);
    const isHangul = decomposed !== null;

    const reading = decomposed
      ? (decomposed.initial + decomposed.medial + decomposed.final).toLowerCase()
      : char;

    segments.push({
      text: char,
      reading,
      type: isHangul ? 'cjk' : /[a-zA-Z]/.test(char) ? 'latin' : 'punctuation',
    });
  }

  const romanized = toRomanizedKorean(text, options);

  return {
    original: text,
    romanized,
    segments,
    system: 'hangul-rr',
    sourceLanguage: 'ko',
  };
}
