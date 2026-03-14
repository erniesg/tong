# Tong Project Roadmap

Use the `Tong Hackathon` GitHub Project as the execution board, but use this unlock order to decide what should move first.

## Phase 0: operational unblockers

These are immediate blockers for validation velocity.

1. `#66` `/game` works under `next dev`
2. `#65` portability preflight stops non-remote-ready issues before they enter unattended queues

Outcome:
- local and remote QA stop wasting time on avoidable environment/setup failures

## Phase 1: remote-first foundation

This is the first real unlock wave. Do this before trying to automate more polish work.

1. `#29` Remote-first QA umbrella
2. `#35` Define `tong-assets` and `tong-runs` bucket/env contract
3. `#36` Publish canonical runtime asset manifest and stable keys
4. `#46` Build first-class reviewer-proof capture and upload workflow
5. `#37` Resolve runtime assets via manifest with fallbacks
6. `#38` Fail smoke/validation on unresolved runtime asset references

Parallelism:
- `#35`, `#36`, `#46`, and `#65` can move in parallel
- `#37` depends on `#35` and `#36`
- `#38` depends on the resolver/manifest contract being clear enough to validate

Outcome:
- cloud agents can see the same assets and evidence surfaces as humans
- PRs can carry reviewer-visible proof instead of laptop-local artifacts
- runtime asset failures are caught before merge

## Phase 2: progression, resume, and deterministic checkpoints

Once remote-first QA is stable, make the game resumable and testable without replaying the entire hangout loop.

1. `#47` Progression umbrella
2. `#48` Contracts for session, checkpoint, and scenario seed payloads
3. `#49` Persist and resume hangout checkpoints
4. `#52` Persist mission gates, unlocks, and reward state
5. `#50` Return-to-map and resume-active-hangout UX
6. `#51` Deterministic scenario seeds and checkpoint mounts for `/game`

Parallelism:
- `#48` goes first
- `#49` and `#52` can move next in parallel
- `#50` and `#51` should build on the checkpoint model rather than inventing side paths

Outcome:
- players can leave and resume cleanly
- agents can jump to approved proof/repro states instead of replaying from the beginning

## Phase 3: playtest polish on a stable base

After proof capture and checkpointing exist, work through the player-facing issues that benefit from shorter, deterministic validation loops.

Recommended order:

1. `#31` Block Crush first-time hint and early cognitive load
2. `#17` Tap-flow investigation
3. `#19` Real streaming vs post-hoc typewriter
4. `#11` Onboarding language selection and explanation
5. `#14` HUD discoverability and score meaning
6. `#12` Hangout immersion and backdrop improvements
7. `#42` mobile-hardware-dependent validation after runtime assets are stable

Notes:
- `#17` and `#19` are validate-first, not blind implementation tasks
- `#12` and `#42` remain more asset/device-sensitive than the others

## Phase 4: knowledge graph

Do KG as a structured track, not as a ghost side branch.

1. `#53` KG umbrella
2. `#54` KG-backed contracts/schema
3. `#55` retrieval pipeline
4. `#56` API/bootstrap wiring
5. `#57` game-engine session generation
6. `#58` KO pilot
7. `#59` JA/ZH expansion

Outcome:
- KG work becomes an execution-ready stream across `server-ingestion`, `server-api`, and `game-engine`

## Phase 5: starter world content

Do content after the runtime and progression rails are defined enough that packs can be authored against stable keys and hooks.

1. `#60` World content umbrella
2. `#61` starter content template
3. `#62` Seoul starter pack
4. `#63` Tokyo starter pack
5. `#64` Shanghai starter pack

Outcome:
- content production can run in parallel without inventing structure on every pack

## Priority summary

If you want the shortest “what do we unlock first?” answer:

1. `#66`
2. `#29`
3. `#35`
4. `#36`
5. `#46`
6. `#65`
7. `#37`
8. `#38`
9. `#47`
10. `#48`
