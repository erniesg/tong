// Browser proof: play Seoul eval 1 end to end at /cozy (inside the CozyHost iframe), force-unlocked.
// Runs twice: laptop 1280×800 and phone 390×844, with different tiers, saving a screenshot per screen.
//   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright COZY_HOST_URL=http://127.0.0.1:3011/cozy \
//   EVAL_SHOTS=/some/dir node scripts/cozy-eval1-browser.mjs
// The harness reads the expected answer from data-answer, which the eval only sets when the
// `tong-eval-debug` localStorage flag is on. It answers mostly right, on the beat, with a few planned slips.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const moduleName = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(path.isAbsolute(moduleName) ? pathToFileURL(moduleName).href : moduleName);
const hostUrl = process.env.COZY_HOST_URL || 'http://127.0.0.1:3011/cozy';
const shots = process.env.EVAL_SHOTS || path.resolve('eval1-shots');
await mkdir(shots, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const summary = [];

async function run(label, viewport, plan) {
  const page = await browser.newPage({ viewport, hasTouch: label === 'phone', isMobile: label === 'phone', deviceScaleFactor: 1 });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('tong-eval-debug', '1'); } catch {} });
  await page.goto(hostUrl, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const frameEl = await page.waitForSelector('iframe.cozy-frame', { timeout: 180000 });
  const f = await frameEl.contentFrame();
  await f.waitForFunction(() => window.__cozy && !document.getElementById('start').disabled, null, { timeout: 180000 });
  await f.evaluate(() => { try { localStorage.removeItem('tong-cozy-seoul-v2'); } catch {} });
  await f.locator('#start').click();
  await f.locator('#creator-start').click();
  await f.waitForFunction(() => __cozy.S.started);
  // A new game opens with Tong's intro; let it start, then close it.
  await f.waitForFunction(() => __cozy.dlg.state.active, null, { timeout: 15000 }).catch(() => {});
  await f.evaluate(() => { __cozy.S.speed = 0; __cozy.renderer.setPixelRatio(0.5); __cozy.dlg.end(); });
  // Skip Tong's sign-reading tutorial (it would keep re-offering at the studio door).
  await f.evaluate(() => { for (const id of ['food', 'store', 'cafe', 'subway', 'studio', 'lookout']) __cozy.S.signs.add(id); });
  await f.evaluate(() => __cozy.travelTo('studio', { skipAnimation: true }));
  await page.waitForTimeout(1500);
  // Walk-up view: stand at the studio schedule board (next to the word-quiz whiteboard).
  await f.evaluate(() => {
    __cozy.player.root.position.set(-7.3, 2.4, -42.2);
    __cozy.player.root.rotation.y = Math.PI;
    Object.assign(__cozy.cam, { yaw: 0, pitch: 0.25, dist: 3.5, snap: true });
  });
  await page.waitForTimeout(6000);
  await quiet(f);
  // Harness-only speed-up: swiftshader WebGL makes every screenshot cost seconds, which breaks
  // the dance timing. Hold the last rendered world frame behind the overlay (the canvas keeps it).
  await f.evaluate(() => { const c = __cozy.composer; c.renderOnce = c.render.bind(c); c.render = () => {}; });
  let n = 0;
  const shot = async (name) => {
    const file = path.join(shots, `${label}-${String(++n).padStart(2, '0')}-${name}.png`);
    await f.evaluate(() => __cozy.composer.renderOnce?.());
    await page.screenshot({ path: file, timeout: 180000 });
    console.error(`shot ${path.basename(file)}`);
    summary.push(file);
  };
  const card = f.locator('#seoul-eval .eval-card');
  const screen = (tag) => f.waitForSelector(`#seoul-eval .eval-card[data-screen="${tag}"]`, { timeout: 60000 });
  const action = (id) => f.locator(`#seoul-eval [data-action="${id}"]`).click();

  // The board: locked, then 리허설, then force-unlock (debug).
  const chap0 = await f.evaluate(() => ({ ...__cozy.seoulEval.chapter }));
  assert.equal(chap0.month, 1);
  assert.equal(chap0.status, 'open');
  await quiet(f);
  assert.equal(await f.evaluate(() => __cozy.levelDiagnostics.interaction), '📋 스케줄표 · Schedule board', 'E prompt at the board');
  await shot('board-in-world');
  await f.evaluate(() => __cozy.interact()); // the real E-key path
  await screen('board');
  assert.equal(await f.locator('[data-action="start"]').count(), 0, 'locked before H0–H2');
  await shot('board-locked');
  if (plan.rehearse) {
    await action('rehearse');
    await screen('tier-dance');
    await action('tier-1');
    await screen('dance');
    await playDance(f, card, { slips: [1] }, async (i) => { if (i === 2) await shot('rehearsal-dance'); });
    await screen('rehearsal-done');
    await shot('rehearsal-done');
    const c = await f.evaluate(() => __cozy.seoulEval.chapter);
    assert.equal(c.rehearsals, 1);
    assert.deepEqual(c.results, {}, 'rehearsal is ungraded');
    await f.locator('#seoul-eval .eval-actions button').first().click();
    await quiet(f);
  await f.evaluate(() => { __cozy.seoulEval.openBoard(); });
    await screen('board');
  }
  await action('force');
  await screen('board');
  await shot('board-unlocked');
  await action('start');
  await screen('confirm');
  await shot('confirm');
  await action('confirm');
  await f.waitForFunction(() => __cozy.seoulEval.chapter.status === 'eve');
  const eve = await f.evaluate(() => ({ day: __cozy.S.day, evalDay: __cozy.seoulEval.chapter.evalDay }));
  assert.equal(eve.evalDay, eve.day + 1, 'tomorrow is eval day');
  await quiet(f);
  await f.evaluate(() => { __cozy.seoulEval.openBoard(); });
  await screen('board');
  await shot('board-eve');
  await action('sleep');
  // Eval day waits for a free world: close any arrival chatter Tong started meanwhile.
  for (let i = 0; i < 40 && !(await f.locator('#seoul-eval .eval-card[data-screen="eval-intro"]').count()); i++) {
    await page.waitForTimeout(500);
    const busy = await f.evaluate(() => ({ dlg: __cozy.dlg.state.active && __cozy.dlg.state.id, overlays: [...document.querySelectorAll('.overlay:not(.hidden)')].map((o) => o.id), book: !document.getElementById('book').classList.contains('hidden'), transitioning: __cozy.transitioning, bridge: __cozy.bridgeBusy }));
    if (i % 6 === 5) console.error('waiting for eval day', JSON.stringify(busy));
    await quiet(f);
  }
  await screen('eval-intro');
  assert.equal(await f.evaluate(() => __cozy.S.hour), 8);
  await shot('eval-intro');
  await action('begin');

  for (const round of ['vocal', 'dance', 'judges', 'field']) {
    const tier = plan.tiers[round];
    await screen(`tier-${round}`);
    await shot(`${round}-tier`);
    await action(`tier-${tier}`);
    if (round === 'judges') {
      if (await f.locator('[data-screen="profile"]').count() || await screen('profile').then(() => true, () => false)) {
        await f.selectOption('select[data-profile="nationality"]', '싱가포르');
        await f.selectOption('select[data-profile="family"]', '4');
        await f.selectOption('select[data-profile="hobby"]', '요리');
        await shot('judges-profile');
        await action('profile-save');
      }
    }
    if (round === 'field') {
      await screen('chat');
      await shot('field-chat');
      await f.locator('#seoul-eval .eval-actions button').first().click();
    }
    if (round === 'dance') {
      await screen('dance');
      await playDance(f, card, { slips: plan.danceSlips }, async (i) => { if (i === 1) await shot('dance-call'); if (i === 3) await shot('dance-call-2'); });
    } else {
      await playItems(f, card, round, plan, shot);
    }
    if (round === 'field') {
      await screen('lunch');
      await shot('field-lunch-reactions');
      await f.locator('#seoul-eval .eval-actions button').first().click();
    }
    await screen(`done-${round}`);
    await shot(`${round}-score`);
    const saved = await f.evaluate((r) => JSON.parse(localStorage.getItem('tong-cozy-seoul-v2')).chapter.run.rounds[r], round);
    assert.ok(saved && Number.isFinite(saved.score), `${round} autosaved`);
    await f.locator('#seoul-eval .eval-actions button').first().click();
  }

  await screen('results');
  await shot('results');
  await f.evaluate(() => document.querySelector('#seoul-eval .eval-card').scrollTo(0, 1e5));
  await shot('results-bottom');
  const out = await f.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('tong-cozy-seoul-v2'));
    return { chapter: save.chapter, hour: __cozy.S.hour };
  });
  assert.equal(out.chapter.month, 2, 'the month advances after results');
  assert.equal(out.chapter.status, 'open');
  const r = out.chapter.results[1];
  assert.ok(r && r.band && r.board.length === 6, 'results stored with the ranking board');
  assert.ok(Array.isArray(out.chapter.weak));
  await action('results-close');
  await page.waitForTimeout(800);
  await shot('after-results');
  assert.deepEqual(errors, [], `page errors: ${errors.join('\n')}`);
  await page.close();
  return { label, grade: r.grade, band: r.band, rank: `${r.rank}/${r.of}`, scores: r.scores, tiers: r.tiers, weak: out.chapter.weak, mastery: out.chapter.mastery };
}

/** End any dialogue the world started on its own (arrival lines, Tong tips). */
async function quiet(f) {
  await f.evaluate(() => { if (__cozy.dlg.state.active) __cozy.dlg.end(); });
  // Tong's sign offer can open a shared block-crush in the host page; dismiss it (eval day waits for it).
  const host = f.page();
  const dismiss = host.locator('.exercise-dismiss-btn, .cozy-practice__close');
  if (await dismiss.count()) await dismiss.first().click().catch(() => {});
}

async function playItems(f, card, round, plan, shot) {
  let shots = 0;
  const seen = new Set();
  for (;;) {
    const handle = await f.waitForSelector(`#seoul-eval .eval-card[data-item]:not([data-item="dance"]), #seoul-eval .eval-card[data-screen="lunch"], #seoul-eval .eval-card[data-screen^="done-"]`);
    const item = await handle.getAttribute('data-item');
    const scr = await handle.getAttribute('data-screen');
    if (!item || !scr?.startsWith('item-')) return;
    if (seen.has(item)) { await f.waitForTimeout(100); continue; }
    seen.add(item);
    const answer = JSON.parse(await handle.getAttribute('data-answer'));
    const slip = plan.slips.includes(item);
    if (plan.hints.includes(item)) await f.locator('#seoul-eval .eval-hint-btn').click();
    if (shots < 2 || plan.shotItems.includes(item)) { await shot(`${round}-${item.replace(/^[a-z]+-/, '')}`); shots++; }
    if (scr === 'item-choice') {
      const opts = f.locator('#seoul-eval .choice');
      if (slip) {
        const ids = await opts.evaluateAll((bs) => bs.map((b) => b.dataset.option));
        await f.locator(`#seoul-eval .choice[data-option="${ids.find((x) => x !== answer)}"]`).click();
      } else await f.locator(`#seoul-eval .choice[data-option="${answer}"]`).click();
    } else if (scr === 'item-blocks') {
      const words = slip ? [...answer].reverse() : answer;
      for (const w of words) await f.locator('#seoul-eval .eval-pool button:not([disabled])', { hasText: new RegExp(`^${w}$`) }).first().click();
      if (plan.shotItems.includes(`${item}:built`)) await shot(`${round}-${item.replace(/^[a-z]+-/, '')}-built`);
      await f.locator('#seoul-eval .eval-check').click();
    } else if (scr === 'item-type') {
      await f.locator('#seoul-eval .eval-input').fill(slip ? '모르겠어요' : answer);
      await f.locator('#seoul-eval .eval-check').click();
    } else if (scr === 'item-wallet') {
      const bills = slip ? [50000] : [10000, 10000];
      for (const v of bills) await f.locator(`#seoul-eval .eval-bill[data-value="${v}"][aria-pressed="false"]`).first().click();
      await shot(`${round}-pay`);
      await f.locator('#seoul-eval .eval-check').click();
    }
    await f.waitForSelector('#seoul-eval .eval-feedback');
    if (plan.shotItems.includes(`${item}:feedback`)) await shot(`${round}-${item.replace(/^[a-z]+-/, '')}-feedback`);
  }
}

/** Follow each call: set the pose early, step to the cell on the hit beat. slips: call indexes to miss. */
async function playDance(f, card, { slips = [] }, onCall) {
  for (let i = 0; ; i++) {
    const ok = await f.waitForFunction((n) => {
      const c = document.querySelector('#seoul-eval .eval-card');
      return c?.dataset.screen !== 'dance' ? 'done' : c.dataset.call === String(n) ? 'call' : false;
    }, i, { timeout: 20000 }).then((h) => h.jsonValue()).catch(() => 'done');
    if (ok === 'done') return;
    const target = JSON.parse(await f.locator('#seoul-eval .eval-card').getAttribute('data-answer'));
    const hitAt = Number(await f.locator('#seoul-eval .eval-card').getAttribute('data-hit-at'));
    const from = await f.evaluate(() => {
      const me = document.querySelector('#seoul-eval .dance-cell.me');
      const pose = document.querySelector('#seoul-eval .dance-pose.on');
      return { cell: me?.dataset.cell, pose: pose?.dataset.pose };
    });
    if (slips.includes(i)) {
      await f.waitForTimeout(3800);
      await onCall?.(i);
      continue;
    }
    const needPose = from.pose !== target.pose;
    const needCell = from.cell !== `${target.x},${target.y}`;
    if (needPose && needCell) await f.locator(`#seoul-eval .dance-pose[data-pose="${target.pose}"]`).click();
    await f.waitForTimeout(300);
    await onCall?.(i);
    // Tap on the last beat: schedule the click in the page at the hit time (the page's own clock).
    const sel = needCell ? `#seoul-eval .dance-cell[data-cell="${target.x},${target.y}"]` : `#seoul-eval .dance-pose[data-pose="${target.pose}"]`;
    await f.evaluate(({ sel, hitAt }) => new Promise((r) => setTimeout(() => { document.querySelector(sel)?.click(); r(); }, Math.max(0, hitAt - performance.now() - 30))), { sel, hitAt });
  }
}

const runs = (process.env.EVAL_RUNS || 'laptop,phone').split(',');
try {
  if (runs.includes('laptop')) summary.push(JSON.stringify(await run('laptop', { width: 1280, height: 800 }, {
    rehearse: true,
    tiers: { vocal: 1, dance: 1, judges: 2, field: 1 },
    slips: ['vocal-q-weather', 'field-gimbap'], hints: ['vocal-q-rolls'], danceSlips: [5],
    shotItems: ['vocal-q-who', 'judges-q-family', 'judges-q-family:built', 'field-gimbap', 'field-gimbap:feedback'],
  })));
  if (runs.includes('phone')) summary.push(JSON.stringify(await run('phone', { width: 390, height: 844 }, {
    rehearse: false,
    tiers: { vocal: 2, dance: 2, judges: 1, field: 2 },
    slips: ['vocal-dict-2', 'field-ramyeon', 'field-pay'], hints: ['judges-q-weekend'], danceSlips: [2, 6],
    shotItems: ['vocal-dict-1:built', 'judges-q-weekend', 'field-tteokbokki:built'],
  })));
} finally {
  await browser.close();
  console.log(summary.join('\n'));
}
