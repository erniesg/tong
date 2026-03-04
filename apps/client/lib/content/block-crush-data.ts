/* ── Block Crush — Character composition database ──────────── */

export interface CompositionTarget {
  char: string;
  components: {
    piece: string;
    slot: string;
    colorHint: string;
  }[];
  romanization: string;
  meaning: string;
  difficulty: number;
  language: 'ko' | 'zh' | 'ja';
}

/* ── Vowel classification ────────────────────────────────── */

/** Vertical vowels — go to the RIGHT of the consonant */
const VERTICAL_VOWELS = new Set('ㅏㅑㅓㅕㅣㅐㅔㅒㅖ');
/** Horizontal vowels — go BELOW the consonant */
const HORIZONTAL_VOWELS = new Set('ㅗㅛㅜㅠㅡ');

/* ── Korean: jamo → syllable blocks ──────────────────────── */

// Colors: C=gold, V=green, F=blue
const C = '#f0c040';
const V = '#4ecdc4';
const F = '#7eb8da';

const KOREAN_TARGETS: CompositionTarget[] = [
  // Level 1 — CV (vertical vowels: C|V side by side)
  { char: '가', components: [{ piece: 'ㄱ', slot: 'C', colorHint: C }, { piece: 'ㅏ', slot: 'V', colorHint: V }], romanization: 'ga', meaning: 'go', difficulty: 1, language: 'ko' },
  { char: '나', components: [{ piece: 'ㄴ', slot: 'C', colorHint: C }, { piece: 'ㅏ', slot: 'V', colorHint: V }], romanization: 'na', meaning: 'I / me', difficulty: 1, language: 'ko' },
  { char: '다', components: [{ piece: 'ㄷ', slot: 'C', colorHint: C }, { piece: 'ㅏ', slot: 'V', colorHint: V }], romanization: 'da', meaning: 'all', difficulty: 1, language: 'ko' },
  { char: '마', components: [{ piece: 'ㅁ', slot: 'C', colorHint: C }, { piece: 'ㅏ', slot: 'V', colorHint: V }], romanization: 'ma', meaning: 'horse', difficulty: 1, language: 'ko' },
  { char: '사', components: [{ piece: 'ㅅ', slot: 'C', colorHint: C }, { piece: 'ㅏ', slot: 'V', colorHint: V }], romanization: 'sa', meaning: 'four', difficulty: 1, language: 'ko' },
  { char: '아', components: [{ piece: 'ㅇ', slot: 'C', colorHint: C }, { piece: 'ㅏ', slot: 'V', colorHint: V }], romanization: 'a', meaning: 'ah', difficulty: 1, language: 'ko' },
  { char: '자', components: [{ piece: 'ㅈ', slot: 'C', colorHint: C }, { piece: 'ㅏ', slot: 'V', colorHint: V }], romanization: 'ja', meaning: 'ruler', difficulty: 1, language: 'ko' },
  { char: '하', components: [{ piece: 'ㅎ', slot: 'C', colorHint: C }, { piece: 'ㅏ', slot: 'V', colorHint: V }], romanization: 'ha', meaning: 'do', difficulty: 1, language: 'ko' },
  // CV (horizontal vowels: C on top, V below)
  { char: '고', components: [{ piece: 'ㄱ', slot: 'C', colorHint: C }, { piece: 'ㅗ', slot: 'V', colorHint: V }], romanization: 'go', meaning: 'high', difficulty: 1, language: 'ko' },
  { char: '노', components: [{ piece: 'ㄴ', slot: 'C', colorHint: C }, { piece: 'ㅗ', slot: 'V', colorHint: V }], romanization: 'no', meaning: 'old', difficulty: 1, language: 'ko' },
  { char: '두', components: [{ piece: 'ㄷ', slot: 'C', colorHint: C }, { piece: 'ㅜ', slot: 'V', colorHint: V }], romanization: 'du', meaning: 'two', difficulty: 1, language: 'ko' },
  { char: '무', components: [{ piece: 'ㅁ', slot: 'C', colorHint: C }, { piece: 'ㅜ', slot: 'V', colorHint: V }], romanization: 'mu', meaning: 'nothing', difficulty: 1, language: 'ko' },

  // Level 2 — CVC (vertical vowel: C|V top, F bottom)
  { char: '한', components: [{ piece: 'ㅎ', slot: 'C', colorHint: C }, { piece: 'ㅏ', slot: 'V', colorHint: V }, { piece: 'ㄴ', slot: 'F', colorHint: F }], romanization: 'han', meaning: 'Korea / one', difficulty: 2, language: 'ko' },
  { char: '말', components: [{ piece: 'ㅁ', slot: 'C', colorHint: C }, { piece: 'ㅏ', slot: 'V', colorHint: V }, { piece: 'ㄹ', slot: 'F', colorHint: F }], romanization: 'mal', meaning: 'words', difficulty: 2, language: 'ko' },
  { char: '밥', components: [{ piece: 'ㅂ', slot: 'C', colorHint: C }, { piece: 'ㅏ', slot: 'V', colorHint: V }, { piece: 'ㅂ', slot: 'F', colorHint: F }], romanization: 'bap', meaning: 'rice', difficulty: 2, language: 'ko' },
  { char: '김', components: [{ piece: 'ㄱ', slot: 'C', colorHint: C }, { piece: 'ㅣ', slot: 'V', colorHint: V }, { piece: 'ㅁ', slot: 'F', colorHint: F }], romanization: 'gim', meaning: 'seaweed', difficulty: 2, language: 'ko' },
  { char: '집', components: [{ piece: 'ㅈ', slot: 'C', colorHint: C }, { piece: 'ㅣ', slot: 'V', colorHint: V }, { piece: 'ㅂ', slot: 'F', colorHint: F }], romanization: 'jip', meaning: 'house', difficulty: 2, language: 'ko' },
  { char: '빵', components: [{ piece: 'ㅃ', slot: 'C', colorHint: C }, { piece: 'ㅏ', slot: 'V', colorHint: V }, { piece: 'ㅇ', slot: 'F', colorHint: F }], romanization: 'ppang', meaning: 'bread', difficulty: 2, language: 'ko' },
  { char: '떡', components: [{ piece: 'ㄸ', slot: 'C', colorHint: C }, { piece: 'ㅓ', slot: 'V', colorHint: V }, { piece: 'ㄱ', slot: 'F', colorHint: F }], romanization: 'tteok', meaning: 'rice cake', difficulty: 2, language: 'ko' },
  // CVC (horizontal vowel: C top, V middle, F bottom — all stacked)
  { char: '곰', components: [{ piece: 'ㄱ', slot: 'C', colorHint: C }, { piece: 'ㅗ', slot: 'V', colorHint: V }, { piece: 'ㅁ', slot: 'F', colorHint: F }], romanization: 'gom', meaning: 'bear', difficulty: 2, language: 'ko' },
  { char: '문', components: [{ piece: 'ㅁ', slot: 'C', colorHint: C }, { piece: 'ㅜ', slot: 'V', colorHint: V }, { piece: 'ㄴ', slot: 'F', colorHint: F }], romanization: 'mun', meaning: 'door', difficulty: 2, language: 'ko' },
  { char: '글', components: [{ piece: 'ㄱ', slot: 'C', colorHint: C }, { piece: 'ㅡ', slot: 'V', colorHint: V }, { piece: 'ㄹ', slot: 'F', colorHint: F }], romanization: 'geul', meaning: 'writing', difficulty: 2, language: 'ko' },
  { char: '둥', components: [{ piece: 'ㄷ', slot: 'C', colorHint: C }, { piece: 'ㅜ', slot: 'V', colorHint: V }, { piece: 'ㅇ', slot: 'F', colorHint: F }], romanization: 'dung', meaning: 'round', difficulty: 2, language: 'ko' },

  // Level 3
  { char: '국', components: [{ piece: 'ㄱ', slot: 'C', colorHint: C }, { piece: 'ㅜ', slot: 'V', colorHint: V }, { piece: 'ㄱ', slot: 'F', colorHint: F }], romanization: 'guk', meaning: 'country', difficulty: 3, language: 'ko' },
  { char: '감', components: [{ piece: 'ㄱ', slot: 'C', colorHint: C }, { piece: 'ㅏ', slot: 'V', colorHint: V }, { piece: 'ㅁ', slot: 'F', colorHint: F }], romanization: 'gam', meaning: 'feeling', difficulty: 3, language: 'ko' },
  { char: '랑', components: [{ piece: 'ㄹ', slot: 'C', colorHint: C }, { piece: 'ㅏ', slot: 'V', colorHint: V }, { piece: 'ㅇ', slot: 'F', colorHint: F }], romanization: 'rang', meaning: 'love (사랑)', difficulty: 3, language: 'ko' },
];

/* ── Chinese: radical → character ────────────────────────── */

const CHINESE_TARGETS: CompositionTarget[] = [
  // left-right
  { char: '好', components: [{ piece: '女', slot: 'left', colorHint: C }, { piece: '子', slot: 'right', colorHint: V }], romanization: 'hǎo', meaning: 'good', difficulty: 1, language: 'zh' },
  { char: '明', components: [{ piece: '日', slot: 'left', colorHint: C }, { piece: '月', slot: 'right', colorHint: V }], romanization: 'míng', meaning: 'bright', difficulty: 1, language: 'zh' },
  { char: '林', components: [{ piece: '木', slot: 'left', colorHint: C }, { piece: '木', slot: 'right', colorHint: V }], romanization: 'lín', meaning: 'forest', difficulty: 1, language: 'zh' },
  { char: '休', components: [{ piece: '亻', slot: 'left', colorHint: C }, { piece: '木', slot: 'right', colorHint: V }], romanization: 'xiū', meaning: 'rest', difficulty: 1, language: 'zh' },
  { char: '他', components: [{ piece: '亻', slot: 'left', colorHint: C }, { piece: '也', slot: 'right', colorHint: V }], romanization: 'tā', meaning: 'he', difficulty: 1, language: 'zh' },
  { char: '妈', components: [{ piece: '女', slot: 'left', colorHint: C }, { piece: '马', slot: 'right', colorHint: V }], romanization: 'mā', meaning: 'mom', difficulty: 1, language: 'zh' },
  // top-bottom
  { char: '花', components: [{ piece: '艹', slot: 'top', colorHint: C }, { piece: '化', slot: 'bottom', colorHint: V }], romanization: 'huā', meaning: 'flower', difficulty: 2, language: 'zh' },
  { char: '字', components: [{ piece: '宀', slot: 'top', colorHint: C }, { piece: '子', slot: 'bottom', colorHint: V }], romanization: 'zì', meaning: 'character', difficulty: 2, language: 'zh' },
  { char: '男', components: [{ piece: '田', slot: 'top', colorHint: C }, { piece: '力', slot: 'bottom', colorHint: V }], romanization: 'nán', meaning: 'male', difficulty: 2, language: 'zh' },
  { char: '安', components: [{ piece: '宀', slot: 'top', colorHint: C }, { piece: '女', slot: 'bottom', colorHint: V }], romanization: 'ān', meaning: 'peace', difficulty: 2, language: 'zh' },
  { char: '思', components: [{ piece: '田', slot: 'top', colorHint: C }, { piece: '心', slot: 'bottom', colorHint: V }], romanization: 'sī', meaning: 'think', difficulty: 2, language: 'zh' },
  // water radical
  { char: '清', components: [{ piece: '氵', slot: 'left', colorHint: C }, { piece: '青', slot: 'right', colorHint: V }], romanization: 'qīng', meaning: 'clear', difficulty: 3, language: 'zh' },
  { char: '湖', components: [{ piece: '氵', slot: 'left', colorHint: C }, { piece: '胡', slot: 'right', colorHint: V }], romanization: 'hú', meaning: 'lake', difficulty: 3, language: 'zh' },
  { char: '河', components: [{ piece: '氵', slot: 'left', colorHint: C }, { piece: '可', slot: 'right', colorHint: V }], romanization: 'hé', meaning: 'river', difficulty: 3, language: 'zh' },
];

/* ── Japanese: dakuten / kana composition ────────────────── */

const JAPANESE_TARGETS: CompositionTarget[] = [
  { char: 'が', components: [{ piece: 'か', slot: 'base', colorHint: C }, { piece: '゛', slot: 'dakuten', colorHint: V }], romanization: 'ga', meaning: 'ga (subject)', difficulty: 1, language: 'ja' },
  { char: 'ぎ', components: [{ piece: 'き', slot: 'base', colorHint: C }, { piece: '゛', slot: 'dakuten', colorHint: V }], romanization: 'gi', meaning: 'gi', difficulty: 1, language: 'ja' },
  { char: 'ぐ', components: [{ piece: 'く', slot: 'base', colorHint: C }, { piece: '゛', slot: 'dakuten', colorHint: V }], romanization: 'gu', meaning: 'gu', difficulty: 1, language: 'ja' },
  { char: 'ば', components: [{ piece: 'は', slot: 'base', colorHint: C }, { piece: '゛', slot: 'dakuten', colorHint: V }], romanization: 'ba', meaning: 'ba', difficulty: 1, language: 'ja' },
  { char: 'ぱ', components: [{ piece: 'は', slot: 'base', colorHint: C }, { piece: '゜', slot: 'handakuten', colorHint: '#ffe66d' }], romanization: 'pa', meaning: 'pa', difficulty: 1, language: 'ja' },
  { char: 'だ', components: [{ piece: 'た', slot: 'base', colorHint: C }, { piece: '゛', slot: 'dakuten', colorHint: V }], romanization: 'da', meaning: 'da', difficulty: 1, language: 'ja' },
  // hiragana ↔ katakana
  { char: 'ア', components: [{ piece: 'あ', slot: 'hiragana', colorHint: C }, { piece: '→カタカナ', slot: 'convert', colorHint: V }], romanization: 'a', meaning: 'a (katakana)', difficulty: 2, language: 'ja' },
  { char: 'カ', components: [{ piece: 'か', slot: 'hiragana', colorHint: C }, { piece: '→カタカナ', slot: 'convert', colorHint: V }], romanization: 'ka', meaning: 'ka (katakana)', difficulty: 2, language: 'ja' },
  { char: 'サ', components: [{ piece: 'さ', slot: 'hiragana', colorHint: C }, { piece: '→カタカナ', slot: 'convert', colorHint: V }], romanization: 'sa', meaning: 'sa (katakana)', difficulty: 2, language: 'ja' },
  { char: 'タ', components: [{ piece: 'た', slot: 'hiragana', colorHint: C }, { piece: '→カタカナ', slot: 'convert', colorHint: V }], romanization: 'ta', meaning: 'ta (katakana)', difficulty: 2, language: 'ja' },
  // kanji
  { char: '休', components: [{ piece: '亻', slot: 'left', colorHint: C }, { piece: '木', slot: 'right', colorHint: V }], romanization: 'yasumi', meaning: 'rest', difficulty: 3, language: 'ja' },
  { char: '林', components: [{ piece: '木', slot: 'left', colorHint: C }, { piece: '木', slot: 'right', colorHint: V }], romanization: 'hayashi', meaning: 'grove', difficulty: 3, language: 'ja' },
  { char: '明', components: [{ piece: '日', slot: 'left', colorHint: C }, { piece: '月', slot: 'right', colorHint: V }], romanization: 'mei / akari', meaning: 'bright', difficulty: 3, language: 'ja' },
];

/* ── Name-specific targets (tutorial) ──────────────────── */

export const NAME_TARGETS: Record<string, CompositionTarget[]> = {
  hauen: [
    { char: '하', components: [
      { piece: 'ㅎ', slot: 'C', colorHint: C },
      { piece: 'ㅏ', slot: 'V', colorHint: V },
    ], romanization: 'ha', meaning: 'Ha-', difficulty: 1, language: 'ko' },
    { char: '은', components: [
      { piece: 'ㅇ', slot: 'C', colorHint: C },
      { piece: 'ㅡ', slot: 'V', colorHint: V },
      { piece: 'ㄴ', slot: 'F', colorHint: F },
    ], romanization: 'eun', meaning: 'silver/grace', difficulty: 2, language: 'ko' },
  ],
  jin: [
    { char: '진', components: [
      { piece: 'ㅈ', slot: 'C', colorHint: C },
      { piece: 'ㅣ', slot: 'V', colorHint: V },
      { piece: 'ㄴ', slot: 'F', colorHint: F },
    ], romanization: 'jin', meaning: 'truth/precious', difficulty: 2, language: 'ko' },
  ],
};

export function getNameTargets(characterId: string): CompositionTarget[] {
  return NAME_TARGETS[characterId] ?? [];
}

/* ── Meaning translations ────────────────────────────────── */

/** Translate English meaning key → explainIn language. Falls back to English. */
const MEANING_I18N: Record<string, Record<string, string>> = {
  // Korean char meanings
  'go':            { zh: '去', ja: '行く' },
  'I / me':        { zh: '我', ja: '私' },
  'all':           { zh: '全部', ja: '全て' },
  'horse':         { zh: '马', ja: '馬' },
  'four':          { zh: '四', ja: '四' },
  'ah':            { zh: '啊', ja: 'ああ' },
  'ruler':         { zh: '尺子', ja: '定規' },
  'do':            { zh: '做', ja: 'する' },
  'high':          { zh: '高', ja: '高い' },
  'old':           { zh: '老', ja: '古い' },
  'two':           { zh: '二', ja: '二' },
  'nothing':       { zh: '无', ja: '無' },
  'Korea / one':   { zh: '韩/一', ja: '韓/一' },
  'words':         { zh: '话', ja: '言葉' },
  'rice':          { zh: '饭', ja: 'ご飯' },
  'seaweed':       { zh: '海苔', ja: '海苔' },
  'house':         { zh: '房子', ja: '家' },
  'bread':         { zh: '面包', ja: 'パン' },
  'rice cake':     { zh: '年糕', ja: '餅' },
  'bear':          { zh: '熊', ja: '熊' },
  'door':          { zh: '门', ja: '門' },
  'writing':       { zh: '文字', ja: '文' },
  'round':         { zh: '圆', ja: '丸い' },
  'country':       { zh: '国家', ja: '国' },
  'feeling':       { zh: '感觉', ja: '感じ' },
  'love (사랑)':   { zh: '爱', ja: '愛' },
  // Chinese char meanings
  'good':          { ko: '좋다', ja: '良い' },
  'bright':        { ko: '밝다', ja: '明るい' },
  'forest':        { ko: '숲', ja: '林' },
  'rest':          { ko: '쉬다', ja: '休み' },
  'he':            { ko: '그', ja: '彼' },
  'mom':           { ko: '엄마', ja: 'お母さん' },
  'flower':        { ko: '꽃', ja: '花' },
  'character':     { ko: '글자', ja: '字' },
  'male':          { ko: '남자', ja: '男' },
  'peace':         { ko: '평화', ja: '平和' },
  'think':         { ko: '생각', ja: '思う' },
  'clear':         { ko: '맑다', ja: '清い' },
  'lake':          { ko: '호수', ja: '湖' },
  'river':         { ko: '강', ja: '川' },
  // Japanese char meanings
  'grove':         { ko: '숲', zh: '林' },
  // Name-specific
  'Ha-':           { zh: '哈', ja: 'ハ' },
  'silver/grace':  { zh: '银/恩', ja: '銀/恩' },
  'truth/precious': { zh: '真/珍', ja: '真/珍' },
};

export function getMeaning(englishMeaning: string, explainIn: string): string {
  if (explainIn === 'en') return englishMeaning;
  return MEANING_I18N[englishMeaning]?.[explainIn] ?? englishMeaning;
}

/* ── Distractor pieces per language ──────────────────────── */

export const DISTRACTORS: Record<'ko' | 'zh' | 'ja', string[]> = {
  ko: ['ㅋ', 'ㅌ', 'ㅍ', 'ㅊ', 'ㅉ', 'ㅃ', 'ㄲ', 'ㅕ', 'ㅛ', 'ㅠ', 'ㅐ', 'ㅔ'],
  zh: ['口', '手', '火', '水', '山', '人', '大', '小', '门', '石', '土', '金'],
  ja: ['ぬ', 'ね', 'の', 'む', 'め', 'も', 'る', 'れ', 'ろ', 'ん', 'を', 'わ'],
};

/* ── Accessors ───────────────────────────────────────────── */

const ALL_TARGETS: CompositionTarget[] = [
  ...KOREAN_TARGETS,
  ...CHINESE_TARGETS,
  ...JAPANESE_TARGETS,
];

export function getTargets(language: 'ko' | 'zh' | 'ja', difficulty?: number): CompositionTarget[] {
  return ALL_TARGETS.filter(
    (t) => t.language === language && (difficulty == null || t.difficulty <= difficulty),
  );
}

export function getRandomTarget(language: 'ko' | 'zh' | 'ja', difficulty: number): CompositionTarget {
  const pool = getTargets(language, difficulty);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getDistractors(language: 'ko' | 'zh' | 'ja', count: number, exclude: string[]): string[] {
  const pool = DISTRACTORS[language].filter((d) => !exclude.includes(d));
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/* ── Layout detection ────────────────────────────────────── */

/**
 * Korean syllable block layouts (determined by vowel shape):
 *  - ko-cv-lr:  C|V side by side        (가, vertical vowel)
 *  - ko-cv-tb:  C over V stacked        (고, horizontal vowel)
 *  - ko-cvf-lr: C|V top, F bottom       (한, vertical vowel + final)
 *  - ko-cvf-tb: C / V / F all stacked   (곰, horizontal vowel + final)
 *
 * Chinese/Japanese:
 *  - left-right, top-bottom, dakuten, convert
 */
export type SlotLayout =
  | 'ko-cv-lr' | 'ko-cv-tb'
  | 'ko-cvf-lr' | 'ko-cvf-tb'
  | 'left-right' | 'top-bottom'
  | 'dakuten' | 'convert';

export function getSlotLayout(target: CompositionTarget): SlotLayout {
  const slots = target.components.map((c) => c.slot);

  // Japanese
  if (slots.includes('dakuten') || slots.includes('handakuten')) return 'dakuten';
  if (slots.includes('convert')) return 'convert';

  // Chinese / Japanese kanji
  if (slots.includes('left') || slots.includes('right')) return 'left-right';
  if (slots.includes('top') || slots.includes('bottom')) return 'top-bottom';

  // Korean — determine from vowel piece
  const vowelComp = target.components.find((c) => c.slot === 'V');
  const vowel = vowelComp?.piece ?? '';
  const isHorizontal = HORIZONTAL_VOWELS.has(vowel);
  const hasFinal = slots.includes('F');

  if (hasFinal) return isHorizontal ? 'ko-cvf-tb' : 'ko-cvf-lr';
  return isHorizontal ? 'ko-cv-tb' : 'ko-cv-lr';
}
