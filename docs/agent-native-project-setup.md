# Agent-Native Project Setup

Use one Tong GitHub Project as the control plane for humans and agents.

Keep GitHub's built-in `Status` field as the coarse board state (`Todo`, `In Progress`, `Done`) and use `Workflow Status` for the richer execution states below.

See `docs/project-roadmap.md` for the actual unlock order and dependency-driven sequencing.

## Project fields

- `Workflow Status`: `Backlog`, `Ready`, `In Progress`, `Validating`, `Blocked`, `Done`
- `Priority`: `P0`, `P1`, `P2`
- `Type`: `Epic`, `Feature`, `Bug`, `QA`, `Spike`
- `Initiative`: `Playtest Polish`, `Remote-First QA`, `Progression`, `Knowledge Graph`, `World Content`, `Runtime Assets`
- `Lane`: `client-ui`, `client-runtime`, `client-overlay`, `qa-platform`, `runtime-assets`, `server-api`, `server-ingestion`, `game-engine`, `infra-deploy`, `mock-ui`, `creative-assets`
- `Execution Mode`: `safe-unattended`, `validate-and-propose-only`, `needs-human-design-review`
- `Portable Context`: `Yes`, `No`
- `Proof Required`: `None`, `Screenshot`, `Clip`, `Clip+Trace`
- `Scenario Seed`: free-text checkpoint or seed id
- `Checkpoint Needed`: `Yes`, `No`
- `Remote Dependencies`: free-text, repo-only vs bucket/env/private dependency
- `Agent Ready`: `Yes`, `No`
- `Blocked By`: free-text or issue refs

## Initiative structure

- `Playtest Polish`
  - Player-facing UX and correctness issues that can usually be validated from `/game`.
- `Remote-First QA`
  - Asset hosting, evidence publishing, PR proof, cloud execution, and issue portability.
- `Progression`
  - Resumable sessions, world-map return, checkpoints, mission gating, and reward persistence.
- `Knowledge Graph`
  - KG-backed lesson generation and hangout objective wiring across KO/JA/ZH.
- `World Content`
  - Starter city/location/character packs and reusable content templates.
- `Runtime Assets`
  - Runtime asset contracts, manifests, fallbacks, and validation.

## Lane model

`Initiative` is strategic. `Lane` is execution ownership.

- `client-ui`: onboarding, world map, HUD discoverability, typography, shell layout
- `client-runtime`: `/game` scene runtime, exercises, transitions, tap flow, streaming, resume UX
- `client-overlay`: captions, token popovers, dictionary and romanization overlays
- `qa-platform`: issue routing, reviewer-proof capture, templates, runbooks, portability checks
- `runtime-assets`: asset manifests, runtime resolvers, character/scene asset fallbacks
- `server-api`: bootstrap, profile, sessions, persistence endpoints
- `server-ingestion`: transcript/lyrics ingest, vocab modeling, KG retrieval inputs
- `game-engine`: scene planning, progression state, checkpoint semantics, rewards
- `infra-deploy`: environments, buckets, upload plumbing, deployment and secrets contracts
- `mock-ui`: rehearsal surfaces and deterministic demo paths
- `creative-assets`: art/video/content-pack production

## Portable issue requirements

Every issue that should be runnable by a remote agent must stand on its own.

Required:

1. Real route or surface under test.
2. Expected visible proof sequence.
3. `Scenario Seed` or checkpoint when deterministic setup is needed.
4. Remote dependencies called out explicitly.
5. Reviewer-visible evidence requirement if the issue is visual or timing-sensitive.

## QA evidence storage model

Use a two-layer evidence model:

- `artifacts/qa-runs/`
  - local staging for manifests, summaries, traces, and raw captures
- `tong-runs`
  - external reviewer-visible host for published proof clips, GIFs, stills, and manifests

The local artifact tree is still required by the current QA scripts. It should not be treated as the final proof surface for humans reviewing a PR.

Do not require:

1. `/Users/...` paths.
2. Unpublished laptop-only media.
3. Private repo snippets without copied summary/context.
4. Acceptance criteria that depend on implied visual knowledge.

## Deterministic fallbacks

Use deterministic setup for development and QA, not as a replacement for real gameplay.

- `Player resume`
  - Resume from a safe saved checkpoint in a real session.
- `Scenario seed`
  - Deterministic near-proof or near-repro setup for QA and debugging.
- `Reviewer proof`
  - A short route-faithful capture that still shows the real visible interaction sequence.

Do not expose arbitrary internal jumps as the normal player model.

## Agent execution policy

An unattended agent may fix and publish only when:

1. `Execution Mode = safe-unattended`
2. `Portable Context = Yes`
3. `Agent Ready = Yes`
4. Required proof is obtainable remotely

Otherwise the agent validates, publishes evidence, and stops with a scoped proposal.
