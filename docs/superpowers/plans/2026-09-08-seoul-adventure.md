# Seoul Adventure Implementation Plan

**Goal:** Deliver a playable responsive 3D Seoul language-learning and relationship prototype at `/seoul` (with `/game/seoul` redirect).

**Architecture:** A procedural Three.js renderer, a pure local progression model, and a React interaction shell communicate through plain typed data. Existing backend and save contracts are unchanged.

**Tech stack:** Next.js 14, React 18, TypeScript, Three.js 0.180, CSS modules, Node test runner and Playwright.

**Spec:** `docs/superpowers/specs/2026-09-08-seoul-adventure-design.md`

## Constraints

One coordinator owns shared dependency manifests, source sync and integration. Independent implementation lanes use separate branches/worktrees. No deployment, billing or external messages are required. Keep the five canonical location IDs. Use the distinct `tong.seoul-adventure.v1` save. Preserve first-person dialogue-only hangouts.

## Task 1 — Preserve and sync (coordinator)

- [x] Inspect uncommitted files and commit them as `721669e`.
- [x] Fetch GitHub and verify Rucksack's clean source checkout at `64680af`.
- [x] Compare patch equivalence across rewritten history; import the two remote-only changes in an isolated worktree while preserving local additions.
- [ ] Independently review and validate the sync commits.

## Task 2 — Progress and authored content (runtime lane)

Files: `apps/client/lib/seoul-adventure/{types,content,progress,progress.test}.ts`.

- [ ] Write failing behavior tests for lesson prerequisites, correct/wrong answers, reward replay, three-hangout mission gates, history limits and invalid storage.
- [ ] Implement `newProgress`, `restoreProgress`, `visitLocation`, `completeLesson`, `completeHangout`, `completeMission`, `missionReady`, `nextObjective`.
- [ ] Author five contextual beginner Korean lessons and two companion conversation variants. Run tests and commit the lane.

## Task 3 — 3D neighborhood (world lane)

Files: `apps/client/components/seoul-world/SeoulWorld.tsx` and scene helpers.

- [ ] Build the procedural town, five navigable POIs, characters, paths, greenery and lighting.
- [ ] Implement bounded keyboard/touch movement, click navigation, collisions and proximity.
- [ ] Implement responsive camera, first-person conversations, pause, cleanup and WebGL fallback callbacks.
- [ ] Typecheck and commit the lane.

## Task 4 — Responsive play surface (UI lane)

Files: `apps/client/components/seoul-world/SeoulAdventure.tsx`, its CSS module, and `apps/client/app/seoul/page.tsx`.

- [ ] Compose the full-screen world with a compact objective, map, journal, companion switch and touch controls.
- [ ] Connect practice, contextual hangouts, assessment and memory reward to the progression functions.
- [ ] Add validated local restoration, blocked-storage handling, keyboard/focus behavior and responsive layouts.
- [ ] Typecheck and commit the lane.

## Task 5 — Integrate and verify (coordinator + fresh reviewer)

- [ ] Integrate runtime, renderer, then UI commits with the coordinator-owned dependencies.
- [ ] Run progression tests, graph fixtures, orchestration checks and client build/typecheck.
- [ ] Exercise the real route in desktop, phone portrait and phone landscape browsers; save screenshots and rerunnable smoke evidence.
- [ ] Review the immutable integrated head, fix findings and repeat fresh review of changed scope.
- [ ] Commit final verified state, update the original checkout by fast-forward if clean, and open the local preview.
