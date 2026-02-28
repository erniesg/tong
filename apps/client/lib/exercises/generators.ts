import type { MatchingExercise, MultipleChoiceExercise, DragDropExercise, ExerciseData } from '@/lib/types/hangout';

export interface ExerciseHints {
  hintItems?: string[];
  hintCount?: number;
  hintSubType?: string;
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

/* ── Vocabulary data ──────────────────────────────────────── */

const FOOD_VOCAB = [
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

/**
 * Select vocab items, prioritizing hintItems if provided.
 * Returns items matching hints first, padded with random others.
 */
function selectVocab(count: number, hintItems?: string[]): typeof FOOD_VOCAB {
  if (!hintItems || hintItems.length === 0) {
    return pick(FOOD_VOCAB, Math.min(count, FOOD_VOCAB.length));
  }

  const hintSet = new Set(hintItems);
  const matched = FOOD_VOCAB.filter((v) => hintSet.has(v.word));
  const rest = FOOD_VOCAB.filter((v) => !hintSet.has(v.word));

  const needed = Math.min(count, FOOD_VOCAB.length);
  if (matched.length >= needed) {
    return shuffle(matched).slice(0, needed);
  }

  const padded = [...matched, ...pick(rest, needed - matched.length)];
  return shuffle(padded);
}

/* ── Generators ───────────────────────────────────────────── */

export function generateFoodMatching(count = 5, hintItems?: string[]): MatchingExercise {
  const selected = selectVocab(count, hintItems);
  return {
    type: 'matching',
    id: nextId(),
    objectiveId: 'ko-vocab-food-items',
    difficulty: 2,
    prompt: 'Match the Korean food words to their English meanings',
    pairs: selected.map((v) => ({ left: v.word, right: v.translation })),
  };
}

export function generateFoodMultipleChoice(hintItems?: string[]): MultipleChoiceExercise {
  const selected = selectVocab(4, hintItems);
  const target = selected[0];
  return {
    type: 'multiple_choice',
    id: nextId(),
    objectiveId: 'ko-vocab-food-items',
    difficulty: 1,
    prompt: `What does "${target.word}" mean?`,
    options: shuffle(
      selected.map((v, i) => ({
        id: i === 0 ? 'correct' : `d${i}`,
        text: v.translation,
      })),
    ),
    correctOptionId: 'correct',
    explanation: `${target.word} (${target.romanization}) = ${target.translation}`,
  };
}

export function generateMenuDragDrop(count = 4, hintItems?: string[]): DragDropExercise {
  const selected = selectVocab(count, hintItems);

  const items = selected.map((v) => ({
    id: `item-${v.word}`,
    text: v.word,
  }));

  const targets = shuffle(selected).map((v) => ({
    id: `target-${v.word}`,
    label: v.translation,
  }));

  const correctMapping: Record<string, string> = {};
  for (const v of selected) {
    correctMapping[`item-${v.word}`] = `target-${v.word}`;
  }

  return {
    type: 'drag_drop',
    id: nextId(),
    objectiveId: 'ko-vocab-food-items',
    difficulty: 2,
    prompt: 'Match the Korean words to the English menu items',
    items: shuffle(items),
    targets,
    correctMapping,
  };
}

/** Route from exercise type string to a generated exercise, with optional hints. */
export function generateExercise(exerciseType: string, hints?: ExerciseHints): ExerciseData {
  const hintItems = hints?.hintItems;
  const count = hints?.hintCount;

  switch (exerciseType) {
    case 'matching':
      return generateFoodMatching(count ?? 5, hintItems);
    case 'multiple_choice':
      return generateFoodMultipleChoice(hintItems);
    case 'drag_drop':
      return generateMenuDragDrop(count ?? 4, hintItems);
    default:
      return generateFoodMatching(count ?? 5, hintItems);
  }
}
