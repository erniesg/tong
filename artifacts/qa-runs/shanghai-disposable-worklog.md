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
- Dynamic Shanghai onboarding is now up locally on top of that portability work.
- Remote Shanghai playtest URLs are still unpublished and return `404`, so deploy/publish remains the only real blocker for a shareable public URL.

## Local routes

- Dynamic onboarding entry:
  - `http://localhost:3005/onboarding/shanghai?mode=dynamic`
- Dynamic onboarding entry with panorama return:
  - `http://localhost:3005/onboarding/shanghai?mode=dynamic&entry=panorama`
- Direct dynamic runtime route:
  - `http://localhost:3005/game?phase=hangout&city=shanghai&scene=h1&mode=dynamic`
- Dynamic runtime route with QA tracing:
  - `http://localhost:3005/game?phase=hangout&city=shanghai&scene=h1&mode=dynamic&qa_run_id=shanghai-dyn-001&qa_trace=1`
- Fixed onboarding comparison route:
  - `http://localhost:3005/onboarding/shanghai`
- Fixed fixture comparison route:
  - `http://localhost:3005/game?phase=hangout&mode=fixture&city=shanghai&scene=h1&qa_run_id=shanghai-fix-001&qa_trace=1`

## What changed

- `apps/client/app/onboarding/shanghai/page.tsx`
  - Added `mode=dynamic` entry handling and redirect into `/game`.
- `apps/client/app/game/page.tsx`
  - Added direct Shanghai H1 dynamic auto-start routing and persisted onboarding completion state.
- `apps/client/app/api/ai/hangout/route.ts`
  - Added Shanghai H1 dynamic routing, prompt selection, and deterministic no-key fallback flow.
  - Expanded `show_webtoon` schema so the real Shanghai H1 panel payload validates in dynamic mode.
- `apps/client/lib/ai/prompts/shanghai-onboarding-h1.ts`
  - Added explicit first-turn webtoon guardrails, embedded fixture payload guidance, and onboarding completion state updates.

## Live validation already completed

- `npm run demo:smoke`
- `npm --prefix apps/client run build`
- `npm --prefix apps/server test`
- Headless Chrome check:
  - `http://localhost:3005/onboarding/shanghai?mode=dynamic&qa_run_id=shanghai-dyn-001&qa_trace=1`
  - Result: page entered the live `/game` runtime and rendered the Shanghai H1 webtoon overlay.
- Live local API sequence check against `POST /api/ai/hangout?city=shanghai&scene=h1`
  - Turn 1: `show_webtoon`
  - Turn 2: `tong_whisper` + `show_exercise` for `方案`
  - Turn 3: `tong_whisper` + `show_exercise` for `愿意`
  - Turn 4: `credit_gate`
  - Turn 5: `npc_speak` + `tong_whisper` + `end_scene`

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
