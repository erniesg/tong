import type { CharacterData } from './types';
import { getHanziMap, getUnihanMap } from './loader';

// Reverse index: Hangul syllable → best matching CJK character
let hangulIndex: Map<string, string> | null = null;

async function getHangulIndex(): Promise<Map<string, string>> {
  if (hangulIndex) return hangulIndex;
  const unihanMap = await getUnihanMap();
  hangulIndex = new Map();
  for (const [char, reading] of unihanMap) {
    if (reading.hangul) {
      // hangul field may contain multiple syllables like "듣" or "문"
      // Map each unique syllable to the first character found
      const syllable = reading.hangul.trim();
      if (syllable && !hangulIndex.has(syllable)) {
        hangulIndex.set(syllable, char);
      }
    }
  }
  return hangulIndex;
}

/**
 * Look up a single Hangul syllable and return the most common
 * corresponding CJK (Hanja) character, if any.
 */
export async function lookupHangulSyllable(syllable: string): Promise<string | null> {
  if (!syllable || syllable.length !== 1) return null;
  if (!/[\uAC00-\uD7AF]/.test(syllable)) return null;
  const index = await getHangulIndex();
  return index.get(syllable) ?? null;
}

/**
 * Look up a single CJK character and return its decomposition,
 * etymology, and cross-language readings.
 */
export async function lookupHanzi(char: string): Promise<CharacterData | null> {
  if (!char || char.length !== 1) return null;
  if (!/[\u4E00-\u9FFF\u3400-\u4DBF]/.test(char)) return null;

  const [hanziMap, unihanMap] = await Promise.all([
    getHanziMap(),
    getUnihanMap(),
  ]);

  const hanzi = hanziMap.get(char);
  const unihan = unihanMap.get(char);

  if (!hanzi && !unihan) return null;

  const result: CharacterData = {
    character: char,
  };

  // From makemeahanzi
  if (hanzi) {
    result.definition = hanzi.definition;
    result.pinyin = hanzi.pinyin;
    result.decomposition = hanzi.decomposition;
    result.radical = hanzi.radical;
    result.strokeCount = hanzi.strokes;
    if (hanzi.etymology) {
      result.etymology = {
        type: hanzi.etymology.type as 'pictographic' | 'ideographic' | 'pictophonetic',
        semantic: hanzi.etymology.semantic,
        phonetic: hanzi.etymology.phonetic,
        hint: hanzi.etymology.hint,
      };
    }
  }

  // From unihan
  if (unihan) {
    result.mandarin = unihan.mandarin;
    result.hangul = unihan.hangul;
    result.japaneseOn = unihan.japaneseOn;
    result.japaneseKun = unihan.japaneseKun;
    if (!result.definition && unihan.definition) {
      result.definition = unihan.definition;
    }
  }

  return result;
}
