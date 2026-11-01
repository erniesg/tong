/**
 * Tong's review drill for the cozy game (tap Tong → Review). Pure functions so
 * they can be unit tested: which words come up, in which exercise format, and
 * the exercises themselves, built from the player's own phrase book.
 *
 * Every word climbs a ladder of formats as its shared mastery grows. A word
 * gets a format it has not tried yet at its rung; once it has tried them all,
 * it is stretched one rung up, so a review never just repeats itself.
 */
import type { CozyPracticeWord, CozyRecordedItem } from '../../../../packages/contracts';
import type {
  ExerciseData, FreeInputExercise, MatchingExercise, MultipleChoiceExercise, PronunciationSelectExercise,
} from '../types/hangout';
import type { ItemMastery } from '../types/mastery';
import { buildBlockCrush } from './bridge.ts';

export type ReviewFormat = 'meaning' | 'word' | 'sound' | 'match' | 'build' | 'type';

/** Rungs, easiest first: read it → pick or hear it → pair or build it → type it. */
export const LADDER: ReviewFormat[][] = [['meaning'], ['word', 'sound'], ['match', 'build'], ['type']];

export const FORMAT_LABEL: Record<ReviewFormat, string> = {
  meaning: 'What it means', word: 'Pick the word', sound: 'Hear it', match: 'Match them', build: 'Build it', type: 'Type it',
};

export const REVIEW_SIZE = 6;
/** Fewer usable words than this and there is nothing to pick between. */
export const MIN_REVIEW_WORDS = 4;

export interface ReviewWord {
  ko: string;
  rom?: string;
  en: string;
}

export interface ReviewItem {
  word: ReviewWord;
  format: ReviewFormat;
  /** Rung of the word's mastery (0–3). */
  rung: number;
  /** True when the format is above the word's rung. */
  stretch: boolean;
}

/** Formats each word has been reviewed in, keyed by the Korean. */
export type ReviewHistory = Record<string, ReviewFormat[]>;

const RUNG = { new: 0, seen: 0, learning: 1, familiar: 2, mastered: 3 } as const;
const HANGUL = /[가-힣]/;
const PLAIN_WORD = /^[가-힣]{1,6}$/;

export const rungOf = (m?: ItemMastery) => RUNG[m?.masteryLevel ?? 'new'];

/** Phrase-book entries that can be reviewed: Korean with a meaning, deduplicated. */
export function reviewWords(words: CozyPracticeWord[]): ReviewWord[] {
  const out = new Map<string, ReviewWord>();
  for (const w of words) {
    const ko = w.ko.trim();
    const en = w.en?.trim();
    if (!en || !HANGUL.test(ko) || ko.length > 16 || out.has(ko)) continue;
    out.set(ko, { ko, en, ...(w.rom?.trim() ? { rom: w.rom.trim() } : {}) });
  }
  return [...out.values()];
}

export function usable(format: ReviewFormat, w: ReviewWord): boolean {
  if (format === 'build') return PLAIN_WORD.test(w.ko);
  if (format === 'sound') return !!w.rom;
  return true;
}

/** Seeded PRNG (mulberry32 over an FNV hash) so a seed always gives the same drill. */
export function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.codePointAt(0)!, 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Due first, then never answered, then the weakest, then the longest unseen. */
function urgency(m: ItemMastery | undefined, now: number): number {
  if (m && m.repetitions > 0 && m.nextReview <= now) return 0;
  if (!m || m.correct + m.incorrect === 0) return 1;
  return 2;
}

/** The format a word gets next: untried at its rung, else untried higher up, else any at its rung. */
export function nextFormat(w: ReviewWord, rung: number, tried: ReviewFormat[], avoid: ReviewFormat | null, rand: () => number) {
  for (let r = rung; r < LADDER.length; r++) {
    const fresh = LADDER[r].filter((f) => usable(f, w) && !tried.includes(f));
    if (fresh.length) return { format: fresh[Math.floor(rand() * fresh.length)], stretch: r > rung };
  }
  for (let r = rung; r >= 0; r--) {
    const any = LADDER[r].filter((f) => usable(f, w));
    const varied = any.filter((f) => f !== avoid);
    const from = varied.length ? varied : any;
    if (from.length) return { format: from[Math.floor(rand() * from.length)], stretch: false };
  }
  return { format: 'meaning' as const, stretch: false };
}

/** Plan one review round, or null when the phrase book is too thin. */
export function planReview(
  words: CozyPracticeWord[],
  mastery: Record<string, ItemMastery>,
  history: ReviewHistory,
  { now = Date.now(), size = REVIEW_SIZE, seed = String(now) }: { now?: number; size?: number; seed?: string } = {},
): ReviewItem[] | null {
  const pool = reviewWords(words);
  if (pool.length < MIN_REVIEW_WORDS) return null;
  const rand = rng(seed);
  const ordered = shuffled(pool, rand).sort((a, b) => {
    const ma = mastery[a.ko], mb = mastery[b.ko];
    return urgency(ma, now) - urgency(mb, now) || rungOf(ma) - rungOf(mb) || (ma?.lastSeen ?? 0) - (mb?.lastSeen ?? 0);
  });
  const items: ReviewItem[] = [];
  for (const word of ordered.slice(0, size)) {
    const rung = rungOf(mastery[word.ko]);
    const { format, stretch } = nextFormat(word, rung, history[word.ko] ?? [], items.at(-1)?.format ?? null, rand);
    items.push({ word, format, rung, stretch });
  }
  return items;
}

export function withAttempt(history: ReviewHistory, item: ReviewItem): ReviewHistory {
  const tried = history[item.word.ko] ?? [];
  return tried.includes(item.format) ? history : { ...history, [item.word.ko]: [...tried, item.format] };
}

/* ── Exercises ───────────────────────────────────────────── */

const OBJECTIVE = 'ko-vocab-review';
const slug = (s: string) => [...s].map((c) => c.codePointAt(0)!.toString(36)).join('');

/** Up to n other words whose Korean and meaning both differ from the target's. */
function others(item: ReviewItem, pool: ReviewWord[], n: number, rand: () => number) {
  return shuffled(pool.filter((w) => w.ko !== item.word.ko && w.en !== item.word.en), rand).slice(0, n);
}

const ids = ['a', 'b', 'c', 'd'];

export function buildReviewExercise(
  item: ReviewItem,
  pool: ReviewWord[],
  mastery: Record<string, ItemMastery>,
  seed: string,
): ExerciseData {
  const rand = rng(`${seed}:${item.word.ko}:${item.format}`);
  const w = item.word;
  const id = `review-${item.format}-${slug(w.ko)}`;
  const base = { id, objectiveId: OBJECTIVE, difficulty: item.rung + 1 };
  const said = w.rom ? `${w.ko} (${w.rom})` : w.ko;
  switch (item.format) {
    case 'meaning':
    case 'word': {
      const choices = shuffled([w, ...others(item, pool, 3, rand)], rand);
      const show = (x: ReviewWord) => (item.format === 'meaning' ? x.en : x.ko);
      const mc: MultipleChoiceExercise = {
        ...base,
        type: 'multiple_choice',
        prompt: item.format === 'meaning' ? `What does ${w.ko} mean?` : `Which one means “${w.en}”?`,
        options: choices.map((x, i) => ({ id: ids[i], text: show(x) })),
        correctOptionId: ids[choices.indexOf(w)],
        explanation: `${said} = ${w.en}`,
      };
      return mc;
    }
    case 'sound': {
      const choices = shuffled([w, ...others(item, pool, 2, rand).filter((x) => x.rom)], rand);
      const ps: PronunciationSelectExercise = {
        ...base,
        type: 'pronunciation_select',
        prompt: 'Which one sounds like this? Tap each to listen.',
        targetText: w.ko,
        audioOptions: choices.map((x, i) => ({ id: ids[i], label: x.ko, ttsText: x.ko, romanization: x.rom ?? '', meaning: x.en })),
        correctOptionId: ids[choices.indexOf(w)],
        explanation: `${said} = ${w.en}`,
      };
      return ps;
    }
    case 'match': {
      const group = shuffled([w, ...others(item, pool, 3, rand)], rand);
      const m: MatchingExercise = {
        ...base,
        type: 'matching',
        prompt: 'Match each word to its meaning.',
        pairs: group.map((x) => ({ left: x.ko, right: x.en })),
      };
      return m;
    }
    case 'build': {
      const built = buildBlockCrush({
        exerciseType: 'block_crush', targetItems: [w.ko], objectiveId: 'ko-script-blocks-2part', stage: 'recall',
        framing: { en: `Build the word for “${w.en}”.` }, meaning: w.en, cityId: 'seoul', locationId: 'review',
      }, mastery);
      if (built) return { ...built, id };
      return buildReviewExercise({ ...item, format: 'word' }, pool, mastery, seed);
    }
    case 'type': {
      const fi: FreeInputExercise = {
        ...base,
        type: 'free_input',
        prompt: `Type the Korean for “${w.en}”.`,
        expectedAnswers: [...new Set([w.ko, w.ko.replace(/[\s?.!~,]/g, '')])],
        ...(w.rom ? { hint: `Sounds like: ${w.rom}` } : {}),
        explanation: `${said} = ${w.en}`,
      };
      return fi;
    }
  }
}

/** What a review answer teaches the store: the word, or every word in a match. */
export function reviewRecords(item: ReviewItem, exercise: ExerciseData, correct: boolean): CozyRecordedItem[] {
  const words = exercise.type === 'matching' ? exercise.pairs.map((p) => p.left) : [item.word.ko];
  return words.map((itemId) => ({ itemId, category: 'vocabulary' as const, correct }));
}
