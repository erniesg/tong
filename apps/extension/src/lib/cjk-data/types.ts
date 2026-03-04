export interface CharacterData {
  character: string;
  definition?: string;
  pinyin?: string[];
  mandarin?: string;
  hangul?: string;
  japaneseOn?: string[];
  japaneseKun?: string[];
  decomposition?: string;
  etymology?: {
    type: 'pictographic' | 'ideographic' | 'pictophonetic';
    semantic?: string;
    phonetic?: string;
    hint?: string;
  };
  simplified?: string;
  traditional?: string;
  radical?: string;
  strokeCount?: number;
}

export interface HanjaEntry {
  korean: string;
  hanja: string;
  english?: string;
}

export interface CharacterBreakdownEntry {
  character: string;
  pinyin?: string;
  hangul?: string;
  japaneseOn?: string[];
  japaneseKun?: string[];
  definition?: string;
  decomposition?: string;
  etymology?: { type: string; hint?: string };
  simplified?: string;
  traditional?: string;
}

export interface VariantMaps {
  traditionalToSimplified: Record<string, string>;
  simplifiedToTraditional: Record<string, string>;
}

/** Raw format from makemeahanzi */
export interface RawHanziEntry {
  character: string;
  definition?: string;
  pinyin?: string[];
  decomposition?: string;
  etymology?: {
    type: string;
    semantic?: string;
    phonetic?: string;
    hint?: string;
  };
  radical?: string;
  strokes?: number;
}

/** Merged unihan reading for a single codepoint */
export interface UnihanReading {
  mandarin?: string;
  hangul?: string;
  japaneseOn?: string[];
  japaneseKun?: string[];
  definition?: string;
}
