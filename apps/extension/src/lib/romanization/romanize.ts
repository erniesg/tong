import type { RomanizationResult, RomanizationOptions } from '@tong/core';
import { detectCJKLanguage } from '@tong/core';
import { toPinyin, toPinyinSegments, PinyinOptions } from './pinyin';
import { toRomaji, toRomajiSegments, RomajiOptions } from './romaji';
import { toRomanizedKorean, toRomanizedKoreanSegments, KoreanRomanizationOptions } from './hangul';

export interface RomanizeOptions extends RomanizationOptions {
  /** Force a specific language (auto-detect if not specified) */
  language?: 'zh' | 'ja' | 'ko';
}

/**
 * Universal romanization function that auto-detects language
 */
export function romanize(text: string, options: RomanizeOptions = {}): string {
  if (!text || text.trim().length === 0) {
    return '';
  }

  const language = options.language || detectCJKLanguage(text);

  switch (language) {
    case 'zh':
      return toPinyin(text, {
        toneMarks: options.includeTones !== false,
        lowercase: options.lowercase !== false,
        spacing: options.preserveSpaces !== false,
      } as PinyinOptions);

    case 'ja':
      return toRomaji(text, {
        lowercase: options.lowercase !== false,
        spacing: options.preserveSpaces !== false,
      } as RomajiOptions);

    case 'ko':
      return toRomanizedKorean(text, {
        lowercase: options.lowercase !== false,
        spacing: options.preserveSpaces !== false,
      } as KoreanRomanizationOptions);

    default:
      // Return original if language not detected
      return text;
  }
}

/**
 * Universal romanization function with detailed segment information
 */
export function romanizeWithSegments(text: string, options: RomanizeOptions = {}): RomanizationResult {
  if (!text || text.trim().length === 0) {
    return {
      original: text,
      romanized: '',
      segments: [],
      system: 'pinyin',
      sourceLanguage: 'zh',
    };
  }

  const language = options.language || detectCJKLanguage(text);

  switch (language) {
    case 'zh':
      return toPinyinSegments(text);

    case 'ja':
      return toRomajiSegments(text);

    case 'ko':
      return toRomanizedKoreanSegments(text);

    default:
      // Return original as single segment
      return {
        original: text,
        romanized: text,
        segments: [{ text, reading: text, type: 'latin' }],
        system: 'pinyin',
        sourceLanguage: 'zh',
      };
  }
}

/**
 * Batch romanization for multiple texts
 */
export function romanizeBatch(
  texts: string[],
  options: RomanizeOptions = {}
): RomanizationResult[] {
  return texts.map((text) => romanizeWithSegments(text, options));
}
