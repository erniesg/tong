import type {
  MatchingExercise,
  MultipleChoiceExercise,
  DragDropExercise,
  SentenceBuilderExercise,
  FillBlankExercise,
  PronunciationSelectExercise,
  PatternRecognitionExercise,
  StrokeTracingExercise,
  BlockCrushExercise,
  ErrorCorrectionExercise,
  FreeInputExercise,
  ExerciseData,
} from '@/lib/types/hangout';
import { getRandomTarget, getTargets } from '@/lib/content/block-crush-data';
import type { CompositionTarget } from '@/lib/content/block-crush-data';
import { VOCABULARY_TARGETS } from '@/lib/content/pojangmacha';
import type { ItemMastery } from '@/lib/types/mastery';
import { getDueItems, getNewItems } from '@/lib/curriculum/srs';
import { HANGUL_DESIGN_PRINCIPLES } from '@/lib/content/scripts/hangul';
import { PINYIN_DESIGN_PRINCIPLES } from '@/lib/content/scripts/pinyin';
import { KANA_DESIGN_PRINCIPLES, HIRAGANA, KATAKANA } from '@/lib/content/scripts/kana';
import { getLocationVocab, getRegisteredLocationKeys } from '@/lib/content/locations';
import type { DesignPrinciple } from '@/lib/content/scripts/hangul';
import { t, tFmt } from '@/lib/i18n/ui-strings';
import type { UILang } from '@/lib/i18n/ui-strings';

export interface ExerciseHints {
  hintItems?: string[];
  hintCount?: number;
  hintSubType?: string;
  objectiveId?: string;
  mastery?: Record<string, ItemMastery>;
  language?: 'ko' | 'zh' | 'ja';
  cityId?: string;
  locationId?: string;
  explainIn?: UILang;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

/** Content-based stable ID: same content → same ID → mastery accumulates. */
function stableId(type: string, objectiveId: string, items: string[]): string {
  const key = `${type}:${objectiveId}:${items.sort().join(',')}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return `ex-${type}-${(hash >>> 0).toString(36)}`;
}

/* ── Generic item type used across all data pools ─────────── */

interface VocabItem {
  word: string;
  translation: string;
  romanization: string;
}

/* ── Script data (Level 0) ────────────────────────────────── */

const CONSONANTS: VocabItem[] = [
  { word: 'ㄱ', translation: 'g/k', romanization: 'giyeok' },
  { word: 'ㄴ', translation: 'n', romanization: 'nieun' },
  { word: 'ㄷ', translation: 'd/t', romanization: 'digeut' },
  { word: 'ㄹ', translation: 'r/l', romanization: 'rieul' },
  { word: 'ㅁ', translation: 'm', romanization: 'mieum' },
  { word: 'ㅂ', translation: 'b/p', romanization: 'bieup' },
  { word: 'ㅅ', translation: 's', romanization: 'siot' },
  { word: 'ㅇ', translation: 'ng (silent)', romanization: 'ieung' },
  { word: 'ㅈ', translation: 'j', romanization: 'jieut' },
  { word: 'ㅊ', translation: 'ch', romanization: 'chieut' },
  { word: 'ㅋ', translation: 'k', romanization: 'kieuk' },
  { word: 'ㅌ', translation: 't', romanization: 'tieut' },
  { word: 'ㅍ', translation: 'p', romanization: 'pieup' },
  { word: 'ㅎ', translation: 'h', romanization: 'hieut' },
];

const VOWELS: VocabItem[] = [
  { word: 'ㅏ', translation: 'a', romanization: 'a' },
  { word: 'ㅑ', translation: 'ya', romanization: 'ya' },
  { word: 'ㅓ', translation: 'eo', romanization: 'eo' },
  { word: 'ㅕ', translation: 'yeo', romanization: 'yeo' },
  { word: 'ㅗ', translation: 'o', romanization: 'o' },
  { word: 'ㅛ', translation: 'yo', romanization: 'yo' },
  { word: 'ㅜ', translation: 'u', romanization: 'u' },
  { word: 'ㅠ', translation: 'yu', romanization: 'yu' },
  { word: 'ㅡ', translation: 'eu', romanization: 'eu' },
  { word: 'ㅣ', translation: 'i', romanization: 'i' },
];

const ALL_JAMO: VocabItem[] = [...CONSONANTS, ...VOWELS];

/* ── Japanese kana as VocabItem pools ─────────────────────── */

const HIRAGANA_POOL: VocabItem[] = HIRAGANA.map((k) => ({
  word: k.kana, translation: k.romaji, romanization: k.romaji,
}));

const KATAKANA_POOL: VocabItem[] = KATAKANA.map((k) => ({
  word: k.kana, translation: k.romaji, romanization: k.romaji,
}));

const ALL_KANA: VocabItem[] = [...HIRAGANA_POOL, ...KATAKANA_POOL];

/* ── Chinese basic radicals & characters for stroke tracing ── */

const CHINESE_RADICALS: VocabItem[] = [
  // Standalone radicals that are also common characters
  { word: '一', translation: 'one', romanization: 'yī' },
  { word: '二', translation: 'two', romanization: 'èr' },
  { word: '三', translation: 'three', romanization: 'sān' },
  { word: '十', translation: 'ten', romanization: 'shí' },
  { word: '大', translation: 'big', romanization: 'dà' },
  { word: '小', translation: 'small', romanization: 'xiǎo' },
  { word: '人', translation: 'person', romanization: 'rén' },
  { word: '口', translation: 'mouth', romanization: 'kǒu' },
  { word: '日', translation: 'sun/day', romanization: 'rì' },
  { word: '月', translation: 'moon/month', romanization: 'yuè' },
  { word: '木', translation: 'tree/wood', romanization: 'mù' },
  { word: '水', translation: 'water', romanization: 'shuǐ' },
  { word: '火', translation: 'fire', romanization: 'huǒ' },
  { word: '土', translation: 'earth/soil', romanization: 'tǔ' },
  { word: '山', translation: 'mountain', romanization: 'shān' },
  { word: '石', translation: 'stone', romanization: 'shí' },
  { word: '田', translation: 'field', romanization: 'tián' },
  { word: '目', translation: 'eye', romanization: 'mù' },
  { word: '手', translation: 'hand', romanization: 'shǒu' },
  { word: '心', translation: 'heart', romanization: 'xīn' },
  { word: '女', translation: 'woman', romanization: 'nǚ' },
  { word: '子', translation: 'child', romanization: 'zǐ' },
  { word: '力', translation: 'power', romanization: 'lì' },
  { word: '刀', translation: 'knife', romanization: 'dāo' },
  { word: '中', translation: 'middle', romanization: 'zhōng' },
  { word: '天', translation: 'sky/heaven', romanization: 'tiān' },
  { word: '王', translation: 'king', romanization: 'wáng' },
  { word: '白', translation: 'white', romanization: 'bái' },
  { word: '金', translation: 'gold/metal', romanization: 'jīn' },
  { word: '雨', translation: 'rain', romanization: 'yǔ' },
];

/* ── Vocab pools derived from location content ────────────── */

/** Convert VocabularyTarget[] to VocabItem[] by category. */
function vocabByCategory(category: string): VocabItem[] {
  return VOCABULARY_TARGETS
    .filter((v) => v.category === category)
    .map((v) => ({ word: v.word, translation: v.translation, romanization: v.romanization }));
}

const MENU_WORDS: VocabItem[] = VOCABULARY_TARGETS
  .filter((v) => v.level === 0 && v.category === 'food_item')
  .map((v) => ({ word: v.word, translation: v.translation, romanization: v.romanization }));

const FOOD_VOCAB: VocabItem[] = [
  ...vocabByCategory('food_item'),
  ...vocabByCategory('drink'),
];

const TASTE_VOCAB: VocabItem[] = vocabByCategory('taste');
const NUMBER_VOCAB: VocabItem[] = vocabByCategory('number');
const VERB_VOCAB: VocabItem[] = vocabByCategory('verb');
const COURTESY_VOCAB: VocabItem[] = vocabByCategory('courtesy');

/** All vocab pools combined for fallback matching. */
const ALL_VOCAB: VocabItem[] = VOCABULARY_TARGETS.map((v) => ({
  word: v.word,
  translation: v.translation,
  romanization: v.romanization,
}));

/* ── Pool selection by objectiveId ────────────────────────── */

/** Map objectiveId prefix to the right data pool. */
function getPoolForObjective(objectiveId?: string): VocabItem[] {
  if (!objectiveId) return FOOD_VOCAB;
  if (objectiveId.includes('script-consonants')) return CONSONANTS;
  if (objectiveId.includes('script-vowels')) return VOWELS;
  if (objectiveId.includes('script-blocks') || objectiveId.includes('script-menu')) return MENU_WORDS;
  if (objectiveId.includes('pron')) return [...CONSONANTS, ...VOWELS, ...MENU_WORDS];
  if (objectiveId.includes('vocab-food')) return FOOD_VOCAB;
  if (objectiveId.includes('vocab-taste')) return TASTE_VOCAB;
  if (objectiveId.includes('vocab-numbers')) return NUMBER_VOCAB;
  if (objectiveId.includes('vocab-basic-verbs')) return VERB_VOCAB;
  if (objectiveId.includes('vocab-courtesy')) return COURTESY_VOCAB;
  if (objectiveId.includes('gram')) return COURTESY_VOCAB; // grammar uses courtesy phrases
  return FOOD_VOCAB;
}

/**
 * Get vocab pool for a specific city/location, falling back to Korean pools.
 * For non-Korean languages, pull from the location registry.
 */
function getPoolForLocation(
  language: 'ko' | 'zh' | 'ja',
  cityId?: string,
  locationId?: string,
  objectiveId?: string,
): VocabItem[] {
  if (language === 'ko') return getPoolForObjective(objectiveId);

  // For Chinese/Japanese: try location-specific vocab first
  if (cityId && locationId) {
    const locVocab = getLocationVocab(cityId, locationId);
    if (locVocab.length > 0) return locVocab;
  }

  // Fallback: aggregate all vocab from the city's registered locations
  const cityId_ = language === 'zh' ? 'shanghai' : 'tokyo';
  const cityPrefix = `${cityId_}:`;
  const cityLocationKeys = getRegisteredLocationKeys().filter((k) => k.startsWith(cityPrefix));
  const allVocab: VocabItem[] = [];
  for (const key of cityLocationKeys) {
    const locId = key.slice(cityPrefix.length);
    allVocab.push(...getLocationVocab(cityId_, locId));
  }
  return allVocab.length > 0 ? allVocab : getPoolForObjective(objectiveId);
}

/** Get design principles for a given language. */
function getDesignPrinciplesForLanguage(language: 'ko' | 'zh' | 'ja'): DesignPrinciple[] {
  switch (language) {
    case 'ko': return HANGUL_DESIGN_PRINCIPLES;
    case 'zh': return PINYIN_DESIGN_PRINCIPLES;
    case 'ja': return KANA_DESIGN_PRINCIPLES;
  }
}

/**
 * Select items from the right pool, prioritizing hintItems and SRS due items.
 * Falls back across ALL pools if hints don't match the primary pool.
 */
function selectItems(
  count: number,
  pool: VocabItem[],
  hintItems?: string[],
  mastery?: Record<string, ItemMastery>,
): VocabItem[] {
  if (!hintItems || hintItems.length === 0) {
    // SRS-aware: prioritize due items, then unseen, then rest
    if (mastery && Object.keys(mastery).length > 0) {
      const poolWords = pool.map((v) => v.word);
      const dueWords = getDueItems(mastery).filter((w) => poolWords.includes(w));
      const newWords = getNewItems(mastery, poolWords);
      const prioritized: VocabItem[] = [];
      // Add due items first
      for (const w of dueWords) {
        const item = pool.find((v) => v.word === w);
        if (item && prioritized.length < count) prioritized.push(item);
      }
      // Then unseen items
      for (const w of newWords) {
        const item = pool.find((v) => v.word === w);
        if (item && prioritized.length < count) prioritized.push(item);
      }
      // Pad with random from pool if needed
      if (prioritized.length < count) {
        const used = new Set(prioritized.map((v) => v.word));
        const rest = pool.filter((v) => !used.has(v.word));
        prioritized.push(...pick(rest, count - prioritized.length));
      }
      if (prioritized.length > 0) return shuffle(prioritized);
    }
    return pick(pool, Math.min(count, pool.length));
  }

  const hintSet = new Set(hintItems);

  // Try primary pool first
  let matched = pool.filter((v) => hintSet.has(v.word));

  // If hints don't match pool, search ALL data (jamo + vocab)
  if (matched.length === 0) {
    const allData = [...ALL_JAMO, ...ALL_VOCAB];
    matched = allData.filter((v) => hintSet.has(v.word));
  }

  const rest = pool.filter((v) => !hintSet.has(v.word));
  const needed = Math.min(count, Math.max(pool.length, matched.length));

  if (matched.length >= needed) {
    return shuffle(matched).slice(0, needed);
  }

  // Pad with items from the pool that aren't already matched
  const padded = [...matched, ...pick(rest, needed - matched.length)];
  return shuffle(padded);
}

/* ── Generators ───────────────────────────────────────────── */

function generateMatching(
  pool: VocabItem[],
  objectiveId: string,
  count: number,
  hintItems?: string[],
  hintSubType?: string,
  mastery?: Record<string, ItemMastery>,
  explainIn: UILang = 'en',
): MatchingExercise {
  const selected = selectItems(count, pool, hintItems, mastery);
  const isScript = objectiveId.includes('script') || objectiveId.includes('pron');
  const isSound = hintSubType === 'sound_quiz';

  return {
    type: 'matching',
    id: stableId('matching', objectiveId, selected.map((v) => v.word)),
    objectiveId,
    difficulty: isScript ? 1 : 2,
    prompt: isSound
      ? t('match_symbol_sound', explainIn)
      : isScript
        ? t('match_char_roman', explainIn)
        : t('match_words_meaning', explainIn),
    pairs: selected.map((v) => ({
      left: v.word,
      right: isSound ? v.romanization : v.translation,
    })),
  };
}

function generateMultipleChoice(
  pool: VocabItem[],
  objectiveId: string,
  hintItems?: string[],
  hintSubType?: string,
  mastery?: Record<string, ItemMastery>,
  explainIn: UILang = 'en',
): MultipleChoiceExercise {
  const selected = selectItems(4, pool, hintItems, mastery);
  const target = selected[0];
  const isScript = objectiveId.includes('script') || objectiveId.includes('pron');
  const isVisual = hintSubType === 'visual_recognition';
  const isSound = hintSubType === 'sound_quiz';

  let prompt: string;
  let options: { id: string; text: string }[];

  if (isVisual) {
    prompt = tFmt('which_sound', explainIn, target.romanization);
    options = selected.map((v, i) => ({
      id: i === 0 ? 'correct' : `d${i}`,
      text: v.word,
    }));
  } else if (isSound) {
    prompt = tFmt('what_sound', explainIn, target.word);
    options = selected.map((v, i) => ({
      id: i === 0 ? 'correct' : `d${i}`,
      text: v.romanization,
    }));
  } else {
    prompt = tFmt('what_means', explainIn, target.word);
    options = selected.map((v, i) => ({
      id: i === 0 ? 'correct' : `d${i}`,
      text: v.translation,
    }));
  }

  return {
    type: 'multiple_choice',
    id: stableId('mc', objectiveId, [target.word]),
    objectiveId,
    difficulty: isScript ? 1 : 2,
    prompt,
    options: shuffle(options),
    correctOptionId: 'correct',
    explanation: `${target.word} (${target.romanization}) = ${target.translation}`,
  };
}

function generateDragDrop(
  pool: VocabItem[],
  objectiveId: string,
  count: number,
  hintItems?: string[],
  hintSubType?: string,
  mastery?: Record<string, ItemMastery>,
  explainIn: UILang = 'en',
): DragDropExercise {
  const selected = selectItems(count, pool, hintItems, mastery);
  const isScript = objectiveId.includes('script') || objectiveId.includes('pron');
  const isSound = hintSubType === 'sound_quiz';

  const items = selected.map((v) => ({
    id: `item-${v.word}`,
    text: v.word,
  }));

  const targets = shuffle(selected).map((v) => ({
    id: `target-${v.word}`,
    label: isSound ? v.romanization : v.translation,
  }));

  const correctMapping: Record<string, string> = {};
  for (const v of selected) {
    correctMapping[`item-${v.word}`] = `target-${v.word}`;
  }

  return {
    type: 'drag_drop',
    id: stableId('dd', objectiveId, selected.map((v) => v.word)),
    objectiveId,
    difficulty: isScript ? 1 : 2,
    prompt: isSound
      ? t('match_symbol_sound', explainIn)
      : isScript
        ? t('match_char_roman', explainIn)
        : t('match_words_meaning', explainIn),
    items: shuffle(items),
    targets,
    correctMapping,
  };
}

/* ── Sentence builder data ───────────────────────────────── */

interface SentencePattern {
  words: string[];
  correctOrder: string[];
  distractors: string[];
  prompt: string;
  explanation: string;
}

const SENTENCE_PATTERNS: SentencePattern[] = [
  {
    words: ['주세요', '떡볶이'],
    correctOrder: ['떡볶이', '주세요'],
    distractors: ['감사합니다', '맵다'],
    prompt: 'Build: "Tteokbokki please"',
    explanation: '떡볶이 주세요 = Tteokbokki please (N + 주세요)',
  },
  {
    words: ['주세요', '물'],
    correctOrder: ['물', '주세요'],
    distractors: ['먹다', '짜다'],
    prompt: 'Build: "Water please"',
    explanation: '물 주세요 = Water please (N + 주세요)',
  },
  {
    words: ['을', '김밥', '주세요'],
    correctOrder: ['김밥', '을', '주세요'],
    distractors: ['달다'],
    prompt: 'Build: "Gimbap please" (with particle)',
    explanation: '김밥을 주세요 = Please give me gimbap (N+을/를 주세요)',
  },
  {
    words: ['를', '라면', '주세요'],
    correctOrder: ['라면', '을', '주세요'],
    distractors: ['맵다'],
    prompt: 'Build: "Ramen please" (with particle)',
    explanation: '라면을 주세요 = Please give me ramen (N+을/를 주세요)',
  },
  {
    words: ['개', '세', '주세요', '떡볶이'],
    correctOrder: ['떡볶이', '세', '개', '주세요'],
    distractors: [],
    prompt: 'Build: "Three tteokbokki please"',
    explanation: '떡볶이 세 개 주세요 = Three tteokbokki please (N + counter + 주세요)',
  },
];

/* ── Fill-blank data ────────────────────────────────────────── */

interface FillBlankPattern {
  sentence: string;
  blankIndex: number;
  correct: string;
  distractors: string[];
  grammarNote: string;
  prompt: string;
}

const FILL_BLANK_PATTERNS: FillBlankPattern[] = [
  {
    sentence: '떡볶이 ___ 주세요',
    blankIndex: 1,
    correct: '을',
    distractors: ['를', '은', '이'],
    grammarNote: '을 is used after consonant-ending nouns (떡볶이 ends with ㅣ vowel, but 을 is common in casual speech)',
    prompt: 'Fill in the correct particle',
  },
  {
    sentence: '물 ___ 주세요',
    blankIndex: 1,
    correct: '을',
    distractors: ['를', '은', '이'],
    grammarNote: '을 is the object particle after consonant-ending nouns (물 ends with ㄹ)',
    prompt: 'Fill in the correct particle',
  },
  {
    sentence: '김밥 ___ 맛있다',
    blankIndex: 1,
    correct: '이',
    distractors: ['을', '는', '를'],
    grammarNote: '이 is the subject particle after consonant-ending nouns',
    prompt: 'Fill in the correct particle',
  },
  {
    sentence: '라면 ___ 개 주세요',
    blankIndex: 1,
    correct: '세',
    distractors: ['하나', '다섯', '두'],
    grammarNote: '세 = three (native Korean number before counter)',
    prompt: 'Fill in the correct number',
  },
  {
    sentence: '여기 ___ 얼마예요?',
    blankIndex: 1,
    correct: '이거',
    distractors: ['저거', '그거', '뭐'],
    grammarNote: '이거 = this thing (pointing at something near you)',
    prompt: 'Fill in: "How much is this here?"',
  },
];

/* ── Pronunciation jamo pool ────────────────────────────────── */

const JAMO_SOUNDS: { char: string; romanization: string; sound: string }[] = [
  { char: 'ㄱ', romanization: 'giyeok', sound: 'g/k' },
  { char: 'ㄴ', romanization: 'nieun', sound: 'n' },
  { char: 'ㄷ', romanization: 'digeut', sound: 'd/t' },
  { char: 'ㄹ', romanization: 'rieul', sound: 'r/l' },
  { char: 'ㅁ', romanization: 'mieum', sound: 'm' },
  { char: 'ㅂ', romanization: 'bieup', sound: 'b/p' },
  { char: 'ㅅ', romanization: 'siot', sound: 's' },
  { char: 'ㅈ', romanization: 'jieut', sound: 'j' },
  { char: 'ㅎ', romanization: 'hieut', sound: 'h' },
  { char: 'ㅏ', romanization: 'a', sound: 'ah' },
  { char: 'ㅓ', romanization: 'eo', sound: 'uh' },
  { char: 'ㅗ', romanization: 'o', sound: 'oh' },
  { char: 'ㅜ', romanization: 'u', sound: 'oo' },
  { char: 'ㅡ', romanization: 'eu', sound: 'eu' },
  { char: 'ㅣ', romanization: 'i', sound: 'ee' },
];

/* ── New generators ─────────────────────────────────────────── */

function generateSentenceBuilder(
  _pool: VocabItem[],
  objectiveId: string,
  hintItems?: string[],
): SentenceBuilderExercise {
  // Pick a pattern, preferring ones matching hintItems
  let pattern = SENTENCE_PATTERNS[Math.floor(Math.random() * SENTENCE_PATTERNS.length)];
  if (hintItems && hintItems.length > 0) {
    const matching = SENTENCE_PATTERNS.filter((p) =>
      p.correctOrder.some((w) => hintItems.includes(w)),
    );
    if (matching.length > 0) {
      pattern = matching[Math.floor(Math.random() * matching.length)];
    }
  }

  const allTiles = shuffle([...pattern.words, ...pattern.distractors]);

  return {
    type: 'sentence_builder',
    id: stableId('sb', objectiveId, pattern.correctOrder),
    objectiveId,
    difficulty: pattern.correctOrder.length > 3 ? 3 : 2,
    prompt: pattern.prompt,
    wordTiles: allTiles,
    correctOrder: pattern.correctOrder,
    distractors: pattern.distractors,
    explanation: pattern.explanation,
  };
}

function generateFillBlank(
  _pool: VocabItem[],
  objectiveId: string,
  hintItems?: string[],
): FillBlankExercise {
  let pattern = FILL_BLANK_PATTERNS[Math.floor(Math.random() * FILL_BLANK_PATTERNS.length)];
  if (hintItems && hintItems.length > 0) {
    const matching = FILL_BLANK_PATTERNS.filter((p) =>
      hintItems.some((h) => p.sentence.includes(h) || p.correct === h),
    );
    if (matching.length > 0) {
      pattern = matching[Math.floor(Math.random() * matching.length)];
    }
  }

  const options = shuffle([
    { id: 'correct', text: pattern.correct },
    ...pattern.distractors.map((d, i) => ({ id: `d${i}`, text: d })),
  ]);

  return {
    type: 'fill_blank',
    id: stableId('fb', objectiveId, [pattern.correct, pattern.sentence]),
    objectiveId,
    difficulty: 2,
    prompt: pattern.prompt,
    sentence: pattern.sentence,
    blankIndex: pattern.blankIndex,
    options,
    correctOptionId: 'correct',
    grammarNote: pattern.grammarNote,
    explanation: `${pattern.sentence.replace('___', pattern.correct)}`,
  };
}

/** Similar-sounding Korean name/word distractors for pronunciation exercises. */
const KOREAN_NAME_DISTRACTORS: Record<string, string[]> = {
  '하은': ['하윤', '하영', '하연'],
  '하윤': ['하은', '하영', '하연'],
  '하영': ['하은', '하윤', '하연'],
  '진': ['민', '빈', '신'],
};

/** Generate similar-sounding distractors for any Korean word by swapping vowels/consonants. */
function generateWordDistractors(word: string, count: number): string[] {
  if (KOREAN_NAME_DISTRACTORS[word]) {
    return shuffle(KOREAN_NAME_DISTRACTORS[word]).slice(0, count);
  }
  // For unknown words, swap last syllable's vowel to create distractors
  const vowelSwaps: Record<string, string[]> = {
    '아': ['어', '오', '우'], '어': ['아', '오', '이'], '오': ['우', '아', '어'],
    '우': ['오', '으', '아'], '은': ['인', '안', '운'], '이': ['으', '어', '아'],
    '으': ['이', '우', '어'],
  };
  const lastChar = word[word.length - 1];
  const swaps = vowelSwaps[lastChar];
  if (swaps) {
    return swaps.slice(0, count).map((s) => word.slice(0, -1) + s);
  }
  // Fallback: return common Korean syllables
  return shuffle(['가', '나', '다', '마', '하', '사']).slice(0, count);
}

function generatePronunciationSelect(
  _pool: VocabItem[],
  objectiveId: string,
  hintItems?: string[],
  explainIn: UILang = 'en',
): PronunciationSelectExercise {
  // Check if hintItems contain multi-character words (name/word mode)
  const wordHint = hintItems?.find((h) => h.length > 1);

  if (wordHint) {
    // Word/name mode: show the word, play 3 different pronunciations
    const distractorWords = generateWordDistractors(wordHint, 2);
    const allOptions = shuffle([
      { id: 'correct', label: wordHint, ttsText: wordHint, romanization: '', meaning: '' },
      ...distractorWords.map((d, i) => ({ id: `d${i}`, label: d, ttsText: d, romanization: '', meaning: '' })),
    ]);

    return {
      type: 'pronunciation_select',
      id: stableId('ps', objectiveId, [wordHint]),
      objectiveId,
      difficulty: 2,
      prompt: tFmt('pron_word_prompt', explainIn, wordHint),
      targetText: wordHint,
      audioOptions: allOptions,
      correctOptionId: 'correct',
      explanation: `${wordHint}`,
    };
  }

  // Jamo mode: show jamo character, play 3 different letter sounds
  const available = [...JAMO_SOUNDS];
  let target = available[Math.floor(Math.random() * available.length)];

  if (hintItems && hintItems.length > 0) {
    const matched = available.find((j) => hintItems.includes(j.char));
    if (matched) target = matched;
  }

  const distractors = shuffle(available.filter((j) => j.char !== target.char)).slice(0, 2);
  const jamoToTts = (char: string) => {
    const map: Record<string, string> = {
      'ㄱ': '기역', 'ㄴ': '니은', 'ㄷ': '디귿', 'ㄹ': '리을', 'ㅁ': '미음',
      'ㅂ': '비읍', 'ㅅ': '시옷', 'ㅇ': '이응', 'ㅈ': '지읒', 'ㅎ': '히읗',
      'ㅏ': '아', 'ㅑ': '야', 'ㅓ': '어', 'ㅕ': '여', 'ㅗ': '오',
      'ㅛ': '요', 'ㅜ': '우', 'ㅠ': '유', 'ㅡ': '으', 'ㅣ': '이',
    };
    return map[char] ?? char;
  };
  const allOptions = shuffle([
    { id: 'correct', label: target.char, ttsText: jamoToTts(target.char), romanization: target.romanization, meaning: target.sound },
    ...distractors.map((d, i) => ({ id: `d${i}`, label: d.char, ttsText: jamoToTts(d.char), romanization: d.romanization, meaning: d.sound })),
  ]);

  return {
    type: 'pronunciation_select',
    id: stableId('ps', objectiveId, [target.char]),
    objectiveId,
    difficulty: 1,
    prompt: t('pron_prompt', explainIn),
    targetText: target.char,
    audioOptions: allOptions,
    correctOptionId: 'correct',
    explanation: `${target.char} (${target.romanization}) = "${target.sound}"`,
  };
}

/* ── New Phase 4 generators ──────────────────────────────────── */

function generatePatternRecognition(
  objectiveId: string,
  language: 'ko' | 'zh' | 'ja' = 'ko',
): PatternRecognitionExercise {
  // Pick a random design principle from the appropriate language
  const principles = getDesignPrinciplesForLanguage(language);
  const principle = principles[Math.floor(Math.random() * principles.length)];
  const correctIdx = Math.floor(Math.random() * Math.min(principle.examples.length, 4));

  // Build pairs: correct example + distractors from other principles
  const pairs = [principle.examples[correctIdx]];
  const otherPrinciples = principles.filter((p) => p.id !== principle.id);
  for (const other of shuffle(otherPrinciples).slice(0, 2)) {
    const ex = other.examples[Math.floor(Math.random() * other.examples.length)];
    pairs.push(ex);
  }

  const shuffledPairs = shuffle(pairs);
  const correctShuffledIdx = shuffledPairs.findIndex(
    (p) => p.chars === principle.examples[correctIdx].chars,
  );

  return {
    type: 'pattern_recognition',
    id: stableId('pr', objectiveId, [principle.id, principle.examples[correctIdx].chars]),
    objectiveId,
    difficulty: 2,
    prompt: `Which example shows "${principle.title}"?`,
    pairs: shuffledPairs,
    correctPairIndex: correctShuffledIdx,
    principleId: principle.id,
    explanation: principle.teachingHook,
  };
}

/** Get the script-building-block pool for a language (jamo / kana / radicals). */
function getScriptPool(language: 'ko' | 'zh' | 'ja', objectiveId?: string): VocabItem[] {
  switch (language) {
    case 'ko':
      if (objectiveId?.includes('script-consonants')) return CONSONANTS;
      if (objectiveId?.includes('script-vowels')) return VOWELS;
      return ALL_JAMO;
    case 'ja':
      if (objectiveId?.includes('katakana')) return KATAKANA_POOL;
      if (objectiveId?.includes('hiragana')) return HIRAGANA_POOL;
      return ALL_KANA;
    case 'zh':
      return CHINESE_RADICALS;
  }
}

function generateStrokeTracing(
  pool: VocabItem[],
  objectiveId: string,
  hintItems?: string[],
  language?: 'ko' | 'zh' | 'ja',
  explainIn: UILang = 'en',
  hintSubType?: string,
): StrokeTracingExercise {
  const lang = language ?? 'ko';

  // For stroke tracing, prefer script building blocks (jamo/kana/radicals)
  // over general vocab, unless AI gave specific hintItems.
  const scriptPool = getScriptPool(lang, objectiveId);

  // Pick a target character
  let target: string;
  let targetItem: VocabItem | undefined;

  if (hintItems && hintItems.length > 0) {
    target = hintItems[Math.floor(Math.random() * hintItems.length)];
    // Try to find romanization from script pool first, then general pool
    targetItem = scriptPool.find((v) => v.word === target)
      ?? pool.find((v) => v.word === target);
  } else {
    // Pick from script building blocks when available
    const sourcePool = scriptPool.length > 0 ? scriptPool : pool;
    const item = sourcePool[Math.floor(Math.random() * sourcePool.length)];
    target = item.word.length === 1 ? item.word : item.word.charAt(0);
    if (item.word.length === 1) targetItem = item;
  }

  // Find example words that contain this character
  const allItems = [...ALL_VOCAB, ...pool, ...scriptPool];
  const seen = new Set<string>();
  const exampleWords: { word: string; romanization: string; meaning: string }[] = [];
  for (const v of allItems) {
    if (v.word.length > 1 && v.word.includes(target) && !seen.has(v.word)) {
      seen.add(v.word);
      exampleWords.push({ word: v.word, romanization: v.romanization, meaning: v.translation });
      if (exampleWords.length >= 3) break;
    }
  }

  return {
    type: 'stroke_tracing',
    id: stableId('st', objectiveId, [target]),
    objectiveId,
    difficulty: 1,
    prompt: tFmt('stroke_prompt', explainIn, target),
    targetChar: target,
    ghostOverlay: true,
    explanation: tFmt('stroke_explain', explainIn, target),
    romanization: targetItem?.romanization,
    meaning: targetItem?.translation,
    sound: targetItem?.word ?? target,
    language: lang,
    exampleWords: exampleWords.length > 0 ? exampleWords : undefined,
    reps: hintSubType === 'drill' ? 8 : undefined,
  };
}

function stageFromMastery(
  itemId: string,
  mastery?: Record<string, ItemMastery>,
): 'intro' | 'recognition' | 'recall' {
  if (!mastery || !mastery[itemId]) return 'intro';
  const m = mastery[itemId];
  if (m.masteryLevel === 'new' || m.masteryLevel === 'seen') return 'intro';
  if (m.masteryLevel === 'learning') return 'recognition';
  return 'recall'; // familiar or mastered
}

function generateBlockCrush(
  objectiveId: string,
  language?: 'ko' | 'zh' | 'ja',
  hintItems?: string[],
  mastery?: Record<string, ItemMastery>,
  explainIn: UILang = 'en',
): BlockCrushExercise {
  const lang = language ?? 'ko';
  const difficulty = objectiveId.includes('radical') ? 2 : 1;

  let target: CompositionTarget;

  // 1. If hintItems provided, find matching CompositionTarget
  if (hintItems && hintItems.length > 0) {
    const allTargets = getTargets(lang);
    const matched = allTargets.find((t) => hintItems.includes(t.char));
    if (matched) {
      target = matched;
    } else {
      target = getRandomTarget(lang, difficulty);
    }
  } else if (mastery && Object.keys(mastery).length > 0) {
    // 2. SRS-aware: pick due items first, then unseen
    const allTargets = getTargets(lang, difficulty);
    const targetChars = allTargets.map((t) => t.char);
    const dueChars = getDueItems(mastery).filter((w) => targetChars.includes(w));
    const newChars = getNewItems(mastery, targetChars);

    if (dueChars.length > 0) {
      target = allTargets.find((t) => t.char === dueChars[0])!;
    } else if (newChars.length > 0) {
      target = allTargets.find((t) => t.char === newChars[0])!;
    } else {
      target = getRandomTarget(lang, difficulty);
    }
  } else {
    // 3. Fallback: random
    target = getRandomTarget(lang, difficulty);
  }

  const stage = stageFromMastery(target.char, mastery);

  return {
    type: 'block_crush',
    id: stableId('bc', objectiveId, [target.char]),
    objectiveId,
    difficulty: target.difficulty,
    prompt: tFmt('build_char', explainIn, target.char),
    language: lang,
    targetChar: target.char,
    components: target.components,
    romanization: target.romanization,
    meaning: target.meaning,
    explanation: `${target.char} is made from ${target.components.map((c) => c.piece).join(' + ')}`,
    stage,
  };
}

function generateErrorCorrection(
  _pool: VocabItem[],
  objectiveId: string,
): ErrorCorrectionExercise {
  // Predefined error correction patterns for Korean grammar
  const patterns = [
    {
      sentence: '떡볶이 를 주세요',
      errorWordIndex: 1,
      correct: '을',
      distractors: ['는', '이'],
      explanation: '떡볶이 ends with a vowel (ㅣ), so use 를, but the sentence incorrectly uses 를 spacing — the particle attaches directly.',
    },
    {
      sentence: '물 이 마시다',
      errorWordIndex: 1,
      correct: '을',
      distractors: ['는', '가'],
      explanation: '물 (water) is the object being drunk, so use object particle 을, not subject particle 이.',
    },
    {
      sentence: '김밥 두 장 주세요',
      errorWordIndex: 2,
      correct: '개',
      distractors: ['병', '잔'],
      explanation: '장 is for flat things (paper). For food items, use 개 (general counter).',
    },
  ];

  const pattern = patterns[Math.floor(Math.random() * patterns.length)];
  const options = shuffle([
    { id: 'correct', text: pattern.correct },
    ...pattern.distractors.map((d, i) => ({ id: `d${i}`, text: d })),
  ]);

  return {
    type: 'error_correction',
    id: stableId('ec', objectiveId, [pattern.sentence, pattern.correct]),
    objectiveId,
    difficulty: 3,
    prompt: 'Find and fix the error in this sentence:',
    sentence: pattern.sentence,
    errorWordIndex: pattern.errorWordIndex,
    options,
    correctOptionId: 'correct',
    explanation: pattern.explanation,
  };
}

function generateFreeInput(
  pool: VocabItem[],
  objectiveId: string,
  hintItems?: string[],
  explainIn: UILang = 'en',
): FreeInputExercise {
  const selected = hintItems && hintItems.length > 0
    ? pool.find((v) => hintItems.includes(v.word)) ?? pool[0]
    : pool[Math.floor(Math.random() * pool.length)];

  return {
    type: 'free_input',
    id: stableId('fi', objectiveId, [selected.word]),
    objectiveId,
    difficulty: 2,
    prompt: tFmt('type_word_for', explainIn, selected.translation),
    expectedAnswers: [selected.word],
    hint: tFmt('romanization_hint', explainIn, selected.romanization),
    explanation: `${selected.word} (${selected.romanization}) = ${selected.translation}`,
  };
}

/** Route from exercise type + hints to a generated exercise using the right data pool. */
export function generateExercise(exerciseType: string, hints?: ExerciseHints): ExerciseData {
  const hintItems = hints?.hintItems;
  const count = hints?.hintCount;
  const hintSubType = hints?.hintSubType;
  const objectiveId = hints?.objectiveId ?? 'ko-vocab-food-items';
  const mastery = hints?.mastery;
  const language = hints?.language ?? 'ko';
  const explainIn = hints?.explainIn ?? 'en';

  // Language-aware pool selection
  const pool = getPoolForLocation(language, hints?.cityId, hints?.locationId, objectiveId);

  switch (exerciseType) {
    case 'matching':
      return generateMatching(pool, objectiveId, count ?? 5, hintItems, hintSubType, mastery, explainIn);
    case 'multiple_choice':
      return generateMultipleChoice(pool, objectiveId, hintItems, hintSubType, mastery, explainIn);
    case 'drag_drop':
      return generateDragDrop(pool, objectiveId, count ?? 4, hintItems, hintSubType, mastery, explainIn);
    case 'sentence_builder':
      return generateSentenceBuilder(pool, objectiveId, hintItems);
    case 'fill_blank':
      return generateFillBlank(pool, objectiveId, hintItems);
    case 'pronunciation_select':
      return generatePronunciationSelect(pool, objectiveId, hintItems, explainIn);
    case 'pattern_recognition':
      return generatePatternRecognition(objectiveId, language);
    case 'stroke_tracing':
      return generateStrokeTracing(pool, objectiveId, hintItems, language, explainIn, hintSubType);
    case 'block_crush':
      return generateBlockCrush(objectiveId, language, hintItems, mastery, explainIn);
    case 'error_correction':
      return generateErrorCorrection(pool, objectiveId);
    case 'free_input':
      return generateFreeInput(pool, objectiveId, hintItems, explainIn);
    default:
      return generateMatching(pool, objectiveId, count ?? 5, hintItems, hintSubType, mastery, explainIn);
  }
}
