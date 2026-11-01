// node --test lib/relationship/*.test.ts   (Node ≥ 22.18 strips types)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyEffects,
  fillName,
  initialState,
  leaks,
  matches,
  moodFor,
  moodTag,
  resolveBid,
  runScene,
} from './engine.ts';
import type { Bid } from './engine.ts';
import type { RelState, Scene, WorldCtx } from './types.ts';

const W: WorldCtx = { hour: 1, weather: 'clear', playerLevel: 1, inputTier: 1, seed: 42 };
const at = (p: Partial<Omit<RelState, 'axes'>> & { axes?: Partial<RelState['axes']> }): RelState => {
  const s = initialState('haeun');
  return { ...s, ...p, axes: { ...s.axes, ...p.axes } };
};

test('mood is deterministic per seed and day, and differs across days', () => {
  const inputs = { scheduled: [], lastHangout: 0, volatility: 0.7 };
  assert.deepEqual(moodFor('haeun', 5, 42, inputs), moodFor('haeun', 5, 42, inputs));
  const days = new Set(Array.from({ length: 20 }, (_, d) => JSON.stringify(moodFor('haeun', d + 1, 42, inputs))));
  assert.ok(days.size > 1, 'some variance across days');
});

test('a flagged eval makes her raw', () => {
  const m = moodFor('haeun', 3, 1, { scheduled: ['eval_flagged'], lastHangout: 0, volatility: 0 });
  assert.ok(['raw', 'low'].includes(moodTag(m)));
});

test('stage only advances at a milestone whose eligibility holds', () => {
  const s = at({ stage: 'acquaintances', axes: { warmth: 35 } });
  const blocked = applyEffects(s, { stageTo: 'friends' }, W);
  assert.equal(blocked.state.stage, 'acquaintances');
  assert.equal(blocked.stageBlocked, 'friends');
  const ok = applyEffects({ ...s, flags: { first_secret: true } }, { stageTo: 'friends' }, W);
  assert.equal(ok.state.stage, 'friends');
  // the rival door
  const rival = applyEffects(at({ stage: 'acquaintances', axes: { tension: 45 }, flags: { outscored_her: true } }), { stageTo: 'friends' }, W);
  assert.equal(rival.state.stage, 'friends');
  // no skipping
  assert.equal(applyEffects(s, { stageTo: 'close' }, W).state.stage, 'acquaintances');
});

test('warmth ahead of stage leaks', () => {
  assert.equal(leaks(at({ stage: 'acquaintances', axes: { warmth: 45 } })), true);
  assert.equal(leaks(at({ stage: 'friends', axes: { warmth: 45 } })), false);
  assert.equal(matches({ leak: true }, at({ stage: 'strangers', axes: { warmth: 30 } }), W), true);
});

test('conditions: hours wrap past midnight, any-of, memories', () => {
  const s = at({ memories: [{ tag: 'asked_straight', day: 1, note: '' }] });
  assert.equal(matches({ hours: { from: 23, to: 3 } }, s, { ...W, hour: 1 }), true);
  assert.equal(matches({ hours: { from: 23, to: 3 } }, s, { ...W, hour: 12 }), false);
  assert.equal(matches({ memories: ['asked_straight'] }, s, W), true);
  assert.equal(matches({ any: [{ flags: ['x'] }, { memories: ['asked_straight'] }] }, s, W), true);
});

const banana: Bid = {
  id: 'banana',
  label: { ko: '바나나우유', en: 'banana milk' },
  expresses: ['acts'],
  specificTo: ['saw_banana_milk'],
  base: { warmth: 4 },
  reaction: { ko: '…뭐야.', en: '…What is this.' },
  specificReaction: { ko: '…어떻게 알았어?', en: '…How did you know?' },
};

test('bids: specific beats generic, and repeats diminish to "또?"', () => {
  const needs = { feels: { acts: 1 } };
  const plain = resolveBid(banana, needs, at({}), W);
  const specific = resolveBid(banana, needs, at({ memories: [{ tag: 'saw_banana_milk', day: 1, note: '' }] }), W);
  assert.ok(plain.allowed && specific.allowed);
  if (!plain.allowed || !specific.allowed) return;
  assert.ok((specific.deltas.warmth ?? 0) > (plain.deltas.warmth ?? 0));
  let s = at({});
  const gains: number[] = [];
  let last = '';
  for (let i = 0; i < 4; i++) {
    const r = resolveBid(banana, needs, s, W);
    if (!r.allowed) break;
    gains.push(r.deltas.warmth ?? 0);
    last = r.reaction.ko;
    s = r.state;
  }
  assert.deepEqual(gains, [4, 2, 1, 0]);
  assert.equal(last, '또?');
});

test('runScene: same choice lands differently by mood; tier 0 is visible to outcomes', () => {
  const scene: Scene = {
    id: 't', kind: 'ambient', title: { ko: 't', en: 't' }, characterId: 'haeun', location: 'convenience_store',
    gate: {}, summary: '',
    beats: [{
      id: 'b', speaker: 'haeun', lines: [{ value: { ko: '…', en: '…' } }], end: true,
      choices: [{
        id: 'tease', intent: 'tease', say: { ko: '센터 위험하던데?', en: 'Shaky center today?' },
        outcomes: [
          { when: { flags: ['used_tong_last'] }, reaction: { ko: '또 그거 써?', en: 'Using that thing again?' } },
          { when: { mood: ['raw'] }, reaction: { ko: '…', en: '(she leaves)' }, deltas: { warmth: -3 } },
          { reaction: { ko: '너나 잘해.', en: 'Worry about yourself.' }, deltas: { tension: 2, warmth: 1 } },
        ],
      }],
    }],
  };
  const first = (cs: { id: string }[]) => cs[0] as never;
  const good = runScene(scene, at({}), W, first);
  const raw = runScene(scene, at({ mood: { energy: 0, valence: -2, causes: [] } }), W, first);
  const tong = runScene(scene, at({}), { ...W, inputTier: 0 }, first, 0);
  assert.equal(good.log[0].reaction?.ko, '너나 잘해.');
  assert.equal(raw.log[0].reaction?.en, '(she leaves)');
  assert.equal(tong.log[0].reaction?.ko, '또 그거 써?');
});

test('flags and tallies set in one relationship are readable from another', () => {
  const choi = { ...at({}), characterId: 'manager_choi' };
  const a = applyEffects(choi, { setFlags: ['covered_for_haeun'], tally: ['jin_decided'] }, W);
  const b = applyEffects(choi, { tally: ['jin_decided'] }, a.world);
  const haeun = at({});
  assert.equal(matches({ flags: ['covered_for_haeun'] }, haeun, a.world), true);
  assert.equal(matches({ flags: ['covered_for_haeun'] }, haeun, W), false);
  assert.equal(b.world.tally?.jin_decided, 2);
  assert.equal(matches({ tally: { jin_decided: { min: 2 } } }, haeun, b.world), true);
  assert.equal(matches({ tally: { jin_decided: { max: 1 } } }, haeun, b.world), false);
  assert.equal(W.flags, undefined, 'the input world is not mutated');
});

test('fillName picks the particle by the name\'s final consonant', () => {
  assert.equal(fillName('저는 {name}이에요.', '테오'), '저는 테오예요.');
  assert.equal(fillName('저는 {name}이에요.', '지민'), '저는 지민이에요.');
  assert.equal(fillName('{name}아, 가자.', '지민'), '지민아, 가자.');
  assert.equal(fillName('{name}아, 가자.', '테오'), '테오야, 가자.');
  assert.equal(fillName('{name} 씨, 안녕.', 'Theo'), 'Theo 씨, 안녕.');
  assert.equal(fillName('저는 {name}이에요.', 'Theo'), '저는 Theo(이)에요.');
});
