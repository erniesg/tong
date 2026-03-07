'use client';

import { useCallback } from 'react';

/** Map bare jamo to pronounceable syllables for TTS.
 *  Consonants use CV syllables to demonstrate their sound.
 *  ㅇ uses its full name (이응) since it's silent at syllable start / "ng" at end. */
const JAMO_TO_SYLLABLE: Record<string, string> = {
  'ㄱ': '기역', 'ㄴ': '니은', 'ㄷ': '디귿', 'ㄹ': '리을', 'ㅁ': '미음',
  'ㅂ': '비읍', 'ㅅ': '시옷', 'ㅇ': '이응', 'ㅈ': '지읒', 'ㅊ': '치읓',
  'ㅋ': '키읔', 'ㅌ': '티읕', 'ㅍ': '피읖', 'ㅎ': '히읗',
  'ㅏ': '아', 'ㅑ': '야', 'ㅓ': '어', 'ㅕ': '여', 'ㅗ': '오',
  'ㅛ': '요', 'ㅜ': '우', 'ㅠ': '유', 'ㅡ': '으', 'ㅣ': '이',
};

const JAMO_MAP: Record<string, string> = {
  'ㄱ': 'g', 'ㄴ': 'n', 'ㄷ': 'd', 'ㄹ': 'r/l', 'ㅁ': 'm',
  'ㅂ': 'b', 'ㅅ': 's', 'ㅇ': 'ng', 'ㅈ': 'j', 'ㅊ': 'ch',
  'ㅋ': 'k', 'ㅌ': 't', 'ㅍ': 'p', 'ㅎ': 'h',
  'ㅏ': 'a', 'ㅑ': 'ya', 'ㅓ': 'eo', 'ㅕ': 'yeo', 'ㅗ': 'o',
  'ㅛ': 'yo', 'ㅜ': 'u', 'ㅠ': 'yu', 'ㅡ': 'eu', 'ㅣ': 'i',
};

interface TeachingItem {
  char: string;
  romanization: string;
}

interface TeachingCardProps {
  title?: string;
  content?: string;
  korean?: string;
  translation?: string;
  items?: TeachingItem[];
}

/** Extract jamo characters from teaching content. */
function extractJamoFromContent(content?: string, korean?: string): TeachingItem[] {
  const text = `${korean ?? ''} ${content ?? ''}`;
  const found: TeachingItem[] = [];
  const seen = new Set<string>();

  for (const char of text) {
    if (JAMO_MAP[char] && !seen.has(char)) {
      seen.add(char);
      found.push({ char, romanization: JAMO_MAP[char] });
    }
  }
  return found;
}

/** Parse "word1 word2" + "meaning1 meaning2" into pairs. */
function parseTeachingItems(korean?: string, translation?: string): TeachingItem[] {
  if (!korean) return [];
  const chars = korean.split(/\s+/).filter(Boolean);
  const meanings = translation?.split(/\s+/).filter(Boolean) ?? [];
  return chars.map((char, i) => ({
    char,
    romanization: meanings[i] ?? JAMO_MAP[char] ?? '',
  }));
}

export function TeachingCard({ title, content, korean, translation, items }: TeachingCardProps) {
  const displayItems = items
    ?? (korean ? parseTeachingItems(korean, translation) : extractJamoFromContent(content, korean));

  const playSound = useCallback((text: string) => {
    const utterText = JAMO_TO_SYLLABLE[text] ?? text;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(utterText);
      utter.lang = 'ko-KR';
      utter.rate = 0.8;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    }
  }, []);

  return (
    <div className="teaching-card">
      {title && <div className="teaching-card__title">{title}</div>}
      {content && !displayItems.length && (
        <p className="m-0 text-sm text-ko">{content}</p>
      )}
      {displayItems.length > 0 && (
        <div className="teaching-card__grid">
          {displayItems.map((item, i) => (
            <button
              key={`${item.char}-${i}`}
              className="teaching-card__item"
              onClick={() => playSound(item.char)}
              type="button"
            >
              <span className="teaching-card__char text-ko">{item.char}</span>
              <span className="teaching-card__roman">{item.romanization}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
