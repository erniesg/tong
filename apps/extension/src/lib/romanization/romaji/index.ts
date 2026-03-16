import type { RomanizationResult, RomanizedSegment } from '@tong/core';

export interface RomajiOptions {
  /** Romanization system (default: 'hepburn') */
  system?: 'hepburn' | 'kunrei' | 'passport';
  /** Convert to lowercase (default: true) */
  lowercase?: boolean;
  /** Add spaces between words (default: true) */
  spacing?: boolean;
  /** Use macrons for long vowels (default: true) */
  useMacrons?: boolean;
}

const DEFAULT_OPTIONS: RomajiOptions = {
  system: 'hepburn',
  lowercase: true,
  spacing: true,
  useMacrons: true,
};

// Hiragana to Romaji mapping (Hepburn)
const HIRAGANA_MAP: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', を: 'wo', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  // Combinations
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
  ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
  みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
  りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
  ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  じゃ: 'ja', じゅ: 'ju', じょ: 'jo',
  びゃ: 'bya', びゅ: 'byu', びょ: 'byo',
  ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
  // Small kana
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o',
  っ: '', // Double consonant marker
};

// Katakana to Hiragana offset
const KATAKANA_TO_HIRAGANA_OFFSET = 0x60;

/**
 * Convert Katakana character to Hiragana
 */
function katakanaToHiragana(char: string): string {
  const code = char.charCodeAt(0);
  if (code >= 0x30a1 && code <= 0x30f6) {
    return String.fromCharCode(code - KATAKANA_TO_HIRAGANA_OFFSET);
  }
  return char;
}

/**
 * Convert Japanese text (hiragana/katakana) to Romaji
 * Note: This is a basic implementation. For production, consider using kuroshiro.
 */
export function toRomaji(text: string, options: RomajiOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!text || text.trim().length === 0) {
    return '';
  }

  let result = '';
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    // Convert katakana to hiragana for lookup
    const hiragana = katakanaToHiragana(char);

    // Check for two-character combinations first
    if (i + 1 < text.length) {
      const nextChar = katakanaToHiragana(text[i + 1]);
      const combination = hiragana + nextChar;

      if (HIRAGANA_MAP[combination]) {
        result += HIRAGANA_MAP[combination];
        i += 2;
        continue;
      }
    }

    // Handle small tsu (っ) for consonant doubling
    if (hiragana === 'っ' && i + 1 < text.length) {
      const nextChar = katakanaToHiragana(text[i + 1]);
      const nextRomaji = HIRAGANA_MAP[nextChar];
      if (nextRomaji && nextRomaji.length > 0) {
        result += nextRomaji[0]; // Double the first consonant
      }
      i++;
      continue;
    }

    // Single character lookup
    if (HIRAGANA_MAP[hiragana]) {
      result += HIRAGANA_MAP[hiragana];
    } else if (/[\u4E00-\u9FFF]/.test(char)) {
      // Kanji - keep as is (would need dictionary for reading)
      result += char;
    } else {
      // Keep other characters as is
      result += char;
    }

    i++;
  }

  return opts.lowercase ? result.toLowerCase() : result;
}

/**
 * Convert Japanese text to Romaji with segment information
 */
export function toRomajiSegments(text: string, options: RomajiOptions = {}): RomanizationResult {
  const romanized = toRomaji(text, options);

  const segments: RomanizedSegment[] = [];

  // Build basic segments (simplified)
  for (const char of text) {
    const hiragana = katakanaToHiragana(char);
    const reading = HIRAGANA_MAP[hiragana] || char;

    const isKana = /[\u3040-\u309F\u30A0-\u30FF]/.test(char);
    const isKanji = /[\u4E00-\u9FFF]/.test(char);

    segments.push({
      text: char,
      reading: reading.toLowerCase(),
      type: isKana || isKanji ? 'cjk' : /[a-zA-Z]/.test(char) ? 'latin' : 'punctuation',
    });
  }

  return {
    original: text,
    romanized,
    segments,
    system: 'romaji-hepburn',
    sourceLanguage: 'ja',
  };
}
