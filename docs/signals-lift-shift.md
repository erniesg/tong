# Signals — Lift & Shift to Aether

Snapshot of tong's signals pipeline so we can plan the move into `aether/`. Goal: signals becomes aether's ingestion layer (`source → compose → export`), with tong as a downstream consumer via aether's API.

---

## Pipeline stages (today, in tong)

Numbered to match the cached JSON at `apps/client/public/signals-cache/0N-*.json` and the UI at `apps/client/app/backstage/signals/page.tsx`.

| # | Stage | Purpose | Output cache |
|---|-------|---------|--------------|
| 0 | **Brief** | Multimodal product brief (text + images → structured brief) | — |
| 1 | **Keywords** | LLM generates themed keyword clusters per platform | `01-keywords.json` |
| 2 | **Search** | Scrape TikTok / IG / XHS for each keyword | `02-search-with-urls.json` |
| 3 | **Filter** | Engagement threshold + LLM relevance scoring against brief | `03-filtered.json` |
| 4 | **Fingerprint** | Scene-decompose top videos via Gemini (scenes, hook, format, automatability) | `04-fingerprints.json` |
| 5 | **Download** | `yt-dlp` the top videos locally, extract keyframes + audio | `artifacts/videos/*.mp4`, `artifacts/scenes/{video_id}/` |
| 6 | **Scene cluster** | Python ML pipeline: CLIP + VideoMAE + text + audio embeddings → HDBSCAN + UMAP | `05-scene-clusters.json`, `05-scene-sources.json`, `06-video-transcripts.json` |

The numbering in the cache files is a bit off-by-one from the stages above (download happens before fingerprint in practice — the UI step order is brief → keywords → search → filter → download → fingerprint → scene clusters).

---

## Code surface

### Backend (`apps/server/`, plain Node.js, `node:http`, port 8787)

All modules are `.mjs`, no build step.

| File | Lines | Role |
|---|---|---|
| `src/signals.mjs` | 1,353 | Orchestration + cache + platform routing (TikTok/IG/XHS), keyword set storage, targeted scrape, brief extraction glue |
| `src/signal-browser.mjs` | 587 | Puppeteer scraper — TikTok keyword search, Creative Center trends, IG `/popular/`, XHS search |
| `src/signal-apify.mjs` | 311 | Apify fallback for IG hashtag scraper (XHS actor unreliable) |
| `src/signal-xhs.mjs` | 183 | XHS multi-provider (RapidAPI → Puppeteer fallthrough) |
| `src/signal-filter.mjs` | 449 | Two-pass filter: engagement threshold (free) then Gemini Flash relevance scoring; also multimodal brief extraction |
| `src/signal-scheduler.mjs` | 341 | Keyword generation from brief (OpenAI structured output), daily scheduler loop |
| `src/video-download.mjs` | 275 | `yt-dlp` wrapper — single + batch download, thumbnail extraction |
| `src/gemini-video.mjs` | 774 | Gemini Files API upload + `generateContent` for scene decomposition; preset registry (`scene_decomposition`, playtest analysis, etc.) |
| `src/llm-logger.mjs` | 140 | JSONL logger (`data/logs/llm-calls.jsonl`) + cost table for Gemini 3.1 / GPT-4o |

Dependencies (`apps/server/package.json`): **only `puppeteer` and `sharp`**. Everything else is `fetch`.

### API routes (mounted in `apps/server/src/index.mjs`)

Path prefix `/api/v1/signals/*` (22 endpoints):

```
POST  /keywords              save keyword set
GET   /keywords              list
DELETE /keywords/:id         delete
POST  /generate-keywords     LLM keyword gen from brief
POST  /extract-brief         multimodal brief extraction (images + text → JSON)
POST  /search                platform-specific search
POST  /browser-search        Puppeteer path
GET   /browser-status        puppeteer health
POST  /targeted-scrape       multi-platform fan-out
POST  /apify-search          Apify actor path
GET   /apify-status
POST  /xhs-search            XHS multi-provider
GET   /xhs-status
POST  /filter                engagement + relevance pipeline
POST  /download              yt-dlp batch
GET   /download-status
POST  /extract-thumbnails
POST  /analyze-video         Gemini fingerprint on a URL/file
GET   /llm-logs              read JSONL
DELETE /llm-logs             clear
GET   /status                cache/config snapshot
GET   /scheduler/status
POST  /scheduler/{start,stop,run}
```

### Scene embedding (Python, out-of-band)

`scripts/embed-scenes.py` (838 lines). Not part of the Node server — invoked manually. Does:

1. PySceneDetect ContentDetector
2. Whisper full-video transcription with timestamps
3. ffmpeg keyframe + audio extraction
4. Four embedding models: CLIP ViT-B-32 (512d), VideoMAE (768d), sentence-transformer (384d), mel-spectrogram (128d)
5. Intra-video motif grouping
6. HDBSCAN clustering + UMAP projection
7. Writes `artifacts/scene-clusters.json` + copies to `apps/client/public/signals-cache/`

CLI runner: `scripts/signals-pipeline.mjs` — chains keywords → search → filter → fingerprint from the command line.

### Frontend (`apps/client/app/backstage/signals/page.tsx`, 2,789 lines)

Single `'use client'` page. Calls `${NEXT_PUBLIC_TONG_API_BASE}/api/v1/signals/*`. Also has:

- `apps/client/app/api/ai/signal-keywords/route.ts` — a **separate** Next.js route that runs a streaming `ai` SDK call with the `emit_keyword_set` tool (AI SDK tool-calling, for the autonomous/directed keyword UI in backstage). This is parallel to the server's `/generate-keywords` endpoint — the Next route is for streaming UX, the server route is for scheduler use.
- `apps/client/app/api/local/videos/[videoId]/route.ts` — streams downloaded mp4s from `artifacts/videos/` for playback in the scene cluster viewer.

### Tests

- `apps/server/src/__tests__/signal-filter.test.mjs` (185 LoC)
- `apps/server/src/__tests__/signal-xhs.test.mjs` (68 LoC)
- `apps/server/src/__tests__/signal-apify.test.mjs`

---

## External dependencies

| Service | Env var | Stage | Lift-shift note |
|---|---|---|---|
| OpenAI | `OPENAI_API_KEY` | keywords | plain fetch, portable |
| Google Gemini | `GOOGLE_GEMINI_API_KEY` | brief extraction, filter relevance, scene fingerprint, Files API | plain fetch, portable |
| Apify | `APIFY_API_TOKEN` | IG hashtag scraper | plain fetch, portable |
| RapidAPI (XHS) | `X-RapidAPI-Key` | XHS keyword search | plain fetch, portable |
| Puppeteer / headless Chrome | — | TikTok + IG + XHS scraping | **not CF Workers-compatible** |
| `yt-dlp` (subprocess) | — | download | **not CF Workers-compatible** |
| Python + torch + CLIP + VideoMAE + Whisper | — | scene clustering | **not CF Workers-compatible** |
| Filesystem (`apps/server/data/logs`, `artifacts/videos`, `artifacts/scenes`) | — | LLM logs + video/keyframe cache | move to R2 |

---

## What's portable vs. what needs re-homing

### Directly portable to `aether/api` (CF Workers + Hono)

All `fetch`-based logic. Goes in as TypeScript ports of the `.mjs` files:

- `signal-filter.mjs` → filter + relevance scoring (Gemini Flash fetch calls)
- `signal-scheduler.mjs` keyword gen (OpenAI structured output, pure fetch)
- `signal-apify.mjs` (Apify actor runs via fetch)
- `signal-xhs.mjs` RapidAPI provider
- `llm-logger.mjs` → point writes at R2 or D1 instead of JSONL on disk
- `signals.mjs` orchestration shell (cache, rate-limit, normalizer) — cache moves to KV, rate-limit stays in-memory per-worker

Aether already has `/api/workflows` and `/api/executions` routes; signals would mount under `/api/signals/*` the same way.

### Needs re-homing to `aether/ai` (Modal)

Modal is a perfect fit — it already exists in aether, and these are all long-running GPU/subprocess workloads.

- **Puppeteer scraping** → Modal function with headless Chrome image. Saves the fetch-based scrapers the hassle of platform blocks. Cleaner than today's split between fetch/Puppeteer/Apify.
- **yt-dlp download** → Modal function, writes to R2.
- **Scene embedding pipeline** (`scripts/embed-scenes.py`) → Modal function with GPU, reads mp4s from R2, writes cluster JSON + keyframes back to R2.
- **Gemini Files API upload** — currently in-process on the Node server because it streams file bodies. On CF Workers we'd either (a) upload directly from the browser/Modal, or (b) use Gemini's inline data (base64) for small clips. The upload-then-analyse flow probably wants to live next to the download step in Modal.

### Storage re-homing

| Today | Tomorrow |
|---|---|
| `apps/server/data/logs/llm-calls.jsonl` | D1 table or R2 JSONL per run |
| `apps/client/public/signals-cache/0N-*.json` | R2 bucket keyed by `{userId}/{runId}/0N-*.json` |
| `artifacts/videos/*.mp4` | R2 |
| `artifacts/scenes/{video_id}/*.jpg` | R2 |
| In-memory `trendCache` (15 min TTL) | KV with same TTL |

Aether's storage convention is already `/{userId}/{workspaceName}/{projectName}/` — signals runs fit naturally.

---

## Proposed shape inside aether

```
aether/
├── api/src/routes/
│   └── signals.ts           ← new, mounts /api/signals/*
├── api/src/lib/signals/
│   ├── keywords.ts          ← port of signal-scheduler (keyword gen)
│   ├── filter.ts            ← port of signal-filter
│   ├── brief.ts             ← port of extractBriefFromMultimodal
│   ├── apify.ts             ← port of signal-apify
│   ├── xhs.ts               ← port of signal-xhs (RapidAPI provider only)
│   ├── orchestrator.ts      ← port of signals.mjs shell
│   └── llm-logger.ts        ← writes to D1/R2 instead of fs
├── ai/workflows/
│   ├── scrape.py            ← Modal + Puppeteer (was signal-browser.mjs)
│   ├── download.py          ← Modal + yt-dlp (was video-download.mjs)
│   ├── fingerprint.py       ← Modal + Gemini Files API
│   └── scene_embed.py       ← Modal + CLIP/VideoMAE/HDBSCAN (was embed-scenes.py)
└── shared/schemas.py        ← add KeywordSet, SearchResult, Fingerprint, SceneCluster types
```

Tong's `apps/client/app/backstage/signals/page.tsx` keeps working — just point `NEXT_PUBLIC_TONG_API_BASE` at aether's API instead of the local Node server. The existing Next.js streaming route (`api/ai/signal-keywords/route.ts`) can either stay (proxies to aether) or get absorbed into aether's keyword endpoint if we add SSE there.

---

## Order of operations (suggested)

1. **Port the pure-fetch modules first** (filter, keywords, apify, xhs-rapidapi, orchestrator, llm-logger). These are 80% of the LoC and 100% CF-Workers-compatible. Get `/api/signals/*` live in aether-dev without any Modal dependency.
2. **Move LLM logs to D1.** Schema is already known (`llm-logger.mjs`'s JSONL shape).
3. **Move keyword-set storage to D1.** Currently it's in-memory in `signals.mjs` (`saveKeywordSet`/`listKeywordSets`).
4. **Modal: scrape + download.** Ship as two separate functions; `/api/signals/search` and `/api/signals/download` in Workers fan out to them.
5. **Modal: fingerprint.** Merge the download + Gemini Files upload into one Modal function so the file never round-trips through the Worker.
6. **Modal: scene_embed.** The heaviest; do last. Inputs come from R2, outputs go back to R2.
7. **Cut tong over** by flipping `NEXT_PUBLIC_TONG_API_BASE`. Leave `apps/server/src/signal-*.mjs` in tong for one release as a fallback, then delete.

---

## Known gotchas

- **Puppeteer in Modal**: needs a custom image with Chromium installed. Aether doesn't have this yet but it's a standard pattern.
- **XHS blocks aggressively**: current code has fallthrough `rapidapi → puppeteer`. On CF Workers we lose the puppeteer fallback unless it's in Modal; RapidAPI alone may not be enough.
- **yt-dlp version drift**: platforms break extractors monthly. Whatever host runs Modal functions needs a regular `yt-dlp -U`. Probably wrap in a Modal secret/schedule.
- **Gemini Files retention**: 48h. If we cache `fileUri` in D1, TTL must match.
- **The 2,789-line backstage page** is tong-specific UI and stays in tong. Aether may want its own thinner UI (aether is a canvas tool, not a pipeline inspector) — the existing page is a debugging/authoring tool, not an end-user feature.
- **Scheduler**: today it's a `setInterval` in a long-running Node process. On CF Workers that's a Cron Trigger. Straightforward, but the scheduler's state (lastRunAt) needs to move from module-globals to KV.
