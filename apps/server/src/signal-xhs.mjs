/**
 * XHS (Xiaohongshu / RED) search — multi-provider with automatic fallthrough.
 *
 * Providers (tried in order):
 *   1. RapidAPI "Xiaohongshu All API" — flaky but works with retries
 *   2. Apify actor — paid/unreliable free tier
 *   3. Puppeteer + cookies — requires manual cookie refresh every ~7 days
 *   4. Puppeteer (no auth) — falls back to explore feed (NOT keyword search)
 *
 * Configure via env:
 *   X-RapidAPI-Key           — enables RapidAPI provider
 *   APIFY_API_TOKEN           — enables Apify provider
 *   XHS_COOKIES_PATH          — path to cookies JSON for Puppeteer auth
 *   SIGNALS_XHS_PROVIDERS     — comma-separated provider order (default: rapidapi,puppeteer)
 *
 * All providers normalise results to the same shape.
 */

// ── Configuration ────────────────────────────────────────────────────

const RAPIDAPI_KEY = () => process.env['X-RapidAPI-Key'] || process.env.RAPIDAPI_KEY || '';
const RAPIDAPI_HOST = 'xiaohongshu-all-api.p.rapidapi.com';

function getProviderOrder() {
  const env = process.env.SIGNALS_XHS_PROVIDERS || '';
  if (env) return env.split(',').map((p) => p.trim().toLowerCase());
  // Default: try rapidapi first, then puppeteer
  const providers = [];
  if (RAPIDAPI_KEY()) providers.push('rapidapi');
  providers.push('puppeteer');
  return providers;
}

// ── RapidAPI Provider ───────────────────────────────────────────────

/**
 * Search XHS via RapidAPI "Xiaohongshu All API".
 * Flaky — returns 503 on first attempts, needs retries.
 *
 * @param {string} keyword
 * @param {number} limit — page size (API returns ~20 per page)
 * @param {object} options — { sort, noteType, noteTime, maxRetries }
 * @returns {Promise<object[]>} — normalised results
 */
async function rapidapiSearch(keyword, limit = 20, options = {}) {
  const key = RAPIDAPI_KEY();
  if (!key) throw new Error('X-RapidAPI-Key not configured');

  const maxRetries = options.maxRetries ?? 5;
  const sort = options.sort || 'general';
  const noteType = options.noteType || '_0';

  const params = new URLSearchParams({
    keyword,
    page: '1',
    sort,
    noteType,
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
        const items = data.data.items || [];
        return items.slice(0, limit).map((item) => normaliseRapidapiResult(item, keyword));
      }

      lastError = new Error(`RapidAPI code ${data.code}: ${data.message || 'unknown'}`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('RapidAPI search failed after retries');
}

function normaliseRapidapiResult(item, keyword) {
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
    coverUrl: note.images_list?.[0]?.url || note.images_list?.[0]?.url_size_large || '',
    videoPageUrl: note.note_id
      ? `https://www.xiaohongshu.com/explore/${note.note_id}`
      : '',
    thumbnailUrl: note.images_list?.[0]?.url || '',
    scrapedAt: new Date().toISOString(),
    _provider: 'rapidapi',
    _raw: {
      noteId: note.note_id,
      noteType: note.type,
      imageCount: note.images_list?.length || 0,
      hasVideo: Boolean(note.video?.url || note.video_info?.url),
    },
  };
}

// ── Puppeteer Provider (cookie-based) ───────────────────────────────

/**
 * Search XHS via Puppeteer with injected cookies.
 * Falls back to explore feed if no cookies / login required.
 */
async function puppeteerSearch(keyword, limit = 20) {
  // Dynamically import to avoid loading Puppeteer when not needed
  const { xiaohongshuSearch } = await import('./signal-browser.mjs');
  return xiaohongshuSearch(keyword, limit);
}

// ── Unified Search ──────────────────────────────────────────────────

/**
 * Search XHS using the first available provider that succeeds.
 *
 * @param {string} keyword — search term (Chinese or English)
 * @param {number} [limit=20]
 * @param {object} [options] — { sort, noteType, noteTime, executionMode, providers }
 * @returns {Promise<{ results: object[], provider: string, warnings: string[] }>}
 */
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
    rapidapi: {
      configured: Boolean(RAPIDAPI_KEY()),
      host: RAPIDAPI_HOST,
    },
    puppeteer: { available: true, note: 'falls back to explore feed without cookies' },
  };
}
