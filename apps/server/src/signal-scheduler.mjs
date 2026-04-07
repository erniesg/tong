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

Generate 5-7 themed keyword clusters covering:
1. Language learning content (Korean, Japanese, Chinese)
2. Dating sim / visual novel / otome game aesthetic
3. K-pop, anime, Asian culture content that our audience watches
4. Competitor apps (Duolingo, Drops, etc.)
5. Travel content for Seoul, Tokyo, Shanghai
6. Trending formats and challenges related to languages
7. Xiaohongshu lifestyle / aesthetic content about learning languages`;

const KEYWORD_SET_SCHEMA = {
  name: 'keyword_sets',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      sets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            theme: { type: 'string', description: 'short_snake_case cluster name' },
            description: { type: 'string', description: 'what this keyword cluster finds' },
            keywords: {
              type: 'object',
              properties: {
                global: { type: 'array', items: { type: 'string' } },
                tiktok: { type: 'array', items: { type: 'string' } },
                instagram: { type: 'array', items: { type: 'string' } },
                xiaohongshu: { type: 'array', items: { type: 'string' } },
              },
              required: ['global', 'tiktok', 'instagram', 'xiaohongshu'],
              additionalProperties: false,
            },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            languages: { type: 'array', items: { type: 'string' } },
          },
          required: ['theme', 'description', 'keywords', 'priority', 'languages'],
          additionalProperties: false,
        },
      },
    },
    required: ['sets'],
    additionalProperties: false,
  },
};

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
      response_format: { type: 'json_schema', json_schema: KEYWORD_SET_SCHEMA },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error (${res.status}): ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No response from OpenAI');

  return JSON.parse(content).sets;
}

// ── Keyword Generation from Brief ───────────────────────────────────

/**
 * Generate keyword sets from a structured product brief.
 * Reuses the OpenAI keyword gen with the brief injected as context.
 *
 * @param {object} brief — from extractBriefFromMultimodal()
 * @param {string} brief.description
 * @param {string[]} [brief.keywords]
 * @param {string} [brief.targetAudience]
 * @param {string[]} [brief.contentAngles]
 * @param {string[]} [brief.languages]
 * @returns {Promise<object[]>} — keyword sets in existing schema
 */
export async function generateKeywordsFromBrief(brief, options = {}) {
  const executionMode = String(options.executionMode || options.mode || process.env.SIGNALS_EXECUTION_MODE || '').toLowerCase();
  const isMock = executionMode === 'mock' || process.env.SIGNALS_MOCK === 'true' || process.env.SIGNALS_MOCK === '1';

  if (executionMode === 'preflight') {
    return [{ theme: 'preflight', description: 'preflight mode — keyword gen skipped', keywords: { global: [], tiktok: [], instagram: [], xiaohongshu: [] }, priority: 'low', languages: brief.languages || ['en'] }];
  }

  if (isMock) {
    return [
      { theme: 'mock_language_learning', description: '[mock] language learning keywords', keywords: { global: ['language learning', 'learn korean'], tiktok: ['#learnkorean', '#studyjapanese'], instagram: ['#languagelearning'], xiaohongshu: ['学韩语', '日语学习'] }, priority: 'high', languages: brief.languages || ['ko', 'ja', 'zh', 'en'] },
      { theme: 'mock_dating_sim', description: '[mock] dating sim keywords', keywords: { global: ['dating sim', 'visual novel'], tiktok: ['#datingsim', '#otomegame'], instagram: ['#visualnovel'], xiaohongshu: ['恋爱游戏'] }, priority: 'medium', languages: ['en', 'ja'] },
    ];
  }

  const apiKey = OPENAI_API_KEY();
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const briefContext = [
    `Product: ${brief.productName || brief.description}`,
    brief.description && `Description: ${brief.description}`,
    brief.targetAudience && `Target audience: ${brief.targetAudience}`,
    brief.contentAngles?.length && `Content angles: ${brief.contentAngles.join(', ')}`,
    brief.languages?.length && `Languages: ${brief.languages.join(', ')}`,
    brief.keywords?.length && `Seed keywords: ${brief.keywords.join(', ')}`,
    brief.campaignGoals?.length && `Campaign goals: ${brief.campaignGoals.join(', ')}`,
  ].filter(Boolean).join('\n');

  const prompt = `${KEYWORD_GEN_PROMPT}\n\nAdditional product context:\n${briefContext}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_schema', json_schema: KEYWORD_SET_SCHEMA },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error (${res.status}): ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No response from OpenAI');

  return JSON.parse(content).sets;
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
