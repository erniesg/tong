// Tong's review drill for the cozy game (apps/client/lib/cozy/review.ts).
// Node 22.18+ strips the TypeScript types.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LADDER, planReview, nextFormat, withAttempt, buildReviewExercise, reviewRecords, reviewWords, rng, usable,
} from '../apps/client/lib/cozy/review.ts';
import { parseCozyMessage } from '../apps/client/lib/cozy/bridge.ts';

const WORDS = [
  { ko: '우유', rom: 'uyu', en: 'milk' },
  { ko: '라면', rom: 'ramyeon', en: 'ramyeon' },
  { ko: '김밥', rom: 'gimbap', en: 'gimbap' },
  { ko: '떡볶이', rom: 'tteokbokki', en: 'spicy rice cakes' },
  { ko: '주세요', rom: 'juseyo', en: 'please give me' },
  { ko: '포장해 주세요', rom: 'pojanghae juseyo', en: 'Please pack it to go' },
  { ko: 'N Seoul Tower', en: 'not Korean' },
  { ko: '컵', rom: 'keop' },
];
const NOW = 1_800_000_000_000;
const m = (level, extra = {}) => ({
  masteryLevel: level, correct: 1, incorrect: 0, lastSeen: NOW - 1000, repetitions: 1, nextReview: NOW + 1e9, easeFactor: 2.5, interval: 1, ...extra,
});

test('only Korean entries with a meaning are reviewable', () => {
  assert.deepEqual(reviewWords(WORDS).map((w) => w.ko), ['우유', '라면', '김밥', '떡볶이', '주세요', '포장해 주세요']);
});

test('too few words gives no round', () => {
  assert.equal(planReview(WORDS.slice(0, 3), {}, {}, { now: NOW, seed: 's' }), null);
});

test('a round is deterministic for a seed and never repeats a word', () => {
  const a = planReview(WORDS, {}, {}, { now: NOW, seed: 'x' });
  const b = planReview(WORDS, {}, {}, { now: NOW, seed: 'x' });
  assert.deepEqual(a, b);
  assert.equal(a.length, 6);
  assert.equal(new Set(a.map((i) => i.word.ko)).size, 6);
});

test('due words come first, then unpractised, then the weakest', () => {
  const mastery = {
    우유: m('mastered'),
    라면: m('familiar', { nextReview: NOW - 1 }),
    김밥: m('learning'),
  };
  const plan = planReview(WORDS, mastery, {}, { now: NOW, seed: 'y', size: 6 });
  assert.equal(plan[0].word.ko, '라면');
  assert.deepEqual(new Set(plan.slice(1, 4).map((i) => i.word.ko)), new Set(['떡볶이', '주세요', '포장해 주세요']));
  assert.deepEqual(plan.slice(4).map((i) => i.word.ko), ['김밥', '우유']);
});

test('a new word starts on the first rung; once tried it is stretched up a rung', () => {
  const w = { ko: '우유', rom: 'uyu', en: 'milk' };
  assert.deepEqual(nextFormat(w, 0, [], null, rng('a')), { format: 'meaning', stretch: false });
  const up = nextFormat(w, 0, ['meaning'], null, rng('a'));
  assert.ok(LADDER[1].includes(up.format));
  assert.equal(up.stretch, true);
});

test('formats are tried before any repeats, and every rung is reachable', () => {
  const w = { ko: '우유', rom: 'uyu', en: 'milk' };
  let tried = [];
  for (let i = 0; i < 6; i++) {
    const { format } = nextFormat(w, 0, tried, null, rng(String(i)));
    assert.ok(!tried.includes(format), `repeated ${format}`);
    tried = [...tried, format];
  }
  assert.deepEqual(new Set(tried), new Set(LADDER.flat()));
  // Everything tried: stays on its own rung, varied from the last format.
  const again = nextFormat(w, 1, tried, 'word', rng('z'));
  assert.equal(again.format, 'sound');
  assert.equal(again.stretch, false);
});

test('build needs a plain word; sound needs a romanisation', () => {
  assert.equal(usable('build', { ko: '포장해 주세요', en: 'x', rom: 'y' }), false);
  assert.equal(usable('build', { ko: '떡볶이', en: 'x' }), true);
  assert.equal(usable('sound', { ko: '떡볶이', en: 'x' }), false);
});

test('history records each format once', () => {
  const item = { word: { ko: '우유', en: 'milk' }, format: 'word', rung: 1, stretch: false };
  const h = withAttempt(withAttempt({}, item), item);
  assert.deepEqual(h, { 우유: ['word'] });
});

test('every format builds a valid exercise with the answer in it', () => {
  const pool = reviewWords(WORDS);
  const word = pool[3];
  for (const format of LADDER.flat()) {
    const ex = buildReviewExercise({ word, format, rung: 0, stretch: false }, pool, {}, 'seed');
    if (ex.type === 'multiple_choice') {
      assert.equal(ex.options.length, 4);
      const right = ex.options.find((o) => o.id === ex.correctOptionId).text;
      assert.equal(right, format === 'meaning' ? word.en : word.ko);
    } else if (ex.type === 'pronunciation_select') {
      assert.equal(ex.audioOptions.find((o) => o.id === ex.correctOptionId).label, word.ko);
    } else if (ex.type === 'matching') {
      assert.equal(ex.pairs.length, 4);
      assert.ok(ex.pairs.some((p) => p.left === word.ko && p.right === word.en));
    } else if (ex.type === 'block_crush') {
      assert.equal(ex.fullWord, word.ko);
      assert.equal(ex.stage, 'recall');
    } else if (ex.type === 'free_input') {
      assert.ok(ex.expectedAnswers.includes(word.ko));
    } else {
      assert.fail(`unexpected ${ex.type}`);
    }
  }
});

test('a match records all four words', () => {
  const pool = reviewWords(WORDS);
  const item = { word: pool[0], format: 'match', rung: 2, stretch: false };
  const ex = buildReviewExercise(item, pool, {}, 's');
  assert.equal(reviewRecords(item, ex, true).length, 4);
});

test('the bridge accepts a practice request and rejects malformed ones', () => {
  const msg = (payload) => ({ protocol: 'tong-cozy-bridge', version: 1, type: 'cozy:practice', requestId: 'r1', payload });
  const ok = { mode: 'review', cityId: 'seoul', locationId: 'food_street', words: WORDS.slice(0, 2) };
  assert.equal(parseCozyMessage(msg(ok)).ok, true);
  assert.equal(parseCozyMessage(msg({ ...ok, mode: 'learn', words: [] })).ok, true);
  for (const bad of [
    { ...ok, mode: 'grind' },
    { ...ok, cityId: 'busan' },
    { ...ok, locationId: 'Food Street' },
    { ...ok, words: Array(401).fill({ ko: '우유' }) },
    { ...ok, words: [{ ko: '' }] },
    { ...ok, words: [{ ko: '__proto__' }] },
  ]) assert.equal(parseCozyMessage(msg(bad)).ok, false, JSON.stringify(bad).slice(0, 60));
});
