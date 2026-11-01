// Run against a served apps/client/public directory. No production API is used.
// PLAYWRIGHT_MODULE may point to an existing Playwright installation on the host.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const moduleName = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(path.isAbsolute(moduleName) ? pathToFileURL(moduleName).href : moduleName);
const url = process.env.COZY_URL || 'http://127.0.0.1:8420/cozy/index.html';
const evidence = process.env.COZY_EVIDENCE_DIR;
if (evidence) await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.COZY_CHROMIUM_EXECUTABLE || undefined, headless: true, args: ['--no-sandbox', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
const errors = [];
async function boot(page, resume = false) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__cozy, null, { timeout: 90000 });
  await page.locator(resume ? '#continue' : '#start').click();
  if (!resume) {
    await page.locator('#creator-start').click();
    // Day 1 starts at Incheon (cozy-day1-browser.mjs); these checks start in Hongdae.
    await page.waitForFunction(() => __cozy.S.started);
    await page.evaluate(() => __cozy.skipDayOne());
  }
  await page.evaluate(() => { __cozy.S.speed = 0; __cozy.renderer.setPixelRatio(0.65); });
}
async function shot(page, name) {
  if (evidence) await page.screenshot({ path: path.join(evidence, `${name}.png`), timeout: 120000 });
}
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 }, hasTouch: true });
  page.setDefaultTimeout(30000);
  page.on('pageerror', (e) => errors.push(String(e)));
  await boot(page);
  for (const city of ['seoul', 'tokyo', 'shanghai']) {
    if (city !== 'seoul') {
      // Reach the terminal with local transit, then use ordinary flight buttons.
      assert.equal(await page.evaluate(() => __cozy.travelTo('airport', { skipAnimation: true })), true);
      await page.locator('#prompt').waitFor({ state: 'visible' });
      await page.keyboard.press('e');
      await page.locator('#travel').waitFor({ state: 'visible' });
      await page.locator('#flight-cities button').filter({ hasText: city === 'tokyo' ? 'Tokyo' : 'Shanghai' }).click();
      await page.waitForFunction((id) => __cozy.S.city === id && !__cozy.transitioning, city);
    }
    const state = await page.evaluate(() => {
      const c = __cozy, p = c.player.root.position, b = c.bounds;
      return { city: c.S.city, position: p.toArray(), inBounds: p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ, roads: c.currentCity.roads.length };
    });
    assert.equal(state.city, city);
    assert.equal(state.inBounds, true);
    assert.ok(state.roads >= 3);
    await page.evaluate(() => __cozy.setHour(12));
    await page.waitForFunction(() => __cozy.G.night < 0.1);
    const day = await page.evaluate(() => __cozy.G.night);
    await shot(page, `${city}-day`);
    await page.evaluate(() => __cozy.setHour(22));
    await page.waitForFunction(() => __cozy.G.night > 0.7);
    const night = await page.evaluate(() => __cozy.G.night);
    assert.ok(night > day + 0.5, `${city}: day/night must visibly change`);
    await shot(page, `${city}-night`);
    if (city !== 'seoul') {
      const food = await page.evaluate(() => __cozy.currentCity.places.find(p => /food|market|ramen|yatai|snack/.test(`${p.id} ${p.en}`.toLowerCase())));
      assert.ok(food, `${city} needs an objective food stop`);
      await page.evaluate(async (id) => { await __cozy.travelTo(id, { skipAnimation: true }); }, food.id);
      await page.locator('#prompt').waitFor({ state: 'visible' });
      await page.keyboard.press('e');
      await page.locator('#city-activity').waitFor({ state: 'visible' });
      const correct = page.locator('#activity-choices button').filter({ hasText: food.phrase.en });
      const wrong = page.locator('#activity-choices button').filter({ hasNotText: food.phrase.en }).first();
      await wrong.click();
      assert.equal(await page.evaluate(() => __cozy.S.adventures[__cozy.S.city].step), 0, 'Wrong answers must not advance the errand');
      await correct.click();
      assert.equal(await page.evaluate(() => __cozy.S.adventures[__cozy.S.city].step), 1);
      await shot(page, `${city}-activity`);
      await page.locator('#activity-close').click();
    }
    results.push({ ...state, day, night });
    console.log(`Passed ${city}: travel, map bounds, day/night${city === 'seoul' ? '' : ', phrase activity'}`);
  }
  // Ordinary Continue must retain destination, player position and local progress.
  const before = await page.evaluate(() => { __cozy.save(); return { city: __cozy.S.city, position: __cozy.player.root.position.toArray(), step: __cozy.S.adventures.shanghai.step }; });
  await boot(page, true);
  const after = await page.evaluate(() => ({ city: __cozy.S.city, position: __cozy.player.root.position.toArray(), step: __cozy.S.adventures.shanghai.step }));
  assert.deepEqual(after, before);
  console.log('Passed reload/Continue: city, position and errand state retained');
  console.log('Checking return flight and retained remote progress');
  assert.equal(await page.evaluate(() => __cozy.changeCity('seoul', { skipAnimation: true })), true);
  assert.equal(await page.evaluate(() => __cozy.S.adventures.tokyo.step), 1);
  assert.equal(await page.evaluate(() => __cozy.S.adventures.shanghai.step), 1);
  // A real keyboard move in Seoul remains possible after a round trip.
  await page.evaluate(() => __cozy.travelTo('food', { skipAnimation: true }));
  const start = await page.evaluate(() => __cozy.player.root.position.toArray());
  await page.keyboard.down('s'); await page.waitForTimeout(700); await page.keyboard.up('s');
  const end = await page.evaluate(() => __cozy.player.root.position.toArray());
  assert.ok(Math.hypot(end[0] - start[0], end[2] - start[2]) > 0.1, 'Player must move after travelling');
  console.log('Passed round trip and post-flight keyboard movement');
  // Responsive touch-sized viewport in the existing touch-capable context.
  // This is not real-device or mobile-browser acceptance.
  const mobile = page;
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.evaluate(() => __cozy.travelTo('airport', { skipAnimation: true }));
  await mobile.locator('#prompt').waitFor({ state: 'visible' });
  await mobile.locator('#prompt').tap();
  await mobile.locator('#travel').waitFor({ state: 'visible' });
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await shot(mobile, 'mobile-flights');
  console.log('Passed touch interaction and mobile-width flight dialog');
  assert.deepEqual(errors, []);
  await page.keyboard.press('Escape');
  await page.keyboard.press('b');
  await page.locator('#book').waitFor({ state: 'visible' });
  await page.keyboard.press('b');
  await page.locator('#book').waitFor({ state: 'hidden' });
  const report = { passed: true, results, resume: after, movement: { start, end }, pageErrors: errors, limits: 'Software-rendered Chromium; responsive touch viewport, not real-device performance or complete Seoul story playthrough.' };
  if (evidence) await writeFile(path.join(evidence, 'browser-check.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
