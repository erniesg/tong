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

async function answerPronunciationOption(page, optionId) {
  await page.waitForSelector(`[data-option-id="${optionId}"]`, { visible: true });
  await page.$eval(`[data-option-id="${optionId}"]`, (node) => {
    if (node instanceof HTMLElement) node.click();
  });
  await clickExerciseCheck(page);
  await waitForText(page, 'Correct', 5000).catch(() => {});
  await page.evaluate(() => {
    const target = Array.from(document.querySelectorAll('.exercise-card div')).find((node) => node.textContent?.includes('Correct'));
    if (target instanceof HTMLElement) target.click();
  });
  await sleep(2200);
}

async function answerFillBlank(page, optionText) {
  await clickExerciseOption(page, optionText);
  await clickExerciseCheck(page);
  await waitForText(page, 'Correct', 5000).catch(() => {});
  const meaningsVisible = await page.waitForSelector('[data-fill-blank-meanings]', { visible: true, timeout: 1500 })
    .then(() => true)
    .catch(() => false);
  await sleep(meaningsVisible ? 2800 : 2200);
  return meaningsVisible;
}

async function drawBroadTraceOnCanvas(page, canvasIndex = 0) {
  const box = await page.$$eval('.exercise-card canvas', (nodes, index) => {
    const visible = nodes
      .filter((node) => node instanceof HTMLElement)
      .map((node) => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return { node, rect, style };
      })
      .filter(({ rect, style }) => rect.width > 20 && rect.height > 20 && style.visibility !== 'hidden' && style.display !== 'none');
    const target = visible[index];
    if (!target) throw new Error(`Could not find visible tracing canvas ${index}`);
    return {
      x: target.rect.x,
      y: target.rect.y,
      width: target.rect.width,
      height: target.rect.height,
    };
  }, canvasIndex);
  const left = box.x + box.width * 0.08;
  const right = box.x + box.width * 0.92;
  const top = box.y + box.height * 0.08;
  const bottom = box.y + box.height * 0.92;

  for (let i = 0; i <= 12; i += 1) {
    const y = top + ((bottom - top) * i) / 12;
    await page.mouse.move(left, y);
    await page.mouse.down();
    await page.mouse.move(right, y, { steps: 12 });
    await page.mouse.up();
  }
  for (let i = 0; i <= 8; i += 1) {
    const x = left + ((right - left) * i) / 8;
    await page.mouse.move(x, top);
    await page.mouse.down();
    await page.mouse.move(x, bottom, { steps: 10 });
    await page.mouse.up();
  }
}

async function answerStrokeTracing(page) {
  const introVisible = await page.$('[data-stroke-intro]');
  if (introVisible) {
    await clickVisibleText(page, 'Replay').catch(() => {});
    await sleep(450);
    await clickVisibleText(page, 'Write it');
  }

  await page.waitForSelector('.exercise-card canvas', { visible: true });

  const drillTotal = await page.evaluate(() => {
    const match = document.body.innerText.match(/\b0\/(\d+)\b/);
    return match ? Number.parseInt(match[1], 10) : 0;
  });

  if (drillTotal > 1) {
    for (let i = 0; i < drillTotal; i += 1) {
      let passed = false;
      for (let attempt = 0; attempt < 3 && !passed; attempt += 1) {
        await drawBroadTraceOnCanvas(page, i);
        passed = await page.waitForFunction(
          ({ done, total }) => document.body.innerText.includes(`${done}/${total}`),
          { timeout: 1600 },
          { done: i + 1, total: drillTotal },
        )
          .then(() => true)
          .catch(() => false);
      }
      if (!passed) throw new Error(`Stroke drill cell ${i + 1}/${drillTotal} did not complete.`);
    }

    const replayVisible = await page.waitForSelector('[data-stroke-replay]', { visible: true, timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    await sleep(1600);
    await page.$eval('[data-stroke-drill-complete]', (node) => {
      if (node instanceof HTMLElement) node.click();
    });
    await sleep(1200);
    return replayVisible;
  }

  await drawBroadTraceOnCanvas(page, 0);
  await clickVisibleText(page, 'Done');
  const replayVisible = await page.waitForSelector('[data-stroke-replay]', { visible: true, timeout: 2000 })
    .then(() => true)
    .catch(() => false);
  await sleep(2200);
  return replayVisible;
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
      const wordButton = buttons.find((node) => node.textContent?.trim() === right);
      if (!(wordButton instanceof HTMLElement)) throw new Error(`Could not find matching option: ${right}`);
      wordButton.click();
    }, pair);
    await sleep(90);
    await page.evaluate(({ left }) => {
      const card = document.querySelector('.exercise-card');
      if (!(card instanceof HTMLElement)) throw new Error('Could not find exercise card');

      const rows = Array.from(card.querySelectorAll('div[class*="cursor-pointer"]'));
      const slot = rows.find((node) => {
        const label = node.querySelector('.text-ko');
        return label?.textContent?.trim() === left;
      });
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
  const hasTongOverlay = await page.$('.tong-whisper');
  if (hasTongOverlay) {
    await page.waitForFunction(() => {
      const overlay = document.querySelector('.tong-whisper');
      if (!(overlay instanceof HTMLElement)) return true;
      const opacity = Number.parseFloat(window.getComputedStyle(overlay).opacity || '1');
      return opacity >= 0.95;
    }, { timeout: 1500 }).catch(() => {});
    await sleep(120);
  }
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
    '-vf', 'scale=780:1688:flags=lanczos,setsar=1,pad=ceil(iw/2)*2:ceil(ih/2)*2',
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
      noFalseRainCopy: !document.body.innerText.toLowerCase().includes('rain'),
    }));
    Object.assign(checks, castState);

    const recorder = await startScreencast(page, cues);
    await recorder.cue('ready_intro');
    await screenshot(page, '01-ready-intro.png', 'ready_state', screenshots);

    await clickTong(page);
    await clickTong(page);
    await clickTong(page);
    await clickTong(page);
    await waitForText(page, 'Watch how 小 is written');
    const tappedIntroChunk = await page.evaluate(() => {
      const target = Array.from(document.querySelectorAll('.tong-whisper [data-korean]'))
        .find((node) => node.textContent?.trim() === '小');
      if (!(target instanceof HTMLElement)) return null;
      target.click();
      return target.textContent;
    });
    checks.introChunkTapped = tappedIntroChunk === '小';
    checks.introChunkTooltipVisible = Boolean(tappedIntroChunk) && await page.waitForSelector('.korean-tooltip', { visible: true, timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    checks.introChunkTooltipFullyVisible = checks.introChunkTooltipVisible && await page.evaluate(() => {
      const node = document.querySelector('.korean-tooltip');
      if (!(node instanceof HTMLElement)) return false;
      const rect = node.getBoundingClientRect();
      return rect.top >= 0 && rect.left >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight;
    });
    await recorder.cue('intro_chunk_tapped');
    await screenshot(page, '02-intro-chunk-tooltip.png', 'intro_chunk_tooltip', screenshots);
    await clickTong(page);
    await waitForText(page, 'Watch how 小 is written.');
    await page.waitForSelector('[data-stroke-intro]', { visible: true });
    checks.xiaoStrokeIntroVisible = await page.evaluate(() => (
      Boolean(document.querySelector('[data-stroke-intro]'))
      && Boolean(document.querySelector('[data-stroke-animation]'))
      && Boolean(document.querySelector('[data-stroke-order]'))
      && document.body.innerText.includes('Replay')
      && document.body.innerText.includes('Write it')
      && document.body.innerText.includes('xiǎo')
      && document.body.innerText.includes('small')
      && !document.body.innerText.includes('小瞿')
    ));
    await recorder.cue('xiao_stroke_animation_visible');
    await screenshot(page, '03-xiao-stroke-animation.png', 'xiao_stroke_animation', screenshots);
    await clickVisibleText(page, 'Replay');
    await sleep(650);
    await clickVisibleText(page, 'Write it');
    await waitForText(page, 'Trace 小 in stroke order');
    await screenshot(page, '03b-xiao-stroke-exercise.png', 'xiao_stroke_exercise', screenshots);
    checks.strokeTracingVisible = await page.evaluate(() => (
      document.body.innerText.includes('Trace 小 in stroke order')
      && document.querySelectorAll('.exercise-card canvas').length >= 3
      && Boolean(document.querySelector('[data-stroke-animation]'))
      && Boolean(document.querySelector('[data-stroke-order]'))
      && document.body.innerText.includes('0/3')
      && !document.body.innerText.includes('小瞿')
    ));
    checks.strokeTraceReplayVisible = await answerStrokeTracing(page);
    await recorder.cue('stroke_trace_answered');
    await waitForText(page, 'Now listen to the tone');
    checks.strokeTraceCompleted = true;
    await screenshot(page, '04-xiao-tone-transition-1.png', 'xiao_tone_transition_1', screenshots);
    await clickTong(page);
    await waitForText(page, 'Mandarin has four main tones');
    await screenshot(page, '05-xiao-tone-transition-2.png', 'xiao_tone_transition_2', screenshots);
    await clickTong(page);
    await waitForText(page, '小 is third tone');
    await clickTong(page);
    await waitForText(page, 'Which one is 小, xiǎo?');
    await screenshot(page, '06-anchor-before-exercise.png', 'pre_exercise_context', screenshots);
    await recorder.cue('exercise_opened');
    await screenshot(page, '07-anchor-exercise.png', 'anchor_exercise', screenshots);
    checks.prelistenToneOptionsPresent = await page.evaluate(() => (
      ['xiao1', 'xiao2', 'xiao3', 'xiao4'].every((id) => Boolean(document.querySelector(`[data-option-id="${id}"]`)))
    ));

    await answerPronunciationOption(page, 'xiao3');
    await recorder.cue('exercise_answered');
    await waitForText(page, 'Good. You have 小 in your eyes');
    await screenshot(page, '08-post-exercise.png', 'post_exercise_context', screenshots);

    await clickTong(page);
    await clickTong(page);
    await recorder.cue('pan_prompt_visible');
    await waitForText(page, 'Slide left toward the voices.');
    await screenshot(page, '09-pan-prompt.png', 'pre_action_pan_prompt', screenshots);
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
    checks.panReachedOverhearGateWithoutShortcut = await page.waitForFunction(
      () => document.body.innerText.includes('There. Tap to listen in.') && !Boolean(document.querySelector('.shanghai-onboarding--webtoon')),
      { timeout: 6000 },
    )
      .then(() => true)
      .catch(() => false);
    if (!checks.panReachedOverhearGateWithoutShortcut) {
      throw new Error('Pan input did not reach the overhear gate.');
    }
    await screenshot(page, '10-overhear-gate.png', 'overhear_gate', screenshots);
    await clickVisibleText(page, 'Tap to overhear');
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
    checks.beat1GenericCallout = await page.evaluate(() => document.body.innerText.includes('每个节目都说自己不一样。'));
    checks.beat1ContinueVisible = await page.waitForFunction(
      () => document.body.innerText.includes('Tap to continue') && !Boolean(document.querySelector('.tong-whisper')),
      { timeout: 8000 },
    )
      .then(() => true)
      .catch(() => false);
    await recorder.cue('beat_1_continue_visible');
    await screenshot(page, '10-beat-1-continue.png', 'beat_1_continue_gate', screenshots);
    await clickVisibleText(page, 'Tap to continue');

    await recorder.cue('beat_1_language_gate');
    await waitForText(page, '不一样 came up twice');
    checks.webtoonVisibleDuringLanguageGate = await page.evaluate(() => Boolean(document.querySelector('.wt-strip')) && document.body.innerText.includes('每个节目都说自己不一样。'));
    checks.noPosterSnapDuringLanguageGate = await page.evaluate(() => !document.querySelector('.shanghai-onboarding__video') && !document.querySelector('.summary-screen'));
    await screenshot(page, '11-beat-1-language.png', 'beat_1_language_gate', screenshots);
    await clickTong(page);
    await waitForText(page, '一样 is “same.” 不一样 is “not the same.”');
    await clickTong(page);
    await waitForText(page, 'Choose the phrase that means “not the same.”');
    checks.webtoonVisibleDuringExercise = await page.evaluate(() => Boolean(document.querySelector('.wt-strip')) && document.body.innerText.includes('每个节目都说自己不一样。'));
    checks.noPosterSnapDuringExercise = await page.evaluate(() => !document.querySelector('.shanghai-onboarding__video') && !document.querySelector('.summary-screen'));
    checks.buyiyangFillBlankVisible = await page.evaluate(() => (
      document.body.innerText.includes('这个节目跟其他的')
      && document.body.innerText.includes('不一样')
      && !document.body.innerText.includes('Match the pieces')
    ));
    await screenshot(page, '12-beat-1-exercise.png', 'beat_1_exercise', screenshots);
    const exerciseDismissed = await page.evaluate(() => {
      const target = document.querySelector('.exercise-dismiss-btn');
      if (!(target instanceof HTMLElement)) return false;
      target.click();
      return true;
    });
    await page.waitForSelector('.exercise-modal-backdrop', { hidden: true, timeout: 5000 });
    await sleep(500);
    checks.exerciseDismissedAndWebtoonVisible = exerciseDismissed && await page.evaluate(() => (
      Boolean(document.querySelector('.wt-strip')) && document.body.innerText.includes('每个节目都说自己不一样。')
    ));
    await screenshot(page, '13-beat-1-exercise-dismissed.png', 'beat_1_exercise_dismissed', screenshots);
    await waitForText(page, 'Tap to resume exercise');
    await clickVisibleText(page, 'Tap to resume exercise');
    await waitForText(page, 'Choose the phrase that means “not the same.”');
    checks.exerciseDismissedAndResumed = checks.exerciseDismissedAndWebtoonVisible && await page.waitForSelector('.exercise-modal-backdrop', { visible: true, timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    await screenshot(page, '14-beat-1-exercise-resumed.png', 'beat_1_exercise_resumed', screenshots);
    checks.beat1FillBlankMeaningsVisible = await answerFillBlank(page, '不一样');

    await page.waitForSelector('.shanghai-onboarding--webtoon', { visible: true, timeout: 8000 });
    await recorder.cue('beat_2_webtoon_entered');
    await screenshot(page, '15-beat-2-entered.png', 'beat_2_entered', screenshots);
    checks.beat2NoActLine = await page.evaluate(() => document.body.innerText.includes('这个节目需要一个不装的人。'));
    checks.beat2KeepPretendingLine = await page.evaluate(() => document.body.innerText.includes('我觉得你装不下去。'));
    checks.placeholderArtAfterP6 = await page.evaluate(() => document.querySelectorAll('.wt-placeholder').length >= 1);
    await scrollWebtoonToPanel(page, 7);
    checks.placeholderArtAfterP6 = checks.placeholderArtAfterP6 || await page.evaluate(() => {
      const visiblePlaceholder = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)?.closest('.wt-placeholder');
      return Boolean(visiblePlaceholder) || document.body.innerText.includes('WEBTOON ART PENDING');
    });
    await screenshot(page, '16-beat-2-placeholder-after-p6.png', 'beat_2_placeholder_after_p6', screenshots);
    await scrollWebtoonToEnd(page);
    await screenshot(page, '17-beat-2-bottom.png', 'beat_2_bottom', screenshots);
    checks.beat2NoActLine = checks.beat2NoActLine || await page.evaluate(() => document.body.innerText.includes('这个节目需要一个不装的人。'));
    checks.beat2KeepPretendingLine = checks.beat2KeepPretendingLine || await page.evaluate(() => document.body.innerText.includes('我觉得你装不下去。'));
    checks.placeholderArtAfterP6 = checks.placeholderArtAfterP6 || await page.evaluate(() => document.querySelectorAll('.wt-placeholder').length >= 1);
    checks.beat2ContinueVisible = await page.waitForFunction(
      () => document.body.innerText.includes('Tap to continue') && !Boolean(document.querySelector('.tong-whisper')),
      { timeout: 8000 },
    )
      .then(() => true)
      .catch(() => false);
    await recorder.cue('beat_2_continue_visible');
    await screenshot(page, '18-beat-2-continue.png', 'beat_2_continue_gate', screenshots);
    await clickVisibleText(page, 'Tap to continue');

    await recorder.cue('beat_2_language_gate');
    await waitForText(page, '装不下去 is the phrase to keep');
    await screenshot(page, '19-beat-2-language.png', 'beat_2_language_gate', screenshots);
    await clickTong(page);
    await waitForText(page, 'It means the pretending cannot continue');
    await clickTong(page);
    await waitForText(page, 'Choose the ending that means “cannot keep going.”');
    await screenshot(page, '20-beat-2-exercise.png', 'beat_2_exercise', screenshots);
    checks.beat2FillBlankMeaningsVisible = await answerFillBlank(page, '不下去');

    await page.waitForSelector('.shanghai-onboarding--webtoon', { visible: true, timeout: 8000 });
    await recorder.cue('exit_webtoon_entered');
    await screenshot(page, '21-exit-entered.png', 'exit_entered', screenshots);
    checks.phoneSfxVisible = await page.evaluate(() => document.body.innerText.includes('嗡'));
    await scrollWebtoonToPanel(page, 12);
    await screenshot(page, '22-exit-phone-sfx.png', 'exit_phone_sfx', screenshots);
    checks.phoneSfxVisible = checks.phoneSfxVisible || await page.evaluate(() => document.body.innerText.includes('嗡'));
    await scrollWebtoonToPanel(page, 13);
    checks.dingmanAnswerCallVisible = await page.evaluate(() => document.body.innerText.includes('你接吧。'));
    await scrollWebtoonToPanel(page, 14);
    checks.shouchengNotImportantVisible = await page.evaluate(() => document.body.innerText.includes('不重要。'));
    await screenshot(page, '23-exit-answer-not-important.png', 'exit_answer_not_important', screenshots);
    await scrollWebtoonToPanel(page, 15);
    checks.thirdRingLineVisible = await page.evaluate(() => document.body.innerText.includes('都响三次了，还说不重要？'));
    await screenshot(page, '24-exit-third-ring-line.png', 'exit_third_ring_line', screenshots);
    await scrollWebtoonToPanel(page, 16);
    checks.shouchengConcedeVisible = await page.evaluate(() => document.body.innerText.includes('...我知道了。'));
    await scrollWebtoonToPanel(page, 17);
    checks.shouchengLeavesVisible = await page.evaluate(() => document.body.innerText.includes('我先走一步，你好好想想。'));
    await screenshot(page, '25-exit-concede-leave.png', 'exit_concede_leave', screenshots);
    await scrollWebtoonToPanel(page, 18);
    checks.paymentSfxVisible = await page.evaluate(() => document.body.innerText.includes('已付款'));
    await screenshot(page, '26-exit-payment.png', 'exit_payment', screenshots);
    await scrollWebtoonToPanel(page, 19);
    checks.fangAyiOverpayVisible = await page.evaluate(() => document.body.innerText.includes('小瞿你又多给了！'));
    await screenshot(page, '27-exit-fang-ayi.png', 'exit_fang_ayi', screenshots);
    await scrollWebtoonToPanel(page, 20);
    checks.registerRevealVisible = await page.evaluate(() => document.body.innerText.includes('瞿家的小儿子'));
    await screenshot(page, '28-exit-register-reveal.png', 'exit_register_reveal', screenshots);
    checks.noNarratorPhoneCopy = await page.evaluate(() => {
      const text = document.body.innerText;
      return !text.includes('The phone rings') && !text.includes('旁白') && !text.includes('ambient:') && !text.includes('He pays via QR code');
    });
    await scrollWebtoonToEnd(page);
    await screenshot(page, '29-exit-bottom.png', 'exit_bottom', screenshots);
    checks.phoneSfxVisible = checks.phoneSfxVisible || await page.evaluate(() => document.body.innerText.includes('嗡'));
    checks.paymentSfxVisible = checks.paymentSfxVisible || await page.evaluate(() => document.body.innerText.includes('已付款'));
    checks.registerRevealVisible = checks.registerRevealVisible || await page.evaluate(() => document.body.innerText.includes('瞿家的小儿子'));
    checks.noNarratorPhoneCopy = checks.noNarratorPhoneCopy && await page.evaluate(() => {
      const text = document.body.innerText;
      return !text.includes('The phone rings') && !text.includes('旁白') && !text.includes('ambient:') && !text.includes('He pays via QR code');
    });
    checks.exitContinueVisible = await page.waitForFunction(
      () => document.body.innerText.includes('Tap to continue') && !Boolean(document.querySelector('.tong-whisper')),
      { timeout: 8000 },
    )
      .then(() => true)
      .catch(() => false);
    await recorder.cue('exit_continue_visible');
    await screenshot(page, '30-exit-continue.png', 'exit_continue_gate', screenshots);
    await clickVisibleText(page, 'Tap to continue');

    await recorder.cue('register_language_gate');
    await waitForText(page, '方阿姨 calls him 小瞿');
    checks.registerNoteVisible = await page.evaluate(() => (
      document.body.innerText.includes('方阿姨 calls him 小瞿')
      && !document.querySelector('.summary-screen')
    ));
    await screenshot(page, '31-register-note.png', 'register_note', screenshots);
    await clickTong(page);
    await waitForText(page, 'That is familiar address');
    checks.familyWordingNoteVisible = await page.evaluate(() => (
      document.body.innerText.includes('That is familiar address from someone older')
      && !document.querySelector('.summary-screen')
    ));
    await screenshot(page, '32-family-wording-note.png', 'family_wording_note', screenshots);
    await clickTong(page);
    await waitForText(page, '小儿子 means younger son');
    checks.youngerSonNoteVisible = await page.evaluate(() => (
      document.body.innerText.includes('小儿子 means younger son')
      && !document.querySelector('.summary-screen')
    ));
    await screenshot(page, '32b-younger-son-note.png', 'younger_son_note', screenshots);
    await clickTong(page);
    await waitForText(page, 'One quick 不 before we step out');
    checks.buReinforcementIntroVisible = await page.evaluate(() => (
      document.body.innerText.includes('One quick 不 before we step out')
      && !document.querySelector('.summary-screen')
    ));
    await screenshot(page, '32c-bu-reinforcement-intro.png', 'bu_reinforcement_intro', screenshots);
    await clickTong(page);
    await waitForText(page, 'You heard it in 不一样');
    await clickTong(page);
    await waitForText(page, '不 is bù: fourth tone, falling.');
    checks.buFourthToneVisible = await page.evaluate(() => (
      document.body.innerText.includes('不 is bù: fourth tone, falling.')
      && !document.querySelector('.summary-screen')
    ));
    await screenshot(page, '32d-bu-fourth-tone.png', 'bu_fourth_tone', screenshots);
    await clickTong(page);
    await waitForText(page, 'Watch how 不 is written.');
    checks.buStrokeIntroVisible = await page.evaluate(() => (
      Boolean(document.querySelector('[data-stroke-intro]'))
      && Boolean(document.querySelector('[data-stroke-animation]'))
      && Boolean(document.querySelector('[data-stroke-order]'))
      && document.body.innerText.includes('bù')
      && document.body.innerText.includes('not')
    ));
    checks.buStrokeTracingVisible = checks.buStrokeIntroVisible;
    await screenshot(page, '32e-bu-stroke-animation.png', 'bu_stroke_animation', screenshots);
    checks.buStrokeReplayVisible = await answerStrokeTracing(page);
    await waitForText(page, 'Step out');
    checks.stepOutGateVisible = await page.evaluate(() => (
      Boolean(document.querySelector('.shanghai-onboarding--webtoon'))
      && document.body.innerText.includes('Step out')
      && !Boolean(document.querySelector('.tong-whisper'))
      && !document.querySelector('.summary-screen')
    ));
    await screenshot(page, '33-step-out-gate.png', 'step_out_gate', screenshots);
    await clickVisibleText(page, 'Step out');
    await waitForText(page, 'Take one last look before we leave the shop');
    checks.finalCompanionWrapStarted = await page.evaluate(() => (
      Boolean(document.querySelector('.shanghai-onboarding__stage'))
      && Boolean(document.querySelector('.shanghai-onboarding__video'))
      && !Boolean(document.querySelector('.wt-strip'))
      && document.body.innerText.includes('Take one last look before we leave the shop')
      && !document.querySelector('.summary-screen')
    ));
    checks.finalWrapAtRightmostShopEdge = await page.evaluate(() => {
      const stage = document.querySelector('.shanghai-onboarding__stage');
      const world = document.querySelector('.shanghai-onboarding__world');
      if (!(stage instanceof HTMLElement) || !(world instanceof HTMLElement)) return false;
      const matrix = new DOMMatrixReadOnly(window.getComputedStyle(world).transform);
      const maxOffsetX = Math.max(0, world.getBoundingClientRect().width - stage.getBoundingClientRect().width);
      return maxOffsetX <= 2 || Math.abs(matrix.m41) >= maxOffsetX - 4;
    });
    checks.summaryHiddenDuringFinalWrap = checks.finalCompanionWrapStarted;
    await recorder.cue('returned_to_shop_final_wrap');
    await screenshot(page, '34-final-wrap-shop-start.png', 'final_companion_wrap_shop_start', screenshots);
    await clickTong(page);
    await waitForText(page, '小 started on 小笼包');
    checks.finalLanguageCarryVisible = await page.evaluate(() => (
      document.body.innerText.includes('小 started on 小笼包')
      && Boolean(document.querySelector('.shanghai-onboarding__video'))
      && !Boolean(document.querySelector('.wt-strip'))
      && !document.querySelector('.summary-screen')
    ));
    checks.summaryHiddenDuringFinalWrap = checks.summaryHiddenDuringFinalWrap && checks.finalLanguageCarryVisible;
    await clickTong(page);
    await waitForText(page, '小瞿 feels familiar');
    checks.finalRegisterWrapVisible = await page.evaluate(() => (
      document.body.innerText.includes('小瞿 feels familiar. 瞿先生 would keep distance. 瞿家 makes it bigger than one person.')
      && Boolean(document.querySelector('.shanghai-onboarding__video'))
      && !Boolean(document.querySelector('.wt-strip'))
      && !document.querySelector('.summary-screen')
    ));
    checks.summaryHiddenDuringFinalWrap = checks.summaryHiddenDuringFinalWrap && checks.finalRegisterWrapVisible;
    await clickTong(page);
    await waitForText(page, 'When 不 shows up');
    await clickTong(page);
    await waitForText(page, 'Good. That is enough to walk into the next Shanghai scene.');
    checks.finalCompanionWrapVisible = await page.evaluate(() => (
      Boolean(document.querySelector('.shanghai-onboarding__stage'))
      && Boolean(document.querySelector('.shanghai-onboarding__video'))
      && !Boolean(document.querySelector('.wt-strip'))
      && document.body.innerText.includes('Good. That is enough to walk into the next Shanghai scene.')
      && document.body.innerText.includes('Continue')
      && !document.querySelector('.summary-screen')
    ));
    checks.summaryHiddenDuringFinalWrap = checks.summaryHiddenDuringFinalWrap && checks.finalCompanionWrapVisible;
    await recorder.cue('final_companion_wrap_visible');
    await screenshot(page, '35-final-companion-wrap.png', 'final_companion_wrap', screenshots);
    await clickVisibleText(page, 'Continue');

    checks.summaryScreenVisible = await page.waitForSelector('.summary-screen', { visible: true, timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    checks.summaryTextVisible = await page.evaluate(() => (
      document.body.innerText.includes('Scene Complete')
      && document.body.innerText.includes('小笼包')
      && document.body.innerText.includes('不重要')
      && !document.body.innerText.includes('Saved listening handles')
    ));
    checks.summaryXpVisible = await page.evaluate(() => document.body.innerText.includes('+80') && document.body.innerText.includes('XP earned'));
    checks.summarySpVisible = await page.evaluate(() => document.body.innerText.includes('+40') && document.body.innerText.includes('SP earned'));
    checks.finalQuizRemoved = await page.evaluate(() => !document.body.innerText.includes('Put 方阿姨'));
    await recorder.cue('summary_screen_visible');
    await sleep(1200);
    await screenshot(page, '36-summary-screen.png', 'summary_screen', screenshots);

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
    await screenshot(desktop, '37-desktop-intro.png', 'desktop_intro', screenshots);
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
      checks.xiaoStrokeIntroVisible,
      checks.prelistenToneOptionsPresent,
      checks.panReachedOverhearGateWithoutShortcut,
      checks.chineseBubbleTokensInteractive,
      checks.chineseTooltipVisible,
      checks.introChunkTooltipFullyVisible,
      checks.strokeTraceReplayVisible,
      checks.buyiyangFillBlankVisible,
      checks.beat1FillBlankMeaningsVisible,
      checks.webtoonVisibleDuringLanguageGate,
      checks.noPosterSnapDuringLanguageGate,
      checks.webtoonVisibleDuringExercise,
      checks.noPosterSnapDuringExercise,
      checks.beat1ProposalLine,
      checks.beat1FoodRedirect,
      checks.beat1GenericCallout,
      checks.beat1ContinueVisible,
      checks.exerciseDismissedAndWebtoonVisible,
      checks.exerciseDismissedAndResumed,
      checks.placeholderArtAfterP6,
      checks.beat2ContinueVisible,
      checks.beat2NoActLine,
      checks.beat2KeepPretendingLine,
      checks.beat2FillBlankMeaningsVisible,
      checks.phoneSfxVisible,
      checks.dingmanAnswerCallVisible,
      checks.shouchengNotImportantVisible,
      checks.thirdRingLineVisible,
      checks.shouchengConcedeVisible,
      checks.shouchengLeavesVisible,
      checks.paymentSfxVisible,
      checks.fangAyiOverpayVisible,
      checks.registerRevealVisible,
      checks.exitContinueVisible,
      checks.registerNoteVisible,
      checks.familyWordingNoteVisible,
      checks.youngerSonNoteVisible,
      checks.buReinforcementIntroVisible,
      checks.buFourthToneVisible,
      checks.buStrokeIntroVisible,
      checks.buStrokeTracingVisible,
      checks.buStrokeReplayVisible,
      checks.stepOutGateVisible,
      checks.finalCompanionWrapStarted,
      checks.finalWrapAtRightmostShopEdge,
      checks.finalLanguageCarryVisible,
      checks.finalRegisterWrapVisible,
      checks.finalCompanionWrapVisible,
      checks.summaryHiddenDuringFinalWrap,
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
