/**
 * Autonomous signal gathering scheduler.
 *
 * Runs on a configurable interval (default: daily at startup + every 24h).
 * Flow:
 *   1. Generate keyword sets via OpenAI (based on game content catalog)
 *   2. Run targeted scrape across all platforms with those keywords
 *   3. Optionally analyze top results via Gemini video understanding
 *   4. Save daily brief to data/signals/YYYY-MM-DD.json
 *
 * Can also be triggered manually via API.
 *
 * Env vars:
 *   SIGNAL_SCHEDULER_ENABLED=true     — enable auto-scheduling
 *   SIGNAL_SCHEDULER_INTERVAL_MS      — interval (default: 24h)
 *   SIGNAL_SCHEDULER_HOUR             — preferred hour UTC (default: 6 = 2pm SGT)
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  saveKeywordSet,
  listKeywordSets,
  runTargetedScrape,
} from './signals.mjs';

// ── Configuration ────────────────────────────────────────────────────

const ENABLED = () => process.env.SIGNAL_SCHEDULER_ENABLED === 'true';
const INTERVAL_MS = Number(process.env.SIGNAL_SCHEDULER_INTERVAL_MS || 24 * 60 * 60 * 1000);
const OPENAI_API_KEY = () => process.env.OPENAI_API_KEY || '';

let schedulerTimer = null;
let lastRunAt = null;
let lastRunStatus = null;

// ── Keyword Generation (server-side, no streaming needed) ───────────

const KEYWORD_GEN_PROMPT = `You are generating search keywords for a social media signals scraper.
The product is Tong — a dating-sim language learning game set in Seoul, Tokyo, and Shanghai.

Generate 5-7 themed keyword clusters. For each cluster output a JSON object:
{
  "theme": "short_snake_case_name",
  "description": "what this finds",
  "keywords": {
    "global": ["english terms"],
    "tiktok": ["#hashtags", "search terms"],
    "instagram": ["#hashtags"],
    "xiaohongshu": ["中文关键词", "english terms"]
  },
  "priority": "high|medium|low",
  "languages": ["ko","ja","zh","en"]
}

Cover these angles:
1. Language learning content (Korean, Japanese, Chinese)
2. Dating sim / visual novel / otome game aesthetic
3. K-pop, anime, Asian culture content that our audience watches
4. Competitor apps (Duolingo, Drops, etc.)
5. Travel content for Seoul, Tokyo, Shanghai
6. Trending formats and challenges related to languages
7. Xiaohongshu lifestyle / aesthetic content about learning languages

Output a JSON array of these objects. No markdown, just the array.`;

async function generateKeywordsServerSide() {
  const apiKey = OPENAI_API_KEY();
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: KEYWORD_GEN_PROMPT }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error (${res.status}): ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No response from OpenAI');

  const parsed = JSON.parse(content);
  // Handle both { sets: [...] } and direct array
  return Array.isArray(parsed) ? parsed : (parsed.sets || parsed.clusters || parsed.keyword_sets || [parsed]);
}

// ── Daily Run ───────────────────────────────────────────────────────

/**
 * Run the full autonomous signal gathering pipeline.
 *
 * @param {object} [options]
 * @param {boolean} [options.skipKeywordGen]    — use existing keyword sets
 * @param {boolean} [options.skipScrape]        — only generate keywords
 * @param {string}  [options.outputDir]         — override output directory
 * @returns {Promise<object>}
 */
export async function runSignalGathering(options = {}) {
  const startedAt = new Date().toISOString();
  const date = new Date().toISOString().slice(0, 10);

  const result = {
    date,
    startedAt,
    keywordsGenerated: 0,
    resultsFound: 0,
    warnings: [],
    status: 'running',
  };

  try {
    // Step 1: Generate keywords (unless skipped)
    let sets = listKeywordSets();
    if (!options.skipKeywordGen) {
      const generated = await generateKeywordsServerSide();
      for (const kw of generated) {
        saveKeywordSet({ ...kw, source: 'scheduler' });
      }
      sets = listKeywordSets();
      result.keywordsGenerated = generated.length;
    }

    // Step 2: Run targeted scrape (unless skipped)
    if (!options.skipScrape && sets.length > 0) {
      const scrapeResult = await runTargetedScrape({
        platforms: ['tiktok', 'instagram', 'xiaohongshu'],
        limit: 5,
      });
      result.resultsFound = scrapeResult.results?.length || 0;
      result.warnings.push(...(scrapeResult.warnings || []));
      result.scrapeData = scrapeResult;
    }

    // Step 3: Save daily brief
    const outputDir = options.outputDir || path.join(
      process.env.TONG_REPO_ROOT || process.cwd(),
      'apps', 'server', 'data', 'signals',
    );
    fs.mkdirSync(outputDir, { recursive: true });

    const briefPath = path.join(outputDir, `${date}.json`);
    const brief = {
      date,
      generatedAt: new Date().toISOString(),
      keywordSets: sets,
      results: result.scrapeData?.results || [],
      summary: {
        totalKeywordSets: sets.length,
        totalResults: result.resultsFound,
        platforms: ['tiktok', 'instagram', 'xiaohongshu'],
      },
    };
    fs.writeFileSync(briefPath, JSON.stringify(brief, null, 2));
    result.briefPath = briefPath;

    result.status = 'completed';
    result.completedAt = new Date().toISOString();
  } catch (err) {
    result.status = 'error';
    result.error = err.message;
  }

  lastRunAt = result.startedAt;
  lastRunStatus = result.status;

  return result;
}

// ── Scheduler Control ───────────────────────────────────────────────

/**
 * Start the autonomous scheduler.
 */
export function startScheduler() {
  if (schedulerTimer) return { status: 'already_running' };
  if (!ENABLED()) return { status: 'disabled', hint: 'Set SIGNAL_SCHEDULER_ENABLED=true' };

  // Run immediately on first start, then on interval
  runSignalGathering().catch((err) => {
    console.error('[signal-scheduler] Initial run failed:', err.message);
  });

  schedulerTimer = setInterval(() => {
    runSignalGathering().catch((err) => {
      console.error('[signal-scheduler] Scheduled run failed:', err.message);
    });
  }, INTERVAL_MS);

  return { status: 'started', intervalMs: INTERVAL_MS };
}

/**
 * Stop the scheduler.
 */
export function stopScheduler() {
  if (!schedulerTimer) return { status: 'not_running' };
  clearInterval(schedulerTimer);
  schedulerTimer = null;
  return { status: 'stopped' };
}

/**
 * Get scheduler status.
 */
export function getSchedulerStatus() {
  return {
    enabled: ENABLED(),
    running: Boolean(schedulerTimer),
    intervalMs: INTERVAL_MS,
    lastRunAt,
    lastRunStatus,
  };
}
