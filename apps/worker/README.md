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
- `GET /api/v1/assets/*` (authenticated runtime-asset proxy)

## Runtime asset auth proxy flags

- `TONG_ASSET_AUTH_TOKEN` (or `TONG_DEV_AUTH_TOKEN` fallback): required bearer token value for `Authorization: Bearer <token>`.
- `TONG_ASSET_AUTH_PROXY_ENABLED` (default false): enables client routing to `/api/v1/assets/*` when paired with the client public flag.
- `TONG_ASSET_AUTH_SIGNED_URLS` (default false): when true, attempts 15-minute signed URL redirects (`302`) via R2 binding signing support; if unavailable in the current runtime binding, the endpoint falls back to byte proxy streaming.
