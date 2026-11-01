// Seoul day loop (#410): 기력 drain/restore, sleep → condition, Tong stops time.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DAY_CONFIG, CONDITIONS, clockRuns, clockHours, tick, movementCost, eat, conditionForBedtime, sleepOutcome,
  modifiers, sleepReaction, afterCurfew, bedKind, freshDayState, normalizeDayState, createDayLoop,
} from '../apps/client/public/cozy/js/day.js';

const clockState = (hour = 16.5, day = 1) => ({ hour, day, phrases: new Map() });
const advance = (S) => (h) => {
  const total = S.hour + h;
  S.day += Math.floor(total / 24);
  S.hour = total % 24;
};

/** One game frame as main.js runs it: the clock and 기력 move only while clockRuns. */
function frame(S, d, dt, ui, moves = {}) {
  if (!clockRuns({ started: true, ...ui })) return;
  tick(S, d, clockHours(dt, 1), { awayFromDorm: true, ...moves });
}

test('tapping Tong stops time: Tong menu, Learn/Review, collections and panels freeze the clock and 기력', () => {
  for (const ui of [{ dialogue: true }, { bridgeBusy: true }, { modal: true }]) {
    const S = clockState(22.5);
    const d = freshDayState();
    for (let i = 0; i < 6000; i++) frame(S, d, 1 / 60, ui, { walkMetres: 0.1, runMetres: 0.1 }); // 100 s of walking past curfew
    assert.equal(S.hour, 22.5, JSON.stringify(ui));
    assert.equal(S.day, 1);
    assert.equal(d.energy, DAY_CONFIG.max);
  }
  assert.equal(clockRuns({ started: false }), false, 'title screen');
  const S = clockState(10);
  const d = freshDayState();
  for (let i = 0; i < 1800; i++) frame(S, d, 1 / 60, {}, { walkMetres: 0.05 });
  assert.ok(Math.abs(S.hour - 11) < 1e-6, '30 real seconds is one clock hour');
  assert.ok(d.energy < DAY_CONFIG.max, 'walking spends 기력 while time runs');
});

test('running costs more than walking; rides and standing still cost nothing', () => {
  assert.ok(movementCost(0, 100) > movementCost(100, 0) * 2);
  assert.equal(movementCost(0, 0), 0);
  assert.ok(Math.abs(movementCost(100, 0) - 100 * DAY_CONFIG.drain.walkPerMetre) < 1e-9);
  // An hour of non-stop walking (3.4 m/s × 30 s) is a small cost; an hour of running is noticeable.
  const walkHour = movementCost(3.4 * 30, 0), runHour = movementCost(0, 3.4 * 1.7 * 30);
  assert.ok(walkHour > 1 && walkHour < 6, `walk hour ${walkHour}`);
  assert.ok(runHour > 10 && runHour < 20, `run hour ${runHour}`);
});

test('being out after 23:00 drains and raises the curfew hook once; the dorm does not', () => {
  assert.equal(afterCurfew(22.9), false);
  assert.equal(afterCurfew(23), true);
  assert.equal(afterCurfew(3), true);
  assert.equal(afterCurfew(6), false);
  const S = clockState(23), d = freshDayState();
  const first = tick(S, d, 1, { awayFromDorm: true });
  assert.deepEqual(first, ['midnight', 'curfew']);
  assert.equal(d.energy, DAY_CONFIG.max - DAY_CONFIG.drain.nightPerHour);
  assert.equal(d.nightOut, true);
  assert.deepEqual(tick(S, d, 0.5, { awayFromDorm: true }), [], 'curfew fires once a night');
  const home = clockState(23.5), dh = freshDayState();
  tick(home, dh, 1, { awayFromDorm: false });
  assert.equal(dh.energy, DAY_CONFIG.max);
  assert.equal(dh.nightOut, false);
  const tokyo = clockState(23.5), dt = freshDayState();
  tick(tokyo, dt, 1, { awayFromDorm: true, curfewApplies: false });
  assert.equal(dt.energy, DAY_CONFIG.max, 'no curfew outside Seoul');
});

test('meals, snacks and bench rests restore a little; food is capped per day', () => {
  const d = { ...freshDayState(), energy: 40 };
  assert.equal(eat(d, 'meal'), DAY_CONFIG.restore.meal);
  assert.equal(eat(d, 'snack'), DAY_CONFIG.restore.snack);
  for (let i = 2; i < DAY_CONFIG.restore.mealsPerDay; i++) eat(d, 'snack');
  const before = d.energy;
  assert.equal(eat(d, 'meal'), 0);
  assert.equal(d.energy, before);
  const S = clockState(15);
  const b = { ...freshDayState(), energy: 50 };
  tick(S, b, 2, { resting: true });
  assert.equal(b.energy, 50 + 2 * DAY_CONFIG.restore.benchPerHour);
  const full = freshDayState();
  assert.equal(eat(full, 'meal'), 0, 'never above the max');
  assert.equal(full.energy, DAY_CONFIG.max);
});

test('bedtime sets tomorrow’s condition', () => {
  assert.equal(conditionForBedtime(20), 'fresh');
  assert.equal(conditionForBedtime(23.99), 'fresh');
  assert.equal(conditionForBedtime(0.5), 'okay');
  assert.equal(conditionForBedtime(1.5), 'tired');
  assert.equal(conditionForBedtime(2.5), 'wrecked');
  assert.equal(conditionForBedtime(6), 'wrecked');
  assert.equal(conditionForBedtime(null), 'wrecked', 'all-nighter');
  assert.deepEqual(sleepOutcome(21, 10), { condition: 'fresh', energy: 100, wakeHour: 7, hours: 10 });
  assert.equal(sleepOutcome(0.5, 10).energy, CONDITIONS.okay.start);
  assert.equal(sleepOutcome(1.5, 95).energy, CONDITIONS.tired.start, 'partial: capped below full');
  assert.equal(sleepOutcome(3, 95).energy, CONDITIONS.wrecked.start, 'after 02:00 starts low');
  assert.equal(sleepOutcome(null, 20).energy, 20, 'all-nighter restores nothing');
  assert.equal(sleepOutcome(null, 90).energy, CONDITIONS.wrecked.start, 'and you start tired');
  for (const h of [20, 23, 0.5, 1.5, 3]) {
    const o = sleepOutcome(h, 50);
    assert.ok(o.wakeHour >= 7 && o.wakeHour <= 8);
    assert.equal(((h + o.hours) % 24).toFixed(6), o.wakeHour.toFixed(6));
  }
  assert.equal(bedKind(19.9), 'nap');
  assert.equal(bedKind(20), 'sleep');
  assert.equal(bedKind(2), 'sleep');
  assert.equal(bedKind(7), 'nap');
});

test('worse condition tightens timing and raises Tong hint cost', () => {
  const order = ['fresh', 'okay', 'tired', 'wrecked'].map(modifiers);
  for (let i = 1; i < order.length; i++) {
    assert.ok(order[i].timingWindowScale <= order[i - 1].timingWindowScale);
    assert.ok(order[i].tongHintCostScale >= order[i - 1].tongHintCostScale);
  }
  assert.deepEqual(modifiers('fresh'), { timingWindowScale: 1, tongHintCostScale: 1 });
});

test('Haeun’s sleep remark is a 반말 line, so only from friends on', () => {
  assert.equal(sleepReaction('haeun', 'tired', 'colleagues'), null);
  assert.equal(sleepReaction('haeun', 'fresh', 'friends'), null);
  const r = sleepReaction('haeun', 'wrecked', 'close');
  assert.equal(r.ko, '너 어제 몇 시에 잤어?');
  assert.equal(r.review, 'native');
});

test('save state is normalised', () => {
  assert.deepEqual(normalizeDayState(null, 3), freshDayState(3));
  const d = normalizeDayState({ energy: 400, condition: 'great', bedtime: 25, meals: -2 }, 2);
  assert.equal(d.energy, DAY_CONFIG.max);
  assert.equal(d.condition, 'fresh');
  assert.equal(d.bedtime, 1);
  assert.equal(d.meals, 0);
  assert.equal(normalizeDayState({ energy: 12, condition: 'tired' }).condition, 'tired');
});

test('bed → recap → sleep → morning: new day, condition, event', async () => {
  const S = clockState(21.5, 4);
  S.phrases.set('라면', {}).set('우유', {});
  S.dayLoop = { ...freshDayState(4), energy: 22, phrasesAtWake: 1, meals: 3 };
  const seen = [];
  const ui = { recap: async (info) => (seen.push(['recap', info]), 'sleep'), morning: async (detail) => seen.push(['morning', detail]), update() {} };
  const loop = createDayLoop({ S, advanceHours: advance(S), ui, target: null });
  const events = [];
  loop.on('newday', (e) => events.push(e));
  const out = await loop.sleepUntilMorning();
  assert.deepEqual(seen[0][1].words, ['우유'], 'recap lists words met today');
  assert.equal(seen[0][1].condition, 'fresh');
  assert.equal(S.day, 5);
  assert.equal(S.hour, 7);
  assert.equal(out.id, 'fresh');
  assert.equal(loop.getCondition().energy, 100);
  assert.equal(S.dayLoop.meals, 0, 'daily counters reset');
  assert.equal(S.dayLoop.bedtime, 21.5);
  assert.equal(events.length, 1);
  assert.equal(seen[1][0], 'morning');

  // A late night: bed at 01:30 the same calendar day lands later that morning.
  S.hour = 1.5;
  await loop.sleepUntilMorning({ skipRecap: true });
  assert.equal(S.day, 5);
  assert.equal(S.hour, 8);
  assert.equal(loop.getCondition().id, 'tired');
  assert.equal(loop.getCondition().timingWindowScale, CONDITIONS.tired.timingWindowScale);

  // Backing out of bed changes nothing.
  S.hour = 22;
  const cancel = createDayLoop({ S, advanceHours: advance(S), ui: { ...ui, recap: async () => 'cancel' }, target: null });
  assert.equal(await cancel.sleepUntilMorning(), null);
  assert.equal(S.hour, 22);
});

test('staying up until morning is an all-nighter: nothing restored, wrecked', () => {
  const S = clockState(22, 1);
  S.dayLoop = { ...freshDayState(1), energy: 70 };
  const mornings = [];
  const loop = createDayLoop({ S, advanceHours: advance(S), ui: { morning: (d) => mornings.push(d), update() {} }, target: null });
  for (let h = 0; h < 9; h += 0.25) loop.tick(0.25, { awayFromDorm: false });
  assert.equal(S.day, 2);
  assert.equal(mornings.length, 1);
  assert.equal(mornings[0].reason, 'allNighter');
  assert.equal(loop.getCondition().id, 'wrecked');
  assert.ok(loop.energy <= CONDITIONS.wrecked.start);
  // The next morning without sleep is another all-nighter; a slept night is not.
  for (let h = 0; h < 30; h += 0.5) loop.tick(0.5, {});
  assert.equal(mornings.length, 2);
});

test('main.js wires the clock through clockRuns with every Tong surface', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../apps/client/public/cozy/js/main.js', import.meta.url), 'utf8');
  assert.match(src, /clockRuns\(\{ started: S\.started, dialogue: dlg\.state\.active, modal: modalOpen\(\), bridgeBusy \}\)/);
  assert.match(src, /if \(clockOn\) \{[\s\S]{0,400}day\.tick\(/, '기력 ticks only with the clock');
  assert.equal((src.match(/S\.hour \+= /g) ?? []).length, 0, 'no other code advances the running clock');
  // Learn/Review/practice (bridgeBusy), the Tong menu (dialogue) and any overlay or the phrasebook (modal).
  assert.match(src, /function modalOpen\(\) \{\s*return transitioning \|\| bridgeBusy \|\| !!document\.querySelector\('\.overlay:not\(\.hidden\)'\) \|\| !ui\.book\.classList\.contains\('hidden'\);/);
  assert.match(src, /bridgeBusy = true;[\s\S]{0,120}bridge\.practice\(/);
});
