// Content lint: every scene and thread is well-formed, canon-safe, and every preset plays to an end.
// node --test lib/relationship/*.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { matches, playPreset, presetState } from './engine.ts';
import type { KakaoModule, Line, SceneModule } from './types.ts';

const root = fileURLToPath(new URL('../content/', import.meta.url));
const SKIP = new Set(['index.ts', 'bids.ts']);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return walk(p);
    return p.endsWith('.ts') && !p.endsWith('.test.ts') && !SKIP.has(f) ? [p] : [];
  });
}

const sceneFiles = walk(join(root, 'routes'));
const kakaoFiles = walk(join(root, 'kakao'));
const scenes: { file: string; mod: SceneModule }[] = [];
const threads: { file: string; mod: KakaoModule }[] = [];
for (const f of sceneFiles) scenes.push({ file: relative(root, f), mod: (await import(pathToFileURL(f).href)).module });
for (const f of kakaoFiles) threads.push({ file: relative(root, f), mod: (await import(pathToFileURL(f).href)).module });

function checkLine(l: Line | undefined, where: string) {
  assert.ok(l, `${where}: missing line`);
  assert.ok(l.ko?.trim(), `${where}: empty ko`);
  assert.ok(l.en?.trim(), `${where}: empty en`);
}

// Speakers the cozy dialogue box can show (public/cozy/js/dialogue.js SPEAKERS).
const SPEAKERS = new Set(['narration', 'tong', 'haeun', 'jin', 'ajusshi', 'barista', 'cashier', 'manager_choi', 'coach_park', 'minji', 'yerin']);

const RETIRED = [/Busan|부산|라카노/, /내 이름 읽을 수 있어/, /masked busk|busks? masked/i];

test('content was found', () => {
  assert.ok(scenes.length > 0, 'no scenes');
  assert.ok(threads.length > 0, 'no kakao threads');
});

test('scene and thread ids are unique', () => {
  const ids = [...scenes.map((s) => s.mod.scene.id), ...threads.map((t) => t.mod.thread.id)];
  assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids.filter((x, i) => ids.indexOf(x) !== i)}`);
});

for (const { file, mod } of scenes) {
  const { scene, presets } = mod;
  test(`${file}: structure`, () => {
    const ids = new Set(scene.beats.map((b) => b.id));
    assert.equal(ids.size, scene.beats.length, 'duplicate beat ids');
    assert.ok(scene.beats.some((b) => b.end), 'no end beat');
    for (const b of scene.beats) {
      if (b.next) assert.ok(ids.has(b.next), `${b.id}.next → ${b.next} missing`);
      assert.ok(b.lines.length > 0, `${b.id}: no lines`);
      assert.ok(SPEAKERS.has(b.speaker), `${b.id}: unknown speaker ${b.speaker}`);
      assert.ok(!b.lines[b.lines.length - 1].when, `${b.id}: last line variant must be unconditional`);
      b.lines.forEach((v, i) => checkLine(v.value, `${b.id}.lines[${i}]`));
      for (const c of b.choices ?? []) {
        checkLine(c.say, `${b.id}/${c.id}.say`);
        assert.ok(c.outcomes.length > 0, `${b.id}/${c.id}: no outcomes`);
        assert.ok(!c.outcomes[c.outcomes.length - 1].when, `${b.id}/${c.id}: last outcome must be unconditional`);
        for (const o of c.outcomes) {
          checkLine(o.reaction, `${b.id}/${c.id} reaction`);
          if (o.speaker) assert.ok(SPEAKERS.has(o.speaker), `${b.id}/${c.id}: unknown speaker ${o.speaker}`);
          if (o.next) assert.ok(ids.has(o.next), `${b.id}/${c.id} → ${o.next} missing`);
        }
      }
    }
  });

  test(`${file}: canon`, () => {
    const text = JSON.stringify(scene);
    for (const re of RETIRED) assert.ok(!re.test(text), `retired canon ${re}`);
    if (scene.characterId === 'haeun') assert.notEqual(scene.location, 'food_street', 'Haeun is never at the pojangmacha early');
  });

  test(`${file}: presets play to an end`, () => {
    assert.ok(presets.length >= (scene.kind === 'ambient' ? 3 : 1), 'not enough presets');
    for (const p of presets) {
      const { state, world } = presetState(scene.characterId, p);
      assert.ok(matches(scene.gate, state, world), `preset ${p.id} fails the scene gate`);
      const run = playPreset(scene, p);
      assert.ok(!run.gated && run.log.length > 0, `preset ${p.id}: empty run`);
      const last = scene.beats.find((b) => b.id === run.log[run.log.length - 1].beatId);
      assert.ok(last?.end, `preset ${p.id}: stopped at ${last?.id} without reaching an end`);
      for (const c of p.path ?? []) assert.ok(run.log.some((st) => st.choice === c), `preset ${p.id}: path choice ${c} never offered`);
    }
  });

  if (scene.kind === 'ambient') {
    test(`${file}: the three variants actually differ`, () => {
      const sigs = presets.map((p) =>
        playPreset(scene, p).log.map((st) => `${st.line?.ko}|${st.reaction?.ko ?? ''}`).join('/'),
      );
      assert.equal(new Set(sigs).size, sigs.length, 'two presets produce the same transcript');
    });
  }
}

// Canon (jin.ts mustNot): tag what Jin asks for. Going along with a directive is counted;
// generosity never is. Saying no to a directive always builds trust (it may cost warmth now).
const ACCEPT = new Set(['defer', 'apologize']);
const jinOutcomes = [
  ...scenes.filter((s) => s.mod.scene.characterId === 'jin').flatMap((s) => s.mod.scene.beats.flatMap((b) => (b.choices ?? []).map((c) => ({ id: `${s.file}/${c.id}`, intent: c.intent, ask: c.ask, outcomes: c.outcomes })))),
  ...threads.filter((t) => t.mod.thread.characterId === 'jin').flatMap((t) => (t.mod.thread.replies ?? []).map((r) => ({ id: `${t.file}/${r.id}`, intent: r.intent, ask: r.ask, outcomes: r.outcomes }))),
];
test('Jin: directives you accept are counted, generosity never is, and a no builds trust', () => {
  for (const c of jinOutcomes) {
    if (c.intent === 'defer') assert.ok(c.ask, `${c.id}: going along with Jin must say what he asked for (ask: generosity | directive)`);
    for (const o of c.outcomes) {
      const counted = !!o.tally?.includes('jin_directives');
      if (c.ask === 'directive' && ACCEPT.has(c.intent)) assert.ok(counted, `${c.id}: accepting a directive is not counted`);
      if (c.ask !== 'directive' || !ACCEPT.has(c.intent)) assert.ok(!counted, `${c.id}: only accepted directives are counted`);
      if (c.ask === 'directive' && c.intent === 'decline') assert.ok((o.deltas?.trust ?? 0) > 0, `${c.id}: a no to a directive must build trust`);
    }
  }
});

for (const { file, mod } of threads) {
  const { thread, presets } = mod;
  test(`${file}: thread`, () => {
    assert.ok(/^\d\d:\d\d$/.test(thread.at), 'at must be HH:MM');
    assert.ok(thread.messages.length > 0 || (thread.replies?.length ?? 0) > 0, 'empty thread needs replies (you text first)');
    thread.messages.forEach((m, i) => checkLine(m, `msg ${i}`));
    for (const r of thread.replies ?? []) {
      checkLine(r.say, `${r.id}.say`);
      assert.ok(r.outcomes.length > 0 && !r.outcomes[r.outcomes.length - 1].when, `${r.id}: last outcome must be unconditional`);
      for (const o of r.outcomes) o.messages.forEach((m, i) => checkLine(m, `${r.id} msg ${i}`));
    }
    assert.ok(presets.length >= 1);
    for (const p of presets) {
      const { state, world } = presetState(thread.characterId, p);
      assert.ok(matches(thread.gate, state, world), `preset ${p.id} fails the thread gate`);
    }
    const text = JSON.stringify(thread);
    for (const re of RETIRED) assert.ok(!re.test(text), `retired canon ${re}`);
  });
}

test('the lab and the cozy bundle are rebuilt from this content', () => {
  const script = fileURLToPath(new URL('../../scripts/build-relationship-lab.mjs', import.meta.url));
  const r = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('canon files load', async () => {
  for (const f of ['haeun', 'sua', 'jin', 'world']) {
    const src = readFileSync(join(root, 'canon', `${f}.ts`), 'utf8');
    assert.ok(src.length > 100);
  }
});
