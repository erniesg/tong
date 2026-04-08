/**
 * compositor.mjs — Server-side Remotion rendering integration.
 *
 * Provides functions to render compositions as stills (PNG) or video (MP4)
 * using the @tong/remotion package. All tools are atomic — the AI orchestrator
 * decides which to call and in what order.
 *
 * Tools:
 *   compositor.formats.list    — list platform formats
 *   compositor.render.still    — render single format → PNG
 *   compositor.render.batch    — render N formats → PNG array
 *   compositor.render.video    — render animated → MP4
 */

import { execFile } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Format Registry ────────────────────────────────────────────────
// Mirror of packages/remotion/src/schemas/formats.ts for server-side use.
// Kept in sync — single source of truth is the Remotion package.

const PLATFORM_FORMATS = {
  'instagram-post':      { id: 'instagram-post',      name: 'Instagram Post',      platform: 'instagram',   variant: 'post',      width: 1080, height: 1080, aspectRatio: '1:1' },
  'instagram-story':     { id: 'instagram-story',     name: 'Instagram Story',     platform: 'instagram',   variant: 'story',     width: 1080, height: 1920, aspectRatio: '9:16' },
  'instagram-reel':      { id: 'instagram-reel',      name: 'Instagram Reel',      platform: 'instagram',   variant: 'reel',      width: 1080, height: 1920, aspectRatio: '9:16' },
  'tiktok-video':        { id: 'tiktok-video',        name: 'TikTok Video',        platform: 'tiktok',      variant: 'video',     width: 1080, height: 1920, aspectRatio: '9:16' },
  'linkedin-post':       { id: 'linkedin-post',       name: 'LinkedIn Post',       platform: 'linkedin',    variant: 'post',      width: 1200, height: 628,  aspectRatio: '1.91:1' },
  'linkedin-carousel':   { id: 'linkedin-carousel',   name: 'LinkedIn Carousel',   platform: 'linkedin',    variant: 'carousel',  width: 1080, height: 1080, aspectRatio: '1:1' },
  'facebook-post':       { id: 'facebook-post',       name: 'Facebook Post',       platform: 'facebook',    variant: 'post',      width: 1200, height: 628,  aspectRatio: '1.91:1' },
  'facebook-story':      { id: 'facebook-story',      name: 'Facebook Story',      platform: 'facebook',    variant: 'story',     width: 1080, height: 1920, aspectRatio: '9:16' },
  'twitter-post':        { id: 'twitter-post',        name: 'X / Twitter Post',    platform: 'twitter',     variant: 'post',      width: 1600, height: 900,  aspectRatio: '16:9' },
  'twitter-header':      { id: 'twitter-header',      name: 'X / Twitter Header',  platform: 'twitter',     variant: 'header',    width: 1500, height: 500,  aspectRatio: '3:1' },
  'youtube-thumbnail':   { id: 'youtube-thumbnail',   name: 'YouTube Thumbnail',   platform: 'youtube',     variant: 'thumbnail', width: 1280, height: 720,  aspectRatio: '16:9' },
  'youtube-short':       { id: 'youtube-short',       name: 'YouTube Short',       platform: 'youtube',     variant: 'short',     width: 1080, height: 1920, aspectRatio: '9:16' },
  'xiaohongshu-post':    { id: 'xiaohongshu-post',    name: 'Xiaohongshu Post',    platform: 'xiaohongshu', variant: 'post',      width: 1080, height: 1440, aspectRatio: '3:4' },
};

const REMOTION_PKG = path.resolve(__dirname, '../../../packages/remotion');
const REMOTION_ENTRY = path.join(REMOTION_PKG, 'src/index.ts');
const COMPOSITIONS_DIR = path.resolve(__dirname, '../data/compositions');

// Ensure output directory exists
if (!existsSync(COMPOSITIONS_DIR)) mkdirSync(COMPOSITIONS_DIR, { recursive: true });

// ── Public API ─────────────────────────────────────────────────────

export function listFormats() {
  return Object.values(PLATFORM_FORMATS);
}

export function getFormatsByPlatform(platform) {
  return Object.values(PLATFORM_FORMATS).filter(f => f.platform === platform);
}

export function getFormat(id) {
  return PLATFORM_FORMATS[id] || null;
}

/**
 * Render a single still image (PNG) via Remotion CLI.
 *
 * @param {object} args
 * @param {string} args.compositionId - 'EventPoster' or 'SocialCard'
 * @param {string} args.format - format key from PLATFORM_FORMATS
 * @param {object} args.background - { imageUrl, fit?, blur?, brightness?, opacity? }
 * @param {object} [args.subject] - { imageUrl, gravity?, offsetX?, offsetY?, scale?, ... }
 * @param {object[]} [args.text] - array of text block props
 * @param {object} [args.gradient] - gradient overlay props
 * @param {object} [args.branding] - branding props
 * @param {boolean} [args.showSafeZones] - show safe zone overlays
 * @returns {Promise<{ok, outputPath, width, height, format, error?}>}
 */
export async function renderStill(args) {
  const fmt = PLATFORM_FORMATS[args.format];
  if (!fmt) {
    return { ok: false, error: `Unknown format: ${args.format}` };
  }

  const compositionId = `${args.compositionId}-${args.format}`;
  const jobId = `job-${randomUUID().slice(0, 8)}`;
  const jobDir = path.join(COMPOSITIONS_DIR, jobId);
  mkdirSync(jobDir, { recursive: true });

  const outputPath = path.join(jobDir, `${args.format}.png`);

  // Build input props
  const inputProps = buildInputProps(args, fmt);

  // Write props to temp file (Remotion CLI reads from file)
  const propsPath = path.join(jobDir, 'props.json');
  await writeFile(propsPath, JSON.stringify(inputProps));

  try {
    await runRemotionCli([
      'still', REMOTION_ENTRY,
      compositionId,
      outputPath,
      '--props', propsPath,
    ]);

    return {
      ok: true,
      outputPath,
      width: fmt.width,
      height: fmt.height,
      format: args.format,
      jobId,
    };
  } catch (err) {
    return { ok: false, error: err.message, format: args.format };
  }
}

/**
 * Render the same composition across multiple formats.
 *
 * @param {object} args - same as renderStill but with `formats` array instead of `format`
 * @returns {Promise<{ok, outputs[], errors[], jobDir, jobId}>}
 */
export async function renderBatch(args) {
  const jobId = `batch-${randomUUID().slice(0, 8)}`;
  const jobDir = path.join(COMPOSITIONS_DIR, jobId);
  mkdirSync(jobDir, { recursive: true });

  const outputs = [];
  const errors = [];

  // Render sequentially to avoid memory pressure from concurrent Chromium instances
  for (const formatId of args.formats) {
    const result = await renderStill({
      ...args,
      format: formatId,
    });

    if (result.ok) {
      // Move output into batch job dir
      const batchOutput = path.join(jobDir, `${formatId}.png`);
      const { readFile: rf, writeFile: wf } = await import('node:fs/promises');
      const data = await rf(result.outputPath);
      await wf(batchOutput, data);
      // Clean up individual job dir
      await rm(path.dirname(result.outputPath), { recursive: true, force: true });

      outputs.push({
        format: formatId,
        outputPath: batchOutput,
        width: result.width,
        height: result.height,
      });
    } else {
      errors.push({ format: formatId, error: result.error });
    }
  }

  return {
    ok: outputs.length > 0,
    outputs,
    errors,
    jobDir,
    jobId,
  };
}

/**
 * Render a video (MP4) via Remotion CLI.
 *
 * @param {object} args - same as renderStill plus fps, durationInFrames
 * @returns {Promise<{ok, outputPath, width, height, format, error?}>}
 */
export async function renderVideo(args) {
  const fmt = PLATFORM_FORMATS[args.format];
  if (!fmt) {
    return { ok: false, error: `Unknown format: ${args.format}` };
  }

  const jobId = `video-${randomUUID().slice(0, 8)}`;
  const jobDir = path.join(COMPOSITIONS_DIR, jobId);
  mkdirSync(jobDir, { recursive: true });

  const outputPath = path.join(jobDir, `${args.format}.mp4`);

  const inputProps = buildInputProps(args, fmt, {
    fps: args.fps || 30,
    durationInFrames: args.durationInFrames || 150,
  });

  const propsPath = path.join(jobDir, 'props.json');
  await writeFile(propsPath, JSON.stringify(inputProps));

  // Use video-specific composition or fallback
  const compositionId = `${args.compositionId}-video-${fmt.aspectRatio.replace(':', 'x').replace('.', '')}`;

  try {
    await runRemotionCli([
      'render', REMOTION_ENTRY,
      compositionId,
      outputPath,
      '--props', propsPath,
      '--codec', 'h264',
    ]);

    return {
      ok: true,
      outputPath,
      width: fmt.width,
      height: fmt.height,
      format: args.format,
      jobId,
    };
  } catch (err) {
    return { ok: false, error: err.message, format: args.format };
  }
}

// ── Internal Helpers ───────────────────────────────────────────────

function buildInputProps(args, fmt, videoOverrides = {}) {
  return {
    format: {
      width: fmt.width,
      height: fmt.height,
      platform: fmt.platform,
      variant: fmt.variant,
      fps: videoOverrides.fps || 30,
      durationInFrames: videoOverrides.durationInFrames || 1,
    },
    background: {
      imageUrl: args.background?.imageUrl || '',
      fit: args.background?.fit || 'cover',
      blur: args.background?.blur || 0,
      brightness: args.background?.brightness ?? 1,
      opacity: args.background?.opacity ?? 1,
    },
    ...(args.subject ? { subject: args.subject } : {}),
    gradient: args.gradient || {
      enabled: true,
      direction: 'bottom-up',
      color: 'rgba(0,0,0,0.7)',
      height: 0.5,
    },
    text: (args.text || []).map(t => ({
      content: t.content || '',
      fontFamily: t.fontFamily || 'Inter',
      fontSize: t.fontSize || 48,
      fontWeight: t.fontWeight || 700,
      color: t.color || '#FFFFFF',
      textAlign: t.textAlign || 'center',
      position: {
        x: t.position?.x ?? 0.5,
        y: t.position?.y ?? 0.5,
        anchor: t.position?.anchor || 'center',
      },
      maxWidth: t.maxWidth || 0.9,
      lineHeight: t.lineHeight || 1.2,
      letterSpacing: t.letterSpacing || 0,
      textTransform: t.textTransform || 'none',
      shadow: t.shadow,
      enterFrame: t.enterFrame,
      exitFrame: t.exitFrame,
      enterAnimation: t.enterAnimation || 'none',
    })),
    branding: args.branding || undefined,
    showSafeZones: args.showSafeZones || false,
  };
}

function runRemotionCli(cliArgs) {
  return new Promise((resolve, reject) => {
    const npxPath = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const child = execFile(npxPath, ['remotion', ...cliArgs], {
      cwd: REMOTION_PKG,
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Remotion render failed: ${stderr || error.message}`));
      } else {
        resolve(stdout);
      }
    });
  });
}
