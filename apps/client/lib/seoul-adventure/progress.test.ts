import assert from 'node:assert/strict';
import test from 'node:test';

import {
  completeHangout,
  completeLesson,
  completeMission,
  missionReady,
  newProgress,
  restoreProgress,
  visitLocation,
} from './progress.js';

test('learn rewards only the first correct completion for a location', () => {
  const fresh = newProgress();
  const first = completeLesson(fresh, 'food_street', 0);
  const replay = completeLesson(first.progress, 'food_street', 0);

  assert.equal(first.correct, true);
  assert.equal(first.progress.xp, 20);
  assert.equal(first.progress.sp, 5);
  assert.deepEqual(first.progress.learned, ['food_street']);
  assert.equal(replay.progress.xp, 20);
  assert.equal(replay.progress.sp, 5);
});

test('hangouts require a learned location and only reward a validated first response', () => {
  const blocked = completeHangout(newProgress(), 'cafe', 'haeun', 0);
  assert.equal(blocked.correct, false);
  assert.equal(blocked.progress.xp, 0);

  const learned = completeLesson(newProgress(), 'cafe', 0).progress;
  const missed = completeHangout(learned, 'cafe', 'haeun', 1);
  const passed = completeHangout(missed.progress, 'cafe', 'haeun', 0);
  const replay = completeHangout(passed.progress, 'cafe', 'jin', 0);

  assert.equal(missed.progress.rp.haeun, 0);
  assert.equal(passed.progress.rp.haeun, 8);
  assert.equal(passed.progress.xp, 35);
  assert.equal(replay.progress.xp, 35);
  assert.equal(replay.progress.rp.jin, 0);
});

test('three validated hangouts open a one-time mission reward', () => {
  let progress = newProgress();
  for (const id of ['food_street', 'cafe', 'subway_hub'] as const) {
    progress = completeLesson(progress, id, 0).progress;
    progress = completeHangout(progress, id, 'haeun', 0).progress;
  }

  assert.equal(missionReady(progress), true);
  const passed = completeMission(progress, 0);
  const replay = completeMission(passed.progress, 0);

  assert.equal(passed.correct, true);
  assert.equal(passed.progress.missionComplete, true);
  assert.equal(passed.progress.xp, 155);
  assert.equal(passed.progress.sp, 30);
  assert.deepEqual(passed.progress.memories, ['seoul-first-evening']);
  assert.equal(replay.progress.xp, 155);
  assert.equal(replay.progress.sp, 30);
  assert.equal(replay.progress.memories.length, 1);
});

test('restore rejects corrupted and suspicious saves while retaining bounded known data', () => {
  assert.deepEqual(restoreProgress('{bad json'), newProgress());
  assert.deepEqual(restoreProgress(JSON.stringify({ version: 1, xp: 999999 })), newProgress());

  const restored = restoreProgress(JSON.stringify({
    version: 1,
    xp: 41,
    sp: 7,
    rp: { haeun: 8, jin: 0 },
    learned: ['cafe', 'unknown', 'cafe'],
    hangouts: ['cafe', 'unknown'],
    visited: ['cafe', 'unknown'],
    missionComplete: false,
    memories: [],
    history: [],
  }));
  assert.equal(restored.xp, 41);
  assert.deepEqual(restored.learned, ['cafe']);
  assert.deepEqual(restored.hangouts, ['cafe']);
  assert.deepEqual(restored.visited, ['cafe']);
});

test('visits and every submitted answer are recorded in a 30-entry history', () => {
  let progress = visitLocation(newProgress(), 'food_street');
  assert.equal(progress.history[0]?.id.startsWith('visit:'), true);
  assert.equal(progress.history[0]?.location, 'food_street');

  for (let index = 0; index < 35; index += 1) {
    progress = completeLesson(progress, 'food_street', 1).progress;
  }
  assert.equal(progress.history.length, 30);
  assert.equal(progress.history.every((entry) => entry.mode === 'learn'), true);
});
