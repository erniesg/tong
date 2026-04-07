/**
 * Signal result filtering and multimodal brief extraction.
 *
 * Two-pass filtering pipeline:
 *   Pass 1 — Engagement threshold (free, instant): drop results below minViews/minLikes.
 *   Pass 2 — Relevance scoring (Gemini Flash, ~$0.002/image): score remaining results
 *             against a product brief using thumbnails + metadata.
 *
 * Also provides multimodal brief extraction: feed images, text, repo context into
 * Gemini Flash to produce a structured product brief for keyword generation.
 *
 * Env vars:
 *   GOOGLE_GEMINI_API_KEY — required for relevance scoring and brief extraction.
 *   SIGNALS_MOCK=true     — return synthetic data without API calls.
 */

import fs from 'node:fs';
import path from 'node:path';

// ── Configuration ────────────────────────────────────────────────────

const GEMINI_API_KEY = () => process.env.GOOGLE_GEMINI_API_KEY || '';
const MOCK_MODE = () => process.env.SIGNALS_MOCK === 'true' || process.env.SIGNALS_MOCK === '1';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const FLASH_MODEL = 'gemini-3-flash-preview';

const EXECUTION_MODES = ['live', 'mock', 'preflight'];

function resolveMode(options = {}) {
  const requested = String(
    options.executionMode || options.mode || process.env.SIGNALS_EXECUTION_MODE || (MOCK_MODE() ? 'mock' : 'live'),
  ).toLowerCase();
  return EXECUTION_MODES.includes(requested) ? requested : (MOCK_MODE() ? 'mock' : 'live');
}

// ── View Count Parsing ──────────────────────────────────────────────

/**
 * Normalize engagement count strings to integers.
 * Handles: "1.7M", "167K", "5900", 42000, null, undefined.
 *
 * @param {string|number|null|undefined} value
 * @returns {number|null}
 */
export function parseViewCount(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Math.round(value);
  const str = String(value).trim().toUpperCase();
  if (!str) return null;

  const match = str.match(/^([\d.]+)\s*([KMB])?$/);
  if (!match) {
    const num = Number(str.replace(/,/g, ''));
    return Number.isFinite(num) ? Math.round(num) : null;
  }

  const base = parseFloat(match[1]);
  const suffix = match[2];
  if (!Number.isFinite(base)) return null;
  if (suffix === 'K') return Math.round(base * 1_000);
  if (suffix === 'M') return Math.round(base * 1_000_000);
  if (suffix === 'B') return Math.round(base * 1_000_000_000);
  return Math.round(base);
}

// ── Pass 1: Engagement Threshold ────────────────────────────────────

/**
 * Filter search results by engagement thresholds.
 * Pure function, zero cost, instant.
 *
 * @param {object[]} results — scraped results with .stats.views / .stats.likes
 * @param {object} [options]
 * @param {number} [options.minViews=0]
 * @param {number} [options.minLikes=0]
 * @returns {{ passed: object[], dropped: number }}
 */
export function filterByEngagement(results, options = {}) {
  const minViews = options.minViews ?? 0;
  const minLikes = options.minLikes ?? 0;

  const passed = [];
  for (const r of results) {
    const views = parseViewCount(r.stats?.views ?? r.views ?? r.playCount) ?? 0;
    const likes = parseViewCount(r.stats?.likes ?? r.likes ?? r.diggCount) ?? 0;
    if (views >= minViews && likes >= minLikes) {
      passed.push({ ...r, _parsedViews: views, _parsedLikes: likes });
    }
  }

  return { passed, dropped: results.length - passed.length };
}

// ── Pass 2: Relevance Scoring ───────────────────────────────────────

const RELEVANCE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    relevanceScore: { type: 'INTEGER', description: '0-100 relevance to the product brief' },
    reasoning: { type: 'STRING', description: 'One sentence explaining the score' },
    matchedKeywords: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Keywords from the brief that match this result' },
  },
  required: ['relevanceScore', 'reasoning', 'matchedKeywords'],
};

/**
 * Score search results for relevance against a product brief using Gemini Flash.
 * Uses thumbnails (inline base64) + metadata (title, hashtags) when available.
 *
 * @param {object[]} results — filtered results, may have .thumbnailUrl/.coverUrl
 * @param {object} brief — { description: string, keywords?: string[], targetAudience?: string }
 * @param {object} [options]
 * @param {number} [options.batchSize=5] — concurrent requests
 * @param {string} [options.executionMode]
 * @returns {Promise<{ scored: object[], cost: { calls: number, inputTokens: number, outputTokens: number } }>}
 */
export async function scoreRelevance(results, brief, options = {}) {
  const mode = resolveMode(options);
  const batchSize = Math.max(1, Math.min(Number(options.batchSize) || 5, 20));

  if (mode === 'preflight') {
    return {
      scored: [],
      cost: { calls: 0, inputTokens: 0, outputTokens: 0 },
      execution: { mode: 'preflight', portable: true, dependencies: ['GOOGLE_GEMINI_API_KEY'] },
    };
  }

  if (mode === 'mock') {
    const scored = results.map((r, i) => ({
      ...r,
      _relevance: { relevanceScore: 90 - i * 3, reasoning: '[mock] synthetic relevance score', matchedKeywords: brief.keywords?.slice(0, 2) || [] },
    }));
    scored.sort((a, b) => b._relevance.relevanceScore - a._relevance.relevanceScore);
    return { scored, cost: { calls: 0, inputTokens: 0, outputTokens: 0 }, execution: { mode: 'mock' } };
  }

  const key = GEMINI_API_KEY();
  if (!key) throw new Error('GOOGLE_GEMINI_API_KEY is not configured');

  const briefText = [
    `Product: ${brief.description}`,
    brief.keywords?.length ? `Keywords: ${brief.keywords.join(', ')}` : '',
    brief.targetAudience ? `Target audience: ${brief.targetAudience}` : '',
  ].filter(Boolean).join('\n');

  const totalCost = { calls: 0, inputTokens: 0, outputTokens: 0 };
  const scored = [];

  // Process in batches
  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);
    const promises = batch.map(async (r) => {
      const parts = [];

      // Try to include thumbnail
      const thumbUrl = r.thumbnailUrl || r.coverUrl;
      if (thumbUrl) {
        try {
          const res = await fetch(thumbUrl);
          if (res.ok) {
            const buffer = Buffer.from(await res.arrayBuffer());
            const mime = res.headers.get('content-type') || 'image/jpeg';
            parts.push({ inline_data: { mime_type: mime, data: buffer.toString('base64') } });
          }
        } catch { /* skip thumbnail, use text only */ }
      }

      // Metadata text
      const meta = [
        r.title && `Title: ${r.title}`,
        r.author && `Author: ${r.author}`,
        r.caption && `Caption: ${r.caption}`,
        r.hashtags?.length && `Hashtags: ${r.hashtags.join(' ')}`,
        r.platform && `Platform: ${r.platform}`,
        r._parsedViews && `Views: ${r._parsedViews.toLocaleString()}`,
      ].filter(Boolean).join('\n');

      parts.push({ text: `${briefText}\n\n---\nVideo result:\n${meta}\n\nRate the relevance of this video to the product above. Score 0-100.` });

      const body = {
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RELEVANCE_SCHEMA,
        },
      };

      const apiRes = await fetch(
        `${GEMINI_BASE}/v1beta/models/${FLASH_MODEL}:generateContent?key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      );

      totalCost.calls++;

      if (!apiRes.ok) {
        const errText = await apiRes.text();
        console.warn(`[signal-filter] Gemini relevance scoring failed: ${apiRes.status} ${errText}`);
        return { ...r, _relevance: { relevanceScore: 50, reasoning: `scoring failed: ${apiRes.status}`, matchedKeywords: [] } };
      }

      const data = await apiRes.json();
      const tokens = data.usageMetadata || {};
      totalCost.inputTokens += tokens.promptTokenCount || 0;
      totalCost.outputTokens += tokens.candidatesTokenCount || 0;

      let parsed;
      try {
        parsed = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
      } catch {
        parsed = { relevanceScore: 50, reasoning: 'parse error', matchedKeywords: [] };
      }

      return { ...r, _relevance: parsed };
    });

    const batchResults = await Promise.allSettled(promises);
    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      scored.push(result.status === 'fulfilled' ? result.value : { ...batch[j], _relevance: { relevanceScore: 0, reasoning: `error: ${result.reason?.message || 'unknown'}`, matchedKeywords: [] } });
    }
  }

  scored.sort((a, b) => (b._relevance?.relevanceScore ?? 0) - (a._relevance?.relevanceScore ?? 0));
  return { scored, cost: totalCost, execution: { mode: 'live' } };
}

// ── Full Filter Pipeline ────────────────────────────────────────────

/**
 * Two-pass filter: engagement threshold → relevance scoring.
 *
 * @param {object[]} results
 * @param {object} brief — { description, keywords?, targetAudience? }
 * @param {object} [options] — { minViews?, minLikes?, batchSize?, topN?, executionMode? }
 * @returns {Promise<{ ranked: object[], stats: object, cost: object }>}
 */
export async function runFilterPipeline(results, brief, options = {}) {
  // Pass 1: engagement
  const { passed, dropped: engagementDropped } = filterByEngagement(results, {
    minViews: options.minViews ?? 2000,
    minLikes: options.minLikes ?? 0,
  });

  // Pass 2: relevance
  const { scored, cost, execution } = await scoreRelevance(passed, brief, {
    batchSize: options.batchSize,
    executionMode: options.executionMode,
  });

  // Top N
  const topN = options.topN ?? scored.length;
  const ranked = scored.slice(0, topN);

  return {
    ranked,
    stats: {
      total: results.length,
      afterEngagementFilter: passed.length,
      engagementDropped,
      afterRelevanceScoring: scored.length,
      returned: ranked.length,
    },
    cost,
    execution,
  };
}

// ── Multimodal Brief Extraction ─────────────────────────────────────

const BRIEF_EXTRACTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    productName: { type: 'STRING' },
    description: { type: 'STRING', description: 'Concise product description (2-3 sentences)' },
    targetAudience: { type: 'STRING' },
    campaignGoals: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Marketing/campaign goals' },
    keywords: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Suggested search keywords (10-20)' },
    platforms: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Relevant social platforms' },
    contentAngles: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Content angles to explore' },
    languages: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Relevant languages (ISO codes)' },
  },
  required: ['productName', 'description', 'keywords'],
};

/**
 * Extract a structured product brief from multimodal inputs via Gemini Flash.
 *
 * @param {object} inputs
 * @param {string} [inputs.text] — product description or campaign goal
 * @param {string[]} [inputs.imageUrls] — screenshot/product image URLs
 * @param {Array<{data: string, mimeType: string}>} [inputs.imageBase64] — pre-encoded images
 * @param {boolean} [inputs.repoContext] — read CLAUDE.md + package.json from repo
 * @param {string} [inputs.executionMode]
 * @returns {Promise<object>} — structured brief matching BRIEF_EXTRACTION_SCHEMA
 */
export async function extractBriefFromMultimodal(inputs = {}) {
  const mode = resolveMode(inputs);

  if (mode === 'preflight') {
    return {
      brief: null,
      execution: { mode: 'preflight', portable: true, dependencies: ['GOOGLE_GEMINI_API_KEY'] },
    };
  }

  if (mode === 'mock') {
    return {
      brief: {
        productName: 'Tong',
        description: 'A dating-sim language learning game set in Seoul, Tokyo, and Shanghai.',
        targetAudience: '18-35 year olds interested in Asian languages and culture',
        campaignGoals: ['increase awareness', 'drive signups'],
        keywords: ['language learning', 'dating sim', 'korean', 'japanese', 'chinese', 'anime game', 'learn korean tiktok'],
        platforms: ['tiktok', 'instagram', 'xiaohongshu'],
        contentAngles: ['language learning tips', 'dating sim aesthetics', 'travel content'],
        languages: ['ko', 'ja', 'zh', 'en'],
      },
      execution: { mode: 'mock' },
    };
  }

  const key = GEMINI_API_KEY();
  if (!key) throw new Error('GOOGLE_GEMINI_API_KEY is not configured');

  const parts = [];

  // Repo context
  if (inputs.repoContext) {
    const repoRoot = process.env.TONG_REPO_ROOT || process.cwd();
    for (const file of ['CLAUDE.md', 'package.json']) {
      const filePath = path.join(repoRoot, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        // Truncate to avoid blowing context
        parts.push({ text: `[${file}]:\n${content.slice(0, 4000)}` });
      } catch { /* file not found, skip */ }
    }
    // Also read the landing page for product context
    const landingPath = path.join(repoRoot, 'apps', 'client', 'app', 'page.tsx');
    try {
      const content = fs.readFileSync(landingPath, 'utf8');
      parts.push({ text: `[Landing page source]:\n${content.slice(0, 3000)}` });
    } catch { /* skip */ }
  }

  // Images from URLs
  if (inputs.imageUrls?.length) {
    for (const url of inputs.imageUrls.slice(0, 5)) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          const mime = res.headers.get('content-type') || 'image/jpeg';
          parts.push({ inline_data: { mime_type: mime, data: buffer.toString('base64') } });
        }
      } catch { /* skip failed images */ }
    }
  }

  // Pre-encoded images
  if (inputs.imageBase64?.length) {
    for (const img of inputs.imageBase64.slice(0, 5)) {
      parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } });
    }
  }

  // Text input
  if (inputs.text) {
    parts.push({ text: `User input: ${inputs.text}` });
  }

  if (parts.length === 0) {
    throw new Error('At least one input (text, imageUrls, imageBase64, or repoContext) is required');
  }

  parts.push({
    text: 'Based on all the context above, extract a structured product/campaign brief. '
      + 'Include the product name, description, target audience, campaign goals, '
      + 'suggested search keywords (10-20 platform-specific hashtags and terms), '
      + 'relevant social platforms, content angles to explore, and relevant languages.',
  });

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: BRIEF_EXTRACTION_SCHEMA,
    },
  };

  const res = await fetch(
    `${GEMINI_BASE}/v1beta/models/${FLASH_MODEL}:generateContent?key=${key}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini brief extraction failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  let parsed;
  try {
    parsed = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
  } catch {
    throw new Error('Failed to parse Gemini brief extraction response');
  }

  return { brief: parsed, execution: { mode: 'live' } };
}
