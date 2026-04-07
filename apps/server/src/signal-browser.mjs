/**
 * Browser-based signal scraper using Puppeteer.
 *
 * This is the real data path — launches headless Chrome to scrape TikTok,
 * Instagram, and XHS like a real user, bypassing API auth requirements.
 *
 * Tested working (2026-04-07):
 *   - TikTok keyword search:  full video cards with views, hashtags, authors
 *   - TikTok Creative Center: top 3 trending hashtags (no login)
 *   - Instagram hashtag page: reel counts, top post captions + view counts (via /popular/ URL)
 *   - XHS keyword search:     note cards with titles, authors, likes (search_result page)
 *
 * Known limitations:
 *   - Instagram Reels topics (login required)
 *   - XHS search may return fewer results without login
 */

// ── Shared browser instance ─────────────────────────────────────────

let browserInstance = null;
let browserLaunchPromise = null;
let puppeteerModulePromise = null;

const BROWSER_EXECUTION_MODES = ['live', 'mock', 'preflight'];

function resolveExecutionMode(options = {}) {
  const requested = String(
    options.executionMode ||
    options.mode ||
    process.env.SIGNALS_BROWSER_MODE ||
    process.env.SIGNALS_EXECUTION_MODE ||
    'live',
  ).toLowerCase();

  if (BROWSER_EXECUTION_MODES.includes(requested)) return requested;
  return 'live';
}

function buildLiveDependencyHints() {
  return [
    'puppeteer package',
    'headless chrome launch support (--no-sandbox)',
    'outbound network access to tiktok.com, instagram.com, and xiaohongshu.com',
  ];
}

async function loadPuppeteer() {
  if (!puppeteerModulePromise) {
    puppeteerModulePromise = import('puppeteer')
      .then((mod) => mod.default || mod)
      .catch((err) => {
        puppeteerModulePromise = null;
        throw err;
      });
  }
  return puppeteerModulePromise;
}

async function getBrowser() {
  if (browserInstance?.connected) return browserInstance;
  if (browserLaunchPromise) return browserLaunchPromise;

  const puppeteer = await loadPuppeteer();
  browserLaunchPromise = puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  browserInstance = await browserLaunchPromise;
  browserLaunchPromise = null;

  browserInstance.on('disconnected', () => { browserInstance = null; });
  return browserInstance;
}

async function newPage() {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  );
  await page.setViewport({ width: 1280, height: 800 });
  return page;
}

// ── TikTok Keyword Search ───────────────────────────────────────────

/**
 * Search TikTok for videos matching a keyword.
 *
 * @param {string} keyword – search term (e.g. "learn korean", "#learnkorean")
 * @param {number} [limit=10] – max results
 * @returns {Promise<Array<{ platform, keyword, type, title, author, stats, hashtags, date, scrapedAt }>>}
 */
export async function tiktokSearch(keyword, limit = 10) {
  const page = await newPage();
  try {
    const encoded = encodeURIComponent(keyword);
    await page.goto(`https://www.tiktok.com/search?q=${encoded}`, {
      waitUntil: 'networkidle2',
      timeout: 25000,
    });
    await new Promise((r) => setTimeout(r, 3000));

    const results = await page.evaluate((maxItems) => {
      const items = [];
      const seen = new Set();

      // Strategy: find all unique video links on the page, then extract metadata per link
      const videoAnchors = Array.from(document.querySelectorAll('a[href*="/video/"]'));
      const uniqueLinks = [];
      for (const a of videoAnchors) {
        const href = a.href.split('?')[0]; // strip query params
        if (!seen.has(href)) {
          seen.add(href);
          uniqueLinks.push({ href, el: a });
        }
      }

      for (const { href, el } of uniqueLinks.slice(0, maxItems)) {
        // Walk up to find the containing card
        let card = el;
        for (let i = 0; i < 8 && card.parentElement; i++) {
          card = card.parentElement;
          // Stop at a likely card boundary
          if (card.getAttribute('data-e2e') || card.className?.includes('Item') || card.className?.includes('card')) break;
        }

        // Extract text from the card area
        const cardText = card.innerText || '';
        const lines = cardText.split('\n').map((l) => l.trim()).filter(Boolean);

        // Find description: longest line with hashtags or > 20 chars
        const descLine = lines.find((l) => l.includes('#') && l.length > 10)
          || lines.find((l) => l.length > 20)
          || '';

        // Find author: look for @username pattern or username from URL
        const urlMatch = href.match(/@([^/]+)/);
        const authorFromUrl = urlMatch?.[1] || '';
        const authorLine = lines.find((l) => l.startsWith('@'));
        const author = authorLine?.replace(/^@/, '') || authorFromUrl;

        // Find view count: look for patterns like "1.7M", "42.2K", "618"
        const viewPatterns = lines.map((l) => {
          const m = l.match(/^(\d+(?:\.\d+)?)\s*([KMB]?)$/i);
          return m ? l : null;
        }).filter(Boolean);
        const views = viewPatterns[0] || '';

        // Hashtags from description
        const hashtags = descLine.match(/#[\w\u4e00-\u9fff\uac00-\ud7af]+/g) || [];

        // Clean title: remove author suffix patterns like "username2024-11-27"
        let title = descLine.replace(/#[\w\u4e00-\u9fff\uac00-\ud7af]+/g, '').trim();
        title = title.replace(/\s+[\w.]+\d{4}-\d{1,2}-\d{1,2}$/, '').trim();

        // Thumbnail: find img inside or near the card
        const img = card.querySelector('img[src*="tiktok"], img[src*="tos-"], img')
          || el.querySelector('img');
        const thumbnailUrl = img?.src || '';

        items.push({
          type: 'video',
          title: title.slice(0, 300) || `Video by @${author}`,
          author,
          stats: { views },
          hashtags,
          videoPageUrl: href,
          thumbnailUrl,
        });
      }

      return items;
    }, limit);

    const now = new Date().toISOString();
    return results.map((r) => ({
      platform: 'tiktok',
      keyword,
      ...r,
      scrapedAt: now,
    }));
  } finally {
    await page.close();
  }
}

// ── TikTok Creative Center Trending ─────────────────────────────────

/**
 * Scrape top trending hashtags from TikTok Creative Center.
 * Returns up to ~3 without login (what the page renders publicly).
 *
 * @returns {Promise<Array<{ platform, type, name, rank, scrapedAt }>>}
 */
export async function tiktokTrending() {
  const page = await newPage();
  try {
    await page.goto(
      'https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en',
      { waitUntil: 'networkidle2', timeout: 25000 },
    );
    await new Promise((r) => setTimeout(r, 5000));

    const data = await page.evaluate(() => {
      const text = document.body.innerText;
      // Extract ranked hashtags from the rendered page
      // Format: "1\n# hashtagname\n2\n# another\n..."
      const matches = [...text.matchAll(/(\d+)\s*\n\s*#\s*(\w+)/g)];
      return matches.map((m) => ({
        rank: parseInt(m[1], 10),
        name: `#${m[2]}`,
      }));
    });

    const now = new Date().toISOString();
    return data.map((d) => ({
      platform: 'tiktok',
      type: 'trending_hashtag',
      ...d,
      scrapedAt: now,
    }));
  } finally {
    await page.close();
  }
}

// ── Instagram Hashtag Search ────────────────────────────────────────

/**
 * Scrape Instagram hashtag page for top posts.
 *
 * @param {string} hashtag – hashtag without # (e.g. "learnkorean")
 * @param {number} [limit=10]
 * @returns {Promise<Array<{ platform, keyword, type, author, caption, stats, scrapedAt }>>}
 */
export async function instagramHashtag(hashtag, limit = 10) {
  const tag = hashtag.replace(/^#/, '');
  const page = await newPage();
  try {
    // Use /popular/ URL — this is where /explore/tags/ redirects and it renders without login
    await page.goto(`https://www.instagram.com/popular/${tag}/`, {
      waitUntil: 'networkidle2',
      timeout: 25000,
    });
    await new Promise((r) => setTimeout(r, 4000));

    const data = await page.evaluate((maxItems) => {
      const text = document.body.innerText;

      // Extract the reel count (e.g. "3.1M reels about X" or "Watch 3.1M reels")
      const reelCountMatch = text.match(/([\d.]+[KMB]?)\s*reels?\s+about/i);
      const reelCount = reelCountMatch?.[1] || null;

      // Extract post links — find <a> tags pointing to /p/ or /reel/ paths
      const postAnchors = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'));
      const seen = new Set();
      const postLinks = [];
      for (const a of postAnchors) {
        const href = a.href.split('?')[0];
        if (!seen.has(href)) {
          seen.add(href);
          // Try to get thumbnail from nearest img
          let el = a;
          let img = null;
          for (let i = 0; i < 5 && el; i++) {
            img = el.querySelector('img');
            if (img) break;
            el = el.parentElement;
          }
          const thumbnailUrl = img?.src || '';
          postLinks.push({ href, thumbnailUrl });
        }
      }

      // Extract individual posts via text pattern — author\nviewCount\ncaption
      const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
      const posts = [];

      for (let i = 0; i < lines.length && posts.length < maxItems; i++) {
        // View counts appear as standalone lines like "1.7M", "167K", "5.9M"
        const viewMatch = lines[i].match(/^([\d.]+[KMB])$/);
        if (viewMatch && i > 0 && i + 1 < lines.length) {
          const author = lines[i - 1].replace(/\.{3}$/, '');
          // Skip obvious non-author lines
          if (author.length > 30 || /^(Log|Sign|Watch|View)/.test(author)) { continue; }

          // Caption is everything on the next line(s) until the next view count or author
          const caption = lines[i + 1] || '';
          const hashtags = caption.match(/#[\w\u4e00-\u9fff\uac00-\ud7af]+/g) || [];

          // Match post link by index (posts appear in DOM order matching text order)
          const linkData = postLinks[posts.length] || {};

          // Determine type: /reel/ links are video reels, /p/ may be image or video
          const isReel = (linkData.href || '').includes('/reel/');

          posts.push({
            author,
            stats: { views: viewMatch[1] },
            caption: caption.slice(0, 300),
            hashtags,
            videoPageUrl: linkData.href || '',
            thumbnailUrl: linkData.thumbnailUrl || '',
            type: isReel ? 'reel' : 'post',
          });
        }
      }

      // If text-based extraction found nothing but we have post links, fall back to link-only
      if (posts.length === 0 && postLinks.length > 0) {
        for (const linkData of postLinks.slice(0, maxItems)) {
          const isReel = linkData.href.includes('/reel/');
          posts.push({
            author: '',
            stats: { views: '' },
            caption: '',
            hashtags: [],
            videoPageUrl: linkData.href,
            thumbnailUrl: linkData.thumbnailUrl,
            type: isReel ? 'reel' : 'post',
          });
        }
      }

      return { reelCount, posts };
    }, limit);

    const now = new Date().toISOString();
    return {
      hashtag: tag,
      reelCount: data.reelCount,
      posts: data.posts.map((p) => ({
        platform: 'instagram',
        keyword: `#${tag}`,
        ...p,
        scrapedAt: now,
      })),
    };
  } finally {
    await page.close();
  }
}

// ── Xiaohongshu (XHS) Search ────────────────────────────────────────

/**
 * Search Xiaohongshu for notes matching a keyword via Puppeteer.
 *
 * XHS search results are loaded client-side (not in SSR state), so Puppeteer
 * waits for the feed items to render. Falls back to explore page trending
 * content if the search page blocks or returns empty.
 *
 * @param {string} keyword – search term (e.g. "学韩语", "learnkorean")
 * @param {number} [limit=10] – max results
 * @returns {Promise<Array<{ platform, keyword, type, title, author, stats, coverUrl, videoPageUrl, scrapedAt }>>}
 */
export async function xiaohongshuSearch(keyword, limit = 10) {
  const page = await newPage();
  try {
    // Set Chinese language headers for XHS
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    });

    const encoded = encodeURIComponent(keyword);

    // Try search page first
    await page.goto(`https://www.xiaohongshu.com/search_result?keyword=${encoded}&source=web_search_result_notes`, {
      waitUntil: 'networkidle2',
      timeout: 25000,
    });
    await new Promise((r) => setTimeout(r, 3000));

    // Check if search requires login (XHS shows "登录后查看搜索结果" text)
    const needsLogin = await page.evaluate(() =>
      document.body.innerText.includes('登录') && document.querySelectorAll('a[href*="/explore/"]').length === 0,
    );

    if (needsLogin) {
      // Fall back to the explore (discover) page which renders without login
      await page.goto('https://www.xiaohongshu.com/explore', {
        waitUntil: 'networkidle2',
        timeout: 25000,
      });
      await new Promise((r) => setTimeout(r, 3000));
    }

    const results = await page.evaluate((maxItems) => {
      const items = [];
      const seen = new Set();

      // Strategy: find all note links on the page
      const noteAnchors = Array.from(document.querySelectorAll('a[href*="/explore/"], a[href*="/discovery/item/"]'));
      const uniqueLinks = [];
      for (const a of noteAnchors) {
        const href = a.href.split('?')[0];
        if (!seen.has(href) && /\/explore\/[a-f0-9]+|\/discovery\/item\/[a-f0-9]+/.test(href)) {
          seen.add(href);
          uniqueLinks.push({ href, el: a });
        }
      }

      for (const { href, el } of uniqueLinks.slice(0, maxItems)) {
        // Walk up to the containing card
        let card = el;
        for (let i = 0; i < 6 && card.parentElement; i++) {
          card = card.parentElement;
          if (card.className?.includes('note') || card.tagName === 'SECTION') break;
        }

        const cardText = card.innerText || '';
        const lines = cardText.split('\n').map((l) => l.trim()).filter(Boolean);

        // Title: first meaningful line
        const title = lines.find((l) => l.length > 2 && !l.match(/^\d+$/)) || '';

        // Author: look for username patterns
        const author = lines.find((l) => l.length < 30 && l.length > 1 && !l.match(/^\d/) && l !== title) || '';

        // Like count: patterns like "1.7万", "999", "5.2w"
        const likeMatch = cardText.match(/([\d.]+)\s*([万wWkKmM]?)/);
        const likes = likeMatch ? likeMatch[0] : '';

        // Cover image
        const img = card.querySelector('img');
        const coverUrl = img?.src || '';

        items.push({
          type: 'note',
          title: title.slice(0, 300),
          author,
          stats: { likes },
          coverUrl,
          videoPageUrl: href,
        });
      }

      return items;
    }, limit);

    const now = new Date().toISOString();
    return results.map((r) => ({
      platform: 'xiaohongshu',
      keyword,
      ...r,
      scrapedAt: now,
    }));
  } finally {
    await page.close();
  }
}

// ── Unified Search ──────────────────────────────────────────────────

/**
 * Search across all working platforms for a keyword.
 *
 * @param {string} keyword
 * @param {object} [options]
 * @param {string[]} [options.platforms] – default: ['tiktok', 'instagram']
 * @param {number} [options.limit]
 * @returns {Promise<{ results: object[], warnings: string[] }>}
 */
export async function browserSearch(keyword, options = {}) {
  const executionMode = resolveExecutionMode(options);
  const normalizedPlatforms = options.platforms || ['tiktok', 'instagram', 'xiaohongshu'];
  const limit = options.limit || 10;

  if (executionMode === 'preflight') {
    return {
      results: [],
      warnings: ['preflight mode — live browser scraping skipped'],
      keyword,
      scrapedAt: new Date().toISOString(),
      execution: {
        mode: 'preflight',
        portable: true,
        liveScrapeRequired: true,
        dependencies: buildLiveDependencyHints(),
        requestedPlatforms: normalizedPlatforms,
      },
    };
  }

  if (executionMode === 'mock') {
    const now = new Date().toISOString();
    const results = normalizedPlatforms.flatMap((platform) =>
      Array.from({ length: Math.min(limit, 2) }, (_, index) => ({
        platform,
        keyword,
        type: platform === 'instagram' ? 'reel' : platform === 'xiaohongshu' ? 'note' : 'video',
        title: `[Mock] ${keyword} ${platform} item ${index + 1}`,
        author: `mock_${platform}_${index + 1}`,
        stats: {
          views: (index + 1) * 1000,
          likes: (index + 1) * 200,
        },
        hashtags: [`#${String(keyword).replace(/\s+/g, '')}`],
        scrapedAt: now,
      })),
    );
    return {
      results,
      warnings: ['mock mode — no live browser session launched'],
      keyword,
      scrapedAt: now,
      execution: {
        mode: 'mock',
        portable: true,
        liveScrapeRequired: false,
        dependencies: [],
        requestedPlatforms: normalizedPlatforms,
      },
    };
  }

  const platforms = normalizedPlatforms;
  const results = [];
  const warnings = [];

  for (const platform of platforms) {
    try {
      if (platform === 'tiktok') {
        const items = await tiktokSearch(keyword, limit);
        results.push(...items);
      } else if (platform === 'instagram') {
        const tag = keyword.replace(/^#/, '').replace(/\s+/g, '');
        const data = await instagramHashtag(tag, limit);
        results.push(...(data.posts || []));
      } else if (platform === 'xiaohongshu') {
        const items = await xiaohongshuSearch(keyword, limit);
        results.push(...items);
        if (items.length === 0) {
          warnings.push('XHS: 0 results — search requires login; explore page may also have been empty');
        }
      }
    } catch (err) {
      warnings.push(`${platform}: ${err.message}`);
    }
  }

  return {
    results,
    warnings,
    keyword,
    scrapedAt: new Date().toISOString(),
    execution: {
      mode: 'live',
      portable: false,
      liveScrapeRequired: true,
      dependencies: buildLiveDependencyHints(),
      requestedPlatforms: platforms,
    },
  };
}

// ── Cleanup ─────────────────────────────────────────────────────────

/**
 * Close the shared browser instance.
 */
export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Check browser scraper status.
 */
export function getBrowserScraperStatus() {
  const mode = resolveExecutionMode();
  return {
    mode,
    browserConnected: browserInstance?.connected || false,
    executionModes: BROWSER_EXECUTION_MODES,
    supportedPlatforms: ['tiktok', 'instagram', 'xiaohongshu'],
    unsupported: [],
    dependencies: {
      live: buildLiveDependencyHints(),
      preflight: ['none'],
      mock: ['none'],
    },
  };
}
