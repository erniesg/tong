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
- `POST /api/v1/discord/route-human`
- `POST /api/v1/discord/interactions`

## Discord route-human app

This worker can host the `route-human` Discord app surface for the issue queue.

Required worker secrets:

- `DISCORD_BOT_TOKEN`
- `DISCORD_PUBLIC_KEY`
- `DISCORD_ROUTE_HUMAN_CHANNEL_ID`
- `GITHUB_ROUTE_HUMAN_TOKEN`
- `ROUTE_HUMAN_WEBHOOK_SECRET`

Required GitHub repo config for the workflow:

- variable `DISCORD_ROUTE_HUMAN_ENDPOINT`
  Example: `https://tong-api.erniesg.workers.dev/api/v1/discord/route-human`
- variable `DISCORD_ROUTE_HUMAN_MENTION`
  Example: `<@703190962431721492>` or `<@&role_id>`
- variable `ISSUE_QUEUE_TRUSTED_LOGINS`
  Example: `tong-route-human-bot`
- secret `ROUTE_HUMAN_WEBHOOK_SECRET`

Discord app setup:

1. Create a new app in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Copy the app `Public Key`, `Application ID`, and bot token.
3. Install the bot to your server with at least `bot` scope and `Send Messages` permission.
4. Set the app `Interactions Endpoint URL` to:
   `https://tong-api.erniesg.workers.dev/api/v1/discord/interactions`
5. Store the worker secrets with `wrangler secret put ...`, then deploy the worker.

Behavior:

- The GitHub workflow posts a signed request to `/api/v1/discord/route-human`.
- The worker sends a Discord message with buttons for `Run now`, `Retry`, `Hold`, `Need context`, and `Add note`.
- Button clicks write back to GitHub by posting `/tong ...` comments on the issue, so the repo-native queue orchestrator remains the durable control plane.
- Legacy `/codex ...` comments still remain accepted by the orchestrator for older cards or manual maintainer fallback.
- `Add note` opens a Discord modal and mirrors the note back to GitHub as a human review comment.
