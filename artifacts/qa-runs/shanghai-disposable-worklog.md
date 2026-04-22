# Shanghai Disposable Worklog

- Date: 2026-04-22
- Timestamp: `2026-04-22 12:40 SGT`
- Worktree: `/private/tmp/tong-shanghai-portability-20260422`
- Branch: `codex/shanghai-portability-20260422-demo-smoke`
- Base branch to keep working from: `origin/codex/shanghai-integration-20260422`
- Disposable history constraint: keep commits disposable until after `6:00 PM SGT` on April 22, 2026

## Current state

- Canonical Shanghai H1 stayed aligned locally in real browser validation on the integrated `/game` surface.
- `/onboarding/shanghai` is now just a wrapper; the dynamic wrapper redirects into canonical `/game` H1.
- Dynamic and fixture runs both reached the same terminal summary state for the `dingman` spend path.
- Fixture QA trace parity is now fixed locally; fixture spend-path exports include the same post-credit tool-call tail as dynamic.
- The remaining public blocker is deploy/publish readiness, not local Shanghai runtime order.
- Shanghai credit-gate spend, webtoon bubble unlocks, and Game Pass activation now round-trip through a demo server-owned commerce ledger locally instead of mutating local client state only.
- The commerce path is still local/demo scope in this worktree: no remote worker deploy, no durable ledger, no auth ownership, and no real Stripe settlement exist yet.
- A first live auction slice now exists locally at `/events/shoucheng-dingman?demo=TONG-DEMO-ACCESS`.

## QA run bundle

- Run dir:
  - `artifacts/qa-runs/functional-qa/shanghai-canonical-h1-end-to-end-validation-on-game-in-integrated-context/20260422T040613Z`
- High-signal artifacts:
  - `summary.md`
  - `steps.md`
  - `evidence.json`
  - `logs/browser-validation-summary.json`
  - `logs/dynamic-dingman-spend-logs.json`
  - `logs/fixture-dingman-spend-logs.json`
  - `downloads/tong-qa-logs-shanghai-dyn-001.json`
  - `downloads/tong-qa-state-shanghai-dyn-001.json`
  - `downloads/tong-qa-logs-shanghai-fix-001.json`
  - `downloads/tong-qa-state-shanghai-fix-001.json`

## Local routes

- Dynamic canonical runtime:
  - `http://localhost:3005/game?phase=hangout&city=shanghai&scene=h1&mode=dynamic&seat=dingman&qa_run_id=shanghai-dyn-001&qa_trace=1&demo=TONG-DEMO-ACCESS`
- Fixture comparison:
  - `http://localhost:3005/game?phase=hangout&mode=fixture&city=shanghai&scene=h1&seat=dingman&qa_run_id=shanghai-fix-001&qa_trace=1&demo=TONG-DEMO-ACCESS`
- Dynamic wrapper:
  - `http://localhost:3005/onboarding/shanghai?mode=dynamic&seat=dingman&qa_run_id=shanghai-wrap-001&qa_trace=1&demo=TONG-DEMO-ACCESS`
- Standalone webtoon surface:
  - `http://localhost:3005/webtoon/shanghai-h1`
- Local auction room:
  - `http://localhost:3005/events/shoucheng-dingman?demo=TONG-DEMO-ACCESS`
- Local auction room as admin:
  - `http://localhost:3005/events/shoucheng-dingman?demo=TONG-DEMO-ACCESS&admin=1&admin_key=TONG-DEMO-ACCESS`

## What changed in this pass

- Browser-validated canonical Shanghai H1 in dynamic and fixture modes and exported QA logs/state for both.
- Confirmed `/onboarding/shanghai?mode=dynamic` redirects into canonical `/game` H1 instead of using a separate onboarding implementation.
- Re-checked remote route status on `2026-04-22`; public Shanghai onboarding and standalone webtoon are still `404`.
- Added a demo server-owned commerce path for Shanghai spend/unlock flows across shared contracts, local server parity, worker parity, client APIs, and client hooks:
  - `packages/contracts/demo-commerce.mjs`
  - `packages/contracts/types.ts`
  - `packages/contracts/api-contract.md`
  - `packages/contracts/fixtures/commerce.spend.sample.json`
  - `apps/server/src/index.mjs`
  - `apps/server/src/__tests__/demo-commerce.test.mjs`
  - `apps/worker/src/index.ts`
  - `apps/client/lib/api.ts`
  - `apps/client/lib/store/game-store.ts`
  - `apps/client/lib/hooks/useCommerceState.ts`
  - `apps/client/lib/hooks/useWebtoonUnlocks.ts`
  - `apps/client/components/scene/WebtoonPurchaseSheet.tsx`
  - `apps/client/app/game/page.tsx`
  - `apps/client/app/webtoon/[fixtureId]/page.tsx`
- Added the first live auction slice across contracts, server, and client:
  - `packages/contracts/types.ts`
  - `packages/contracts/api-contract.md`
  - `packages/contracts/fixtures/auction.*.sample.json`
  - `apps/server/src/live-auction.mjs`
  - `apps/server/src/index.mjs`
  - `apps/client/lib/api.ts`
  - `apps/client/app/events/[eventId]/page.tsx`

## Validation completed

- `npm run demo:smoke`
- `npm --prefix apps/server test`
- `npm --prefix apps/client run build`
- Added unit coverage for the new demo commerce ledger:
  - idempotent SP spend
  - webtoon unlock grant
  - demo Game Pass purchase/grant path
- Local browser validation:
  - dynamic `/game` spend path reached summary
  - fixture `/game` spend path reached summary
  - wrapper `/onboarding/shanghai?mode=dynamic` redirected into canonical `/game`
- Local auction API exercise:
  - join bidder
  - join admin
  - place bid
  - extend room
  - set media
  - fetch updated room state

## Exact findings

- Canonical H1 order held locally in dynamic browser validation:
  - `set_backdrop -> tong_whisper -> npc negotiation -> Tong teaching beats/exercises -> exit beats -> show_webtoon -> tong_whisper -> credit_gate -> npc_speak -> tong_whisper -> end_scene`
- Remote deploy/publish gap as of `2026-04-22`:
  - `https://tong.berlayar.ai/onboarding/shanghai` -> `404`
  - `https://tong.berlayar.ai/game?phase=hangout&city=shanghai&scene=h1&mode=dynamic&seat=dingman&demo=TONG-DEMO-ACCESS` -> `200`
  - `https://tong.berlayar.ai/webtoon/shanghai-h1` -> `404`
  - `https://tong-api.erniesg.workers.dev/health` -> `200`
  - `https://tong-api.erniesg.workers.dev/api/v1/commerce/locations/secret-status?userId=demo-user-1&city=shanghai&locationId=night_market_rooftop` -> `404`
- SP/payment gap:
  - local Shanghai spend/unlock flows now call a server-owned demo commerce ledger instead of deducting local client state directly
  - the new `/api/v1/commerce/spend` path and the local commerce mirroring are not deployed remotely yet
  - the worker/local ledger is still in-memory demo state, so balances and entitlements are not durable across process resets
  - there is still no auth-owned wallet, reservation/settlement model, or real Stripe checkout/webhook path behind Game Pass
- Auction slice scope:
  - shareable room URL
  - random bidder identity + random SP starting balance
  - live countdown and recent bid feed
  - participant bidding with SP
  - admin controls for extending, granting SP, media, announcing, closing, and resetting
  - winner/unlock state after close
  - still standalone and demo/in-memory; no persistence, auth, map-surface integration, or payment wiring yet

## Recommended next move

1. Deploy the already-present Shanghai client and commerce surfaces:
   - `/onboarding/shanghai`
   - `/webtoon/shanghai-h1`
   - Shanghai commerce secret-status path
   - the new commerce spend route / updated worker contract
2. Replace the demo in-memory commerce ledger with a durable server-owned wallet and entitlement store:
   - persistent SP balance
   - durable unlock state
   - idempotent spend + settlement records
   - auth-owned user mapping
3. Add the real payment path behind Game Pass:
   - checkout session creation
   - Stripe webhook ingestion
   - purchase-event durability and replay protection
4. If auction work continues, persist the room state and bidder wallet state behind a durable server/store rather than extending the in-memory demo model.
5. Add a visible Shanghai map/runtime entry point for the special auction if the event is meant to live inside the city UI instead of only as a standalone share link.
