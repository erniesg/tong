# Dating Game Transfer Plan (Legacy Learnings -> Tong)

## Context

This branch starts the dating-game stream from a clean Tong baseline while reusing proven patterns from a prior internal prototype.

## Transfer What Worked

1. Scene step model with explicit actions and pauses from prior game flow docs.
2. Stateful progression loop: objective -> scene validation -> currency updates -> unlock checks.
3. Vocabulary memory linkage so subtitle-derived terms appear in scene choices/exercises.
4. Distinct assistant role ("Tong hints") separated from character dialogue.
5. Deterministic API contracts per stage (bootstrap, scene turn, reward summary).

## Avoid Porting 1:1

1. Extension-specific interception internals from the prior prototype (YouTube CSP/POT handling) should stay isolated to overlay track.
2. Any schema or endpoint names that conflict with Tong collaboration contracts in `AGENTS.md`.
3. Generic free-chat behaviors that break objective-specific session requirements.

## Fresh Tong-First Build Sequence

1. Define `packages/contracts` additions for dating-scene state and rewards.
2. Add `apps/server` endpoints for scene start/advance/complete on top of `POST /api/v1/game/start-or-resume`.
3. Implement a minimal scene engine in `apps/server` using location + mode + objective inputs.
4. Wire `apps/client` first-person hangout UI with dialogue + Tong hints only.
5. Connect mastery validation to XP/SP/RP gates and unlock logic.
6. Add one complete vertical slice:
   - City: Seoul
   - Location: Food Street
   - Mode: hangout
   - Objective: food ordering confidence

## First Deliverable in This Branch

Ship a single reproducible scene run:

1. Start session from profile.
2. Execute 6-10 scripted/branching turns.
3. Validate objective completion.
4. Persist XP/SP/RP deltas.
5. Return unlock state for next scene.

## Parallelization Notes

1. Keep this branch focused on dating-game engine + hangout UX only.
2. Consume caption/dictionary/vocab APIs as upstream dependencies, not ownership.
3. Merge in small checkpoints so other worktrees can rebase frequently.
