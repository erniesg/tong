// Seoul chapter state: a month is a chapter that ends when the player finishes its eval.
// Pure functions over a plain, JSON-safe object stored in the save as `chapter`.
// Design: docs/seoul-evals.md → "The eval: unlock, confirm, play once".

import { SKILLS } from './runner.js';

export const CHAPTER_VERSION = 1;
export const LAST_BUILT_MONTH = 1; // eval 1 only for now

/** The month's required beats before its eval unlocks (save-wide story flags). */
export const REQUIRED_BEATS = {
  1: ['h0_done', 'h1_done', 'h2_done'],
};

export const CONFIRM_LINE = { ko: '준비됐어요? 이번 달의 몇 가지는 지나가요.', en: 'Ready? Some things this month will pass.' };

/**
 * status: 'open' (free play; the eval may be locked or unlocked),
 *         'eve' (confirmed; eval day is `evalDay`),
 *         'eval' (eval day in progress; `run` holds per-round progress).
 */
export function newChapter() {
  return {
    v: CHAPTER_VERSION, month: 1, status: 'open', forced: false, evalDay: null, run: null,
    results: {}, weak: [], mastery: Object.fromEntries(SKILLS.map((s) => [s, 0])), rehearsals: 0, profile: null,
  };
}

/** Restore from a save (anything malformed falls back to a fresh March). */
export function normalizeChapter(raw) {
  const c = newChapter();
  if (!raw || typeof raw !== 'object') return c;
  if (Number.isInteger(raw.month) && raw.month >= 1 && raw.month <= 12) c.month = raw.month;
  if (['open', 'eve', 'eval'].includes(raw.status)) c.status = raw.status;
  c.forced = raw.forced === true;
  c.evalDay = Number.isInteger(raw.evalDay) ? raw.evalDay : null;
  if (c.status !== 'open' && c.evalDay == null) c.status = 'open';
  if (c.status === 'eval' && raw.run && typeof raw.run === 'object') {
    c.run = {
      seed: Number.isInteger(raw.run.seed) ? raw.run.seed : 0,
      round: Number.isInteger(raw.run.round) ? raw.run.round : 0,
      attempt: Number.isInteger(raw.run.attempt) ? raw.run.attempt : 0,
      rounds: raw.run.rounds && typeof raw.run.rounds === 'object' ? raw.run.rounds : {},
    };
  } else if (c.status === 'eval') c.run = { seed: 0, round: 0, attempt: 0, rounds: {} };
  c.results = raw.results && typeof raw.results === 'object' ? raw.results : {};
  c.weak = Array.isArray(raw.weak) ? raw.weak.filter((x) => typeof x === 'string') : [];
  for (const s of SKILLS) if (Number.isFinite(raw.mastery?.[s])) c.mastery[s] = raw.mastery[s];
  c.rehearsals = Number.isInteger(raw.rehearsals) ? raw.rehearsals : 0;
  c.profile = raw.profile && typeof raw.profile === 'object' ? raw.profile : null;
  return c;
}

export function missingBeats(chapter, flags = {}) {
  return (REQUIRED_BEATS[chapter.month] ?? []).filter((f) => !flags[f]);
}

/** Has the month reached its eval? (required beats done, or a debug force-unlock) */
export function isUnlocked(chapter, flags = {}) {
  if (chapter.month > LAST_BUILT_MONTH) return false;
  return chapter.forced || missingBeats(chapter, flags).length === 0;
}

/** The player can start the eval: unlocked and still in free play. */
export function canStart(chapter, flags) {
  return chapter.status === 'open' && isUnlocked(chapter, flags);
}

/** Confirm: the point of no return. Tomorrow is eval day; tonight is the eve. */
export function confirmEval(chapter, flags, today) {
  if (!canStart(chapter, flags)) return { ...chapter };
  return { ...chapter, status: 'eve', evalDay: today + 1 };
}

/** Eval day begins once the clock reaches the morning of evalDay (or any later day). */
export function evalDayDue(chapter, day, hour) {
  if (chapter.status !== 'eve') return false;
  return day > chapter.evalDay || (day === chapter.evalDay && hour >= 6);
}

export function beginEvalDay(chapter, seed) {
  if (chapter.status !== 'eve') return { ...chapter };
  return { ...chapter, status: 'eval', run: { seed: seed >>> 0, round: 0, attempt: 0, rounds: {} } };
}

/** Per-round autosave: a finished round is kept; the next round starts fresh. */
export function recordRound(chapter, roundId, summary) {
  if (chapter.status !== 'eval') return { ...chapter };
  const run = { ...chapter.run, rounds: { ...chapter.run.rounds, [roundId]: summary }, round: chapter.run.round + 1, attempt: 0 };
  return { ...chapter, run };
}

/** A round abandoned mid-way (tab closed) restarts with fresh items: bump the attempt. */
export function restartRound(chapter) {
  if (chapter.status !== 'eval') return { ...chapter };
  return { ...chapter, run: { ...chapter.run, attempt: chapter.run.attempt + 1 } };
}

/** Results night: store results, carry weak objectives and mastery, and the month advances. */
export function finishEval(chapter, { result, weak, mastery }) {
  if (chapter.status !== 'eval') return { ...chapter };
  return {
    ...chapter,
    status: 'open', forced: false, evalDay: null, run: null,
    results: { ...chapter.results, [chapter.month]: result },
    weak: [...weak], mastery: { ...mastery },
    month: Math.min(12, chapter.month + 1),
  };
}

/** Rehearsal is ungraded: it may move mastery but never touches results, grade or rank. */
export function recordRehearsal(chapter, mastery) {
  return { ...chapter, mastery: { ...mastery }, rehearsals: chapter.rehearsals + 1 };
}
