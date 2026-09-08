import { LOCATIONS, MISSION } from './content.js';
import type { CompanionId, LocationId, Progress } from './types.js';

const LOCATION_IDS = new Set<LocationId>(LOCATIONS.map(({ id }) => id));
const COMPANION_IDS: CompanionId[] = ['haeun', 'jin'];
const MAX_COUNTER = 100_000;
const MAX_HISTORY = 30;

type Mode = Progress['history'][number]['mode'];

export function newProgress(): Progress {
  return {
    version: 1,
    xp: 0,
    sp: 0,
    rp: { haeun: 0, jin: 0 },
    learned: [],
    hangouts: [],
    visited: [],
    missionComplete: false,
    memories: [],
    history: [],
  };
}

export function restoreProgress(raw: string | null): Progress {
  if (!raw) return newProgress();
  try {
    const value: unknown = JSON.parse(raw);
    if (!isSavedProgress(value)) return newProgress();

    const saved = value as Record<string, unknown>;
    return {
      version: 1,
      xp: saved.xp as number,
      sp: saved.sp as number,
      rp: saved.rp as Record<CompanionId, number>,
      learned: knownIds(saved.learned),
      hangouts: knownIds(saved.hangouts),
      visited: knownIds(saved.visited),
      missionComplete: saved.missionComplete as boolean,
      memories: uniqueStrings(saved.memories as string[]),
      history: validHistory(saved.history),
    };
  } catch {
    return newProgress();
  }
}

export function visitLocation(progress: Progress, id: LocationId): Progress {
  if (!LOCATION_IDS.has(id)) return progress;
  return record({
    ...copy(progress),
    visited: addOnce(progress.visited, id),
  }, id, 'learn', true, 'visit');
}

export function completeLesson(progress: Progress, id: LocationId, answer: number) {
  const location = LOCATIONS.find((item) => item.id === id);
  if (!location) return result(progress, false, 'That place is not on your Seoul map.');
  const correct = answer === location.lesson.answer;
  const alreadyLearned = progress.learned.includes(id);
  const next = copy(progress);

  if (correct && !alreadyLearned) {
    next.learned = addOnce(next.learned, id);
    next.xp += 20;
    next.sp += 5;
  }
  return result(record(next, id, 'learn', correct), correct, correct
    ? alreadyLearned ? 'You remembered it. Keep using it naturally.' : location.lesson.explanation
    : 'Almost. Read the Korean aloud once, then try it in the next scene.');
}

export function completeHangout(progress: Progress, id: LocationId, companion: CompanionId, answer: number) {
  const location = LOCATIONS.find((item) => item.id === id);
  if (!location || !COMPANION_IDS.includes(companion)) return result(progress, false, 'That hangout is unavailable.');
  if (!progress.learned.includes(id)) {
    return result(record(copy(progress), id, 'hangout', false), false, 'Learn this phrase first, then bring it into the conversation.');
  }

  const correct = answer === location.hangoutReply.answer;
  const alreadyValidated = progress.hangouts.includes(id);
  const next = copy(progress);
  if (correct && !alreadyValidated) {
    next.hangouts = addOnce(next.hangouts, id);
    next.rp[companion] += 8;
    next.xp += 15;
  }
  return result(record(next, id, 'hangout', correct), correct, correct
    ? alreadyValidated ? 'That memory is already yours; enjoy the moment without grinding it.' : location.hangoutReply.explanation
    : 'Try a response that keeps the invitation open and kind.');
}

export function missionReady(progress: Progress): boolean {
  return progress.hangouts.length >= 3;
}

export function completeMission(progress: Progress, answer: number) {
  if (!missionReady(progress)) {
    return result(record(copy(progress), 'food_street', 'mission', false), false, 'Complete three validated hangouts to open tonight’s mission.');
  }
  const correct = answer === MISSION.answer;
  const next = copy(progress);
  if (correct && !next.missionComplete) {
    next.missionComplete = true;
    next.xp += 50;
    next.sp += 15;
    next.memories = addOnce(next.memories, 'seoul-first-evening');
  }
  return result(record(next, 'food_street', 'mission', correct), correct, correct
    ? progress.missionComplete ? 'Your first Seoul evening is already safely in your memories.' : MISSION.explanation
    : 'One more try: choose the phrase that greets and invites someone onward.');
}

export function nextObjective(progress: Progress): string {
  const nextLesson = LOCATIONS.find((location) => !progress.learned.includes(location.id));
  if (nextLesson) return nextLesson.objective;
  const nextHangout = LOCATIONS.find((location) => !progress.hangouts.includes(location.id));
  if (nextHangout) return `Use ${nextHangout.phrase.ko} in a ${nextHangout.name} hangout.`;
  if (!progress.missionComplete) return missionReady(progress) ? 'Begin the Seoul first-evening mission.' : 'Validate three hangouts to open the mission.';
  return 'Explore Seoul freely and return to the places that feel like yours.';
}

function result(progress: Progress, correct: boolean, message: string) {
  return { progress, correct, message };
}

function record(progress: Progress, location: LocationId, mode: Mode, success: boolean, prefix: string = mode): Progress {
  const entry = {
    id: `${prefix}:${location}:${progress.history.length + 1}:${Date.now()}`,
    location,
    mode,
    success,
    at: new Date().toISOString(),
  };
  return { ...progress, history: [...progress.history, entry].slice(-MAX_HISTORY) };
}

function copy(progress: Progress): Progress {
  return {
    ...progress,
    rp: { ...progress.rp },
    learned: [...progress.learned],
    hangouts: [...progress.hangouts],
    visited: [...progress.visited],
    memories: [...progress.memories],
    history: [...progress.history],
  };
}

function addOnce<T>(items: T[], item: T): T[] {
  return items.includes(item) ? items : [...items, item];
}

function knownIds(value: unknown): LocationId[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is LocationId => typeof item === 'string' && LOCATION_IDS.has(item as LocationId)))];
}

function uniqueStrings(value: string[]): string[] {
  return [...new Set(value)].slice(0, MAX_HISTORY);
}

function validHistory(value: unknown): Progress['history'] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is Progress['history'][number] => {
    if (!entry || typeof entry !== 'object') return false;
    const record = entry as Record<string, unknown>;
    return typeof record.id === 'string'
      && typeof record.at === 'string'
      && typeof record.success === 'boolean'
      && typeof record.location === 'string'
      && LOCATION_IDS.has(record.location as LocationId)
      && (record.mode === 'learn' || record.mode === 'hangout' || record.mode === 'mission');
  }).slice(-MAX_HISTORY);
}

function isSavedProgress(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const saved = value as Record<string, unknown>;
  if (saved.version !== 1 || !isCounter(saved.xp) || !isCounter(saved.sp) || typeof saved.missionComplete !== 'boolean') return false;
  if (!Array.isArray(saved.learned) || !Array.isArray(saved.hangouts) || !Array.isArray(saved.visited) || !Array.isArray(saved.memories) || !Array.isArray(saved.history)) return false;
  if (saved.learned.length > LOCATIONS.length || saved.hangouts.length > LOCATIONS.length || saved.visited.length > LOCATIONS.length || saved.memories.length > MAX_HISTORY || saved.history.length > MAX_HISTORY) return false;
  if (!saved.memories.every((memory) => typeof memory === 'string' && memory.length <= 160)) return false;
  if (!saved.rp || typeof saved.rp !== 'object' || Array.isArray(saved.rp)) return false;
  const rp = saved.rp as Record<string, unknown>;
  if (!COMPANION_IDS.every((id) => isCounter(rp[id]))) return false;
  const learned = knownIds(saved.learned);
  const hangouts = knownIds(saved.hangouts);
  return hangouts.every((id) => learned.includes(id))
    && (!saved.missionComplete || hangouts.length >= 3);
}

function isCounter(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_COUNTER;
}
