// Browser proof of Day 2 (docs/seoul-day2.md). Each run starts from the creator with an origin,
// skips Day 1 (__cozy.skipDayOne, the state an old save migrates to), sleeps in the bunk, then:
//   laptop (Athlete):  05:30 dawn run on the formation grid → studio at 10 → H1 → Coach Park's drill
//   phone  (Creator):  day 2 night: the edit (caption, archive) before sleep
//   intl   (International-School Kid): day 2 morning, Mum sets the Sunday call
// The drill answers from data-answer (the `tong-eval-debug` flag), mostly right, on the beat.
// Tong host exercises are closed, as a player skipping them would. Start the dev server first
// (cd apps/client && npx next dev -p 3021). Screenshots go to COZY_EVIDENCE_DIR.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const moduleName = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(path.isAbsolute(moduleName) ? pathToFileURL(moduleName).href : moduleName);
const OUT = process.env.COZY_EVIDENCE_DIR || 'artifacts/cozy-day2';
const URL = process.env.COZY_HOST_URL || 'http://127.0.0.1:3021/cozy';
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const log = (...a) => console.log(...a);

const RUNS = {
  laptop: { viewport: { width: 1280, height: 800 }, origin: 'athlete', plan: { 'seoul.loop.dawn:dw_tong': /뛰러/ } },
  phone: { viewport: { width: 390, height: 844 }, touch: true, origin: 'creator', plan: { 'seoul.loop.edit:ed_tong': /자르자/, 'seoul.loop.edit:ed_where': /나만/ } },
  intl: { viewport: { width: 1280, height: 800 }, origin: 'intl_kid', plan: {} },
};

async function run(tag) {
  const cfg = RUNS[tag];
  const page = await browser.newPage({ viewport: cfg.viewport, hasTouch: !!cfg.touch, isMobile: !!cfg.touch });
  page.setDefaultTimeout(90000);
  await page.addInitScript(() => { try { localStorage.setItem('tong-eval-debug', '1'); } catch {} });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 300000 });
  const f = await (await page.waitForSelector('iframe.cozy-frame', { timeout: 300000 })).contentFrame();
  await f.waitForFunction(() => window.__cozy && !document.querySelector('#start').disabled, null, { timeout: 300000 });
  await f.evaluate(() => { __cozy.renderer.setPixelRatio(0.5); window.__fr = 0; const k = () => { window.__fr++; requestAnimationFrame(k); }; k(); });
  const frames = async (n) => {
    const start = await f.evaluate(() => window.__fr);
    await f.waitForFunction((t) => window.__fr >= t, start + n, { timeout: 600000, polling: 500 });
  };
  const shot = (name) => page.screenshot({ path: `${OUT}/${tag}-${name}.png`, timeout: 600000 });
  const flags = () => f.evaluate(() => __cozy.S.story.flags);
  const busy = () => f.evaluate(() => __cozy.dlg.state.active || __cozy.bridgeBusy);
  const drillOpen = () => f.evaluate(() => !document.querySelector('#seoul-eval')?.classList.contains('hidden') && document.querySelector('#seoul-eval .eval-card')?.dataset.screen === 'dance');
  const seen = [];
  // Click through dialogue: the plan picks some replies, else the first. Drills are danced; Tong host exercises closed.
  const talkThrough = async (shots = {}) => {
    for (let i = 0; i < 200; i++) {
      if (await drillOpen()) { const n = seen.filter((s) => s === 'drill').length; seen.push('drill'); await playDance(f, (i) => i === 5 && shot(`drill-${n}`)); continue; } // a shot takes seconds here: only after the last call
      if (!(await busy())) {
        await frames(4);
        if (!(await busy()) && !(await drillOpen())) return;
        continue;
      }
      if (await page.evaluate(() => !!document.querySelector('.exercise-dismiss-btn, .cozy-practice__close'))) {
        await page.evaluate(() => document.querySelector('.exercise-dismiss-btn, .cozy-practice__close').click());
        log(tag, 'closed an exercise');
      } else {
        const st = await f.evaluate(() => ({ id: __cozy.dlg.state.id, choices: (__cozy.dlg.state.choices ?? []).map((c) => `${c.ko ?? ''} ${c.en ?? ''}`) }));
        if (st.id && !seen.includes(st.id)) { seen.push(st.id); if (shots[st.id]) { await frames(3); await shot(shots[st.id]); } }
        const want = cfg.plan[st.id];
        const pick = want ? Math.max(0, st.choices.findIndex((c) => want.test(c))) : 0;
        await f.evaluate((pick) => { if (!__cozy.dlg.state.active) return; __cozy.dlg.finishTyping(); if (__cozy.dlg.state.choices.length) __cozy.dlg.choose(pick); else __cozy.dlg.advance(); }, pick);
      }
      await frames(3);
    }
  };
  const toBunk = async (hour) => {
    const bed = await f.evaluate(() => {
      const room = __cozy.apartmentDiagnostics.find((b) => b.id === 'seoul-home').rooms.find((r) => r.level === 1);
      const m = room.furniture.find((x) => x.kind === 'your-bunk');
      return { x: m.position[0] - 1.25, y: room.floorY, z: m.position[2] };
    });
    await f.evaluate(({ x, y, z, hour }) => {
      __cozy.player.root.position.set(x, y, z);
      __cozy.traversal.vx = __cozy.traversal.vz = 0;
      __cozy.setHour(hour);
      __cozy.S.speed = 0;
      __cozy.cam.snap = true;
    }, { ...bed, hour });
    await frames(6);
    await f.waitForFunction(() => /침대/.test(document.querySelector('#prompt').textContent), null, { timeout: 60000, polling: 500 }).catch(async (e) => {
      log(tag, 'no bed prompt', await f.evaluate(() => ({ prompt: document.querySelector('#prompt').textContent, dlg: __cozy.dlg.state.id, overlays: [...document.querySelectorAll('.overlay:not(.hidden)')].map((o) => o.id || o.className), p: __cozy.player.root.position.toArray(), zone: __cozy.levelDiagnostics.zone?.id })));
      await shot('no-bed-prompt');
      throw e;
    });
  };
  const sleep = async () => {
    await f.waitForSelector('#bed-overlay:not(.hidden)', { state: 'attached', timeout: 120000 });
    await f.evaluate(() => document.querySelector('#bed-overlay .btn-primary').click());
    await f.waitForSelector('#morning-board:not(.hidden)', { state: 'attached', timeout: 60000 });
    await frames(3);
    await f.evaluate(() => document.querySelector('#morning-board .btn-primary').click());
    await frames(8);
  };

  // 0. Creator with the origin, then the state an old save loads as, through the first night.
  await f.evaluate(() => document.querySelector('#start').click());
  await f.evaluate((o) => { document.querySelector('#origin').value = o; }, cfg.origin);
  await f.evaluate(() => document.querySelector('#creator-start').click());
  await f.waitForFunction(() => __cozy.dlg.state.active, null, { timeout: 120000, polling: 500 });
  await f.evaluate(() => __cozy.skipDayOne());
  await f.evaluate(() => {
    __cozy.S.story.flags = { ...__cozy.S.story.flags, h0_done: true, dorm_arrived: true, 'played:seoul.d1.bedtime': true };
    __cozy.S.speed = 0;
  });
  assert.equal(await f.evaluate(() => __cozy.S.origin), cfg.origin);
  // The registration card follows H0; hand it in so the world is free.
  await f.waitForSelector('#seoul-eval [data-action="profile-save"]', { timeout: 120000 }).catch(() => {});
  await f.evaluate(() => document.querySelector('#seoul-eval [data-action="profile-save"]')?.click());
  await frames(4);
  await toBunk(22.5);
  await f.evaluate(() => __cozy.interact());
  await sleep();
  assert.equal(await f.evaluate(() => __cozy.S.day), 2);

  if (tag === 'laptop') {
    // 1. Monday 05:30: the dawn run.
    await f.waitForFunction(() => __cozy.dlg.state.active, null, { timeout: 60000, polling: 500 });
    assert.ok((await f.evaluate(() => __cozy.dlg.state.id)).startsWith('seoul.loop.dawn'));
    assert.ok(Math.abs((await f.evaluate(() => __cozy.S.hour)) - 5.5) < 0.1, 'dawn at 05:30');
    await shot('1-dawn');
    await talkThrough();
    const t = await f.evaluate(() => ({ tally: __cozy.S.story.tally, hour: __cozy.S.hour, energy: __cozy.day.energy }));
    log(tag, 'after dawn', t);
    assert.equal(t.tally.dawn, 1);
    assert.ok(t.hour >= 7 && t.hour < 7.2, 'back at seven');
    // 2. Studio at 10: H1 with the trainee by the water bottles, then Coach Park's drill.
    // Skip Tong's sign-reading offers (they'd block the trip), then go and wait for it to land.
    await f.evaluate(() => { if (__cozy.dlg.state.active) __cozy.dlg.end(); for (const id of ['food', 'store', 'cafe', 'subway', 'studio', 'lookout']) __cozy.S.signs.add(id); });
    assert.notEqual(await f.evaluate(() => __cozy.travelTo('studio', { skipAnimation: true })), false, 'the trip to the studio starts');
    await f.waitForFunction(() => !__cozy.transitioning, null, { timeout: 120000, polling: 250 });
    await f.evaluate(() => { __cozy.setHour(10); __cozy.S.speed = 0; });
    await frames(20);
    await f.waitForFunction(() => __cozy.loc.haeun === 'studio', null, { timeout: 60000, polling: 500 });
    await f.evaluate(() => {
      const p = __cozy.haeun.root.position;
      __cozy.player.root.position.set(p.x + 0.9, p.y, p.z);
      __cozy.cam.snap = true;
    });
    await frames(6);
    await f.waitForFunction(() => /연습생|하은/.test(document.querySelector('#prompt').textContent), null, { timeout: 60000, polling: 500 }).catch(async (e) => {
      log(tag, 'no Haeun prompt', await f.evaluate(() => ({ prompt: document.querySelector('#prompt').textContent, dlg: __cozy.dlg.state.id, loc: __cozy.loc.haeun, hv: __cozy.haeun.root.visible, h: __cozy.haeun.root.position.toArray(), p: __cozy.player.root.position.toArray(), hour: __cozy.S.hour, overlays: [...document.querySelectorAll('.overlay:not(.hidden)')].map((o) => o.id || o.className) })));
      await shot('no-haeun-prompt');
      throw e;
    });
    await f.evaluate(() => __cozy.interact());
    await f.waitForFunction(() => __cozy.dlg.state.active, null, { polling: 500 });
    await talkThrough({ 'seoul.d2.drill:dr_call': '2-coach-formation', 'seoul.d2.drill:dr_front': '4-front-row', 'seoul.d2.drill:dr_end': '5-schedule-board' });
    const fl = await flags();
    log(tag, 'drill', { h1: fl.h1_done, done: fl.d2_drill_done, clean: fl.drill_clean, rough: fl.drill_rough });
    assert.ok(fl.h1_done && fl.d2_drill_done, 'H1, then the drill');
    assert.ok(fl.drill_clean, 'the drill was danced well');
    assert.ok(seen.includes('seoul.d2.drill:dr_front'), 'the Athlete is sent to the front row');
    assert.equal(seen.filter((s) => s === 'drill').length, 2, 'two drills: dawn and studio');
  }

  if (tag === 'intl') {
    await f.waitForFunction(() => __cozy.dlg.state.active, null, { timeout: 60000, polling: 500 });
    await shot('1-mum-text');
    await talkThrough();
    assert.ok((await flags()).family_call_set, 'Mum set the Sunday call');
  }

  if (tag === 'phone') {
    // Day 2 night: the edit plays before sleep, then the bed.
    assert.equal(await busy(), false, 'no morning loop for the Creator');
    await toBunk(22);
    await f.evaluate(() => __cozy.interact());
    await f.waitForFunction(() => __cozy.dlg.state.active, null, { polling: 500 });
    assert.ok((await f.evaluate(() => __cozy.dlg.state.id)).startsWith('seoul.loop.edit'));
    await talkThrough({ 'seoul.loop.edit:ed_caption': '1-edit-caption', 'seoul.loop.edit:ed_where': '2-edit-where' });
    const fl = await flags();
    assert.ok(fl.edit_archive && fl.edited_once, 'saved to the archive');
    assert.equal((await f.evaluate(() => __cozy.S.story.tally.toll)) ?? 0, 0, 'archiving costs nothing');
    await sleep();
    assert.equal(await f.evaluate(() => __cozy.S.day), 3);
  }
  await shot('9-end');
  log(tag, 'errors', errors);
  assert.deepEqual(errors, []);
  await page.close();
}

/** Follow each call on the beat (from eval1-browser's playDance): pose early, cell on the hit. */
async function playDance(f, onCall) {
  for (let i = 0; ; i++) {
    const ok = await f.waitForFunction((n) => {
      const c = document.querySelector('#seoul-eval .eval-card');
      return c?.dataset.screen !== 'dance' ? 'done' : c.dataset.call === String(n) ? 'call' : false;
    }, i, { timeout: 20000 }).then((h) => h.jsonValue()).catch(() => 'done');
    if (ok === 'done') return;
    const target = JSON.parse(await f.locator('#seoul-eval .eval-card').getAttribute('data-answer'));
    const hitAt = Number(await f.locator('#seoul-eval .eval-card').getAttribute('data-hit-at'));
    const from = await f.evaluate(() => ({ cell: document.querySelector('#seoul-eval .dance-cell.me')?.dataset.cell, pose: document.querySelector('#seoul-eval .dance-pose.on')?.dataset.pose }));
    const needPose = from.pose !== target.pose;
    const needCell = from.cell !== `${target.x},${target.y}`;
    if (needPose && needCell) await f.locator(`#seoul-eval .dance-pose[data-pose="${target.pose}"]`).click();
    const sel = needCell ? `#seoul-eval .dance-cell[data-cell="${target.x},${target.y}"]` : `#seoul-eval .dance-pose[data-pose="${target.pose}"]`;
    await f.evaluate(({ sel, hitAt }) => new Promise((r) => setTimeout(() => { document.querySelector(sel)?.click(); r(); }, Math.max(0, hitAt - performance.now() - 30))), { sel, hitAt });
    await onCall?.(i);
  }
}

const runs = (process.env.DAY2_RUNS || 'laptop,phone,intl').split(',');
try {
  for (const tag of runs) {
    await run(tag);
    log(tag, 'PASS');
  }
} finally {
  await browser.close();
}
