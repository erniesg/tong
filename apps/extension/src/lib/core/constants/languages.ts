import type { LanguageCode } from '../types/subtitle';
import type { RomanizationSystem } from '../types/romanization';

/**
 * CJK language codes
 */
export const CJK_LANGUAGES: LanguageCode[] = ['zh', 'zh-CN', 'zh-TW', 'ja', 'ko'];

/**
 * Default romanization system per language
 */
export const DEFAULT_ROMANIZATION_SYSTEM: Record<string, RomanizationSystem> = {
  zh: 'pinyin',
  'zh-CN': 'pinyin',
  'zh-TW': 'pinyin',
  ja: 'romaji-hepburn',
  ko: 'hangul-rr',
};

/**
 * Language display names
 */
export const LANGUAGE_NAMES: Record<LanguageCode, { english: string; native: string }> = {
  en: { english: 'English', native: 'English' },
  zh: { english: 'Chinese', native: '中文' },
  'zh-CN': { english: 'Chinese (Simplified)', native: '简体中文' },
  'zh-TW': { english: 'Chinese (Traditional)', native: '繁體中文' },
  ja: { english: 'Japanese', native: '日本語' },
  ko: { english: 'Korean', native: '한국어' },
};

/**
 * Unicode ranges for CJK character detection
 */
export const UNICODE_RANGES = {
  // Chinese characters
  CJK_UNIFIED: /[\u4E00-\u9FFF]/,
  CJK_EXTENSION_A: /[\u3400-\u4DBF]/,
  CJK_EXTENSION_B: /[\u{20000}-\u{2A6DF}]/u,
  CJK_COMPATIBILITY: /[\uF900-\uFAFF]/,

  // Japanese
  HIRAGANA: /[\u3040-\u309F]/,
  KATAKANA: /[\u30A0-\u30FF]/,
  KATAKANA_PHONETIC: /[\u31F0-\u31FF]/,

  // Korean
  HANGUL_SYLLABLES: /[\uAC00-\uD7AF]/,
  HANGUL_JAMO: /[\u1100-\u11FF]/,
  HANGUL_COMPATIBILITY_JAMO: /[\u3130-\u318F]/,
};

/**
 * Check if text contains CJK characters
 */
export function containsCJK(text: string): boolean {
  return (
    UNICODE_RANGES.CJK_UNIFIED.test(text) ||
    UNICODE_RANGES.HIRAGANA.test(text) ||
    UNICODE_RANGES.KATAKANA.test(text) ||
    UNICODE_RANGES.HANGUL_SYLLABLES.test(text)
  );
}

/**
 * Check if text is primarily Japanese
 */
export function isPrimarilyJapanese(text: string): boolean {
  return UNICODE_RANGES.HIRAGANA.test(text) || UNICODE_RANGES.KATAKANA.test(text);
}

/**
 * Check if text is primarily Korean
 */
export function isPrimarilyKorean(text: string): boolean {
  return UNICODE_RANGES.HANGUL_SYLLABLES.test(text);
}

/**
 * Check if text is primarily Chinese
 */
export function isPrimarilyChinese(text: string): boolean {
  return (
    UNICODE_RANGES.CJK_UNIFIED.test(text) &&
    !isPrimarilyJapanese(text) &&
    !isPrimarilyKorean(text)
  );
}

/**
 * Detect the primary CJK language of text
 */
export function detectCJKLanguage(text: string): 'zh' | 'ja' | 'ko' | null {
  if (isPrimarilyJapanese(text)) return 'ja';
  if (isPrimarilyKorean(text)) return 'ko';
  if (isPrimarilyChinese(text)) return 'zh';
  return null;
}
