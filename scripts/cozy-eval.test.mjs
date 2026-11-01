// Seoul eval 1: scoring, chapter gating, content tags and determinism (apps/client/public/cozy/js/eval).
// node --test scripts/cozy-eval.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hashSeed, rng, judgeTiming, scoreItem, tierMultiplier, suggestTier, scoreRound, bandOf, gradeEval,
  weakObjectives, updateMastery, rankBoard, SKILLS,
} from '../apps/client/public/cozy/js/eval/runner.js';
import {
  newChapter, normalizeChapter, isUnlocked, canStart, confirmEval, evalDayDue, beginEvalDay, recordRound,
  restartRound, finishEval, recordRehearsal, missingBeats,
} from '../apps/client/public/cozy/js/eval/chapter.js';
import { GRID, START, makeCalls, applyInput, matches, legalCalls } from '../apps/client/public/cozy/js/eval/dance.js';
import {
  EVAL1, SONG1, itemsFor, check, lunchOutcome, LUNCH, ROSTER, defaultProfile, segmentText,
  birthYear,
} from '../apps/client/public/cozy/js/eval/eval1.js';

const BEATS = { h0_done: true, h1_done: true, h2_done: true };

/* ── Scoring ─────────────────────────────────────── */

test('seeded rng is deterministic and seed-sensitive', () => {
  const a = rng(hashSeed(42, 'x'));
  const b = rng(hashSeed(42, 'x'));
  const c = rng(hashSeed(43, 'x'));
  const sa = [a(), a(), a()];
  assert.deepEqual(sa, [b(), b(), b()]);
  assert.notDeepEqual(sa, [c(), c(), c()]);
  assert.ok(sa.every((x) => x >= 0 && x < 1));
});

test('timing windows: Perfect, Good (incl. early), Miss', () => {
  assert.equal(judgeTiming(0), 'perfect');
  assert.equal(judgeTiming(-150), 'perfect');
  assert.equal(judgeTiming(151), 'good');
  assert.equal(judgeTiming(400), 'good');
  assert.equal(judgeTiming(-2000), 'good');
  assert.equal(judgeTiming(401), 'miss');
  assert.equal(judgeTiming(null), 'miss');
  assert.equal(judgeTiming(100, { windowScale: 0.5 }), 'good', 'a tighter (tired) window turns 100ms into Good');
});

test('item score: accuracy × timing, Tong hint caps at half', () => {
  assert.equal(scoreItem({ correct: true }), 1);
  assert.equal(scoreItem({ correct: false }), 0);
  assert.equal(scoreItem({ correct: true, timing: 'perfect' }), 1);
  assert.equal(scoreItem({ correct: true, timing: 'good' }), 0.8);
  assert.equal(scoreItem({ correct: true, timing: 'miss' }), 0);
  assert.equal(scoreItem({ correct: true, hint: true }), 0.5);
  assert.equal(scoreItem({ correct: true, timing: 'good', hint: true }), 0.5);
  assert.equal(scoreItem({ accuracy: 0.3, hint: true }), 0.3, 'the cap never raises a score');
});

test('tier multipliers: opt up ×1.25, down ×0.8, capped at 100', () => {
  assert.equal(tierMultiplier(2, 1), 1.25);
  assert.equal(tierMultiplier(1, 2), 0.8);
  assert.equal(tierMultiplier(2, 2), 1);
  const items = [{ correct: true }, { correct: true }, { correct: false }, { correct: true }];
  assert.equal(scoreRound(items, { tier: 1, suggested: 1 }).score, 75);
  assert.equal(scoreRound(items, { tier: 2, suggested: 1 }).score, 93.8);
  assert.equal(scoreRound(items, { tier: 1, suggested: 2 }).score, 60);
  assert.equal(scoreRound(items.map(() => ({ correct: true })), { tier: 2, suggested: 1 }).score, 100);
  assert.equal(scoreRound([], {}).score, 0);
});

test('suggested tier comes from mastery', () => {
  assert.equal(suggestTier({}, 'listening'), 1);
  assert.equal(suggestTier({ listening: 1 }, 'listening'), 2);
  assert.equal(suggestTier({ listening: 2.5 }, 'listening'), 2, 'capped at maxTier');
  assert.equal(suggestTier({ writing: 2 }, 'writing', 3), 3);
});

test('bands and the 4 × 25% grade', () => {
  for (const [s, b] of [[100, 'S'], [95, 'S'], [94.9, 'A'], [85, 'A'], [70, 'B'], [55, 'C'], [40, 'D'], [39.9, 'F'], [0, 'F']]) assert.equal(bandOf(s), b, String(s));
  assert.deepEqual(gradeEval({ vocal: 100, dance: 80, judges: 60, field: 40 }), { grade: 70, band: 'B', probation: false });
  assert.deepEqual(gradeEval({ vocal: 50, dance: 50, judges: 50, field: 50 }), { grade: 50, band: 'D', probation: true });
  assert.equal(gradeEval({ vocal: 100 }).grade, 25, 'a missing round counts 0');
});

test('weak objectives are those under 60% accuracy', () => {
  const items = [
    { objective: 'a', correct: true }, { objective: 'a', correct: false },
    { objective: 'b', correct: true }, { objective: 'c', correct: false }, { objective: 'c', correct: true, hint: true },
  ];
  assert.deepEqual(weakObjectives(items), ['c', 'a']);
});

test('mastery rises only on success at the suggested tier or above', () => {
  const good = (skill) => Array.from({ length: 4 }, () => ({ skill, objective: 'o', correct: true }));
  const m0 = Object.fromEntries(SKILLS.map((s) => [s, 0]));
  assert.equal(updateMastery(m0, [{ tier: 1, suggested: 1, items: good('listening') }]).listening, 0.5);
  assert.equal(updateMastery(m0, [{ tier: 1, suggested: 2, items: good('listening') }]).listening, 0, 'opting down earns no mastery');
  assert.equal(updateMastery(m0, [{ tier: 1, suggested: 1, items: [{ skill: 'speaking', correct: false }] }]).speaking, 0);
  assert.equal(updateMastery(m0, [{ tier: 2, suggested: 1, items: good('writing') }], { gain: 0.25 }).writing, 0.25);
});

test('ranking board: seeded NPC curves, the player placed, placeholders marked', () => {
  const a = rankBoard({ seed: 7, month: 1, player: { name: '나', grade: 80 }, roster: ROSTER });
  const b = rankBoard({ seed: 7, month: 1, player: { name: '나', grade: 80 }, roster: ROSTER });
  assert.deepEqual(a, b);
  assert.equal(a.length, 6);
  assert.deepEqual(a.map((r) => r.rank), [1, 2, 3, 4, 5, 6]);
  assert.ok(a.some((r) => r.id === 'player' && r.grade === 80));
  assert.ok(a.every((r, i) => i === 0 || a[i - 1].grade >= r.grade));
  assert.deepEqual(ROSTER.filter((r) => r.placeholder).map((r) => r.placeholder), ['TODO-roster', 'TODO-roster']);
  assert.ok(['haeun', 'minji', 'yerin'].every((id) => ROSTER.some((r) => r.id === id)));
  assert.notDeepEqual(a.map((r) => r.grade), rankBoard({ seed: 8, month: 1, player: { name: '나', grade: 80 }, roster: ROSTER }).map((r) => r.grade));
});

/* ── Chapter gating ──────────────────────────────── */

test('eval 1 is locked until H0, H1 and H2 are done', () => {
  const c = newChapter();
  assert.equal(c.month, 1);
  assert.equal(isUnlocked(c, {}), false);
  assert.deepEqual(missingBeats(c, { h0_done: true }), ['h1_done', 'h2_done']);
  assert.equal(isUnlocked(c, { h0_done: true, h1_done: true }), false);
  assert.equal(isUnlocked(c, BEATS), true);
  assert.equal(confirmEval(c, {}, 3).status, 'open', 'confirm does nothing while locked');
});

test('debug force-unlock opens the eval without the beats', () => {
  const c = { ...newChapter(), forced: true };
  assert.equal(isUnlocked(c, {}), true);
  assert.equal(canStart(c, {}), true);
});

test('confirm is the point of no return: tomorrow is eval day', () => {
  const c = confirmEval(newChapter(), BEATS, 5);
  assert.equal(c.status, 'eve');
  assert.equal(c.evalDay, 6);
  assert.equal(canStart(c, BEATS), false, 'cannot start again');
  assert.equal(confirmEval(c, BEATS, 9).evalDay, 6, 'a second confirm changes nothing');
  assert.equal(evalDayDue(c, 5, 23.9), false, 'the eve');
  assert.equal(evalDayDue(c, 6, 3), false, 'before morning');
  assert.equal(evalDayDue(c, 6, 8), true);
  assert.equal(evalDayDue(c, 7, 1), true, 'a later day always runs it');
});

test('eval day: per-round progress, restart with fresh attempt, results advance the month', () => {
  let c = beginEvalDay(confirmEval(newChapter(), BEATS, 1), 1234);
  assert.equal(c.status, 'eval');
  c = restartRound(c);
  assert.equal(c.run.attempt, 1);
  c = recordRound(c, 'vocal', { score: 80, items: [] });
  assert.equal(c.run.round, 1);
  assert.equal(c.run.attempt, 0);
  const reloaded = normalizeChapter(JSON.parse(JSON.stringify(c)));
  assert.deepEqual(reloaded.run, c.run, 'the save keeps finished rounds');
  const done = finishEval(c, { result: { grade: 62, band: 'C' }, weak: ['ko-gram-counters'], mastery: { listening: 0.5 } });
  assert.equal(done.month, 2);
  assert.equal(done.status, 'open');
  assert.equal(done.run, null);
  assert.deepEqual(done.results[1], { grade: 62, band: 'C' });
  assert.deepEqual(done.weak, ['ko-gram-counters']);
  assert.equal(isUnlocked(done, BEATS), false, 'eval 2 is not built yet');
});

test('rehearsal never touches grade, results or rank', () => {
  const c = { ...newChapter(), results: { 1: { grade: 70 } } };
  const r = recordRehearsal(c, { ...c.mastery, listening: 0.25 });
  assert.deepEqual(r.results, c.results);
  assert.equal(r.status, c.status);
  assert.equal(r.rehearsals, 1);
  assert.equal(r.mastery.listening, 0.25);
});

test('normalizeChapter survives garbage and old saves', () => {
  assert.deepEqual(normalizeChapter(undefined), newChapter());
  assert.deepEqual(normalizeChapter({ month: 99, status: 'boss', mastery: { listening: 'x' } }), newChapter());
  assert.equal(normalizeChapter({ status: 'eve' }).status, 'open', 'eve without a day falls back to open');
});

/* ── Content ─────────────────────────────────────── */

const profile = defaultProfile('연습생');
const allItems = (seed) => EVAL1.rounds.flatMap((r) => [1, 2, ...(r.maxTier >= 3 ? [3] : [])].flatMap((t) => itemsFor(r.id, seed, t, profile)));

test('every item is tagged with a skill and an objective', () => {
  for (const it of allItems(99)) {
    assert.ok(SKILLS.includes(it.skill), `${it.id} skill`);
    assert.match(it.objective, /^ko-[a-z]+-[a-z0-9-]+$/, `${it.id} objective`);
    if (it.type === 'choice') assert.ok(it.answer.every((a) => it.options.some((o) => o.id === a)), `${it.id} answer among options`);
    if (it.type === 'blocks') assert.ok(it.answer[0].every((w) => it.blocks.some((b) => b.text === w)), `${it.id} blocks cover the answer`);
  }
});

test('vocal: the two chorus test lines and the four comprehension items', () => {
  const t1 = itemsFor('vocal', 1, 1);
  assert.equal(t1.length, 6);
  assert.deepEqual(t1.slice(0, 2).map((i) => i.audio.text), [SONG1.lines.c1.ko, SONG1.lines.c2.ko]);
  assert.ok(t1[0].prompt.showText, 'tier 1 shows Hangul');
  const t2 = itemsFor('vocal', 1, 2);
  assert.equal(t2[0].type, 'blocks');
  assert.equal(t2[0].prompt.showText, false, 'tier 2 is heard, not shown');
  assert.ok(check(t2[0], ['오늘은', '날씨가', '좋아요']));
  assert.ok(!check(t2[0], ['오늘은', '날씨는', '좋아요']));
  const t3 = itemsFor('vocal', 1, 3);
  assert.ok(check(t3[1], '친구하고 공원에 가요.'));
  assert.ok(!check(t3[1], '친구하고 공원에서 가요'));
});

test('dance calls stay on the grid and always need a change', () => {
  for (const seed of [1, 2, 3, 'abc']) {
    const calls = makeCalls(seed, 12);
    assert.deepEqual(calls[0].from, START);
    for (const [i, c] of calls.entries()) {
      assert.ok(c.target.x >= 0 && c.target.x < GRID.cols && c.target.y >= 0 && c.target.y < GRID.rows, c.ko);
      assert.ok(!matches(c.from, c.target), `${c.ko} changes something`);
      if (i) assert.deepEqual(c.from, calls[i - 1].target);
    }
  }
  assert.ok(legalCalls({ x: 0, y: 0, pose: 'sit' }).every((c) => c.target.pose === 'stand'), 'sitting: only 일어나');
  assert.ok(legalCalls(START).some((c) => c.ko === '오른손 들고, 왼쪽으로 두 칸!'), 'the design\'s example call exists');
  assert.ok(legalCalls({ x: 2, y: 2, pose: 'stand' }).some((c) => c.ko === '앞으로 한 칸!'));
  assert.ok(legalCalls({ x: 2, y: 0, pose: 'stand' }).some((c) => c.ko === '뒤로 한 칸!'));
  const s = applyInput(applyInput(START, { cell: [0, 1] }), { pose: 'right_hand' });
  assert.deepEqual(s, { x: 0, y: 1, pose: 'right_hand' });
  assert.deepEqual(applyInput({ ...START, pose: 'sit' }, { cell: [0, 0] }), { ...START, pose: 'sit' }, 'no moving while seated');
});

test('judges: the form uses the player\'s profile, and the three interview questions', () => {
  const p = { ...profile, name: '에니', nationality: '싱가포르', family: 5, hobby: '요리' };
  const t1 = itemsFor('judges', 3, 1, p);
  assert.deepEqual(t1.slice(0, 5).map((i) => i.formLabel), ['이름', '국적', '생년월일', '취미', '특기']);
  assert.ok(check(t1[1], '싱가포르'));
  assert.deepEqual(t1.slice(5).map((i) => i.prompt.ko), ['가족이 몇 명이에요?', '주말에 보통 뭐 해요?', '한국 날씨는 어때요?']);
  assert.ok(check(t1[5], '가족이 다섯 명이에요.'));
  assert.ok(!check(t1[5], '가족이 오 명이에요.'), 'Sino number for people is wrong');
  assert.ok(check(t1[6], '주말에 보통 요리해요.'));
  const t2 = itemsFor('judges', 3, 2, p);
  assert.ok(check(t2[2], [`${birthYear()}년`, '5월', '3일']), 'birth year follows the fixed age');
  assert.ok(check(t2[5], ['가족이', '다섯', '명이에요']));
  assert.ok(t2.slice(5).every((i) => i.speech?.slots), 'speech hook carries the slots');
});

test('field quest: the order, the price, and who reacts to the wrong food', () => {
  assert.equal(LUNCH.segments.map(segmentText).join(', '), '김밥 두 줄, 떡볶이 일 인분, 라면 두 개');
  const t1 = itemsFor('field', 5, 1);
  const pay = t1.find((i) => i.type === 'wallet');
  assert.ok(check(pay, 20000));
  assert.ok(check(pay, 50000), 'overpaying is fine: change comes back');
  assert.ok(!check(pay, 15000), 'short is wrong');
  assert.ok(check(t1[0], '김밥 두 줄'));
  const wrong = lunchOutcome({
    'field-gimbap': { correct: false, answer: '김밥 두 개' },
    'field-tteokbokki': { correct: true, answer: '떡볶이 일 인분' },
    'field-ramyeon': { correct: false, answer: ['라면', '이', '개'] },
  });
  assert.deepEqual(wrong.map((o) => [o.segment, o.fault, o.who]), [['gimbap', 'counter', '민지'], ['ramyeon', 'amount', '연습생 A']]);
  assert.ok(wrong.every((o) => o.ko && o.en && o.arrives));
  assert.deepEqual(lunchOutcome({}), []);
});

/* ── Determinism: a whole eval from one seed ─────── */

function simulate(seed, skill) {
  // skill 'strong' answers everything right on the beat at tier 2; 'beginner' misses every third item at tier 1 and hints once per round.
  const tier = skill === 'strong' ? 2 : 1;
  const scores = {};
  const all = [];
  for (const r of EVAL1.rounds) {
    const items = itemsFor(r.id, hashSeed(seed, r.id, 1), tier, profile);
    const rand = rng(hashSeed(seed, 'player', r.id));
    const recs = items.map((it, i) => {
      const right = skill === 'strong' || i % 3 !== 2;
      return { itemId: it.id, skill: it.skill, objective: it.objective, correct: right, hint: skill !== 'strong' && i === 0,
        ...(it.type === 'dance' ? { timing: rand() < 0.5 ? 'perfect' : 'good' } : {}) };
    });
    const s = scoreRound(recs, { tier, suggested: 1 });
    scores[r.id] = s.score;
    all.push(...s.items);
  }
  const g = gradeEval(scores);
  return { scores, ...g, weak: weakObjectives(all), board: rankBoard({ seed, month: 1, player: { name: '나', grade: g.grade }, roster: ROSTER }) };
}

test('same seed, same choices → same eval outcome', () => {
  assert.deepEqual(simulate(2026, 'beginner'), simulate(2026, 'beginner'));
  assert.deepEqual(simulate(2026, 'strong'), simulate(2026, 'strong'));
  assert.deepEqual(itemsFor('dance', 5, 1), itemsFor('dance', 5, 1));
  assert.notDeepEqual(itemsFor('dance', hashSeed(5, 'dance', 1), 1).map((i) => i.ko), itemsFor('dance', hashSeed(5, 'dance', 2), 1).map((i) => i.ko), 'a restarted round gets fresh items');
  const strong = simulate(2026, 'strong');
  assert.ok(['S', 'A'].includes(strong.band), `strong band ${strong.band} (${strong.grade})`);
  const beginner = simulate(2026, 'beginner');
  assert.ok(beginner.grade < strong.grade);
  assert.ok(beginner.weak.length > 0);
});
