import assert from 'node:assert/strict';
import test from 'node:test';

import { LOCATIONS, MISSION } from './content.js';
import {
  completeHangout,
  completeLesson,
  completeMission,
  missionReady,
  newProgress,
  nextObjective,
  restoreProgress,
  visitLocation,
} from './progress.js';

const location = (id: (typeof LOCATIONS)[number]['id']) => LOCATIONS.find((item) => item.id === id)!;
const correctLesson = (id: (typeof LOCATIONS)[number]['id']) => location(id).lesson.answer;
const wrongLesson = (id: (typeof LOCATIONS)[number]['id']) => (correctLesson(id) + 1) % location(id).lesson.choices.length;
const correctHangout = (id: (typeof LOCATIONS)[number]['id']) => location(id).hangoutReply.answer;

test('learn rewards only the first correct completion for a location', () => {
  const fresh = newProgress();
  const first = completeLesson(fresh, 'food_street', correctLesson('food_street'));
  const replay = completeLesson(first.progress, 'food_street', correctLesson('food_street'));

  assert.equal(first.correct, true);
  assert.equal(first.progress.xp, 20);
  assert.equal(first.progress.sp, 5);
  assert.deepEqual(first.progress.learned, ['food_street']);
  assert.equal(replay.progress.xp, 20);
  assert.equal(replay.progress.sp, 5);
});

test('hangouts require a learned location and only reward a validated first response', () => {
  const blocked = completeHangout(newProgress(), 'cafe', 'haeun', correctHangout('cafe'));
  assert.equal(blocked.correct, false);
  assert.equal(blocked.progress.xp, 0);

  const learned = completeLesson(newProgress(), 'cafe', correctLesson('cafe')).progress;
  const missed = completeHangout(learned, 'cafe', 'haeun', (correctHangout('cafe') + 1) % location('cafe').hangoutReply.choices.length);
  const passed = completeHangout(missed.progress, 'cafe', 'haeun', correctHangout('cafe'));
  const replay = completeHangout(passed.progress, 'cafe', 'jin', correctHangout('cafe'));

  assert.equal(missed.progress.rp.haeun, 0);
  assert.match(missed.message, /같이 커피 마실래요/);
  assert.equal(passed.progress.rp.haeun, 8);
  assert.equal(passed.progress.xp, 35);
  assert.equal(replay.progress.xp, 35);
  assert.equal(replay.progress.rp.jin, 0);
});

test('three validated hangouts open a one-time mission reward', () => {
  let progress = newProgress();
  for (const id of ['food_street', 'cafe', 'subway_hub'] as const) {
    progress = completeLesson(progress, id, correctLesson(id)).progress;
    progress = completeHangout(progress, id, 'haeun', correctHangout(id)).progress;
  }

  assert.equal(missionReady(progress), true);
  const passed = completeMission(progress, MISSION.answer);
  const replay = completeMission(passed.progress, MISSION.answer);

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

test('visits update navigation state without inventing a completed lesson history entry', () => {
  let progress = visitLocation(newProgress(), 'food_street');
  assert.deepEqual(progress.visited, ['food_street']);
  assert.deepEqual(progress.history, []);

  for (let index = 0; index < 35; index += 1) {
    progress = completeLesson(progress, 'food_street', wrongLesson('food_street')).progress;
  }
  assert.equal(progress.history.length, 30);
  assert.equal(progress.history.every((entry) => entry.mode === 'learn'), true);
});

test('next objective progresses from a learned phrase to its hangout, then the mission', () => {
  let progress = completeLesson(newProgress(), 'food_street', correctLesson('food_street')).progress;
  assert.match(nextObjective(progress), /hangout/i);

  for (const id of ['food_street', 'cafe', 'subway_hub'] as const) {
    if (!progress.learned.includes(id)) progress = completeLesson(progress, id, correctLesson(id)).progress;
    progress = completeHangout(progress, id, 'jin', correctHangout(id)).progress;
  }
  assert.equal(missionReady(progress), true);
  assert.equal(nextObjective(progress), 'Begin the Seoul first-evening mission.');
  progress = completeMission(progress, MISSION.answer).progress;
  assert.equal(nextObjective(progress), 'Explore Seoul freely and return to the places that feel like yours.');
});

test('authored exercises vary their correct answer position and hangouts practise learned language', () => {
  assert.ok(new Set([...LOCATIONS.map((item) => item.lesson.answer), MISSION.answer]).size > 1);
  for (const item of LOCATIONS) {
    const learnedPhrase = item.phrase.ko;
    assert.equal(item.hangoutReply.choices[item.hangoutReply.answer]?.ko, learnedPhrase);
  }
});
