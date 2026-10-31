// Host side of the cozy ↔ Tong bridge (apps/client/lib/cozy/bridge.ts).
// Node 22.18+ strips the TypeScript types; the module imports types only.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseCozyMessage, envelope, snapshotFromState, actionsForEvents, actionsForMigration,
  decomposeHangul, stageFor, buildBlockCrush, buildSentenceBuilder, recordedItemsFor, AFFINITY_PER_HEART,
} from '../apps/client/lib/cozy/bridge.ts';

const msg = (type, payload, extra = {}) => ({ protocol: 'tong-cozy-bridge', version: 1, type, payload, ...extra });
const milk = {
  exerciseType: 'block_crush', targetItems: ['우유'], objectiveId: 'ko-script-blocks-2part',
  framing: { speakerId: 'cashier', ko: '이름 좀 맞춰 줄래요?', en: 'Rebuild the name on the label.' },
  meaning: 'milk', cityId: 'seoul', locationId: 'convenience_store', characterId: 'cashier',
};

test('accepts well-formed cozy messages and rejects everything else', () => {
  assert.equal(parseCozyMessage(msg('cozy:hello', {})).ok, true);
  assert.equal(parseCozyMessage(msg('cozy:exercise', milk, { requestId: 'r1' })).ok, true);
  for (const bad of [
    null, 'hi', { ...msg('cozy:hello', {}), protocol: 'other' }, { ...msg('cozy:hello', {}), version: 2 },
    msg('cozy:hello', {}, { requestId: 'bad id!' }), msg('cozy:unknown', {}), msg('cozy:hello', null),
    msg('cozy:exercise', { ...milk, exerciseType: 'free_chat' }),
    msg('cozy:exercise', { ...milk, targetItems: [] }),
    msg('cozy:exercise', { ...milk, targetItems: Array(9).fill('가') }),
    msg('cozy:exercise', { ...milk, objectiveId: '../x' }),
    msg('cozy:exercise', { ...milk, framing: { en: '' } }),
    msg('cozy:exercise', { ...milk, cityId: 'busan' }),
    msg('cozy:exercise', { ...milk, locationId: 'Store Front' }),
    msg('cozy:progress', { events: [{ kind: 'xp', amount: 9999 }] }),
    msg('cozy:progress', { events: [{ kind: 'affinity', characterId: 'haeun', delta: Infinity }] }),
    msg('cozy:progress', { events: Array(51).fill({ kind: 'item_seen', itemId: '우유', category: 'vocabulary' }) }),
    msg('cozy:migrate', { saveId: 'x', hearts: [{ characterId: 'tong', hearts: 1 }], phrases: [] }),
    msg('cozy:migrate', { saveId: 'x', hearts: [{ characterId: 'haeun', hearts: 99 }], phrases: [] }),
  ]) assert.equal(parseCozyMessage(bad).ok, false, JSON.stringify(bad));
});

test('replies carry the protocol and echo the request id', () => {
  assert.deepEqual(envelope('host:error', { reason: 'x' }, 'r9'), { protocol: 'tong-cozy-bridge', version: 1, type: 'host:error', payload: { reason: 'x' }, requestId: 'r9' });
  assert.equal('requestId' in envelope('host:progress', { progress: {} }), false);
});

test('world events map to shared store actions, clamped and allow-listed', () => {
  const known = (k) => k === 'seoul:convenience_store';
  const actions = actionsForEvents([
    { kind: 'affinity', characterId: 'haeun', delta: 40 },
    { kind: 'affinity', characterId: 'jin', delta: 0.2 },
    { kind: 'item_seen', itemId: ' 우유 ', category: 'vocabulary' },
    { kind: 'location_hangout', cityId: 'seoul', locationId: 'convenience_store' },
    { kind: 'location_hangout', cityId: 'seoul', locationId: 'secret_lair' },
  ], known);
  assert.deepEqual(actions, [
    { type: 'UPDATE_AFFINITY', characterId: 'haeun', delta: 10 },
    { type: 'RECORD_ITEM_SEEN', itemId: '우유', category: 'vocabulary' },
    { type: 'INCREMENT_LOCATION_HANGOUT', cityId: 'seoul', locationId: 'convenience_store' },
  ]);
  // Never an interaction: /game plays its first-meeting hangout while interactionCount is 0.
  assert.equal(actions.some((a) => a.type === 'INCREMENT_INTERACTION'), false);
});

test('each story beat is awarded once, so replays cannot farm progress', () => {
  const known = () => true;
  const awarded = new Set();
  const beat = [
    { kind: 'affinity', characterId: 'haeun', delta: 5, beatId: 'aff:greet#1' },
    { kind: 'location_hangout', cityId: 'seoul', locationId: 'cafe', beatId: 'hangout:cafe:day1' },
  ];
  assert.equal(actionsForEvents(beat, known, awarded).length, 2);
  assert.equal(actionsForEvents(beat, known, awarded).length, 0);
  assert.deepEqual([...awarded], ['aff:greet#1', 'hangout:cafe:day1']);
  assert.equal(actionsForEvents([{ ...beat[1], beatId: 'hangout:cafe:day2' }], known, awarded).length, 1);
});

test('ids that collide with Object.prototype are refused', () => {
  for (const bad of [
    msg('cozy:progress', { events: [{ kind: 'affinity', characterId: 'constructor', delta: 5 }] }),
    msg('cozy:progress', { events: [{ kind: 'item_seen', itemId: '__proto__', category: 'vocabulary' }] }),
    msg('cozy:progress', { events: [{ kind: 'affinity', characterId: 'haeun', delta: 5, beatId: 'no spaces' }] }),
    msg('cozy:exercise', { ...milk, exerciseType: 'sentence_builder', targetItems: ['toString', '주세요'] }),
    msg('cozy:migrate', { saveId: 'x', hearts: [], phrases: [{ ko: 'hasOwnProperty' }] }),
  ]) assert.equal(parseCozyMessage(bad).ok, false, JSON.stringify(bad.payload));
});

test('legacy saves import hearts as affinity and phrases as met items, once per phrase', () => {
  const actions = actionsForMigration({ saveId: 'legacy-1', hearts: [{ characterId: 'haeun', hearts: 3 }, { characterId: 'jin', hearts: 0 }], phrases: [{ ko: '주세요' }, { ko: '주세요' }, { ko: '우유', en: 'milk' }] });
  assert.deepEqual(actions, [
    { type: 'UPDATE_AFFINITY', characterId: 'haeun', delta: 3 * AFFINITY_PER_HEART },
    { type: 'RECORD_ITEM_SEEN', itemId: '주세요', category: 'vocabulary' },
    { type: 'RECORD_ITEM_SEEN', itemId: '우유', category: 'vocabulary' },
  ]);
});

test('snapshots expose only progress fields', () => {
  const snap = snapshotFromState({
    xp: 12, sp: 3, calibratedLevel: null, selfAssessedLevel: 1, playerName: 'secret',
    relationships: { haeun: { characterId: 'haeun', affinity: 20, stage: 'acquaintances', interactionCount: 2, lastInteraction: 1, storyFlags: {}, significantMoments: [] } },
    itemMastery: { 우: { itemId: '우', category: 'script', correct: 1, incorrect: 0, lastSeen: 1, masteryLevel: 'learning', easeFactor: 2.5, interval: 1, nextReview: 1, repetitions: 1 } },
    locationHangoutCounts: { 'seoul:cafe': 2 },
  });
  assert.deepEqual(snap, {
    xp: 12, sp: 3, level: 1,
    relationships: { haeun: { affinity: 20, stage: 'acquaintances' } },
    locationHangoutCounts: { 'seoul:cafe': 2 },
    items: { 우: { masteryLevel: 'learning', correct: 1, incorrect: 0 } },
  });
});

test('Hangul decomposes into lead, vowel and final with romanisation', () => {
  assert.deepEqual(decomposeHangul('김'), { lead: 'ㄱ', vowel: 'ㅣ', tail: 'ㅁ', rom: 'gim' });
  assert.deepEqual(decomposeHangul('우'), { lead: 'ㅇ', vowel: 'ㅜ', tail: '', rom: 'u' });
  assert.deepEqual(decomposeHangul('면'), { lead: 'ㅁ', vowel: 'ㅕ', tail: 'ㄴ', rom: 'myeon' });
  assert.equal(decomposeHangul('A'), null);
  assert.equal(decomposeHangul('ㄱ'), null);
});

test('block-crush builds one block per syllable and picks its stage from mastery', () => {
  const ex = buildBlockCrush(milk, {});
  assert.equal(ex.type, 'block_crush');
  assert.equal(ex.fullWord, '우유');
  assert.deepEqual(ex.sequence.map((s) => s.targetChar), ['우', '유']);
  assert.deepEqual(ex.sequence[1].components.map((c) => `${c.slot}${c.piece}`), ['Cㅇ', 'Vㅠ']);
  assert.equal(ex.stage, 'intro');
  assert.equal(ex.prompt, milk.framing.en);
  const familiar = { masteryLevel: 'familiar' };
  assert.equal(stageFor(['우', '유'], { 우: familiar, 유: familiar }), 'recall');
  assert.equal(stageFor(['우', '유'], { 우: familiar, 유: { masteryLevel: 'learning' } }), 'recognition');
  assert.equal(buildBlockCrush({ ...milk, stage: 'recall' }, {}).stage, 'recall');
  assert.equal(buildBlockCrush({ ...milk, targetItems: ['milk'] }, {}), null);
  const single = buildBlockCrush({ ...milk, targetItems: ['진'] }, {});
  assert.equal(single.sequence, undefined);
  assert.deepEqual(single.components.map((c) => c.piece), ['ㅈ', 'ㅣ', 'ㄴ']);
});

test('sentence-builder shuffles tiles deterministically and never pre-solves', () => {
  const req = { ...milk, exerciseType: 'sentence_builder', targetItems: ['떡볶이', '주세요'], distractors: ['감사합니다', '주세요'], objectiveId: 'ko-gram-juseyo' };
  const a = buildSentenceBuilder(req);
  assert.deepEqual(a.correctOrder, ['떡볶이', '주세요']);
  assert.deepEqual([...a.wordTiles].sort(), ['감사합니다', '떡볶이', '주세요'].sort());
  assert.deepEqual(buildSentenceBuilder(req).wordTiles, a.wordTiles);
  assert.notDeepEqual(a.wordTiles.slice(0, 2), ['떡볶이', '주세요']);
  assert.deepEqual(recordedItemsFor(req, true), [
    { itemId: '떡볶이', category: 'vocabulary', correct: true },
    { itemId: '주세요', category: 'grammar', correct: true },
  ]);
});

test('block-crush results record each syllable and the whole word', () => {
  assert.deepEqual(recordedItemsFor({ ...milk, targetItems: ['바나나'] }, false), [
    { itemId: '바', category: 'script', correct: false },
    { itemId: '나', category: 'script', correct: false },
    { itemId: '바나나', category: 'vocabulary', correct: false },
  ]);
});

test('every contract fixture message from the cozy game parses', async () => {
  const { readFile } = await import('node:fs/promises');
  const fx = JSON.parse(await readFile(new URL('../packages/contracts/fixtures/cozy.bridge.messages.sample.json', import.meta.url), 'utf8'));
  for (const m of fx.cozyToHost) assert.equal(parseCozyMessage(m).ok, true, m.type);
  for (const m of fx.hostToCozy) assert.equal(m.protocol, 'tong-cozy-bridge');
  const ex = fx.cozyToHost.find((m) => m.requestId === 'c1-ex-1').payload;
  assert.equal(fx.hostToCozy.find((m) => m.requestId === 'c1-ex-1').payload.exerciseId, buildBlockCrush(ex, {}).id);
});
