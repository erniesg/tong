import { pinyin } from 'pinyin-pro';
import type { RomanizationResult, RomanizedSegment } from '@tong/core';

export interface PinyinOptions {
  /** Include tone marks (default: true) */
  toneMarks?: boolean;
  /** Use tone numbers instead of marks */
  toneNumbers?: boolean;
  /** Convert to lowercase (default: true) */
  lowercase?: boolean;
  /** Add spaces between syllables (default: true) */
  spacing?: boolean;
  /** Handle polyphonic characters (multiple readings) */
  multiple?: boolean;
}

const DEFAULT_OPTIONS: PinyinOptions = {
  toneMarks: true,
  toneNumbers: false,
  lowercase: true,
  spacing: true,
  multiple: false,
};

/**
 * Convert Chinese text to Pinyin with tone marks
 */
export function toPinyin(text: string, options: PinyinOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!text || text.trim().length === 0) {
    return '';
  }

  const result = pinyin(text, {
    toneType: opts.toneMarks ? 'symbol' : 'none',
    type: 'string',
    separator: opts.spacing ? ' ' : '',
  });

  if (opts.lowercase) {
    return result.toLowerCase();
  }
  // Capitalize first letter of each word when not lowercasing
  return result
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Convert Chinese text to Pinyin with tone marks (convenience function)
 */
export function toPinyinWithTones(text: string): string {
  return toPinyin(text, { toneMarks: true });
}

/**
 * Convert Chinese text to Pinyin with tone numbers
 */
export function toPinyinNumbered(text: string): string {
  if (!text || text.trim().length === 0) {
    return '';
  }

  const result = pinyin(text, {
    toneType: 'num',
    type: 'string',
    separator: ' ',
  });

  return result.toLowerCase();
}

/**
 * Convert Chinese text to Pinyin with detailed segment information
 */
export function toPinyinSegments(text: string): RomanizationResult {
  if (!text || text.trim().length === 0) {
    return {
      original: text,
      romanized: '',
      segments: [],
      system: 'pinyin',
      sourceLanguage: 'zh',
    };
  }

  const segments: RomanizedSegment[] = [];

  // Get character-by-character pinyin
  const charPinyin = pinyin(text, {
    toneType: 'symbol',
    type: 'array',
  });

  // Build segments
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const reading = charPinyin[i] || char;

    // Determine if this is a CJK character
    const isCJK = /[\u4E00-\u9FFF]/.test(char);

    // Get tone number if applicable
    let tone: number | undefined;
    if (isCJK) {
      const toneMatch = pinyin(char, { toneType: 'num', type: 'string' }).match(/[1-5]/);
      tone = toneMatch ? parseInt(toneMatch[0], 10) : undefined;
    }

    segments.push({
      text: char,
      reading: reading.toLowerCase(),
      type: isCJK ? 'cjk' : /[a-zA-Z]/.test(char) ? 'latin' : 'punctuation',
      tone,
    });
  }

  const romanized = charPinyin.join(' ').toLowerCase();

  return {
    original: text,
    romanized,
    segments,
    system: 'pinyin',
    sourceLanguage: 'zh',
  };
}

export { toPinyinSegments as pinyinSegments };
