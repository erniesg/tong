# Functional QA Evidence Strategies

Choose evidence from the issue class, then refine for the actual surface.

## Strategy glossary

- `screenshots`: still images of relevant UI states.
- `comparison-panel`: a before/after side-by-side image showing the same UI state before and after the fix.
- `comparison-focus-crop`: a tighter before/after crop around the changed UI region for dense or text-heavy surfaces.
- `temporal-capture`: ordered screenshots, frame bursts, or video captures that show timing-sensitive behavior.
- `cue-timestamps`: machine-readable event times that mark when the proof state appears in a recording.
- `console-state-trace`: console logs and targeted state or branch traces correlated with user actions.
- `network-trace`: request and response timing, payloads, and transport behavior.
- `contract-assertions`: fixture checks, schema checks, or state assertions.
- `perf-profile`: timing, memory, CPU, or render-cost measurements.
- `cross-env-matrix`: the same repro executed across browsers, devices, or deployment targets.

## Minimum evidence by issue class

- `interaction-input` -> `temporal-capture`, `cue-timestamps`, `console-state-trace`, `screenshots`
- `visual-layout` -> `screenshots`, `comparison-panel`
- `animation-transition` -> `temporal-capture`, `cue-timestamps`, `screenshots`
- `async-streaming-state` -> `temporal-capture`, `cue-timestamps`, `network-trace`, `console-state-trace`
- `data-contract-api` -> `contract-assertions`, `network-trace`
- `persistence-state-sync` -> `console-state-trace`, `contract-assertions`
- `performance-resource` -> `perf-profile`
- `compatibility-environment` -> `cross-env-matrix`
- `localization-content` -> `screenshots`, `comparison-panel`, `comparison-focus-crop`

## Rules

1. Do not claim a UI bug is validated without visual evidence.
2. For timing-sensitive bugs, a single screenshot is not enough.
3. If a required evidence type is unavailable, lower confidence and explain the gap in `summary.md` and `publish.md`.
4. When a bug is ambiguous, escalate to `trace-ui-state` instead of guessing.
5. When recording reviewer-facing video evidence, capture cue timestamps for the proof moment if the runtime can expose them, for example `token_tapped_at_ms`, `tooltip_opened_at_ms`, `dictionary_card_visible_at_ms`, or `audio_started_at_ms`.
6. Use cue timestamps to cut poster frames and GIF previews around the actual proof moment instead of around arbitrary early frames.
7. Prefer deterministic browser or app state cues first. Use video-understanding or OCR only as a fallback when the runtime cannot expose the needed timing or visibility signals directly.
8. When the fix changes a reviewer-visible UI surface such as layout, typography, subtitles, translation copy, tooltip content, or focus styling, include a `comparison-panel` that shows the same state before and after the fix.
9. When the changed region is dense or easy to miss, for example subtitle plus translation text, dictionary popovers, HUD labels, or button copy, also include a `comparison-focus-crop` that isolates just the changed region.
10. If comparison assets are missing for a reviewer-visible UI fix, mark that gap explicitly in `summary.md` and `publish.md` instead of implying the evidence is reviewer-ready.
