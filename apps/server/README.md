# apps/server

Tong demo API + mock ingestion service.

## Run

```bash
npm --prefix apps/server run dev
```

Server defaults to `http://localhost:8787`.
If `TONG_DEMO_PASSWORD` is set, API requests must include `x-demo-password` header
or `?demo=...` query.
Use `GET /api/v1/demo/secret-status` to verify whether demo/YouTube/Spotify/OpenAI
secrets are configured (booleans only).

## Core endpoints

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
- `GET /api/v1/demo/secret-status`

## Mock ingestion

```bash
npm --prefix apps/server run ingest:mock
```

Generated files are written to `apps/server/data/generated/` (gitignored).

## Isolation contract for modeling work

Topic modeling and frequency logic can iterate without live connectors using:

- `apps/server/data/mock-media-window.json` (snapshot input used by mock API)
- `packages/contracts/fixtures/media.events.sample.json` (canonical event fixture for scoring experiments)
