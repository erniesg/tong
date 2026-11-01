// Browser proof of Day 1 (docs/seoul-day1.md) from a fresh save: pick an origin → Incheon arrivals
// (Tong appears) → walk to the 출구 doors → walk to the departure board → the station decision →
// Hongdae → walk into the studio (arrival + orientation) → your locker (H0) → registration card →
// the dorm → your bunk (Tong's bedtime moment, the Hangul recap) → day two.
//   laptop: International-School Kid, taxi on the family card (early: Haeun alone).
//   phone:  Creator, the express by mistake, asks the way at Seoul Station (on time: the cohort).
// Exercises the Tong host opens are closed, as a player skipping them would; scenes then offer a
// plain choice. Start the dev server first (cd apps/client && npx next dev -p 3021).
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const moduleName = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(path.isAbsolute(moduleName) ? pathToFileURL(moduleName).href : moduleName);
const OUT = process.env.COZY_EVIDENCE_DIR || 'artifacts/cozy-day1';
const URL = process.env.COZY_HOST_URL || 'http://127.0.0.1:3021/cozy';
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const log = (...a) => console.log(...a);
const X0 = -400; // cities/incheon.js

const RUNS = {
  laptop: {
    viewport: { width: 1280, height: 800 }, origin: 'intl_kid', arrival: 'd1_early',
    plan: { 'seoul.d1.station:s_where': /taxi/i, 'seoul.d1.station:s_taxi_chat': /조금/ },
  },
  phone: {
    viewport: { width: 390, height: 844 }, touch: true, origin: 'creator', arrival: 'd1_ontime',
    plan: { 'seoul.d1.station:s_pick': /13:30/, 'seoul.d1.station:s_ask_pick': /실례합니다/, 'seoul.d1.arrive:r_room': /새로 온 애예요/ },
  },
};

async function run(tag) {
  const cfg = RUNS[tag];
  const page = await browser.newPage({ viewport: cfg.viewport, hasTouch: !!cfg.touch, isMobile: !!cfg.touch });
  page.setDefaultTimeout(90000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 300000 });
  const el = await page.waitForSelector('iframe.cozy-frame', { timeout: 300000 });
  const f = await el.contentFrame();
  await f.waitForFunction(() => window.__cozy && !document.querySelector('#start').disabled, null, { timeout: 300000 });
  const frames = async (n) => {
    const start = await f.evaluate(() => window.__fr);
    await f.waitForFunction((t) => window.__fr >= t, start + n, { timeout: 600000, polling: 500 });
  };
  const shot = (name) => page.screenshot({ path: `${OUT}/${tag}-${name}.png`, timeout: 600000 });
  const flags = () => f.evaluate(() => __cozy.S.story.flags);
  const today = () => f.evaluate(() => ({ count: document.querySelector('#quest-count')?.textContent, items: [...document.querySelectorAll('.quest-list li')].map((li) => `${li.className === 'step-done' ? '✓' : '·'} ${li.textContent}`) }));
  const busy = () => f.evaluate(() => __cozy.dlg.state.active || __cozy.bridgeBusy);
  const seen = new Set();
  // Click through dialogue: the run's plan picks some replies, otherwise the first. Shots on key beats.
  const talkThrough = async (shots = {}) => {
    for (let i = 0; i < 200 && (await busy()); i++) {
      if (await page.evaluate(() => !!document.querySelector('.exercise-dismiss-btn, .cozy-practice__close'))) {
        await page.evaluate(() => document.querySelector('.exercise-dismiss-btn, .cozy-practice__close').click());
        log(tag, 'closed an exercise');
      } else {
        const st = await f.evaluate(() => ({ id: __cozy.dlg.state.id, choices: (__cozy.dlg.state.choices ?? []).map((c) => `${c.ko ?? ''} ${c.en ?? ''}`) }));
        if (st.id && shots[st.id] && !seen.has(st.id)) { seen.add(st.id); await frames(3); await shot(shots[st.id]); }
        const want = cfg.plan[st.id];
        const pick = want ? Math.max(0, st.choices.findIndex((c) => want.test(c))) : 0;
        await f.evaluate((pick) => { if (!__cozy.dlg.state.active) return; __cozy.dlg.finishTyping(); if (__cozy.dlg.state.choices.length) __cozy.dlg.choose(pick); else __cozy.dlg.advance(); }, pick);
      }
      await frames(3);
    }
  };
  const walk = async (x, z, label, tolerance = 0.45, shots) => {
    await f.evaluate(() => document.getElementById('scene').focus());
    await page.keyboard.down('w');
    let best = Infinity, still = 0;
    for (let i = 0; i < 500; i++) {
      if (await busy()) {
        await page.keyboard.up('w');
        log(tag, `on the way to ${label}: ${await f.evaluate(() => __cozy.dlg.state.id)}`);
        await talkThrough(shots);
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
      if (d < best - 0.05) { best = d; still = 0; } else if (++still > 40) { await page.keyboard.up('w'); await shot(`stuck-${label.replace(/\W+/g, '-')}`); throw new Error(`stuck walking to ${label} (${d.toFixed(2)} m away)`); }
      await frames(2);
    }
    await page.keyboard.up('w');
    await f.evaluate(() => { __cozy.traversal.vx = __cozy.traversal.vz = 0; });
  };
  const interactWith = async (re, label) => {
    await frames(4);
    await f.waitForFunction((src) => new RegExp(src).test(document.querySelector('#prompt').textContent), re.source, { timeout: 120000, polling: 500 })
      .catch(async (e) => { log(tag, 'no prompt for', label, await f.evaluate(() => document.querySelector('#prompt').textContent)); await shot(`no-prompt-${label}`); throw e; });
    await f.evaluate(() => __cozy.interact());
    await f.waitForFunction(() => __cozy.dlg.state.active, null, { polling: 500 });
  };

  await f.evaluate(() => { __cozy.renderer.setPixelRatio(0.5); window.__fr = 0; const k = () => { window.__fr++; requestAnimationFrame(k); }; k(); });
  // 0. Creator: pick the origin.
  await f.evaluate(() => document.querySelector('#start').click());
  // Day 1 is the female route (girls' dorm, 언니): play as a girl.
  await f.evaluate((o) => { document.querySelector('#origin').value = o; document.querySelector('[data-gender="f"]').click(); }, cfg.origin);
  await shot('0-creator-origin');
  await f.evaluate(() => document.querySelector('#creator-start').click());

  // 1. Incheon arrivals: the airport scene plays by itself.
  await f.waitForFunction(() => __cozy.dlg.state.active, null, { timeout: 120000, polling: 500 });
  assert.equal(await f.evaluate(() => __cozy.S.city), 'incheon');
  await talkThrough({ 'seoul.d1.airport:a_tong': '1-tong-appears', 'seoul.d1.airport:a_choi': '2-kakao-3pm' });
  await f.evaluate(() => { __cozy.S.speed = 0; });
  const t0 = await today();
  log(tag, 'incheon', t0, await f.evaluate(() => __cozy.tongHint()));
  assert.equal(t0.count, '0/7');
  assert.ok(await f.evaluate(() => document.querySelector('.panel.quest').open), 'Today list is open on day one');
  await shot('3-arrivals-hall');

  // 2. Walk to the 출구 doors; the sign exercise opens the way out.
  await walk(X0 - 4.2, 4, 'exit doors', 0.5);
  await interactWith(/출구/, 'exit');
  await talkThrough({ 'seoul.d1.exit:e_out': '4-exit-signs' });
  assert.ok((await flags()).d1_exit_done, 'exit done');
  await walk(X0 + 1, 4, 'through the doors', 0.5);
  await walk(X0 + 8.6, 0, 'departure board', 0.5);
  await shot('5-departure-board');
  await interactWith(/전광판/, 'board');
  await talkThrough({ 'seoul.d1.station:s_where': '6-station-decision', 'seoul.d1.station:s_prep': '7-tong-ride-in', 'seoul.d1.station:s_ask': '7-seoul-station' });
  await f.waitForFunction(() => __cozy.S.city === 'seoul' && !__cozy.transitioning, null, { timeout: 120000, polling: 500 });
  await frames(20);
  const f1 = await flags();
  log(tag, 'hongdae', { hour: await f.evaluate(() => __cozy.S.hour.toFixed(2)), early: f1.d1_early, ontime: f1.d1_ontime, late: f1.d1_late, toll: await f.evaluate(() => __cozy.S.story.tally.toll ?? 0) }, await f.evaluate(() => __cozy.tongHint()));
  assert.ok(f1[cfg.arrival], `arrival ${cfg.arrival}`);
  await shot('8-hongdae');

  // 3. The studio: arrival, then orientation, then your locker (H0).
  await f.evaluate(() => __cozy.travelTo('studio', { skipAnimation: true }));
  await frames(6);
  await walk(-8.4, -34.2, 'studio floor', 0.45, { 'seoul.d1.arrive:r_early_who': '9-early-haeun', 'seoul.d1.arrive:r_minji': '9-ontime-cohort', 'seoul.d1.orientation:o_rules': '10-orientation', 'seoul.d1.orientation:o_overheard': '11-sua-gossip' });
  await f.waitForFunction(() => __cozy.S.story.flags.orientation_done || __cozy.dlg.state.active, null, { timeout: 120000, polling: 500 });
  await talkThrough({ 'seoul.d1.orientation:o_rules': '10-orientation', 'seoul.d1.orientation:o_overheard': '11-sua-gossip' });
  assert.ok((await flags()).orientation_done, 'orientation done');
  await walk(-13.0, -32.4, 'locker', 0.6);
  await interactWith(/사물함/, 'locker');
  await talkThrough();
  assert.ok((await flags()).h0_done, 'H0 done');
  await f.waitForSelector('#seoul-eval [data-action="profile-save"]', { timeout: 120000 });
  await f.evaluate(() => document.querySelector('#seoul-eval [data-action="profile-save"]').click());
  await f.waitForFunction(() => !document.querySelector('.overlay:not(.hidden)'), null, { timeout: 120000, polling: 500 });
  await frames(40);
  const t1 = await today();
  log(tag, 'after lockers + card', t1);
  assert.equal(t1.count, '5/7');
  await shot('12-today-dorm-next');

  // 4. The dorm, up the stairs: the arrival scene with the evening choice.
  await f.evaluate(() => { __cozy.setHour(19.5); __cozy.S.speed = 0; });
  await f.evaluate(() => __cozy.travelTo('seoul-home', { skipAnimation: true }));
  await frames(6);
  const route = await f.evaluate(() => {
    const b = __cozy.apartmentDiagnostics.find((b) => b.id === 'seoul-home');
    const end = b.route.findIndex((p) => p.kind === 'home-entry' && p.y > 3);
    return b.route.slice(1, end + 1).filter((p) => !['shared-lobby', 'concierge-approach'].includes(p.kind));
  });
  for (const p of route) {
    if ((await flags()).dorm_arrived) break;
    await walk(p.x, p.z, p.kind, 0.35, { 'haeun.h0.dorm:d0_evening': '13-dorm-evening' });
  }
  if (!(await flags()).dorm_arrived) {
    await f.waitForFunction(() => __cozy.dlg.state.active, null, { timeout: 120000, polling: 500 });
    await talkThrough({ 'haeun.h0.dorm:d0_evening': '13-dorm-evening' });
  }
  assert.ok((await flags()).dorm_arrived, 'arrived at the dorm');

  // 5. Your bunk after 20:00: Tong's bedtime moment, the Hangul recap, then sleep.
  const home = await f.evaluate(() => { const b = __cozy.apartmentDiagnostics.find((b) => b.id === 'seoul-home'); return { x: (b.bounds.minX + b.bounds.maxX) / 2, z: (b.bounds.minZ + b.bounds.maxZ) / 2 }; });
  await f.evaluate(() => { __cozy.setHour(22.5); __cozy.S.speed = 0; });
  for (const [u, v, label] of [[3, 3.25, 'corridor'], [3, 0.95, 'room B door'], [5.4, 0.95, 'room B'], [5.4, 0.6, 'bedside']]) await walk(home.x + u, home.z + v, label, 0.35);
  await interactWith(/침대/, 'bed');
  await talkThrough({ 'seoul.d1.bedtime:b_open': '14-tong-bedtime', hangul_recap: '15-hangul-recap' });
  const recap = await f.evaluate(() => [...document.querySelectorAll('.quest-list li.hangul-count')].map((li) => li.textContent)[0]);
  log(tag, 'hangul', recap);
  assert.match(recap ?? '', /^한글 1\d\/24$/);
  await f.waitForSelector('#bed-overlay:not(.hidden)', { state: 'attached' });
  await f.evaluate(() => document.querySelector('#bed-overlay .btn-primary').click());
  await f.waitForSelector('#morning-board:not(.hidden)', { state: 'attached', timeout: 60000 });
  await f.evaluate(() => document.querySelector('#morning-board .btn-primary').click());
  await frames(40);
  const t3 = await today();
  log(tag, 'day two', await f.evaluate(() => __cozy.S.day), t3, await f.evaluate(() => __cozy.tongHint()), 'errors', errors);
  assert.equal(await f.evaluate(() => __cozy.S.day), 2);
  assert.ok(!t3.items.some((i) => /Sleep in your bunk/.test(i)), 'arrival list is replaced on day two');
  await shot('16-day-two');
  assert.deepEqual(errors, []);
  await page.close();
}

try {
  const only = process.env.COZY_ONLY;
  for (const tag of Object.keys(RUNS)) if (!only || only === tag) await run(tag);
  log('PASS');
} finally {
  await browser.close();
}
