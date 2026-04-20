#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { relativeToRepo, resolveRepoRoot } from "./lib/qa_evidence.mjs";

const DEFAULT_BUCKET = "tong-assets";
const DEFAULT_PUBLIC_BASE_URL = "https://assets.tong.berlayar.ai";
const DEFAULT_RUNTIME_MANIFEST_KEY = "runtime-assets/manifest.json";
const DEFAULT_CANONICAL_MANIFEST_KEY = "runtime-assets/canonical-asset-manifest.json";
const DEFAULT_PUBLIC_VERIFY_ATTEMPTS = 4;
const DEFAULT_PUBLIC_VERIFY_DELAY_MS = 1500;
const DEFAULT_PUBLIC_VERIFY_TIMEOUT_MS = 15000;

const CLIENT_PUBLIC_ASSETS_DIR = "apps/client/public/assets";
const RUNTIME_MANIFEST_PATH = "assets/manifest/runtime-asset-manifest.json";
const CANONICAL_MANIFEST_PATH = "assets/manifest/canonical-asset-manifest.json";
const DEFAULT_CACHE_PATH = ".r2-upload-cache.json";
const DEFAULT_CONCURRENCY = 6;

function parseArgs(argv) {
  const args = {
    bucket: process.env.TONG_ASSETS_R2_BUCKET || DEFAULT_BUCKET,
    canonicalManifestKey: DEFAULT_CANONICAL_MANIFEST_KEY,
    dryRun: false,
    publicBaseUrl: process.env.NEXT_PUBLIC_TONG_ASSETS_BASE_URL || DEFAULT_PUBLIC_BASE_URL,
    publicVerifyAttempts: DEFAULT_PUBLIC_VERIFY_ATTEMPTS,
    publicVerifyDelayMs: DEFAULT_PUBLIC_VERIFY_DELAY_MS,
    publicVerifyTimeoutMs: DEFAULT_PUBLIC_VERIFY_TIMEOUT_MS,
    runtimeManifestKey: process.env.TONG_RUNTIME_ASSET_MANIFEST_KEY || DEFAULT_RUNTIME_MANIFEST_KEY,
    skipPublicVerification: false,
    cachePath: DEFAULT_CACHE_PATH,
    skipCache: false,
    concurrency: DEFAULT_CONCURRENCY,
    wranglerConfig: "apps/client/wrangler.toml",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--bucket") {
      args.bucket = argv[++i];
    } else if (arg === "--public-base-url") {
      args.publicBaseUrl = argv[++i];
    } else if (arg === "--runtime-manifest-key") {
      args.runtimeManifestKey = argv[++i];
    } else if (arg === "--canonical-manifest-key") {
      args.canonicalManifestKey = argv[++i];
    } else if (arg === "--wrangler-config") {
      args.wranglerConfig = argv[++i];
    } else if (arg === "--public-verify-attempts") {
      args.publicVerifyAttempts = Number(argv[++i]);
    } else if (arg === "--public-verify-delay-ms") {
      args.publicVerifyDelayMs = Number(argv[++i]);
    } else if (arg === "--public-verify-timeout-ms") {
      args.publicVerifyTimeoutMs = Number(argv[++i]);
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--skip-public-verification") {
      args.skipPublicVerification = true;
    } else if (arg === "--cache-path") {
      args.cachePath = argv[++i];
    } else if (arg === "--skip-cache") {
      args.skipCache = true;
    } else if (arg === "--concurrency") {
      args.concurrency = Number(argv[++i]);
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.bucket) {
    throw new Error("Missing bucket name. Set --bucket or TONG_ASSETS_R2_BUCKET.");
  }
  if (!args.publicBaseUrl) {
    throw new Error("Missing public base URL. Set --public-base-url or NEXT_PUBLIC_TONG_ASSETS_BASE_URL.");
  }
  if (!args.runtimeManifestKey) {
    throw new Error("Missing runtime manifest key. Set --runtime-manifest-key or TONG_RUNTIME_ASSET_MANIFEST_KEY.");
  }
  if (!Number.isFinite(args.publicVerifyAttempts) || args.publicVerifyAttempts < 1) {
    throw new Error("`--public-verify-attempts` must be a positive number.");
  }
  if (!Number.isFinite(args.publicVerifyDelayMs) || args.publicVerifyDelayMs < 0) {
    throw new Error("`--public-verify-delay-ms` must be zero or greater.");
  }
  if (!Number.isFinite(args.publicVerifyTimeoutMs) || args.publicVerifyTimeoutMs < 1) {
    throw new Error("`--public-verify-timeout-ms` must be a positive number.");
  }
  if (!Number.isFinite(args.concurrency) || args.concurrency < 1 || !Number.isInteger(args.concurrency)) {
    throw new Error("`--concurrency` must be a positive integer.");
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/upload-runtime-assets.mjs [options]

Uploads runtime product assets to the tong-assets R2 bucket and optionally verifies
that the public asset URLs are readable.

Options:
  --bucket <name>                R2 bucket name (default: ${DEFAULT_BUCKET})
  --public-base-url <url>        Public runtime asset base URL (default: ${DEFAULT_PUBLIC_BASE_URL})
  --runtime-manifest-key <key>   Bucket key for runtime manifest (default: ${DEFAULT_RUNTIME_MANIFEST_KEY})
  --canonical-manifest-key <key> Bucket key for canonical manifest (default: ${DEFAULT_CANONICAL_MANIFEST_KEY})
  --wrangler-config <path>       Wrangler config path (default: apps/client/wrangler.toml)
  --public-verify-attempts <n>   Retry count for public URL checks (default: ${DEFAULT_PUBLIC_VERIFY_ATTEMPTS})
  --public-verify-delay-ms <n>   Delay between public URL checks (default: ${DEFAULT_PUBLIC_VERIFY_DELAY_MS})
  --public-verify-timeout-ms <n> Timeout per public URL check (default: ${DEFAULT_PUBLIC_VERIFY_TIMEOUT_MS})
  --skip-public-verification     Skip GET-based public URL checks after upload
  --cache-path <path>            Cache file path for md5 diff uploads (default: ${DEFAULT_CACHE_PATH})
  --skip-cache                   Ignore md5 cache and upload every file
  --concurrency <n>              Max parallel wrangler uploads (default: ${DEFAULT_CONCURRENCY})
  --dry-run                      Print the planned upload set without uploading
`);
}

function runCommand(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    stdio: options.stdio || "pipe",
    cwd: options.cwd,
    env: options.env || process.env,
  });

  if (result.status !== 0) {
    const details = result.stderr || result.stdout || `exit code ${result.status}`;
    throw new Error(`${command} ${commandArgs.join(" ")} failed: ${details.trim()}`);
  }

  return (result.stdout || "").trim();
}

function fileMd5(filePath) {
  const hash = crypto.createHash("md5");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".mp4":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    case ".webm":
      return "video/webm";
    case ".json":
      return "application/json; charset=utf-8";
    case ".txt":
    case ".md":
    case ".log":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function walkFiles(dirPath, files = []) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function toPublicUrl(publicBaseUrl, key) {
  const normalizedBase = publicBaseUrl.replace(/\/+$/, "");
  const encodedKey = key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${normalizedBase}/${encodedKey}`;
}

function buildAssetUploadSet(repoRoot, options) {
  const clientAssetsRoot = path.join(repoRoot, CLIENT_PUBLIC_ASSETS_DIR);
  const runtimeManifestPath = path.join(repoRoot, RUNTIME_MANIFEST_PATH);
  const canonicalManifestPath = path.join(repoRoot, CANONICAL_MANIFEST_PATH);

  if (!fs.existsSync(clientAssetsRoot)) {
    throw new Error(`Missing runtime assets directory: ${relativeToRepo(repoRoot, clientAssetsRoot)}`);
  }
  if (!fs.existsSync(runtimeManifestPath)) {
    throw new Error(`Missing runtime manifest: ${relativeToRepo(repoRoot, runtimeManifestPath)}`);
  }
  if (!fs.existsSync(canonicalManifestPath)) {
    throw new Error(`Missing canonical manifest: ${relativeToRepo(repoRoot, canonicalManifestPath)}`);
  }

  const uploads = walkFiles(clientAssetsRoot).map((absolutePath) => ({
    kind: "asset",
    label: relativeToRepo(repoRoot, absolutePath),
    absolutePath,
    bucketKey: path.posix.join("assets", path.relative(clientAssetsRoot, absolutePath).split(path.sep).join("/")),
    contentType: contentTypeFor(absolutePath),
  }));

  uploads.push({
    kind: "runtime-manifest",
    label: RUNTIME_MANIFEST_PATH,
    absolutePath: runtimeManifestPath,
    bucketKey: options.runtimeManifestKey,
    contentType: "application/json; charset=utf-8",
  });

  uploads.push({
    kind: "canonical-manifest",
    label: CANONICAL_MANIFEST_PATH,
    absolutePath: canonicalManifestPath,
    bucketKey: options.canonicalManifestKey,
    contentType: "application/json; charset=utf-8",
  });

  return uploads;
}

function readUploadCache(cachePath) {
  if (!fs.existsSync(cachePath)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeUploadCache(cachePath, entries) {
  const ordered = Object.fromEntries(Object.entries(entries).sort((a, b) => a[0].localeCompare(b[0])));
  fs.writeFileSync(cachePath, `${JSON.stringify(ordered, null, 2)}\n`, "utf8");
}

function applyUploadDiff(uploads, previousCache, skipCache) {
  let unchangedCount = 0;
  for (const upload of uploads) {
    upload.md5 = fileMd5(upload.absolutePath);
    upload.cacheKey = upload.bucketKey;
    upload.changed = skipCache || previousCache[upload.cacheKey] !== upload.md5;
    if (!upload.changed) unchangedCount += 1;
  }

  return {
    unchangedCount,
    changedUploads: uploads.filter((upload) => upload.changed),
  };
}

function wranglerArgs(configPath, objectPath, filePath, contentType) {
  return [
    "--config",
    configPath,
    "r2",
    "object",
    "put",
    objectPath,
    "--file",
    filePath,
    "--content-type",
    contentType,
    "--cache-control",
    "public, max-age=31536000, immutable",
    "--remote",
  ];
}

function uploadFile(configPath, bucket, upload, dryRun) {
  if (dryRun) return;
  runCommand("npm", [
    "--prefix",
    "apps/client",
    "exec",
    "wrangler",
    "--",
    ...wranglerArgs(configPath, `${bucket}/${upload.bucketKey}`, upload.absolutePath, upload.contentType),
  ]);
}

async function uploadFiles(uploads, options) {
  if (options.dryRun) return;
  const queue = [...uploads];
  const workers = Array.from({ length: Math.min(options.concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const nextUpload = queue.shift();
      if (!nextUpload) return;
      uploadFile(options.wranglerConfigPath, options.bucket, nextUpload, false);
    }
  });
  await Promise.all(workers);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readProbeChunk(response) {
  const reader = response.body?.getReader?.();
  if (!reader) return;

  try {
    await reader.read();
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Best-effort cleanup only.
    }
  }
}

async function verifyPublicUrl(target, options) {
  let lastError = null;

  for (let attempt = 1; attempt <= options.publicVerifyAttempts; attempt += 1) {
    try {
      const response = await fetch(target.url, {
        headers: {
          Connection: "close",
          Range: "bytes=0-63",
          "User-Agent": "tong-runtime-assets/1.0",
        },
        signal: AbortSignal.timeout(options.publicVerifyTimeoutMs),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      await readProbeChunk(response);
      return response.status;
    } catch (error) {
      lastError = error;
      if (attempt < options.publicVerifyAttempts) {
        await sleep(options.publicVerifyDelayMs);
      }
    }
  }

  throw new Error(`Public URL check failed for ${target.label}: ${lastError?.message || lastError}`);
}

async function verifyUploads(uploads, options) {
  if (options.dryRun) return;
  if (options.skipPublicVerification) {
    console.log("Public URL verification: skipped");
    return;
  }

  for (const upload of uploads) {
    const status = await verifyPublicUrl(
      { label: upload.label, url: toPublicUrl(options.publicBaseUrl, upload.bucketKey) },
      options,
    );
    console.log(`Public URL verified: ${upload.bucketKey} (${status})`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = resolveRepoRoot();
  const wranglerConfigPath = path.resolve(repoRoot, options.wranglerConfig);
  const cachePath = path.resolve(repoRoot, options.cachePath);
  const uploads = buildAssetUploadSet(repoRoot, options);
  const previousCache = options.skipCache ? {} : readUploadCache(cachePath);
  const { unchangedCount, changedUploads } = applyUploadDiff(uploads, previousCache, options.skipCache);
  options.wranglerConfigPath = wranglerConfigPath;

  await uploadFiles(changedUploads, options);
  await verifyUploads(changedUploads, options);

  if (!options.dryRun) {
    const nextCache = options.skipCache ? {} : { ...previousCache };
    for (const upload of changedUploads) {
      nextCache[upload.cacheKey] = upload.md5;
    }
    if (!options.skipCache) {
      writeUploadCache(cachePath, nextCache);
    }
  }

  console.log(`Bucket: ${options.bucket}`);
  console.log(`Public base URL: ${options.publicBaseUrl}`);
  console.log(`Wrangler config: ${relativeToRepo(repoRoot, wranglerConfigPath)}`);
  console.log(`Files prepared: ${uploads.length}`);
  console.log(`Files changed: ${changedUploads.length}`);
  console.log(`Files skipped (unchanged): ${unchangedCount}`);
  console.log(`Concurrency: ${options.concurrency}`);
  console.log(`Cache: ${options.skipCache ? "disabled" : relativeToRepo(repoRoot, cachePath)}`);
  console.log(`Dry run: ${options.dryRun ? "yes" : "no"}`);
}

try {
  await main();
  process.exit(0);
} catch (error) {
  console.error(String(error.message || error));
  process.exit(1);
}
