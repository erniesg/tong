# Deployment Track (Parallel And Swappable)

## Goal
Keep deployment independent from demo implementation so the same client can run:
1. entirely local mock,
2. local server,
3. remote server.

## Frontend hosting
1. Fastest path: Vercel for Next.js web build.
2. Parallel path: Cloudflare Pages/Workers using equivalent client build output.
3. Shared promotion path: explicit GitHub Environment-backed staging and production workflows.

## Backend hosting
1. Local: run in development for integration testing.
2. Remote option A: Cloudflare Workers stack (`apps/worker` + `npm run deploy:worker`).
3. Remote option B: any Node-hosted API platform.

## Swap contract
The client must never directly depend on host-specific behavior.
Only these env keys can change:
1. `TONG_BACKEND_MODE`
2. `TONG_LOCAL_API_BASE_URL`
3. `TONG_REMOTE_API_BASE_URL`

## Runtime asset contract (`#35`)

Runtime product assets and QA evidence must stay on separate buckets with explicit bindings.

### Buckets and bindings

1. Runtime product assets bucket: `tong-assets`
   - Worker binding: `TONG_ASSETS_BUCKET`
   - Public base URL: `https://assets.tong.berlayar.ai`
2. QA evidence bucket: `tong-runs`
   - Managed by QA evidence tooling/uploader (not the runtime app worker binding).
   - Public base URL: `https://runs.tong.berlayar.ai`

### Required runtime environment keys

Set these on Cloudflare Workers (and local `.dev.vars` equivalents when needed):

1. `NEXT_PUBLIC_TONG_ASSETS_BASE_URL`
2. `TONG_ASSETS_R2_BUCKET`
3. `TONG_RUNTIME_ASSET_MANIFEST_KEY`

The app now hydrates the runtime asset manifest from the public URL formed by
`NEXT_PUBLIC_TONG_ASSETS_BASE_URL` + `TONG_RUNTIME_ASSET_MANIFEST_KEY`, then falls
back to the bundled manifest only if that fetch fails.

Checked-in examples for this contract live in:

1. `.env.example`
2. `apps/client/.env.example`

### Publish runtime assets

After adding or changing runtime media under `apps/client/public/assets/**` or either asset manifest:

```bash
npm run runtime-assets:upload
```

This uploads the runtime asset files to `tong-assets`, publishes the runtime manifests, and verifies the public `assets.tong.berlayar.ai` URLs with real `GET` requests before returning success.

`npm run deploy:client:cf` now runs this publish step before the Cloudflare worker deploy so the client build does not point at a stale asset host.

Environment-specific shortcuts:

```bash
npm run deploy:client:cf:staging
npm run deploy:client:cf:production
```

The deploy script accepts `--environment staging|production` and can emit a machine-readable JSON summary with `--summary-file`.

### Boundary rule

1. Runtime app requests for character, scene, and world content must resolve from `tong-assets`.
2. Functional QA screenshots/videos and reviewer-proof bundles must publish to `tong-runs`.
3. Do not mix product runtime payloads and QA reviewer artifacts in a single bucket.

## Secrets contract
Store all sensitive values in server runtime secrets (Cloudflare Workers secrets or equivalent):
1. `TONG_DEMO_PASSWORD`
2. `YOUTUBE_CLIENT_ID`
3. `YOUTUBE_CLIENT_SECRET`
4. `SPOTIFY_CLIENT_ID`
5. `SPOTIFY_CLIENT_SECRET`
6. `TONG_SPOTIFY_CLIENT_ID`
7. `TONG_SPOTIFY_CLIENT_SECRET`
8. `OPENAI_API_KEY`
9. `OAUTH_CLIENT_ID`
10. `OAUTH_CLIENT_SECRET`

Notes:
1. OAuth client IDs are non-secret and can be public config.
2. OAuth client secrets and API keys must never be exposed in client bundles.
3. The API enforces demo password when `TONG_DEMO_PASSWORD` is set.

## Demo safety rule
If remote host fails, switch to `local-mock` and continue the same run-of-show.

## Promotion workflows (`#291`)

Use explicit GitHub Environment-backed promotion workflows instead of ad hoc shell runs:

1. `.github/workflows/deploy-staging.yml`
2. `.github/workflows/deploy-production.yml`

### Promotion entry points

1. Staging deploys are promoted manually from a validated PR, merge commit, or known-good ref.
2. Production deploys are promoted manually from an approved source ref only.
3. Production must stay behind GitHub Environment approval on the `production` environment.

### Environment boundaries

Configure the following as GitHub Environment-scoped variables and secrets on both `staging` and `production`:

1. `CLOUDFLARE_API_TOKEN`
2. `CLOUDFLARE_ACCOUNT_ID`
3. `NEXT_PUBLIC_TONG_PUBLIC_DOMAIN`
4. `NEXT_PUBLIC_TONG_API_BASE`
5. `NEXT_PUBLIC_TONG_ASSETS_BASE_URL`
6. `NEXT_PUBLIC_TONG_EXTENSION_ZIP_URL`
7. `NEXT_PUBLIC_TONG_YOUTUBE_DEMO_URL`
8. `NEXT_PUBLIC_TONG_DEMO_PASSWORD_HINT`
9. `TONG_ASSETS_R2_BUCKET`
10. `TONG_RUNTIME_ASSET_MANIFEST_KEY`
11. `TONG_CLIENT_WORKER_NAME`
12. `TONG_CLIENT_WORKERS_URL` (optional override when the Workers URL does not follow the worker name)

Optional human-routing config for deploy failures:

1. `DISCORD_ROUTE_HUMAN_ENDPOINT`
2. `DISCORD_ROUTE_HUMAN_MENTION`
3. `ROUTE_HUMAN_WEBHOOK_SECRET`

### Deployment summaries

Both promotion workflows should publish a deployment summary back into GitHub with:

1. environment
2. source ref
3. linked PR or issue, when supplied
4. public URL and Workers URL
5. success or failure
6. rollback or next action

### Failure handling

1. If a promoted deploy fails and an `issue_ref` is attached, route the blocker back to the human-review surface.
2. Do not let failed promotions disappear into raw logs.
3. Keep production approval separate from merge approval.

## Current worker path
1. Worker source: `apps/worker/src/index.ts`
2. Worker config: `apps/worker/wrangler.toml`
3. Setup/runbook: `docs/cloudflare-worker-setup.md`
