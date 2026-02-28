# Tong

Tong is evolving from a Chrome extension prototype into a multi-platform, mobile-first app using Next.js + Capacitor.

## Judge Fast Path (One Command)

Run this from repo root:

```bash
npm run demo:judge
```

What it does:
- Installs `apps/server` + `apps/client` dependencies.
- Runs `demo:smoke` contract checks.
- Runs mock ingestion snapshot generation.
- Starts API server (`:8787`) and Next.js client (`:3000`).
- Opens browser routes with demo password applied in URL.

Demo defaults:
- Demo user id: `demo-user-1`
- Demo password: `TONG-JUDGE-DEMO`

Optional overrides:

```bash
TONG_DEMO_PASSWORD=YOUR_PASSWORD TONG_SERVER_PORT=8787 TONG_CLIENT_PORT=3000 npm run demo:judge
```

Stop both services with `Ctrl+C` in the launcher terminal.

## Manual Local Run

```bash
npm --prefix apps/server install
npm --prefix apps/client install
npm run demo:smoke
npm run ingest:mock
TONG_DEMO_PASSWORD=TONG-JUDGE-DEMO npm run dev:server
NEXT_PUBLIC_TONG_API_BASE=http://localhost:8787 npm run dev:client
```

Demo routes:
- `http://localhost:3000/`
- `http://localhost:3000/judges`
- `http://localhost:3000/overlay`
- `http://localhost:3000/game`
- `http://localhost:3000/insights`

## Hosted Deploy (Cloudflare Workers + OpenNext)

One-shot deploy from repo root:

```bash
npm run deploy:client:cf
```

This script:
- builds `apps/client` with OpenNext
- deploys to Cloudflare Workers (`tong-berlayar-web`)
- attaches custom domain trigger for `tong.berlayar.ai`

Optional overrides:

```bash
NEXT_PUBLIC_TONG_PUBLIC_DOMAIN=tong.berlayar.ai \
NEXT_PUBLIC_TONG_API_BASE=https://tong-api.erniesg.workers.dev \
NEXT_PUBLIC_TONG_EXTENSION_ZIP_URL=https://github.com/erniesg/tong/archive/refs/heads/master.zip \
NEXT_PUBLIC_TONG_DEMO_PASSWORD_HINT="Ask demo host for access password." \
npm run deploy:client:cf
```

OpenNext compatibility pinned in `apps/client`:
- `next@^14.2.35`
- `@opennextjs/cloudflare@^1.15.1` (Next 14 compatible line)

Recommended frontend vars for hosted judge experience:
- `NEXT_PUBLIC_TONG_PUBLIC_DOMAIN=tong.berlayar.ai`
- `NEXT_PUBLIC_TONG_EXTENSION_ZIP_URL=<public link to tong.zip>`
- `NEXT_PUBLIC_TONG_YOUTUBE_DEMO_URL=<public YouTube demo URL>`

Chrome extension demo path:
- Load unpacked extension from `apps/extension` in `chrome://extensions`.
- Open any YouTube watch page to verify in-page overlays.

## Secrets (Cloudflare + Local)

Use Cloudflare secrets for server-only secrets, including demo password in hosted environments.

Workers secrets:

```bash
wrangler secret put TONG_DEMO_PASSWORD
wrangler secret put YOUTUBE_CLIENT_ID
wrangler secret put YOUTUBE_CLIENT_SECRET
wrangler secret put SPOTIFY_CLIENT_ID
wrangler secret put SPOTIFY_CLIENT_SECRET
wrangler secret put TONG_SPOTIFY_CLIENT_ID
wrangler secret put TONG_SPOTIFY_CLIENT_SECRET
wrangler secret put OPENAI_API_KEY
wrangler secret put OAUTH_CLIENT_ID
wrangler secret put OAUTH_CLIENT_SECRET
```

Rules:
- Put secrets only on server runtime (Workers/Node), never hardcode in client bundles.
- OAuth client IDs can be public config; OAuth client secrets must be secret.
- Local dev can set secrets via shell env or `.env` (never commit real values).

Verify secret unlock path:

```bash
curl -s http://localhost:8787/api/v1/demo/secret-status
# -> 401 when password gate is enabled

curl -s -H "x-demo-password: TONG-JUDGE-DEMO" http://localhost:8787/api/v1/demo/secret-status
# -> returns configured/missing booleans for demo + YouTube + Spotify + OpenAI secrets
```

## Hackathon docs

- `AGENTS.md`
- `docs/hackathon-architecture.md`
- `docs/hackathon-workstreams.md`
- `docs/demo-run-of-show.md`
- `docs/mastery-and-progression.md`
- `docs/interaction-modes.md`
- `docs/vocab-modeling-and-clustering.md`
- `docs/agent-execution-board.md`
- `docs/critical-tests.md`
- `docs/mock-ui-and-assets-track.md`
- `docs/install-and-test.md`
- `docs/deployment-track.md`
- `packages/contracts/api-contract.md`
- `packages/contracts/game-loop.json`
- `packages/contracts/objective-catalog.sample.json`

Parallel worktrees (only needed for multi-agent parallel development):

```bash
chmod +x scripts/setup-hackathon-worktrees.sh
./scripts/setup-hackathon-worktrees.sh
```

## Legacy prototype (v0.1 extension)

The original Chrome MV3 extension scaffold remains in:
- `manifest.json`
- `src/popup.*`
- `src/game.*`
- `src/data/phrases.js`
- `src/options.*`
- `src/background.js`


Player-level data modeling now includes both YouTube and Spotify source breakdown samples for web insight visualizations in `packages/contracts/fixtures/player.media-profile.sample.json`.
