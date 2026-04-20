# Issue #157 Phase 1 — static export status

## Build mode split

- `apps/client/next.config.mjs` now switches output mode by `NEXT_BUILD_TARGET`:
  - default: `output: 'standalone'` (existing SSR/web path)
  - static build target: `output: 'export'`
- `apps/client/package.json` adds `build:static`.
- `apps/client/scripts/build-static.mjs` temporarily excludes `app/api/**` from the static build input and restores it after build.

## apps/client/app/api route inventory (Phase 1 assessment)

### AI routes (`apps/client/app/api/ai/*`)

- `/api/ai/campaign` — upstream LLM orchestration (`streamText` + OpenAI), candidate for Worker runtime migration in a later phase.
- `/api/ai/director` — upstream LLM orchestration (`streamText` + OpenAI), candidate for Worker runtime migration in a later phase.
- `/api/ai/hangout` — upstream LLM orchestration (`streamText` + OpenAI), candidate for Worker runtime migration in a later phase.
- `/api/ai/lesson` — upstream LLM orchestration (`streamText` + OpenAI), candidate for Worker runtime migration in a later phase.
- `/api/ai/playtest-clarify` — untouched by rule (PR #218 ownership).
- `/api/ai/signal-keywords` — upstream LLM orchestration (`streamText` + OpenAI), candidate for Worker runtime migration in a later phase.
- `/api/ai/studio` — upstream LLM orchestration (`streamText` + OpenAI) + server tool invocation, candidate for Worker runtime migration in a later phase.
- `/api/ai/translate` — upstream translate HTTP call, candidate for Worker runtime migration in a later phase.

### Local dev route

- `/api/local/videos/[videoId]` — Node filesystem stream handler for local artifacts; should remain SSR/dev-only and excluded from static export.

## 'use client' compatibility verification

Checked all `'use client'` files for:
- `cookies()`
- `headers()`
- `'use server'`

No offenders found.

## Blocker found (hard stop)

`build:static` is currently blocked by existing dynamic rendering constraints in forbidden/adjacent files that this task cannot safely rewrite under the stated rules:

- `apps/client/app/game/page.tsx` (forbidden file) — `dynamic = 'force-dynamic'` causes static export bailout for `/game`, `/game/hangout`, `/game/map`, `/game/block-crush`.
- `apps/client/app/mock/messaging-promo/page.tsx` — uses `searchParams` dynamically in a way that breaks `output: 'export'`.

Because the first blocker is in `apps/client/app/game/page.tsx`, this phase must stop here per task constraints.
