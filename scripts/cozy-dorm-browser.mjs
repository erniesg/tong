// Browser proof of the girls' dorm (#423) at /cozy: arrive on day one → the arrival scene
// (Haeun steers you to Da-on's room) → roommates in at night → your bunk → recap → morning board.
// Start the dev server first (cd apps/client && npx next dev -p 3016). Screenshots at 1280×800 and
// 390×844 go to COZY_EVIDENCE_DIR. The host renders in software, so the script counts frames.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const moduleName = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(path.isAbsolute(moduleName) ? pathToFileURL(moduleName).href : moduleName);
const OUT = process.env.COZY_EVIDENCE_DIR || 'artifacts/cozy-dorm';
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
  const place = (x, y, z, yaw = 0) => f.evaluate(({ x, y, z, yaw }) => {
    __cozy.player.root.position.set(x, y, z);
    __cozy.player.root.rotation.y = yaw;
    __cozy.traversal.vx = __cozy.traversal.vz = 0;
    __cozy.cam.yaw = yaw + Math.PI;
    __cozy.cam.snap = true;
  }, { x, y, z, yaw });
  await f.evaluate(() => { __cozy.renderer.setPixelRatio(0.5); window.__fr = 0; const k = () => { window.__fr++; requestAnimationFrame(k); }; k(); });
  await click('#start');
  await click('#creator-start');
  // Day 1 now starts at Incheon (cozy-day1-browser.mjs covers it); this proof starts in Hongdae.
  await f.waitForFunction(() => __cozy.S.started, null, { polling: 500 });
  await f.evaluate(() => __cozy.skipDayOne());
  await f.waitForFunction(() => __cozy.dlg.state.active, null, { timeout: 120000, polling: 500 }).catch(() => {});
  // Day one: the lockers (H0) are done; it's evening.
  await f.evaluate(() => { if (__cozy.dlg.state.active) __cozy.dlg.end(); __cozy.S.story.flags.h0_done = true; __cozy.setHour(19.5); __cozy.S.speed = 0; });
  // The registration card follows H0; hand it in so the world is free.
  await f.waitForSelector('#seoul-eval [data-action="profile-save"]', { timeout: 120000 }).catch(() => {});
  await f.evaluate(() => document.querySelector('#seoul-eval [data-action="profile-save"]')?.click());
  await f.waitForFunction(() => !document.querySelector('.overlay:not(.hidden)'), null, { timeout: 120000, polling: 500 });
  const home = await f.evaluate(() => { const b = __cozy.apartmentDiagnostics.find((b) => b.id === 'seoul-home'); return { x: (b.bounds.minX + b.bounds.maxX) / 2, z: (b.bounds.minZ + b.bounds.maxZ) / 2 }; });

  // 1. Tong points you to the dorm.
  const hint = await f.evaluate(() => document.querySelector('#btn-tong') && __cozy.S.story.flags.dorm_arrived);
  assert.ok(!hint, 'not arrived yet');

  // 2. Outside the block, then onto your floor: the arrival scene starts by itself.
  await place(home.x, 0, home.z + 9, Math.PI);
  await frames(6);
  await shot('1-dorm-outside');
  await place(home.x + 1.55, 3.4, home.z + 3.25, Math.PI);
  await f.waitForFunction(() => __cozy.dlg.state.active, null, { timeout: 300000, polling: 500 });
  const seen = [];
  for (let i = 0; i < 40 && (await f.evaluate(() => __cozy.dlg.state.active)); i++) {
    const s = await f.evaluate(() => { __cozy.dlg.finishTyping(); return { who: __cozy.dlg.state.node?.who, choices: __cozy.dlg.state.choices.length, text: document.querySelector('#dialogue')?.innerText.slice(0, 120) }; });
    if (seen.at(-1) !== s.who) seen.push(s.who);
    if (s.who === 'manager_choi' && !seen.includes('shot-choi')) { seen.push('shot-choi'); await frames(2); await shot('2-manager-choi'); }
    // Haeun is unnamed on day one (speaker haeun_unnamed, until H1).
    if (s.who === 'haeun_unnamed' && s.choices) { await frames(2); await shot('3-haeun-steers-you'); await f.evaluate(() => __cozy.dlg.choose(0)); await frames(2); continue; }
    if (s.who === 'daon' && !seen.includes('shot-daon')) { seen.push('shot-daon'); await frames(2); await shot('4-daon'); }
    if (s.choices) { await f.evaluate(() => __cozy.dlg.choose(0)); await frames(2); continue; }
    await f.evaluate(() => __cozy.dlg.advance());
    await frames(2);
  }
  const flags = await f.evaluate(() => __cozy.S.story.flags);
  log(tag, 'speakers', seen.filter((s) => !s.startsWith('shot')), 'dorm_arrived', flags.dorm_arrived);
  assert.ok(flags.dorm_arrived, 'arrival scene finished');
  for (const who of ['manager_choi', 'haeun_unnamed', 'daon', 'boram']) assert.ok(seen.includes(who), `${who} speaks`);

  // 3. Night: the roommates are in; Haeun is in room A.
  await f.evaluate(() => __cozy.setHour(22.8));
  await place(home.x + 3, 3.4, home.z + 0.95, Math.PI / 2);
  await frames(8);
  const cast = await f.evaluate(() => ({ haeun: __cozy.loc.haeun, haeunVisible: __cozy.haeun.root.visible, prompt: document.querySelector('#prompt').textContent }));
  log(tag, 'night', cast);
  assert.equal(cast.haeun, 'dorm');
  assert.ok(cast.haeunVisible, 'Haeun renders on your floor');
  await shot('5-corridor-night');
  await place(home.x + 5.4, 3.4, home.z + 1.3, Math.PI);
  await frames(6);
  await shot('6-room-b-roommates');
  await place(home.x + 4.6, 3.4, home.z - 2.95, Math.PI);
  await frames(6);
  await shot('7-room-a-suas-bed');

  // 4. Your bunk → recap → morning board.
  await f.evaluate(() => __cozy.setHour(23.2));
  await place(home.x + 5.4, 3.4, home.z + 0.6, Math.PI / 2);
  await frames(6);
  await f.waitForFunction(() => /침대/.test(document.querySelector('#prompt').textContent), null, { timeout: 300000, polling: 500 });
  await shot('8-your-bunk');
  await f.evaluate(() => __cozy.interact());
  // The first night: Tong's bedtime moment and the Hangul recap come before the bed.
  for (let i = 0; i < 40 && (await f.evaluate(() => __cozy.dlg.state.active)); i++) {
    await f.evaluate(() => { __cozy.dlg.finishTyping(); if (__cozy.dlg.state.choices.length) __cozy.dlg.choose(0); else __cozy.dlg.advance(); });
    await frames(2);
  }
  await f.waitForSelector('#bed-overlay:not(.hidden)', { state: 'attached' });
  await click('#bed-overlay .btn-primary');
  await f.waitForSelector('#morning-board:not(.hidden)', { state: 'attached', timeout: 60000 });
  await frames(3);
  await shot('9-morning-board');
  const day = await f.evaluate(() => __cozy.S.day);
  log(tag, 'morning day', day, 'errors', errors);
  assert.deepEqual(errors, []);
  await page.close();
}

try {
  await run({ width: 1280, height: 800, tag: 'laptop' });
  await run({ width: 390, height: 844, tag: 'phone', touch: true });
  log('PASS');
} finally {
  await browser.close();
}
