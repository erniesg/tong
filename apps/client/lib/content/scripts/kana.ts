/**
 * Japanese kana writing system as structured data.
 * The AI can reference these principles when teaching hiragana and katakana.
 */

import type { DesignPrinciple } from './hangul';

/* ── Kana design principles ────────────────────────────────── */

export const KANA_DESIGN_PRINCIPLES: DesignPrinciple[] = [
  {
    id: 'hiragana-from-kanji',
    title: 'Hiragana evolved from kanji cursive',
    description: 'Each hiragana character is a simplified, cursive form of a Chinese character (man\'yōgana).',
    examples: [
      { chars: '安→あ(a)', explanation: '安(peace) simplified to あ' },
      { chars: '以→い(i)', explanation: '以(by means of) simplified to い' },
      { chars: '宇→う(u)', explanation: '宇(roof/universe) simplified to う' },
      { chars: '加→か(ka)', explanation: '加(add) simplified to か' },
    ],
    teachingHook: 'Hiragana are ancient Chinese characters that got lazy and curvy over centuries! あ comes from 安 (peace).',
  },
  {
    id: 'katakana-from-kanji-parts',
    title: 'Katakana are kanji fragments',
    description: 'Each katakana character takes a piece (often a single stroke group) from a Chinese character.',
    examples: [
      { chars: '阿→ア(a)', explanation: 'Left side of 阿 became ア' },
      { chars: '伊→イ(i)', explanation: 'Left side of 伊 became イ' },
      { chars: '宇→ウ(u)', explanation: 'Top part of 宇 became ウ' },
      { chars: '加→カ(ka)', explanation: 'Left side of 加 became カ' },
    ],
    teachingHook: 'Katakana are angular fragments cut from kanji — like taking a piece of a stamp. ア is just the left side of 阿!',
  },
  {
    id: 'vowel-column-pattern',
    title: 'Five vowels, systematic rows',
    description: 'Japanese has exactly 5 vowels (a, i, u, e, o). Every consonant row follows the same vowel order.',
    examples: [
      { chars: 'あいうえお', explanation: 'a i u e o — the vowel row' },
      { chars: 'かきくけこ', explanation: 'ka ki ku ke ko — k + each vowel' },
      { chars: 'さしすせそ', explanation: 'sa shi su se so — s + each vowel' },
      { chars: 'たちつてと', explanation: 'ta chi tsu te to — t + each vowel' },
    ],
    teachingHook: 'Japanese is beautifully systematic: learn the 5 vowels, then just add consonants. か=k+a, き=k+i, く=k+u. Done!',
  },
  {
    id: 'dakuten-handakuten',
    title: 'Dots and circles change sounds',
    description: 'Adding ゛(dakuten/tenten) voices a consonant. Adding ゜(handakuten/maru) makes it a "p" sound.',
    examples: [
      { chars: 'か→が', explanation: 'ka → ga (voicing: k becomes g)' },
      { chars: 'さ→ざ', explanation: 'sa → za (voicing: s becomes z)' },
      { chars: 'た→だ', explanation: 'ta → da (voicing: t becomes d)' },
      { chars: 'は→ば→ぱ', explanation: 'ha → ba (dakuten) → pa (handakuten)' },
    ],
    teachingHook: 'Two dots (゛) = voice it! A circle (゜) = "p" sound! か(ka) + ゛= が(ga). は(ha) + ゜= ぱ(pa).',
  },
  {
    id: 'katakana-for-foreign',
    title: 'Katakana = foreign & emphasis',
    description: 'Katakana is used for loanwords, foreign names, onomatopoeia, and emphasis (like italics in English).',
    examples: [
      { chars: 'コーヒー', explanation: 'kōhī = coffee (English loanword)' },
      { chars: 'パン', explanation: 'pan = bread (Portuguese loanword)' },
      { chars: 'アメリカ', explanation: 'amerika = America (foreign name)' },
      { chars: 'ドキドキ', explanation: 'dokidoki = heart pounding (onomatopoeia)' },
    ],
    teachingHook: 'Katakana is Japan\'s way of writing foreign words. Coffee = コーヒー. You already know lots of Japanese!',
  },
];

/* ── Hiragana chart data ───────────────────────────────────── */

export interface KanaEntry {
  kana: string;
  romaji: string;
  row: string;      // consonant group (vowel, k, s, t, n, h, m, y, r, w)
  column: string;    // vowel (a, i, u, e, o)
}

export const HIRAGANA: KanaEntry[] = [
  // Vowels
  { kana: 'あ', romaji: 'a', row: 'vowel', column: 'a' },
  { kana: 'い', romaji: 'i', row: 'vowel', column: 'i' },
  { kana: 'う', romaji: 'u', row: 'vowel', column: 'u' },
  { kana: 'え', romaji: 'e', row: 'vowel', column: 'e' },
  { kana: 'お', romaji: 'o', row: 'vowel', column: 'o' },
  // K-row
  { kana: 'か', romaji: 'ka', row: 'k', column: 'a' },
  { kana: 'き', romaji: 'ki', row: 'k', column: 'i' },
  { kana: 'く', romaji: 'ku', row: 'k', column: 'u' },
  { kana: 'け', romaji: 'ke', row: 'k', column: 'e' },
  { kana: 'こ', romaji: 'ko', row: 'k', column: 'o' },
  // S-row
  { kana: 'さ', romaji: 'sa', row: 's', column: 'a' },
  { kana: 'し', romaji: 'shi', row: 's', column: 'i' },
  { kana: 'す', romaji: 'su', row: 's', column: 'u' },
  { kana: 'せ', romaji: 'se', row: 's', column: 'e' },
  { kana: 'そ', romaji: 'so', row: 's', column: 'o' },
  // T-row
  { kana: 'た', romaji: 'ta', row: 't', column: 'a' },
  { kana: 'ち', romaji: 'chi', row: 't', column: 'i' },
  { kana: 'つ', romaji: 'tsu', row: 't', column: 'u' },
  { kana: 'て', romaji: 'te', row: 't', column: 'e' },
  { kana: 'と', romaji: 'to', row: 't', column: 'o' },
  // N-row
  { kana: 'な', romaji: 'na', row: 'n', column: 'a' },
  { kana: 'に', romaji: 'ni', row: 'n', column: 'i' },
  { kana: 'ぬ', romaji: 'nu', row: 'n', column: 'u' },
  { kana: 'ね', romaji: 'ne', row: 'n', column: 'e' },
  { kana: 'の', romaji: 'no', row: 'n', column: 'o' },
  // H-row
  { kana: 'は', romaji: 'ha', row: 'h', column: 'a' },
  { kana: 'ひ', romaji: 'hi', row: 'h', column: 'i' },
  { kana: 'ふ', romaji: 'fu', row: 'h', column: 'u' },
  { kana: 'へ', romaji: 'he', row: 'h', column: 'e' },
  { kana: 'ほ', romaji: 'ho', row: 'h', column: 'o' },
  // M-row
  { kana: 'ま', romaji: 'ma', row: 'm', column: 'a' },
  { kana: 'み', romaji: 'mi', row: 'm', column: 'i' },
  { kana: 'む', romaji: 'mu', row: 'm', column: 'u' },
  { kana: 'め', romaji: 'me', row: 'm', column: 'e' },
  { kana: 'も', romaji: 'mo', row: 'm', column: 'o' },
  // Y-row
  { kana: 'や', romaji: 'ya', row: 'y', column: 'a' },
  { kana: 'ゆ', romaji: 'yu', row: 'y', column: 'u' },
  { kana: 'よ', romaji: 'yo', row: 'y', column: 'o' },
  // R-row
  { kana: 'ら', romaji: 'ra', row: 'r', column: 'a' },
  { kana: 'り', romaji: 'ri', row: 'r', column: 'i' },
  { kana: 'る', romaji: 'ru', row: 'r', column: 'u' },
  { kana: 'れ', romaji: 're', row: 'r', column: 'e' },
  { kana: 'ろ', romaji: 'ro', row: 'r', column: 'o' },
  // W-row
  { kana: 'わ', romaji: 'wa', row: 'w', column: 'a' },
  { kana: 'を', romaji: 'wo', row: 'w', column: 'o' },
  // N
  { kana: 'ん', romaji: 'n', row: 'special', column: 'n' },
];

export const KATAKANA: KanaEntry[] = [
  // Vowels
  { kana: 'ア', romaji: 'a', row: 'vowel', column: 'a' },
  { kana: 'イ', romaji: 'i', row: 'vowel', column: 'i' },
  { kana: 'ウ', romaji: 'u', row: 'vowel', column: 'u' },
  { kana: 'エ', romaji: 'e', row: 'vowel', column: 'e' },
  { kana: 'オ', romaji: 'o', row: 'vowel', column: 'o' },
  // K-row
  { kana: 'カ', romaji: 'ka', row: 'k', column: 'a' },
  { kana: 'キ', romaji: 'ki', row: 'k', column: 'i' },
  { kana: 'ク', romaji: 'ku', row: 'k', column: 'u' },
  { kana: 'ケ', romaji: 'ke', row: 'k', column: 'e' },
  { kana: 'コ', romaji: 'ko', row: 'k', column: 'o' },
  // S-row
  { kana: 'サ', romaji: 'sa', row: 's', column: 'a' },
  { kana: 'シ', romaji: 'shi', row: 's', column: 'i' },
  { kana: 'ス', romaji: 'su', row: 's', column: 'u' },
  { kana: 'セ', romaji: 'se', row: 's', column: 'e' },
  { kana: 'ソ', romaji: 'so', row: 's', column: 'o' },
  // T-row
  { kana: 'タ', romaji: 'ta', row: 't', column: 'a' },
  { kana: 'チ', romaji: 'chi', row: 't', column: 'i' },
  { kana: 'ツ', romaji: 'tsu', row: 't', column: 'u' },
  { kana: 'テ', romaji: 'te', row: 't', column: 'e' },
  { kana: 'ト', romaji: 'to', row: 't', column: 'o' },
  // N-row
  { kana: 'ナ', romaji: 'na', row: 'n', column: 'a' },
  { kana: 'ニ', romaji: 'ni', row: 'n', column: 'i' },
  { kana: 'ヌ', romaji: 'nu', row: 'n', column: 'u' },
  { kana: 'ネ', romaji: 'ne', row: 'n', column: 'e' },
  { kana: 'ノ', romaji: 'no', row: 'n', column: 'o' },
  // H-row
  { kana: 'ハ', romaji: 'ha', row: 'h', column: 'a' },
  { kana: 'ヒ', romaji: 'hi', row: 'h', column: 'i' },
  { kana: 'フ', romaji: 'fu', row: 'h', column: 'u' },
  { kana: 'ヘ', romaji: 'he', row: 'h', column: 'e' },
  { kana: 'ホ', romaji: 'ho', row: 'h', column: 'o' },
  // M-row
  { kana: 'マ', romaji: 'ma', row: 'm', column: 'a' },
  { kana: 'ミ', romaji: 'mi', row: 'm', column: 'i' },
  { kana: 'ム', romaji: 'mu', row: 'm', column: 'u' },
  { kana: 'メ', romaji: 'me', row: 'm', column: 'e' },
  { kana: 'モ', romaji: 'mo', row: 'm', column: 'o' },
  // Y-row
  { kana: 'ヤ', romaji: 'ya', row: 'y', column: 'a' },
  { kana: 'ユ', romaji: 'yu', row: 'y', column: 'u' },
  { kana: 'ヨ', romaji: 'yo', row: 'y', column: 'o' },
  // R-row
  { kana: 'ラ', romaji: 'ra', row: 'r', column: 'a' },
  { kana: 'リ', romaji: 'ri', row: 'r', column: 'i' },
  { kana: 'ル', romaji: 'ru', row: 'r', column: 'u' },
  { kana: 'レ', romaji: 're', row: 'r', column: 'e' },
  { kana: 'ロ', romaji: 'ro', row: 'r', column: 'o' },
  // W-row
  { kana: 'ワ', romaji: 'wa', row: 'w', column: 'a' },
  { kana: 'ヲ', romaji: 'wo', row: 'w', column: 'o' },
  // N
  { kana: 'ン', romaji: 'n', row: 'special', column: 'n' },
];

/**
 * Get kana principles relevant to given characters.
 */
export function getKanaPrinciplesForContext(chars: string[]): DesignPrinciple[] {
  return KANA_DESIGN_PRINCIPLES.filter((p) =>
    p.examples.some((ex) =>
      chars.some((c) => ex.chars.includes(c)),
    ),
  );
}
