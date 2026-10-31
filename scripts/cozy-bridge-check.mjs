// End-to-end check of the cozy ↔ Tong bridge (#378) on the real /cozy host page.
// Needs a running Next server (COZY_HOST, default http://127.0.0.1:3001).
// PLAYWRIGHT_MODULE may point to an existing Playwright install; COZY_CHROMIUM_EXECUTABLE
// to a Chromium binary; COZY_EVIDENCE_DIR receives screenshots and a JSON report.
// COZY_VIEWPORTS=desktop,portrait,landscape picks the device runs.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const moduleName = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(path.isAbsolute(moduleName) ? pathToFileURL(moduleName).href : moduleName);
const host = process.env.COZY_HOST || 'http://127.0.0.1:3001';
const evidence = process.env.COZY_EVIDENCE_DIR;
if (evidence) await mkdir(evidence, { recursive: true });
const DEVICES = {
  desktop: { viewport: { width: 1280, height: 800 } },
  portrait: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  landscape: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true },
};
const runs = (process.env.COZY_VIEWPORTS || 'desktop,portrait,landscape').split(',');
const browser = await chromium.launch({
  executablePath: process.env.COZY_CHROMIUM_EXECUTABLE || undefined,
  headless: true,
  args: ['--no-sandbox', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const report = [];

// A pre-bridge (v3) cozy save with hearts and phrases to import.
const LEGACY = {
  version: 3, city: 'seoul', name: '민지', hour: 12, day: 2, aff: 3, jinAff: 1,
  words: ['떡볶이'], phrases: [['주세요', { rom: 'juseyo', en: 'please (give me)' }], ['우유', { rom: 'uyu', en: 'milk' }]],
  visited: [], quests: { store: true }, adventures: {},
};

const shared = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('tong-game') || '{}'));
const gameFrame = (page) => page.frames().find((f) => f.url().includes('/cozy/index.html'));

async function openHost(page) {
  await page.goto(`${host}/cozy`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  let frame;
  await page.waitForFunction(() => document.querySelector('iframe.cozy-frame'), null, { timeout: 60000 });
  for (let i = 0; i < 240 && !(frame = gameFrame(page)); i++) await page.waitForTimeout(250);
  await frame.waitForFunction(() => window.__cozy?.bridge?.connected, null, { timeout: 120000 });
  await frame.evaluate(() => __cozy.renderer.setPixelRatio(0.3));
  return frame;
}

async function shot(page, name) {
  // The software compositor can hand back a frame from before the overlay; let it settle.
  await page.waitForTimeout(2500);
  if (!evidence) return;
  // Evidence only: a slow software-rendered capture must not fail the behaviour checks.
  try {
    await page.screenshot({ path: path.join(evidence, `${name}.png`), timeout: 150000 });
  } catch (err) {
    console.log(`screenshot ${name} skipped: ${String(err).split('\n')[0]}`);
  }
}

/**
 * Drag each falling piece onto its slot until the word is built. The drags run in the page
 * (real pointer events on the real piece and slot): CDP round trips are too slow on this
 * software-rendered VM while pieces fall in real time.
 */
async function solveBlockCrush(page, pieces) {
  const outcome = await page.evaluate(async (wanted) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const centre = (el) => { const r = el.getBoundingClientRect(); return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }; };
    for (const [slot, piece] of wanted) {
      for (let i = 0; ; i++) {
        const target = document.querySelector(`[data-slot="${slot}"]`);
        if (!target) return `slot ${slot} gone`;
        if (target.textContent === piece) break;
        if (i > 600) return `piece ${piece} never arrived`;
        const src = [...document.querySelectorAll(`[data-piece="${piece}"]`)].find((el) => el.getBoundingClientRect().height > 0);
        if (src) {
          src.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, isPrimary: true, ...centre(src) }));
          document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, isPrimary: true, ...centre(target) }));
        }
        await sleep(100);
      }
    }
    return 'built';
  }, pieces);
  return outcome;
}

async function startScene(frame, node) {
  await frame.evaluate((n) => { __cozy.S.speed = 0; __cozy.dlg.start(n); }, node);
}

// Software rendering runs a few frames a second, so skip the typewriter like a player tapping the box.
const skipTyping = (frame) => frame.evaluate(() => __cozy.dlg.state.typing && __cozy.dlg.finishTyping());

async function untilNode(frame, ids) {
  for (let i = 0; i < 240; i++) {
    const id = await frame.evaluate(() => { const d = __cozy.dlg.state; if (d.typing) __cozy.dlg.finishTyping(); return d.id; });
    if (ids.includes(id)) return id;
    await frame.page().waitForTimeout(250);
  }
  throw new Error(`dialogue never reached ${ids}`);
}

async function clickChoice(frame, text) {
  await skipTyping(frame);
  const choice = frame.locator('#choices .choice').filter({ hasText: text }).first();
  await choice.waitFor({ state: 'visible', timeout: 60000 });
  await choice.click();
}

try {
  for (const name of runs) {
    const context = await browser.newContext({ ...DEVICES[name] });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.setDefaultTimeout(60000);
    const r = { device: name };

    // Fresh origin with a legacy cozy save.
    await page.goto(`${host}/cozy/style.css`);
    await page.evaluate((save) => { localStorage.clear(); localStorage.setItem('tong-cozy-seoul-v2', JSON.stringify(save)); }, LEGACY);

    let frame = await openHost(page);
    // A new relationship starts at 10 (defaultRelationship); each legacy heart adds 5.
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('tong-game') || '{}').relationships?.haeun?.affinity === 25, null, { timeout: 30000 });
    let s = await shared(page);
    assert.equal(s.relationships.jin.affinity, 15, 'Jin hearts migrate');
    assert.equal(s.itemMastery['우유'].masteryLevel, 'new', 'met phrases migrate as new items');
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('tong-cozy-seoul-v2'))).sharedImport, true);
    r.migrated = { haeun: s.relationships.haeun.affinity, jin: s.relationships.jin.affinity };

    // Reload: no second import.
    frame = await openHost(page);
    await page.waitForTimeout(1500);
    s = await shared(page);
    assert.equal(s.relationships.haeun.affinity, 25, 'migration runs once');

    await frame.locator('#continue').click();
    await frame.waitForFunction(() => __cozy.S.started);
    const hud = await frame.evaluate(() => document.querySelector('#stage-haeun').textContent);
    assert.match(hud, /acquaintances/, 'HUD shows the shared relationship stage');
    assert.match(await frame.evaluate(() => document.querySelector('#stage-jin').textContent), /strangers/);

    // Convenience store: the clerk's smudged label is a shared block-crush on 우유.
    await startScene(frame, 'cashier_hi');
    await clickChoice(frame, '바나나우유');
    await untilNode(frame, ['cashier_label']);
    await page.locator('.cozy-exercise-frame').waitFor({ state: 'visible', timeout: 60000 });
    assert.equal(await page.locator('iframe.cozy-frame').getAttribute('inert'), '', 'game is inert under the exercise');
    assert.equal(await frame.evaluate(() => __cozy.bridgeBusy), true, 'game waits while the exercise is open');
    // The whole playfield must fit on screen without scrolling (phones in landscape too).
    await page.waitForTimeout(600);
    const fit = await page.evaluate(() => {
      // At ~1 fps here the modal's 40px slide-up entrance is still running; measure its end state.
      document.querySelector('.exercise-modal-content').getAnimations().forEach((a) => a.finish());
      const card = document.querySelector('.exercise-modal-content > .exercise-card').getBoundingClientRect();
      const slots = [...document.querySelectorAll('[data-slot]')].map((e) => e.getBoundingClientRect());
      return { bottom: card.bottom, top: card.top, h: innerHeight, slotsVisible: slots.length > 0 && slots.every((r) => r.top >= 0 && r.bottom <= innerHeight), zoom: document.querySelector('.exercise-modal-content > .exercise-card').style.zoom || '1' };
    });
    assert.ok(fit.top >= 0 && fit.bottom <= fit.h + 1 && fit.slotsVisible, `exercise fits the viewport: ${JSON.stringify(fit)}`);
    r.fit = fit;
    // Pieces fall in real time (a missed piece costs a life), so build first, then inspect
    // while the intro completion card waits for a tap.
    // On this software-rendered VM the page can drop to ~1 fps and pieces may fall past
    // before they are placed, so either outcome is accepted; the record must match it.
    const xpBefore = s.xp ?? 0;
    const hourBefore = await frame.evaluate(() => { __cozy.S.speed = 1; return __cozy.S.hour; });
    const built = await solveBlockCrush(page, [['0:C', 'ㅇ'], ['0:V', 'ㅜ'], ['1:C', 'ㅇ'], ['1:V', 'ㅠ']]);
    assert.equal(await frame.evaluate(() => __cozy.S.hour), hourBefore, 'world clock holds during the exercise');
    await frame.evaluate(() => { __cozy.S.speed = 0; });
    if (built === 'built') {
      await page.locator('.bc-overlay').waitFor({ state: 'visible', timeout: 30000 });
      await shot(page, `${name}-block-crush-done`);
      await page.locator('.bc-overlay').click();
    }
    await page.locator('.cozy-exercise-frame').waitFor({ state: 'detached', timeout: 60000 });
    const won = built === 'built';
    await untilNode(frame, [won ? 'cashier_label_ok' : 'cashier_label_close']);
    s = await shared(page);
    assert.equal(s.xp, xpBefore + (won ? 10 : 2), 'the exercise result awards XP in the shared store');
    for (const item of ['우', '유', '우유']) assert.equal(s.itemMastery[item][won ? 'correct' : 'incorrect'], 1, `${item} recorded`);
    r.blockCrushOutcome = won ? 'built' : `not built (${built})`;
    assert.equal(await page.locator('iframe.cozy-frame').getAttribute('inert'), null);
    // Finish the purchase; the hangout counts in the shared store.
    await frame.evaluate(() => __cozy.dlg.go('cashier_bye'));
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('tong-game')).locationHangoutCounts['seoul:convenience_store'] === 1);
    await frame.evaluate(() => __cozy.dlg.end());
    r.blockCrush = { xp: s.xp, items: ['우', '유', '우유'].map((i) => [i, s.itemMastery[i].masteryLevel]) };

    // Pojangmacha: order with a shared sentence-builder; dismissing falls back to the menu.
    await frame.evaluate(() => { __cozy.setHour(20); __cozy.S.words.add('떡볶이'); });
    await startScene(frame, 'order_build');
    await skipTyping(frame);
    await page.locator('.cozy-exercise-frame').waitFor({ state: 'visible', timeout: 60000 });
    const target = await frame.evaluate(() => __cozy.S.suggest.ko);
    await shot(page, `${name}-sentence-builder`);
    for (const tile of [target, '주세요']) await page.locator('.sentence-builder__tile:not(.sentence-builder__tile--answer)').filter({ hasText: new RegExp(`^${tile}$`) }).first().click();
    await page.getByRole('button', { name: /check/i }).click();
    await page.locator('.cozy-exercise-frame').waitFor({ state: 'detached', timeout: 30000 });
    await untilNode(frame, ['order_right', 'order_praise', 'spice_q']);
    s = await shared(page);
    assert.equal(s.itemMastery['주세요'].category, 'grammar');
    assert.equal(s.itemMastery['주세요'].correct, 1);
    assert.equal(s.itemMastery[target].correct, 1);
    await frame.evaluate(() => __cozy.dlg.end());

    await startScene(frame, 'order_build');
    await skipTyping(frame);
    await page.locator('.exercise-dismiss-btn').click();
    await untilNode(frame, ['order']);
    assert.equal(await frame.evaluate(() => __cozy.bridgeBusy), false);
    await frame.evaluate(() => __cozy.dlg.end());

    // Affinity from a story choice reaches the shared store.
    const before = (await shared(page)).relationships.haeun.affinity;
    await frame.evaluate(() => __cozy.dlg.start('greet'));
    await clickChoice(frame, '하은');
    await page.waitForFunction((b) => JSON.parse(localStorage.getItem('tong-game')).relationships.haeun.affinity === b + 5, before);
    await frame.evaluate(() => __cozy.dlg.end());
    // Replaying the same beat (e.g. after restarting the cozy world) earns nothing more.
    await frame.evaluate(() => __cozy.dlg.start('greet'));
    await clickChoice(frame, '하은');
    await page.waitForTimeout(2000);
    assert.equal((await shared(page)).relationships.haeun.affinity, before + 5, 'a story beat is awarded once');
    assert.equal((await shared(page)).relationships.haeun.interactionCount, 0, '/game still plays its first meeting');
    await frame.evaluate(() => __cozy.dlg.end());

    // Reload: progress persists, the HUD reads it back.
    frame = await openHost(page);
    s = await shared(page);
    assert.equal(s.relationships.haeun.affinity, before + 5);
    await frame.locator('#continue').click();
    await frame.waitForFunction(() => __cozy.S.started);
    assert.match(await frame.evaluate(() => document.querySelector('#stage-haeun').textContent), /acquaintances/);
    await frame.evaluate(() => __cozy.renderer.setPixelRatio(0.3));
    await shot(page, `${name}-after-reload`);
    r.final = { xp: s.xp, haeun: s.relationships.haeun.affinity, hangouts: s.locationHangoutCounts };
    assert.deepEqual(errors, [], `page errors: ${errors.join('; ')}`);
    report.push(r);
    console.log(`Passed ${name}:`, JSON.stringify(r));
    await context.close();
  }
} finally {
  if (evidence) await writeFile(path.join(evidence, 'bridge-check.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
