# Agent Execution Board

## Sync cadence
1. Daily async update in `docs/handoff-notes.md` per workstream.
2. Merge window twice daily: 13:00 and 21:00 local.
3. Contracts-first rule: `packages/contracts` merges before dependent UI/server work.

## Workstream TODOs

### `codex/client-shell`
1. Build city swipe shell and route state.
2. Implement Learn mode chat shell with country theme switch.
3. Add "View previous sessions" and "Start new session" entry points.
4. Wire `TONG_BACKEND_MODE` adapter selection.
5. Add smoke UI for objective details (vocab/grammar/sentence structures).

### `codex/client-overlay`
1. Build caption triple-lane overlay (script, romanization, English).
2. Build token card with dictionary and cross-CJK readings.
3. Implement Hangout scene rendering with dialogue + Tong hints only.
4. Add objective progress indicator that stays in-character and minimal.

### `codex/server-api`
1. Implement `GET /api/v1/objectives/next`.
2. Implement Hangout start/respond endpoints.
3. Implement Learn session list/create endpoints.
4. Ensure response payloads match fixtures exactly.

### `codex/server-ingestion`
1. Build 72h transcript/lyrics ingest job.
2. Implement term scoring and burst metrics.
3. Implement topic clustering and cluster labeling.
4. Implement orthography feature extraction (`radical`, syllable families).
5. Expose `GET /api/v1/vocab/insights`.

### `codex/game-engine`
1. Convert objective payloads into turn-by-turn scene plans.
2. Track objective completion and XP/SP/RP deltas.
3. Implement mission gate checks and location unlock checks.
4. Implement Shanghai advanced texting reward flow.

### `codex/infra-deploy`
1. Build environment matrix (`local-mock`, `local-server`, `remote-server`).
2. Add deploy scripts for web + API targets.
3. Add health-check and fallback switching documentation.

### `codex/mock-ui`
1. Build clickable mock screens for every demo segment.
2. Implement deterministic happy-path toggles for rehearsals.
3. Align mock screens with contract fixtures and objective model.

### `codex/creative-assets`
1. Build first-pass city/location art pack and reward assets.
2. Maintain `assets/presets/manifest.json` for stable asset IDs.
3. Validate asset loading budgets for mobile device demo.

## Cross-stream integration checklist
1. Objective payload parity verified between server and client.
2. Learn session history renders correctly across all city themes.
3. Hangout mode never shows non-dialogue UI during active turn.
4. Vocab insights panel shows cluster labels and rationale.
5. Demo run-of-show completes in `local-mock` and `local-server`.
6. Mock UI and real UI share the same data shape and navigation flow.
