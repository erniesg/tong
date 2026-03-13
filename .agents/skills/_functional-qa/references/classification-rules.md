# Functional QA Classification Rules

Use two axes for every run:

1. Primary issue class
2. Evidence strategy

Pick one primary issue class even if multiple concerns appear in the same issue. Record secondary signals in `classification.signals`.

## Primary issue classes

- `functional-logic`: incorrect business logic or state transitions without a narrower fit.
- `interaction-input`: taps, clicks, keyboard input, gestures, routing, or ignored user actions.
- `visual-layout`: layout, typography, spacing, clipping, overlap, or static visual regressions.
- `animation-transition`: flashes, flickers, broken fades, stale frames, or bad dismissal transitions.
- `async-streaming-state`: loading, streaming, race conditions, delayed UI updates, or "arrives all at once" bugs.
- `data-contract-api`: API shapes, fixtures, schemas, endpoint behavior, and request or response contract drift.
- `persistence-state-sync`: resume, restore, saved state, cache, or sync bugs across surfaces.
- `performance-resource`: slowdowns, lag, memory, CPU, or rendering cost regressions.
- `compatibility-environment`: device, browser, runtime, deployment, or environment-specific behavior.
- `auth-permissions`: login, permission, token, 401, 403, or role-gated behavior.
- `integration-third-party`: external systems such as YouTube, Spotify, OpenAI, GitHub, or Clerk.
- `accessibility`: keyboard navigation, focus, screen reader support, contrast, or target sizing.
- `localization-content`: translations, romanization, locale handling, copy quality, and language-specific rendering.
- `flaky-nondeterministic`: intermittent, random, timing-sensitive, or race-like behavior that resists single-pass repro.

## Classification process

1. Read the issue body and title.
2. Check the repo adapter issue notes for any surface-specific clarifications.
3. If the repo adapter provides an explicit issue-class override, use it.
4. Otherwise match keywords and behavior patterns.
5. Prefer the most actionable user-visible symptom over the deepest implementation detail.
6. Record why the chosen class is primary.

## Examples

- Wasted tap despite a visible continue affordance -> `interaction-input`
- Review overlay reveals stale frame during fade -> `animation-transition`
- Loading pulse then full message with fake typewriter -> `async-streaming-state`
- Fixture mismatch or endpoint payload drift -> `data-contract-api`
