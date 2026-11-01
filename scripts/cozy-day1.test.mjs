// Day 1 helpers (apps/client/public/cozy/js/day1.js, hangul.js): node --test scripts/cozy-day1.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = (f) => new URL(`../apps/client/public/cozy/js/${f}`, import.meta.url).href;
const { ORIGINS, originFlag, START_HOUR, hongdaeArrival, studioHour, migrateDay1, ARRIVAL_STEPS, arrivalState, studioCastOn } = await import(js('day1.js'));
const { basicLetters, hangulProgress, metWords, BASIC } = await import(js('hangul.js'));

test('there are 24 basic letters and words break into them', () => {
  assert.equal([...BASIC].length, 24);
  assert.deepEqual(basicLetters('출구'), ['ㅊ', 'ㅜ', 'ㄹ', 'ㄱ']);
  assert.deepEqual(basicLetters('일반'), ['ㅇ', 'ㅣ', 'ㄹ', 'ㅂ', 'ㅏ', 'ㄴ']);
  // ㅐ is a combined vowel: not one of the 24.
  assert.deepEqual(basicLetters('대'), ['ㄷ']);
});

test('the language road meets 13 letters on day one, each tied to its first word', () => {
  const words = metWords({ 'hangul:출구': true, 'hangul:일반': true, 'hangul:홍대입구': true, 'hangul:입니다': true, 'hangul:수아': true, other: true });
  assert.deepEqual(words, ['출구', '일반', '홍대입구', '입니다', '수아']);
  const p = hangulProgress(words);
  assert.equal(p.count, 13);
  assert.equal(p.total, 24);
  assert.equal(p.letters.find((l) => l.letter === 'ㅊ').word, '출구');
  assert.equal(p.letters.find((l) => l.letter === 'ㅎ').word, '홍대입구');
  // A read sign adds its own letters: 연습실 brings seven new ones.
  assert.equal(hangulProgress(metWords({ 'hangul:출구': true }, ['연습실'])).count, 11);
});

test('origins and the start', () => {
  assert.deepEqual(ORIGINS.map((o) => o.id), ['athlete', 'creator', 'intl_kid']);
  assert.equal(originFlag('creator'), 'origin_creator');
  assert.equal(originFlag('nope'), null);
  assert.equal(Math.round(START_HOUR * 60), 13 * 60 + 5);
});

test('how you travelled decides where and when you come up in Hongdae', () => {
  assert.deepEqual(hongdaeArrival({ d1_taxi: true, d1_early: true }), { at: 'street', hour: 14.5 });
  assert.equal(hongdaeArrival({ d1_early: true }).at, 'station');
  assert.ok(hongdaeArrival({ d1_early: true }).hour < hongdaeArrival({ d1_ontime: true }).hour);
  assert.ok(hongdaeArrival({ d1_ontime: true }).hour < 15);
  assert.ok(hongdaeArrival({ d1_late: true }).hour > 15);
  // The studio clock never runs backwards.
  assert.equal(studioHour({ d1_early: true }, 16), 16);
  assert.ok(studioHour({ d1_late: true }, 15) > 15.3);
});

test('old saves skip the airport; new ones are left alone', () => {
  const old = migrateDay1({ h0_done: true });
  assert.ok(old.d1_legacy && old.orientation_done && old.d1_arrived_hongdae && old.h0_done);
  const fresh = { d1_started: true };
  assert.equal(migrateDay1(fresh), fresh);
});

test('the arrival chain ticks in order from story flags', () => {
  assert.deepEqual(ARRIVAL_STEPS.map(([id]) => id), ['airport', 'train', 'agency', 'locker', 'register', 'dorm', 'firstNight']);
  const s = arrivalState({ d1_exit_done: true, d1_arrived_hongdae: true });
  assert.equal(s.airport && s.train, true);
  assert.equal(s.agency, false);
  assert.ok(Object.values(arrivalState({}, { day: 2 })).every(Boolean));
  assert.equal(arrivalState({}, { registered: true }).register, true);
});

test('the studio fills for orientation, and only then', () => {
  assert.equal(studioCastOn({}), false);
  assert.equal(studioCastOn({ d1_arrived_hongdae: true, d1_ontime: true }), true);
  // Early: Haeun alone until the arrival scene has played.
  assert.equal(studioCastOn({ d1_arrived_hongdae: true, d1_early: true }), false);
  assert.equal(studioCastOn({ d1_arrived_hongdae: true, d1_early: true, 'played:seoul.d1.arrive': true }), true);
  assert.equal(studioCastOn({ d1_arrived_hongdae: true, orientation_done: true }), false);
  assert.equal(studioCastOn({ ...migrateDay1({}) }), false);
});

test('incheon is hidden from flights and starts the day facing the hall', () => {
  const src = readFileSync(new URL('../apps/client/public/cozy/js/cities/incheon.js', import.meta.url), 'utf8');
  assert.match(src, /hidden: true/);
  const main = readFileSync(new URL('../apps/client/public/cozy/js/main.js', import.meta.url), 'utf8');
  assert.match(main, /Object\.values\(cities\)\.filter\(\(c\) => !c\.hidden\)/);
  assert.match(main, /S\.city = 'incheon';/);
});
