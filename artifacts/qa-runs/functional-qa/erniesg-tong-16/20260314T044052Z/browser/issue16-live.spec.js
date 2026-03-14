const fs = require('fs');
const path = require('path');
const { test, expect } = require('playwright/test');

const runDir = '/Users/erniesg/code/erniesg/tong/artifacts/qa-runs/functional-qa/erniesg-tong-16/20260314T044052Z';
const screenshotDir = path.join(runDir, 'screenshots');
const logDir = path.join(runDir, 'logs');
const qaUrl = 'http://localhost:3101/game?dev_intro=1&demo=TONG-JUDGE-DEMO&qa_run_id=functional-qa-validate-issue-20260314T044052Z-erniesg-tong-16&qa_trace=1';

test.use({
  viewport: { width: 430, height: 932 },
});

test('captures live-model dialogue and tooltip for issue 16', async ({ page }) => {
  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });

  const consoleLines = [];
  page.on('console', (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => consoleLines.push(`[pageerror] ${err.stack || err.message}`));

  await page.goto(qaUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window !== 'undefined' && !!window.__TONG_QA__, undefined, { timeout: 120000 });

  let state = null;
  for (let i = 0; i < 90; i++) {
    state = await page.evaluate(() => window.__TONG_QA__.getState());

    if (state.tongTip && !state.currentMessage) {
      const whisper = page.locator('.tong-whisper');
      if (await whisper.count()) {
        await whisper.click({ force: true });
      }
    } else if (!state.currentMessage && !state.tongTip) {
      const continueLabel = page.locator('.scene-continue-label');
      if (await continueLabel.count()) {
        await continueLabel.first().click({ force: true });
      }
    }

    if (state.currentMessage) break;
    await page.waitForTimeout(1200);
  }

  expect(state?.currentMessage).toBeTruthy();

  await page.waitForSelector('.dialogue-subtitle', { timeout: 20000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(screenshotDir, 'live-dialogue.png'), fullPage: true });

  const dialogueText = await page.locator('.dialogue-subtitle').innerText();
  expect(dialogueText).toMatch(/[가-힣]/);
  expect(dialogueText).not.toMatch(/\([A-Za-z-]+\)/);
  expect(dialogueText).not.toMatch(/\bpojangmacha\b/i);
  expect(dialogueText).not.toMatch(/\bjuseyo\b/i);

  const token = page.locator('[data-korean]').first();
  await token.click({ force: true });
  await page.waitForSelector('.korean-tooltip', { timeout: 10000 });
  await page.screenshot({ path: path.join(screenshotDir, 'live-tooltip.png'), fullPage: true });

  const tooltipText = await page.locator('.korean-tooltip').innerText();
  const qaState = await page.evaluate(() => window.__TONG_QA__.getState());
  const qaLogs = await page.evaluate(() => window.__TONG_QA__.getLogs());

  fs.writeFileSync(path.join(logDir, 'browser-console.log'), consoleLines.join('\n'));
  fs.writeFileSync(path.join(logDir, 'qa-state.json'), JSON.stringify(qaState, null, 2));
  fs.writeFileSync(path.join(logDir, 'qa-logs.json'), JSON.stringify(qaLogs, null, 2));
  fs.writeFileSync(path.join(logDir, 'captured-text.json'), JSON.stringify({ dialogueText, tooltipText }, null, 2));
});
