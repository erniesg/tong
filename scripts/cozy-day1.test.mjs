// Day 1 helpers (apps/client/public/cozy/js/day1.js, hangul.js): node --test scripts/cozy-day1.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = (f) => new URL(`../apps/client/public/cozy/js/${f}`, import.meta.url).href;
const { ORIGINS, originFlag, START_HOUR, hongdaeArrival, studioHour, migrateDay1, ARRIVAL_STEPS, arrivalState, studioCastOn, inForPractice, arrivalTiming, ARRIVAL_HOURS, STOP_MINUTES, dayOneOpen, dayOneClockHeld } = await import(js('day1.js'));
const { basicLetters, hangulProgress, metWords, BASIC } = await import(js('hangul.js'));
const { decompose, blockRom, breakdown, slotsFor, pairsFor, isTongPlay } = await import(js('tongplay.js'));
const scene = (f) => readFileSync(new URL(`../apps/client/lib/content/routes/${f}`, import.meta.url), 'utf8');

test('there are 24 basic letters and words break into them', () => {
  assert.equal([...BASIC].length, 24);
  assert.deepEqual(basicLetters('출구'), ['ㅊ', 'ㅜ', 'ㄹ', 'ㄱ']);
  assert.deepEqual(basicLetters('일반'), ['ㅇ', 'ㅣ', 'ㄹ', 'ㅂ', 'ㅏ', 'ㄴ']);
  // ㅐ is a combined vowel: not one of the 24.
  assert.deepEqual(basicLetters('대'), ['ㄷ']);
});

test('day one meets eight letters, two or three at a time, each new word built on the last', () => {
  // The order the day's scenes set them (docs/seoul-first-day.md).
  const steps = [['아', 2], ['이', 3], ['수아', 5], ['다온', 8]];
  const flags = {};
  for (const [word, total] of steps) {
    const before = hangulProgress(metWords(flags)).count;
    flags[`hangul:${word}`] = true;
    const p = hangulProgress(metWords(flags));
    assert.equal(p.count, total, word);
    assert.ok(p.count - before <= 3, `${word} brings at most three new letters`);
  }
  const p = hangulProgress(metWords(flags));
  assert.equal(p.letters.find((l) => l.letter === 'ㅅ').word, '수아');
  assert.equal(p.letters.find((l) => l.letter === 'ㄴ').word, '다온');
  // Each of those words is set by a scene, and no scene asks for block crush on day one.
  const day = ['seoul/d1-train.ts', 'seoul/d1-lobby.ts', 'haeun/h0-arrival.ts', 'haeun/h0-dorm.ts', 'seoul/d1-bedtime.ts', 'seoul/d1-orientation.ts', 'haeun/d1-room-b.ts'].map(scene);
  for (const [word] of steps) assert.ok(day.some((src) => src.includes(`'hangul:${word}'`)), word);
  for (const src of day) assert.doesNotMatch(src, /type: 'block_crush'/);
  // Five kinds of small game, and the day never plays the same kind twice running.
  const kinds = day.flatMap((src) => [...src.matchAll(/type: '(hangul_\w+|say_it)'/g)].map((m) => m[1]));
  assert.deepEqual(new Set(kinds), new Set(['hangul_compose', 'hangul_listen', 'hangul_missing', 'hangul_match', 'say_it']));
  for (const k of kinds) assert.ok(isTongPlay(k), k);
});

test('the small games read their pieces from the scene', () => {
  assert.deepEqual(decompose('수'), { block: '수', lead: 'ㅅ', vowel: 'ㅜ', tail: '', rom: 'su' });
  assert.equal(decompose('ㅅ'), null);
  assert.equal(blockRom('다온'), 'da-on');
  assert.equal(blockRom('아이'), 'a-i');
  // What a finished game shows: how the word is put together.
  assert.equal(breakdown('다온'), '다 = ㄷ d + ㅏ a · 온 = ㅇ + ㅗ o + ㄴ n');
  assert.equal(breakdown('수'), '수 = ㅅ s + ㅜ u');
  // Build 아: two empty slots, side by side.
  const [a] = slotsFor('hangul_compose', ['아']);
  assert.deepEqual(a.slots.map((s) => [s.letter, s.given]), [['ㅇ', false], ['ㅏ', false]]);
  assert.equal(a.under, false);
  // The scraped label: only the ㅜ of 수 is missing; 아 is whole.
  const [su, ah] = slotsFor('hangul_missing', ['수아', 'ㅜ']);
  assert.deepEqual(su.slots.map((s) => [s.letter, s.given]), [['ㅅ', true], ['ㅜ', false]]);
  assert.equal(su.under, true);
  assert.ok(ah.slots.every((s) => s.given));
  assert.deepEqual(pairsFor(['수:su', '온:on']), [{ block: '수', sound: 'su' }, { block: '온', sound: 'on' }]);
});

test('origins and the start', () => {
  assert.deepEqual(ORIGINS.map((o) => o.id), ['athlete', 'creator', 'intl_kid']);
  assert.equal(originFlag('creator'), 'origin_creator');
  assert.equal(originFlag('nope'), null);
  assert.equal(Math.round(START_HOUR * 60), 16 * 60 + 20);
});

test('who you met on the way decides when you reach the second floor', () => {
  assert.deepEqual(hongdaeArrival(), { at: 'station', hour: 16 + 25 / 60 });
  // Straight up from the station: early, Ha-eun alone. Small stops don't change that.
  assert.equal(arrivalTiming({}), 'early');
  assert.equal(arrivalTiming({ d1_cart: true }, { d1_stops: 1 }), 'early');
  // The tent first (Jin): on time. The tent and another stop: late, unless your origin's perk got you there.
  assert.equal(arrivalTiming({ j0_done: true }), 'ontime');
  assert.equal(arrivalTiming({ j0_done: true }, { d1_stops: 1 }), 'late');
  assert.equal(arrivalTiming({ j0_done: true, d1_shortcut: true }, { d1_stops: 1 }), 'ontime');
  assert.ok(ARRIVAL_HOURS.early < ARRIVAL_HOURS.ontime && ARRIVAL_HOURS.ontime < 17 && ARRIVAL_HOURS.late > 17);
  // The clock never runs backwards.
  assert.equal(studioHour({ d1_early: true }, 18), 18);
  assert.equal(studioHour({ d1_late: true }, 16.5), ARRIVAL_HOURS.late);
  assert.ok(STOP_MINUTES['jin.j0'] > 0);
});

test('old saves skip day one; new ones are left alone', () => {
  const old = migrateDay1({ h0_done: true });
  assert.ok(old.d1_legacy && old.orientation_done && old.d1_arrived_hongdae && old.h0_done);
  const fresh = { d1_started: true };
  assert.equal(migrateDay1(fresh), fresh);
  // The Day 1 scenes count as played, so nothing replays and Tong's hints move on.
  for (const id of ['train', 'street', 'lobby', 'arrive', 'orientation']) assert.ok(old[`played:seoul.d1.${id}`], id);
  assert.ok(old['played:haeun.d1.room_b']);
  assert.equal(dayOneOpen(old), false);
  assert.equal(dayOneClockHeld(old), false);
  // The first-night talk is skipped once they've slept in the dorm, kept if tonight is their first.
  assert.ok(migrateDay1({ dorm_arrived: true })['played:seoul.d1.bedtime']);
  assert.equal(migrateDay1({ h0_done: true })['played:seoul.d1.bedtime'], undefined);
});

test('a clock left running on Day 1 never skips it', () => {
  const inIncheon = { d1_started: true };
  assert.equal(dayOneClockHeld(inIncheon), true);
  assert.equal(dayOneClockHeld({ ...inIncheon, d1_arrival_seen: true }), false);
  // Day 2 without orientation: nothing ticks by itself.
  assert.ok(Object.values(arrivalState(inIncheon, { day: 2 })).every((v) => !v));
  assert.equal(dayOneOpen({ ...inIncheon, d1_arrival_seen: true }), true);
});

test('the arrival chain ticks in order from story flags', () => {
  assert.deepEqual(ARRIVAL_STEPS.map(([id]) => id), ['train', 'agency', 'locker', 'register', 'dorm', 'firstNight']);
  const s = arrivalState({ d1_arrived_hongdae: true });
  assert.equal(s.train, true);
  assert.equal(s.agency, false);
  assert.ok(Object.values(arrivalState({ orientation_done: true }, { day: 2 })).every(Boolean));
  assert.equal(arrivalState({}, { registered: true }).register, true);
});

test('the studio fills for orientation, and only then', () => {
  assert.equal(studioCastOn({}), false);
  // Day one: they are behind Room A's door until you have met whoever was in the corridor.
  assert.equal(studioCastOn({ d1_arrived_hongdae: true, d1_ontime: true }), false);
  assert.equal(studioCastOn({ d1_arrived_hongdae: true, d1_early: true, d1_arrival_seen: true }), true);
  assert.equal(studioCastOn({ d1_arrived_hongdae: true, orientation_done: true }), false);
  assert.equal(studioCastOn({ ...migrateDay1({}) }), false);
  // From day 2 the cohort is in for practice, 10:00–18:00; Da-on only after school.
  assert.equal(studioCastOn({ orientation_done: true }, { day: 2, hour: 11 }), true);
  assert.equal(studioCastOn({ orientation_done: true }, { day: 2, hour: 20 }), false);
  assert.equal(inForPractice('daon', 11), false);
  assert.equal(inForPractice('daon', 15), true);
  assert.equal(inForPractice('minji', 11), true);
});

test('the airport train is hidden from flights and the day starts on it', () => {
  const src = readFileSync(new URL('../apps/client/public/cozy/js/cities/incheon.js', import.meta.url), 'utf8');
  assert.match(src, /hidden: true/);
  const main = readFileSync(new URL('../apps/client/public/cozy/js/main.js', import.meta.url), 'utf8');
  assert.match(main, /Object\.values\(cities\)\.filter\(\(c\) => !c\.hidden\)/);
  assert.match(main, /S\.city = 'incheon';/);
});
