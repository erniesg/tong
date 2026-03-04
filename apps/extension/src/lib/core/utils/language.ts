import type { LanguageCode } from '../types/subtitle';
import {
  CJK_LANGUAGES,
  DEFAULT_ROMANIZATION_SYSTEM,
  detectCJKLanguage,
  containsCJK,
} from '../constants/languages';
import type { RomanizationSystem } from '../types/romanization';

/**
 * Check if a language code represents a CJK language
 */
export function isCJKLanguage(lang: LanguageCode): boolean {
  return CJK_LANGUAGES.includes(lang);
}

/**
 * Get the appropriate romanization system for a language
 */
export function getRomanizationSystem(lang: LanguageCode): RomanizationSystem | null {
  const system = DEFAULT_ROMANIZATION_SYSTEM[lang];
  return system || null;
}

/**
 * Detect language from text content
 * Returns null if cannot determine or text is empty
 */
export function detectLanguage(text: string): LanguageCode | null {
  if (!text || text.trim().length === 0) {
    return null;
  }

  // Check for CJK characters
  const cjkLang = detectCJKLanguage(text);
  if (cjkLang) {
    return cjkLang;
  }

  // Check for primarily Latin characters (assume English for now)
  if (/^[a-zA-Z\s\d.,!?'"()-]+$/.test(text)) {
    return 'en';
  }

  return null;
}

/**
 * Normalize language code to standard format
 */
export function normalizeLanguageCode(code: string): LanguageCode {
  const normalized = code.toLowerCase().replace('_', '-');

  // Map common variants
  const mappings: Record<string, LanguageCode> = {
    chinese: 'zh',
    'zh-hans': 'zh-CN',
    'zh-hant': 'zh-TW',
    japanese: 'ja',
    korean: 'ko',
    english: 'en',
    cmn: 'zh', // ISO 639-3 for Mandarin
    jpn: 'ja', // ISO 639-3
    kor: 'ko', // ISO 639-3
    eng: 'en', // ISO 639-3
  };

  return mappings[normalized] || normalized;
}

/**
 * Check if text needs romanization (contains CJK that isn't already romanized)
 */
export function needsRomanization(text: string): boolean {
  return containsCJK(text);
}

/**
 * Get display name for a language
 */
export function getLanguageDisplayName(
  lang: LanguageCode,
  inNative = false
): string {
  const NAMES: Record<string, { english: string; native: string }> = {
    en: { english: 'English', native: 'English' },
    zh: { english: 'Chinese', native: '中文' },
    'zh-CN': { english: 'Chinese (Simplified)', native: '简体中文' },
    'zh-TW': { english: 'Chinese (Traditional)', native: '繁體中文' },
    ja: { english: 'Japanese', native: '日本語' },
    ko: { english: 'Korean', native: '한국어' },
  };

  const name = NAMES[lang];
  if (!name) return lang;
  return inNative ? name.native : name.english;
}

/**
 * Split text into CJK and non-CJK segments
 */
export function segmentByLanguage(
  text: string
): Array<{ text: string; isCJK: boolean; lang: LanguageCode | null }> {
  const segments: Array<{ text: string; isCJK: boolean; lang: LanguageCode | null }> = [];
  let currentSegment = '';
  let currentIsCJK: boolean | null = null;

  for (const char of text) {
    const charIsCJK = containsCJK(char);

    if (currentIsCJK === null) {
      currentIsCJK = charIsCJK;
      currentSegment = char;
    } else if (charIsCJK === currentIsCJK) {
      currentSegment += char;
    } else {
      // Language changed, save current segment
      if (currentSegment) {
        segments.push({
          text: currentSegment,
          isCJK: currentIsCJK,
          lang: currentIsCJK ? detectLanguage(currentSegment) : 'en',
        });
      }
      currentSegment = char;
      currentIsCJK = charIsCJK;
    }
  }

  // Don't forget the last segment
  if (currentSegment && currentIsCJK !== null) {
    segments.push({
      text: currentSegment,
      isCJK: currentIsCJK,
      lang: currentIsCJK ? detectLanguage(currentSegment) : 'en',
    });
  }

  return segments;
}
