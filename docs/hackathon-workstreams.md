# Parallel Workstreams and Worktrees

## Branch/worktree model
Use one branch + one worktree per stream. Keep all worktrees under `.worktrees/`.

Workstreams:
1. `codex/client-shell` -> `.worktrees/client-shell`
2. `codex/client-overlay` -> `.worktrees/client-overlay`
3. `codex/server-api` -> `.worktrees/server-api`
4. `codex/server-ingestion` -> `.worktrees/server-ingestion`
5. `codex/game-engine` -> `.worktrees/game-engine`
6. `codex/infra-deploy` -> `.worktrees/infra-deploy`
7. `codex/mock-ui` -> `.worktrees/mock-ui`
8. `codex/creative-assets` -> `.worktrees/creative-assets`

## Stream deliverables
1. `codex/client-shell`
- Mobile-first nav shell.
- City swipe container (Seoul/Tokyo/Shanghai).
- Backend-mode switch wiring (`TONG_BACKEND_MODE`).
- Learn UI with session history + start new session.
2. `codex/client-overlay`
- Subtitle overlay (script/romanization/English lanes).
- Token hover/tap dictionary card.
- Hangout screen policy: dialogue + Tong hints only.
3. `codex/server-api`
- Endpoints in `packages/contracts/api-contract.md`.
- First food hangout bootstrap endpoint behavior.
4. `codex/server-ingestion`
- Last-72h transcript/lyrics frequency pipeline.
- Ranked vocab payload for game reinforcement.
- Topic cluster + orthography insights endpoint (`/api/v1/vocab/insights`).
5. `codex/game-engine`
- Learn/Hangout mode loop.
- XP/SP/RP mutation rules.
- Advanced Shanghai texting reward scene.
6. `codex/infra-deploy`
- Remote deploy path that can be toggled in/out.
- Zero-UI-change swap between local and remote backend.
7. `codex/mock-ui`
- Build demo-first clickable screens for all run-of-show segments.
- Keep a deterministic "happy path" mode for rehearsals.
- Validate visual hierarchy and immersion before plumbing is complete.
8. `codex/creative-assets`
- Create/curate initial city/location background packs and UI media assets.
- Produce short video/reward placeholders for unlock scenes.
- Publish asset manifest with usage rights and file conventions.

## Merge strategy
1. Merge `packages/contracts` updates first.
2. Rebase client/server branches on latest contracts.
3. Merge client-shell before overlay/game branches.
4. Merge server-api before server-ingestion consumers.

## PR checklist per stream
1. Contract changes synced in `packages/contracts`.
2. Local mocks or fixtures updated.
3. Demo flow still runnable from client alone.
4. Notes added to `docs/handoff-notes.md` (create if missing).

## Conflict prevention rules
- Do not change API payloads directly in client code.
- Do not hardcode endpoints outside shared API module.
- Keep each PR under one stream concern where possible.
