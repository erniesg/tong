#!/usr/bin/env node
/**
 * Standalone CLI for analyzing a playtest session via Gemini.
 *
 * Fetches recording + annotations from R2 (or local path), uploads to
 * Gemini Files API, runs structured analysis, outputs JSON to stdout.
 *
 * Designed to run in GitHub Actions or Claude Code remote agents —
 * no local server required, just GOOGLE_GEMINI_API_KEY env var.
 *
 * Usage:
 *   node scripts/analyze-playtest-session.mjs --session-id <id> [options]
 *
 * Options:
 *   --session-id     Playtest session ID (required)
 *   --preset         Analysis preset: ux_friction, translation_quality,
 *                    content_engagement, trend_analysis (default: ux_friction)
 *   --model          Gemini model: flash, pro (default: flash)
 *   --resolution     Media resolution: low, medium, high (default: low)
 *   --api-base       Worker API base URL (default: https://tong-api.erniesg.workers.dev)
 *   --r2-base        R2 public base URL (default: https://runs.tong.berlayar.ai)
 *   --video-path     Local video path (overrides R2 fetch)
 *   --annotations    Local annotations JSON path (overrides R2 fetch)
 *   --output         Output file path (default: stdout)
 *   --update-session Update session status in D1 after analysis
 *
 * Exit codes:
 *   0  Analysis complete, issues found (JSON on stdout)
 *   0  Analysis complete, no issues (JSON on stdout with empty issues array)
 *   1  Error (missing key, network failure, etc.)
 */

import { parseArgs } from 'node:util';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_SRC = resolve(__dirname, '..', 'apps', 'server', 'src');

// Dynamic import of server modules — they're ESM
const {
  uploadVideo,
  analyzeVideo,
  analyzePlaytestSession,
  ANALYSIS_PRESETS,
  listAnalysisPresets,
} = await import(resolve(SERVER_SRC, 'gemini-video.mjs'));

// ── CLI args ────────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    'session-id': { type: 'string' },
    preset: { type: 'string', default: 'ux_friction' },
    model: { type: 'string', default: 'flash' },
    resolution: { type: 'string', default: 'low' },
    'api-base': { type: 'string', default: 'https://tong-api.erniesg.workers.dev' },
    'r2-base': { type: 'string', default: 'https://runs.tong.berlayar.ai' },
    'video-path': { type: 'string' },
    annotations: { type: 'string' },
    output: { type: 'string' },
    'update-session': { type: 'boolean', default: false },
    'list-presets': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
  strict: false,
});

if (args.help) {
  console.log(`Usage: node scripts/analyze-playtest-session.mjs --session-id <id> [options]

Options:
  --session-id       Playtest session ID (required)
  --preset           Analysis preset (default: ux_friction)
  --model            flash | pro (default: flash)
  --resolution       low | medium | high (default: low)
  --api-base         Worker API URL
  --r2-base          R2 public URL
  --video-path       Local video file (skips R2 fetch)
  --annotations      Local annotations JSON (skips R2 fetch)
  --output           Write JSON to file instead of stdout
  --update-session   Update session status in D1
  --list-presets     Show available analysis presets
  --help             Show this help`);
  process.exit(0);
}

if (args['list-presets']) {
  const presets = listAnalysisPresets();
  console.log(JSON.stringify(presets, null, 2));
  process.exit(0);
}

if (!args['session-id']) {
  console.error('Error: --session-id is required');
  process.exit(1);
}

if (!process.env.GOOGLE_GEMINI_API_KEY) {
  console.error('Error: GOOGLE_GEMINI_API_KEY environment variable is not set');
  process.exit(1);
}

const sessionId = args['session-id'];
const apiBase = args['api-base'];
const r2Base = args['r2-base'];

// ── Fetch session metadata ──────────────────────────────────────────

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (tong-pipeline)' },
  });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json();
}

console.error(`[analyze] Session: ${sessionId}`);
console.error(`[analyze] Preset: ${args.preset}`);
console.error(`[analyze] Model: ${args.model}`);

// ── Get annotations ─────────────────────────────────────────────────

let annotationsJson = null;
let commentsJson = null;

if (args.annotations) {
  // Local file
  const { readFileSync } = await import('node:fs');
  const raw = JSON.parse(readFileSync(args.annotations, 'utf8'));
  const annotations = raw.annotations || raw;
  const comments = annotations.filter((a) => a.type === 'comment');
  const drawings = annotations.filter((a) => a.type === 'draw');
  annotationsJson = JSON.stringify(annotations);
  commentsJson = comments.length > 0 ? JSON.stringify(comments) : null;
  console.error(`[analyze] Loaded ${annotations.length} annotations from local file (${comments.length} comments, ${drawings.length} drawings)`);
} else {
  // Fetch from R2
  const annotationsUrl = `${r2Base}/playtest/${sessionId}/annotations.json`;
  try {
    const raw = await fetchJson(annotationsUrl);
    const annotations = raw.annotations || raw;
    const comments = annotations.filter((a) => a.type === 'comment');
    annotationsJson = JSON.stringify(annotations);
    commentsJson = comments.length > 0 ? JSON.stringify(comments) : null;
    console.error(`[analyze] Fetched ${annotations.length} annotations from R2 (${comments.length} comments)`);
  } catch (err) {
    console.error(`[analyze] Warning: Could not fetch annotations from R2: ${err.message}`);
  }
}

// ── Build video source ──────────────────────────────────────────────

const videoUrl = args['video-path']
  ? undefined
  : `${r2Base}/playtest/${sessionId}/recording.webm`;

const videoPath = args['video-path'] || undefined;

if (videoUrl) {
  console.error(`[analyze] Video URL: ${videoUrl}`);
} else {
  console.error(`[analyze] Video path: ${videoPath}`);
}

// ── Run analysis ────────────────────────────────────────────────────

console.error(`[analyze] Uploading to Gemini and analyzing...`);

try {
  const result = await analyzePlaytestSession({
    sessionId,
    analysisType: args.preset,
    model: args.model,
    mediaResolution: args.resolution,
    videoUrl,
    videoPath,
    annotationsJson,
    commentsJson,
  });

  // Enrich with metadata
  const output = {
    sessionId,
    preset: args.preset,
    model: result.model,
    analysisId: result.analysisId,
    tokensUsed: result.tokensUsed,
    createdAt: result.createdAt,
    result: result.result,
    // Summary stats
    summary: {
      issueCount: result.result?.issues?.length || 0,
      autoFixableCount: (result.result?.issues || []).filter((i) => i.autoFixable).length,
      overallScore: result.result?.overallScore,
      topPriority: result.result?.topPriority,
      categories: [...new Set((result.result?.issues || []).map((i) => i.category))],
    },
  };

  const json = JSON.stringify(output, null, 2);

  if (args.output) {
    writeFileSync(args.output, json + '\n');
    console.error(`[analyze] Results written to ${args.output}`);
  } else {
    console.log(json);
  }

  // Update session in D1 if requested
  if (args['update-session']) {
    try {
      await fetch(`${apiBase}/api/v1/playtest/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (tong-pipeline)',
        },
        body: JSON.stringify({
          status: 'analyzing',
          analysisId: result.analysisId,
        }),
      });
      console.error(`[analyze] Session status updated to 'analyzing'`);
    } catch (err) {
      console.error(`[analyze] Warning: Could not update session: ${err.message}`);
    }
  }

  const issueCount = output.summary.issueCount;
  const autoFixable = output.summary.autoFixableCount;
  console.error(`[analyze] Done. ${issueCount} issues found (${autoFixable} auto-fixable). Score: ${output.summary.overallScore}/10`);

} catch (err) {
  console.error(`[analyze] Error: ${err.message}`);
  process.exit(1);
}
