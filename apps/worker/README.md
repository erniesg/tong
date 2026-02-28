# apps/worker

Cloudflare Worker implementation of Tong demo APIs for remote testing.

## Run locally

```bash
npm --prefix apps/worker install
npm --prefix apps/worker run dev
```

Worker local URL defaults to `http://localhost:8788`.

## Deploy

```bash
npm --prefix apps/worker run deploy
```

## Core endpoints

- `GET /health`
- `GET /api/v1/captions/enriched?videoId=...&lang=ko`
- `GET /api/v1/dictionary/entry?term=...&lang=ko`
- `GET /api/v1/vocab/frequency?windowDays=3&userId=...`
- `GET /api/v1/vocab/insights?windowDays=3&userId=...`
- `GET /api/v1/player/media-profile?windowDays=3&userId=...`
- `POST /api/v1/ingestion/run-mock`
- `POST /api/v1/game/start-or-resume`
- `PUT /api/v1/profile/proficiency`
- `GET /api/v1/objectives/next`
- `POST /api/v1/scenes/hangout/start`
- `POST /api/v1/scenes/hangout/respond`
- `GET /api/v1/learn/sessions`
- `POST /api/v1/learn/sessions`
