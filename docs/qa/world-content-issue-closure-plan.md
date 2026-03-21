# World Content Issue Closure Plan

## Purpose

This document defines what must exist, what proof must be captured, and which lane owns each part of the work before the world-content issues can close cleanly.

It reconciles two facts that are both currently true:

1. The live `/game` map is the player-facing source of truth for visible cities, pins, labels, and current image/video assets.
2. The Knowledge Graph / progression DAG still depends on the shared five-slot model from `AGENTS.md`: `food_street`, `cafe`, `convenience_store`, `subway_hub`, `practice_studio`.

The closeout path is therefore a mapping layer, not a forced rollback of the live map.

## Canonical Sources

- Live player-facing map: `apps/client/components/city-map/CityMap.tsx`
- Shared location contract mixed state: `apps/client/lib/api.ts`
- Stale shared-5 runtime constants: `apps/client/app/game/GamePageClient.tsx`
- Current KG/read-model world roadmap: `apps/server/src/curriculum-graph.mjs`
- Current starter-pack template: `assets/content-packs/city-location-character.starter.template.json`
- Current concrete starter pack: `assets/content-packs/seoul-food-street.starter.json`
- Current reward placeholder: `assets/rewards/shanghai-reward-bundle.placeholder.json`

## Mandatory Prerequisite Issue

Create a new issue before closing `#69`, `#62`, `#63`, or `#64`.

Suggested title:

`Contracts: world map registry and mapLocationId -> dagLocationSlot mapping`

Suggested lane:

- `server-api` for the contracts merge window

Suggested initiative:

- `Knowledge Graph`

Suggested blocked issues:

- `#69`
- `#62`
- `#63`
- `#64`

### Suggested issue body

```md
## Goal

Make the live `/game` world map and the Knowledge Graph progression model explicitly compatible instead of relying on mixed location IDs and implicit aliases.

## Why now

- The live player-facing map in `apps/client/components/city-map/CityMap.tsx` is the current visual source of truth.
- The KG / progression model in `AGENTS.md` still requires the shared five-slot location set.
- Open world-content issues cannot close cleanly while those two models are only partially aligned in code.

## Scope

- add a shared world-map registry in `packages/contracts/**`
- define `mapLocationId` and `dagLocationSlot`
- map every current visible Seoul/Tokyo/Shanghai pin to a shared DAG slot
- preserve additive compatibility for existing callers still using legacy `location`
- update fixtures and API compatibility for bootstrap/objective/dashboard flows

## Out of scope

- redesigning the current world-map art
- renaming the shared DAG slot taxonomy
- fully authoring every city/location content pack

## Definition of done

- every visible live map pin has a registry entry
- bootstrap/objective/dashboard flows accept current-map IDs
- dashboard/progression output can explain both map pin and DAG slot
- regression scripts pass for KG contracts and multi-city objective flows

## Proof

- updated contracts + fixtures
- passing `npm run test:kg-contract-schema`
- passing `npm run test:graph-contracts`
- passing `node scripts/mock_api_flow_check.mjs http://localhost:8793 --strict-state`
- passing `node apps/server/scripts/issue-59-ja-zh-flow-check.mjs http://localhost:8793`
```

### Required outcome

- Introduce a shared world-map registry in `packages/contracts/**`.
- Represent the live visible pin identity as `mapLocationId`.
- Represent the shared KG/progression slot as `dagLocationSlot`.
- Preserve additive compatibility for existing callers that still send legacy `location`.
- Add fixtures showing current-map IDs resolving to the correct shared DAG slot.

### Minimum acceptance criteria

- Every visible live map pin across Seoul, Tokyo, and Shanghai has a registry entry.
- Every registry entry includes city, display labels, pin coordinates, `mapLocationId`, `dagLocationSlot`, and pack/status hooks.
- `POST /api/v1/game/start-or-resume` and `GET /api/v1/objectives/next` accept current-map IDs directly or via aliases.
- `GET /api/v1/graph/dashboard` emits location status keyed to the live map identity while still tying progress to the shared DAG slot.
- `apps/server/scripts/issue-59-ja-zh-flow-check.mjs` no longer depends on stale hardcoded `subway_hub` / `practice_studio` assumptions without an explicit alias layer.

### Required proof

- Contract diff in `packages/contracts/**`
- Updated fixtures in `packages/contracts/fixtures/**`
- Passing:
  - `npm run test:kg-contract-schema`
  - `npm run test:graph-contracts`
  - `node scripts/mock_api_flow_check.mjs http://localhost:8793 --strict-state`
  - `node apps/server/scripts/issue-59-ja-zh-flow-check.mjs http://localhost:8793`

## Initial Map-To-DAG Matrix

This is the proposed first-pass matrix to unblock the contracts issue. It is not permission to skip the explicit registry.

### Seoul

- `food_street` -> `food_street`
- `cafe` -> `cafe`
- `convenience_store` -> `convenience_store`
- `subway_hub` -> `subway_hub`
- visible pin labeled `Chimaek Place` currently uses map id `practice_studio` -> `practice_studio`

### Tokyo

- `ramen_shop` -> `food_street`
- `tea_house` -> `cafe`
- `konbini` -> `convenience_store`
- `train_station` -> `subway_hub`
- `izakaya` -> `practice_studio`

### Shanghai

- `dumpling_shop` -> `food_street`
- `milk_tea_shop` -> `cafe`
- `convenience_store` -> `convenience_store`
- `metro_station` -> `subway_hub`
- `bbq_stall` -> `practice_studio`

If product/design wants a different semantic name for the fifth shared slot later, that should be a separate contract change. Do not silently overload the current issues with that rename.

## Issue Closeout Criteria

## `#60` Epic: starter world content for Seoul/Tokyo/Shanghai

Keep this issue open as the umbrella until all child issues close.

### Close only when

- The prerequisite contracts issue is closed.
- `#69`, `#62`, `#63`, and `#64` are all closed.
- There is one aggregate QA summary under `artifacts/qa-runs/functional-qa/world-content/`.
- There is one final GitHub summary comment linking the child proof bundles.

### Required proof

- Reviewer-visible screenshots for each city's current map/dashboard status
- Aggregate verification log
- Links to each child issue's proof bundle

## `#61` Content template for city/location/character starter packs

Treat the implementation as done, but add retro proof before considering the dependency satisfied.

### Retro proof required

- Point to `assets/content-packs/city-location-character.starter.template.json`
- Point to `assets/content-packs/seoul-food-street.starter.json`
- Confirm which required fields remain template-level versus now required for all future city packs

## `#69` Creative assets: starter cast roster and required per-character asset bundle

This issue must define the cast and asset bundle against the live map and the shared DAG mapping, not against a vague future world model.

### Close only when

- The prerequisite contracts issue is closed.
- There is a checked-in starter-cast matrix for all three cities.
- Every current live map pin has an assigned starter cast target.
- Every starter character has a required asset bundle with stable logical keys.
- Mandatory versus optional media outputs are explicit.
- Missing versus present asset coverage is documented against `assets/manifest/**`.

### Required proof

- Starter-cast matrix doc
- Manifest key matrix
- Asset coverage report
- `npm run demo:smoke`

## `#62` Seoul starter pack

### Close only when

- Seoul pack coverage reflects the live Seoul map layout and labels.
- The pack resolves to shared DAG slots through the registry.
- `assets/content-packs/**` contains Seoul starter-pack files for the current visible Seoul locations.
- Seoul objective seeds and pack wiring are no longer limited to the single existing food-street draft.
- Dashboard/API output shows Seoul statuses from actual pack presence, not old hardcoded roadmap assumptions.

### Required proof

- Pack file diff
- Objective seed diff
- Dashboard/API trace
- One reviewer-visible Seoul screenshot
- Passing regression commands from the prerequisite contracts issue

## `#63` Tokyo starter pack

### Close only when

- Tokyo pack coverage reflects the live Tokyo map pins: `train_station`, `izakaya`, `konbini`, `tea_house`, `ramen_shop`.
- Tokyo pins resolve to DAG slots through the registry.
- `assets/content-packs/**` contains Tokyo starter-pack files for the current visible Tokyo locations.
- Objective seeds are updated off stale `subway_hub`-only assumptions.
- Dashboard/API output reports Tokyo status from real pack state.

### Required proof

- Pack file diff
- Objective seed diff
- Dashboard/API trace
- One reviewer-visible Tokyo screenshot
- Passing regression commands from the prerequisite contracts issue

## `#64` Shanghai starter pack

### Close only when

- Shanghai pack coverage reflects the live Shanghai map pins: `metro_station`, `bbq_stall`, `convenience_store`, `milk_tea_shop`, `dumpling_shop`.
- Shanghai pins resolve to DAG slots through the registry.
- `assets/content-packs/**` contains Shanghai starter-pack files for the current visible Shanghai locations.
- The advanced texting reward path is attached to an explicit current-map pin and pack structure.
- Reward assets and hooks are no longer only represented by `assets/rewards/shanghai-reward-bundle.placeholder.json`.

### Required proof

- Pack file diff
- Reward bundle diff
- Dashboard/API trace
- One reviewer-visible Shanghai screenshot
- One reward-path proof artifact
- Passing regression commands from the prerequisite contracts issue

## Agent Task Briefs

These briefs are designed to match the repo's lane ownership rules. `packages/contracts/**` and `assets/manifest/**` remain serialized shared zones.

## `codex/server-api`

### Write ownership for this effort

- `packages/contracts/**`
- `packages/contracts/fixtures/**`
- `apps/server/src/index.mjs`
- `apps/server/scripts/issue-59-ja-zh-flow-check.mjs`
- `apps/client/lib/api.ts`

### Deliverable

- Contracts-first world-map registry and endpoint compatibility layer

### Acceptance criteria

- Shared registry schema exists
- `mapLocationId` and `dagLocationSlot` are explicit
- Endpoint inputs accept current live map IDs
- Fixtures cover Seoul, Tokyo, and Shanghai current-map cases
- KG regression scripts pass

## `codex/game-engine`

### Write ownership for this effort

- `apps/server/src/curriculum-graph.mjs`
- other game-engine-owned scene/progression files as needed

### Deliverable

- Registry-driven roadmap and DAG resolution

### Acceptance criteria

- `buildWorldRoadmap()` no longer hardcodes old visibility states by `SHARED_LOCATIONS`
- map pin status derives from registry + pack presence + authored/scaffold state
- next-objective and dashboard outputs can explain both the visible map pin and the shared DAG slot
- Shanghai reward-path wiring points to a real current-map location

## `codex/client-ui`

### Write ownership for this effort

- `apps/client/components/city-map/**`
- `apps/client/app/game/page.tsx`
- `apps/client/lib/content/locations.ts`

### Deliverable

- Live map fully backed by the shared registry

### Acceptance criteria

- `CityMap.tsx` stops owning the only source of pin metadata
- visible labels and positions stay identical to the current art
- Seoul still shows `Chimaek Place` on the map even if the DAG slot remains `practice_studio`
- no hardcoded fallback location tables remain in UI-owned map files

## `codex/client-runtime`

### Write ownership for this effort

- `apps/client/app/game/GamePageClient.tsx`
- runtime-owned store/session helpers if needed

### Deliverable

- Runtime cleanup of stale shared-5 location assumptions

### Acceptance criteria

- duplicated location labels/constants are removed or delegated to the shared registry
- runtime surfaces accept current-map IDs
- no stale assumptions remain that would reintroduce `subway_hub` / `practice_studio` as the only Tokyo/Shanghai visible locations

## `codex/runtime-assets`

### Write ownership for this effort

- `assets/manifest/**`
- runtime asset resolver/fallback files if needed

### Deliverable

- Manifest completeness for all current map pins, starter characters, and reward hooks

### Acceptance criteria

- every pack/registry reference has a stable manifest key or explicit fallback
- `assets/manifest/**` changes are the only source of truth for runtime asset presence
- `npm run demo:smoke` passes

## `codex/creative-assets`

### Write ownership for this effort

- `assets/content-packs/**`
- `assets/rewards/**`

### Deliverable

- City starter packs and reward bundle content files

### Acceptance criteria

- starter-pack files exist for all current visible map locations
- pack files use stable keys instead of local filenames
- starter-cast assignments line up with the approved roster from `#69`
- Shanghai reward bundle is no longer only placeholder-level

## `codex/qa-platform`

### Write ownership for this effort

- `docs/qa/**`
- `.agents/skills/**`
- issue/PR proof templates and QA runbook material

### Deliverable

- Closure proof checklist and verification workflow for the world-content track

### Acceptance criteria

- each issue has an explicit proof checklist
- the issue queue plan and closeout commands are documented
- reviewer-visible artifact expectations are stated before implementation PRs try to close issues

## Recommended Execution Order

1. Create and land the prerequisite contracts issue.
2. Rebase dependent branches on the contract change.
3. Land `runtime-assets` manifest completeness work before client/runtime consumers.
4. Land `game-engine` DAG/roadmap resolution on top of the registry.
5. Land `client-ui` and `client-runtime` registry consumption in parallel.
6. Land `creative-assets` starter-pack and reward-file work after the registry and manifest keys are stable.
7. Run QA proof capture and post issue closeout comments.
8. Close child issues.
9. Close `#60`.

## Do Not Do

- Do not close `#62`, `#63`, or `#64` based only on pack JSON existing.
- Do not treat a merged PR as closure proof without verify-fix artifacts.
- Do not let `assets/manifest/**` and `packages/contracts/**` be edited by multiple active owners in the same merge window.
- Do not silently replace the shared five-slot DAG model without a dedicated contract issue.
