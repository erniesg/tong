# World-content issue closure plan

Use this plan when driving closeout hygiene for the world-content issue slice: `#60`, `#69`, `#62`, `#63`, `#64`, plus the prerequisite contracts issue that unblocks them.

## Why a prerequisite contracts issue is required

The current issue set assumes world-content packs can close once city-specific content exists, but the live map, runtime asset expectations, and game-engine DAG slots still need one explicit coordination contract:

- world-map pins use current map-specific location IDs
- the game progression DAG still expects stable shared location slots
- the city pack issues currently do not say how a city-specific map pin resolves into the shared slot model
- that gap makes proof ambiguous for runtime-assets, game-engine, and creative-assets closeout work

The missing prerequisite is an explicit `mapLocationId -> dagLocationSlot` registry contract, with ownership and verification expectations that downstream issue owners can cite.

## New prerequisite issue to create

Title:

`Contracts: world map registry and mapLocationId -> dagLocationSlot mapping`

Suggested body:

```md
## Problem

The world-content closeout path still hides a shared prerequisite: the live city map pins, starter content packs, runtime asset manifests, and progression DAG do not yet point at one explicit registry that says how a map-specific `mapLocationId` resolves into the shared `dagLocationSlot` model.

Today that mapping is implicit across docs and code assumptions, which makes the world-content issues hard to close cleanly:
- runtime-assets cannot prove asset coverage against a stable logical slot contract
- game-engine cannot prove scene/reward wiring against the live map pins without relying on stale shared-label assumptions
- creative-assets cannot scope the required per-pin asset bundle against one canonical location registry
- QA cannot write one deterministic proof checklist that all downstream issues can reuse

## Goal

Define and land the prerequisite contract for the world map registry so every world-content issue can close against the same location identity model.

## Scope

- define the canonical registry shape for city-specific `mapLocationId` values and shared `dagLocationSlot` targets
- document the current live Seoul, Tokyo, and Shanghai pin sets that must map through the registry
- define ownership boundaries between runtime-assets, game-engine, server-api/contracts, and QA/platform closeout
- define the downstream proof gates that `#60`, `#69`, `#62`, `#63`, and `#64` must satisfy once the contract exists
- specify the regression command set and artifact expectations to reuse during downstream closeout

## Out of scope

- shipping the final city packs themselves
- replacing the current starter-pack issues
- asset generation or product-code implementation in this issue alone

## Deliverables

- one repo-visible contract/plan reference that downstream issues can cite
- explicit mapping table expectations for Seoul, Tokyo, and Shanghai
- a closeout checklist for downstream world-content issues
- proof expectations for QA reruns and reviewer-visible evidence where applicable

## Definition of done

- downstream world-content issues can name this issue as a prerequisite instead of carrying hidden mapping assumptions
- the required mapping/proof contract is explicit enough that QA can mark downstream issues close-ready or blocked with deterministic evidence
- `#60`, `#69`, `#62`, `#63`, and `#64` each reference this prerequisite in their closeout notes

## References

- Parent epic: #60
- Related child issues: #69, #62, #63, #64
```

Created on 2026-03-21 as GitHub issue `#114` in `erniesg/tong`.

## Closeout expectations by issue

### `#60` epic closeout

Block on:
- `#61` content template
- `#69` starter-cast roster and asset bundle definition
- prerequisite contracts issue for `mapLocationId -> dagLocationSlot`
- closed child issues `#62`, `#63`, `#64`

Required proof:
- one aggregate summary under `artifacts/qa-runs/functional-qa/world-content/<lane>/<timestamp>/`
- child issue links with closeout status
- confirmation that every child used the prerequisite regression command set
- final epic comment linking all child proof bundles and the prerequisite issue

### `#69` starter-cast closeout

Block on:
- prerequisite contracts issue for `mapLocationId -> dagLocationSlot`

Required proof:
- starter-cast matrix for all current live map pins
- required per-character asset-bundle matrix with stable logical keys
- coverage report for present vs missing manifest support
- `npm run demo:smoke`

### `#62` Seoul starter-pack closeout

Block on:
- prerequisite contracts issue for `mapLocationId -> dagLocationSlot`

Current live Seoul map pins to call out:
- `chimaek_place`
- any other live Seoul pins currently shipped in the active map experience

Required proof:
- pack/objective diff summary
- dashboard or API trace showing Seoul pack resolution through the registry
- one reviewer-visible Seoul proof image
- prerequisite regression command set output

### `#63` Tokyo starter-pack closeout

Block on:
- prerequisite contracts issue for `mapLocationId -> dagLocationSlot`

Current live Tokyo map pins to call out:
- `train_station`
- `izakaya`
- `konbini`
- `tea_house`
- `ramen_shop`

Required proof:
- pack/objective diff summary
- dashboard or API trace showing Tokyo pack resolution through the registry
- one reviewer-visible Tokyo proof image
- prerequisite regression command set output

### `#64` Shanghai starter-pack closeout

Block on:
- prerequisite contracts issue for `mapLocationId -> dagLocationSlot`

Current live Shanghai map pins to call out:
- `metro_station`
- `bbq_stall`
- `convenience_store`
- `milk_tea_shop`
- `dumpling_shop`

Required proof:
- pack/reward-bundle diff summary
- dashboard or API trace showing Shanghai pack resolution through the registry
- one reviewer-visible Shanghai proof image
- one reward-path proof artifact
- prerequisite regression command set output

## Artifact tree contract

Stage world-content closeout artifacts under:

```text
artifacts/qa-runs/functional-qa/world-content/
  <lane-or-issue>/
    <timestamp>/
      summary.md
      closeout-status.json
      issue-comments/
      verification/
      evidence/
      pr-ready-notes.md
```

Per run, include:
- `summary.md`: what changed, blockers, issue status, and whether each issue is close-ready
- `closeout-status.json`: machine-readable issue status summary
- `issue-comments/`: the exact comment drafts posted or ready to post to GitHub
- `verification/`: command outputs and rerun notes
- `evidence/`: links, screenshots, or proof references for reviewer-visible acceptance where applicable
- `pr-ready-notes.md`: title, summary, `Fixes`/`Refs`, and `How to test`

## Reusable closeout flow

1. Validate current issue state with `python .agents/skills/_functional-qa/scripts/issue_router.py plan 60 62 63 64 69`.
2. Create or confirm the prerequisite contracts issue.
3. Post or update explicit proof expectations and closeout checklist comments on `#60`, `#69`, `#62`, `#63`, and `#64`.
4. Stage the local artifact bundle under `artifacts/qa-runs/functional-qa/world-content/<lane>/<timestamp>/`.
5. Rerun the required verification commands and record outputs in `verification/`.
6. Publish issue updates with artifact path, verification result, and closeout status.
7. If the slice is close-ready, prepare PR-ready notes with title, summary, `Fixes`/`Refs`, and `How to test`.
