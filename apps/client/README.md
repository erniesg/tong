# apps/client

Next.js review app for Tong hackathon demo surfaces.

## Run

```bash
npm --prefix apps/client install
npm --prefix apps/client run dev
```

Set API base (optional):

```bash
NEXT_PUBLIC_TONG_API_BASE=http://localhost:8787
```

## Cloudflare Workers Deploy (OpenNext)

This app is configured for OpenNext on Cloudflare Workers:
- `next@^14.2.35`
- `@opennextjs/cloudflare@^1.15.1` (Next 14 compatibility)

From repo root:

```bash
npm run deploy:client:cf
```

Or run direct commands:

```bash
npm --prefix apps/client run cf:build
npm --prefix apps/client run cf:deploy
npx --prefix apps/client wrangler deploy --config apps/client/wrangler.toml --domain tong.berlayar.ai --keep-vars
```

Recommended deploy-time public vars for judge onboarding:

```bash
NEXT_PUBLIC_TONG_PUBLIC_DOMAIN=tong.berlayar.ai
NEXT_PUBLIC_TONG_EXTENSION_ZIP_URL=https://<release-or-cdn>/tong.zip
NEXT_PUBLIC_TONG_YOUTUBE_DEMO_URL=https://www.youtube.com/watch?v=<demo-video-id>
```

If API demo password is enabled, enter the password in the top "Demo Access" bar
or open routes with `?demo=<password>`.

## Routes

- `/` judge onboarding + instructions hub
- `/judges` judge onboarding alias
- `/overlay` web caption overlay + dictionary popover
- `/game` mobile-first game UI (start/resume, hangout, learn)
- `/insights` ingestion controls + frequency/topic visualization
