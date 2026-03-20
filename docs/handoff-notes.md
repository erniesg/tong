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

## 2026-03-15 (PR 77 runtime asset sweep)
- Date: 2026-03-15
- Branch/worktree: `pr-77-review` (`codex/fix-issue-#36-creative-assets-manifest`)
- What changed:
  - Crossing into `apps/client/public/assets/**` and runtime smoke validation to align the creative-asset manifest with live client asset references.
  - Adding placeholder media files for currently referenced but missing runtime assets so smoke can validate the actual shipped surface instead of a partial manifest.
- Contract changes:
  - Runtime asset manifests now cover active client asset refs, not just starter-pack placeholders.
  - `demo:smoke` validates concrete client `/assets/...` refs against the runtime manifest and on-disk files.
- Integration risks:
  - Placeholder videos unblock validation but should be replaced by final art/video as the city and cinematic packs land.
- Next owner: `codex/client-runtime`

## 2026-03-15 (Issue 37 runtime asset resolver)
- Date: 2026-03-15
- Branch/worktree: `codex/fix-issue-37-runtime-asset-resolution` (shared root workspace)
- What changed:
  - Added `apps/client/lib/runtime-assets.ts` so client/runtime surfaces resolve canonical runtime asset keys through the runtime manifest and `NEXT_PUBLIC_TONG_ASSETS_BASE_URL`.
  - Rewired active game, city-map, Tong overlay, content config, and shell logo surfaces away from hardcoded runtime file paths.
  - Tightened `demo:smoke` so runtime source under `apps/client/{app,components,lib}` must use manifest-key resolution and cannot reintroduce direct `/assets/...` literals.
- Contract changes:
  - Client runtime now consumes runtime asset manifest keys instead of relying on local public-path assumptions.
  - Next.js config allows the remote runtime asset host for image optimization and external manifest import.
- Integration risks:
  - Any newly added runtime media must land in `assets/manifest/runtime-asset-manifest.json` before client code can reference it via `runtimeAssetUrl(...)`.
  - Legacy preview HTML and non-runtime scripts still use literal `/assets/...` references and remain outside the runtime smoke gate.
- Next owner: `codex/runtime-assets`

## 2026-03-15 (Issue 48 session/checkpoint contracts)
- Date: 2026-03-15
- Branch/worktree: `codex/issue-48-session-contracts` (shared root workspace)
- What changed:
  - Crossing into `packages/contracts/**` and the mock server to add the additive `GameSession`, `SceneSession`, `Checkpoint`, and `ScenarioSeed` contract model behind `POST /api/v1/game/start-or-resume`.
  - Extending fixture and smoke coverage so progression/resume follow-up work can build on a single durable payload shape instead of the older bootstrap-only response.
- Contract changes:
  - `start-or-resume` keeps the legacy top-level compatibility fields, but now also carries nested durable session/checkpoint/seed objects.
  - Added dedicated resume fixture samples for `game.session`, `scene.session`, `checkpoint`, and `scenario seed`.
- Integration risks:
  - Follow-up server/client branches should consume the nested contract objects rather than re-inventing ad hoc resume payloads.
  - This change touches the shared contracts zone; dependent progression branches should rebase before landing resume/checkpoint work.
- Next owner: `codex/server-api`

## 2026-03-20 (QA platform auth preflight tightening)
- Date: 2026-03-20
- Branch/worktree: `codex/remove-judge-hackathon-branding` (shared root workspace crossing into qa-platform-owned paths)
- What changed:
  - Tightening reviewer-proof preflight and GitHub publish diagnostics so cloud tasks check real `gh` auth and real Wrangler auth instead of only binary presence/version.
  - Making cloud-shell failures report missing publish-phase auth more explicitly when setup-phase auth was present but did not persist.
- Contract changes: none
- Integration risks:
  - Cloud tasks that previously assumed setup-time secrets proved publish readiness will now fail earlier and more accurately in `qa:preflight-reviewer-proof`.
- Next owner: `codex/qa-platform`

## 2026-03-20 (Trusted QA publish workflow)
- Date: 2026-03-20
- Branch/worktree: `codex/remove-judge-hackathon-branding` (shared root workspace crossing into qa-platform-owned paths and `.github/workflows/**`)
- What changed:
  - Added a trusted GitHub Actions workflow that can be triggered by PR comment (`/qa-publish`) or manual dispatch, resolves machine-readable publish metadata from the PR body, installs reviewer-proof dependencies, runs publish-shell preflight, and uses trusted GitHub/Cloudflare auth for comment posting and evidence upload.
  - Added a helper script to resolve publish requests from workflow inputs, PR body metadata, and maintainer comment overrides.
  - Updated the Codex PR notes template and cloud runbook to include the `QA Publish Request` block and the current limitation that gitignored Codex-local run bundles are not automatically present in GitHub Actions checkouts.
- Contract changes: none
- Integration risks:
  - The new workflow intentionally blocks fork PRs and same-repo PRs without a repo-visible run bundle; until a rerun automation exists, maintainers still need either a reproducible CI run or a manual publish fallback.
- Next owner: `codex/qa-platform`
