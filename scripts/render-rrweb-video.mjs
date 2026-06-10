#!/usr/bin/env node
/**
 * Render a playtest session's rrweb event stream to video.
 *
 * Replays the events in headless Chromium (real browser engine — full
 * fidelity, smooth motion) and captures the replay with Playwright's
 * recordVideo. The result is what Gemini analyzes instead of the low-fps
 * html2canvas recording.
 *
 * Usage:
 *   node scripts/render-rrweb-video.mjs --session-id <id> [options]
 *
 * Options:
 *   --session-id   Playtest session ID (required)
 *   --api-base     Worker API base (default: https://tong-api.erniesg.workers.dev)
 *   --output       Output webm path (default: rrweb-render-<id>.webm)
 *   --speed        Replay speed multiplier (default: 1)
 *   --upload       PUT the render to the worker (playtest/<id>/rrweb-render.webm)
 *   --events       Local events JSON path (array of rrweb events; skips fetch)
 *
 * Requires the `playwright` npm package plus a chromium install
 * (`npm install -D playwright && npx playwright install chromium --with-deps`).
 *
 * Exit codes: 0 rendered OK, 1 error, 2 session has no rrweb events.
 */

import { parseArgs } from 'node:util';
import { readFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const USER_AGENT = 'Mozilla/5.0 (tong-pipeline)';

const { values: args } = parseArgs({
  options: {
    'session-id': { type: 'string' },
    'api-base': { type: 'string', default: 'https://tong-api.erniesg.workers.dev' },
    output: { type: 'string' },
    speed: { type: 'string', default: '1' },
    upload: { type: 'boolean', default: false },
    events: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
  strict: false,
});

if (args.help || !args['session-id']) {
  console.error('Usage: node scripts/render-rrweb-video.mjs --session-id <id> [--api-base url] [--output path] [--speed N] [--upload] [--events path]');
  process.exit(args.help ? 0 : 1);
}

const sessionId = args['session-id'];
const apiBase = args['api-base'];
const speed = Math.max(0.5, Number(args.speed) || 1);
const outPath = resolve(args.output || `rrweb-render-${sessionId}.webm`);

// ── Resolve dependencies (playwright at root, rrweb-player via client) ──

function resolveModule(name) {
  for (const base of [ROOT, join(ROOT, 'apps', 'client')]) {
    try {
      return createRequire(join(base, 'package.json')).resolve(name);
    } catch { /* try next */ }
  }
  return null;
}

const playwrightPath = resolveModule('playwright');
if (!playwrightPath) {
  console.error('[render] playwright is not installed. Run: npm install -D playwright && npx playwright install chromium --with-deps');
  process.exit(1);
}
const playwrightMod = await import(pathToFileURL(playwrightPath).href);
const chromium = playwrightMod.chromium || playwrightMod.default?.chromium;

// rrweb's Replayer is driven directly (rrweb-player 2.0.1 ships a broken
// dist). The exports map hides the UMD build — resolve the main entry and
// take the sibling files from its dist directory.
const rrwebMain = resolveModule('rrweb');
if (!rrwebMain) {
  console.error('[render] rrweb not found. Run: npm --prefix apps/client ci');
  process.exit(1);
}
const rrwebDist = dirname(rrwebMain);
const playerJsPath = join(rrwebDist, 'rrweb.umd.min.cjs');
const playerCssPath = join(rrwebDist, 'style.css');

// ── Load events ─────────────────────────────────────────────────────

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json();
}

let events;
if (args.events) {
  events = JSON.parse(readFileSync(args.events, 'utf8'));
} else {
  const base = `${apiBase}/api/v1/playtest/sessions/${sessionId}/rrweb-events`;
  let manifest;
  try {
    manifest = await fetchJson(base);
  } catch (err) {
    console.error(`[render] No rrweb events for session ${sessionId}: ${err.message}`);
    process.exit(2);
  }
  console.error(`[render] Fetching ${manifest.count} event batches...`);
  events = [];
  for (const batch of manifest.batches) {
    events.push(...await fetchJson(`${base}/${batch.name}`));
  }
}

if (!Array.isArray(events) || events.length < 2) {
  console.error('[render] Not enough events to replay');
  process.exit(2);
}

// Session viewport comes from rrweb's Meta event (type 4)
const meta = events.find((e) => e.type === 4);
const width = Math.max(2, Math.round((meta?.data?.width || 390) / 2) * 2);
const height = Math.max(2, Math.round((meta?.data?.height || 844) / 2) * 2);
const durationMs = events[events.length - 1].timestamp - events[0].timestamp;
console.error(`[render] ${events.length} events, ${Math.round(durationMs / 1000)}s session, ${width}x${height}, speed ${speed}x`);

// ── Replay in headless Chromium with video recording ────────────────

const playerJs = readFileSync(playerJsPath, 'utf8');
const playerCss = readFileSync(playerCssPath, 'utf8');

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<style>${playerCss}</style>
<style>
  html, body { margin: 0; padding: 0; background: #0d0d1a; overflow: hidden; }
  .replayer-wrapper { position: relative; }
  .replayer-wrapper iframe { border: none; background: #fff; }
</style>
</head><body></body></html>`;

const videoDir = mkdtempSync(join(tmpdir(), 'rrweb-render-'));
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
});

try {
  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: { dir: videoDir, size: { width, height } },
    userAgent: USER_AGENT,
  });
  const page = await context.newPage();
  page.on('pageerror', (err) => console.error(`[render] page error: ${err.message}`));
  await page.setContent(html, { waitUntil: 'load' });
  await page.addScriptTag({ content: playerJs });

  await page.evaluate(
    ({ events, speed, durationMs }) => {
      window.__rrwebDone = false;
      const replayer = new window.rrweb.Replayer(events, {
        root: document.body,
        speed,
        UNSAFE_replayCanvas: true,
        showWarning: false,
      });
      replayer.on('finish', () => { window.__rrwebDone = true; });
      replayer.play(0);
      // Backstop in case 'finish' never fires (e.g. trailing incremental
      // events the replayer skips)
      setTimeout(() => { window.__rrwebDone = true; }, Math.round(durationMs / speed) + 10_000);
    },
    { events, speed, durationMs },
  );

  const timeoutMs = Math.round(durationMs / speed) + 60_000;
  console.error(`[render] Replaying (timeout ${Math.round(timeoutMs / 1000)}s)...`);
  await page.waitForFunction(() => window.__rrwebDone, null, {
    timeout: timeoutMs,
    polling: 1000,
  });
  await page.waitForTimeout(1000); // trailing frames

  const video = page.video();
  await context.close(); // finalizes the recording
  await video.saveAs(outPath);
} finally {
  await browser.close();
  rmSync(videoDir, { recursive: true, force: true });
}

const sizeBytes = statSync(outPath).size;
console.error(`[render] Wrote ${outPath} (${Math.round(sizeBytes / 1024)} KB)`);

// ── Optional upload to R2 via the worker ────────────────────────────

if (args.upload) {
  const res = await fetch(`${apiBase}/api/v1/playtest/sessions/${sessionId}/rrweb-render`, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/webm', 'User-Agent': USER_AGENT },
    body: readFileSync(outPath),
  });
  if (!res.ok) {
    console.error(`[render] Upload failed: ${res.status}`);
    process.exit(1);
  }
  const data = await res.json();
  console.error(`[render] Uploaded: ${data.url}`);
}

console.log(JSON.stringify({
  sessionId,
  output: outPath,
  bytes: sizeBytes,
  width,
  height,
  durationMs,
  speed,
  events: events.length,
  uploaded: Boolean(args.upload),
}, null, 2));
