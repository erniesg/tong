# apps/server

Tong demo API + mock ingestion service.

## Run

```bash
npm --prefix apps/server run dev
```

Server defaults to `http://localhost:8787`.

## Core endpoints

- `GET /`
- `GET /health`
- `GET /api/v1/captions/enriched?videoId=...&lang=ko`
- `GET /api/v1/dictionary/entry?term=...&lang=ko`
- `GET /api/v1/vocab/frequency?windowDays=3`
- `GET /api/v1/vocab/insights?windowDays=3`
- `GET /api/v1/player/media-profile?windowDays=3`
- `POST /api/v1/game/start-or-resume`
- `PUT /api/v1/profile/proficiency`
- `GET /api/v1/objectives/next`
- `POST /api/v1/scenes/hangout/start`
- `POST /api/v1/scenes/hangout/respond`
- `GET /api/v1/learn/sessions`
- `POST /api/v1/learn/sessions`
- `POST /api/v1/ingestion/run-mock`
- `GET /api/v1/tools`
- `POST /api/v1/tools/invoke`

## Spotify integration endpoints (phase 1)

- `GET /api/v1/integrations/spotify/status?userId=...`
- `GET /api/v1/integrations/spotify/connect?userId=...`
- `GET /api/v1/integrations/spotify/callback?code=...&state=...`
- `POST /api/v1/integrations/spotify/sync`
- `POST /api/v1/integrations/spotify/disconnect`

## Spotify env setup

```bash
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8787/api/v1/integrations/spotify/callback
```

`SPOTIFY_REDIRECT_URI` must exactly match the redirect URI configured in Spotify Dashboard and should point to `/api/v1/integrations/spotify/callback` (not `/connect`).

## Source-scoped mock ingestion

Use `includeSources` in `POST /api/v1/ingestion/run-mock` to test YouTube and Spotify separately:

```json
{
  "userId": "demo-user-1",
  "includeSources": ["youtube"]
}
```

Valid sources are `youtube` and `spotify`.

## Agent tool API

Discover available tools:

```bash
curl -sS "http://localhost:8787/api/v1/tools"
```

Invoke a tool:

```bash
curl -sS -X POST "http://localhost:8787/api/v1/tools/invoke" \
  -H "content-type: application/json" \
  -d '{"tool":"ingestion.run_mock","args":{"userId":"demo-user-1","includeSources":["youtube"]}}'
```

## Mock ingestion

```bash
npm --prefix apps/server run ingest:mock
```

Generated files are written to `apps/server/data/generated/` (gitignored).
