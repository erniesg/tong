#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  collectQaArtifacts,
  ensureDir,
  groupArtifactsByCategory,
  loadQaRunBundle,
  readJson,
  relativeToRepo,
  resolveRepoRoot,
  toPublicUrl,
  writeJson,
} from "./lib/qa_evidence.mjs";

const DEFAULT_BUCKET = "tong-runs";
const DEFAULT_PUBLIC_BASE_URL = "https://runs.tong.berlayar.ai";
const DEFAULT_MANIFEST_NAME = "upload-manifest.json";
const DEFAULT_GIF_SECONDS = 4;
const DEFAULT_GIF_FPS = 6;
const DEFAULT_GIF_WIDTH = 360;
const DEFAULT_PREVIEW_TRAILING_PADDING = 0.5;
const DEFAULT_CACHE_CONTROL = "public, max-age=31536000, immutable";

function parseArgs(argv) {
  const args = {
    bucket: process.env.TONG_RUNS_R2_BUCKET || DEFAULT_BUCKET,
    publicBaseUrl: process.env.TONG_RUNS_PUBLIC_BASE_URL || DEFAULT_PUBLIC_BASE_URL,
    dryRun: false,
    generateGifPreview: true,
    generatePoster: true,
    gifSeconds: DEFAULT_GIF_SECONDS,
    gifFps: DEFAULT_GIF_FPS,
    gifWidth: DEFAULT_GIF_WIDTH,
    includeSupporting: false,
    manifestName: DEFAULT_MANIFEST_NAME,
    posterAtSeconds: null,
    previewStartSeconds: null,
    previewTrailingPaddingSeconds: DEFAULT_PREVIEW_TRAILING_PADDING,
    wranglerConfig: "apps/client/wrangler.toml",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--run-dir") {
      args.runDir = argv[++i];
    } else if (arg === "--bucket") {
      args.bucket = argv[++i];
    } else if (arg === "--public-base-url") {
      args.publicBaseUrl = argv[++i];
    } else if (arg === "--manifest-name") {
      args.manifestName = argv[++i];
    } else if (arg === "--wrangler-config") {
      args.wranglerConfig = argv[++i];
    } else if (arg === "--gif-seconds") {
      args.gifSeconds = Number(argv[++i]);
    } else if (arg === "--gif-fps") {
      args.gifFps = Number(argv[++i]);
    } else if (arg === "--gif-width") {
      args.gifWidth = Number(argv[++i]);
    } else if (arg === "--preview-start-seconds") {
      args.previewStartSeconds = Number(argv[++i]);
    } else if (arg === "--poster-at-seconds") {
      args.posterAtSeconds = Number(argv[++i]);
    } else if (arg === "--preview-trailing-padding-seconds") {
      args.previewTrailingPaddingSeconds = Number(argv[++i]);
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--include-supporting") {
      args.includeSupporting = true;
    } else if (arg === "--skip-gif-preview") {
      args.generateGifPreview = false;
    } else if (arg === "--skip-poster") {
      args.generatePoster = false;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.runDir) {
    throw new Error("Missing required --run-dir");
  }
  if (!args.bucket) {
    throw new Error("Missing bucket name. Set --bucket or TONG_RUNS_R2_BUCKET.");
  }
  if (!args.publicBaseUrl) {
    throw new Error("Missing public base URL. Set --public-base-url or TONG_RUNS_PUBLIC_BASE_URL.");
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/upload-qa-evidence.mjs --run-dir <dir> [options]

Options:
  --bucket <name>               R2 bucket name (default: ${DEFAULT_BUCKET})
  --public-base-url <url>       Public base URL for uploaded assets
  --include-supporting          Upload supporting text artifacts from evidence.json
  --skip-gif-preview            Do not generate/upload GIF previews for videos
  --skip-poster                 Do not generate/upload poster PNGs for videos
  --gif-seconds <n>             GIF duration in seconds (default: ${DEFAULT_GIF_SECONDS})
  --gif-fps <n>                 GIF frames per second (default: ${DEFAULT_GIF_FPS})
  --gif-width <n>               GIF width in pixels (default: ${DEFAULT_GIF_WIDTH})
  --preview-start-seconds <n>   GIF preview start timestamp (default: auto, near clip end)
  --poster-at-seconds <n>       Poster frame timestamp (default: midpoint of preview window)
  --preview-trailing-padding-seconds <n>
                                Leave this much time at clip end when auto-picking preview start
  --manifest-name <name>        Local manifest filename (default: ${DEFAULT_MANIFEST_NAME})
  --wrangler-config <path>      Wrangler config path (default: apps/client/wrangler.toml)
  --dry-run                     Generate previews and manifest without uploading to R2
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

function ensureTool(toolName) {
  runCommand("which", [toolName]);
}

function getVideoDurationSeconds(filePath) {
  const output = runCommand("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const duration = Number(output);
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function resolvePreviewStartSeconds(durationSeconds, options) {
  if (!durationSeconds) {
    return Number.isFinite(options.previewStartSeconds) ? Math.max(options.previewStartSeconds, 0) : 0;
  }

  const maxStart = Math.max(durationSeconds - Math.min(options.gifSeconds, durationSeconds), 0);
  if (Number.isFinite(options.previewStartSeconds)) {
    return clamp(options.previewStartSeconds, 0, maxStart);
  }

  const inferredStart = durationSeconds - Math.min(options.gifSeconds, durationSeconds) - options.previewTrailingPaddingSeconds;
  return clamp(inferredStart, 0, maxStart);
}

function resolvePosterAtSeconds(durationSeconds, previewStartSeconds, gifLengthSeconds, options) {
  if (!durationSeconds) {
    if (Number.isFinite(options.posterAtSeconds)) {
      return Math.max(options.posterAtSeconds, 0);
    }
    return Math.max(previewStartSeconds, 0);
  }

  const maxPosterAt = Math.max(durationSeconds - 0.1, 0);
  if (Number.isFinite(options.posterAtSeconds)) {
    return clamp(options.posterAtSeconds, 0, maxPosterAt);
  }

  const previewMidpoint = previewStartSeconds + Math.max(gifLengthSeconds / 2, 0);
  return clamp(previewMidpoint, previewStartSeconds, maxPosterAt);
}

function generatePoster(filePath, posterPath, posterAtSeconds) {
  runCommand("ffmpeg", [
    "-y",
    "-ss",
    String(posterAtSeconds),
    "-i",
    filePath,
    "-frames:v",
    "1",
    posterPath,
  ]);
}

function generateGifPreview(filePath, gifPath, options) {
  const { gifSeconds, gifFps, gifWidth, startSeconds } = options;
  const filterGraph = [
    `fps=${gifFps}`,
    `scale=${gifWidth}:-1:flags=lanczos`,
    "split[s0][s1]",
    "[s0]palettegen=stats_mode=single[p]",
    "[s1][p]paletteuse=dither=bayer:bayer_scale=5",
  ].join(",");

  runCommand("ffmpeg", [
    "-y",
    "-ss",
    String(startSeconds),
    "-t",
    String(gifSeconds),
    "-i",
    filePath,
    "-vf",
    filterGraph,
    gifPath,
  ]);
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
    DEFAULT_CACHE_CONTROL,
    "--remote",
  ];
}

function uploadWithWrangler(configPath, bucket, key, filePath, contentType, dryRun) {
  if (dryRun) return;
  runCommand("npm", [
    "--prefix",
    "apps/client",
    "exec",
    "wrangler",
    "--",
    ...wranglerArgs(configPath, `${bucket}/${key}`, filePath, contentType),
  ]);
}

function buildRunPrefix(runJson) {
  return ["qa-runs", runJson.suite, runJson.target.slug, runJson.run_id].join("/");
}

function selectPrimaryArtifact(artifacts, predicates) {
  for (const predicate of predicates) {
    const match = artifacts.find(predicate);
    if (match) return match;
  }
  return null;
}

function buildPreviewArtifacts(bundle, baseArtifacts, options) {
  const previewsDir = path.join(bundle.runDir, "previews");
  const previewArtifacts = [];
  if (!options.generateGifPreview && !options.generatePoster) {
    return previewArtifacts;
  }

  const videoArtifacts = baseArtifacts.filter((artifact) => artifact.media_kind === "video");
  if (videoArtifacts.length === 0) {
    return previewArtifacts;
  }

  ensureTool("ffmpeg");
  ensureTool("ffprobe");
  ensureDir(previewsDir);

  for (const artifact of videoArtifacts) {
    const absoluteVideoPath = path.join(bundle.repoRoot, artifact.local_path);
    const duration = getVideoDurationSeconds(absoluteVideoPath);
    const previewStart = resolvePreviewStartSeconds(duration, options);
    const gifLength = duration ? Math.min(options.gifSeconds, Math.max(duration - previewStart, 1)) : options.gifSeconds;
    const posterAt = resolvePosterAtSeconds(duration, previewStart, gifLength, options);
    const safeStem = path.basename(absoluteVideoPath, path.extname(absoluteVideoPath));

    if (options.generatePoster) {
      const posterPath = path.join(previewsDir, `${safeStem}.poster.png`);
      generatePoster(absoluteVideoPath, posterPath, posterAt);
      previewArtifacts.push({
        id: `${artifact.id}-poster`,
        category: "preview-poster",
        role: "poster",
        label: `${artifact.label} Poster`,
        description: `Poster frame for ${artifact.label}`,
        source: artifact.local_path,
        local_path: relativeToRepo(bundle.repoRoot, posterPath),
        relative_run_path: path.relative(bundle.runDir, posterPath).split(path.sep).join("/"),
        content_type: "image/png",
        media_kind: "image",
        size_bytes: fs.statSync(posterPath).size,
      });
    }

    if (options.generateGifPreview) {
      const gifPath = path.join(previewsDir, `${safeStem}.preview.gif`);
      generateGifPreview(absoluteVideoPath, gifPath, {
        gifSeconds: gifLength,
        gifFps: options.gifFps,
        gifWidth: options.gifWidth,
        startSeconds: previewStart,
      });
      previewArtifacts.push({
        id: `${artifact.id}-gif`,
        category: "preview-gif",
        role: "preview",
        label: `${artifact.label} GIF Preview`,
        description: `GIF preview for ${artifact.label}`,
        source: artifact.local_path,
        local_path: relativeToRepo(bundle.repoRoot, gifPath),
        relative_run_path: path.relative(bundle.runDir, gifPath).split(path.sep).join("/"),
        content_type: "image/gif",
        media_kind: "image",
        size_bytes: fs.statSync(gifPath).size,
      });
    }
  }

  return previewArtifacts;
}

function enrichArtifactsWithUploadMetadata(artifacts, prefix, publicBaseUrl) {
  return artifacts.map((artifact) => {
    const key = `${prefix}/${artifact.relative_run_path}`;
    return {
      ...artifact,
      bucket_key: key,
      url: toPublicUrl(publicBaseUrl, key),
    };
  });
}

function buildManifest(bundle, artifacts, options) {
  const prefix = buildRunPrefix(bundle.runJson);
  const manifestUrl = toPublicUrl(options.publicBaseUrl, `${prefix}/manifest.json`);
  const grouped = groupArtifactsByCategory(artifacts);
  const summaryArtifact = selectPrimaryArtifact(artifacts, [
    (artifact) => artifact.role === "summary",
  ]);
  const proofVideoArtifact = selectPrimaryArtifact(artifacts, [
    (artifact) => artifact.media_kind === "video" && artifact.role === "proof",
    (artifact) => artifact.media_kind === "video" && artifact.category === "temporal-capture",
  ]);
  const gifPreviewArtifact = selectPrimaryArtifact(artifacts, [
    (artifact) => artifact.role === "preview" && artifact.category === "preview-gif",
    (artifact) => artifact.category === "preview-gif",
  ]);
  const posterArtifact = selectPrimaryArtifact(artifacts, [
    (artifact) => artifact.role === "poster" && artifact.category === "preview-poster",
    (artifact) => artifact.category === "preview-poster",
  ]);
  const dialogueArtifact = selectPrimaryArtifact(artifacts, [
    (artifact) => artifact.role === "dialogue" && artifact.category === "screenshots",
    (artifact) => artifact.category === "screenshots",
  ]);
  const tooltipArtifact = selectPrimaryArtifact(artifacts, [
    (artifact) => artifact.role === "tooltip" && artifact.category === "screenshots",
  ]);
  const romanizationTraceArtifact = selectPrimaryArtifact(artifacts, [
    (artifact) => artifact.role === "romanization-bait" && artifact.category === "contract-assertions",
    (artifact) => artifact.category === "contract-assertions",
  ]);

  return {
    schema_version: "1",
    generated_at: new Date().toISOString(),
    bucket: options.bucket,
    public_base_url: options.publicBaseUrl,
    manifest_url: manifestUrl,
    run: {
      run_id: bundle.runJson.run_id,
      suite: bundle.runJson.suite,
      mode: bundle.runJson.mode,
      issue_ref: bundle.runJson.issue_ref,
      target_slug: bundle.runJson.target.slug,
      run_dir: relativeToRepo(bundle.repoRoot, bundle.runDir),
      prefix,
    },
    issue: bundle.issueJson
      ? {
          number: bundle.issueJson.number,
          issue_ref: bundle.issueJson.issue_ref,
          title: bundle.issueJson.title,
          html_url: bundle.issueJson.html_url,
        }
      : null,
    summary: {
      text: bundle.evidenceJson.summary || "",
      notes: bundle.evidenceJson.notes || [],
      validation: bundle.evidenceJson.validation || {},
    },
    settings: {
      include_supporting: options.includeSupporting,
      generate_gif_preview: options.generateGifPreview,
      generate_poster: options.generatePoster,
      dry_run: options.dryRun,
    },
    primary: {
      summary: summaryArtifact,
      proof_video: proofVideoArtifact,
      gif_preview: gifPreviewArtifact,
      poster: posterArtifact,
      dialogue_screenshot: dialogueArtifact,
      tooltip_screenshot: tooltipArtifact,
      romanization_trace: romanizationTraceArtifact,
    },
    artifacts,
    by_category: grouped,
  };
}

function uploadArtifacts(configPath, bucket, artifacts, dryRun) {
  for (const artifact of artifacts) {
    const absolutePath = path.resolve(resolveRepoRoot(), artifact.local_path);
    uploadWithWrangler(configPath, bucket, artifact.bucket_key, absolutePath, artifact.content_type, dryRun);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = resolveRepoRoot();
  const wranglerConfigPath = path.resolve(repoRoot, options.wranglerConfig);
  const bundle = loadQaRunBundle(path.resolve(options.runDir), repoRoot);
  const runPrefix = buildRunPrefix(bundle.runJson);

  const baseArtifacts = collectQaArtifacts(bundle, {
    includeSupporting: options.includeSupporting,
  });
  const previewArtifacts = buildPreviewArtifacts(bundle, baseArtifacts, options);
  const allArtifacts = enrichArtifactsWithUploadMetadata(
    [...baseArtifacts, ...previewArtifacts],
    runPrefix,
    options.publicBaseUrl,
  );

  const manifest = buildManifest(bundle, allArtifacts, options);
  const manifestPath = path.join(bundle.runDir, options.manifestName);
  writeJson(manifestPath, manifest);

  uploadArtifacts(wranglerConfigPath, options.bucket, allArtifacts, options.dryRun);
  uploadWithWrangler(
    wranglerConfigPath,
    options.bucket,
    `${runPrefix}/manifest.json`,
    manifestPath,
    "application/json; charset=utf-8",
    options.dryRun,
  );

  console.log(`Manifest written: ${relativeToRepo(repoRoot, manifestPath)}`);
  console.log(`Run prefix: ${runPrefix}`);
  console.log(`Artifacts prepared: ${allArtifacts.length}`);
  console.log(`Dry run: ${options.dryRun ? "yes" : "no"}`);
  console.log(`Public base URL: ${options.publicBaseUrl}`);
  console.log(`Wrangler config: ${relativeToRepo(repoRoot, wranglerConfigPath)}`);
}

try {
  main();
} catch (error) {
  console.error(String(error.message || error));
  process.exit(1);
}
