# Shanghai Disposable Worklog

- Date: 2026-04-22
- Timestamp: `2026-04-22 10:59 SGT`
- Worktree: `/private/tmp/tong-shanghai-portability-20260422`
- Branch: `codex/shanghai-portability-20260422-demo-smoke`
- Base branch to keep working from: `origin/codex/shanghai-integration-20260422`
- Disposable history constraint: keep commits disposable until after `6:00 PM SGT` on April 22, 2026

## Current state

- Shanghai winner stack is already integrated from `origin/codex/shanghai-integration-20260422`.
- Fresh-worktree portability blocker in `npm run demo:smoke` was fixed earlier in this branch at `fc9bb93` (`wip: make shanghai demo smoke portable`).
- Shanghai onboarding now routes through the canonical `/game` H1 runtime in both fixture and dynamic modes.
- Remote Shanghai playtest URLs are still unpublished and return `404`, so deploy/publish remains the only real blocker for a shareable public URL.

## Local routes

- Dynamic onboarding entry:
  - `http://localhost:3005/onboarding/shanghai?mode=dynamic`
- Dynamic onboarding entry with panorama return:
  - `http://localhost:3005/onboarding/shanghai?mode=dynamic&entry=panorama`
- Direct dynamic runtime route:
  - `http://localhost:3005/game?phase=hangout&city=shanghai&scene=h1&mode=dynamic&seat=dingman`
- Dynamic runtime route with QA tracing:
  - `http://localhost:3005/game?phase=hangout&city=shanghai&scene=h1&mode=dynamic&seat=dingman&qa_run_id=shanghai-dyn-001&qa_trace=1`
- Fixed onboarding comparison route:
  - `http://localhost:3005/onboarding/shanghai`
- Fixed fixture comparison route:
  - `http://localhost:3005/game?phase=hangout&mode=fixture&city=shanghai&scene=h1&seat=dingman&qa_run_id=shanghai-fix-001&qa_trace=1`
- Standalone webtoon/gallery route (non-canonical onboarding surface):
  - `http://localhost:3005/webtoon/shanghai-h1`

## What changed

- `apps/client/app/onboarding/shanghai/page.tsx`
  - Converted Shanghai onboarding into a pure wrapper that redirects into the canonical `/game` H1 runtime in either `mode=fixture` or `mode=dynamic`.
- `apps/client/app/game/page.tsx`
  - Added Shanghai seat passthrough for wrapper redirects and narrator handling for `set_atmosphere` beats.
- `apps/client/app/api/ai/hangout/route.ts`
  - Added `set_atmosphere`, seat-aware fixture mode, and fixture-backed Shanghai fallback/resolution flow.
- `apps/client/lib/ai/prompts/shanghai-onboarding-h1.ts`
  - Re-aligned the dynamic prompt to the canonical Tong-first H1 beat order instead of the old webtoon-first shortcut.
- `apps/client/lib/hangout/fixture-runtime.ts`
  - Standardized Shanghai H1 fixture resolution so fixture mode and dynamic fallback now share the same post-credit outcome payloads.

## Live validation already completed

- `npm run demo:smoke`
- `npm --prefix apps/client run build`
- `npm --prefix apps/server test`
- Live local API sequence check against `POST /api/ai/hangout?city=shanghai&scene=h1`
  - Turn 1: `set_backdrop` -> opening `tong_whisper` -> `b1a/b1b/b1c/b1d` -> Tong `方案` beat -> `show_exercise`
  - Turn 2: `b2a` through the primary `装` pair -> Tong `装/愿意` beat -> `show_exercise`
  - Turn 3: `set_atmosphere` / exit beats -> `show_webtoon` -> post-webtoon Tong beat -> `credit_gate`
  - Turn 4 spend path: `npc_speak` -> `tong_whisper` -> `end_scene`

## QA log capture

- Open the dynamic route with:
  - `qa_run_id=shanghai-dyn-001`
  - `qa_trace=1`
- During or after annotation, export logs from the browser console with:
  - `window.__TONG_QA__.downloadLogs()`
  - `window.__TONG_QA__.downloadState()`
- Reuse the same pattern for the fixed comparison run:
  - `qa_run_id=shanghai-fix-001`
  - `qa_trace=1`

## Remote blocker status

- `https://tong.berlayar.ai/onboarding/shanghai` -> `404`
- `https://tong.berlayar.ai/onboarding/shanghai?entry=panorama` -> `404`
- `https://tong.berlayar.ai/webtoon/shanghai-h1` -> `404`
- `https://tong.berlayar.ai/backstage/panorama-runtime?demo=TONG-DEMO-ACCESS` -> `404`
- `https://tong-api.erniesg.workers.dev/health` -> `200`

## Recommended next move

- Run a real dynamic playtest first with `qa_run_id` + `qa_trace=1`, save the annotation logs/state bundle, and then repeat the same annotation pass on the fixed comparison route.
- After log capture, either:
  - keep hardening any local runtime mismatch found during annotation, or
  - switch to deploy/publish readiness so the remote Shanghai URLs stop returning `404`.
