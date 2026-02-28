# Install And Test (Judge Flow)

## Prerequisites
1. Node.js 20+
2. npm 10+
3. Google Chrome (latest)

## One-command local launcher

```bash
npm run demo:judge
```

This command:
1. Installs server/client dependencies.
2. Runs `demo:smoke`.
3. Runs `ingest:mock`.
4. Starts API server and Next.js client.
5. Opens all demo pages with the demo password attached.

Defaults:
1. Demo user id: `demo-user-1`
2. Demo password: `TONG-JUDGE-DEMO`

Override example:

```bash
TONG_DEMO_PASSWORD=MY_TEAM_PASSWORD TONG_SERVER_PORT=8787 TONG_CLIENT_PORT=3000 npm run demo:judge
```

Stop with `Ctrl+C`.

## Manual run

Terminal 1:

```bash
npm --prefix apps/server install
npm run demo:smoke
npm run ingest:mock
TONG_DEMO_PASSWORD=TONG-JUDGE-DEMO npm run dev:server
```

Terminal 2:

```bash
npm --prefix apps/client install
NEXT_PUBLIC_TONG_API_BASE=http://localhost:8787 npm run dev:client
```

When opening routes manually, append demo password query:
- `http://localhost:3000/?demo=TONG-JUDGE-DEMO`
- `http://localhost:3000/overlay?demo=TONG-JUDGE-DEMO`
- `http://localhost:3000/game?demo=TONG-JUDGE-DEMO`
- `http://localhost:3000/insights?demo=TONG-JUDGE-DEMO`

## Chrome extension test
1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Load unpacked extension from `<repo-root>/apps/extension`.
4. Open any YouTube watch page.
5. Verify:
1. Triple-lane overlay appears.
2. Token clicks open dictionary info.
3. Overlay follows playback timing.

## Cloudflare secrets
For hosted/demo environments, store secrets server-side:

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

Do not expose secrets in `NEXT_PUBLIC_*` variables.

Quick verification:

```bash
curl -s http://localhost:8787/api/v1/demo/secret-status
# 401 if demo password is enabled

curl -s -H "x-demo-password: TONG-JUDGE-DEMO" http://localhost:8787/api/v1/demo/secret-status
# JSON booleans for demo/youtube/spotify/openai secret configuration
```

## What `demo:smoke` validates
1. Required contract fixture files exist.
2. JSON fixtures parse successfully.
3. Core progression contract shape remains valid.
4. Objective model includes vocabulary/grammar/sentence structures.
5. Player media profile includes YouTube + Spotify signals.

## Acceptance checklist
1. `/overlay` lane sync + dictionary popover works.
2. Extension overlay appears on YouTube and token lookup works.
3. `/game` supports start/resume, hangout turns, XP/SP/RP updates.
4. `/game` learn mode supports viewing previous + starting new sessions.
5. `/insights` can run ingestion and render frequency + topic clusters.
6. Extension shows karaoke-style subtitles with romanization and playback-synced progression on YouTube.
