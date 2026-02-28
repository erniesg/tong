# Handoff Notes

Use this file to record cross-stream integration details.

Template:
- Date:
- Branch/worktree:
- What changed:
- Contract changes:
- Integration risks:
- Next owner:

## 2026-02-28
- Date: 2026-02-28
- Branch/worktree: `master` + `.worktrees/extension-hotfix` (`codex/extension-hotfix`)
- What changed:
  - Merged PR #3 (`codex/extension-hotfix` -> `master`).
  - GitHub merge commit: `42315050c6c8e92947f56c4dc8645157a170e5cf`.
  - Updated bundling so `npm run zip` packages latest `apps/extension/**` and `assets/presets/characters/tong/**` via `scripts/build-extension-bundle.sh`.
- Contract changes: none
- Integration risks:
  - Demo should keep local dictionary API available (`localhost:8787`) for full enrichment path.
  - Avoid switching Chinese script mode mid-live demo unless cache-refresh follow-up lands.
- Next owner: `codex/client-overlay`

## 2026-02-28 (Ingestion Isolation)
- Date: 2026-02-28
- Branch/worktree: `codex/tong-bg-cutout-iter1` (shared root workspace)
- What changed:
  - Reworked server ingestion scoring to use connector-independent media event modeling (frequency, burst, orthography, objective links).
  - Wired `GET /api/v1/objectives/next` and `POST /api/v1/game/start-or-resume` to consume modeled ingestion signals instead of static fixture-only objective selection.
  - Added canonical media events fixture for isolated topic modeling iteration.
- Contract changes:
  - Added optional ingestion source metadata fields (`mediaId`, `playedAtIso`, `tokens`) and new `MediaIngestionEvent` type.
  - Documented `POST /api/v1/ingestion/run-mock` and canonical `media.events` fixture shape.
- Integration risks:
  - Objective language selection now defaults to weakest profile target only when `lang` query is omitted; clients that always send `lang` keep explicit behavior.
  - Ingestion remains single-cache for default user in this root server; per-user ingestion cache still lives in `codex/server-ingestion-sync`.
- Next owner: `codex/server-ingestion-sync` (adapter from live connector payloads to canonical events)

## 2026-02-28 (Tool Retrieval Surface)
- Date: 2026-02-28
- Branch/worktree: `codex/tong-bg-cutout-iter1` (shared root workspace)
- What changed:
  - Added per-user ingestion cache and source-scoped mock ingestion execution in root server.
  - Added `GET /api/v1/tools` and `POST /api/v1/tools/invoke` so curriculum/game consumers can retrieve modeled data through a tool-style interface before live connectors land.
  - Wired existing frequency/insights/media-profile endpoints to respect `userId` and per-user ingestion state.
  - Added `scripts/mock_tool_flow_check.mjs` and `npm run demo:tools` for repeatable verification of tool retrieval flow.
- Contract changes:
  - Added tool response/request interfaces and fixtures for `tools.list` and `tools.invoke`.
  - Documented tool endpoints in API contract and server README.
- Integration risks:
  - Tool invocation coverage currently focuses on ingestion/objective retrieval tools; connector OAuth tool set remains in `codex/server-ingestion-sync`.
- Next owner: `codex/server-ingestion-sync` (merge/parity for live connector tool coverage)
