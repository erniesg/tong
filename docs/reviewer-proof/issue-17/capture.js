const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const outDir = __dirname;

async function main() {
  console.log('launch');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });

  const url = 'http://localhost:3202/game?dev_intro=1&demo=TONG-DEMO-ACCESS&qa_trace=1&qa_run_id=reviewer-proof-issue-17';
  console.log('goto', url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

  console.log('wait ready');
  await page.waitForFunction(
    () => window.__TONG_QA__ && window.__TONG_QA__.getState().currentMessage && !window.__TONG_QA__.getState().chatLoading && document.querySelector('.dialogue-continue'),
    { timeout: 30000 },
  );
  console.log('screenshot 1');
  await page.screenshot({ path: path.join(outDir, '01-ready-continue.png') });
  fs.writeFileSync(path.join(outDir, '01-ready-state.json'), JSON.stringify(await page.evaluate(() => window.__TONG_QA__.getState()), null, 2));

  console.log('click dialogue');
  await page.click('.dialogue-subtitle');
  console.log('wait tong');
  await page.waitForFunction(() => !!window.__TONG_QA__.getState().tongTip, { timeout: 30000 });
  console.log('screenshot 2');
  await page.screenshot({ path: path.join(outDir, '02-tong-whisper.png') });
  fs.writeFileSync(path.join(outDir, '02-tong-whisper-state.json'), JSON.stringify(await page.evaluate(() => window.__TONG_QA__.getState()), null, 2));

  console.log('click tong');
  await page.click('.tong-whisper');
  console.log('wait next beat');
  await page.waitForFunction(
    () => !!window.__TONG_QA__.getState().currentMessage && !window.__TONG_QA__.getState().tongTip,
    { timeout: 30000 },
  );
  console.log('screenshot 3');
  await page.screenshot({ path: path.join(outDir, '03-next-beat.png') });
  fs.writeFileSync(path.join(outDir, '03-next-beat-state.json'), JSON.stringify(await page.evaluate(() => window.__TONG_QA__.getState()), null, 2));

  await browser.close();
  console.log('done');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
