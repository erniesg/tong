/**
 * Signals intelligence module — TikTok, Instagram, Xiaohongshu (RED).
 *
 * Gathers social media signals: trending formats, sounds, hashtags, aesthetics.
 * Used by campaign ideation AI and backstage content generation.
 *
 * Strategy:
 *   1. Official API keys (TIKTOK_API_KEY, INSTAGRAM_API_KEY, XHS_API_KEY) if configured
 *   2. Public web scraping via fetch + HTML parsing (no headless browser needed)
 *   3. Mock mode (__mock: true in options, or SIGNALS_MOCK=true env) for development
 *
 * All functions are designed to be called from the tool invocation layer.
 * Platforms actively block scrapers; the module degrades gracefully and returns
 * partial results with a `warnings` array rather than crashing.
 *
 * Rate limiting: minimum 1-second gap between outgoing requests enforced per-platform.
 * Cache TTL: 15 minutes (signals are slow-moving; no need to re-scrape every call).
 */

// ── Configuration ────────────────────────────────────────────────────

const TIKTOK_API_KEY = () => process.env.TIKTOK_API_KEY || '';
const INSTAGRAM_API_KEY = () => process.env.INSTAGRAM_API_KEY || '';
const XHS_API_KEY = () => process.env.XHS_API_KEY || '';

const CACHE_TTL_MS = Number(process.env.SIGNALS_CACHE_TTL_MS || process.env.TRENDS_CACHE_TTL_MS || 15 * 60 * 1000);
const MOCK_MODE = () =>
  process.env.SIGNALS_MOCK === 'true' || process.env.SIGNALS_MOCK === '1' ||
  process.env.TRENDS_MOCK === 'true' || process.env.TRENDS_MOCK === '1';

// Scraper User-Agent — generic browser string to reduce block rate
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── In-memory cache ──────────────────────────────────────────────────

/**
 * @type {Map<string, { data: object, ts: number }>}
 */
const trendCache = new Map();
let lastScrapeAt = null;
let cachedTrendCount = 0;

function getCached(key) {
  const entry = trendCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    trendCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  trendCache.set(key, { data, ts: Date.now() });
}

const SIGNAL_EXECUTION_MODES = ['live', 'mock', 'preflight'];

function resolveSignalsExecutionMode(options = {}) {
  const requested = String(
    options.executionMode ||
    options.mode ||
    process.env.SIGNALS_EXECUTION_MODE ||
    (MOCK_MODE() ? 'mock' : 'live'),
  ).toLowerCase();
  if (SIGNAL_EXECUTION_MODES.includes(requested)) return requested;
  return MOCK_MODE() ? 'mock' : 'live';
}

function buildSignalLiveDependencyHints() {
  return [
    'outbound network access to tiktok.com, instagram.com, xiaohongshu.com',
    'target platforms not blocking automated scraping from this runtime',
  ];
}

// ── Rate-limit helper ────────────────────────────────────────────────

const lastRequestAt = {};

async function rateLimitedFetch(platform, url, fetchOpts = {}) {
  const now = Date.now();
  const last = lastRequestAt[platform] || 0;
  const elapsed = now - last;
  if (elapsed < 1000) {
    await new Promise((r) => setTimeout(r, 1000 - elapsed));
  }
  lastRequestAt[platform] = Date.now();

  const opts = {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/json,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      ...fetchOpts.headers,
    },
    signal: AbortSignal.timeout(12000), // 12s timeout
    ...fetchOpts,
  };
  return fetch(url, opts);
}

// ── Normalizer ───────────────────────────────────────────────────────

/**
 * @typedef {object} Trend
 * @property {'tiktok'|'instagram'|'xiaohongshu'} platform
 * @property {'hashtag'|'sound'|'format'|'aesthetic'|'topic'} type
 * @property {string} name
 * @property {string} description
 * @property {{ views?: number, posts?: number, growth?: string }} engagement
 * @property {{ languages: string[], themes: string[], formatNotes: string }} relevance
 * @property {string} [sourceUrl]
 * @property {string} scrapedAt
 */

/**
 * Infer game-relevance metadata from a trend name + description.
 * Cheap heuristic — no LLM call.
 *
 * @param {string} name
 * @param {string} description
 * @returns {{ languages: string[], themes: string[] }}
 */
function inferRelevance(name, description) {
  const text = `${name} ${description}`.toLowerCase();

  const languages = [];
  if (/korean|korea|\bko\b|hangul|kpop|k-pop|한국|韓國/.test(text)) languages.push('ko');
  if (/japanese|japan|\bja\b|anime|manga|日本|j-pop/.test(text)) languages.push('ja');
  if (/chinese|china|mandarin|\bzh\b|中文|中国|taiwan|hong kong/.test(text)) languages.push('zh');
  if (/english|\ben\b/.test(text)) languages.push('en');

  const themes = [];
  if (/learn|study|language|vocab|grammar|flashcard/.test(text)) themes.push('language_learning');
  if (/dating|romance|crush|love|flirt|couple/.test(text)) themes.push('dating_sim');
  if (/anime|manga|cosplay|otaku/.test(text)) themes.push('anime');
  if (/kpop|k-pop|idol|bts|blackpink|twice|aespa/.test(text)) themes.push('kpop');
  if (/drama|kdrama|dorama|series|episode/.test(text)) themes.push('drama');
  if (/food|eat|restaurant|snack|cafe|boba/.test(text)) themes.push('food');
  if (/travel|city|street|explore|tour/.test(text)) themes.push('travel');
  if (/challenge|trend|viral|fyp/.test(text)) themes.push('viral_format');

  return { languages, themes };
}

// ── Mock data ────────────────────────────────────────────────────────

function buildMockTrends(platform) {
  const now = new Date().toISOString();

  const mocks = {
    tiktok: [
      {
        platform: 'tiktok',
        type: 'hashtag',
        name: '#learnkorean',
        description: 'Short-form Korean language learning clips; hook is a common phrase + translation reveal.',
        engagement: { views: 2400000000, posts: 3800000, growth: 'rising' },
        relevance: {
          languages: ['ko', 'en'],
          themes: ['language_learning', 'kpop'],
          formatNotes: '15s hook + reveal; on-screen text only, no voiceover',
        },
        sourceUrl: 'https://www.tiktok.com/tag/learnkorean',
        scrapedAt: now,
      },
      {
        platform: 'tiktok',
        type: 'hashtag',
        name: '#studywithme',
        description: 'Lo-fi study session content; language learning accounts use it for vocab drills.',
        engagement: { views: 18000000000, posts: 12000000, growth: 'stable' },
        relevance: {
          languages: ['en', 'ko', 'ja', 'zh'],
          themes: ['language_learning'],
          formatNotes: '30-60s ambient POV; slow pan over study material',
        },
        sourceUrl: 'https://www.tiktok.com/tag/studywithme',
        scrapedAt: now,
      },
      {
        platform: 'tiktok',
        type: 'sound',
        name: 'Flowers — Miley Cyrus (slowed)',
        description: 'Slowed + reverb trend used under aesthetic montages; popular for "day in my life" abroad content.',
        engagement: { posts: 420000, growth: 'stable' },
        relevance: {
          languages: ['en'],
          themes: ['travel', 'viral_format'],
          formatNotes: '21s cutdown; works best with location B-roll',
        },
        scrapedAt: now,
      },
      {
        platform: 'tiktok',
        type: 'hashtag',
        name: '#japaneselearning',
        description: 'Anime-hook Japanese phrases; JLPT prep content performs well here.',
        engagement: { views: 980000000, posts: 1600000, growth: 'rising' },
        relevance: {
          languages: ['ja', 'en'],
          themes: ['language_learning', 'anime'],
          formatNotes: '15-30s; character clip → phrase overlay → English translation',
        },
        sourceUrl: 'https://www.tiktok.com/tag/japaneselearning',
        scrapedAt: now,
      },
      {
        platform: 'tiktok',
        type: 'format',
        name: 'POV dating sim',
        description: 'First-person dating sim scenarios filmed in public; cast as NPC responds to player choice.',
        engagement: { views: 340000000, posts: 85000, growth: 'rising' },
        relevance: {
          languages: ['en', 'ko', 'ja'],
          themes: ['dating_sim', 'anime', 'viral_format'],
          formatNotes: '30s max; split-screen choice UX cue in first 5s',
        },
        scrapedAt: now,
      },
      {
        platform: 'tiktok',
        type: 'hashtag',
        name: '#chineselearning',
        description: 'Mandarin phrases with pinyin overlay; simplified characters on screen.',
        engagement: { views: 620000000, posts: 910000, growth: 'rising' },
        relevance: {
          languages: ['zh', 'en'],
          themes: ['language_learning'],
          formatNotes: '15-20s; phrase → pinyin → tonal mark highlight',
        },
        sourceUrl: 'https://www.tiktok.com/tag/chineselearning',
        scrapedAt: now,
      },
      {
        platform: 'tiktok',
        type: 'aesthetic',
        name: 'Coquette Korean café',
        description: 'Pink/beige latte art + soft music; popular aesthetic for Seoul content.',
        engagement: { views: 180000000, posts: 220000, growth: 'stable' },
        relevance: {
          languages: ['ko', 'en'],
          themes: ['food', 'travel', 'kpop'],
          formatNotes: '9:16; overhead shot → close-up sip; 10-15s',
        },
        scrapedAt: now,
      },
      {
        platform: 'tiktok',
        type: 'format',
        name: 'NPC livestream replay',
        description: 'Clips of NPC livestreaming format edited into short-form; heavy engagement bait.',
        engagement: { views: 2100000000, posts: 4200000, growth: 'declining' },
        relevance: {
          languages: ['en', 'zh'],
          themes: ['viral_format'],
          formatNotes: '15-30s clip; reaction montage format',
        },
        scrapedAt: now,
      },
    ],
    instagram: [
      {
        platform: 'instagram',
        type: 'hashtag',
        name: '#koreanlearning',
        description: 'Static carousel posts teaching Korean; 6-10 slides each covering one grammar point.',
        engagement: { posts: 480000, growth: 'rising' },
        relevance: {
          languages: ['ko', 'en'],
          themes: ['language_learning', 'kpop'],
          formatNotes: 'Carousel 6-10 slides; first slide = hook phrase; last slide = CTA',
        },
        sourceUrl: 'https://www.instagram.com/explore/tags/koreanlearning/',
        scrapedAt: now,
      },
      {
        platform: 'instagram',
        type: 'sound',
        name: 'GODS — NewJeans',
        description: 'BG audio for aesthetic Reels; high save rate, low skip rate.',
        engagement: { posts: 92000, growth: 'rising' },
        relevance: {
          languages: ['ko'],
          themes: ['kpop', 'anime'],
          formatNotes: 'Use chorus (0:42); 15s cut performs best',
        },
        scrapedAt: now,
      },
      {
        platform: 'instagram',
        type: 'format',
        name: 'Get ready with me (GRWM) abroad',
        description: 'Getting ready in a foreign city; language phrases woven in naturally.',
        engagement: { posts: 1300000, growth: 'stable' },
        relevance: {
          languages: ['ko', 'ja', 'zh', 'en'],
          themes: ['travel', 'language_learning'],
          formatNotes: '30-60s Reel; mirror selfie hook; phrases on lower-third',
        },
        scrapedAt: now,
      },
      {
        platform: 'instagram',
        type: 'hashtag',
        name: '#animefood',
        description: 'Recreating food scenes from anime; strong overlap with Japanese and Korean food content.',
        engagement: { posts: 2100000, growth: 'stable' },
        relevance: {
          languages: ['ja', 'en'],
          themes: ['anime', 'food'],
          formatNotes: 'Before/after carousel; recipe in slide 2-4',
        },
        sourceUrl: 'https://www.instagram.com/explore/tags/animefood/',
        scrapedAt: now,
      },
      {
        platform: 'instagram',
        type: 'aesthetic',
        name: 'Dark academia Tokyo',
        description: 'Moody Tokyo street photography with overlaid kanji.',
        engagement: { posts: 340000, growth: 'rising' },
        relevance: {
          languages: ['ja'],
          themes: ['travel', 'anime'],
          formatNotes: '1:1 or 4:5 static; desaturated; serif font overlay',
        },
        scrapedAt: now,
      },
    ],
    xiaohongshu: [
      {
        platform: 'xiaohongshu',
        type: 'hashtag',
        name: '#日语学习',
        description: 'Japanese learning notes; handwritten-style card format dominates.',
        engagement: { posts: 1200000, growth: 'rising' },
        relevance: {
          languages: ['ja', 'zh'],
          themes: ['language_learning', 'anime'],
          formatNotes: 'Photo note format; 3-6 images; pastel colour palette; handwritten font',
        },
        sourceUrl: 'https://www.xiaohongshu.com/search_result?keyword=%E6%97%A5%E8%AF%AD%E5%AD%A6%E4%B9%A0',
        scrapedAt: now,
      },
      {
        platform: 'xiaohongshu',
        type: 'topic',
        name: '首尔攻略',
        description: 'Seoul travel guides; food + shopping + phrase tips bundled.',
        engagement: { posts: 3400000, growth: 'rising' },
        relevance: {
          languages: ['zh', 'ko'],
          themes: ['travel', 'food', 'language_learning'],
          formatNotes: 'Long photo carousel (8-12 images); map screenshot in first image',
        },
        sourceUrl: 'https://www.xiaohongshu.com/search_result?keyword=%E9%A6%96%E5%B0%94%E6%94%BB%E7%95%A5',
        scrapedAt: now,
      },
      {
        platform: 'xiaohongshu',
        type: 'aesthetic',
        name: '奶油风穿搭',
        description: 'Cream/beige minimalist fashion; popular with Tokyo + Seoul travel content.',
        engagement: { posts: 8200000, growth: 'stable' },
        relevance: {
          languages: ['zh'],
          themes: ['travel'],
          formatNotes: '1:1 OOTD; natural light; beige/white palette',
        },
        scrapedAt: now,
      },
      {
        platform: 'xiaohongshu',
        type: 'hashtag',
        name: '#韩语入门',
        description: 'Korean for beginners; pronunciation + basic greeting cards.',
        engagement: { posts: 560000, growth: 'rising' },
        relevance: {
          languages: ['ko', 'zh'],
          themes: ['language_learning', 'kpop'],
          formatNotes: 'Handwritten flashcard style; 4-6 slides; phonetics on every card',
        },
        sourceUrl: 'https://www.xiaohongshu.com/search_result?keyword=%E9%9F%A9%E8%AF%AD%E5%85%A5%E9%97%A8',
        scrapedAt: now,
      },
      {
        platform: 'xiaohongshu',
        type: 'format',
        name: '英语口语练习打卡',
        description: 'Daily speaking practice check-in; users post self-recorded 30s clips.',
        engagement: { posts: 2800000, growth: 'rising' },
        relevance: {
          languages: ['zh', 'en'],
          themes: ['language_learning'],
          formatNotes: '9:16 video selfie; progress counter overlay; 15-30s',
        },
        scrapedAt: now,
      },
    ],
  };

  return mocks[platform] || [];
}

// ── TikTok scraper ───────────────────────────────────────────────────

/**
 * Attempt to fetch TikTok trending data from public endpoints.
 *
 * Tries in order:
 *   1. TikTok official API (if TIKTOK_API_KEY set)
 *   2. TikTok Creative Center trending hashtags (public JSON endpoint)
 *   3. Falls back to mock data with a warning
 *
 * @param {{ limit?: number, language?: string, category?: string, __mock?: boolean }} options
 * @returns {Promise<{ trends: Trend[], warnings: string[], scrapedAt: string }>}
 */
async function scrapeTikTokTrendsRaw(options = {}) {
  const now = new Date().toISOString();
  const warnings = [];
  const limit = Math.min(options.limit || 20, 50);

  // ── Official API path ──────────────────────────────────────────────
  const apiKey = TIKTOK_API_KEY();
  if (apiKey) {
    try {
      const res = await rateLimitedFetch('tiktok', 'https://open.tiktokapis.com/v2/research/hashtag/trending/', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const json = await res.json();
        const items = (json.data?.hashtag_list || []).slice(0, limit);
        const trends = items.map((item) => {
          const rel = inferRelevance(item.hashtag_name, item.hashtag_name);
          return {
            platform: 'tiktok',
            type: 'hashtag',
            name: `#${item.hashtag_name}`,
            description: `Trending TikTok hashtag with ${(item.video_count || 0).toLocaleString()} videos.`,
            engagement: {
              views: item.view_count || undefined,
              posts: item.video_count || undefined,
              growth: 'rising',
            },
            relevance: {
              ...rel,
              formatNotes: '',
            },
            scrapedAt: now,
          };
        });
        return { trends, warnings, scrapedAt: now };
      }
      warnings.push(`TikTok API returned ${res.status}; falling back to scrape`);
    } catch (err) {
      warnings.push(`TikTok API error: ${err.message}; falling back to scrape`);
    }
  }

  // ── Creative Center public endpoint ───────────────────────────────
  try {
    // TikTok Creative Center exposes trending hashtag data as a public JSON API
    const ccUrl =
      'https://ads.tiktok.com/creative_radar_api/v1/popular_trend/hashtag/list?period=7&page=1&limit=20&country_code=US';
    const res = await rateLimitedFetch('tiktok', ccUrl, {
      headers: {
        Referer: 'https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en',
      },
    });

    if (res.ok) {
      const json = await res.json();
      const items = (json.data?.list || []).slice(0, limit);

      if (items.length > 0) {
        const trends = items.map((item) => {
          const name = item.hashtag_name || item.name || '';
          const postCount = item.publish_cnt || item.video_count || undefined;
          const viewCount = item.video_views || undefined;
          const rel = inferRelevance(name, name);
          return {
            platform: 'tiktok',
            type: 'hashtag',
            name: name.startsWith('#') ? name : `#${name}`,
            description: `Trending on TikTok Creative Center (7-day window).`,
            engagement: {
              views: viewCount,
              posts: postCount,
              growth: item.trend === 1 ? 'rising' : item.trend === -1 ? 'declining' : 'stable',
            },
            relevance: {
              ...rel,
              formatNotes: '',
            },
            sourceUrl: `https://www.tiktok.com/tag/${encodeURIComponent(name.replace(/^#/, ''))}`,
            scrapedAt: now,
          };
        });
        return { trends, warnings, scrapedAt: now };
      }
    } else {
      warnings.push(`TikTok Creative Center returned ${res.status}`);
    }
  } catch (err) {
    warnings.push(`TikTok Creative Center fetch error: ${err.message}`);
  }

  // ── Fallback to mock ───────────────────────────────────────────────
  warnings.push('TikTok: using mock trend data (live scrape unavailable)');
  return {
    trends: buildMockTrends('tiktok').slice(0, limit),
    warnings,
    scrapedAt: now,
  };
}

// ── Instagram scraper ────────────────────────────────────────────────

/**
 * Attempt to fetch Instagram trending/explore data.
 *
 * Tries in order:
 *   1. Instagram Graph API (if INSTAGRAM_API_KEY / access token set)
 *   2. Public explore page (very limited, mostly blocked)
 *   3. Falls back to mock data with a warning
 *
 * @param {{ limit?: number, language?: string, category?: string, __mock?: boolean }} options
 * @returns {Promise<{ trends: Trend[], warnings: string[], scrapedAt: string }>}
 */
async function scrapeInstagramTrendsRaw(options = {}) {
  const now = new Date().toISOString();
  const warnings = [];
  const limit = Math.min(options.limit || 20, 50);

  // ── Instagram Graph API ────────────────────────────────────────────
  const apiKey = INSTAGRAM_API_KEY();
  if (apiKey) {
    try {
      // Graph API doesn't expose "trending hashtags" directly;
      // we can query hashtag search + recent media count as a proxy
      const tagSearchUrl =
        `https://graph.facebook.com/v19.0/ig_hashtag_search` +
        `?user_id=me&q=languagelearning&access_token=${apiKey}`;
      const res = await rateLimitedFetch('instagram', tagSearchUrl);
      if (res.ok) {
        const json = await res.json();
        // Graph API returns hashtag IDs; we'd need follow-up calls for counts.
        // For now just acknowledge the API is live and return mock enriched with that signal.
        warnings.push('Instagram Graph API connected; full hashtag metrics require Business account');
      } else {
        warnings.push(`Instagram Graph API returned ${res.status}`);
      }
    } catch (err) {
      warnings.push(`Instagram Graph API error: ${err.message}`);
    }
  }

  // ── Public explore page scrape ────────────────────────────────────
  // Instagram's explore is heavily JS-rendered; fetch returns minimal data.
  // We attempt the embed endpoint which returns JSON metadata for hashtag pages.
  const testTags = [
    'koreanlearning',
    'japaneselearning',
    'learnmandarin',
    'kpop',
    'animefood',
    'studykorean',
    'nihongo',
  ];

  const scrapedTrends = [];
  for (const tag of testTags.slice(0, 4)) {
    try {
      const embedUrl = `https://www.instagram.com/explore/tags/${tag}/?__a=1&__d=dis`;
      const res = await rateLimitedFetch('instagram', embedUrl, {
        headers: { 'X-IG-App-ID': '936619743392459' },
      });

      if (res.ok && res.headers.get('content-type')?.includes('json')) {
        const json = await res.json();
        const tagData = json?.graphql?.hashtag || json?.data?.hashtag || {};
        const count = tagData.edge_hashtag_to_media?.count;
        const rel = inferRelevance(tag, tag);
        scrapedTrends.push({
          platform: 'instagram',
          type: 'hashtag',
          name: `#${tag}`,
          description: `Instagram hashtag${count ? ` with ~${count.toLocaleString()} posts` : ''}.`,
          engagement: {
            posts: count || undefined,
            growth: 'stable',
          },
          relevance: {
            ...rel,
            formatNotes: '',
          },
          sourceUrl: `https://www.instagram.com/explore/tags/${tag}/`,
          scrapedAt: now,
        });
      }
    } catch {
      // silently skip; try next tag
    }
  }

  if (scrapedTrends.length > 0) {
    return { trends: scrapedTrends.slice(0, limit), warnings, scrapedAt: now };
  }

  warnings.push('Instagram: using mock trend data (live scrape unavailable — IG blocks non-auth requests)');
  return {
    trends: buildMockTrends('instagram').slice(0, limit),
    warnings,
    scrapedAt: now,
  };
}

// ── Xiaohongshu (RED) scraper ────────────────────────────────────────

/**
 * Attempt to fetch Xiaohongshu trending topics.
 *
 * Tries in order:
 *   1. XHS API (if XHS_API_KEY set — unofficial/partner programmes)
 *   2. XHS public discover page (JSON embedded in page HTML)
 *   3. Falls back to mock data with a warning
 *
 * @param {{ limit?: number, language?: string, category?: string, __mock?: boolean }} options
 * @returns {Promise<{ trends: Trend[], warnings: string[], scrapedAt: string }>}
 */
async function scrapeXHSTrendsRaw(options = {}) {
  const now = new Date().toISOString();
  const warnings = [];
  const limit = Math.min(options.limit || 20, 50);

  // ── XHS partner API ───────────────────────────────────────────────
  const apiKey = XHS_API_KEY();
  if (apiKey) {
    try {
      const res = await rateLimitedFetch('xhs', 'https://api.xiaohongshu.com/api/sns/web/v1/hot_topics', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const json = await res.json();
        const items = (json.data?.topics || json.data || []).slice(0, limit);
        if (items.length > 0) {
          const trends = items.map((item) => {
            const name = item.title || item.name || '';
            const rel = inferRelevance(name, item.description || '');
            return {
              platform: 'xiaohongshu',
              type: item.type === 'hashtag' ? 'hashtag' : 'topic',
              name,
              description: item.description || `XHS trending topic.`,
              engagement: {
                posts: item.note_count || undefined,
                views: item.view_count || undefined,
                growth: 'stable',
              },
              relevance: {
                ...rel,
                formatNotes: '',
              },
              sourceUrl: item.url || undefined,
              scrapedAt: now,
            };
          });
          return { trends, warnings, scrapedAt: now };
        }
      } else {
        warnings.push(`XHS API returned ${res.status}`);
      }
    } catch (err) {
      warnings.push(`XHS API error: ${err.message}`);
    }
  }

  // ── XHS discover page scrape ──────────────────────────────────────
  // XHS discover page embeds trending data in __INITIAL_SSR_STATE__ or window.__pageData__
  try {
    const discoverUrl = 'https://www.xiaohongshu.com/explore';
    const res = await rateLimitedFetch('xhs', discoverUrl, {
      headers: {
        // XHS requires a somewhat realistic Accept header
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });

    if (res.ok) {
      const html = await res.text();

      // XHS embeds JSON state in a <script> tag
      const stateMatch = html.match(/__INITIAL_SSR_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/);
      if (stateMatch) {
        try {
          const state = JSON.parse(stateMatch[1]);
          const hotList =
            state?.exploreStore?.hotTopics ||
            state?.hotTopics ||
            state?.data?.hotTopicList ||
            [];

          if (hotList.length > 0) {
            const trends = hotList.slice(0, limit).map((item) => {
              const name = item.title || item.name || '';
              const rel = inferRelevance(name, item.desc || '');
              return {
                platform: 'xiaohongshu',
                type: 'topic',
                name,
                description: item.desc || `XHS trending topic: ${name}`,
                engagement: {
                  posts: item.noteCount || item.count || undefined,
                  growth: 'stable',
                },
                relevance: {
                  ...rel,
                  formatNotes: item.type || '',
                },
                scrapedAt: now,
              };
            });
            return { trends, warnings, scrapedAt: now };
          }
        } catch {
          warnings.push('XHS: failed to parse embedded state JSON');
        }
      } else {
        warnings.push('XHS: __INITIAL_SSR_STATE__ not found in page HTML');
      }
    } else {
      warnings.push(`XHS discover page returned ${res.status}`);
    }
  } catch (err) {
    warnings.push(`XHS scrape error: ${err.message}`);
  }

  warnings.push('Xiaohongshu: using mock trend data (live scrape unavailable)');
  return {
    trends: buildMockTrends('xiaohongshu').slice(0, limit),
    warnings,
    scrapedAt: now,
  };
}

// ── Filter helper ─────────────────────────────────────────────────────

/**
 * Apply limit / language / category filters to a trend list.
 *
 * @param {Trend[]} trends
 * @param {{ limit?: number, language?: string, category?: string }} options
 * @returns {Trend[]}
 */
function applyFilters(trends, options = {}) {
  let result = trends;

  if (options.language) {
    const lang = options.language.toLowerCase();
    result = result.filter((t) => t.relevance.languages.includes(lang));
  }

  if (options.category) {
    const cat = options.category.toLowerCase();
    result = result.filter((t) => t.relevance.themes.some((th) => th.includes(cat)));
  }

  if (options.limit) {
    result = result.slice(0, options.limit);
  }

  return result;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Scrape TikTok trending data with caching.
 *
 * @param {{ limit?: number, language?: string, category?: string, __mock?: boolean }} [options]
 * @returns {Promise<{ trends: Trend[], warnings: string[], scrapedAt: string }>}
 */
export async function scrapeTikTokTrends(options = {}) {
  const useMock = options.__mock || MOCK_MODE();
  const cacheKey = 'tiktok';

  if (useMock) {
    const trends = applyFilters(buildMockTrends('tiktok'), options);
    return { trends, warnings: ['mock mode'], scrapedAt: new Date().toISOString() };
  }

  const cached = getCached(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const result = await scrapeTikTokTrendsRaw(options);
  result.trends = applyFilters(result.trends, options);
  setCache(cacheKey, result);

  lastScrapeAt = result.scrapedAt;
  cachedTrendCount = trendCache.size > 0
    ? [...trendCache.values()].reduce((acc, e) => acc + (e.data.trends?.length || 0), 0)
    : result.trends.length;

  return result;
}

/**
 * Scrape Instagram trending/explore data with caching.
 *
 * @param {{ limit?: number, language?: string, category?: string, __mock?: boolean }} [options]
 * @returns {Promise<{ trends: Trend[], warnings: string[], scrapedAt: string }>}
 */
export async function scrapeInstagramTrends(options = {}) {
  const useMock = options.__mock || MOCK_MODE();
  const cacheKey = 'instagram';

  if (useMock) {
    const trends = applyFilters(buildMockTrends('instagram'), options);
    return { trends, warnings: ['mock mode'], scrapedAt: new Date().toISOString() };
  }

  const cached = getCached(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const result = await scrapeInstagramTrendsRaw(options);
  result.trends = applyFilters(result.trends, options);
  setCache(cacheKey, result);

  lastScrapeAt = result.scrapedAt;
  cachedTrendCount = [...trendCache.values()].reduce((acc, e) => acc + (e.data.trends?.length || 0), 0);

  return result;
}

/**
 * Scrape Xiaohongshu trending topics with caching.
 *
 * @param {{ limit?: number, language?: string, category?: string, __mock?: boolean }} [options]
 * @returns {Promise<{ trends: Trend[], warnings: string[], scrapedAt: string }>}
 */
export async function scrapeXHSTrends(options = {}) {
  const useMock = options.__mock || MOCK_MODE();
  const cacheKey = 'xhs';

  if (useMock) {
    const trends = applyFilters(buildMockTrends('xiaohongshu'), options);
    return { trends, warnings: ['mock mode'], scrapedAt: new Date().toISOString() };
  }

  const cached = getCached(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const result = await scrapeXHSTrendsRaw(options);
  result.trends = applyFilters(result.trends, options);
  setCache(cacheKey, result);

  lastScrapeAt = result.scrapedAt;
  cachedTrendCount = [...trendCache.values()].reduce((acc, e) => acc + (e.data.trends?.length || 0), 0);

  return result;
}

/**
 * Scrape all platforms concurrently and merge results.
 *
 * @param {{ platforms?: string[], limit?: number, language?: string, category?: string, __mock?: boolean }} [options]
 * @returns {Promise<{ trends: Trend[], platforms: string[], warnings: string[], scrapedAt: string }>}
 */
export async function scrapeAllTrends(options = {}) {
  const requestedPlatforms = Array.isArray(options.platforms) && options.platforms.length > 0
    ? options.platforms
    : ['tiktok', 'instagram', 'xiaohongshu'];

  const scrapers = {
    tiktok: scrapeTikTokTrends,
    instagram: scrapeInstagramTrends,
    xiaohongshu: scrapeXHSTrends,
  };

  const results = await Promise.allSettled(
    requestedPlatforms.map((p) => {
      const fn = scrapers[p];
      if (!fn) return Promise.resolve({ trends: [], warnings: [`Unknown platform: ${p}`] });
      return fn(options);
    }),
  );

  const allTrends = [];
  const allWarnings = [];
  const successfulPlatforms = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') {
      allTrends.push(...r.value.trends);
      allWarnings.push(...(r.value.warnings || []));
      successfulPlatforms.push(requestedPlatforms[i]);
    } else {
      allWarnings.push(`${requestedPlatforms[i]}: scrape failed — ${r.reason?.message || 'unknown error'}`);
    }
  }

  const scrapedAt = new Date().toISOString();
  lastScrapeAt = scrapedAt;
  cachedTrendCount = allTrends.length;

  return {
    trends: allTrends,
    platforms: successfulPlatforms,
    warnings: allWarnings,
    scrapedAt,
  };
}

/**
 * Return scraper health/status without triggering a scrape.
 *
 * @returns {{ available: boolean, lastScrape: string|null, trendCount: number, config: object }}
 */
export function getTrendStatus() {
  const executionMode = resolveSignalsExecutionMode();
  return {
    available: true,
    lastScrape: lastScrapeAt,
    trendCount: cachedTrendCount,
    cacheTtlMs: CACHE_TTL_MS,
    mockMode: MOCK_MODE(),
    executionMode,
    executionModes: SIGNAL_EXECUTION_MODES,
    keywordSets: keywordSets.size,
    dependencies: {
      live: buildSignalLiveDependencyHints(),
      preflight: ['none'],
      mock: ['none'],
    },
    config: {
      tiktokApiKeyConfigured: Boolean(TIKTOK_API_KEY()),
      instagramApiKeyConfigured: Boolean(INSTAGRAM_API_KEY()),
      xhsApiKeyConfigured: Boolean(XHS_API_KEY()),
    },
  };
}

// ── Keyword Set Management ──────────────────────────────────────────

/**
 * In-memory keyword set store.
 * Each set: { id, theme, description, keywords: { global, tiktok, instagram, xiaohongshu },
 *             priority, languages, expectedContentTypes, createdAt, source: 'ai'|'manual' }
 */
const keywordSets = new Map();

/**
 * Save a keyword set (from AI generation or manual input).
 */
export function saveKeywordSet(set) {
  const id = set.id || `kw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const entry = { ...set, id, createdAt: set.createdAt || new Date().toISOString() };
  keywordSets.set(id, entry);
  return entry;
}

/**
 * List all keyword sets.
 */
export function listKeywordSets() {
  return [...keywordSets.values()].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );
}

/**
 * Get a keyword set by ID.
 */
export function getKeywordSet(id) {
  return keywordSets.get(id) || null;
}

/**
 * Delete a keyword set.
 */
export function deleteKeywordSet(id) {
  return keywordSets.delete(id);
}

// ── Keyword-Targeted Search ─────────────────────────────────────────

/**
 * Search a specific platform for content matching keywords.
 * This is the targeted version of the generic trending scrapers.
 *
 * @param {object} args
 * @param {string} args.platform     – 'tiktok' | 'instagram' | 'xiaohongshu'
 * @param {string[]} args.keywords   – search terms / hashtags
 * @param {number} [args.limit]      – max results per keyword (default 5)
 * @returns {Promise<{ results: object[], warnings: string[] }>}
 */
export async function searchPlatform(args) {
  const { platform, keywords, limit = 5 } = args;
  const executionMode = resolveSignalsExecutionMode(args);
  if (!keywords?.length) return { results: [], warnings: ['no keywords provided'] };

  if (executionMode === 'preflight') {
    return {
      results: [],
      warnings: ['preflight mode — platform search skipped'],
      platform,
      keywordsSearched: keywords.length,
      execution: {
        mode: 'preflight',
        portable: true,
        liveScrapeRequired: true,
        dependencies: buildSignalLiveDependencyHints(),
      },
    };
  }

  if (executionMode === 'mock' || MOCK_MODE()) {
    const mockResult = mockSearch(platform, keywords, limit);
    return {
      ...mockResult,
      execution: {
        mode: 'mock',
        portable: true,
        liveScrapeRequired: false,
        dependencies: [],
      },
    };
  }

  const results = [];
  const warnings = [];

  for (const keyword of keywords.slice(0, 20)) { // cap at 20 keywords per call
    const cacheKey = `search:${platform}:${keyword}`;
    const cached = getCached(cacheKey);
    if (cached) { results.push(...cached); continue; }

    try {
      let items = [];
      if (platform === 'tiktok') {
        items = await searchTikTok(keyword, limit);
      } else if (platform === 'instagram') {
        items = await searchInstagram(keyword, limit);
      } else if (platform === 'xiaohongshu') {
        items = await searchXHS(keyword, limit);
      }
      setCache(cacheKey, items);
      results.push(...items);
    } catch (err) {
      warnings.push(`${platform}/${keyword}: ${err.message}`);
    }
  }

  return {
    results,
    warnings,
    platform,
    keywordsSearched: keywords.length,
    execution: {
      mode: 'live',
      portable: false,
      liveScrapeRequired: true,
      dependencies: buildSignalLiveDependencyHints(),
    },
  };
}

async function searchTikTok(keyword, limit) {
  const encoded = encodeURIComponent(keyword);
  // TikTok search via public web endpoint
  try {
    const res = await rateLimitedFetch('tiktok',
      `https://www.tiktok.com/api/search/general/full/?keyword=${encoded}&offset=0&search_id=&count=${limit}`,
      { headers: { 'User-Agent': UA, Accept: 'application/json' } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.data || []).map((item) => ({
      platform: 'tiktok',
      keyword,
      type: 'video',
      title: item.item?.desc || item.desc || '',
      author: item.item?.author?.uniqueId || item.author?.uniqueId || '',
      stats: {
        views: item.item?.stats?.playCount || 0,
        likes: item.item?.stats?.diggCount || 0,
        shares: item.item?.stats?.shareCount || 0,
      },
      videoUrl: item.item?.video?.playAddr || '',
      scrapedAt: new Date().toISOString(),
    }));
  } catch {
    return []; // graceful degradation
  }
}

async function searchInstagram(keyword, limit) {
  const encoded = encodeURIComponent(keyword.replace('#', ''));
  try {
    const res = await rateLimitedFetch('instagram',
      `https://www.instagram.com/explore/tags/${encoded}/?__a=1&__d=dis`,
      { headers: { 'User-Agent': UA, Accept: 'application/json' } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const edges = data?.graphql?.hashtag?.edge_hashtag_to_media?.edges || [];
    return edges.slice(0, limit).map((edge) => ({
      platform: 'instagram',
      keyword,
      type: 'post',
      shortcode: edge.node?.shortcode || '',
      caption: edge.node?.edge_media_to_caption?.edges?.[0]?.node?.text || '',
      stats: {
        likes: edge.node?.edge_liked_by?.count || 0,
        comments: edge.node?.edge_media_to_comment?.count || 0,
      },
      thumbnailUrl: edge.node?.thumbnail_src || '',
      scrapedAt: new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

async function searchXHS(keyword, limit) {
  const encoded = encodeURIComponent(keyword);
  try {
    const res = await rateLimitedFetch('xiaohongshu',
      `https://www.xiaohongshu.com/search_result?keyword=${encoded}&page=1&sort=general`,
      { headers: { 'User-Agent': UA, Accept: 'text/html' } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    // Extract __INITIAL_SSR_STATE__ JSON from page
    const match = html.match(/__INITIAL_SSR_STATE__\s*=\s*({.+?})\s*<\/script>/s);
    if (!match) return [];
    const state = JSON.parse(match[1]);
    const notes = state?.Main?.searchResult?.notes || [];
    return notes.slice(0, limit).map((note) => ({
      platform: 'xiaohongshu',
      keyword,
      type: 'note',
      title: note.title || '',
      author: note.user?.nickname || '',
      stats: {
        likes: note.likes || 0,
        collects: note.collects || 0,
      },
      coverUrl: note.cover?.url || '',
      scrapedAt: new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

/**
 * Mock search results for development.
 */
function mockSearch(platform, keywords, limit) {
  const results = keywords.flatMap((keyword) =>
    Array.from({ length: Math.min(limit, 3) }, (_, i) => ({
      platform,
      keyword,
      type: platform === 'xiaohongshu' ? 'note' : platform === 'instagram' ? 'post' : 'video',
      title: `[Mock] ${keyword} content #${i + 1} — trending ${platform} format`,
      author: `creator_${Math.random().toString(36).slice(2, 6)}`,
      stats: {
        views: Math.floor(Math.random() * 500000) + 10000,
        likes: Math.floor(Math.random() * 50000) + 1000,
      },
      scrapedAt: new Date().toISOString(),
    })),
  );
  return { results, warnings: ['mock mode — no real network calls'], platform, keywordsSearched: keywords.length };
}

/**
 * Run a full keyword-targeted scrape across all platforms using saved keyword sets.
 *
 * @param {object} [options]
 * @param {string[]} [options.keywordSetIds] – specific set IDs to use (default: all)
 * @param {string[]} [options.platforms]     – platforms to search (default: all)
 * @param {number} [options.limit]           – results per keyword per platform
 * @returns {Promise<object>}
 */
export async function runTargetedScrape(options = {}) {
  const executionMode = resolveSignalsExecutionMode(options);
  const sets = options.keywordSetIds
    ? options.keywordSetIds.map((id) => keywordSets.get(id)).filter(Boolean)
    : [...keywordSets.values()];

  if (sets.length === 0) {
    return {
      results: [],
      warnings: ['no keyword sets configured — generate or add keywords first'],
      keywordSets: 0,
      execution: {
        mode: executionMode,
        portable: executionMode !== 'live',
        liveScrapeRequired: executionMode === 'live',
        dependencies: executionMode === 'live' ? buildSignalLiveDependencyHints() : [],
      },
    };
  }

  const platforms = options.platforms || ['tiktok', 'instagram', 'xiaohongshu'];
  const limit = options.limit || 5;
  const allResults = [];
  const allWarnings = [];

  for (const set of sets) {
    for (const platform of platforms) {
      const keywords = [
        ...(set.keywords?.global || []),
        ...(set.keywords?.[platform] || []),
      ];
      if (keywords.length === 0) continue;

      const { results, warnings } = await searchPlatform({
        platform,
        keywords,
        limit,
        executionMode,
      });
      // Tag results with the keyword set for traceability
      for (const r of results) r.keywordSetId = set.id;
      allResults.push(...results);
      allWarnings.push(...(warnings || []));
    }
  }

  lastScrapeAt = new Date().toISOString();
  cachedTrendCount = allResults.length;

  return {
    results: allResults,
    keywordSets: sets.length,
    platforms,
    warnings: allWarnings,
    scrapedAt: lastScrapeAt,
    execution: {
      mode: executionMode,
      portable: executionMode !== 'live',
      liveScrapeRequired: executionMode === 'live',
      dependencies: executionMode === 'live' ? buildSignalLiveDependencyHints() : [],
    },
  };
}
