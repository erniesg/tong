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
const DEFAULT_CACHE_FILE = ".r2-upload-cache.json";
const DEFAULT_UPLOAD_CONCURRENCY = 6;

const CLIENT_PUBLIC_ASSETS_DIR = "apps/client/public/assets";
const RUNTIME_MANIFEST_PATH = "assets/manifest/runtime-asset-manifest.json";
const CANONICAL_MANIFEST_PATH = "assets/manifest/canonical-asset-manifest.json";

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
    wranglerConfig: "apps/client/wrangler.toml",
    cacheFile: DEFAULT_CACHE_FILE,
    uploadConcurrency: DEFAULT_UPLOAD_CONCURRENCY,
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
    } else if (arg === "--cache-file") {
      args.cacheFile = argv[++i];
    } else if (arg === "--upload-concurrency") {
      args.uploadConcurrency = Number(argv[++i]);
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
  if (!Number.isFinite(args.uploadConcurrency) || args.uploadConcurrency < 1) {
    throw new Error("`--upload-concurrency` must be a positive number.");
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
  --cache-file <path>            JSON cache with uploaded file hashes (default: ${DEFAULT_CACHE_FILE})
  --upload-concurrency <n>       Number of parallel uploads (default: ${DEFAULT_UPLOAD_CONCURRENCY})
  --skip-public-verification     Skip GET-based public URL checks after upload
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

function md5ForFile(filePath) {
  const hash = crypto.createHash("md5");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function loadUploadCache(cachePath) {
  if (!fs.existsSync(cachePath)) {
    return { version: 1, hashes: {} };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    if (parsed && typeof parsed === "object" && parsed.hashes && typeof parsed.hashes === "object") {
      return { version: 1, hashes: parsed.hashes };
    }
  } catch {
    // Ignore malformed cache and start fresh.
  }

  return { version: 1, hashes: {} };
}

function saveUploadCache(cachePath, cache) {
  const output = JSON.stringify(cache, null, 2);
  fs.writeFileSync(cachePath, `${output}\n`, "utf8");
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
    hash: md5ForFile(absolutePath),
  }));

  uploads.push({
    kind: "runtime-manifest",
    label: RUNTIME_MANIFEST_PATH,
    absolutePath: runtimeManifestPath,
    bucketKey: options.runtimeManifestKey,
    contentType: "application/json; charset=utf-8",
    hash: md5ForFile(runtimeManifestPath),
  });

  uploads.push({
    kind: "canonical-manifest",
    label: CANONICAL_MANIFEST_PATH,
    absolutePath: canonicalManifestPath,
    bucketKey: options.canonicalManifestKey,
    contentType: "application/json; charset=utf-8",
    hash: md5ForFile(canonicalManifestPath),
  });

  return uploads;
}

function selectUploads(uploads, cache) {
  const selected = [];
  const skipped = [];

  for (const upload of uploads) {
    const previousHash = cache.hashes[upload.bucketKey];
    if (previousHash && previousHash === upload.hash) {
      skipped.push(upload);
      continue;
    }
    selected.push(upload);
  }

  return { selected, skipped };
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

function uploadFile(configPath, bucket, upload) {
  runCommand("npm", [
    "--prefix",
    "apps/client",
    "exec",
    "wrangler",
    "--",
    ...wranglerArgs(configPath, `${bucket}/${upload.bucketKey}`, upload.absolutePath, upload.contentType),
  ]);
}

async function uploadFiles(configPath, bucket, uploads, concurrency, dryRun) {
  if (dryRun || uploads.length === 0) return;

  let cursor = 0;

  async function worker() {
    while (cursor < uploads.length) {
      const upload = uploads[cursor];
      cursor += 1;
      uploadFile(configPath, bucket, upload);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, uploads.length) }, () => worker());
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
  const cachePath = path.resolve(repoRoot, options.cacheFile);
  const cache = loadUploadCache(cachePath);
  const uploads = buildAssetUploadSet(repoRoot, options);
  const { selected, skipped } = selectUploads(uploads, cache);

  if (options.dryRun) {
    for (const upload of selected) {
      console.log(`UPLOAD ${upload.bucketKey} (${upload.hash})`);
    }
    for (const upload of skipped) {
      console.log(`SKIP   ${upload.bucketKey} (${upload.hash})`);
    }
  }

  await uploadFiles(wranglerConfigPath, options.bucket, selected, options.uploadConcurrency, options.dryRun);
  await verifyUploads(selected, options);

  if (!options.dryRun) {
    for (const upload of selected) {
      cache.hashes[upload.bucketKey] = upload.hash;
    }
    saveUploadCache(cachePath, cache);
  }

  console.log(`Bucket: ${options.bucket}`);
  console.log(`Public base URL: ${options.publicBaseUrl}`);
  console.log(`Wrangler config: ${relativeToRepo(repoRoot, wranglerConfigPath)}`);
  console.log(`Files prepared: ${uploads.length}`);
  console.log(`Files uploaded: ${selected.length}`);
  console.log(`Files skipped (hash match): ${skipped.length}`);
  console.log(`Upload cache: ${relativeToRepo(repoRoot, cachePath)}`);
  console.log(`Upload concurrency: ${options.uploadConcurrency}`);
  console.log(`Dry run: ${options.dryRun ? "yes" : "no"}`);
}

try {
  await main();
  process.exit(0);
} catch (error) {
  console.error(String(error.message || error));
  process.exit(1);
}
