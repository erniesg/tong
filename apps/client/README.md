# apps/client

Next.js app for Tong's web and mobile-first demo surfaces.

## Run

```bash
npm --prefix apps/client install
npm --prefix apps/client run dev
```

Set API base (recommended):

```bash
NEXT_PUBLIC_TONG_API_BASE=http://localhost:8787
NEXT_PUBLIC_TONG_ASSETS_BASE_URL=https://assets.tong.berlayar.ai
```

Cloud worker:

```bash
NEXT_PUBLIC_TONG_API_BASE=https://tong-api.<subdomain>.workers.dev
NEXT_PUBLIC_TONG_ASSETS_BASE_URL=https://assets.tong.berlayar.ai
```

If the remote app is missing map or character media, publish the runtime assets:

```bash
npm run runtime-assets:upload
```

At request time the app now hydrates its runtime asset manifest from
`NEXT_PUBLIC_TONG_ASSETS_BASE_URL` plus `TONG_RUNTIME_ASSET_MANIFEST_KEY`, with the
checked-in manifest only as a fallback.

## Cloudflare Workers Deploy (OpenNext)

This app is configured for OpenNext on Cloudflare Workers:
- `next@^14.2.35`
- `@opennextjs/cloudflare@^1.15.1` (Next 14 compatibility)

From repo root:

```bash
npm run deploy:client:cf
```

That deploy path now publishes the current runtime asset set to `tong-assets` before shipping the worker build, so the app and the external asset host stay in sync.

Or run direct commands:

```bash
npm --prefix apps/client run cf:build
npm --prefix apps/client run cf:deploy
npx --prefix apps/client wrangler deploy --config apps/client/wrangler.toml --domain tong.berlayar.ai --keep-vars
```

Recommended deploy-time public vars for demo onboarding:

```bash
NEXT_PUBLIC_TONG_PUBLIC_DOMAIN=tong.berlayar.ai
NEXT_PUBLIC_TONG_API_BASE=https://tong-api.<subdomain>.workers.dev
NEXT_PUBLIC_TONG_ASSETS_BASE_URL=https://assets.tong.berlayar.ai
NEXT_PUBLIC_TONG_EXTENSION_ZIP_URL=https://<release-or-cdn>/tong.zip
NEXT_PUBLIC_TONG_YOUTUBE_DEMO_URL=https://www.youtube.com/watch?v=<demo-video-id>
```

If API demo password is enabled, enter the password in the top "Demo Access" bar
or open routes with `?demo=<password>`.

## Routes

- `/` landing page
- `/demo` demo setup + instructions hub
- `/overlay` web caption overlay + dictionary popover
- `/game` mobile-first game UI (start/resume, hangout, learn)
- `/insights` ingestion controls + frequency/topic visualization
