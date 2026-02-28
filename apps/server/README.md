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
SPOTIFY_REDIRECT_URI=http://localhost:8787/api/v1/integrations/spotify/callback
```

## Mock ingestion

```bash
npm --prefix apps/server run ingest:mock
```

Generated files are written to `apps/server/data/generated/` (gitignored).
