#!/usr/bin/env node
/** Local browser proof. Supply PLAYWRIGHT_MODULE if Playwright is not installed locally. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SEOUL_BASE_URL || 'http://127.0.0.1:3011';
const out = path.resolve(process.env.SEOUL_EVIDENCE_DIR || path.join(root, 'artifacts/qa-runs/seoul-adventure'));
const compiled = mkdtempSync(path.join(tmpdir(), 'tong-seoul-browser-'));
mkdirSync(out, { recursive: true });
const compilation = spawnSync(process.execPath, [
  path.join(root, 'apps/client/node_modules/typescript/bin/tsc'),
  '--target', 'ES2022', '--module', 'commonjs', '--moduleResolution', 'node',
  '--strict', '--skipLibCheck', '--outDir', compiled,
  path.join(root, 'apps/client/lib/seoul-adventure/content.ts'),
], { cwd: path.join(root, 'apps/client'), stdio: 'inherit' });
assert.equal(compilation.status, 0, 'Korean content compiles');
const { LOCATIONS, MISSION } = require(path.join(compiled, 'content.js'));
const browser = await chromium.launch({ headless: true });
const results = [];
const errors = [];
const save = page => page.evaluate(() => JSON.parse(localStorage.getItem('tong.seoul-adventure.v1') || 'null'));
const choices = page => page.locator('[class*="_choices"] button');

async function checkViewport(page, label) {
  const overflow = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth > innerWidth,
    height: document.documentElement.scrollHeight > innerHeight,
    canvas: document.querySelector('canvas[data-testid="seoul-world"]')?.getBoundingClientRect().toJSON(),
  }));
  await page.screenshot({ path: path.join(out, `${label}.png`) });
  console.log(label, JSON.stringify(overflow));
  assert.equal(overflow.width, false, `${label}: no page-width overflow`);
  assert.equal(overflow.height, false, `${label}: no page-height overflow`);
  results.push({ check: label, passed: true, ...overflow });
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/game/seoul`, { waitUntil: 'networkidle' });
  await page.getByTestId('seoul-world').waitFor();
  await page.getByTestId('enter-seoul').click();
  await checkViewport(page, 'desktop-world');
  const marker = page.locator('[aria-label="Your live position"]');
  const initialPosition = await marker.getAttribute('style');
  await page.keyboard.down('d');
  await page.waitForFunction(before => document.querySelector('[aria-label="Your live position"]')?.getAttribute('style') !== before, initialPosition);
  await page.keyboard.up('d');
  results.push({ check: 'keyboard movement updates the real map position', passed: true });
  if (!process.argv.includes('--snapshots-only')) {
    for (const location of LOCATIONS.slice(0, 3)) {
      await page.getByRole('button', { name: `Walk to ${location.name}`, exact: true }).click();
      await page.getByTestId('nearby-poi').filter({ hasText: location.name }).waitFor({ timeout: 20000 });
      await page.getByTestId('nearby-poi').click();
      assert.equal(await page.getByTestId('start-hangout').isDisabled(), true, 'Practice gates a new hangout');
      await page.getByTestId('start-learn').click();
      const before = await save(page);
      await choices(page).nth((location.lesson.answer + 1) % location.lesson.choices.length).click();
      assert.equal((await save(page)).xp, before?.xp || 0, 'Wrong answer does not grant XP');
      await choices(page).nth(location.lesson.answer).click();
      assert.ok((await save(page)).learned.includes(location.id));
      await page.getByRole('button', { name: 'Continue your walk', exact: true }).click();
      await page.getByTestId('start-hangout').click();
      assert.equal(await page.getByRole('banner').count(), 0, 'Hangout hides exploration HUD');
      await page.locator('canvas[data-view="conversation"]').waitFor({ timeout: 15000 });
      await checkViewport(page, `hangout-${location.id}`);
      await choices(page).nth(location.hangoutReply.answer).click();
      assert.ok((await save(page)).hangouts.includes(location.id));
      await page.getByRole('button', { name: 'Back to the street', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Open journal', exact: true }).click();
    await page.getByTestId('open-mission').click();
    await choices(page).nth(MISSION.answer).click();
    const completed = await save(page);
    assert.equal(completed.missionComplete, true);
    assert.equal(completed.xp, 155);
    assert.equal(completed.sp, 30);
    assert.equal(completed.rp.haeun, 24);
    assert.deepEqual(completed.memories, ['seoul-first-evening']);
    await checkViewport(page, 'mission-memory');
    await page.reload({ waitUntil: 'networkidle' });
    assert.deepEqual(await save(page), completed, 'Completed progress survives reload');
    results.push({ check: 'three real lessons, hangouts, mission, and reload', passed: true, completed });
  }
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const phone = await mobile.newPage();
  phone.on('pageerror', error => errors.push(error.message));
  await phone.goto(`${base}/game/seoul`, { waitUntil: 'networkidle' });
  await phone.getByTestId('seoul-world').waitFor();
  await phone.getByTestId('enter-seoul').click();
  const touchStartPosition = await phone.locator('[aria-label="Your live position"]').getAttribute('style');
  const touchButton = await phone.getByRole('button', { name: 'Walk right', exact: true }).boundingBox();
  const touch = await mobile.newCDPSession(phone);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchButton.x + touchButton.width / 2, y: touchButton.y + touchButton.height / 2 }] });
  await phone.waitForFunction(before => document.querySelector('[aria-label="Your live position"]')?.getAttribute('style') !== before, touchStartPosition);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  results.push({ check: 'touch movement updates the real map position', passed: true });
  await checkViewport(phone, 'phone-portrait');
  await phone.setViewportSize({ width: 844, height: 390 });
  await checkViewport(phone, 'phone-landscape');
  const fallbackContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await fallbackContext.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (String(type).includes('webgl')) return null;
      return original.call(this, type, ...args);
    };
  });
  const fallback = await fallbackContext.newPage();
  await fallback.goto(`${base}/game/seoul`, { waitUntil: 'networkidle' });
  await fallback.getByRole('dialog', { name: '3D view unavailable' }).waitFor();
  await fallback.getByRole('button', { name: /Food Street/ }).click();
  await fallback.getByTestId('start-learn').click();
  await choices(fallback).nth(LOCATIONS[0].lesson.answer).click();
  await fallback.getByRole('button', { name: 'Close lesson' }).click();
  await fallback.getByRole('dialog', { name: '3D view unavailable' }).waitFor();
  results.push({ check: 'WebGL fallback remains playable and returns to locations', passed: true });
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  writeFileSync(path.join(out, 'results.json'), JSON.stringify({ base, results, errors }, null, 2));
  console.log(JSON.stringify({ passed: results.length, evidence: out, errors }));
} catch (error) {
  writeFileSync(path.join(out, 'results.json'), JSON.stringify({ base, results, errors, failure: String(error) }, null, 2));
  throw error;
} finally {
  await browser.close();
  rmSync(compiled, { recursive: true, force: true });
}
