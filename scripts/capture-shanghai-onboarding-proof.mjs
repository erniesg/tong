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

async function clickVisibleText(page, text) {
  const clicked = await page.evaluate((needle) => {
    const candidates = Array.from(document.querySelectorAll('button, .tong-whisper, .dialogue-subtitle, [role="button"]'));
    const target = candidates.find((node) => node.textContent?.includes(needle));
    if (!(target instanceof HTMLElement)) return false;
    target.click();
    return true;
  }, text);
  if (!clicked) throw new Error(`Could not click visible text: ${text}`);
}

async function clickExerciseCheck(page) {
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const target = buttons.find((node) => node.textContent?.trim().startsWith('Check'));
    if (!(target instanceof HTMLElement)) throw new Error('Could not find Check button');
    target.click();
  });
}

async function clickExerciseOption(page, text) {
  await page.evaluate((needle) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const target = buttons.find((node) => node.textContent?.includes(needle));
    if (!(target instanceof HTMLElement)) throw new Error(`Could not find exercise option: ${needle}`);
    target.click();
  }, text);
}

async function clickFirstPronunciationOption(page) {
  await page.waitForSelector('.pron-select__option', { visible: true });
  await page.evaluate(() => {
    const target = document.querySelector('.pron-select__option');
    if (!(target instanceof HTMLElement)) throw new Error('Could not find pronunciation option');
    target.click();
  });
}

async function dismissPronunciationFeedback(page) {
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('.exercise-card div')).some((node) => node.textContent?.includes('Correct')),
    { timeout: 5000 },
  );
  await page.evaluate(() => {
    const target = Array.from(document.querySelectorAll('.exercise-card div')).find((node) => node.textContent?.includes('Correct'));
    if (target instanceof HTMLElement) target.click();
  });
}

async function answerPronunciationFirstOption(page) {
  await clickFirstPronunciationOption(page);
  await clickExerciseCheck(page);
  await dismissPronunciationFeedback(page);
  await sleep(2200);
}

async function answerFillBlank(page, optionText) {
  await clickExerciseOption(page, optionText);
  await clickExerciseCheck(page);
  await waitForText(page, 'Correct', 5000).catch(() => {});
  await sleep(2200);
}

async function answerSentenceBuilder(page, tiles) {
  for (const tile of tiles) {
    await clickExerciseOption(page, tile);
    await sleep(140);
  }
  await clickExerciseCheck(page);
  await waitForText(page, 'Correct', 5000).catch(() => {});
  await sleep(2200);
}

async function answerMatching(page, pairs) {
  await page.waitForSelector('.exercise-card', { visible: true });
  for (const pair of pairs) {
    await page.evaluate(({ right }) => {
      const card = document.querySelector('.exercise-card');
      if (!(card instanceof HTMLElement)) throw new Error('Could not find exercise card');

      const buttons = Array.from(card.querySelectorAll('button'));
      const wordButton = buttons.find((node) => node.textContent?.includes(right) && !node.textContent?.includes('Check'));
      if (!(wordButton instanceof HTMLElement)) throw new Error(`Could not find matching option: ${right}`);
      wordButton.click();
    }, pair);
    await sleep(90);
    await page.evaluate(({ left }) => {
      const card = document.querySelector('.exercise-card');
      if (!(card instanceof HTMLElement)) throw new Error('Could not find exercise card');

      const leftLabel = Array.from(card.querySelectorAll('span')).find((node) => node.textContent?.trim() === left);
      const slot = leftLabel?.closest('div[class*="rounded-lg"][class*="border"]');
      if (!(slot instanceof HTMLElement)) throw new Error(`Could not find matching slot: ${left}`);
      slot.click();
    }, pair);
    await sleep(140);
  }
  await clickExerciseCheck(page);
  await waitForText(page, 'Correct', 5000).catch(() => {});
  await sleep(2200);
}

async function continueDialogue(page) {
  await page.waitForSelector('.dialogue-subtitle', { visible: true });
  await page.waitForSelector('.dialogue-continue', { visible: true, timeout: 5000 });
  await page.$eval('.dialogue-subtitle', (node) => {
    if (node instanceof HTMLElement) node.click();
  });
  await sleep(500);
}

async function clickTong(page) {
  await page.waitForSelector('.tong-whisper', { visible: true });
  await page.$eval('.tong-whisper', (node) => {
    if (node instanceof HTMLElement) node.click();
  });
  await sleep(350);
}

async function screenshot(page, name, label, shots) {
  const file = join(OUT_DIR, name);
  await page.screenshot({ path: file, fullPage: false });
  shots.push({ label, path: file });
}

async function scrollWebtoonToEnd(page) {
  await page.waitForSelector('.wt-strip', { visible: true });
  await page.evaluate(() => {
    const root = document.querySelector('.wt-strip');
    if (root instanceof HTMLElement) root.scrollTo({ top: root.scrollHeight, behavior: 'instant' });
  });
  await sleep(1500);
}

async function scrollWebtoonToPanel(page, panelIndex) {
  await page.waitForSelector('.wt-strip', { visible: true });
  await page.evaluate((index) => {
    const panel = document.querySelector(`[data-panel-index="${index}"]`);
    if (panel instanceof HTMLElement) panel.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, panelIndex);
  await sleep(900);
}

async function waitForWebtoonAfterPan(page) {
  await page.waitForFunction(
    () => Boolean(document.querySelector('.shanghai-onboarding--webtoon')),
    { timeout: 6000 },
  );
}

async function startScreencast(page, cues) {
  const client = await page.target().createCDPSession();
  let frameNo = 0;
  await client.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 85,
    maxWidth: 780,
    maxHeight: 1688,
    everyNthFrame: 1,
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
    '-framerate', '12',
    '-i', framePattern,
    '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    mp4,
  ], { encoding: 'utf8' });

  const gifResult = spawnSync('ffmpeg', [
    '-y',
    '-framerate', '8',
    '-i', framePattern,
    '-vf', 'scale=390:-1:flags=lanczos,fps=8',
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
    await page.evaluate(() => {
      window.localStorage.removeItem('tong:shanghai:onboarding:h1');
      window.localStorage.removeItem('tong-game');
    });
    await page.goto(route, { waitUntil: 'networkidle0', timeout: 30000 });

    await page.waitForSelector('.shanghai-onboarding__video', { visible: true });
    await page.waitForSelector('.tong-whisper', { visible: true });
    checks.videoElementVisible = await page.$eval('.shanghai-onboarding__video', (node) => node instanceof HTMLVideoElement);
    checks.usesLoopingVideo = await page.$eval('.shanghai-onboarding__video', (node) => node instanceof HTMLVideoElement && node.loop && node.autoplay && node.playsInline);
    checks.startsInsideGameFrame = await page.$eval('.game-frame .shanghai-onboarding', () => true).catch(() => false);

    const castState = await page.evaluate(() => ({
      mentionsProposal: false,
      mentionsShop: document.body.innerText.includes('小笼包') || document.body.innerText.toLowerCase().includes('xiaolongbao'),
      hasHud: Boolean(document.querySelector('.scene-hud')),
      debugPanels: Boolean(document.querySelector('[data-debug], .debug-panel, .admin-panel')),
    }));
    Object.assign(checks, castState);

    const recorder = await startScreencast(page, cues);
    await recorder.cue('ready_intro');
    await screenshot(page, '01-ready-intro.png', 'ready_state', screenshots);

    await clickTong(page);
    await clickTong(page);
    await waitForText(page, 'Tap 想法 once and listen');
    const tappedIntroChunk = await page.evaluate(() => {
      const target = Array.from(document.querySelectorAll('.tong-whisper [data-korean]'))
        .find((node) => node.textContent?.trim() === '想法');
      if (!(target instanceof HTMLElement)) return null;
      target.click();
      return target.textContent;
    });
    checks.introChunkTapped = tappedIntroChunk === '想法';
    checks.introChunkTooltipVisible = Boolean(tappedIntroChunk) && await page.waitForSelector('.korean-tooltip', { visible: true, timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    await recorder.cue('intro_chunk_tapped');
    await screenshot(page, '02-intro-chunk-tooltip.png', 'intro_chunk_tooltip', screenshots);
    await clickTong(page);
    await waitForText(page, 'Which sound is the short question');
    await screenshot(page, '03-anchor-before-exercise.png', 'pre_exercise_context', screenshots);
    await recorder.cue('exercise_opened');
    await screenshot(page, '04-anchor-exercise.png', 'anchor_exercise', screenshots);

    await answerPronunciationFirstOption(page);
    await recorder.cue('exercise_answered');
    await waitForText(page, 'Good. 想法 has a shape');
    await screenshot(page, '05-post-exercise.png', 'post_exercise_context', screenshots);

    await clickTong(page);
    await clickTong(page);
    await recorder.cue('pan_prompt_visible');
    await waitForText(page, 'Slide toward the window table.');
    await screenshot(page, '06-pan-prompt.png', 'pre_action_pan_prompt', screenshots);
    await page.waitForFunction(() => {
      const stage = document.querySelector('.shanghai-onboarding__stage');
      const world = document.querySelector('.shanghai-onboarding__world');
      if (!(stage instanceof HTMLElement) || !(world instanceof HTMLElement)) return false;
      const stageWidth = stage.getBoundingClientRect().width;
      const worldWidth = Number.parseFloat(world.style.width || '0');
      return worldWidth > stageWidth + 20;
    }, { timeout: 5000 });
    await sleep(600);

    const stageBox = await page.$eval('.shanghai-onboarding__stage', (node) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    for (let dragIndex = 0; dragIndex < 6; dragIndex += 1) {
      await page.mouse.move(stageBox.x + stageBox.width * 0.9, stageBox.y + stageBox.height * 0.48);
      await page.mouse.down();
      await page.mouse.move(stageBox.x + stageBox.width * 0.06, stageBox.y + stageBox.height * 0.48, { steps: 18 });
      await page.mouse.up();
      await sleep(240);
    }
    await page.mouse.move(stageBox.x + stageBox.width * 0.52, stageBox.y + stageBox.height * 0.48);
    for (let wheelIndex = 0; wheelIndex < 5; wheelIndex += 1) {
      await page.mouse.wheel({ deltaY: 900 });
      await sleep(140);
    }
    await page.evaluate(() => {
      const node = document.querySelector('.shanghai-onboarding__stage');
      if (!(node instanceof HTMLElement)) return;
      for (let wheelIndex = 0; wheelIndex < 5; wheelIndex += 1) {
        node.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 1200 }));
      }
    });
    await recorder.cue('pan_input_finished');
    checks.panReachedWebtoonWithoutShortcut = await page.waitForFunction(
      () => Boolean(document.querySelector('.shanghai-onboarding--webtoon')),
      { timeout: 6000 },
    )
      .then(() => true)
      .catch(() => false);
    if (!checks.panReachedWebtoonWithoutShortcut) {
      throw new Error('Pan input did not enter the webtoon eavesdrop.');
    }
    await waitForWebtoonAfterPan(page);
    await recorder.cue('webtoon_entered');
    await screenshot(page, '07-webtoon-entered.png', 'stable_post_action_webtoon', screenshots);
    checks.chineseBubbleTokensInteractive = await page.evaluate(() => document.querySelectorAll('.wt-bubble [data-korean]').length > 0);
    const tappedChineseToken = await page.evaluate(() => {
      const target = document.querySelector('.wt-bubble [data-korean]');
      if (!(target instanceof HTMLElement)) return null;
      target.click();
      return target.textContent;
    });
    checks.chineseTooltipVisible = Boolean(tappedChineseToken) && await page.waitForSelector('.korean-tooltip', { visible: true, timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    await screenshot(page, '08-webtoon-token-tooltip.png', 'webtoon_token_tooltip', screenshots);
    if (tappedChineseToken) {
      await page.evaluate(() => {
        const target = document.querySelector('.wt-bubble [data-korean]');
        if (target instanceof HTMLElement) target.click();
      });
      await sleep(250);
    }
    checks.beat1ProposalLine = await page.evaluate(() => document.body.innerText.includes('方案你看过了。'));
    checks.beat1FoodRedirect = await page.evaluate(() => document.body.innerText.includes('小笼包不错。'));

    await scrollWebtoonToEnd(page);
    await screenshot(page, '09-beat-1-bottom.png', 'beat_1_bottom', screenshots);
    checks.beat1ProposalLine = checks.beat1ProposalLine || await page.evaluate(() => document.body.innerText.includes('方案你看过了。'));
    checks.beat1FoodRedirect = checks.beat1FoodRedirect || await page.evaluate(() => document.body.innerText.includes('小笼包不错。'));

    await recorder.cue('beat_1_language_gate');
    await waitForText(page, 'You heard 看过了');
    checks.webtoonVisibleDuringLanguageGate = await page.evaluate(() => Boolean(document.querySelector('.wt-strip')) && document.body.innerText.includes('小笼包不错。'));
    checks.noPosterSnapDuringLanguageGate = await page.evaluate(() => !document.querySelector('.shanghai-onboarding__video') && !document.querySelector('.summary-screen'));
    await screenshot(page, '10-beat-1-language.png', 'beat_1_language_gate', screenshots);
    await clickTong(page);
    await waitForText(page, 'Try that shape once');
    await clickTong(page);
    await waitForText(page, 'Match each 过了 phrase with its meaning.');
    checks.webtoonVisibleDuringExercise = await page.evaluate(() => Boolean(document.querySelector('.wt-strip')) && document.body.innerText.includes('小笼包不错。'));
    checks.noPosterSnapDuringExercise = await page.evaluate(() => !document.querySelector('.shanghai-onboarding__video') && !document.querySelector('.summary-screen'));
    checks.matchingChineseTokensInteractive = await page.evaluate(() => document.querySelectorAll('.exercise-card [data-korean]').length > 0);
    const tappedMatchingToken = await page.evaluate(() => {
      const target = Array.from(document.querySelectorAll('.exercise-card [data-korean]'))
        .find((node) => node.textContent?.trim() === '看过了');
      if (!(target instanceof HTMLElement)) return null;
      target.click();
      return target.textContent;
    });
    checks.matchingChineseTooltipVisible = Boolean(tappedMatchingToken) && await page.waitForSelector('.korean-tooltip', { visible: true, timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (tappedMatchingToken) {
      await page.evaluate(() => {
        const target = Array.from(document.querySelectorAll('.exercise-card [data-korean]'))
          .find((node) => node.textContent?.trim() === '看过了');
        if (target instanceof HTMLElement) target.click();
      });
      await sleep(250);
    }
    await screenshot(page, '11-beat-1-exercise.png', 'beat_1_exercise', screenshots);
    await answerMatching(page, [
      { left: '看过了', right: 'looked it over already' },
      { left: '吃过了', right: 'already ate' },
      { left: '听过了', right: 'already heard it' },
    ]);

    await page.waitForSelector('.shanghai-onboarding--webtoon', { visible: true, timeout: 8000 });
    await recorder.cue('beat_2_webtoon_entered');
    await screenshot(page, '12-beat-2-entered.png', 'beat_2_entered', screenshots);
    checks.beat2NoActLine = await page.evaluate(() => document.body.innerText.includes('这个节目需要一个不装的人。'));
    checks.beat2KeepPretendingLine = await page.evaluate(() => document.body.innerText.includes('我觉得你装不下去。'));
    checks.placeholderArtAfterP6 = await page.evaluate(() => document.querySelectorAll('.wt-placeholder').length >= 1);
    await scrollWebtoonToPanel(page, 7);
    checks.placeholderArtAfterP6 = checks.placeholderArtAfterP6 || await page.evaluate(() => {
      const visiblePlaceholder = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)?.closest('.wt-placeholder');
      return Boolean(visiblePlaceholder) || document.body.innerText.includes('WEBTOON ART PENDING');
    });
    await screenshot(page, '13-beat-2-placeholder-after-p6.png', 'beat_2_placeholder_after_p6', screenshots);
    await scrollWebtoonToEnd(page);
    await screenshot(page, '14-beat-2-bottom.png', 'beat_2_bottom', screenshots);
    checks.beat2NoActLine = checks.beat2NoActLine || await page.evaluate(() => document.body.innerText.includes('这个节目需要一个不装的人。'));
    checks.beat2KeepPretendingLine = checks.beat2KeepPretendingLine || await page.evaluate(() => document.body.innerText.includes('我觉得你装不下去。'));
    checks.placeholderArtAfterP6 = checks.placeholderArtAfterP6 || await page.evaluate(() => document.querySelectorAll('.wt-placeholder').length >= 1);

    await recorder.cue('beat_2_language_gate');
    await waitForText(page, 'That 不下去 is the useful part');
    await screenshot(page, '15-beat-2-language.png', 'beat_2_language_gate', screenshots);
    await clickTong(page);
    await waitForText(page, 'Try the shape across a few verbs');
    await clickTong(page);
    await waitForText(page, 'Match each V不下去 phrase with its meaning.');
    await screenshot(page, '16-beat-2-exercise.png', 'beat_2_exercise', screenshots);
    await answerMatching(page, [
      { left: '装不下去', right: 'cannot keep pretending' },
      { left: '演不下去', right: 'cannot keep performing' },
      { left: '说不下去', right: 'cannot keep saying it' },
      { left: '吃不下去', right: 'cannot keep eating' },
    ]);

    await page.waitForSelector('.shanghai-onboarding--webtoon', { visible: true, timeout: 8000 });
    await recorder.cue('exit_webtoon_entered');
    await screenshot(page, '17-exit-entered.png', 'exit_entered', screenshots);
    checks.phoneSfxVisible = await page.evaluate(() => document.body.innerText.includes('嗡'));
    checks.paymentSfxVisible = await page.evaluate(() => document.body.innerText.includes('已付款'));
    checks.registerRevealVisible = await page.evaluate(() => document.body.innerText.includes('瞿家的小儿子'));
    checks.noNarratorPhoneCopy = await page.evaluate(() => !document.body.innerText.includes('The phone rings') && !document.body.innerText.includes('旁白'));
    await scrollWebtoonToEnd(page);
    await screenshot(page, '18-exit-bottom.png', 'exit_bottom', screenshots);
    checks.phoneSfxVisible = checks.phoneSfxVisible || await page.evaluate(() => document.body.innerText.includes('嗡'));
    checks.paymentSfxVisible = checks.paymentSfxVisible || await page.evaluate(() => document.body.innerText.includes('已付款'));
    checks.registerRevealVisible = checks.registerRevealVisible || await page.evaluate(() => document.body.innerText.includes('瞿家的小儿子'));
    checks.noNarratorPhoneCopy = checks.noNarratorPhoneCopy && await page.evaluate(() => !document.body.innerText.includes('The phone rings') && !document.body.innerText.includes('旁白'));

    await recorder.cue('register_language_gate');
    await waitForText(page, 'She said 小瞿');
    await screenshot(page, '19-register-language.png', 'register_language_gate', screenshots);
    await clickTong(page);
    await waitForText(page, '瞿家 is the Qu family');
    await screenshot(page, '20-family-register-language.png', 'family_register_language_gate', screenshots);
    await clickTong(page);
    await waitForText(page, 'Today’s listening handles');
    await screenshot(page, '21-tong-wrap.png', 'tong_wrap', screenshots);
    await clickTong(page);

    checks.summaryScreenVisible = await page.waitForSelector('.summary-screen', { visible: true, timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    checks.summaryTextVisible = await page.evaluate(() => document.body.innerText.includes('Today’s listening handles'));
    checks.summaryXpVisible = await page.evaluate(() => document.body.innerText.includes('+80') && document.body.innerText.includes('XP earned'));
    checks.summarySpVisible = await page.evaluate(() => document.body.innerText.includes('+40') && document.body.innerText.includes('SP earned'));
    checks.finalQuizRemoved = await page.evaluate(() => !document.body.innerText.includes('Put 方阿姨'));
    await recorder.cue('summary_screen_visible');
    await sleep(1200);
    await screenshot(page, '22-summary-screen.png', 'summary_screen', screenshots);

    const finalState = await page.evaluate(() => ({
      url: window.location.href,
      bodyText: document.body.innerText,
      checkpoint: window.localStorage.getItem('tong:shanghai:onboarding:h1'),
      gameStore: window.localStorage.getItem('tong-game'),
    }));
    let parsedGameStore = null;
    try {
      parsedGameStore = finalState.gameStore ? JSON.parse(finalState.gameStore) : null;
    } catch {
      parsedGameStore = null;
    }
    checks.mentionsProposal = checks.beat1ProposalLine;
    checks.mentionsShop = checks.mentionsShop || finalState.bodyText.includes('小笼包') || finalState.bodyText.toLowerCase().includes('xiaolongbao');
    checks.checkpointMarkedComplete = Boolean(finalState.checkpoint?.includes('"phase":"complete"'));
    checks.xpGranted = parsedGameStore?.xp === 80;
    checks.spGranted = parsedGameStore?.sp === 40;
    checks.locationHangoutRecorded = parsedGameStore?.locationHangoutCounts?.['shanghai:dumpling_shop'] === 1;
    checks.finalQuizRemoved = checks.finalQuizRemoved && !finalState.bodyText.includes('Put 方阿姨');

    const desktop = await browser.newPage();
    await desktop.setViewport(VIEWPORTS.desktop);
    await desktop.goto(route, { waitUntil: 'networkidle0', timeout: 30000 });
    await desktop.waitForSelector('.shanghai-onboarding__video', { visible: true });
    await screenshot(desktop, '23-desktop-intro.png', 'desktop_intro', screenshots);
    await desktop.close();

    const screencast = await recorder.stop();
    const video = buildVideo();

    const passed = [
      checks.videoElementVisible,
      checks.usesLoopingVideo,
      checks.startsInsideGameFrame,
      checks.mentionsProposal,
      checks.mentionsShop,
      checks.introChunkTapped,
      checks.introChunkTooltipVisible,
      checks.panReachedWebtoonWithoutShortcut,
      checks.chineseBubbleTokensInteractive,
      checks.chineseTooltipVisible,
      checks.matchingChineseTokensInteractive,
      checks.matchingChineseTooltipVisible,
      checks.webtoonVisibleDuringLanguageGate,
      checks.noPosterSnapDuringLanguageGate,
      checks.webtoonVisibleDuringExercise,
      checks.noPosterSnapDuringExercise,
      checks.beat1ProposalLine,
      checks.beat1FoodRedirect,
      checks.placeholderArtAfterP6,
      checks.beat2NoActLine,
      checks.beat2KeepPretendingLine,
      checks.phoneSfxVisible,
      checks.paymentSfxVisible,
      checks.registerRevealVisible,
      checks.noNarratorPhoneCopy,
      checks.hasHud,
      !checks.debugPanels,
      checks.summaryScreenVisible,
      checks.summaryTextVisible,
      checks.summaryXpVisible,
      checks.summarySpVisible,
      checks.finalQuizRemoved,
      checks.checkpointMarkedComplete,
      checks.xpGranted,
      checks.spGranted,
      checks.locationHangoutRecorded,
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
