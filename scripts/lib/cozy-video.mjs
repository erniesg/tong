// Optional recording for the cozy browser proofs (reviewer proof, docs/qa-evidence-uploads.md).
// With COZY_VIDEO_DIR set, each page is recorded and saved there as <tag>.webm when it closes;
// without it, pages open as before.
import path from 'node:path';

export async function openPage(browser, options) {
  const dir = process.env.COZY_VIDEO_DIR;
  if (!dir) return browser.newPage(options);
  // Three-quarter size keeps the encoder's load down on a busy host.
  const size = { width: Math.round(options.viewport.width * 0.75 / 2) * 2, height: Math.round(options.viewport.height * 0.75 / 2) * 2 };
  const context = await browser.newContext({ ...options, recordVideo: { dir, size } });
  return context.newPage();
}

export async function closePage(page, tag) {
  const video = page.video();
  await page.close();
  if (!video) return;
  await video.saveAs(path.join(process.env.COZY_VIDEO_DIR, `${tag}.webm`));
  await page.context().close();
}
