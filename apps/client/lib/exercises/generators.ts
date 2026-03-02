import type {
  MatchingExercise,
  MultipleChoiceExercise,
  DragDropExercise,
  SentenceBuilderExercise,
  FillBlankExercise,
  PronunciationSelectExercise,
  PatternRecognitionExercise,
  StrokeTracingExercise,
  ErrorCorrectionExercise,
  FreeInputExercise,
  ExerciseData,
} from '@/lib/types/hangout';
import { VOCABULARY_TARGETS } from '@/lib/content/pojangmacha';
import type { ItemMastery } from '@/lib/types/mastery';
import { getDueItems, getNewItems } from '@/lib/curriculum/srs';
import { HANGUL_DESIGN_PRINCIPLES } from '@/lib/content/scripts/hangul';
import { PINYIN_DESIGN_PRINCIPLES } from '@/lib/content/scripts/pinyin';
import { KANA_DESIGN_PRINCIPLES } from '@/lib/content/scripts/kana';
import { getLocationVocab, getRegisteredLocationKeys } from '@/lib/content/locations';
import type { DesignPrinciple } from '@/lib/content/scripts/hangul';

export interface ExerciseHints {
  hintItems?: string[];
  hintCount?: number;
  hintSubType?: string;
  objectiveId?: string;
  mastery?: Record<string, ItemMastery>;
  language?: 'ko' | 'zh' | 'ja';
  cityId?: string;
  locationId?: string;
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
      ? 'Match each symbol to its sound'
      : isScript
        ? 'Match each character to its romanization'
        : 'Match the Korean words to their English meanings',
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
): MultipleChoiceExercise {
  const selected = selectItems(4, pool, hintItems, mastery);
  const target = selected[0];
  const isScript = objectiveId.includes('script') || objectiveId.includes('pron');
  const isVisual = hintSubType === 'visual_recognition';
  const isSound = hintSubType === 'sound_quiz';

  let prompt: string;
  let options: { id: string; text: string }[];

  if (isVisual) {
    // "Which symbol makes the 'g' sound?" — options are Korean characters
    prompt = `Which symbol makes the "${target.romanization}" sound?`;
    options = selected.map((v, i) => ({
      id: i === 0 ? 'correct' : `d${i}`,
      text: v.word,
    }));
  } else if (isSound) {
    // "What sound does ㄱ make?" — options are romanizations
    prompt = `What sound does "${target.word}" make?`;
    options = selected.map((v, i) => ({
      id: i === 0 ? 'correct' : `d${i}`,
      text: v.romanization,
    }));
  } else {
    prompt = `What does "${target.word}" mean?`;
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
      ? 'Match each symbol to its sound'
      : isScript
        ? 'Match each character to its romanization'
        : 'Match the Korean words to their English meanings',
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

function generatePronunciationSelect(
  _pool: VocabItem[],
  objectiveId: string,
  hintItems?: string[],
): PronunciationSelectExercise {
  const available = [...JAMO_SOUNDS];
  let target = available[Math.floor(Math.random() * available.length)];

  if (hintItems && hintItems.length > 0) {
    const matched = available.find((j) => hintItems.includes(j.char));
    if (matched) target = matched;
  }

  const distractors = shuffle(available.filter((j) => j.char !== target.char)).slice(0, 3);
  const allOptions = shuffle([
    { id: 'correct', label: target.sound, romanization: target.romanization },
    ...distractors.map((d, i) => ({ id: `d${i}`, label: d.sound, romanization: d.romanization })),
  ]);

  return {
    type: 'pronunciation_select',
    id: stableId('ps', objectiveId, [target.char]),
    objectiveId,
    difficulty: 1,
    prompt: `What sound does this character make?`,
    targetText: target.char,
    audioOptions: allOptions,
    correctOptionId: 'correct',
    explanation: `${target.char} (${target.romanization}) makes the "${target.sound}" sound`,
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

function generateStrokeTracing(
  pool: VocabItem[],
  objectiveId: string,
  hintItems?: string[],
): StrokeTracingExercise {
  // Pick a target character
  let target: string;
  if (hintItems && hintItems.length > 0) {
    target = hintItems[Math.floor(Math.random() * hintItems.length)];
  } else {
    const item = pool[Math.floor(Math.random() * pool.length)];
    target = item.word.charAt(0); // first character
  }

  return {
    type: 'stroke_tracing',
    id: stableId('st', objectiveId, [target]),
    objectiveId,
    difficulty: 1,
    prompt: `Trace the character: ${target}`,
    targetChar: target,
    ghostOverlay: true,
    explanation: `Practice writing ${target} to build muscle memory.`,
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
): FreeInputExercise {
  const selected = hintItems && hintItems.length > 0
    ? pool.find((v) => hintItems.includes(v.word)) ?? pool[0]
    : pool[Math.floor(Math.random() * pool.length)];

  return {
    type: 'free_input',
    id: stableId('fi', objectiveId, [selected.word]),
    objectiveId,
    difficulty: 2,
    prompt: `Type the Korean word for "${selected.translation}":`,
    expectedAnswers: [selected.word],
    hint: `Romanization: ${selected.romanization}`,
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

  // Language-aware pool selection
  const pool = getPoolForLocation(language, hints?.cityId, hints?.locationId, objectiveId);

  switch (exerciseType) {
    case 'matching':
      return generateMatching(pool, objectiveId, count ?? 5, hintItems, hintSubType, mastery);
    case 'multiple_choice':
      return generateMultipleChoice(pool, objectiveId, hintItems, hintSubType, mastery);
    case 'drag_drop':
      return generateDragDrop(pool, objectiveId, count ?? 4, hintItems, hintSubType, mastery);
    case 'sentence_builder':
      return generateSentenceBuilder(pool, objectiveId, hintItems);
    case 'fill_blank':
      return generateFillBlank(pool, objectiveId, hintItems);
    case 'pronunciation_select':
      return generatePronunciationSelect(pool, objectiveId, hintItems);
    case 'pattern_recognition':
      return generatePatternRecognition(objectiveId, language);
    case 'stroke_tracing':
      return generateStrokeTracing(pool, objectiveId, hintItems);
    case 'error_correction':
      return generateErrorCorrection(pool, objectiveId);
    case 'free_input':
      return generateFreeInput(pool, objectiveId, hintItems);
    default:
      return generateMatching(pool, objectiveId, count ?? 5, hintItems, hintSubType, mastery);
  }
}
