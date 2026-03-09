# Curriculum Graph Progression Product Spec

Status: proposed

Owner: curriculum graph / game progression

Primary files:
- `packages/contracts/types.ts`
- `apps/server/src/curriculum-graph.mjs`
- `apps/client/app/graph/page.tsx`
- `apps/client/components/learn/LearnPanel.tsx`
- `apps/client/app/game/page.tsx`

## Why this spec exists

The product needs progression that feels:
- structured
- dynamic
- responsive to the learner
- meaningful over time
- reusable across future locations and languages

The next milestone is not "more map content." The next milestone is a trustworthy progression kernel that can drive the graph view, lessons, hangouts, and future mission flows from the same source of truth.

## Core learner questions

At any time, the product must answer:
1. What is my overall level in this language?
2. What have I already learned?
3. What is partially learned and still missing?
4. What unlocks next?
5. What should I do now: lesson, hangout, or mission?
6. Why am I blocked from the next step?

## Product principles

1. The learner sees one simple global level per language by default.
2. The curriculum graph remains the source of truth underneath.
3. Lessons build missing or weak skills.
4. Hangouts are dynamic validation runs and remain SP-gated.
5. Missions are explicit mastery gates for a location track.
6. Graph detail is available on demand, not forced as the default experience.
7. New locations and future AI-generated content must plug into the same model without replacing it.

## Product model

### 1. Global language progression

Each learner has a separate global progression state per language.

Example:
- Korean Level 1
- 62% to Level 2
- strongest area: script
- weakest area: pronunciation

This is the primary learner-facing level shown in dashboard, game header, and graph header.

Recommended term:
- `languageTier`

This is a product-level abstraction. It can later be mapped to external systems such as TOPIK, JLPT, HSK, or CEFR, but the product should not store those external exam bands as the core progression primitive.

### 2. Location tracks

Each city/location contributes a subgraph to that language.

Examples:
- `seoul / food_street`
- `seoul / cafe`
- `tokyo / food_street`
- `shanghai / practice_studio`

For the current milestone, a location should be treated as a track with:
- its authored nodes
- its hangout scenarios
- its mission gate

Future higher-difficulty variants can be added later, but they are not required for the first trustworthy progression milestone.

Recommended term:
- `locationTrack`

Future extension, not required immediately:
- `trackTier` or `packTier`

### 3. DAG node progression

Nodes remain the canonical progression engine.

Each node must surface:
- status: `locked`, `available`, `learning`, `due`, `validated`, `mastered`
- blockers
- evidence count
- mastery score
- recommended reason

This already exists at a node level in the current graph runtime.

### 4. Item-level progress inside nodes

Node-level status is not enough. The product must also know progress inside a node.

Example:
- node: `ko-script-consonants-basic`
- target items total: 14
- completed target items: 5
- remaining target items: 9

This is required so the UI and AI can truthfully say:
- "You know 5 out of 14 consonants."
- "Next lesson should drill the remaining consonants."
- "Hangout should avoid assuming menu reading is fully ready yet."

Recommended term:
- `targetProgress`

### 5. Session recommendations

The graph must always be able to produce:
- next lesson bundle
- next hangout bundle
- mission readiness
- next unlock path

These are the graph-derived actions the rest of the product consumes.

## Current implementation target

For the next milestone, the product should behave as follows:

### Dashboard / default progression view

Show:
- language tier
- progress to next tier
- next 1 to 3 unlocks
- recommended lesson
- hangout readiness
- mission gate status

Do not require the learner to inspect the raw graph to understand what to do next.

### Graph visualization

The graph view is the detail surface.

It must clearly show:
- learned nodes
- nodes in progress
- blocked nodes
- next unlock path
- mission-critical nodes
- overall level summary

When clicking a node, the learner must see:
- status
- blockers
- mastery score
- evidence count
- target progress
- exact remaining items
- what this node unlocks

### Lessons

Lessons must be graph-driven.

The lesson system should consume a graph lesson bundle and use it to:
- choose which node cluster to teach
- bias toward weak or remaining target items
- explain why the lesson is recommended
- record evidence against both node and item progress

### Hangouts

Hangouts remain:
- dynamic
- first-person
- SP-gated

But hangouts should only be offered when the graph says a learner is ready to validate something meaningful.

The hangout system should consume a graph hangout bundle and use it to:
- decide whether entry is allowed
- identify the objectives being validated
- bias scene language toward the learner's mastered and near-ready items
- avoid over-assuming knowledge that is still blocked or incomplete
- record validation evidence on completion

### Missions

Each location track should expose one explicit mission gate.

The mission should unlock only when required nodes are validated or mastered.

The mission should:
- test a defined objective cluster
- mark completion clearly
- contribute to global language progression
- unlock the next meaningful step in that track

The first implementation only needs one clear mission design for the Seoul Food Street path.

## Proposed runtime entities

### LanguageProgressSummary

Purpose:
- the learner-facing overview for one language

Fields:
- `learnerId`
- `lang`
- `languageTier`
- `progressToNextTier`
- `completedNodeCount`
- `activeNodeCount`
- `nextUnlockNodeIds`
- `strongestCategories`
- `weakestCategories`
- `recommendedAction`

### LocationTrackState

Purpose:
- the current state of one location's authored DAG

Fields:
- `cityId`
- `locationId`
- `lang`
- `status`
- `available`
- `activeNodeCount`
- `completedNodeCount`
- `missionGate`
- `lessonBundle`
- `hangoutBundle`

### NodeTargetProgress

Purpose:
- item-level progress inside a node

Fields:
- `nodeId`
- `totalTargetCount`
- `completedTargetCount`
- `remainingTargetIds`
- `weakTargetIds`
- `lastPracticedTargetIds`

### MissionGateStatus

Purpose:
- explicit gate state for the learner

Fields:
- `missionId`
- `ready`
- `requiredNodeIds`
- `completedRequiredNodeIds`
- `remainingRequiredNodeIds`
- `reason`

## Contract direction

The shared contract should be extended to support:
- language-level summary
- per-node target progress
- explicit next unlocks
- explicit mission gate status

Recommended additions in `packages/contracts/types.ts`:
- `LanguageProgressSummary`
- `NodeTargetProgress`
- `MissionGateStatus`

Recommended response updates:
- `GraphDashboardResponse` should include a language summary and per-node target progress
- `GraphLessonBundleResponse` should identify why the lesson is recommended
- `GraphHangoutBundleResponse` should identify readiness and validation intent

## Integration rules

### Graph page integration

`apps/client/app/graph/page.tsx` should render:
- global language tier header
- progress to next tier
- highlighted next unlock path
- node target progress in the detail panel
- mission gate panel

### Lesson integration

`apps/client/components/learn/LearnPanel.tsx` should:
- consume graph lesson bundle data
- receive target items still missing within the active node cluster
- record evidence at node and item granularity

### Hangout integration

`apps/client/app/game/page.tsx` should:
- fetch the graph-selected hangout bundle before a paid hangout starts
- enforce readiness checks before SP is spent
- bias NPC prompts and Tong hints to active objectives only
- record validation evidence back into the graph runtime

### Mission integration

The future mission flow should:
- read explicit gate readiness from the graph runtime
- use required node IDs from the pack contract
- write mission evidence back into the same graph layer

### Tool / agent integration

Agent-facing tools and APIs should return the same truth the UI sees:
- current tier
- next unlocks
- blockers
- recommended next session
- mission readiness

This keeps future agents aligned with the learner-facing product.

## Acceptance criteria

The milestone is complete when:
1. A learner can see their current language tier and progress to the next tier.
2. The graph page clearly highlights learned, in-progress, blocked, and next-unlock nodes.
3. A learner can inspect a node and see exactly what target items remain.
4. The recommended lesson always maps to graph-derived weak or newly available nodes.
5. A paid hangout only starts when the graph says there is enough readiness to validate something useful.
6. A mission shows explicit ready / not-ready state with remaining requirements.
7. The same evidence recorded from lessons and hangouts changes the graph state immediately.

## Sequencing

### Milestone 1: truthful progression kernel

- add item-level progress support
- add language-level summary
- add mission gate status
- expose next unlocks

### Milestone 2: graph-driven product behavior

- make lesson selection fully graph-driven
- make hangout entry and validation graph-driven
- show next unlock path in the graph UI

### Milestone 3: first explicit mission flow

- ship one Seoul Food Street mission gate and mission result flow
- make mission completion visibly change language progression and track state

### Milestone 4: content expansion

- author more locations
- add higher-difficulty track variants when needed
- add AI-generated overlays and review content on top of the same progression kernel

## Out of scope for this milestone

- full higher-tier location authoring across all cities
- exam-band calibration for TOPIK / JLPT / HSK
- replacing the current graph model with a separate progression system

## Summary

The system should be organized as:
- `languageTier` for the simple learner-facing level
- location tracks for authored DAGs, hangouts, and missions
- node and target progress for truthful readiness
- graph-derived lesson, hangout, and mission recommendations

That gives the product one progression engine that is structured, dynamic, responsive, and extensible to future locations, languages, and AI-assisted content.
