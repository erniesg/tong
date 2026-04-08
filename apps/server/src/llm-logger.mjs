/**
 * Lightweight LLM call logger — captures prompt, response, tokens, and cost
 * for every LLM call in the signals pipeline.
 *
 * Writes JSONL to data/logs/llm-calls.jsonl.
 * Pricing last verified 2026-04-08.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.resolve(__dirname, '..', 'data', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'llm-calls.jsonl');

// ── Cost table (USD per 1M tokens) ─────────────────────────────────
// Source: ai.google.dev/gemini-api/docs/pricing, openai.com/api/pricing
// Verified 2026-04-08

const COST_PER_1M = {
  'gemini-3.1-flash-lite-preview': { input: 0.25, output: 1.50 },
  'gemini-3.1-pro-preview':        { input: 2.00, output: 12.00 },
  'gpt-4o-mini':                   { input: 0.15, output: 0.60 },
  'gpt-4o':                        { input: 2.50, output: 10.00 },
};

/**
 * Estimate cost in USD from token counts.
 * @param {string} model
 * @param {{ input: number, output: number }} tokens
 * @returns {{ inputCost: number, outputCost: number, totalCost: number }}
 */
export function estimateCost(model, tokens) {
  const rates = COST_PER_1M[model] || { input: 0, output: 0 };
  const inputCost = (tokens.input * rates.input) / 1_000_000;
  const outputCost = (tokens.output * rates.output) / 1_000_000;
  return { inputCost, outputCost, totalCost: inputCost + outputCost };
}

/**
 * Truncate base64 data in prompt parts to keep logs manageable.
 */
function sanitizeParts(parts) {
  if (!Array.isArray(parts)) return parts;
  return parts.map(p => {
    if (p?.inline_data?.data && p.inline_data.data.length > 120) {
      return { ...p, inline_data: { ...p.inline_data, data: p.inline_data.data.slice(0, 100) + '...[truncated]' } };
    }
    if (p?.file_data) {
      return { file_data: { mime_type: p.file_data.mime_type, file_uri: p.file_data.file_uri } };
    }
    return p;
  });
}

/**
 * Log an LLM call to JSONL.
 *
 * @param {object} entry
 * @param {number} entry.step — pipeline step number (1, 2, 5, 7)
 * @param {string} entry.name — function name
 * @param {string} entry.model
 * @param {*} entry.input — prompt text or parts (will be sanitized)
 * @param {*} entry.output — raw response text
 * @param {{ input: number, output: number, total?: number }} entry.tokens
 * @param {number} [entry.durationMs]
 * @param {string} [entry.status] — 'success' | 'error'
 * @param {string} [entry.runId]
 * @returns {{ model: string, tokens: object, cost: object, durationMs: number, input: *, output: * }}
 */
export function logLlmCall(entry) {
  const tokens = {
    input: entry.tokens?.input || 0,
    output: entry.tokens?.output || 0,
    total: entry.tokens?.total || (entry.tokens?.input || 0) + (entry.tokens?.output || 0),
  };
  const cost = estimateCost(entry.model, tokens);

  // JSONL gets sanitized (truncated base64)
  const line = {
    timestamp: new Date().toISOString(),
    runId: entry.runId || null,
    step: entry.step,
    name: entry.name,
    model: entry.model,
    input: Array.isArray(entry.input) ? sanitizeParts(entry.input) : entry.input,
    output: entry.output,
    tokens,
    cost,
    durationMs: entry.durationMs || 0,
    status: entry.status || 'success',
  };

  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify(line) + '\n');
  } catch (err) {
    console.warn('[llm-logger] Failed to write log:', err.message);
  }

  // API response gets full input/output (including images) for backstage rendering
  return {
    model: entry.model,
    tokens,
    cost,
    durationMs: line.durationMs,
    input: entry.input,
    output: entry.output,
  };
}

/**
 * Read recent LLM logs.
 * @param {object} [opts]
 * @param {number} [opts.step] — filter by step
 * @param {number} [opts.limit=100]
 * @returns {object[]}
 */
export function getLlmLogs(opts = {}) {
  const limit = opts.limit || 100;
  try {
    const raw = fs.readFileSync(LOG_FILE, 'utf8').trim();
    if (!raw) return [];
    let lines = raw.split('\n').map(l => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
    if (opts.step != null) lines = lines.filter(l => l.step === opts.step);
    return lines.slice(-limit);
  } catch {
    return [];
  }
}

/**
 * Clear all LLM logs.
 */
export function clearLlmLogs() {
  try { fs.writeFileSync(LOG_FILE, ''); } catch { /* noop */ }
}
