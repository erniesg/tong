// Browser proof of the Seoul day loop (#410) at /cozy: walk, Tong freezes the clock, curfew, bed → recap → morning board.
// Start the dev server first (cd apps/client && npx next dev -p 3012). Screenshots at 1280×800 and 390×844 go to COZY_EVIDENCE_DIR.
// The host renders in software, so the script counts frames and clicks through the DOM instead of trusting wall time.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// PLAYWRIGHT_MODULE may point to an existing Playwright on the host (no install).
const moduleName = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(path.isAbsolute(moduleName) ? pathToFileURL(moduleName).href : moduleName);
const OUT = process.env.COZY_EVIDENCE_DIR || 'artifacts/cozy-day';
const URL = process.env.COZY_HOST_URL || 'http://127.0.0.1:3012/cozy';
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const log = (...a) => console.log(...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function run({ width, height, tag, bedHour, touch }) {
  const page = await browser.newPage({ viewport: { width, height }, hasTouch: !!touch, isMobile: !!touch });
  page.setDefaultTimeout(90000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const el = await page.waitForSelector('iframe.cozy-frame', { timeout: 180000 });
  const f = await el.contentFrame();
  await f.waitForFunction(() => window.__cozy && !document.querySelector('#start').disabled, null, { timeout: 300000 });
  // The host is shared and software-rendered: click through the DOM and count frames instead of trusting wall time.
  const click = (sel) => f.evaluate((s) => document.querySelector(s).click(), sel);
  const frames = async (n) => {
    const start = await f.evaluate(() => window.__fr);
    await f.waitForFunction((t) => window.__fr >= t, start + n, { timeout: 600000, polling: 500 });
  };
  await f.evaluate(() => { __cozy.renderer.setPixelRatio(0.5); window.__fr = 0; const k = () => { window.__fr++; requestAnimationFrame(k); }; k(); });
  await click('#start');
  await click('#creator-start');
  await f.waitForFunction(() => __cozy.dlg.state.active, null, { timeout: 120000, polling: 500 }).catch(() => {});
  await f.evaluate(() => { if (__cozy.dlg.state.active) __cozy.dlg.end(); __cozy.setHour(17); __cozy.S.speed = 1; });
  const shot = (name) => page.screenshot({ path: `${OUT}/${tag}-${name}.png`, timeout: 600000 });
  const st = () => f.evaluate(() => ({ hour: __cozy.S.hour, day: __cozy.S.day, ...__cozy.day.getCondition(), modal: !!document.querySelector('.overlay:not(.hidden)'), busy: __cozy.bridgeBusy }));

  // 1. Walk and run: the clock runs and 기력 drains.
  const s0 = await st();
  await f.evaluate(() => document.getElementById('scene').focus());
  await page.keyboard.down('w');
  await frames(25);
  await page.keyboard.down('Shift');
  await frames(25);
  await page.keyboard.up('Shift');
  await page.keyboard.up('w');
  await frames(2);
  const s1 = await st();
  log(tag, 'walk', s0.hour.toFixed(3), '→', s1.hour.toFixed(3), 'energy', s0.energy, '→', s1.energy, 'raw', await f.evaluate(() => __cozy.day.state.energy.toFixed(2)));
  assert.ok(s1.hour > s0.hour, 'clock runs while walking');
  assert.ok(await f.evaluate(() => __cozy.day.state.energy) < 100, '기력 drains while walking');
  await shot('1-walk');

  // 2. Tap Tong: the Tong menu (dialogue) freezes the clock.
  await click('#btn-tong');
  await f.waitForFunction(() => __cozy.dlg.state.active, null, { polling: 500 });
  const t0 = await f.evaluate(() => [__cozy.S.hour, __cozy.day.state.energy]);
  await frames(10);
  const t1 = await f.evaluate(() => [__cozy.S.hour, __cozy.day.state.energy]);
  log(tag, 'tong menu', t0, t1);
  assert.deepEqual(t1, t0, 'Tong menu stops time');
  await shot('2-tong-menu-frozen');
  // Learn opens Tong's practice over the game (host overlay, bridgeBusy).
  await f.waitForFunction(() => [...document.querySelectorAll('.choice')].some((b) => /배우기/.test(b.textContent)), null, { timeout: 120000, polling: 500 }).catch(() => {});
  const hasLearn = await f.evaluate(() => { const b = [...document.querySelectorAll('.choice')].find((b) => /배우기/.test(b.textContent)); b?.click(); return !!b; });
  if (hasLearn) {
    const opened = await page.waitForSelector('.cozy-practice__close', { timeout: 120000 }).then(() => true).catch(() => false);
    await f.waitForFunction(() => __cozy.bridgeBusy, null, { timeout: 60000, polling: 500 }).catch(() => {});
    const b0 = await f.evaluate(() => [__cozy.S.hour, __cozy.day.state.energy, __cozy.bridgeBusy]);
    await wait(4000);
    const b1 = await f.evaluate(() => [__cozy.S.hour, __cozy.day.state.energy, __cozy.bridgeBusy]);
    log(tag, 'learn open', opened, b0, b1);
    assert.deepEqual(b1, b0, 'Learn stops time');
    if (opened) await shot('3-learn-frozen');
    await page.evaluate(() => document.querySelector('.cozy-practice__close')?.click());
    await f.waitForFunction(() => !__cozy.bridgeBusy, null, { timeout: 120000, polling: 500 });
  }
  await f.waitForFunction(() => !__cozy.dlg.state.locked, null, { timeout: 60000, polling: 500 }).catch(() => {});
  await f.evaluate(() => { if (__cozy.dlg.state.active) __cozy.dlg.end(); });
  await frames(3);
  const after = await st();
  log(tag, 'after tong', after.hour.toFixed(3));

  // 3. After curfew, out in the street: quiet HUD state, night drain.
  await f.evaluate(() => { __cozy.setHour(23.3); });
  await frames(4);
  const cur = await f.evaluate(() => ({ cls: document.querySelector('.vigor').className, nightOut: __cozy.day.state.nightOut }));
  log(tag, 'curfew', cur);
  assert.match(cur.cls, /after-curfew/);
  await shot('4-after-curfew');

  // 4. Go home to bed (first-floor flat of Yeonnam Apartments; real dorm is #423).
  await f.evaluate(() => { __cozy.S.speed = 0; });
  const bed = await f.evaluate(() => {
    const room = __cozy.apartmentDiagnostics.find((b) => b.id === 'seoul-home').rooms.find((r) => r.level === 1);
    const m = room.furniture.find((x) => x.kind === 'your-bunk');
    return { x: m.position[0] - 1.25, y: room.floorY, z: m.position[2] };
  });
  await f.evaluate(({ x, y, z, h }) => {
    __cozy.player.root.position.set(x, y, z);
    __cozy.traversal.vx = __cozy.traversal.vz = 0;
    __cozy.setHour(h);
    __cozy.S.speed = 0;
    __cozy.cam.snap = true;
  }, { ...bed, h: bedHour });
  await frames(6);
  await f.waitForFunction(() => /침대/.test(document.querySelector('#prompt').textContent), null, { timeout: 300000, polling: 500 });
  assert.doesNotMatch(await f.evaluate(() => document.querySelector('.vigor').className), /after-curfew/, 'home is not out after curfew');
  await shot('5-bed-prompt');
  await f.evaluate(() => __cozy.interact());
  await f.waitForSelector('#bed-overlay:not(.hidden)', { state: 'attached' });
  const r0 = await f.evaluate(() => __cozy.S.hour);
  await frames(4);
  assert.equal(await f.evaluate(() => __cozy.S.hour), r0, 'recap holds the clock');
  await shot('6-recap');
  await click('#bed-overlay .btn-primary');
  await f.waitForSelector('#morning-board:not(.hidden)', { state: 'attached', timeout: 60000 });
  await frames(3);
  const m = await st();
  log(tag, 'morning', m);
  await shot('7-morning-board');
  await click('#morning-board .btn-primary');
  await frames(4);
  await shot('8-new-day-hud');
  const saved = await f.evaluate(() => JSON.parse(localStorage.getItem('tong-cozy-seoul-v2')).dayLoop);
  log(tag, 'saved', saved, 'errors', errors);
  await page.close();
  return m;
}

try {
  const a = await run({ width: 1280, height: 800, tag: 'laptop', bedHour: 23.6 });
  assert.equal(a.id, 'fresh');
  assert.ok(a.hour >= 7 && a.hour < 7.2);
  const b = await run({ width: 390, height: 844, tag: 'phone', bedHour: 1.5, touch: true });
  assert.equal(b.id, 'tired');
  assert.ok(b.hour >= 8 && b.hour < 8.2);
  console.log('OK');
} finally {
  await browser.close();
}
