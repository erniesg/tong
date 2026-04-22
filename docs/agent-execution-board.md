# Execution Board

## Sync cadence
1. Add one concise update in `docs/handoff-notes.md` per active stream.
2. Use merge windows at `13:00` and `21:00` local.
3. Land shared contracts before dependent UI/server work.

## Stream TODOs

### `client-ui`
1. Keep onboarding, HUD, and world-map hierarchy readable on mobile.
2. Implement return-to-map and active-resume entry points.
3. Keep Learn mode entry, history, and resume affordances obvious.
4. Wire backend mode selection into the player-facing shell controls.

### `runtime`
1. Fix timing-sensitive `/game` interactions, tap flow, and review transitions.
2. Add deterministic mounts for QA and rehearsal use.
3. Support resumable hangouts from safe checkpoints.
4. Improve real streaming vs fake typewriter behavior without breaking tool-call orchestration.

### `overlay`
1. Build caption triple-lane overlay: script, romanization, and English.
2. Build token cards with dictionary and cross-CJK readings.
3. Keep Hangout scene rendering to dialogue and Tong hints only.
4. Add an objective progress indicator that stays in-character and minimal.

### `qa`
1. Enforce portable task briefs for remote reviewers.
2. Build first-class reviewer-proof capture and upload flow.
3. Keep the queue planner aligned with real worktree ownership.
4. Flag work that depends on laptop-only context or non-reviewable artifacts.

### `assets`
1. Define canonical runtime asset keys and manifest contracts.
2. Add runtime asset fallbacks and missing-asset validation.
3. Separate product asset hosting from QA evidence hosting.

### `server-api`
1. Implement `GET /api/v1/objectives/next`.
2. Implement Hangout start/respond endpoints.
3. Add resumable game/session endpoints after contracts land.
4. Ensure response payloads match fixtures exactly.

### `ingestion`
1. Build the 72-hour transcript and lyrics ingest job.
2. Implement term scoring and burst metrics.
3. Implement topic clustering and cluster labeling.
4. Implement orthography feature extraction.
5. Expose `GET /api/v1/vocab/insights`.

### `game-engine`
1. Convert objective payloads into turn-by-turn scene plans.
2. Track objective completion and XP, SP, and RP deltas.
3. Implement mission gates, checkpoint semantics, and location unlock checks.
4. Implement the advanced Shanghai texting reward flow.

### `deploy`
1. Build the environment matrix for local and remote paths.
2. Add deploy scripts for web and API targets.
3. Add bucket, env, and secret documentation for runtime assets and QA evidence.

### `mock-ui`
1. Build clickable mock screens for every demo segment.
2. Implement deterministic happy-path toggles for rehearsals.
3. Align mock screens with contract fixtures and the objective model.

### `creative-assets`
1. Build a first-pass city and location art pack plus reward assets.
2. Maintain `assets/presets/manifest.json` for stable asset IDs.
3. Validate asset loading budgets for the mobile demo.

## Cross-stream integration checklist
1. Objective payload parity verified between server and client.
2. Learn session history renders correctly across all city themes.
3. Hangout mode never shows non-dialogue UI during an active turn.
4. Vocab insights show cluster labels and rationale.
5. The demo run-of-show completes in `local-mock` and `local-server`.
6. Mock UI and real UI share the same data shape and navigation flow.
7. Remote reviewers can reproduce issues without private machine context.
8. Reviewer-facing proof can be attached without committed binaries.
