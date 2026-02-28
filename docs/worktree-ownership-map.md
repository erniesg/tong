# Worktree Ownership Map

Use this map to keep parallel streams moving without stepping on the same files.

## Primary write ownership by worktree

| Worktree | Branch | Primary write globs |
| --- | --- | --- |
| Client shell | `codex/client-shell` | `apps/client/app/**` (except `apps/client/app/mock/**`), `apps/client/components/shell/**`, `apps/client/components/learn/**`, `apps/client/lib/session/**`, `apps/client/lib/backend/**`, `apps/client/lib/theme/**` |
| Client overlay | `codex/client-overlay` | `apps/client/components/overlay/**`, `apps/client/components/dictionary/**`, `apps/client/lib/captions/**`, `apps/client/lib/dictionary/**`, `apps/client/lib/romanization/**` |
| Server API | `codex/server-api` | `apps/server/api/**`, `apps/server/routes/**`, `apps/server/controllers/**`, `apps/server/services/profile/**`, `apps/server/services/sessions/**`, `apps/server/services/bootstrap/**` |
| Server ingestion | `codex/server-ingestion` | `apps/server/ingestion/**`, `apps/server/jobs/**`, `apps/server/services/vocab/**`, `apps/server/services/media-profile/**`, `apps/server/services/insights/**`, `scripts/ingestion/**` |
| Game engine | `codex/game-engine` | `apps/server/game-engine/**`, `apps/server/services/game-loop/**`, `apps/server/services/scenes/**`, `apps/server/services/rewards/**` |
| Infra deploy | `codex/infra-deploy` | `infra/**`, `scripts/deploy*.sh`, `scripts/release*.sh`, `scripts/healthcheck*.sh`, `.github/workflows/**`, `docs/deployment-track.md` |
| Mock UI | `codex/mock-ui` | `apps/client/app/mock/**`, `apps/client/components/mock/**`, `apps/client/lib/mock/**`, `apps/client/public/mock/**`, `docs/demo-run-of-show.md` |
| Creative assets | `codex/creative-assets` | `assets/presets/**`, `assets/content-packs/**`, `assets/rewards/**`, `assets/manifest/**`, `docs/mock-ui-and-assets-track.md` |

## Shared zones (serialize edits)

These files are cross-stream contract points and should be edited by one stream at a time:

1. `packages/contracts/**`
2. `packages/contracts/fixtures/**`
3. `package.json` and `package-lock.json`
4. `scripts/demo_smoke_check.mjs`
5. `README.md`
6. `docs/install-and-test.md`
7. `docs/hackathon-workstreams.md`
8. `docs/agent-execution-board.md`
9. `apps/client/app/layout.tsx`
10. `apps/client/app/page.tsx`
11. `apps/client/app/globals.css`

## Crossing boundaries protocol

1. Add a short intent note to `docs/handoff-notes.md` before touching a non-owned path.
2. Contract/fixture changes go first, then dependent branch rebases.
3. Keep one owner for each shared file per merge window.
4. Rebase before merge windows (`13:00` and `21:00` local per execution board).
5. If a task spans two worktrees, split into two PRs with a contracts-first PR merged first.

## Current collision hot spots (from active diverged branches)

`codex/mock-ui` and `codex/server-ingestion` currently overlap on:

1. `README.md`
2. `docs/install-and-test.md`
3. `package.json`
4. `packages/contracts/api-contract.md`
5. `packages/contracts/fixtures/player.media-profile.sample.json`
6. `scripts/demo_smoke_check.mjs`

Treat this set as locked to one active editor at a time until both branches are rebased.
