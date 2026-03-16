import type { ItemMastery } from '../types/mastery';

/**
 * SM-2 spaced repetition algorithm.
 * Based on the SuperMemo-2 algorithm by Piotr Wozniak.
 *
 * Quality scale:
 *   5 — perfect response
 *   4 — correct after hesitation
 *   3 — correct with difficulty
 *   2 — incorrect, but close (easy to recall)
 *   1 — incorrect, remembered on seeing answer
 *   0 — complete blackout
 */

export interface SRSUpdate {
  easeFactor: number;
  interval: number;      // days
  nextReview: number;    // timestamp (ms)
  repetitions: number;
}

const MIN_EASE = 1.3;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Compute the next SRS state given correctness and quality.
 *
 * @param correct  Whether the answer was correct
 * @param quality  0-5 quality rating (higher = better recall)
 * @param prev     Previous SRS state (or defaults for new items)
 */
export function sm2(
  correct: boolean,
  quality: number,
  prev: { easeFactor: number; interval: number; repetitions: number },
): SRSUpdate {
  const q = Math.max(0, Math.min(5, quality));

  let newEF = prev.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  newEF = Math.max(MIN_EASE, newEF);

  let newInterval: number;
  let newReps: number;

  if (!correct || q < 3) {
    // Failed — reset repetitions, short interval
    newReps = 0;
    newInterval = 1;
  } else {
    newReps = prev.repetitions + 1;
    if (newReps === 1) {
      newInterval = 1;
    } else if (newReps === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(prev.interval * newEF);
    }
  }

  return {
    easeFactor: newEF,
    interval: newInterval,
    nextReview: Date.now() + newInterval * DAY_MS,
    repetitions: newReps,
  };
}

/**
 * Convert a boolean correct/incorrect into a quality score.
 * For now, correct = 4 (good), incorrect = 1 (recalled on seeing answer).
 * Can be refined later with response time, hints used, etc.
 */
export function qualityFromCorrect(correct: boolean): number {
  return correct ? 4 : 1;
}

/**
 * Get items that are due for review (nextReview <= now).
 * Sorted by urgency (most overdue first).
 */
export function getDueItems(mastery: Record<string, ItemMastery>): string[] {
  const now = Date.now();
  return Object.entries(mastery)
    .filter(([, m]) => m.nextReview <= now && m.repetitions > 0)
    .sort(([, a], [, b]) => a.nextReview - b.nextReview)
    .map(([key]) => key);
}

/**
 * Get items that haven't been seen yet (not in mastery map).
 */
export function getNewItems(
  mastery: Record<string, ItemMastery>,
  pool: string[],
): string[] {
  return pool.filter((item) => !(item in mastery));
}

/**
 * Default SRS fields for backfilling existing mastery entries.
 */
export function defaultSRSFields(): Pick<ItemMastery, 'easeFactor' | 'interval' | 'nextReview' | 'repetitions'> {
  return {
    easeFactor: 2.5,
    interval: 0,
    nextReview: Date.now(),
    repetitions: 0,
  };
}
