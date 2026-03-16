/**
 * Chinese pinyin phonetic system as structured data.
 * The AI can reference these principles when teaching Mandarin pronunciation.
 */

import type { DesignPrinciple } from './hangul';

/* ── Pinyin design principles ──────────────────────────────── */

export const PINYIN_DESIGN_PRINCIPLES: DesignPrinciple[] = [
  {
    id: 'four-tones',
    title: 'Four tones change meaning',
    description: 'Mandarin has 4 tones + neutral. The same syllable with different tones means completely different things.',
    examples: [
      { chars: 'mā(妈)', explanation: '1st tone (flat/high) = mother' },
      { chars: 'má(麻)', explanation: '2nd tone (rising) = hemp/numb' },
      { chars: 'mǎ(马)', explanation: '3rd tone (dipping) = horse' },
      { chars: 'mà(骂)', explanation: '4th tone (falling) = to scold' },
    ],
    teachingHook: 'The same sound "ma" means mother, horse, or scold — only the tone tells you which! Think of tones as musical notes.',
  },
  {
    id: 'initials-finals',
    title: 'Syllables = initial + final',
    description: 'Every Chinese syllable splits into an initial consonant and a final (vowel + optional ending).',
    examples: [
      { chars: 'b+ā=bā(八)', explanation: 'initial b + final a = bā (eight)' },
      { chars: 'zh+ōng=zhōng(中)', explanation: 'initial zh + final ong = zhōng (middle/China)' },
      { chars: 'n+ǐ=nǐ(你)', explanation: 'initial n + final i = nǐ (you)' },
      { chars: 'h+ǎo=hǎo(好)', explanation: 'initial h + final ao = hǎo (good)' },
    ],
    teachingHook: 'Every Chinese syllable is like a two-piece puzzle: a beginning sound + an ending sound. Learn the pieces and you can read anything!',
  },
  {
    id: 'radical-components',
    title: 'Characters share components (radicals)',
    description: 'Many Chinese characters share a radical that hints at meaning or sound.',
    examples: [
      { chars: '氵(water radical)', explanation: '河(river), 海(sea), 湖(lake) — all have the water radical' },
      { chars: '口(mouth radical)', explanation: '吃(eat), 喝(drink), 吗(question) — all involve the mouth' },
      { chars: '女(woman radical)', explanation: '妈(mother), 姐(older sister), 好(good) — all contain 女' },
    ],
    teachingHook: 'Chinese characters are built from Lego-like pieces called radicals. The water radical 氵 appears in river, sea, and lake — see the pattern?',
  },
  {
    id: 'tone-sandhi',
    title: 'Tones change in context',
    description: 'Two 3rd tones in a row cause the first to become 2nd tone. 不(bù) changes to bú before 4th tone.',
    examples: [
      { chars: '你好 nǐhǎo→níhǎo', explanation: 'Two 3rd tones: first becomes 2nd' },
      { chars: '不是 bùshì→búshì', explanation: '不 before 4th tone changes to 2nd tone' },
      { chars: '一个 yīgè→yígè', explanation: '一 before 4th tone changes to 2nd tone' },
    ],
    teachingHook: 'Tones are like neighbours — they influence each other! Two dipping tones in a row is hard, so the first one rises instead.',
  },
];

/* ── Common initials ───────────────────────────────────────── */

export interface PinyinInitial {
  pinyin: string;
  ipa: string;
  description: string;
  similar: string; // English approximation
}

export const PINYIN_INITIALS: PinyinInitial[] = [
  { pinyin: 'b', ipa: 'p', description: 'unaspirated bilabial', similar: 'b in "spin"' },
  { pinyin: 'p', ipa: 'pʰ', description: 'aspirated bilabial', similar: 'p in "pin"' },
  { pinyin: 'm', ipa: 'm', description: 'bilabial nasal', similar: 'm in "me"' },
  { pinyin: 'f', ipa: 'f', description: 'labiodental', similar: 'f in "fan"' },
  { pinyin: 'd', ipa: 't', description: 'unaspirated alveolar', similar: 'd in "stop"' },
  { pinyin: 't', ipa: 'tʰ', description: 'aspirated alveolar', similar: 't in "top"' },
  { pinyin: 'n', ipa: 'n', description: 'alveolar nasal', similar: 'n in "no"' },
  { pinyin: 'l', ipa: 'l', description: 'lateral', similar: 'l in "let"' },
  { pinyin: 'g', ipa: 'k', description: 'unaspirated velar', similar: 'g in "skill"' },
  { pinyin: 'k', ipa: 'kʰ', description: 'aspirated velar', similar: 'k in "kill"' },
  { pinyin: 'h', ipa: 'x', description: 'velar fricative', similar: 'h in "he" (rougher)' },
  { pinyin: 'zh', ipa: 'tʂ', description: 'retroflex affricate', similar: 'j in "judge" (tongue curled)' },
  { pinyin: 'ch', ipa: 'tʂʰ', description: 'aspirated retroflex', similar: 'ch in "church" (tongue curled)' },
  { pinyin: 'sh', ipa: 'ʂ', description: 'retroflex fricative', similar: 'sh in "shirt" (tongue curled)' },
  { pinyin: 'r', ipa: 'ʐ', description: 'retroflex approximant', similar: 'r in "run" (tongue curled)' },
  { pinyin: 'j', ipa: 'tɕ', description: 'palatal affricate', similar: 'j in "jeep" (tongue flat)' },
  { pinyin: 'q', ipa: 'tɕʰ', description: 'aspirated palatal', similar: 'ch in "cheap" (tongue flat)' },
  { pinyin: 'x', ipa: 'ɕ', description: 'palatal fricative', similar: 'sh in "she" (tongue flat)' },
  { pinyin: 'z', ipa: 'ts', description: 'alveolar affricate', similar: 'ds in "reads"' },
  { pinyin: 'c', ipa: 'tsʰ', description: 'aspirated alveolar affricate', similar: 'ts in "cats"' },
  { pinyin: 's', ipa: 's', description: 'alveolar fricative', similar: 's in "sun"' },
];

/* ── Common finals ─────────────────────────────────────────── */

export interface PinyinFinal {
  pinyin: string;
  ipa: string;
  description: string;
}

export const PINYIN_FINALS: PinyinFinal[] = [
  { pinyin: 'a', ipa: 'a', description: 'open "ah"' },
  { pinyin: 'o', ipa: 'o', description: 'rounded "oh"' },
  { pinyin: 'e', ipa: 'ɤ', description: 'unrounded "uh" (not English "e")' },
  { pinyin: 'i', ipa: 'i', description: '"ee"' },
  { pinyin: 'u', ipa: 'u', description: '"oo"' },
  { pinyin: 'ü', ipa: 'y', description: 'French "u" (lips rounded, tongue says "ee")' },
  { pinyin: 'ai', ipa: 'ai', description: '"eye"' },
  { pinyin: 'ei', ipa: 'ei', description: '"ay" in "day"' },
  { pinyin: 'ao', ipa: 'au', description: '"ow" in "cow"' },
  { pinyin: 'ou', ipa: 'ou', description: '"oh"' },
  { pinyin: 'an', ipa: 'an', description: '"an" in "fan"' },
  { pinyin: 'en', ipa: 'ən', description: '"un" in "under"' },
  { pinyin: 'ang', ipa: 'aŋ', description: '"ong" with open "a"' },
  { pinyin: 'eng', ipa: 'əŋ', description: '"ung"' },
  { pinyin: 'ong', ipa: 'uŋ', description: 'rounded "ong"' },
];

/**
 * Get pinyin principles relevant to given characters/words.
 */
export function getPinyinPrinciplesForContext(words: string[]): DesignPrinciple[] {
  return PINYIN_DESIGN_PRINCIPLES.filter((p) =>
    p.examples.some((ex) =>
      words.some((w) => ex.chars.includes(w)),
    ),
  );
}
