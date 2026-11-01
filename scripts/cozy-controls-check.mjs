// Focused new-control acceptance: no reload or inherited long-session claim.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const moduleName = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(path.isAbsolute(moduleName) ? pathToFileURL(moduleName).href : moduleName);
const output = process.env.COZY_EVIDENCE_DIR;
if (output) await mkdir(output, { recursive: true });
const ratio = Number(process.env.COZY_DIAGNOSTIC_PIXEL_RATIO || 1);
const report = { passed: false, scenario: 'new controls only', diagnosticPixelRatio: ratio, events: [], pageErrors: [], limits: 'Software browser; no reload, native-device, complete-story or uninterrupted long-session acceptance.' };
const started = Date.now();
async function check(name, action, timeout = 30000) {
  console.log(name); let timer;
  report.events.push({ name, phase: 'input', elapsedMs: Date.now() - started });
  try {
    const value = await Promise.race([action(), new Promise((_, reject) => { timer = setTimeout(() => reject(Error(`Operation bound exceeded: ${name}`)), timeout); })]);
    report.events.push({ name, phase: 'observed', elapsedMs: Date.now() - started });
    return value;
  } finally { clearTimeout(timer); }
}
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.COZY_CHROMIUM_EXECUTABLE || undefined, headless: true, args: ['--no-sandbox', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 800, height: 600 }, hasTouch: true, ...(output && process.env.COZY_RECORD_VIDEO === '1' ? { recordVideo: { dir: output, size: { width: 960, height: 640 } } } : {}) });
  if (ratio !== 1) await context.addInitScript((value) => Object.defineProperty(window, 'devicePixelRatio', { get: () => value }), ratio);
  const p = await context.newPage(); p.setDefaultTimeout(30000);
  p.on('pageerror', (e) => report.pageErrors.push(String(e)));
  await check('open actual cozy route', () => p.goto(process.env.COZY_URL || 'http://127.0.0.1:8420/cozy/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 }), 65000);
  await check('runtime ready', () => p.waitForFunction(() => window.__cozy, null, { timeout: 90000 }), 95000);
  await check('Start', () => p.locator('#start').click());
  await check('Create character', () => p.locator('#creator-start').click());
  await check('diagnostic paused-noon scene setup (not clock UI acceptance)', () => p.evaluate(() => { __cozy.S.speed = 0; __cozy.setHour(12); }));
  const initial = await p.evaluate(() => __cozy.cam.dist);
  await check('visible zoom in', async () => { await p.locator('#zoom-in').click(); await p.waitForFunction((distance) => __cozy.cam.dist < distance, initial); });
  const close = await p.evaluate(() => __cozy.cam.dist);
  await check('visible zoom out', async () => { await p.locator('#zoom-out').click(); await p.waitForFunction((distance) => __cozy.cam.dist > distance, close); });
  const wheelBefore = await p.evaluate(() => __cozy.cam.dist);
  await check('actual wheel zoom', async () => { await p.mouse.move(450, 320); await p.mouse.wheel(0, 300); await p.waitForFunction((distance) => __cozy.cam.dist > distance, wheelBefore); });
  let orbitDistance = 0;
  for (let i = 0; i < 4; i++) {
    const before = await p.evaluate(() => __cozy.cam.yaw);
    await check(`actual drag orbit ${i + 1}`, async () => { await p.mouse.move(340, 320); await p.mouse.down(); await p.mouse.move(640, 320, { steps: 5 }); await p.mouse.up(); await p.waitForFunction((yaw) => Math.abs(__cozy.cam.yaw - yaw) > 0.2, before); });
    const after = await p.evaluate(() => __cozy.cam.yaw);
    orbitDistance += Math.abs(Math.atan2(Math.sin(after - before), Math.cos(after - before)));
  }
  assert.ok(orbitDistance > Math.PI * 2, `Orbit covered ${orbitDistance} radians`);
  report.orbitRadians = orbitDistance;
  await check('responsive portrait resize', async () => { await p.setViewportSize({ width: 390, height: 844 }); await p.waitForFunction(() => Math.abs(__cozy.stage.width - 390) < 2 && Math.abs(__cozy.stage.height - 844) < 2); });
  const pinchBefore = await p.evaluate(() => __cozy.cam.dist);
  await check('actual two-finger pinch', async () => {
    const cdp = await context.newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 225, y: 450, id: 1 }, { x: 315, y: 450, id: 2 }] });
    for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 225 - i * 6, y: 450, id: 1 }, { x: 315 + i * 7, y: 450, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForFunction((distance) => __cozy.cam.dist < distance - 0.1, pinchBefore);
  });
  report.pinch = { before: pinchBefore, after: await p.evaluate(() => __cozy.cam.dist) };
  await check('restore desktop and camera', async () => { await p.setViewportSize({ width: 800, height: 600 }); await p.locator('#btn-tools').click(); await p.locator('#camera-reset').click(); });
  await check('run toggle', async () => { await p.locator('#run-toggle').click(); assert.equal(await p.locator('#run-toggle').getAttribute('aria-pressed'), 'true'); });
  const startPosition = await p.evaluate(() => __cozy.player.root.position.toArray());
  await check('actual keyboard run movement', async () => { await p.keyboard.down('w'); try { await p.waitForFunction((a) => Math.hypot(__cozy.player.root.position.x - a[0], __cozy.player.root.position.z - a[2]) > 0.35, startPosition); } finally { await p.keyboard.up('w'); } });
  await check('actual jump and landing', async () => { await p.locator('#jump-button').click(); await p.waitForFunction(() => !__cozy.traversal.grounded && __cozy.player.root.position.y > 0.05); await p.waitForFunction(() => __cozy.traversal.grounded && __cozy.player.root.position.y < 0.01); });
  report.rides = [];
  for (const mode of ['skateboard', 'scooter', 'bicycle']) {
    await check(`select rendered ${mode}`, async () => { await p.locator('#btn-tools').click(); await p.locator('#transport-select').selectOption(mode); await p.locator('#tools-close').click(); await p.waitForFunction((name) => __cozy.traversal.mode === name && __cozy.rides.models[name].visible, mode); });
    await check(`${mode} acceleration from actual input`, async () => { await p.keyboard.down('s'); try { await p.waitForFunction(() => Math.hypot(__cozy.traversal.vx, __cozy.traversal.vz) > 1.1); } finally { await p.keyboard.up('s'); } });
    const coast = await p.evaluate(() => Math.hypot(__cozy.traversal.vx, __cozy.traversal.vz));
    assert.ok(coast > 0, `${mode} has inertia after releasing input`);
    await check(`${mode} actual brake button`, async () => { await p.locator('#brake-button').hover(); await p.mouse.down(); try { await p.waitForFunction(() => __cozy.controls.braking); await p.waitForFunction(() => Math.hypot(__cozy.traversal.vx, __cozy.traversal.vz) < 0.1); } finally { await p.mouse.up(); } });
    report.rides.push({ mode, coastSpeed: coast, stoppedSpeed: await p.evaluate(() => Math.hypot(__cozy.traversal.vx, __cozy.traversal.vz)) });
  }
  assert.deepEqual(report.pageErrors, []);
  if (output && process.env.COZY_CAPTURE === '1') await check('separate final rendered-ride capture', () => p.screenshot({ path: path.join(output, 'controls-final-bicycle.png'), timeout: 45000 }), 50000);
  report.passed = true;
  if (output && process.env.COZY_RECORD_VIDEO === '1') report.video = await p.video().path();
  await check('close focused context', () => context.close(), 10000);
} catch (error) {
  report.failure = String(error.stack || error); process.exitCode = 1;
} finally {
  if (browser) try { await check('close owned browser', () => browser.close(), 10000); } catch (error) { report.closeFailure = String(error); process.exitCode = 1; }
  if (output) await writeFile(path.join(output, 'controls-check.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
