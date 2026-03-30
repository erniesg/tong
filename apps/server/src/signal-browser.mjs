/**
 * Browser-based signal scraper using Puppeteer.
 *
 * This is the real data path — launches headless Chrome to scrape TikTok and
 * Instagram like a real user, bypassing API auth requirements.
 *
 * Tested working (2026-04-02):
 *   - TikTok keyword search:  full video cards with views, hashtags, authors
 *   - TikTok Creative Center: top 3 trending hashtags (no login)
 *   - Instagram hashtag page: reel counts, top post captions + view counts
 *
 * Not working without login:
 *   - XHS (login wall)
 *   - Instagram Reels topics (login required)
 */

import puppeteer from 'puppeteer';

// ── Shared browser instance ─────────────────────────────────────────

let browserInstance = null;
let browserLaunchPromise = null;

async function getBrowser() {
  if (browserInstance?.connected) return browserInstance;
  if (browserLaunchPromise) return browserLaunchPromise;

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
      // TikTok search renders video cards with descriptions
      const items = [];
      // Try multiple selector patterns (TikTok changes class names)
      const cards = document.querySelectorAll(
        '[data-e2e="search_top-item"], [class*="DivItemContainer"], [class*="search-card"]',
      );

      if (cards.length === 0) {
        // Fallback: parse the full page text
        const text = document.body.innerText;
        const blocks = text.split(/\n{2,}/).filter((b) => b.length > 20);
        for (const block of blocks.slice(0, maxItems)) {
          const viewMatch = block.match(/(\d+(?:\.\d+)?[KMB]?)\s*$/m);
          const hashtagMatches = block.match(/#[\w\u4e00-\u9fff\uac00-\ud7af]+/g) || [];
          if (viewMatch || hashtagMatches.length > 0) {
            items.push({
              type: 'video',
              title: block.split('\n')[0]?.slice(0, 200) || '',
              author: '',
              stats: { views: viewMatch?.[1] || null },
              hashtags: hashtagMatches,
            });
          }
        }
        return items;
      }

      for (const card of Array.from(cards).slice(0, maxItems)) {
        const desc = card.querySelector('[class*="SpanText"], [class*="desc"], [data-e2e*="desc"]')?.textContent || '';
        const author = card.querySelector('[class*="author"], [data-e2e*="author"], a[href*="/@"]')?.textContent || '';
        const viewEl = card.querySelector('[class*="count"], [class*="views"], [class*="play"]');
        const views = viewEl?.textContent || '';
        const hashtags = desc.match(/#[\w\u4e00-\u9fff\uac00-\ud7af]+/g) || [];

        items.push({
          type: 'video',
          title: desc.slice(0, 300),
          author: author.replace(/^@/, ''),
          stats: { views },
          hashtags,
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

      // Extract individual posts — pattern: author\nviewCount\ncaption
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
          let caption = lines[i + 1] || '';
          const hashtags = caption.match(/#[\w\u4e00-\u9fff\uac00-\ud7af]+/g) || [];
          posts.push({
            author,
            stats: { views: viewMatch[1] },
            caption: caption.slice(0, 300),
            hashtags,
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
        type: 'reel',
        ...p,
        scrapedAt: now,
      })),
    };
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
  const platforms = options.platforms || ['tiktok', 'instagram'];
  const limit = options.limit || 10;
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
        warnings.push('XHS requires authenticated session — skipped');
      }
    } catch (err) {
      warnings.push(`${platform}: ${err.message}`);
    }
  }

  return { results, warnings, keyword, scrapedAt: new Date().toISOString() };
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
  return {
    browserConnected: browserInstance?.connected || false,
    supportedPlatforms: ['tiktok', 'instagram'],
    unsupported: ['xiaohongshu (login required)'],
  };
}
