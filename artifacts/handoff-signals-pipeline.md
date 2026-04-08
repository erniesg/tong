# Handoff: Video Signals Pipeline — Continue from April 8, 2026

## Epic
erniesg/tong#176 — Video Signals Pipeline: multimodal keyword gen → search → filter → download → scene analysis

## What's already built (all on main, deployed)

### Server modules (`apps/server/src/`)
- `signal-filter.mjs` — brief extraction (Gemini 3.1), engagement filter (parseViewCount), relevance scoring (Gemini on thumbnails+metadata), runFilterPipeline orchestrator
- `signal-scheduler.mjs` — generateKeywordsFromBrief() with OpenAI structured output (`json_schema`, not `json_object`)
- `signal-browser.mjs` — Puppeteer scraper: tiktokSearch (deduped, URLs+thumbnails), instagramHashtag (reels, URLs+thumbnails), xiaohongshuSearch (broken — falls back to explore feed, not keyword search)
- `video-download.mjs` — yt-dlp wrapper: downloadVideo, downloadBatch, extractThumbnail, extractThumbnailBatch (cached JPGs with video ID filenames)
- `gemini-video.mjs` — scene_decomposition preset (tested: 10 scenes from 1 video, 75% automatability). Models: flash=gemini-3.1-flash-lite-preview, pro=gemini-3.1-pro-preview. IMPORTANT: analyzeVideo uses `args.mimeType` for file_data (was hardcoded video/webm, now fixed)

### Routes (`index.mjs`)
- `POST /api/v1/signals/extract-brief`
- `POST /api/v1/signals/generate-keywords`
- `POST /api/v1/signals/filter`
- `POST /api/v1/signals/extract-thumbnails`
- `POST /api/v1/signals/analyze-video` (yt-dlp download → Gemini upload → scene decomposition)
- `POST /api/v1/signals/download`
- `GET /api/v1/signals/download-status`
- `GET /thumbnails/<file>.jpg` (static serving, 24h cache)

### CLI (`scripts/signals-pipeline.mjs`)
Commands: `keywords`, `search`, `filter`, `fingerprint`, `run` (full pipeline)

### Backstage UI (`apps/client/app/backstage/signals/page.tsx`)
5-step pipeline: Brief → Keywords → Search → Filter → Score & Rank. Thumbnail gallery with cached JPGs. Load Cached Run button.

### Cached run (`apps/client/public/signals-cache/` + `apps/client/public/thumbnails/`)
- 01-keywords.json: 7 keyword sets, 152 terms (TT English, XHS Chinese)
- 02-search-with-urls.json: 40 TikTok results with videoPageUrl + thumbnailUrl
- 03-filtered.json: 20 ranked results with real Gemini relevance scores + thumbnailCached paths
- 20 cached thumbnail JPGs (video ID filenames, won't expire)

## What to build next (parallel tracks)

### Track 1: Apify integration (XHS + IG)
**Goal:** Configurable scraper per platform — Puppeteer for TikTok, Apify for XHS keyword search + IG posts/carousels.

**Secret needed:** `APIFY_API_TOKEN` in `.env` (user has it)

**XHS via Apify:**
- Actor: `datapilot/rednote-xiaohongshu-search-scraper` (or similar)
- Call: `POST https://api.apify.com/v2/acts/{actorId}/runs?token={TOKEN}` with `{"keyword": "学韩语", "maxResults": 50}`
- Returns: note_id, title, description, author, likes, cover_image_url, video_url, note_url
- Free tier: $5/month credit, ~1000-2000 results

**IG via Apify:**
- Actor: `apify/instagram-hashtag-scraper` — returns ALL types (posts, carousels, reels)
- Carousels include all sidecar children (each image/video URL)
- Same free $5 credit pool

**Architecture:**
- New file: `apps/server/src/signal-apify.mjs` — Apify client wrapper
- Platform config: `{ tiktok: 'puppeteer', instagram: 'apify', xiaohongshu: 'apify' }` (selectable)
- Wire into existing browserSearch/searchPlatform so the pipeline doesn't care which backend is used

### Track 2: Batch fingerprinting + clustering prep
**Goal:** Run scene_decomposition on the 20 ranked videos, store fingerprints, prepare for HDBSCAN.

- Use `signals-pipeline.mjs fingerprint --results-from ./03-filtered.json --top 5` to test
- Each fingerprint: hookTechnique, contentFormat, automatabilityScore, scenes[] with timestamps/types/audio/automationDifficulty
- Store as `04-fingerprints.json` in cached run
- Add fingerprint inspection to backstage UI (expandable scene timeline per video)

### Track 3: Clustering (M3)
- HDBSCAN on scene-level features (not video-level)
- Each scene is a data point: type, audio, automationDifficulty
- Discover natural component categories
- Label clusters → reusable component library

## Key patterns/conventions
- Gemini model: always use `gemini-3.1-flash-lite-preview` (not 2.5-flash, not 3-flash-preview)
- OpenAI: always use `response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } }` (not json_object)
- Test live before claiming things work — especially scrapers
- Backstage UI: show input→output at every pipeline step, never mock data in cached runs
- Plain CSS (globals.css classes), no Tailwind

## Env vars needed
```
GOOGLE_GEMINI_API_KEY=...   # Gemini 3.1 for brief extraction, relevance scoring, scene analysis
OPENAI_API_KEY=...          # Keyword generation
APIFY_API_TOKEN=...         # XHS + IG scraping (NEW — user has it)
```

## Quick start
```bash
# Dev server
PORT=8798 node apps/server/src/index.mjs

# Test pipeline
node scripts/signals-pipeline.mjs run --text "Tong" --repo-context --min-views 2000 --top 20

# Test scene fingerprinting
curl -X POST localhost:8798/api/v1/signals/analyze-video \
  -H 'content-type: application/json' \
  -d '{"url":"https://www.tiktok.com/@gracesooda/video/7342872001104645394","preset":"scene_decomposition"}'

# Deploy
cd apps/client && npx opennextjs-cloudflare build && npx wrangler deploy --keep-vars --domain tong.berlayar.ai
```
