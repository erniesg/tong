import type { MatchingExercise, MultipleChoiceExercise, DragDropExercise, ExerciseData } from '@/lib/types/hangout';

export interface ExerciseHints {
  hintItems?: string[];
  hintCount?: number;
  hintSubType?: string;
  objectiveId?: string;
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

let exerciseCounter = 0;
function nextId(): string {
  return `ex-${Date.now()}-${exerciseCounter++}`;
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

/* ── Menu reading data (Level 0 script) ───────────────────── */

const MENU_WORDS: VocabItem[] = [
  { word: '오뎅', translation: 'fish cake', romanization: 'odeng' },
  { word: '떡볶이', translation: 'spicy rice cakes', romanization: 'tteokbokki' },
  { word: '라면', translation: 'instant noodles', romanization: 'ramyeon' },
  { word: '순대', translation: 'blood sausage', romanization: 'sundae' },
];

/* ── Vocabulary data (Level 2) ────────────────────────────── */

const FOOD_VOCAB: VocabItem[] = [
  { word: '떡볶이', translation: 'spicy rice cakes', romanization: 'tteokbokki' },
  { word: '김밥', translation: 'seaweed rice roll', romanization: 'gimbap' },
  { word: '라면', translation: 'ramen noodles', romanization: 'ramyeon' },
  { word: '순대', translation: 'blood sausage', romanization: 'sundae' },
  { word: '오뎅', translation: 'fish cake skewer', romanization: 'odeng' },
  { word: '튀김', translation: 'fried snacks', romanization: 'twigim' },
  { word: '소주', translation: 'soju (rice liquor)', romanization: 'soju' },
  { word: '막걸리', translation: 'rice wine', romanization: 'makgeolli' },
  { word: '물', translation: 'water', romanization: 'mul' },
  { word: '밥', translation: 'rice / meal', romanization: 'bap' },
  { word: '만두', translation: 'dumplings', romanization: 'mandu' },
  { word: '꼬치', translation: 'skewers', romanization: 'kkochi' },
  { word: '호떡', translation: 'sweet pancake', romanization: 'hotteok' },
  { word: '김치', translation: 'kimchi', romanization: 'gimchi' },
  { word: '비빔밥', translation: 'mixed rice', romanization: 'bibimbap' },
];

const TASTE_VOCAB: VocabItem[] = [
  { word: '맵다', translation: 'spicy', romanization: 'maepda' },
  { word: '달다', translation: 'sweet', romanization: 'dalda' },
  { word: '짜다', translation: 'salty', romanization: 'jjada' },
  { word: '맛있다', translation: 'delicious', romanization: 'masitda' },
  { word: '맛없다', translation: 'not tasty', romanization: 'maseopda' },
];

const NUMBER_VOCAB: VocabItem[] = [
  { word: '하나', translation: 'one', romanization: 'hana' },
  { word: '둘', translation: 'two', romanization: 'dul' },
  { word: '셋', translation: 'three', romanization: 'set' },
  { word: '넷', translation: 'four', romanization: 'net' },
  { word: '다섯', translation: 'five', romanization: 'daseot' },
];

const VERB_VOCAB: VocabItem[] = [
  { word: '먹다', translation: 'to eat', romanization: 'meokda' },
  { word: '주다', translation: 'to give', romanization: 'juda' },
  { word: '마시다', translation: 'to drink', romanization: 'masida' },
  { word: '사다', translation: 'to buy', romanization: 'sada' },
  { word: '시키다', translation: 'to order', romanization: 'sikida' },
];

const COURTESY_VOCAB: VocabItem[] = [
  { word: '주세요', translation: 'please (give me)', romanization: 'juseyo' },
  { word: '감사합니다', translation: 'thank you', romanization: 'gamsahamnida' },
  { word: '잠시만요', translation: 'just a moment', romanization: 'jamsimanyo' },
  { word: '여기요', translation: 'excuse me (here)', romanization: 'yeogiyo' },
  { word: '얼마예요', translation: 'how much?', romanization: 'eolmayeyo' },
];

/** All vocab pools combined for fallback matching. */
const ALL_VOCAB: VocabItem[] = [
  ...FOOD_VOCAB, ...TASTE_VOCAB, ...NUMBER_VOCAB,
  ...VERB_VOCAB, ...COURTESY_VOCAB, ...MENU_WORDS,
];

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
 * Select items from the right pool, prioritizing hintItems.
 * Falls back across ALL pools if hints don't match the primary pool.
 */
function selectItems(
  count: number,
  pool: VocabItem[],
  hintItems?: string[],
): VocabItem[] {
  if (!hintItems || hintItems.length === 0) {
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
): MatchingExercise {
  const selected = selectItems(count, pool, hintItems);
  const isScript = objectiveId.includes('script') || objectiveId.includes('pron');
  const isSound = hintSubType === 'sound_quiz';

  return {
    type: 'matching',
    id: nextId(),
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
): MultipleChoiceExercise {
  const selected = selectItems(4, pool, hintItems);
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
    id: nextId(),
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
): DragDropExercise {
  const selected = selectItems(count, pool, hintItems);
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
    id: nextId(),
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

/** Route from exercise type + hints to a generated exercise using the right data pool. */
export function generateExercise(exerciseType: string, hints?: ExerciseHints): ExerciseData {
  const hintItems = hints?.hintItems;
  const count = hints?.hintCount;
  const hintSubType = hints?.hintSubType;
  const objectiveId = hints?.objectiveId ?? 'ko-vocab-food-items';

  const pool = getPoolForObjective(objectiveId);

  switch (exerciseType) {
    case 'matching':
      return generateMatching(pool, objectiveId, count ?? 5, hintItems, hintSubType);
    case 'multiple_choice':
      return generateMultipleChoice(pool, objectiveId, hintItems, hintSubType);
    case 'drag_drop':
      return generateDragDrop(pool, objectiveId, count ?? 4, hintItems, hintSubType);
    default:
      return generateMatching(pool, objectiveId, count ?? 5, hintItems, hintSubType);
  }
}
