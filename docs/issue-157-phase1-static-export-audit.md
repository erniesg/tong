# Issue #157 Phase 1 — static export API audit

This document tracks the `apps/client/app/api/*` route decision for Phase 1.

## Build-mode behavior

- `npm --prefix apps/client run build` keeps the existing SSR path and includes all Next route handlers.
- `npm --prefix apps/client run build:static` parks `apps/client/app/api` during the build so Next static export can complete without server route handlers.
- `npm --prefix apps/client run build:static` also parks `apps/client/app/playtest/[id]` because the dynamic segment has no `generateStaticParams()` and remains SSR-only in Phase 1.

## Route-by-route classification

| Route | Decision | Phase 1 action |
| --- | --- | --- |
| `app/api/ai/hangout/route.ts` | Keep on SSR build only | Static build skips via API parking; no migration yet |
| `app/api/ai/playtest-clarify/route.ts` | Keep on SSR build only | Intentionally untouched (conflict guard with PR #218) |
| `app/api/ai/studio/route.ts` | Keep on SSR build only | Static build skips via API parking; no migration yet |
| `app/api/ai/signal-keywords/route.ts` | Keep on SSR build only | Static build skips via API parking; no migration yet |
| `app/api/ai/campaign/route.ts` | Keep on SSR build only | Static build skips via API parking; no migration yet |
| `app/api/ai/lesson/route.ts` | Keep on SSR build only | Static build skips via API parking; no migration yet |
| `app/api/ai/director/route.ts` | Keep on SSR build only | Static build skips via API parking; no migration yet |
| `app/api/ai/translate/route.ts` | Move to Worker | Added `POST /api/ai/translate` in `apps/worker/src/index.ts` |
| `app/api/local/videos/[videoId]/route.ts` | Keep on SSR build only | Static build skips via API parking; no migration yet |

## Static-export client audit (`'use client'` constraints)

Static export compile was used as the check for client components and found no blockers requiring edits in:

- `apps/client/app/game/page.tsx` (forbidden path)
- `apps/client/app/globals.css` (forbidden path)

No `cookies()`, `headers()`, or server actions were introduced as part of this Phase 1 change.

## Current blockers to a successful static export

`build:static` still fails without touching forbidden or out-of-scope files.

1. `apps/client/app/game/layout.tsx` sets `dynamic = 'force-dynamic'`, which blocks export for `/game`, `/game/hangout`, `/game/map`, and `/game/block-crush`.
2. `apps/client/app/mock/messaging-promo/page.tsx` uses `searchParams` in a way that triggers static generation bailout/timeouts under `output: 'export'`.

Per the task constraints, no changes were made to `apps/client/app/game/page.tsx` or `apps/client/app/globals.css`.
