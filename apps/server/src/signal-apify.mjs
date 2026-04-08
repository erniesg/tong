/**
 * Apify-based scrapers for XHS (Xiaohongshu) and Instagram.
 *
 * Puppeteer scraping of XHS search is unreliable (login wall).
 * Apify actors provide stable keyword search with structured JSON output.
 *
 * Actors:
 *   - XHS:       datapilot/rednote-xiaohongshu-search-scraper
 *   - Instagram:  apify/instagram-hashtag-scraper
 *
 * Env: APIFY_API_TOKEN (required for live mode)
 *
 * All results are normalised to the same shape as signal-browser.mjs output
 * so the pipeline doesn't care which backend produced the data.
 */

// ── Configuration ────────────────────────────────────────────────────

const APIFY_TOKEN = () => process.env.APIFY_API_TOKEN || '';
const APIFY_BASE = 'https://api.apify.com/v2';

// Tested 2026-04-08:
//   - IG: apify/instagram-hashtag-scraper — WORKS (posts, reels, carousels)
//   - XHS: easyapi/rednote-xiaohongshu-search-scraper — unreliable (minItems=100, often times out)
//          Use Puppeteer (signal-browser.mjs) for XHS instead.
const ACTORS = {
  xiaohongshu: 'easyapi/rednote-xiaohongshu-search-scraper',
  instagram: 'apify/instagram-hashtag-scraper',
};

const EXECUTION_MODES = ['live', 'mock', 'preflight'];

function resolveMode(options = {}) {
  const requested = String(
    options.executionMode || options.mode || process.env.SIGNALS_EXECUTION_MODE || 'live',
  ).toLowerCase();
  return EXECUTION_MODES.includes(requested) ? requested : 'live';
}

// ── Apify Actor Runner ──────────────────────────────────────────────

/**
 * Run an Apify actor synchronously and return the dataset items.
 *
 * Uses the synchronous run endpoint which waits for completion (up to timeout)
 * and returns dataset items directly.
 *
 * @param {string} actorId — actor name (e.g. "datapilot/rednote-xiaohongshu-search-scraper")
 * @param {object} input — actor input payload
 * @param {number} [timeoutSecs=120] — max wait time
 * @returns {Promise<object[]>} — dataset items
 */
async function runActorSync(actorId, input, timeoutSecs = 120) {
  const token = APIFY_TOKEN();
  if (!token) throw new Error('APIFY_API_TOKEN is not configured');

  const encoded = encodeURIComponent(actorId);
  const url = `${APIFY_BASE}/acts/${encoded}/run-sync-get-dataset-items?token=${token}&timeout=${timeoutSecs}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify actor ${actorId} failed (${res.status}): ${text.slice(0, 300)}`);
  }

  return res.json();
}

/**
 * Run an Apify actor asynchronously — start the run, poll for completion,
 * then fetch dataset items. More reliable for actors that take > 60s.
 *
 * @param {string} actorId
 * @param {object} input
 * @param {number} [timeoutMs=180000]
 * @returns {Promise<object[]>}
 */
async function runActorAsync(actorId, input, timeoutMs = 180000) {
  const token = APIFY_TOKEN();
  if (!token) throw new Error('APIFY_API_TOKEN is not configured');

  const encoded = encodeURIComponent(actorId);

  // Start the run
  const startRes = await fetch(`${APIFY_BASE}/acts/${encoded}/runs?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!startRes.ok) {
    const text = await startRes.text();
    throw new Error(`Apify actor ${actorId} start failed (${startRes.status}): ${text.slice(0, 300)}`);
  }

  const run = await startRes.json();
  const runId = run.data?.id;
  if (!runId) throw new Error('No run ID returned from Apify');

  // Poll for completion
  const deadline = Date.now() + timeoutMs;
  const pollInterval = 5000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`);
    if (!statusRes.ok) continue;

    const statusData = await statusRes.json();
    const status = statusData.data?.status;

    if (status === 'SUCCEEDED') {
      const datasetId = statusData.data?.defaultDatasetId;
      if (!datasetId) throw new Error('No dataset ID in completed run');

      const itemsRes = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?token=${token}`);
      if (!itemsRes.ok) throw new Error(`Failed to fetch dataset items: ${itemsRes.status}`);
      return itemsRes.json();
    }

    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new Error(`Apify actor ${actorId} run ${status}: ${statusData.data?.statusMessage || ''}`);
    }
  }

  throw new Error(`Apify actor ${actorId} timed out after ${timeoutMs}ms`);
}

// ── XHS (Xiaohongshu) Search ────────────────────────────────────────

/**
 * Search Xiaohongshu for notes/videos matching a keyword via Apify.
 *
 * @param {string} keyword — search term (e.g. "学韩语", "learn korean")
 * @param {number} [limit=20] — max results
 * @param {object} [options] — { executionMode }
 * @returns {Promise<object[]>} — normalised results matching signal-browser.mjs shape
 */
export async function apifyXhsSearch(keyword, limit = 20, options = {}) {
  const mode = resolveMode(options);

  if (mode === 'preflight') {
    return [];
  }

  if (mode === 'mock') {
    return Array.from({ length: Math.min(limit, 3) }, (_, i) => ({
      platform: 'xiaohongshu',
      keyword,
      type: 'note',
      title: `[Apify mock] ${keyword} XHS note ${i + 1}`,
      author: `mock_xhs_${i + 1}`,
      stats: { likes: (i + 1) * 500 },
      coverUrl: '',
      videoPageUrl: `https://www.xiaohongshu.com/explore/mock${i}`,
      scrapedAt: new Date().toISOString(),
      _scraper: 'apify',
    }));
  }

  // easyapi actor requires maxItems >= 100 and often times out.
  // Prefer Puppeteer for XHS (SIGNALS_SCRAPER_XIAOHONGSHU=puppeteer).
  const items = await runActorAsync(ACTORS.xiaohongshu, {
    queries: [keyword],
    maxItems: Math.max(100, limit),
    sort: 'general',
  }, 180000);

  const now = new Date().toISOString();
  return items.map((item) => ({
    platform: 'xiaohongshu',
    keyword,
    type: item.video_url ? 'video' : 'note',
    title: item.title || item.desc || '',
    author: item.author || item.user?.nickname || '',
    stats: {
      likes: item.likes || item.liked_count || 0,
      collects: item.collects || item.collected_count || 0,
      comments: item.comments || item.comment_count || 0,
    },
    coverUrl: item.cover_image_url || item.cover_url || item.image_list?.[0] || '',
    videoPageUrl: item.note_url || (item.note_id ? `https://www.xiaohongshu.com/explore/${item.note_id}` : ''),
    thumbnailUrl: item.cover_image_url || item.cover_url || '',
    scrapedAt: now,
    _scraper: 'apify',
    _raw: {
      noteId: item.note_id || item.id,
      videoUrl: item.video_url || null,
      description: item.description || item.desc || '',
    },
  }));
}

// ── Instagram Hashtag Search ────────────────────────────────────────

/**
 * Search Instagram for posts/reels/carousels matching a hashtag via Apify.
 *
 * Returns ALL content types: posts, reels, and carousels (with sidecar children).
 *
 * @param {string} hashtag — hashtag without # (e.g. "learnkorean")
 * @param {number} [limit=20] — max results
 * @param {object} [options] — { executionMode }
 * @returns {Promise<{ hashtag: string, posts: object[] }>}
 */
export async function apifyInstagramSearch(hashtag, limit = 20, options = {}) {
  const tag = hashtag.replace(/^#/, '');
  const mode = resolveMode(options);

  if (mode === 'preflight') {
    return { hashtag: tag, posts: [] };
  }

  if (mode === 'mock') {
    return {
      hashtag: tag,
      posts: Array.from({ length: Math.min(limit, 3) }, (_, i) => ({
        platform: 'instagram',
        keyword: `#${tag}`,
        type: i % 2 === 0 ? 'reel' : 'post',
        author: `mock_ig_${i + 1}`,
        caption: `[Apify mock] #${tag} content ${i + 1}`,
        stats: { likes: (i + 1) * 1000, comments: (i + 1) * 50 },
        videoPageUrl: `https://www.instagram.com/reel/mock${i}/`,
        thumbnailUrl: '',
        scrapedAt: new Date().toISOString(),
        _scraper: 'apify',
      })),
    };
  }

  const items = await runActorSync(ACTORS.instagram, {
    hashtags: [tag],
    resultsLimit: limit,
  });

  const now = new Date().toISOString();
  const posts = items.map((item) => {
    const isReel = item.type === 'Video' || item.videoUrl || item.isVideo;
    const isCarousel = item.type === 'Sidecar' || item.childPosts?.length > 0;

    return {
      platform: 'instagram',
      keyword: `#${tag}`,
      type: isReel ? 'reel' : isCarousel ? 'carousel' : 'post',
      author: item.ownerUsername || item.owner?.username || '',
      caption: (item.caption || '').slice(0, 500),
      stats: {
        likes: item.likesCount || item.likes || 0,
        comments: item.commentsCount || item.comments || 0,
        views: item.videoViewCount || item.playCount || 0,
      },
      hashtags: (item.caption?.match(/#[\w\u4e00-\u9fff\uac00-\ud7af]+/g) || []),
      videoPageUrl: item.url || item.permalink || '',
      thumbnailUrl: item.displayUrl || item.thumbnailUrl || '',
      scrapedAt: now,
      _scraper: 'apify',
      _raw: {
        shortcode: item.shortCode || item.shortcode || '',
        childPosts: isCarousel ? (item.childPosts || []).map((c) => ({
          type: c.type,
          url: c.displayUrl || c.videoUrl,
        })) : undefined,
      },
    };
  });

  return { hashtag: tag, posts };
}

// ── Unified Apify Search ────────────────────────────────────────────

/**
 * Search a platform via Apify. Drop-in replacement for browserSearch/searchPlatform
 * when Apify backend is selected.
 *
 * @param {string} platform — 'xiaohongshu' | 'instagram'
 * @param {string} keyword
 * @param {number} [limit=20]
 * @param {object} [options] — { executionMode }
 * @returns {Promise<object[]>} — flat array of normalised results
 */
export async function apifySearch(platform, keyword, limit = 20, options = {}) {
  if (platform === 'xiaohongshu') {
    return apifyXhsSearch(keyword, limit, options);
  }

  if (platform === 'instagram') {
    const tag = keyword.replace(/^#/, '').replace(/\s+/g, '');
    const { posts } = await apifyInstagramSearch(tag, limit, options);
    return posts;
  }

  throw new Error(`Apify scraper not available for platform: ${platform}. Use 'xiaohongshu' or 'instagram'.`);
}

// ── Status ──────────────────────────────────────────────────────────

export function getApifyStatus() {
  return {
    tokenConfigured: Boolean(APIFY_TOKEN()),
    actors: ACTORS,
    supportedPlatforms: ['xiaohongshu', 'instagram'],
  };
}
