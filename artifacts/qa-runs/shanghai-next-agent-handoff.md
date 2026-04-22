# Shanghai Next-Agent Handoff

Continue Shanghai integration work in `erniesg/tong` from `origin/codex/shanghai-integration-20260422`.

## Read first

1. `AGENTS.md`
2. `.agents/skills/work-github-issues/SKILL.md`
3. `docs/codex-cloud-issue-runbook.md`
4. `docs/github-agent-bootstrap.md`
5. `docs/qa/remote-reviewer-proof-setup.md`
6. `docs/handoff-notes.md`
7. `artifacts/qa-runs/shanghai-disposable-worklog.md`
8. `artifacts/qa-runs/shanghai-next-agent-handoff.md`

## Known good state

- Shanghai winner stack is already integrated and locally validated on top of `origin/codex/shanghai-integration-20260422`.
- Fresh-worktree portability is already fixed in this disposable branch by `fc9bb93` (`wip: make shanghai demo smoke portable`).
- Shanghai onboarding is now back on one canonical H1 runtime path: Tong-first grounding, then the eavesdropped scene, then the cliffhanger webtoon.
- Fixed and dynamic Shanghai onboarding both use the same `/game` H1 surface; `/onboarding/shanghai` is now only a wrapper.
- Public Shanghai routes are still `404`, so the remaining public-share blocker is deploy/publish readiness.

## Local routes to use

- Dynamic entry:
  - `http://localhost:3005/onboarding/shanghai?mode=dynamic`
- Dynamic entry with panorama return:
  - `http://localhost:3005/onboarding/shanghai?mode=dynamic&entry=panorama`
- Direct dynamic runtime:
  - `http://localhost:3005/game?phase=hangout&city=shanghai&scene=h1&mode=dynamic&seat=dingman`
- Dynamic runtime with QA logging:
  - `http://localhost:3005/game?phase=hangout&city=shanghai&scene=h1&mode=dynamic&seat=dingman&qa_run_id=shanghai-dyn-001&qa_trace=1`
- Fixed onboarding comparison:
  - `http://localhost:3005/onboarding/shanghai`
- Fixed fixture comparison:
  - `http://localhost:3005/game?phase=hangout&mode=fixture&city=shanghai&scene=h1&seat=dingman&qa_run_id=shanghai-fix-001&qa_trace=1`
- Standalone webtoon/gallery:
  - `http://localhost:3005/webtoon/shanghai-h1`

## Main task

1. Start from the disposable Shanghai worktree or create a fresh disposable branch from `origin/codex/shanghai-integration-20260422`.
2. Run the dynamic Shanghai onboarding route first with `qa_run_id` and `qa_trace=1`.
3. Save the playtest annotation logs/state bundle with:
   - `window.__TONG_QA__.downloadLogs()`
   - `window.__TONG_QA__.downloadState()`
4. Re-run the same reviewer-visible pass on the fixed comparison route.
5. Only change Shanghai product/runtime code if the dynamic-vs-fixed comparison exposes a real blocker.
6. If local flows stay green, switch to the remaining deploy/publish gap for public Shanghai URLs.

## Validation already completed

- `npm run demo:smoke`
- `npm --prefix apps/client run build`
- `npm --prefix apps/server test`
- Live local API verification confirmed the no-key Shanghai dynamic sequence:
  - Turn 1: `set_backdrop` -> opening Tong beat -> `b1a/b1b/b1c/b1d` -> Tong `方案` beat -> `show_exercise`
  - Turn 2: `b2a` through the primary `装` pair -> Tong `装/愿意` beat -> `show_exercise`
  - Turn 3: ambient/exit beats -> `show_webtoon` -> post-webtoon Tong beat -> `credit_gate`
  - Turn 4 spend path: `npc_speak` / `tong_whisper` / `end_scene`

## Remaining public gap

- `https://tong.berlayar.ai/onboarding/shanghai` is still `404`
- `https://tong.berlayar.ai/onboarding/shanghai?entry=panorama` is still `404`
- `https://tong.berlayar.ai/webtoon/shanghai-h1` is still `404`
- `https://tong.berlayar.ai/backstage/panorama-runtime?demo=TONG-DEMO-ACCESS` is still `404`
- `https://tong-api.erniesg.workers.dev/health` is `200`

## Constraints

- Commits are allowed.
- Pushes are allowed.
- Opening/updating PRs is allowed.
- Do not merge.
- Do not close issues automatically.
- Keep history disposable until after `6:00 PM SGT` on April 22, 2026.

## Deliverable

- Findings first with file:line references.
- Then report:
  1. dynamic playtest/log-capture status
  2. fixed comparison status
  3. whether Shanghai onboarding stayed green locally
  4. exact remaining gap before public Shanghai playtest URLs can go live
  5. what changed locally / pushed
