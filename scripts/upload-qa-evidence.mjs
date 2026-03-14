#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  collectQaArtifacts,
  ensureDir,
  groupArtifactsByCategory,
  loadPreviousQaRunBundle,
  loadQaRunBundle,
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
const DEFAULT_COMPARISON_DIFF_THRESHOLD = "2%";
const DEFAULT_COMPARISON_PADDING = 28;
const DEFAULT_COMPARISON_LABEL_HEIGHT = 54;
const DEFAULT_COMPARISON_LABEL_POINTSIZE = 22;
const DEFAULT_COMPARISON_MIN_FOCUS_WIDTH = 220;
const DEFAULT_COMPARISON_MIN_FOCUS_HEIGHT = 140;
const DEFAULT_COMPARISON_MAX_DIMENSION = 1400;
const COMPARISON_CANVAS_BACKGROUND = "#0f172a";
const COMPARISON_SURFACE_BACKGROUND = "#f8fafc";
const COMPARISON_BORDER_COLOR = "#cbd5e1";
const COMPARISON_LABEL_COLOR = "#f8fafc";
const COMPARISON_ISSUE_CLASSES = new Set(["visual-layout", "localization-content", "accessibility"]);
const HIGH_SIGNAL_ROLES = new Set(["subtitle", "translation", "tooltip", "dictionary", "dialogue"]);
const COMPARISON_ROLE_PRIORITY = new Map([
  ["subtitle", 0],
  ["translation", 1],
  ["tooltip", 2],
  ["dictionary", 3],
  ["dialogue", 4],
  ["screenshots", 10],
]);

function parseArgs(argv) {
  const args = {
    bucket: process.env.TONG_RUNS_R2_BUCKET || DEFAULT_BUCKET,
    publicBaseUrl: process.env.TONG_RUNS_PUBLIC_BASE_URL || DEFAULT_PUBLIC_BASE_URL,
    dryRun: false,
    generateGifPreview: true,
    generatePoster: true,
    generateComparisons: true,
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
    } else if (arg === "--skip-comparisons") {
      args.generateComparisons = false;
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
  --skip-comparisons            Do not auto-generate before/after comparison panels
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

function hasTool(toolName) {
  const result = spawnSync("which", [toolName], {
    encoding: "utf8",
    stdio: "pipe",
  });
  return result.status === 0;
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
      previewArtifacts.push(makeGeneratedImageArtifact(bundle, {
        id: `${artifact.id}-poster`,
        category: "preview-poster",
        role: "poster",
        label: `${artifact.label} Poster`,
        description: `Poster frame for ${artifact.label}`,
        source: artifact.local_path,
        outputPath: posterPath,
      }));
    }

    if (options.generateGifPreview) {
      const gifPath = path.join(previewsDir, `${safeStem}.preview.gif`);
      generateGifPreview(absoluteVideoPath, gifPath, {
        gifSeconds: gifLength,
        gifFps: options.gifFps,
        gifWidth: options.gifWidth,
        startSeconds: previewStart,
      });
      previewArtifacts.push(makeGeneratedImageArtifact(bundle, {
        id: `${artifact.id}-gif`,
        category: "preview-gif",
        role: "preview",
        label: `${artifact.label} GIF Preview`,
        description: `GIF preview for ${artifact.label}`,
        source: artifact.local_path,
        outputPath: gifPath,
        contentType: "image/gif",
      }));
    }
  }

  return previewArtifacts;
}

function slugifyPart(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeMatchToken(value) {
  return slugifyPart(value)
    .replace(/\b(before|after|baseline|verify|verified|current|fixed|pref(?:ix)?|previous|prior|old|new|post|pre|live)\b/g, "-")
    .replace(/\b\d{8}t\d{6}z\b/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizedArtifactStem(artifact) {
  const basename = path.basename(artifact.relative_run_path || artifact.local_path, path.extname(artifact.relative_run_path || artifact.local_path));
  return normalizeMatchToken(basename);
}

function rolePriority(role) {
  return COMPARISON_ROLE_PRIORITY.get(role) ?? 99;
}

function comparisonPairScore(currentArtifact, previousArtifact, currentIndex, previousIndex) {
  let score = 0;

  if (currentArtifact.role && currentArtifact.role === previousArtifact.role) {
    score += HIGH_SIGNAL_ROLES.has(currentArtifact.role) ? 100 : 15;
  }

  const currentStem = normalizedArtifactStem(currentArtifact);
  const previousStem = normalizedArtifactStem(previousArtifact);
  if (currentStem && previousStem && currentStem === previousStem) {
    score += 60;
  }

  const currentLabel = normalizeMatchToken(currentArtifact.label || "");
  const previousLabel = normalizeMatchToken(previousArtifact.label || "");
  if (currentLabel && previousLabel && currentLabel === previousLabel) {
    score += 20;
  }

  if (currentIndex === previousIndex) {
    score += 10;
  }

  if (score === 0) {
    return Number.NEGATIVE_INFINITY;
  }

  return score - Math.abs(currentIndex - previousIndex) * 0.5;
}

function buildComparisonPairs(previousArtifacts, currentArtifacts) {
  const usedPreviousArtifactIds = new Set();
  const pairs = [];

  currentArtifacts.forEach((currentArtifact, currentIndex) => {
    let bestMatch = null;

    previousArtifacts.forEach((previousArtifact, previousIndex) => {
      if (usedPreviousArtifactIds.has(previousArtifact.id)) {
        return;
      }

      const score = comparisonPairScore(currentArtifact, previousArtifact, currentIndex, previousIndex);
      if (!Number.isFinite(score)) {
        return;
      }

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { previousArtifact, previousIndex, score };
      }
    });

    if (!bestMatch) {
      return;
    }

    usedPreviousArtifactIds.add(bestMatch.previousArtifact.id);
    pairs.push({
      role: currentArtifact.role || bestMatch.previousArtifact.role || "screenshots",
      label: currentArtifact.label || bestMatch.previousArtifact.label || `Comparison ${pairs.length + 1}`,
      before: bestMatch.previousArtifact,
      after: currentArtifact,
      currentIndex,
      previousIndex: bestMatch.previousIndex,
    });
  });

  pairs.sort((left, right) => {
    const priorityDiff = rolePriority(left.role) - rolePriority(right.role);
    if (priorityDiff !== 0) return priorityDiff;
    return left.currentIndex - right.currentIndex;
  });

  return pairs.slice(0, 4);
}

function makeGeneratedImageArtifact(bundle, {
  id,
  category,
  role,
  label,
  description,
  source,
  outputPath,
  contentType = "image/png",
  comparison = null,
}) {
  return {
    id,
    category,
    role,
    label,
    description,
    source,
    local_path: relativeToRepo(bundle.repoRoot, outputPath),
    relative_run_path: path.relative(bundle.runDir, outputPath).split(path.sep).join("/"),
    content_type: contentType,
    media_kind: "image",
    size_bytes: fs.statSync(outputPath).size,
    ...(comparison ? { comparison } : {}),
  };
}

function imageDimensions(filePath) {
  const output = runCommand("magick", [
    "identify",
    "-format",
    "%w %h",
    filePath,
  ]);
  const [widthText, heightText] = output.trim().split(/\s+/);
  const width = Number(widthText);
  const height = Number(heightText);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`Could not determine image dimensions for ${filePath}`);
  }
  return { width, height };
}

function comparisonCanvasSize(beforeSize, afterSize) {
  return {
    width: Math.min(Math.max(beforeSize.width, afterSize.width), DEFAULT_COMPARISON_MAX_DIMENSION),
    height: Math.min(Math.max(beforeSize.height, afterSize.height), DEFAULT_COMPARISON_MAX_DIMENSION),
  };
}

function prepareComparisonCanvas(inputPath, outputPath, canvasSize) {
  runCommand("magick", [
    inputPath,
    "-auto-orient",
    "-resize",
    `${canvasSize.width}x${canvasSize.height}`,
    "-background",
    COMPARISON_SURFACE_BACKGROUND,
    "-gravity",
    "center",
    "-extent",
    `${canvasSize.width}x${canvasSize.height}`,
    outputPath,
  ]);
}

function annotateComparisonFrame(inputPath, outputPath, label) {
  runCommand("magick", [
    inputPath,
    "-background",
    COMPARISON_CANVAS_BACKGROUND,
    "-gravity",
    "north",
    "-splice",
    `0x${DEFAULT_COMPARISON_LABEL_HEIGHT}`,
    "-fill",
    COMPARISON_LABEL_COLOR,
    "-pointsize",
    String(DEFAULT_COMPARISON_LABEL_POINTSIZE),
    "-annotate",
    "+0+10",
    label,
    "-bordercolor",
    COMPARISON_BORDER_COLOR,
    "-border",
    "2",
    outputPath,
  ]);
}

function appendComparisonFrames(leftPath, rightPath, outputPath) {
  runCommand("magick", [
    leftPath,
    rightPath,
    "+append",
    outputPath,
  ]);
}

function parseMagickGeometry(rawGeometry) {
  const match = String(rawGeometry || "").trim().match(/^(\d+)x(\d+)([+-]\d+)([+-]\d+)$/);
  if (!match) {
    return null;
  }
  return {
    width: Number(match[1]),
    height: Number(match[2]),
    x: Number(match[3]),
    y: Number(match[4]),
  };
}

function expandFocusGeometry(geometry, canvasSize) {
  if (!geometry || geometry.width <= 0 || geometry.height <= 0) {
    return null;
  }

  const paddedWidth = Math.max(geometry.width + DEFAULT_COMPARISON_PADDING * 2, DEFAULT_COMPARISON_MIN_FOCUS_WIDTH);
  const paddedHeight = Math.max(geometry.height + DEFAULT_COMPARISON_PADDING * 2, DEFAULT_COMPARISON_MIN_FOCUS_HEIGHT);
  const centerX = geometry.x + geometry.width / 2;
  const centerY = geometry.y + geometry.height / 2;

  let x = Math.round(centerX - paddedWidth / 2);
  let y = Math.round(centerY - paddedHeight / 2);
  let width = Math.min(Math.round(paddedWidth), canvasSize.width);
  let height = Math.min(Math.round(paddedHeight), canvasSize.height);

  x = clamp(x, 0, Math.max(canvasSize.width - width, 0));
  y = clamp(y, 0, Math.max(canvasSize.height - height, 0));

  return { x, y, width, height };
}

function detectFocusGeometry(beforePath, afterPath, canvasSize) {
  try {
    const rawGeometry = runCommand("magick", [
      beforePath,
      afterPath,
      "-compose",
      "difference",
      "-composite",
      "-colorspace",
      "gray",
      "-threshold",
      DEFAULT_COMPARISON_DIFF_THRESHOLD,
      "-trim",
      "-format",
      "%wx%h%O",
      "info:",
    ]);
    return expandFocusGeometry(parseMagickGeometry(rawGeometry), canvasSize);
  } catch {
    return null;
  }
}

function cropImage(inputPath, outputPath, geometry) {
  runCommand("magick", [
    inputPath,
    "-crop",
    `${geometry.width}x${geometry.height}+${geometry.x}+${geometry.y}`,
    "+repage",
    outputPath,
  ]);
}

function absoluteArtifactPath(bundle, artifact) {
  return path.join(bundle.repoRoot, artifact.local_path);
}

function expectedComparisonArtifacts(bundle) {
  const issueClass = bundle.runJson.classification?.issue_class;
  return COMPARISON_ISSUE_CLASSES.has(issueClass);
}

function buildComparisonArtifacts(bundle, baseArtifacts, options) {
  const comparisonReport = {
    expected: expectedComparisonArtifacts(bundle),
    generated: false,
    source: "none",
    missing_reason: null,
    previous_run: null,
    pairs: [],
  };

  if (!comparisonReport.expected) {
    return { artifacts: [], comparisonReport };
  }

  if (!options.generateComparisons) {
    comparisonReport.missing_reason = "Comparison generation was disabled with `--skip-comparisons`.";
    return { artifacts: [], comparisonReport };
  }

  const previousBundle = loadPreviousQaRunBundle(bundle, bundle.repoRoot);
  if (!previousBundle) {
    comparisonReport.missing_reason = bundle.runJson.previous_run_id
      ? `Previous run \`${bundle.runJson.previous_run_id}\` could not be resolved from artifacts/qa-runs.`
      : "This run is not linked to a previous validation run. Re-run with `validate-issue --verify-fix` or add manual `comparison_panels` / `comparison_focus_crops` entries to evidence.json.";
    return { artifacts: [], comparisonReport };
  }

  comparisonReport.previous_run = {
    run_id: previousBundle.runJson.run_id,
    run_dir: relativeToRepo(bundle.repoRoot, previousBundle.runDir),
    issue_ref: previousBundle.runJson.issue_ref,
  };

  const currentScreenshotArtifacts = baseArtifacts.filter(
    (artifact) => artifact.category === "screenshots" && artifact.media_kind === "image",
  );
  const previousScreenshotArtifacts = collectQaArtifacts(previousBundle, {
    includeSupporting: false,
  }).filter((artifact) => artifact.category === "screenshots" && artifact.media_kind === "image");

  if (currentScreenshotArtifacts.length === 0 || previousScreenshotArtifacts.length === 0) {
    comparisonReport.missing_reason = "Comparison generation needs image screenshots in both the previous validation run and the current verify-fix run.";
    return { artifacts: [], comparisonReport };
  }

  if (!hasTool("magick")) {
    comparisonReport.missing_reason = "ImageMagick `magick` is required to auto-generate comparison panels.";
    return { artifacts: [], comparisonReport };
  }

  const pairs = buildComparisonPairs(previousScreenshotArtifacts, currentScreenshotArtifacts);
  if (pairs.length === 0) {
    comparisonReport.missing_reason = "Could not match current screenshots to a same-state screenshot from the previous run. Add manual `comparison_panels` / `comparison_focus_crops` entries to evidence.json when pairing is ambiguous.";
    return { artifacts: [], comparisonReport };
  }

  const comparisonsDir = path.join(bundle.runDir, "comparisons");
  ensureDir(comparisonsDir);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tong-qa-compare-"));
  const comparisonArtifacts = [];

  try {
    pairs.forEach((pair, index) => {
      const baseSlug = slugifyPart(`${pair.role}-${pair.label}`) || `comparison-${index + 1}`;
      const beforeSourcePath = absoluteArtifactPath(previousBundle, pair.before);
      const afterSourcePath = absoluteArtifactPath(bundle, pair.after);
      const beforeSize = imageDimensions(beforeSourcePath);
      const afterSize = imageDimensions(afterSourcePath);
      const canvasSize = comparisonCanvasSize(beforeSize, afterSize);

      const normalizedBeforePath = path.join(tempDir, `${baseSlug}.before.normalized.png`);
      const normalizedAfterPath = path.join(tempDir, `${baseSlug}.after.normalized.png`);
      prepareComparisonCanvas(beforeSourcePath, normalizedBeforePath, canvasSize);
      prepareComparisonCanvas(afterSourcePath, normalizedAfterPath, canvasSize);

      const labeledBeforePath = path.join(tempDir, `${baseSlug}.before.labeled.png`);
      const labeledAfterPath = path.join(tempDir, `${baseSlug}.after.labeled.png`);
      annotateComparisonFrame(normalizedBeforePath, labeledBeforePath, "Before");
      annotateComparisonFrame(normalizedAfterPath, labeledAfterPath, "After");

      const panelPath = path.join(comparisonsDir, `${baseSlug}.panel.png`);
      appendComparisonFrames(labeledBeforePath, labeledAfterPath, panelPath);

      const focusGeometry = detectFocusGeometry(normalizedBeforePath, normalizedAfterPath, canvasSize);
      let focusArtifact = null;
      if (focusGeometry) {
        const beforeCropPath = path.join(tempDir, `${baseSlug}.before.crop.png`);
        const afterCropPath = path.join(tempDir, `${baseSlug}.after.crop.png`);
        cropImage(normalizedBeforePath, beforeCropPath, focusGeometry);
        cropImage(normalizedAfterPath, afterCropPath, focusGeometry);

        const labeledBeforeCropPath = path.join(tempDir, `${baseSlug}.before.crop.labeled.png`);
        const labeledAfterCropPath = path.join(tempDir, `${baseSlug}.after.crop.labeled.png`);
        annotateComparisonFrame(beforeCropPath, labeledBeforeCropPath, "Before");
        annotateComparisonFrame(afterCropPath, labeledAfterCropPath, "After");

        const focusPath = path.join(comparisonsDir, `${baseSlug}.focus.png`);
        appendComparisonFrames(labeledBeforeCropPath, labeledAfterCropPath, focusPath);

        focusArtifact = makeGeneratedImageArtifact(bundle, {
          id: `${pair.after.id}-comparison-focus`,
          category: "comparison-focus-crop",
          role: "comparison-focus-crop",
          label: `${pair.label} Focus Crop`,
          description: `Focused before/after crop for ${pair.label}`,
          source: `${pair.before.local_path} -> ${pair.after.local_path}`,
          outputPath: focusPath,
          comparison: {
            kind: "focus-crop",
            role: pair.role,
            before_artifact_id: pair.before.id,
            after_artifact_id: pair.after.id,
            geometry: focusGeometry,
          },
        });
      }

      const panelArtifact = makeGeneratedImageArtifact(bundle, {
        id: `${pair.after.id}-comparison-panel`,
        category: "comparison-panel",
        role: "comparison-panel",
        label: `${pair.label} Before/After`,
        description: `Side-by-side before/after comparison for ${pair.label}`,
        source: `${pair.before.local_path} -> ${pair.after.local_path}`,
        outputPath: panelPath,
        comparison: {
          kind: "panel",
          role: pair.role,
          before_artifact_id: pair.before.id,
          after_artifact_id: pair.after.id,
        },
      });

      comparisonArtifacts.push(panelArtifact);
      if (focusArtifact) {
        comparisonArtifacts.push(focusArtifact);
      }

      comparisonReport.pairs.push({
        role: pair.role,
        label: pair.label,
        before_artifact_id: pair.before.id,
        after_artifact_id: pair.after.id,
        panel_artifact_id: panelArtifact.id,
        focus_crop_artifact_id: focusArtifact?.id || null,
        focus_geometry: focusGeometry,
      });
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  if (comparisonArtifacts.length === 0) {
    comparisonReport.missing_reason = "Comparison pairing succeeded, but no comparison images were generated.";
    return { artifacts: [], comparisonReport };
  }

  comparisonReport.generated = true;
  comparisonReport.source = "automatic";
  return { artifacts: comparisonArtifacts, comparisonReport };
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

function buildComparisonSummary(artifacts, comparisonReport) {
  const comparisonPanelArtifact = selectPrimaryArtifact(artifacts, [
    (artifact) => artifact.category === "comparison-panel",
  ]);
  const comparisonFocusArtifact = selectPrimaryArtifact(artifacts, [
    (artifact) => artifact.category === "comparison-focus-crop",
  ]);

  const hasManualComparisonArtifacts =
    artifacts.some((artifact) => artifact.category === "comparison-panel" || artifact.category === "comparison-focus-crop") &&
    !comparisonReport.generated;

  return {
    expected: comparisonReport.expected,
    source: comparisonReport.generated ? comparisonReport.source : (hasManualComparisonArtifacts ? "manual" : "none"),
    previous_run: comparisonReport.previous_run,
    generated: Boolean(comparisonPanelArtifact || comparisonFocusArtifact),
    missing_reason: comparisonPanelArtifact || comparisonFocusArtifact ? null : comparisonReport.missing_reason,
    pairs: comparisonReport.pairs,
  };
}

function buildManifest(bundle, artifacts, options, comparisonReport) {
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
  const comparisonPanelArtifact = selectPrimaryArtifact(artifacts, [
    (artifact) => artifact.category === "comparison-panel",
  ]);
  const comparisonFocusArtifact = selectPrimaryArtifact(artifacts, [
    (artifact) => artifact.category === "comparison-focus-crop",
  ]);
  const comparison = buildComparisonSummary(artifacts, comparisonReport);

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
      previous_run_id: bundle.runJson.previous_run_id || null,
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
      generate_comparisons: options.generateComparisons,
      dry_run: options.dryRun,
    },
    comparison,
    primary: {
      summary: summaryArtifact,
      proof_video: proofVideoArtifact,
      comparison_panel: comparisonPanelArtifact,
      comparison_focus_crop: comparisonFocusArtifact,
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
  const { artifacts: comparisonArtifacts, comparisonReport } = buildComparisonArtifacts(bundle, baseArtifacts, options);
  const allArtifacts = enrichArtifactsWithUploadMetadata(
    [...baseArtifacts, ...previewArtifacts, ...comparisonArtifacts],
    runPrefix,
    options.publicBaseUrl,
  );

  const manifest = buildManifest(bundle, allArtifacts, options, comparisonReport);
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
  if (manifest.comparison?.expected) {
    console.log(`Comparison assets: ${manifest.comparison.generated ? "generated" : "missing"}`);
    if (manifest.comparison.missing_reason) {
      console.log(`Comparison note: ${manifest.comparison.missing_reason}`);
    }
  }
}

try {
  main();
} catch (error) {
  console.error(String(error.message || error));
  process.exit(1);
}
