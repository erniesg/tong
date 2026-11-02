// Reviewer walkthroughs at /cozy, recorded with COZY_VIDEO_DIR (docs/qa-evidence-uploads.md):
//   creator:  the character creator: every tab, a few looks, Guy/Girl, zoom and spin, name and
//             origin, then the first line at Incheon
//   hangouts: day 2 after an old-save start (__cozy.skipDayOne): H1 at 10 with the drill, J0 with
//             Jin at the pojangmacha at night, H2 in the studio at 21:40
// Paced for watching (short holds between steps). Tong host exercises are closed, as a player
// skipping them would. Start the dev server first (cd apps/client && npx next dev -p 3023).
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { openPage, closePage } from './lib/cozy-video.mjs';

const moduleName = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(path.isAbsolute(moduleName) ? pathToFileURL(moduleName).href : moduleName);
const OUT = process.env.COZY_EVIDENCE_DIR || 'artifacts/cozy-showcase';
const URL = process.env.COZY_HOST_URL || 'http://127.0.0.1:3023/cozy';
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const log = (...a) => console.log(...a);

async function open(tag, viewport) {
  const page = await openPage(browser, { viewport, hasTouch: false, isMobile: false });
  page.setDefaultTimeout(120000);
  await page.addInitScript(() => { try { localStorage.setItem('tong-eval-debug', '1'); } catch {} });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 300000 });
  const f = await (await page.waitForSelector('iframe.cozy-frame', { timeout: 300000 })).contentFrame();
  await f.waitForFunction(() => window.__cozy && !document.querySelector('#start').disabled, null, { timeout: 300000 });
  await f.evaluate(() => { __cozy.renderer.setPixelRatio(0.6); window.__fr = 0; const k = () => { window.__fr++; requestAnimationFrame(k); }; k(); });
  const frames = async (n) => {
    const start = await f.evaluate(() => window.__fr);
    await f.waitForFunction((t) => window.__fr >= t, start + n, { timeout: 600000, polling: 300 });
  };
  const hold = (ms = 1500) => page.waitForTimeout(ms);
  const shot = (name) => page.screenshot({ path: `${OUT}/${tag}-${name}.png`, timeout: 600000 });
  const busy = () => f.evaluate(() => __cozy.dlg.state.active || __cozy.bridgeBusy);
  const overlayItem = () => f.evaluate(() => (document.querySelector('#seoul-eval')?.classList.contains('hidden') ? null : document.querySelector('#seoul-eval .eval-card')?.dataset.item ?? null));
  // Talk through dialogue at a readable pace, picking the first reply; dance drills on the beat.
  const talkThrough = async (shots = {}) => {
    for (let i = 0; i < 250; i++) {
      if ((await overlayItem()) === 'dance') { await playDance(f); continue; }
      if (!(await busy())) { await frames(6); if (!(await busy()) && !(await overlayItem())) return; continue; }
      if (await page.evaluate(() => !!document.querySelector('.exercise-dismiss-btn, .cozy-practice__close'))) {
        await page.evaluate(() => document.querySelector('.exercise-dismiss-btn, .cozy-practice__close').click());
        continue;
      }
      const id = await f.evaluate(() => __cozy.dlg.state.id);
      await f.evaluate(() => __cozy.dlg.finishTyping());
      await hold(1100);
      if (id && shots[id]) await shot(shots[id]);
      await f.evaluate(() => { if (!__cozy.dlg.state.active) return; if (__cozy.dlg.state.choices.length) __cozy.dlg.choose(0); else __cozy.dlg.advance(); });
      await frames(3);
    }
  };
  return { page, f, errors, frames, hold, shot, busy, talkThrough };
}

/* ── The character creator ─────────────────────── */
async function creator() {
  const { page, f, errors, hold, shot } = await open('creator', { width: 1280, height: 800 });
  await f.evaluate(() => document.querySelector('#start').click());
  await f.waitForSelector('#creator:not(.hidden)', { state: 'attached' });
  await hold(2500);
  await shot('1-creator');
  await f.evaluate(() => { const n = document.querySelector('#name'); n.value = '지우'; n.dispatchEvent(new Event('input', { bubbles: true })); });
  await hold();
  // Every tab, with a couple of changes on each.
  const tabs = await f.evaluate(() => [...document.querySelectorAll('.creator-tab')].map((b) => b.id));
  for (const id of tabs) {
    await f.evaluate((id) => document.getElementById(id).click(), id);
    await hold(1200);
    await f.evaluate(() => {
      const sw = [...document.querySelectorAll('#creator-panel .creator-swatch')];
      if (sw.length) sw[Math.min(2, sw.length - 1)].click();
      const sel = document.querySelector('#creator-panel select');
      if (sel && sel.options.length > 1) { sel.selectedIndex = (sel.selectedIndex + 2) % sel.options.length; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    await hold(1600);
  }
  await shot('2-edited');
  // Guy, then back to Girl; zoom to the face; spin.
  await f.evaluate(() => document.querySelector('[data-gender="m"]').click());
  await hold(2200);
  await f.evaluate(() => document.querySelector('[data-gender="f"]').click());
  await hold(2200);
  await f.evaluate(() => document.querySelector('#creator-zoom').click());
  await hold(2200);
  await shot('3-face');
  await f.evaluate(() => document.querySelector('#creator-zoom').click());
  await f.evaluate(() => document.querySelector('#creator-spin')?.click());
  await hold(3000);
  // Basics: nationality and origin ("Before Seoul, you were").
  await f.evaluate(() => document.querySelector('#creator-tab-basics')?.click());
  await hold(1200);
  await f.evaluate(() => { const o = document.querySelector('#origin'); o.value = 'athlete'; o.dispatchEvent(new Event('change', { bubbles: true })); });
  await hold(1800);
  await shot('4-origin');
  await f.evaluate(() => document.querySelector('#creator-start').click());
  await f.waitForFunction(() => __cozy.dlg.state.active, null, { timeout: 120000, polling: 500 });
  await f.evaluate(() => __cozy.dlg.finishTyping());
  await hold(3000);
  await shot('5-incheon');
  assert.equal(await f.evaluate(() => __cozy.S.city), 'incheon');
  log('creator errors', errors);
  assert.deepEqual(errors, []);
  await closePage(page, 'creator');
}

/* ── Hangouts: H1 and the drill, J0 with Jin, H2 ── */
async function hangouts() {
  const { page, f, errors, frames, hold, shot, talkThrough } = await open('hangouts', { width: 1280, height: 800 });
  await f.evaluate(() => document.querySelector('#start').click());
  await f.evaluate(() => { document.querySelector('#origin').value = 'creator'; document.querySelector('#creator-start').click(); });
  await f.waitForFunction(() => __cozy.dlg.state.active, null, { timeout: 120000, polling: 500 });
  await f.evaluate(() => __cozy.skipDayOne());
  await f.evaluate(() => {
    Object.assign(__cozy.S.story.flags, { h0_done: true, dorm_arrived: true, 'played:seoul.d1.bedtime': true });
    for (const id of ['food', 'store', 'cafe', 'subway', 'studio', 'lookout']) __cozy.S.signs.add(id);
    __cozy.S.day = 2; __cozy.S.speed = 0;
  });
  await f.waitForSelector('#seoul-eval [data-action="profile-save"]', { timeout: 60000 }).catch(() => {});
  await f.evaluate(() => document.querySelector('#seoul-eval [data-action="profile-save"]')?.click());
  const go = async (place, hour) => {
    await f.evaluate(() => { if (__cozy.dlg.state.active) __cozy.dlg.end(); });
    // After J0, Jin walks off first (tentStory 'exit'); the map waits for that.
    await f.waitForFunction(() => __cozy.S.tentStory === 'idle' && !__cozy.dlg.state.active, null, { timeout: 900000, polling: 500 }); // his walk is slow on software rendering
    assert.notEqual(await f.evaluate((p) => __cozy.travelTo(p, { skipAnimation: true }), place), false, `the trip to ${place} starts`);
    await f.waitForFunction(() => !__cozy.transitioning, null, { timeout: 120000, polling: 250 });
    await f.evaluate((h) => { __cozy.setHour(h); __cozy.S.speed = 0; }, hour);
    await frames(20);
  };
  const talkTo = async (who, re) => {
    await f.evaluate((who) => {
      const c = __cozy[who], p = c.root.position;
      __cozy.player.root.position.set(p.x + 0.9, p.y, p.z + 0.4);
      __cozy.cam.snap = true;
    }, who);
    await frames(8);
    await f.waitForFunction((src) => new RegExp(src).test(document.querySelector('#prompt').textContent), re.source, { timeout: 60000, polling: 500 })
      .catch(async (e) => { log('no prompt for', who, await f.evaluate(() => ({ prompt: document.querySelector('#prompt').textContent, hour: __cozy.S.hour, loc: __cozy.loc }))); throw e; });
    await hold(1200);
    await f.evaluate(() => __cozy.interact());
    await f.waitForFunction(() => __cozy.dlg.state.active, null, { timeout: 60000, polling: 500 });
  };
  // H1 at 10, then Coach Park's drill with the cohort in the room.
  await go('studio', 10);
  await f.waitForFunction(() => __cozy.loc.haeun === 'studio', null, { timeout: 60000, polling: 500 });
  await hold(2000);
  await talkTo('haeun', /연습생|하은/);
  await talkThrough({ 'haeun.h1:h1_meet': '1-h1', 'seoul.d2.drill:dr_call': '2-drill' });
  assert.ok(await f.evaluate(() => __cozy.S.story.flags.h1_done && __cozy.S.story.flags.d2_drill_done), 'H1 and the drill');
  // J0: the pojangmacha at night, the man in the cap.
  await go('food', 19.6);
  await f.waitForFunction(() => __cozy.loc.jin === 'tent' && __cozy.jin.root.visible, null, { timeout: 60000, polling: 500 });
  await hold(2000);
  await talkTo('jin', /모자 쓴 남자/);
  await talkThrough({ 'jin.j0:j0_open': '3-j0' });
  assert.ok(await f.evaluate(() => __cozy.S.story.flags.j0_done), 'J0 done');
  // H2: the studio lights at 21:40.
  await go('studio', 21.6);
  await f.waitForFunction(() => __cozy.loc.haeun === 'studio', null, { timeout: 60000, polling: 500 });
  await hold(2000);
  await talkTo('haeun', /하은/);
  await talkThrough({ 'haeun.h2:h2_open': '4-h2' });
  assert.ok(await f.evaluate(() => __cozy.S.story.flags.h2_done), 'H2 done');
  log('hangouts errors', errors);
  assert.deepEqual(errors, []);
  await closePage(page, 'hangouts');
}

/** Follow each call on the beat (as cozy-day2-browser's playDance). */
async function playDance(f) {
  for (let i = 0; ; i++) {
    const ok = await f.waitForFunction((n) => {
      const c = document.querySelector('#seoul-eval .eval-card');
      return c?.dataset.screen !== 'dance' || document.querySelector('#seoul-eval').classList.contains('hidden') ? 'done' : c.dataset.call === String(n) ? 'call' : false;
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
  }
}

const runs = (process.env.SHOWCASE_RUNS || 'creator,hangouts').split(',');
try {
  if (runs.includes('creator')) { await creator(); log('creator PASS'); }
  if (runs.includes('hangouts')) { await hangouts(); log('hangouts PASS'); }
} finally {
  await browser.close();
}
