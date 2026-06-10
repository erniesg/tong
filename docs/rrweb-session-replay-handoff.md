# Handoff: rrweb session replay for remote playtests

Self-contained build spec. You can execute this without reading any prior
conversation. Read this whole document before writing code.

## Mission

Replace the html2canvas snapshot pipeline as the **canonical capture** for
remote playtest sessions with [rrweb](https://github.com/rrweb-io/rrweb)
DOM event recording: continuous, cheap on the player's device, streamed
incrementally, replayable pixel-accurately in backstage, and renderable to
video for Gemini analysis. Keep the existing snapshot recording as fallback.

**Why.** The current recording reconstructs the screen by repainting the DOM
with html2canvas every 2.5s (~0.4fps). It works (after fighting four
approximation bugs — see Gotchas), but it is an approximation with a per-bug
maintenance tail, it costs real CPU on phones, and 0.4fps misses everything
between snapshots. rrweb records DOM mutations + interactions as JSON events;
the replayer re-renders them in a real browser engine, so fidelity bugs of
the "html2canvas can't draw X" class disappear, and we gain a complete
input/interaction timeline for free. This is the LogRocket/Sentry/PostHog
architecture. Mobile browsers will never expose true screen capture, so this
is the fidelity ceiling for mobile web.

## Current system (what already exists — do not break it)

All on branch `fix/playtest-screen-recording` (PR #342), deployed to
production 2026-06-10 (client `tong.berlayar.ai` via OpenNext, worker
`tong-api.erniesg.workers.dev`).

- `apps/client/components/playtest/PlaytestOverlay.tsx` — the whole capture
  stack: html2canvas snapshots (2.5s) → hidden canvas → `captureStream(15)`
  → MediaRecorder; filmstrip JPEGs (every 2nd snapshot); MediaRecorder
  chunks streamed every 10s to the worker; `captureDom()` wraps html2canvas
  with three clone transforms (animation freeze, CORS cache-bust, video →
  data-URL img swap).
- `apps/client/components/playtest/PlaytestWrapper.tsx` — mounts the overlay
  when `sessionStorage.tong_playtest_session` exists; uploads on submit.
- `apps/client/app/playtest/[id]/page.tsx` — entry page; primes the store,
  desktop offers "Start & share screen (HD)" (`getDisplayMedia`, stream
  handed across SPA navigation via `apps/client/lib/playtest/display-stream.ts`).
- `apps/worker/src/index.ts` — endpoints under `/api/v1/playtest/sessions/`:
  - `POST :id/recording-chunks?seq=N` — stores chunk in R2, never finalizes
  - `POST :id/upload` (+`?partial=1` to skip finalize) — multipart recording/
    annotations/screenshots/filmstrip/stateLog; finalize sets status=submitted
  - `GET :id/recording` — serves recording.webm; if missing, assembles it by
    concatenating streamed chunks (`assembleRecordingFromChunks`)
  - R2 layout: `playtest/{id}/recording.webm`, `recording-chunks/chunk-NNNNN`,
    `filmstrip/`, `screenshots/`, `annotations.json`, `state-log.json`
- `scripts/analyze-playtest-session.mjs` + `apps/server/src/gemini-video.mjs`
  — Gemini analysis; video mode fetches the R2 recording URL; container mime
  is sniffed from bytes. Pipeline: `.github/workflows/playtest-agent-pipeline.yml`.
- Backstage: `apps/client/app/backstage/playtest/page.tsx` lists sessions,
  shows recording/filmstrip/annotations.

## What to build

### Phase 1 — record + stream

1. Add `rrweb` (v2, `record({ emit, ... })`) to the client. Start recording
   in `PlaytestWrapper`/`PlaytestOverlay` when a playtest session is active.
   Recommended options: `checkoutEveryNms: 30_000` (periodic full snapshots
   so batches are independently replayable from the nearest checkout),
   `maskAllInputs: false` (it's a game; nothing sensitive), `recordCanvas:
   true` (StrokeTracing exercises draw on canvas), `slimDOMOptions: 'all'`,
   `inlineStylesheet: true`.
2. Buffer events; every ~10s POST a batch to a new worker endpoint
   `POST :id/rrweb-events?seq=N` (mirror the recording-chunks pattern: verify
   session exists, store `playtest/{id}/rrweb/batch-NNNNN.json` (gzip via
   `CompressionStream` if easy), **never** flip status or dispatch anything).
   Flush remaining events on `visibilitychange: hidden` (keepalive fetch,
   respect the ~64KB keepalive cap — rrweb batches compress well; if too
   big, split). Final flush on submit.
3. `GET :id/rrweb-events` — return a manifest (or concatenated event array)
   for the replayer. CORS is already permissive on the worker.

### Phase 2 — backstage replay

4. Embed `rrweb-player` in the backstage playtest session view, fed from the
   events endpoint. The replay happens in the viewer's real browser, so
   cross-origin images/videos render natively (the `tong-assets` R2 bucket
   already serves `Access-Control-Allow-Origin: *` for GET/HEAD).
   `<video>` elements: rrweb records attribute/`currentTime` changes, not
   pixels — verify cinematics replay acceptably; if a video doesn't seek
   properly on replay, record `media-interaction` events are enabled
   (they are by default) and the replayer is allowed autoplay (mute it).

### Phase 3 — render to video for Gemini

5. Add `scripts/render-rrweb-video.mjs`: load the session's events, replay
   them in headless Chromium via Playwright with `record_video` (context
   `recordVideo`) at the session's original viewport, at 1× speed (or the
   rrweb-player speed API ×2 with timestamp math if sessions are long), and
   produce `rrweb-render.webm`. Upload to R2 as
   `playtest/{id}/rrweb-render.webm` via the artifacts route or a small new
   PUT endpoint.
6. Wire into `analyze-playtest-session.mjs`: prefer the rrweb render when
   present (`--video-path`), else fall back to recording.webm / screenshots.
   Update `playtest-agent-pipeline.yml` to run the render step (Playwright
   chromium is already used elsewhere in CI; `npx playwright install
   chromium --with-deps`).

### Phase 4 — flip the default, keep the fallback

7. When rrweb events exist for a session, backstage shows the rrweb replay
   first. Keep the MediaRecorder snapshot pipeline running (it's the
   fallback if rrweb fails to load and the only artifact for old sessions).
   Do not delete any existing endpoint or R2 layout.

## Definition of done

- A real **mobile-context** session against https://tong.berlayar.ai (entry
  via `/playtest/{id}`) streams rrweb batches to R2 during play; closing the
  tab **without submitting** still leaves a replayable event stream.
- Backstage replays that session showing the full game — including the
  opening `<video>` cinematic scene and a hangout with backdrops — smoothly,
  not at 0.4fps.
- `render-rrweb-video.mjs` produces a watchable webm from those events in CI
  conditions (headless), and the analyzer consumes it.
- `npx tsc --noEmit` clean in `apps/client`; existing snapshot pipeline still
  works (run the regression: submitted session has recording.webm with >5
  frames — see Validation).
- Deployed to production and verified there, not just locally.

## Hard-won gotchas (cost a day; do not rediscover)

1. **Deploy the client ONLY via `scripts/deploy-client-cloudflare.sh`.**
   A bare `opennextjs-cloudflare build && wrangler deploy` ships a client
   pointing at `localhost:8787` — `NEXT_PUBLIC_TONG_API_BASE` must be
   injected at build time; the script does this from `wrangler.toml` vars.
2. **Never let anything taint the recording canvas.** A single tainted
   drawImage silently and permanently mutes its `captureStream` — no error,
   recording just stops. Anything you draw must be taint-tested on a scratch
   canvas first (`getImageData` throws). Relevant if you touch the fallback.
3. **Browser CORS cache poisoning**: the game loads cross-origin art as
   plain `<img>`, so cached entries lack CORS approval; a later
   `crossorigin` fetch of the same URL fails despite correct server headers.
   That's why `captureDom` busts URLs **and** sets `crossorigin` in the
   clone. rrweb replay sidesteps this (real renderer, plain loads), but the
   render-to-video step loads assets from the replayer page — assets bucket
   CORS is `*` now, and rrweb inlines stylesheets, so this should be quiet.
4. **html2canvas clones restart CSS animations at keyframe 0** (fade-ins
   capture as black). Fixed via `data-playtest-freeze`. Don't regress
   `captureDom` while refactoring.
5. **Worker D1 sets `r2_recording_key` unconditionally** — never use that
   column to decide whether a recording exists; HEAD the endpoint.
6. **Local validation rig**: `cd apps/worker && npx wrangler dev --local
   --port 8787` (first: `npx wrangler d1 migrations apply tong-signups
   --local`), `cd apps/client && npx next dev -p 3002` (main checkout owns
   3000; pick an unused port). The client auto-targets `localhost:8787`.
   Local worker has no `GITHUB_PIPELINE_DISPATCH_TOKEN`, so no pipeline
   side effects.
7. **Remote E2E driver**: create a session via
   `POST https://tong-api.erniesg.workers.dev/api/v1/playtest/sessions`
   (send a browser User-Agent — Cloudflare 403s bare urllib), open
   `/playtest/{id}` in headless Chromium (mobile context: `has_touch=True`
   → auto-start; desktop context → HD offer page, click "Continue without"
   via role selector — `text=` substring-matches the description paragraph).
   Drive the game: `.btn-skip`, button "Start New Game", fill
   `input[type=text]` + "Next", then tap (195,600) to advance dialogue —
   and never click buttons labeled "Back" (loops forever).
   Verify with ffprobe (`-count_frames`) and by extracting frames and
   actually looking at them against native screenshots.
8. **Sessions named `smoke-*` in annotations** are the nightly synthetic
   smoke test — not evidence of real capture working.

## Conventions (repo + user)

- Plain CSS classes in `apps/client/app/globals.css`, no Tailwind utilities;
  functional components + hooks; game state via the singleton store.
- Work on a worktree branch off `origin/main` (this doc's parent branch is
  fine to build on); never force-push shared branches.
- **Commit timestamps**: set `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE` to an
  evening time (+08:00, e.g. 20:00–23:30, previous day if needed; never a
  future time). No Claude/Anthropic attribution lines in commits or PRs.
- Validate before claiming done; report partial failures loudly.

## Open questions to settle while building (don't block on asking)

- Event volume on long sessions: cap buffered events (e.g. drop after 15min
  like the filmstrip cap) and note the cap in the session state log.
- WebAudio/TTS audio is not captured by rrweb — out of scope; note it.
- The HD `getDisplayMedia` path stays as-is (it's already true pixels).

## Implementation notes (built 2026-06-10, branch `feat/rrweb-session-replay`)

All four phases shipped. Gotchas discovered while building:

1. **`rrweb-player` 2.0.1 has a broken published dist** — its compiled
   Player component never constructs a Replayer (no `new Replayer` in any
   dist format), so it mounts an empty white frame, silently. Both the
   backstage replay (`components/playtest/RrwebReplay.tsx`) and the render
   script drive `rrweb`'s `Replayer` class directly instead, with our own
   minimal controls.
2. **rrweb records the snapshot fallback's own machinery.** The hidden
   recording canvas gets `class="rr-block"`, and `blockSelector:
   'iframe.html2canvas-container'` blocks the html2canvas clone iframe —
   but rrweb's iframe-load hook attaches to a *blocked* iframe's
   contentDocument anyway (upstream bug), emitting ~280KB of clone-document
   events per 2.5s capture. `rrweb-recorder.ts` carries a filter that drops
   attach events for blocked html2canvas iframes plus later events whose
   target ids fall inside the dropped documents. Steady-state wire cost
   after filtering: <1KB gzipped per 10s batch (vs ~320KB before).
3. **Batches are stored with `contentEncoding: gzip` R2 metadata**; the
   worker GET pipes them through `DecompressionStream`, so consumers always
   see plain JSON.
4. `.github/workflows/playtest-agent-pipeline.yml` does not exist on this
   branch's lineage (it lives on unmerged branches) — the render step is
   CLI-only for now: `node scripts/render-rrweb-video.mjs --session-id <id>
   --upload` (needs root `npm install` + `npx playwright install chromium`).
   Wire it into the pipeline when that workflow lands.
5. The analyzer (`scripts/analyze-playtest-session.mjs`) HEADs
   `playtest/{id}/rrweb-render.webm` on the public R2 base and prefers it
   over `recording.webm` when present.
