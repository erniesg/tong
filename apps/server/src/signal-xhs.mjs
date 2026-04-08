/**
 * XHS (Xiaohongshu / RED) search — multi-provider with automatic fallthrough.
 *
 * Providers (tried in order):
 *   1. rapidapi         — RapidAPI "Xiaohongshu All API" (works, needs retries)
 *   2. puppeteer        — Puppeteer no-auth (explore feed only, NOT keyword search)
 *
 * What doesn't work (tested 2026-04-08):
 *   - Puppeteer + cookies: XHS blocks headless browser fingerprint even with valid cookies
 *   - pip install xhs: anti-bot blocks built-in signer (code 300011)
 *   - Apify free actors: paid-only or timeout
 *
 * Configure via env:
 *   X-RapidAPI-Key             — enables RapidAPI provider
 *   SIGNALS_XHS_PROVIDERS     — comma-separated provider order override
 */

// RapidAPI is fetch-only, Puppeteer is imported dynamically

const RAPIDAPI_KEY = () => process.env['X-RapidAPI-Key'] || process.env.RAPIDAPI_KEY || '';
const RAPIDAPI_HOST = 'xiaohongshu-all-api.p.rapidapi.com';

function getProviderOrder() {
  const env = process.env.SIGNALS_XHS_PROVIDERS || '';
  if (env) return env.split(',').map((p) => p.trim().toLowerCase());
  const providers = [];
  if (RAPIDAPI_KEY()) providers.push('rapidapi');
  providers.push('puppeteer');
  return providers;
}

// ── Provider: RapidAPI ──────────────────────────────────────────────

async function rapidapiSearch(keyword, limit = 20, options = {}) {
  const key = RAPIDAPI_KEY();
  if (!key) throw new Error('X-RapidAPI-Key not configured');

  const maxRetries = options.maxRetries ?? 5;
  const params = new URLSearchParams({
    keyword,
    page: '1',
    sort: options.sort || 'general',
    noteType: options.noteType || '_0',
  });
  if (options.noteTime) params.set('noteTime', options.noteTime);

  let lastError = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));

    try {
      const res = await fetch(
        `https://${RAPIDAPI_HOST}/api/xiaohongshu/search-note/v2?${params}`,
        {
          headers: {
            'X-RapidAPI-Key': key,
            'X-RapidAPI-Host': RAPIDAPI_HOST,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(30000),
        },
      );

      const data = await res.json();
      if (data.code === 0 && data.data) {
        return (data.data.items || []).slice(0, limit).map((item) => {
          const note = item.note || item;
          const user = note.user || {};
          const interact = note.interact_info || {};
          return {
            platform: 'xiaohongshu',
            keyword,
            type: note.type === 'video' ? 'video' : 'note',
            title: note.display_title || note.title || note.desc?.slice(0, 100) || '',
            author: user.nickname || user.nick_name || '',
            stats: {
              likes: parseInt(interact.liked_count || note.liked_count || '0', 10) || 0,
              collects: parseInt(interact.collected_count || '0', 10) || 0,
              comments: parseInt(interact.comment_count || '0', 10) || 0,
            },
            coverUrl: note.images_list?.[0]?.url || '',
            videoPageUrl: note.note_id ? `https://www.xiaohongshu.com/explore/${note.note_id}` : '',
            thumbnailUrl: note.images_list?.[0]?.url || '',
            scrapedAt: new Date().toISOString(),
            _provider: 'rapidapi',
            _raw: { noteId: note.note_id, imageCount: note.images_list?.length || 0 },
          };
        });
      }
      lastError = new Error(`RapidAPI code ${data.code}: ${data.message || 'unknown'}`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('RapidAPI search failed after retries');
}

// ── Provider: Puppeteer (no auth) ───────────────────────────────────

async function puppeteerSearch(keyword, limit = 20) {
  const { xiaohongshuSearch } = await import('./signal-browser.mjs');
  return xiaohongshuSearch(keyword, limit);
}

// ── Unified Search ──────────────────────────────────────────────────

export async function xhsSearch(keyword, limit = 20, options = {}) {
  if (options.executionMode === 'preflight') {
    return { results: [], provider: 'preflight', warnings: [] };
  }

  if (options.executionMode === 'mock') {
    return {
      results: Array.from({ length: Math.min(limit, 3) }, (_, i) => ({
        platform: 'xiaohongshu',
        keyword,
        type: 'note',
        title: `[mock] ${keyword} XHS note ${i + 1}`,
        author: `mock_xhs_${i + 1}`,
        stats: { likes: (i + 1) * 500 },
        coverUrl: '',
        videoPageUrl: `https://www.xiaohongshu.com/explore/mock${i}`,
        scrapedAt: new Date().toISOString(),
        _provider: 'mock',
      })),
      provider: 'mock',
      warnings: [],
    };
  }

  const providers = options.providers || getProviderOrder();
  const warnings = [];

  for (const provider of providers) {
    try {
      let results;

      if (provider === 'rapidapi') {
        if (!RAPIDAPI_KEY()) {
          warnings.push('rapidapi: X-RapidAPI-Key not configured, skipping');
          continue;
        }
        results = await rapidapiSearch(keyword, limit, options);
      } else if (provider === 'puppeteer') {
        results = await puppeteerSearch(keyword, limit);
      } else {
        warnings.push(`${provider}: unknown provider, skipping`);
        continue;
      }

      if (results.length > 0) {
        return { results, provider, warnings };
      }
      warnings.push(`${provider}: returned 0 results`);
    } catch (err) {
      warnings.push(`${provider}: ${err.message}`);
    }
  }

  return { results: [], provider: 'none', warnings };
}

// ── Status ──────────────────────────────────────────────────────────

export function getXhsStatus() {
  return {
    providers: getProviderOrder(),
    'puppeteer-cookie': {
      cookieConfigured: hasCookie(),
      cookieSource: process.env.XHS_COOKIE ? 'env' : hasCookie() ? 'file' : 'none',
      note: 'refresh cookies every ~7 days',
    },
    rapidapi: {
      configured: Boolean(RAPIDAPI_KEY()),
      host: RAPIDAPI_HOST,
      note: 'flaky, needs retries (~35s), burns credits',
    },
    puppeteer: {
      available: true,
      note: 'explore feed only without cookies — NOT keyword search',
    },
  };
}
