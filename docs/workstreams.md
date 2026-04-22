# Parallel Workstreams and Worktrees

## Branch/worktree model
Use one branch and one worktree per execution lane. Keep all worktrees under `.worktrees/`.

Workstreams:
1. `client-ui` -> `.worktrees/client-ui`
2. `runtime` -> `.worktrees/client-runtime`
3. `overlay` -> `.worktrees/client-overlay`
4. `qa` -> `.worktrees/qa-platform`
5. `assets` -> `.worktrees/runtime-assets`
6. `server-api` -> `.worktrees/server-api`
7. `ingestion` -> `.worktrees/server-ingestion`
8. `game-engine` -> `.worktrees/game-engine`
9. `deploy` -> `.worktrees/infra-deploy`
10. `mock-ui` -> `.worktrees/mock-ui`
11. `creative-assets` -> `.worktrees/creative-assets`

## Stream deliverables
1. `client-ui`
- Mobile-first nav shell.
- City and world map shell plus hangout entry points.
- Onboarding clarity, HUD discoverability, and typography hierarchy.
- Learn UI with session history and start-new-session entry.
2. `runtime`
- `/game` runtime state and turn orchestration.
- Exercise surfaces, timing fixes, tap flow, and transition handling.
- Scene resume hooks and deterministic mounts.
- Streaming dialogue behavior and review-dismiss correctness.
3. `overlay`
- Subtitle overlay with script, romanization, and English lanes.
- Token hover and tap dictionary cards.
- Hangout screen policy: dialogue plus Tong hints only.
4. `qa`
- Functional QA routing and queue planning.
- Reviewer-proof capture workflow and evidence publishing.
- Portable task templates and preflight checks.
- Remote runbook maintenance.
5. `assets`
- Runtime asset manifest and resolver wiring.
- Asset availability checks and graceful fallbacks.
- Product asset vs QA evidence contract boundaries.
6. `server-api`
- Endpoints in `packages/contracts/api-contract.md`.
- First food hangout bootstrap endpoint behavior.
7. `ingestion`
- Last-72h transcript and lyrics frequency pipeline.
- Ranked vocab payload for game reinforcement.
- Topic cluster and orthography insights endpoint.
8. `game-engine`
- Learn and Hangout loop.
- XP, SP, and RP mutation rules.
- Mission and checkpoint state model.
- Advanced Shanghai texting reward scene.
9. `deploy`
- Remote deploy path that can be toggled in and out.
- Bucket and environment setup for runtime assets and QA evidence.
- Zero-UI-change swap between local and remote backend.
10. `mock-ui`
- Demo-first clickable screens for all run-of-show segments.
- Deterministic happy-path mode for rehearsals.
- Visual hierarchy and immersion validation before full plumbing.
11. `creative-assets`
- Initial city and location background packs plus UI media assets.
- Short video and reward placeholders for unlock scenes.
- Asset manifest with usage rights and file conventions.

## First critical milestone
1. Overlay path proves enriched captions and dictionary cards from fixtures.
2. Mock UI path mirrors the run-of-show from intro through the Shanghai texting reward.
3. Creative assets path ships first city and location placeholders in `assets/presets/manifest.json`.
4. Ingestion path emits both YouTube and Spotify contributions for player-level modeling.
5. Web shell path renders player-specific insight cards using the same contracts as server fixtures.

## Launching parallel worktrees and terminals
1. Create all worktrees:
   - `npm run setup:worktrees`
2. Launch one terminal per workstream:
   - `./scripts/launch-parallel-agents.sh`
3. Skip tmux and only generate launcher commands:
   - `LAUNCH_TMUX=0 ./scripts/launch-parallel-agents.sh`

## Merge strategy
1. Merge `packages/contracts` updates first.
2. Rebase client and server branches on the latest contracts.
3. Merge runtime assets before client and runtime consumers.
4. Merge API work before runtime and game-engine consumers.
5. Merge QA changes alongside queue and runbook updates before unattended batches.

## PR checklist per stream
1. Contract changes synced in `packages/contracts`.
2. Local mocks or fixtures updated.
3. Demo flow still runnable from the client alone.
4. Notes added to `docs/handoff-notes.md`.

## Conflict prevention rules
- Do not change API payloads directly in client code.
- Do not hardcode endpoints outside the shared API module.
- Keep each PR under one stream concern where possible.
- Keep deterministic seeds and checkpoints in repo-visible config or fixtures, never in laptop-only notes.
- Route knowledge-graph work into ingestion, API, and game-engine lanes unless a dedicated lane is formalized later.
