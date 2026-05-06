#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer';

const DEFAULT_BASE_URL = 'http://localhost:3000';
const RUN_ID = process.env.QA_RUN_ID || `shanghai-onboarding-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const BASE_URL = process.env.BASE_URL || DEFAULT_BASE_URL;
const OUT_DIR = resolve(process.env.OUT_DIR || `artifacts/qa-runs/${RUN_ID}`);
const FRAME_DIR = join(OUT_DIR, 'frames');
const VIEWPORTS = {
  mobile: { width: 390, height: 844, deviceScaleFactor: 2 },
  desktop: { width: 1280, height: 900, deviceScaleFactor: 1 },
};

function ensureCleanDir(dir) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

async function waitForText(page, text, timeout = 8000) {
  await page.waitForFunction(
    (needle) => document.body.innerText.includes(needle),
    { timeout },
    text,
  );
}

async function showCueAt(page, x, y, kind = 'tap') {
  await page.evaluate(({ cueX, cueY, cueKind }) => {
    const frame = document.querySelector('.game-frame') ?? document.body;
    const frameRect = frame.getBoundingClientRect();
    const cue = document.createElement('div');
    cue.className = `shanghai-qa-cue${cueKind === 'drag' ? ' shanghai-qa-cue--drag' : ''}`;
    cue.style.setProperty('--qa-x', `${cueX - frameRect.left}px`);
    cue.style.setProperty('--qa-y', `${cueY - frameRect.top}px`);
    frame.appendChild(cue);
    window.setTimeout(() => cue.remove(), 950);
  }, { cueX: x, cueY: y, cueKind: kind });
  await sleep(180);
}

async function showCueForSelector(page, selector, kind = 'tap') {
  const rect = await page.$eval(selector, (node) => {
    const box = node.getBoundingClientRect();
    return { x: box.left, y: box.top, width: box.width, height: box.height };
  });
  await showCueAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2, kind);
}

async function clickVisibleText(page, text) {
  const rect = await page.evaluate((needle) => {
    const candidates = Array.from(document.querySelectorAll('button, .tong-whisper, .dialogue-subtitle, [role="button"]'));
    const target = candidates.find((node) => node.textContent?.includes(needle));
    if (!(target instanceof HTMLElement)) return null;
    const box = target.getBoundingClientRect();
    return { x: box.left, y: box.top, width: box.width, height: box.height };
  }, text);
  if (!rect) throw new Error(`Could not click visible text: ${text}`);
  await showCueAt(page, rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await sleep(220);
}

async function clickTong(page) {
  await page.waitForSelector('.tong-whisper', { visible: true });
  await showCueForSelector(page, '.tong-whisper');
  const rect = await page.$eval('.tong-whisper', (node) => {
    const box = node.getBoundingClientRect();
    return { x: box.left, y: box.top, width: box.width, height: box.height };
  });
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await sleep(350);
}

async function screenshot(page, name, label, shots) {
  const file = join(OUT_DIR, name);
  await page.screenshot({ path: file, fullPage: false });
  shots.push({ label, path: file });
}

async function startScreencast(page, cues) {
  const client = await page.target().createCDPSession();
  let frameNo = 0;
  await client.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 85,
    maxWidth: 780,
    maxHeight: 1688,
    everyNthFrame: 2,
  });
  const startedAt = Date.now();
  cues.push({ id: 'recording_started', atMs: 0 });

  client.on('Page.screencastFrame', async (event) => {
    frameNo += 1;
    const framePath = join(FRAME_DIR, `frame-${String(frameNo).padStart(5, '0')}.jpg`);
    writeFileSync(framePath, Buffer.from(event.data, 'base64'));
    try {
      await client.send('Page.screencastFrameAck', { sessionId: event.sessionId });
    } catch {
      // The session may already be stopping.
    }
  });

  return {
    async cue(id) {
      cues.push({ id, atMs: Date.now() - startedAt });
    },
    async stop() {
      await sleep(450);
      try {
        await client.send('Page.stopScreencast');
      } catch {
        // Ignore already-stopped screencast sessions.
      }
      return { frameCount: frameNo };
    },
  };
}

function buildVideo() {
  const mp4 = join(OUT_DIR, 'shanghai-onboarding-proof.mp4');
  const gif = join(OUT_DIR, 'shanghai-onboarding-proof.gif');
  const framePattern = join(FRAME_DIR, 'frame-%05d.jpg');
  const mp4Result = spawnSync('ffmpeg', [
    '-y',
    '-framerate', '24',
    '-i', framePattern,
    '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    mp4,
  ], { encoding: 'utf8' });

  const gifResult = spawnSync('ffmpeg', [
    '-y',
    '-framerate', '12',
    '-i', framePattern,
    '-vf', 'scale=390:-1:flags=lanczos,fps=12',
    gif,
  ], { encoding: 'utf8' });

  return {
    mp4,
    gif,
    mp4Ok: mp4Result.status === 0,
    gifOk: gifResult.status === 0,
    ffmpegErrors: [mp4Result.stderr, gifResult.stderr].filter(Boolean).join('\n').slice(-4000),
  };
}

function formatCheckResult(key, value) {
  const ok = key === 'debugPanels' ? !value : Boolean(value);
  return ok ? 'pass' : 'fail';
}

async function run() {
  ensureCleanDir(OUT_DIR);
  ensureCleanDir(FRAME_DIR);

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'],
  });

  const screenshots = [];
  const cues = [];
  const checks = {};

  try {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORTS.mobile);
    const route = `${BASE_URL}/onboarding/shanghai?entry=chinese-priority&reset=1&qa_run_id=${encodeURIComponent(RUN_ID)}&qa_trace=1`;
    await page.goto(route, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.evaluate(() => window.localStorage.removeItem('tong:shanghai:onboarding:h1'));
    await page.goto(route, { waitUntil: 'networkidle0', timeout: 30000 });

    await page.waitForSelector('.shanghai-onboarding__video', { visible: true });
    await page.waitForSelector('.tong-whisper', { visible: true });
    checks.videoElementVisible = await page.$eval('.shanghai-onboarding__video', (node) => node instanceof HTMLVideoElement);
    checks.usesLoopingVideo = await page.$eval('.shanghai-onboarding__video', (node) => node instanceof HTMLVideoElement && node.loop && node.autoplay && node.playsInline);
    checks.startsInsideGameFrame = await page.$eval('.game-frame .shanghai-onboarding', () => true).catch(() => false);

    const castState = await page.evaluate(() => ({
      mentionsShop: document.body.innerText.includes('小笼包') || document.body.innerText.includes('xiaolongbao'),
      hasHud: Boolean(document.querySelector('.scene-hud')),
      debugPanels: Boolean(document.querySelector('[data-debug], .debug-panel, .admin-panel')),
      usesTongEnglishName: document.querySelector('.tong-whisper__label')?.textContent?.trim() === 'Tong',
      noCityMapNegation: !document.body.innerText.includes('This is not the city map'),
      noProposalLeak: !/proposal/i.test(document.body.innerText),
      noFirstAnchorLabel: !document.body.innerText.includes('First anchor'),
    }));
    Object.assign(checks, castState);

    const recorder = await startScreencast(page, cues);
    await recorder.cue('ready_intro');
    await screenshot(page, '01-ready-intro.png', 'ready_state', screenshots);

    await clickTong(page);
    await clickTong(page);
    await clickTong(page);
    await clickTong(page);
    await waitForText(page, '方案');
    await screenshot(page, '02-anchor-before-exercise.png', 'pre_exercise_context', screenshots);
    await clickTong(page);
    await recorder.cue('exercise_opened');
    await waitForText(page, 'In this scene, 方案');
    await screenshot(page, '03-anchor-exercise.png', 'anchor_exercise', screenshots);

    await clickVisibleText(page, 'The plan on the table');
    await clickVisibleText(page, 'Check');
    await recorder.cue('exercise_answered');
    await waitForText(page, 'Correct', 5000).catch(() => {});
    await sleep(2100);
    await waitForText(page, 'Good. Now you have one handle');
    await screenshot(page, '04-post-exercise.png', 'post_exercise_context', screenshots);

    await clickTong(page);
    await clickTong(page);
    await clickTong(page);
    await recorder.cue('pan_prompt_visible');
    await waitForText(page, 'Drag left to listen in.');
    await screenshot(page, '05-pan-prompt.png', 'pre_action_pan_prompt', screenshots);

    const stageBox = await page.$eval('.shanghai-onboarding__stage', (node) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    for (let dragIndex = 0; dragIndex < 4; dragIndex += 1) {
      await showCueAt(page, stageBox.x + stageBox.width * 0.48, stageBox.y + stageBox.height * 0.48, 'drag');
      await page.mouse.move(stageBox.x + stageBox.width * 0.9, stageBox.y + stageBox.height * 0.48);
      await page.mouse.down();
      await page.mouse.move(stageBox.x + stageBox.width * 0.06, stageBox.y + stageBox.height * 0.48, { steps: 18 });
      await page.mouse.up();
      await sleep(180);
    }
    await recorder.cue('pan_input_finished');
    await page.waitForSelector('.shanghai-onboarding--webtoon', { visible: true, timeout: 8000 });
    await recorder.cue('webtoon_entered');
    await screenshot(page, '06-webtoon-entered.png', 'stable_post_action_webtoon', screenshots);

    const stripBox = await page.$eval('.wt-strip', (node) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    await recorder.cue('webtoon_scroll_started');
    for (let scrollIndex = 0; scrollIndex < 7; scrollIndex += 1) {
      await showCueAt(page, stripBox.x + stripBox.width * 0.5, stripBox.y + stripBox.height * 0.78, 'drag');
      await page.mouse.move(stripBox.x + stripBox.width * 0.5, stripBox.y + stripBox.height * 0.78);
      await page.mouse.wheel({ deltaY: 620 });
      await sleep(520);
    }
    await recorder.cue('webtoon_scroll_finished');
    await sleep(900);
    await screenshot(page, '07-webtoon-bottom.png', 'webtoon_bottom', screenshots);

    const dialogueAppeared = await page.waitForSelector('.dialogue-subtitle', { visible: true, timeout: 8000 })
      .then(async () => page.evaluate(() => {
        const dialogue = document.querySelector('.dialogue-subtitle');
        if (!(dialogue instanceof HTMLElement)) return false;
        const rect = dialogue.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        const topElement = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return Boolean(topElement && (topElement === dialogue || dialogue.contains(topElement)));
      }))
      .catch(() => false);
    checks.completionDialogueVisible = dialogueAppeared;
    if (dialogueAppeared) {
      await recorder.cue('completion_dialogue_visible');
      await sleep(1200);
      await screenshot(page, '08-completion-dialogue.png', 'completion_dialogue', screenshots);
    }

    const finalState = await page.evaluate(() => ({
      url: window.location.href,
      bodyText: document.body.innerText,
      checkpoint: window.localStorage.getItem('tong:shanghai:onboarding:h1'),
      gameStore: window.localStorage.getItem('tong-game'),
    }));
    checks.mentionsAnchor = finalState.bodyText.includes('方案');
    checks.mentionsShop = finalState.bodyText.includes('小笼包') || finalState.bodyText.includes('xiaolongbao');
    checks.noCityMapNegation = checks.noCityMapNegation && !finalState.bodyText.includes('This is not the city map');
    checks.noProposalLeak = checks.noProposalLeak && !/proposal/i.test(finalState.bodyText);
    checks.noFirstAnchorLabel = checks.noFirstAnchorLabel && !finalState.bodyText.includes('First anchor');
    checks.checkpointMarkedComplete = Boolean(finalState.checkpoint?.includes('"phase":"complete"'));
    checks.xpGranted = Boolean(finalState.gameStore?.includes('"xp":80'));

    const desktop = await browser.newPage();
    await desktop.setViewport(VIEWPORTS.desktop);
    await desktop.goto(route, { waitUntil: 'networkidle0', timeout: 30000 });
    await desktop.waitForSelector('.shanghai-onboarding__video', { visible: true });
    await screenshot(desktop, '09-desktop-intro.png', 'desktop_intro', screenshots);
    await desktop.close();

    const screencast = await recorder.stop();
    const video = buildVideo();

    const passed = [
      checks.videoElementVisible,
      checks.usesLoopingVideo,
      checks.startsInsideGameFrame,
      checks.mentionsAnchor,
      checks.mentionsShop,
      checks.hasHud,
      !checks.debugPanels,
      checks.usesTongEnglishName,
      checks.noCityMapNegation,
      checks.noProposalLeak,
      checks.noFirstAnchorLabel,
      checks.completionDialogueVisible,
      checks.checkpointMarkedComplete,
      checks.xpGranted,
      video.mp4Ok,
    ].every(Boolean);

    const manifest = {
      runId: RUN_ID,
      classification: 'local-qa-evidence',
      generatedAt: new Date().toISOString(),
      route,
      note: 'Local-only capture. Not reviewer-openable from GitHub until uploaded/published after the no-remote window.',
      viewport: VIEWPORTS.mobile,
      screenshots,
      video: {
        mp4: video.mp4,
        gif: video.gif,
        mp4Ok: video.mp4Ok,
        gifOk: video.gifOk,
        frameCount: screencast.frameCount,
      },
      cues,
      checks,
      passed,
      ffmpegErrors: video.ffmpegErrors,
    };
    writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
    writeFileSync(join(OUT_DIR, 'summary.md'), [
      `# Shanghai Onboarding Local QA Evidence`,
      ``,
      `- Run: \`${RUN_ID}\``,
      `- Route: \`${route}\``,
      `- Result: ${passed ? 'PASS' : 'FAIL'}`,
      `- Video: \`${video.mp4}\``,
      `- GIF: \`${video.gif}\``,
      ``,
      `## Checks`,
      ...Object.entries(checks).map(([key, value]) => `- ${key}: ${formatCheckResult(key, value)}`),
      ``,
      `## Ordered Stills`,
      ...screenshots.map((shot) => `- ${shot.label}: \`${shot.path}\``),
      ``,
      `This bundle is local QA evidence. Upload it to the configured QA evidence host before calling it reviewer-facing proof.`,
      ``,
    ].join('\n'));

    console.log(JSON.stringify({ outDir: OUT_DIR, passed, checks, video: manifest.video }, null, 2));
    process.exitCode = passed ? 0 : 1;
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
