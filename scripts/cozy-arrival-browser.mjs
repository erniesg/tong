// Browser proof of day one in Seoul as one quest, from a fresh save: Tong's intro → map to the
// studio → walk to your locker (H0) → registration card → map to the dorm → walk upstairs →
// arrival scene → your bunk → day two. Movement is ordinary keyboard input steered by the camera;
// the only shortcuts are the in-game map (travelTo) a player would use.
// Start the dev server first (cd apps/client && npx next dev -p 3016). Screenshots go to COZY_EVIDENCE_DIR.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const moduleName = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(path.isAbsolute(moduleName) ? pathToFileURL(moduleName).href : moduleName);
const OUT = process.env.COZY_EVIDENCE_DIR || 'artifacts/cozy-arrival';
const URL = process.env.COZY_HOST_URL || 'http://127.0.0.1:3016/cozy';
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const log = (...a) => console.log(...a);

async function run({ width, height, tag, touch }) {
  const page = await browser.newPage({ viewport: { width, height }, hasTouch: !!touch, isMobile: !!touch });
  page.setDefaultTimeout(90000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const el = await page.waitForSelector('iframe.cozy-frame', { timeout: 180000 });
  const f = await el.contentFrame();
  await f.waitForFunction(() => window.__cozy && !document.querySelector('#start').disabled, null, { timeout: 300000 });
  const click = (sel) => f.evaluate((s) => document.querySelector(s).click(), sel);
  const frames = async (n) => {
    const start = await f.evaluate(() => window.__fr);
    await f.waitForFunction((t) => window.__fr >= t, start + n, { timeout: 600000, polling: 500 });
  };
  const shot = (name) => page.screenshot({ path: `${OUT}/${tag}-${name}.png`, timeout: 600000 });
  const today = () => f.evaluate(() => ({ count: document.querySelector('#quest-count')?.textContent, items: [...document.querySelectorAll('.quest-list li')].map((li) => `${li.className === 'step-done' ? '✓' : '·'} ${li.textContent}`) }));
  const hint = () => f.evaluate(() => __cozy.tongHint?.() ?? null);
  // Click through whatever dialogue is open, picking the first reply. A practice exercise Tong
  // opens on the way (a jumbled shop sign) is closed, as a player skipping it would.
  const busy = () => f.evaluate(() => __cozy.dlg.state.active || __cozy.bridgeBusy);
  const talkThrough = async () => {
    for (let i = 0; i < 80 && (await busy()); i++) {
      if (await page.evaluate(() => !!document.querySelector('.exercise-dismiss-btn, .cozy-practice__close'))) {
        await page.evaluate(() => document.querySelector('.exercise-dismiss-btn, .cozy-practice__close').click());
        log(tag, 'skipped a practice exercise');
      } else await f.evaluate(() => { if (!__cozy.dlg.state.active) return; __cozy.dlg.finishTyping(); if (__cozy.dlg.state.choices.length) __cozy.dlg.choose(0); else __cozy.dlg.advance(); });
      await frames(3);
    }
  };
  // Walk to (x, z) with the W key, aiming the camera so forward points at the target.
  const walk = async (x, z, label, tolerance = 0.45) => {
    await f.evaluate(() => document.getElementById('scene').focus());
    await page.keyboard.down('w');
    let best = Infinity, still = 0;
    for (let i = 0; i < 400; i++) {
      if (await busy()) {
        await page.keyboard.up('w');
        const id = await f.evaluate(() => __cozy.dlg.state.id);
        if (id) log(tag, `on the way to ${label}: dialogue ${id}`);
        if (id?.startsWith('haeun.h0.dorm')) { await frames(2); await shot('6-arrival-scene'); }
        await talkThrough();
        await f.evaluate(() => document.getElementById('scene').focus());
        await page.keyboard.down('w');
        still = 0;
      }
      const d = await f.evaluate(({ x, z }) => {
        const p = __cozy.player.root.position, dx = x - p.x, dz = z - p.z;
        __cozy.cam.yaw = Math.atan2(-dx, -dz);
        return Math.hypot(dx, dz);
      }, { x, z });
      if (d < tolerance) break;
      if (d < best - 0.05) { best = d; still = 0; } else if (++still > 40) { await page.keyboard.up('w'); throw new Error(`stuck walking to ${label} (${d.toFixed(2)} m away)`); }
      await frames(2);
    }
    await page.keyboard.up('w');
    await f.evaluate(() => { __cozy.traversal.vx = __cozy.traversal.vz = 0; });
  };

  await f.evaluate(() => { __cozy.renderer.setPixelRatio(0.5); window.__fr = 0; const k = () => { window.__fr++; requestAnimationFrame(k); }; k(); });
  await click('#start');
  await click('#creator-start');
  await f.waitForFunction(() => __cozy.dlg.state.active, null, { timeout: 120000, polling: 500 }).catch(() => {});
  await talkThrough();
  await f.evaluate(() => { __cozy.S.speed = 0; });
  await frames(4);
  const t0 = await today();
  log(tag, 'start', t0, await hint());
  assert.equal(t0.count, '0/4');
  await shot('1-start-today');

  // 1. Map to the studio, walk to your locker, play H0.
  await f.evaluate(() => __cozy.travelTo('studio', { skipAnimation: true }));
  await frames(6);
  await walk(-8.4, -34.2, 'studio floor');
  await walk(-13.0, -32.4, 'locker', 0.6);
  await frames(4);
  await f.waitForFunction(() => /사물함/.test(document.querySelector('#prompt').textContent), null, { timeout: 120000, polling: 500 });
  await shot('2-locker-prompt');
  await f.evaluate(() => __cozy.interact());
  await f.waitForFunction(() => __cozy.dlg.state.active, null, { polling: 500 });
  await talkThrough();
  assert.ok(await f.evaluate(() => __cozy.S.story.flags.h0_done), 'H0 done');

  // 2. The registration card arrives by itself; hand it in.
  await f.waitForSelector('#seoul-eval [data-action="profile-save"]', { timeout: 120000 });
  await shot('3-registration');
  await f.evaluate(() => document.querySelector('#seoul-eval [data-action="profile-save"]').click());
  await f.waitForFunction(() => !document.querySelector('.overlay:not(.hidden)'), null, { timeout: 120000, polling: 500 });
  await frames(40);
  const t1 = await today();
  log(tag, 'after H0 + card', t1, await hint());
  assert.equal(t1.count, '2/4');
  await shot('4-today-go-to-dorm');

  // 3. Evening. Map to the dorm, then walk in and up the stairs the way the building route goes.
  await f.evaluate(() => { __cozy.setHour(19.5); __cozy.S.speed = 0; });
  await f.evaluate(() => __cozy.travelTo('seoul-home', { skipAnimation: true }));
  await frames(6);
  await shot('5-dorm-outside');
  const route = await f.evaluate(() => {
    const b = __cozy.apartmentDiagnostics.find((b) => b.id === 'seoul-home');
    const end = b.route.findIndex((p) => p.kind === 'home-entry' && p.y > 3);
    return b.route.slice(1, end + 1).filter((p) => !['shared-lobby', 'concierge-approach'].includes(p.kind));
  });
  // The arrival scene starts on the landing; walk() plays it through when it opens.
  for (const p of route) {
    if (await f.evaluate(() => __cozy.S.story.flags.dorm_arrived)) break;
    await walk(p.x, p.z, p.kind, 0.35);
  }
  if (!(await f.evaluate(() => __cozy.S.story.flags.dorm_arrived))) {
    await f.waitForFunction(() => __cozy.dlg.state.active, null, { timeout: 120000, polling: 500 });
    await shot('6-arrival-scene');
    await talkThrough();
  }
  assert.ok(await f.evaluate(() => __cozy.S.story.flags.dorm_arrived), 'arrived at the dorm');
  await frames(40);
  const t2 = await today();
  log(tag, 'after dorm', t2, await hint());
  assert.equal(t2.count, '3/4');

  // 4. Walk to your bunk and sleep.
  const home = await f.evaluate(() => { const b = __cozy.apartmentDiagnostics.find((b) => b.id === 'seoul-home'); return { x: (b.bounds.minX + b.bounds.maxX) / 2, z: (b.bounds.minZ + b.bounds.maxZ) / 2 }; });
  await f.evaluate(() => { __cozy.setHour(22.9); __cozy.S.speed = 0; });
  for (const [u, v, label] of [[3, 3.25, 'corridor'], [3, 0.95, 'room B door'], [5.4, 0.95, 'room B'], [5.4, 0.6, 'bedside']]) await walk(home.x + u, home.z + v, label, 0.35);
  await frames(6);
  await f.waitForFunction(() => /침대/.test(document.querySelector('#prompt').textContent), null, { timeout: 120000, polling: 500 }).catch(async (e) => {
    log(tag, 'no bed prompt', await f.evaluate(() => ({ prompt: document.querySelector('#prompt').textContent, hidden: document.querySelector('#prompt').classList.contains('hidden'),
      dlg: __cozy.dlg.state.active && __cozy.dlg.state.id, overlays: [...document.querySelectorAll('.overlay:not(.hidden)')].map((o) => o.id), pose: __cozy.player.pose,
      pos: __cozy.player.root.position.toArray().map((n) => +n.toFixed(2)), sleeping: __cozy.day.sleeping, bridge: __cozy.bridgeBusy })));
    await shot('7-no-bed-prompt');
    throw e;
  });
  await shot('7-your-bunk');
  await f.evaluate(() => __cozy.interact());
  await f.waitForSelector('#bed-overlay:not(.hidden)', { state: 'attached' });
  await click('#bed-overlay .btn-primary');
  await f.waitForSelector('#morning-board:not(.hidden)', { state: 'attached', timeout: 60000 });
  await click('#morning-board .btn-primary');
  await frames(40);
  const t3 = await today();
  log(tag, 'day two', await f.evaluate(() => __cozy.S.day), t3, await hint(), 'errors', errors);
  assert.equal(await f.evaluate(() => __cozy.S.day), 2);
  assert.ok(!t3.items.some((i) => /Sleep in your bunk/.test(i)), 'arrival list is replaced on day two');
  await shot('8-day-two-today');
  assert.deepEqual(errors, []);
  await page.close();
}

try {
  const only = process.env.COZY_ONLY;
  if (!only || only === 'laptop') await run({ width: 1280, height: 800, tag: 'laptop' });
  if (!only || only === 'phone') await run({ width: 390, height: 844, tag: 'phone', touch: true });
  log('PASS');
} finally {
  await browser.close();
}
