# Shanghai Next-Agent Handoff

Continue in `erniesg/tong` from the current local HEAD of `codex/shanghai-portability-20260422-demo-smoke` on top of `origin/codex/shanghai-integration-20260422`.

## Read first

1. `AGENTS.md`
2. `artifacts/qa-runs/shanghai-disposable-worklog.md`
3. `artifacts/qa-runs/functional-qa/shanghai-canonical-h1-end-to-end-validation-on-game-in-integrated-context/20260422T040613Z/summary.md`
4. `artifacts/qa-runs/functional-qa/shanghai-canonical-h1-end-to-end-validation-on-game-in-integrated-context/20260422T040613Z/evidence.json`
5. `docs/handoff-notes.md`
6. `apps/client/app/game/page.tsx`
7. `apps/client/lib/hooks/useCommerceState.ts`
8. `apps/client/lib/hooks/useWebtoonUnlocks.ts`
9. `apps/client/components/scene/WebtoonPurchaseSheet.tsx`
10. `packages/contracts/demo-commerce.mjs`
11. `apps/server/src/index.mjs`
12. `apps/server/src/__tests__/demo-commerce.test.mjs`
13. `apps/server/src/live-auction.mjs`
14. `apps/client/app/events/[eventId]/page.tsx`

## Current known-good state

- Canonical Shanghai H1 stayed aligned locally in browser validation on `2026-04-22`.
- Dynamic `/game` run and fixture `/game` run both reached the same summary state for the `dingman` spend path.
- `/onboarding/shanghai?mode=dynamic` redirects into canonical `/game` H1.
- Local Shanghai spend/unlock flows now use a demo server-owned commerce ledger:
  - credit gate spend in `/game`
  - webtoon bubble SP unlocks
  - Game Pass activation through purchase-event + unlock-grant
- The demo commerce path is implemented in:
  - `packages/contracts/demo-commerce.mjs`
  - `apps/server/src/index.mjs`
  - `apps/worker/src/index.ts`
  - `apps/client/lib/hooks/useCommerceState.ts`
- Local validation currently passes:
  - `npm run demo:smoke`
  - `npm --prefix apps/server test`
  - `npm --prefix apps/client run build`
- First live auction slice exists locally at:
  - `http://localhost:3005/events/shoucheng-dingman?demo=TONG-DEMO-ACCESS`

## Exact remaining gaps

1. Deploy/publish:
   - `https://tong.berlayar.ai/onboarding/shanghai` -> `404`
   - `https://tong.berlayar.ai/webtoon/shanghai-h1` -> `404`
   - remote canonical `/game` route is `200`
2. SP/payment:
   - local branch wiring now exists, but none of the new commerce changes have been deployed remotely yet
   - the worker/local commerce ledger is still in-memory demo state, not durable wallet state
   - there is still no auth-owned wallet, reservation/settlement path, or real Stripe checkout/webhook flow
   - a fresh agent should validate the local wiring directly before extending it:
     - credit gate spend on canonical `/game`
     - webtoon SP unlock
     - Game Pass activation path
3. Auction persistence / integration:
   - current room state is in-memory only
   - no durable bidder identity, entitlement, or payment linkage exists yet
   - current auction slice is a standalone `/events/[eventId]` room, not a Shanghai map/runtime surface yet

## Local routes

- Dynamic canonical runtime:
  - `http://localhost:3005/game?phase=hangout&city=shanghai&scene=h1&mode=dynamic&seat=dingman&qa_run_id=shanghai-dyn-001&qa_trace=1&demo=TONG-DEMO-ACCESS`
- Fixture comparison:
  - `http://localhost:3005/game?phase=hangout&mode=fixture&city=shanghai&scene=h1&seat=dingman&qa_run_id=shanghai-fix-001&qa_trace=1&demo=TONG-DEMO-ACCESS`
- Wrapper redirect:
  - `http://localhost:3005/onboarding/shanghai?mode=dynamic&seat=dingman&qa_run_id=shanghai-wrap-001&qa_trace=1&demo=TONG-DEMO-ACCESS`
- Auction bidder room:
  - `http://localhost:3005/events/shoucheng-dingman?demo=TONG-DEMO-ACCESS`
- Auction admin room:
  - `http://localhost:3005/events/shoucheng-dingman?demo=TONG-DEMO-ACCESS&admin=1&admin_key=TONG-DEMO-ACCESS`

## Recommended next tasks

1. Deploy the Shanghai client and commerce changes now present locally:
   - `/onboarding/shanghai`
   - `/webtoon/shanghai-h1`
   - Shanghai commerce secret-status coverage
   - the new `/api/v1/commerce/spend` route / commerce ledger parity
2. Validate the new local commerce path in browser/API before changing it further:
   - canonical `/game` Shanghai H1 spend path
   - `/webtoon/shanghai-h1`
   - `/api/v1/commerce/entitlements`
   - `/api/v1/commerce/spend`
3. Replace the demo in-memory commerce ledger with a durable wallet/entitlement store and choose the real contract for SP settlement.
4. Add real payment wiring behind Game Pass instead of the current demo purchase-event shortcut.
5. If auction work continues, replace the in-memory room ledger with durable state and choose the contract path for real SP/payment linkage.
6. Add the auction/event entry point to the Shanghai map/runtime UI if product wants the bidding flow discoverable in-world rather than only via direct share URL.

## Auction slice notes

- Contracts added:
  - `LiveAuction*` types in `packages/contracts/types.ts`
  - sample fixtures in `packages/contracts/fixtures/auction.*.sample.json`
  - API contract docs in `packages/contracts/api-contract.md`
- Server routes added:
  - `POST /api/v1/events/auction/join`
  - `GET /api/v1/events/auction/state`
  - `POST /api/v1/events/auction/bid`
  - `POST /api/v1/events/auction/admin`
- Client page capabilities:
  - random bidder identity + wallet
  - live countdown
  - bid ticker
  - participant list
  - winner/unlock state
  - admin media + announce + grant SP + extend + close + reset

## What has not been done

- No push in this pass.
- No PR update in this pass.
- No deploy in this pass.
- No real payment or Stripe wiring.
- No remote browser re-validation after the new commerce wiring.
- No durable auction storage.
