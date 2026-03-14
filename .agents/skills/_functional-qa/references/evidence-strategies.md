# Functional QA Evidence Strategies

Choose evidence from the issue class, then refine for the actual surface.

## Strategy glossary

- `screenshots`: still images of relevant UI states.
- `temporal-capture`: ordered screenshots, frame bursts, or video captures that show timing-sensitive behavior.
- `cue-timestamps`: machine-readable event times that mark when the proof state appears in a recording.
- `console-state-trace`: console logs and targeted state or branch traces correlated with user actions.
- `network-trace`: request and response timing, payloads, and transport behavior.
- `contract-assertions`: fixture checks, schema checks, or state assertions.
- `perf-profile`: timing, memory, CPU, or render-cost measurements.
- `cross-env-matrix`: the same repro executed across browsers, devices, or deployment targets.

## Minimum evidence by issue class

- `interaction-input` -> `temporal-capture`, `cue-timestamps`, `console-state-trace`, `screenshots`
- `visual-layout` -> `screenshots`
- `animation-transition` -> `temporal-capture`, `cue-timestamps`, `screenshots`
- `async-streaming-state` -> `temporal-capture`, `cue-timestamps`, `network-trace`, `console-state-trace`
- `data-contract-api` -> `contract-assertions`, `network-trace`
- `persistence-state-sync` -> `console-state-trace`, `contract-assertions`
- `performance-resource` -> `perf-profile`
- `compatibility-environment` -> `cross-env-matrix`

## Rules

1. Do not claim a UI bug is validated without visual evidence.
2. For timing-sensitive bugs, a single screenshot is not enough.
3. If a required evidence type is unavailable, lower confidence and explain the gap in `summary.md` and `publish.md`.
4. When a bug is ambiguous, escalate to `trace-ui-state` instead of guessing.
5. When recording reviewer-facing video evidence, capture cue timestamps for the proof moment if the runtime can expose them, for example `token_tapped_at_ms`, `tooltip_opened_at_ms`, `dictionary_card_visible_at_ms`, or `audio_started_at_ms`.
6. Use cue timestamps to cut poster frames and GIF previews around the actual proof moment instead of around arbitrary early frames.
7. Prefer deterministic browser or app state cues first. Use video-understanding or OCR only as a fallback when the runtime cannot expose the needed timing or visibility signals directly.
