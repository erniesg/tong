// Day 2 helpers (apps/client/public/cozy/js/day2.js): node --test scripts/cozy-day2.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = (f) => new URL(`../apps/client/public/cozy/js/${f}`, import.meta.url).href;
const { weekday, WEEKDAYS, LOOPS, loopDue, drillKinds, drillPassed, DRILL_CALLS } = await import(js('day2.js'));
const { makeCalls } = await import(js('eval/dance.js'));

test('day 1 is a Sunday, so day 2 is a Monday and day 8 the next Sunday', () => {
  assert.equal(WEEKDAYS[weekday(1)].en, 'Sunday');
  assert.equal(WEEKDAYS[weekday(2)].en, 'Monday');
  assert.equal(weekday(8), 0);
  assert.equal(weekday(9), 1);
});

test('each origin loop is weekly and starts on day 2', () => {
  assert.equal(loopDue('athlete', 2, 'morning'), 'seoul.loop.dawn');
  assert.equal(loopDue('athlete', 3, 'morning'), null);
  assert.equal(loopDue('athlete', 9, 'morning'), 'seoul.loop.dawn');
  assert.equal(loopDue('athlete', 2, 'bed'), null);
  assert.equal(loopDue('creator', 2, 'bed'), 'seoul.loop.edit');
  assert.equal(loopDue('creator', 2, 'morning'), null);
  // Played tonight already: not again.
  assert.equal(loopDue('creator', 2, 'bed', { 'played:seoul.loop.edit:d2': true }), null);
  // The family call waits for Mum's text, then plays on Sundays from day 8.
  assert.equal(loopDue('intl_kid', 8, 'morning'), null);
  assert.equal(loopDue('intl_kid', 8, 'morning', { family_call_set: true }), 'seoul.loop.family_call');
  assert.equal(loopDue('intl_kid', 1, 'morning', { family_call_set: true }), null);
  assert.equal(loopDue(null, 2, 'morning'), null);
  for (const loop of Object.values(LOOPS)) assert.ok(loop.weekday >= 0 && loop.weekday < 7);
});

test('a drill narrows the calls to its kinds and passes on most right', () => {
  assert.deepEqual(drillKinds(['move']), ['move']);
  assert.deepEqual(drillKinds([]), ['move', 'pose']);
  for (const seed of [1, 7, 42]) {
    const moves = makeCalls(seed, DRILL_CALLS, { kinds: ['move'] });
    assert.ok(moves.every((c) => c.kind === 'move'), 'moves only');
    // Without kinds the calls are unchanged (eval 1 keeps its seeds).
    assert.deepEqual(makeCalls(seed, 8), makeCalls(seed, 8, { kinds: null }));
  }
  const r = (n) => Array.from({ length: DRILL_CALLS }, (_, i) => ({ correct: i < n }));
  assert.equal(drillPassed(r(4)), true);
  assert.equal(drillPassed(r(3)), false);
});

test('every Day 2 scene is registered and the drill follows H1', () => {
  const index = readFileSync(new URL('../apps/client/lib/content/routes/index.ts', import.meta.url), 'utf8');
  assert.match(index, /h1, d2Drill/);
  const main = readFileSync(new URL('../apps/client/public/cozy/js/main.js', import.meta.url), 'utf8');
  assert.match(main, /req\.exerciseType === 'formation_grid'/);
  assert.match(main, /scene\.id === 'haeun\.h1'\) \{\n    setTimeout\(\(\) => scenes\.play\('seoul\.d2\.drill'\)/);
});

test('giving the call: four different calls, exactly one gets her to the dashed cell', async () => {
  const { calloutItems, matches } = await import(js('eval/dance.js'));
  for (const seed of [3, 11, 99]) {
    const items = calloutItems(seed, 6);
    assert.equal(items.length, 6);
    for (const it of items) {
      assert.equal(it.options.length, 4, 'four options');
      assert.equal(new Set(it.options.map((o) => o.ko)).size, 4, 'all different');
      const right = it.options.filter((o) => matches(o.target, it.target));
      assert.equal(right.length, 1, 'one right answer');
      assert.equal(right[0].ko, it.answer);
    }
  }
});

test('everyone who sleeps in the dorm has a bed', () => {
  const src = readFileSync(new URL('../apps/client/public/cozy/js/dorm.js', import.meta.url), 'utf8');
  const cast = [...src.matchAll(/\{ id: '(\w+)', name:/g)].map((m) => m[1]);
  const beds = src.slice(src.indexOf('export const DORM_BEDS'), src.indexOf('};', src.indexOf('export const DORM_BEDS')));
  assert.ok(cast.length >= 5);
  for (const id of [...cast, 'haeun']) assert.match(beds, new RegExp(`\\b${id}:`), `${id} has a bed`);
});
