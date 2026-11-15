// Browser play-through of the rebuilt first day (docs/seoul-first-day.md) from a fresh save:
// the airport train (Tong, the grandmother, 아 and 이) → Hongdae (the poster, the 붕어빵 cart) →
//   haeun: straight up to Onsae: lobby → Ha-eun alone in Room B (count her in) → orientation → locker
//   jin:   the tent first (jin.j0) → Onsae: lobby → practice lets out in the corridor → orientation → locker
// Tong's small games are played by clicking the right pieces. Places are reached by jumping to their
// marks (walking the building is covered by scripts/cozy-onsae.test.mjs). Serve the game statically:
//   python3 -m http.server 3032 --directory apps/client/public
//   PLAYWRIGHT_MODULE=/abs/path/playwright/index.mjs node scripts/cozy-day1-browser.mjs <haeun|jin> <outdir> [desktop|phone] [athlete|creator|intl_kid]
// On a busy host one run takes 10–20 minutes; run one at a time.
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const [PATH = 'haeun', OUT = 'artifacts/cozy-day1', SIZE = 'desktop', ORIGIN = 'athlete'] = process.argv.slice(2);
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const phone = SIZE === 'phone';
const page = await browser.newPage({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: phone, isMobile: phone });
page.setDefaultTimeout(180000);
const errors = [];
page.on('pageerror', (e) => { errors.push(String(e)); console.log('PAGEERROR', String(e).slice(0, 300)); });
page.on('console', (m) => { if (m.type() === 'error') console.log('console.error', m.text().slice(0, 200)); });
await page.goto(process.env.COZY_URL || 'http://127.0.0.1:3032/cozy/index.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__cozy && !document.querySelector('#start').disabled);
let n = 0;
const shot = async (name) => { await page.waitForTimeout(2200); await page.screenshot({ path: `${OUT}/${String(++n).padStart(2, '0')}-${name}.png` }); console.log('shot', name); };
const st = () => page.evaluate(() => ({ id: __cozy.dlg.state.id, active: __cozy.dlg.state.active, typing: __cozy.dlg.state.typing, choices: (__cozy.dlg.state.choices ?? []).map((c) => c.ko), play: !!document.querySelector('.play'), busy: __cozy.bridgeBusy }));
// Play one of Tong's small games properly, by clicking the right things.
async function playGame() {
  const title = await page.textContent('.play-title b');
  for (let guard = 0; guard < 40; guard++) {
    if (await page.$('.play-next:not(.hidden)')) break;
    const did = await page.evaluate(() => {
      const q = (s) => [...document.querySelectorAll(s)];
      const empty = q('.play-slot:not(.given):not(.filled)');
      if (empty.length || q('.play-tile').length) {
        // compose / missing: the test knows the answer from the request on window (set below)
        const want = window.__want.shift();
        const tile = q('.play-tile:not(.used)').find((t) => t.firstChild.textContent === want);
        tile?.click(); return `tile ${want}`;
      }
      if (q('.play-cardopt').length) { const c = q('.play-cardopt').find((c) => c.firstChild.textContent === window.__want[0]); c.click(); return 'card'; }
      if (q('.play-pair').length) {
        const b = q('.play-pair.block:not(:disabled)')[0]; if (!b) return 'none';
        const pair = window.__want.find((p) => p.startsWith(b.dataset.key + ':'));
        b.click(); q('.play-pair.sound').find((s) => s.dataset.key === pair.split(':')[1]).click(); return 'pair';
      }
      if (q('.play-chip').length) {
        if (window.__want.length) { const w = window.__want.shift(); q('.play-tray .play-chip:not(.used)').find((c) => c.firstChild.textContent === w).click(); return `chip ${w}`; }
        document.querySelector('.play-say').click(); return 'say';
      }
      return 'none';
    });
    await page.waitForTimeout(350);
    if (did === 'none') break;
  }
  await shot(`game-${title.replace(/\W+/g, '-').slice(0, 24)}`);
  await page.click('.play-next');
}
const WANT = {
  'Build 아.': ['ㅇ', 'ㅏ'], 'Tap the one you hear.': ['이'], 'One piece is scraped off. Which?': ['ㅜ'], 'Which card is hers?': ['다온'],
  'Match each block to its sound.': ['아:a', '이:i', '수:su', '다:da', '온:on'], 'Count her in: five, six, seven, eight.': ['다섯', '여섯', '일곱', '여덟'],
};
// Talk through whatever is playing. plan: beat id → regex for the reply; shots: beat id → name.
async function talk(plan = {}, shots = {}) {
  const seen = new Set();
  let scene = null;
  for (let i = 0; i < 400; i++) {
    const s = await st();
    // One call talks through one scene (two when the second is orientation, which follows by itself).
    const sc = s.id?.split(':')[0];
    if (sc && !scene) scene = sc; else if (sc && sc !== scene && !/orientation/.test(sc)) return;
    if (s.play) {
      const title = await page.textContent('.play-title b');
      const want = WANT[title] ?? (title.startsWith('Build your') ? null : null);
      if (!want) {
        // the self-introduction: pieces in order come from the scene
        await page.evaluate(() => { window.__want = ['안녕하세요.', [...document.querySelectorAll('.play-chip')].map((c) => c.firstChild.textContent).find((t) => t.startsWith('저는') && t.endsWith('입니다.')), '잘 부탁드립니다.']; });
      } else await page.evaluate((w) => { window.__want = [...w]; }, want);
      await playGame();
      continue;
    }
    if (!s.active && !s.busy) { await page.waitForTimeout(900); const again = await st(); if (!again.active && !again.busy && !again.play) return; continue; }
    const sk = s.id && Object.keys(shots).find((k) => s.id.endsWith(':' + k));
    if (sk && !seen.has(sk)) { seen.add(sk); await page.evaluate(() => __cozy.dlg.finishTyping()); await shot(shots[sk]); }
    const key = Object.keys(plan).find((k) => s.id?.endsWith(':' + k));
    await page.evaluate((re) => { const d = __cozy.dlg; if (!d.state.active) return; d.finishTyping(); if (d.state.choices.length) { const i = re ? Math.max(0, d.state.choices.findIndex((c) => new RegExp(re).test(`${c.ko} ${c.en ?? ''}`))) : 0; d.choose(i); } else d.advance(); }, key ? plan[key] : null);
    await page.waitForTimeout(450);
  }
}
const tp = (at, yaw) => page.evaluate(({ at, yaw }) => { const c = __cozy; c.player.root.position.set(at[0], at[1] ?? c.heightAt(at[0], at[2], 50), at[2]); if (yaw != null) { c.cam.yaw = yaw; c.cam.snap = true; } c.traversal.vx = c.traversal.vz = 0; }, { at, yaw });
const spot = (name) => page.evaluate((n) => __cozy.ONS[n] ?? __cozy.STREET[n], name);
const flags = () => page.evaluate(() => __cozy.S.story.flags);
const waitTalk = () => page.waitForFunction(() => __cozy.dlg.state.active, null, { timeout: 240000 });
const interact = async (re) => { await page.waitForFunction((src) => new RegExp(src).test(document.querySelector('#prompt').textContent), re, { timeout: 30000 }); await page.evaluate(() => __cozy.interact()); await waitTalk(); };

await page.evaluate(() => document.querySelector('#start').click());
await page.evaluate((o) => { document.querySelector('#origin').value = o; document.querySelector('[data-gender="f"]').click(); document.querySelector('#creator-start').click(); }, ORIGIN);
await waitTalk();
await talk({ 't_tong_seen': '왜', 't_halmoni': '안녕하세요', 't_gyul': '감사' }, { 't_open': 'train-open', 't_tong': 'train-tong', 't_halmoni': 'train-halmoni', 't_choi': 'train-kakao', 't_stop': 'train-stop' });
await page.waitForFunction(() => __cozy.S.city === 'seoul' && !__cozy.transitioning, null, { timeout: 240000 });
await waitTalk();
await talk({ 's_fan_photo': '죄송' }, { 's_open': 'hongdae-arrive', 's_hungry': 'hongdae-hungry' });
await shot('hongdae-free');
console.log('today', await page.evaluate(() => [...document.querySelectorAll('.quest-list li')].map((li) => li.textContent)), 'hint', await page.evaluate(() => __cozy.tongHint()));
// the poster
await tp(await spot('poster'), Math.PI / 2); await interact('광고판'); await talk({}, { 'p_open': 'poster' });
// the cart
await tp(await spot('cart'), 0); await interact('붕어빵'); await talk({ 'c_open': '하나', 'c_thanks': '감사' }, { 'c_open': 'cart' });
if (PATH === 'jin') {
  await tp(await spot('tent'), 0); await shot('tent-outside');
  await page.evaluate(() => { const j = __cozy.jin.root.position; __cozy.player.root.position.set(j.x + 1.2, 0, j.z + 0.8); });
  await interact('모자');
  await talk({ 'j0_where': '온새' }, { 'j0_open': 'jin-open', 'j0_name': 'jin-name', 'j0_where': 'jin-where', 'j0_phone': 'jin-phone' });
  await page.waitForFunction(() => __cozy.S.tentStory === 'idle' && !__cozy.dlg.state.active, null, { timeout: 600000 });
  await shot('after-jin');
}
// up to Onsae
await tp([5, 2.4, -33], Math.PI); await shot('terrace-onsae-front');
await tp(await spot('lobby'), Math.PI);
await waitTalk(); await talk({}, { 'l_open': 'lobby', 'l_wall': 'lobby-wall' });
await tp(await spot('artistWall'), Math.PI); await shot('lobby-artist-wall');
await tp(await spot('stair2'), -Math.PI / 2); await shot('2f-landing');
await tp(await spot('corridor2'), 0);
await waitTalk();
console.log('timing', Object.keys(await flags()).filter((f) => /^d1_(early|ontime|late)$/.test(f)), 'hour', await page.evaluate(() => __cozy.S.hour.toFixed(2)));
await talk({ 'hb_who': '안녕하세요', 'hb_drill': '세 드릴', 'hb_water': '하나 드세요', 'r_room': '잘 부탁' },
  { 'hb_count': 'coach-through-door', 'hb_who': 'haeun-who', 'hb_new': 'haeun-wall', 'hb_drill': 'haeun-drill', 'hb_water': 'haeun-water', 'hb_banmal': 'haeun-banmal', 'r_minji': 'cohort-out', 'r_room': 'corridor-glance', 'o_rules': 'orientation', 'o_overheard': 'gossip', 'o_locker': 'to-lockers' });
console.log('after orientation', Object.keys(await flags()).filter((f) => /orientation|met_haeun|counted|intro_/.test(f)));
await shot('room-a-after');
await tp(await spot('locker'), Math.PI); await interact('사물함'); await talk({ 'h0_drawer': '가방' }, { 'h0_label': 'locker-label', 'h0_glimpse': 'locker-glimpse' });
await page.waitForTimeout(1500); await shot('registration-card');
if (errors.length) process.exitCode = 1;
console.log(errors.length ? 'FAIL' : 'PASS', 'errors', errors.length, 'hangul', await page.evaluate(() => [...document.querySelectorAll('.quest-list li.hangul-count')].map((li) => li.textContent)));
await browser.close();
