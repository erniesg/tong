#!/usr/bin/env node

import http from "node:http";
import { createReadStream } from "node:fs";
import { access, cp, mkdir, mkdtemp, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = path.resolve(__dirname, "../artifacts");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function printUsage() {
  console.error("Usage: node scripts/export-poster-variation.mjs <poster-id> [--out path] [--port 4173]");
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const parsed = {
    posterId: "",
    out: "",
    port: 4173
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!parsed.posterId && !arg.startsWith("--")) {
      parsed.posterId = arg;
      continue;
    }
    if (arg === "--out") {
      parsed.out = args[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg === "--port") {
      parsed.port = Number(args[i + 1] || parsed.port);
      i += 1;
      continue;
    }
  }

  if (!parsed.posterId) {
    printUsage();
    process.exit(1);
  }

  if (!parsed.out) {
    parsed.out = path.resolve(artifactsDir, `poster-${parsed.posterId}.png`);
  } else {
    parsed.out = path.resolve(process.cwd(), parsed.out);
  }

  return parsed;
}

function safeJoin(rootDir, requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0]);
  const pathname = decoded === "/" ? "/poster-variations.html" : decoded;
  const normalized = path.normalize(path.join(rootDir, pathname));
  if (!normalized.startsWith(rootDir)) return null;
  return normalized;
}

async function startStaticServer(rootDir, port) {
  const server = http.createServer(async (req, res) => {
    const filePath = safeJoin(rootDir, req.url || "/");
    if (!filePath) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    try {
      const info = await stat(filePath);
      const finalPath = info.isDirectory() ? path.join(filePath, "index.html") : filePath;
      const ext = path.extname(finalPath).toLowerCase();
      res.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream"
      });
      createReadStream(finalPath).pipe(res);
    } catch (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });

  return server;
}

async function ensureOutputDir(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

function getChromeLocalStorageDir() {
  if (process.platform === "darwin") {
    return path.join(process.env.HOME || "", "Library/Application Support/Google/Chrome/Default/Local Storage");
  }
  if (process.platform === "win32") {
    return path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/User Data/Default/Local Storage");
  }
  return path.join(process.env.HOME || "", ".config/google-chrome/Default/Local Storage");
}

async function copyChromeProfileLocalStorage() {
  const source = getChromeLocalStorageDir();
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "poster-export-profile-"));
  const destination = path.join(userDataDir, "Default", "Local Storage");
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
  return userDataDir;
}

async function readSavedFileLayout(browser) {
  const page = await browser.newPage();
  try {
    await page.goto(`file://${path.join(artifactsDir, "poster-variations.html")}`, { waitUntil: "networkidle2" });
    return await page.evaluate(() => localStorage.getItem("poster-layout"));
  } catch {
    return null;
  } finally {
    await page.close();
  }
}

async function exportPoster({ posterId, out, port }) {
  await access(path.join(artifactsDir, "poster-variations.html"));
  await ensureOutputDir(out);

  const server = await startStaticServer(artifactsDir, port);
  let browser;

  try {
    let savedLayout = null;
    try {
      const userDataDir = await copyChromeProfileLocalStorage();
      browser = await puppeteer.launch({ headless: "new", userDataDir });
      savedLayout = await readSavedFileLayout(browser);
      if (savedLayout) {
        console.error(`Using saved file:// layout (${savedLayout.length} chars)`);
      }
    } catch (error) {
      console.error(`Saved layout unavailable; exporting current default positions. ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!browser) {
      browser = await puppeteer.launch({ headless: "new" });
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 2400, deviceScaleFactor: 2 });
    if (savedLayout) {
      await page.evaluateOnNewDocument((layout) => {
        localStorage.setItem("poster-layout", layout);
      }, savedLayout);
    }
    await page.goto(`http://127.0.0.1:${port}/poster-variations.html`, { waitUntil: "networkidle2" });
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
    });
    await page.evaluate((targetPosterId) => {
      const cards = [...document.querySelectorAll(".poster-card")];
      const card = cards.find((item) => item.querySelector(".poster-number")?.textContent.trim() === targetPosterId);
      if (!card) return;
      window.loadSavedLayout?.();
      window.syncMirror?.();
    }, posterId);
    await new Promise((resolve) => setTimeout(resolve, 250));
    await page.waitForSelector(".poster-card");

    const clip = await page.evaluate((targetPosterId) => {
      const parseInsetValue = (raw, base) => {
        const value = (raw || "").trim();
        if (!value) return 0;
        if (value.endsWith("%")) return (parseFloat(value) / 100) * base;
        if (value.endsWith("px")) return parseFloat(value);
        const numeric = parseFloat(value);
        return Number.isFinite(numeric) ? numeric : 0;
      };

      document.querySelectorAll(".piece-info, .piece-selection, .snap-guide, .dist-guide, .layout-toolbar").forEach((el) => {
        el.style.display = "none";
      });

      const cards = [...document.querySelectorAll(".poster-card")];
      const card = cards.find((item) => item.querySelector(".poster-number")?.textContent.trim() === targetPosterId);
      if (!card) {
        throw new Error(`Poster ${targetPosterId} not found`);
      }

      const poster = card.querySelector(".poster");
      if (!poster) throw new Error(`Poster ${targetPosterId} element missing`);
      poster.scrollIntoView({ block: "center", inline: "center" });

      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      const rect = poster.getBoundingClientRect();
      const styles = getComputedStyle(poster);
      const insetTop = parseInsetValue(styles.getPropertyValue("--export-inset-top"), rect.height);
      const insetRight = parseInsetValue(styles.getPropertyValue("--export-inset-right"), rect.width);
      const insetBottom = parseInsetValue(styles.getPropertyValue("--export-inset-bottom"), rect.height);
      const insetLeft = parseInsetValue(styles.getPropertyValue("--export-inset-left"), rect.width);

      return {
        x: scrollX + rect.left + insetLeft,
        y: scrollY + rect.top + insetTop,
        width: rect.width - insetLeft - insetRight,
        height: rect.height - insetTop - insetBottom
      };
    }, posterId);

    await page.screenshot({
      path: out,
      clip
    });

    console.log(out);
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

const options = parseArgs(process.argv);
exportPoster(options).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
