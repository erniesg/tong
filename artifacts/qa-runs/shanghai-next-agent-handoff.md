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

## Follow-On Scope

- Validate the canonical Shanghai H1 hangout again in the current integrated context, with fresh QA evidence, to confirm the Tong-first / eavesdrop / cliffhanger ordering still holds end to end in the browser and not just in API fallback checks.
- Inventory what is still missing for Shanghai beyond local validation:
  - public deploy/publish readiness
  - payment / spend integration gaps around SP
  - any remaining product/runtime drift between canonical H1, standalone webtoon surfaces, and future Shanghai follow-on scenes
- Explore and, if feasible in this branch, prototype a live bidding surface for a special Shanghai hangout event:
  - shareable URL for participants
  - each visitor gets a random SP balance / temporary bidder identity
  - live bid ticker and countdown timer
  - admin controls, including optional video / livestream / generated-video playback
  - admin may also bid
  - success / winner state at close
- Keep the work grounded in existing game-state / SP / payment contracts rather than inventing a disconnected mock unless a bounded prototype is the only practical first slice.

### Paste-Ready Prompt For The Next Agent

Continue work in `erniesg/tong` from local branch `codex/shanghai-portability-20260422-demo-smoke` at commit `a44ac2c` (`wip: expand shanghai next-agent scope`), which is on top of `origin/codex/shanghai-integration-20260422`.

Read first:
1. `AGENTS.md`
2. `artifacts/qa-runs/shanghai-disposable-worklog.md`
3. `artifacts/qa-runs/shanghai-next-agent-handoff.md`
4. `docs/handoff-notes.md`
5. `apps/client/lib/content/shanghai/fixtures/h1-negotiation.ts`
6. `apps/client/lib/hangout/fixture-runtime.ts`
7. `apps/client/lib/ai/prompts/shanghai-onboarding-h1.ts`
8. `apps/client/app/api/ai/hangout/route.ts`
9. `apps/client/app/game/page.tsx`
10. `apps/client/app/onboarding/shanghai/page.tsx`

Current known-good state:
- Shanghai onboarding drift was just corrected.
- Canonical intended H1 order is:
  - `set_backdrop`
  - Tong opening context
  - eavesdropped NPC negotiation
  - Tong teaching beats + exercises
  - exit beats
  - webtoon cliffhanger
  - Tong post-webtoon explanation
  - credit gate
  - spend/skip resolution
  - `end_scene`
- `/onboarding/shanghai` is now only a wrapper into canonical `/game` H1.
- Local validation already passed:
  - `npm run demo:smoke`
  - `npm --prefix apps/client run build`
  - `npm --prefix apps/server test`
- Local no-key API validation confirms the corrected turn order, but browser-level canonical validation in the new context still needs a fresh pass.
- Public Shanghai routes still return `404`, so deploy/publish remains unresolved.

Main goals:
1. Validate the canonical Shanghai H1 hangout end to end in the browser in the current integrated context.
2. Capture exact remaining gaps for Shanghai hangout readiness:
   - local/runtime
   - deploy/publish
   - SP/payment integration
3. Design and, if feasible, implement the first slice of a live bidding feature for a special `shoucheng` / `dingman` event hangout.

Product direction for the bidding feature:
- There should be a shareable URL people can open directly.
- Visitors should receive a random bidder identity and a random SP starting balance.
- The page should show a live countdown timer and live bid ticker / feed.
- Participants should be able to spend SP to place bids competitively.
- Admin should have elevated controls and may also bid.
- Admin should be able to play a livestream, uploaded video, or generated video on the page if practical.
- There should be a clear success / winner / event-unlock state after the auction closes.
- Prefer building this in a way that can later connect to real payment/SP systems rather than a dead-end demo.

Suggested execution order:
1. Re-validate Shanghai canonical H1 in-browser with `qa_run_id` + `qa_trace=1`.
2. Export QA logs/state.
3. Compare canonical dynamic and fixture surfaces for remaining mismatches.
4. Inspect current SP/payment-related state, routes, and UI contracts.
5. Produce a concrete implementation plan for the bidding feature.
6. Implement the highest-value first slice if the scope is tractable in one disposable branch.
7. Update the local handoff docs again before stopping.

Useful local routes:
- Dynamic Shanghai wrapper:
  - `http://localhost:3005/onboarding/shanghai?mode=dynamic`
- Dynamic canonical runtime:
  - `http://localhost:3005/game?phase=hangout&city=shanghai&scene=h1&mode=dynamic&seat=dingman&qa_run_id=shanghai-dyn-001&qa_trace=1`
- Fixture comparison:
  - `http://localhost:3005/game?phase=hangout&mode=fixture&city=shanghai&scene=h1&seat=dingman&qa_run_id=shanghai-fix-001&qa_trace=1`
- Standalone webtoon surface:
  - `http://localhost:3005/webtoon/shanghai-h1`

QA logging:
- Use `window.__TONG_QA__.downloadLogs()`
- Use `window.__TONG_QA__.downloadState()`

Constraints:
- Keep commits disposable until after `6:00 PM SGT` on April 22, 2026.
- Commits are allowed.
- Pushes are allowed.
- Opening/updating PRs is allowed.
- Do not merge.
- Do not close issues automatically.

Deliverable:
- Findings first with file:line references.
- Then report:
  1. whether canonical Shanghai H1 stayed aligned in live browser validation
  2. exact remaining Shanghai hangout gaps
  3. SP / payment integration gaps and recommended contract path
  4. bidding feature proposal or implementation status
  5. what changed locally / pushed
