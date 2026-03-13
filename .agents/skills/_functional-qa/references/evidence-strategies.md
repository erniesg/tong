# Functional QA Evidence Strategies

Choose evidence from the issue class, then refine for the actual surface.

## Strategy glossary

- `screenshots`: still images of relevant UI states.
- `temporal-capture`: ordered screenshots, frame bursts, or video captures that show timing-sensitive behavior.
- `console-state-trace`: console logs and targeted state or branch traces correlated with user actions.
- `network-trace`: request and response timing, payloads, and transport behavior.
- `contract-assertions`: fixture checks, schema checks, or state assertions.
- `perf-profile`: timing, memory, CPU, or render-cost measurements.
- `cross-env-matrix`: the same repro executed across browsers, devices, or deployment targets.

## Minimum evidence by issue class

- `interaction-input` -> `temporal-capture`, `console-state-trace`, `screenshots`
- `visual-layout` -> `screenshots`
- `animation-transition` -> `temporal-capture`, `screenshots`
- `async-streaming-state` -> `temporal-capture`, `network-trace`, `console-state-trace`
- `data-contract-api` -> `contract-assertions`, `network-trace`
- `persistence-state-sync` -> `console-state-trace`, `contract-assertions`
- `performance-resource` -> `perf-profile`
- `compatibility-environment` -> `cross-env-matrix`

## Rules

1. Do not claim a UI bug is validated without visual evidence.
2. For timing-sensitive bugs, a single screenshot is not enough.
3. If a required evidence type is unavailable, lower confidence and explain the gap in `summary.md` and `publish.md`.
4. When a bug is ambiguous, escalate to `trace-ui-state` instead of guessing.
