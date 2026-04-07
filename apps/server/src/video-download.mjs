/**
 * Video download via yt-dlp.
 *
 * Supports TikTok, XiaoHongShu, and Instagram.
 * Downloads to a local directory, optionally uploads to R2.
 *
 * Requires: yt-dlp installed and on PATH.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const execFileAsync = promisify(execFile);

const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'artifacts', 'videos');

// ── yt-dlp wrapper ──────────────────────────────────────────────────

/**
 * Check if yt-dlp is available.
 * @returns {Promise<{ available: boolean, version?: string, error?: string }>}
 */
export async function checkYtDlp() {
  try {
    const { stdout } = await execFileAsync('yt-dlp', ['--version'], { timeout: 5000 });
    return { available: true, version: stdout.trim() };
  } catch (err) {
    return { available: false, error: err.message };
  }
}

/**
 * Download a single video by URL.
 *
 * @param {object} args
 * @param {string} args.url — video page URL (TikTok, XHS, Instagram)
 * @param {string} [args.outputDir] — download directory (default: artifacts/videos)
 * @param {string} [args.filename] — custom filename (without extension)
 * @param {string} [args.format] — yt-dlp format selector (default: best mp4)
 * @param {number} [args.timeout] — download timeout ms (default: 120000)
 * @returns {Promise<{ filePath: string, filename: string, size: number, duration?: number, title?: string }>}
 */
export async function downloadVideo(args) {
  const { url } = args;
  if (!url) throw new Error('url is required');

  const outputDir = args.outputDir || DEFAULT_OUTPUT_DIR;
  fs.mkdirSync(outputDir, { recursive: true });

  const id = args.filename || crypto.randomBytes(6).toString('hex');
  const outputTemplate = path.join(outputDir, `${id}.%(ext)s`);

  const ytdlpArgs = [
    url,
    '-o', outputTemplate,
    '--no-playlist',
    '--no-overwrites',
    '--print', 'after_move:filepath',
    '--print', 'after_move:%(title)s',
    '--print', 'after_move:%(duration)s',
  ];

  if (args.format) {
    ytdlpArgs.push('-f', args.format);
  } else {
    // Prefer mp4 for Gemini compatibility
    ytdlpArgs.push('-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best');
  }

  try {
    const { stdout, stderr } = await execFileAsync('yt-dlp', ytdlpArgs, {
      timeout: args.timeout || 120000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const lines = stdout.trim().split('\n').filter(Boolean);
    // yt-dlp --print outputs 3 lines per video: filepath, title, duration
    const filePath = lines[0] || '';
    const title = lines[1] || '';
    const duration = parseFloat(lines[2]) || undefined;

    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`Download completed but file not found. stdout: ${stdout}, stderr: ${stderr}`);
    }

    const stats = fs.statSync(filePath);
    return {
      filePath,
      filename: path.basename(filePath),
      size: stats.size,
      duration,
      title,
      url,
    };
  } catch (err) {
    if (err.killed) throw new Error(`Download timed out for ${url}`);
    throw new Error(`yt-dlp failed for ${url}: ${err.message}`);
  }
}

/**
 * Download multiple videos from scraped results.
 *
 * @param {object[]} results — scraped results with .videoPageUrl or .url
 * @param {object} [options]
 * @param {string} [options.outputDir]
 * @param {number} [options.concurrency=2] — parallel downloads
 * @param {number} [options.timeout] — per-download timeout
 * @returns {Promise<{ downloads: object[], errors: object[] }>}
 */
export async function downloadBatch(results, options = {}) {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 2, 5));
  const downloads = [];
  const errors = [];

  // Filter to results that have downloadable URLs
  const downloadable = results.filter((r) => r.videoPageUrl || r.url);

  for (let i = 0; i < downloadable.length; i += concurrency) {
    const batch = downloadable.slice(i, i + concurrency);
    const promises = batch.map(async (r, idx) => {
      const url = r.videoPageUrl || r.url;
      const platform = r.platform || 'unknown';
      const id = `${platform}-${crypto.randomBytes(4).toString('hex')}`;

      try {
        const result = await downloadVideo({
          url,
          outputDir: options.outputDir,
          filename: id,
          timeout: options.timeout,
        });
        return {
          ...result,
          platform,
          sourceTitle: r.title,
          sourceAuthor: r.author,
          sourceStats: r.stats,
          sourceUrl: url,
        };
      } catch (err) {
        return { error: err.message, url, platform, sourceTitle: r.title };
      }
    });

    const batchResults = await Promise.allSettled(promises);
    for (const result of batchResults) {
      const value = result.status === 'fulfilled' ? result.value : { error: result.reason?.message };
      if (value.error) {
        errors.push(value);
      } else {
        downloads.push(value);
      }
    }
  }

  return { downloads, errors, total: downloadable.length, skipped: results.length - downloadable.length };
}

/**
 * Get download module status.
 */
export async function getDownloadStatus() {
  const ytdlp = await checkYtDlp();
  return {
    ...ytdlp,
    outputDir: DEFAULT_OUTPUT_DIR,
    supportedPlatforms: ['tiktok', 'xiaohongshu', 'instagram'],
  };
}
