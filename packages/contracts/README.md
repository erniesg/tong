# packages/contracts

Shared schema and examples for client/server parallel development.

Keep this package stable:
1. Update here first for any payload shape change.
2. Client and server both consume from here.
3. Add examples for all new fields.

Typed contracts:
- `types.ts` defines TypeScript request/response models for Tong demo endpoints.
- `index.ts` re-exports typed contracts for app usage.
- `fixtures/game.start-or-resume.sample.json` now includes the additive nested session model used for player resume and QA seed routing.
- `fixtures/game.session.sample.json`, `fixtures/scene.session.sample.json`, `fixtures/checkpoint.player-resume.sample.json`, and `fixtures/scenario.seed.review-ready.sample.json` are the canonical samples for progression/resume work.

Curriculum graph fixtures:
- `fixtures/curriculum.graph.food-street.sample.json` is the canonical typed curriculum-graph sample.
- `fixtures/location.curriculum-pack.seoul-food-street.sample.json` mirrors the dashboard/runtime-oriented pack shape used by the mock server graph tools.
- `fixtures/graph.dashboard.sample.json` is the mocked learner dashboard payload.
- `fixtures/graph.personas.sample.json` contains starter learner personas for demo mode.
- `fixtures/graph.*.sample.json` covers next-actions, bundles, evidence, validation, and overlay proposals.

Naming note:
- The shared contract uses `learnerId` as the stable user-specific identifier.
- The mock dashboard runtime also accepts `personaId` as an alias because the first milestone is driven by persona fixtures.
