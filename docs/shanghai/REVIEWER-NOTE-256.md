# Issue #256 (partial) — Reviewer note

Scope in this slice is contract + fixture only (no UI/runtime wiring).

## What is defined
- Secret Shanghai location concept: **Archive Alley** with deterministic reveal state progression (`hidden` → `teased` → `revealed` → `entered`).
- Invitation-token redemption response aligned to commerce unlock vocabulary (`unlockKey`, `grantSource`, `idempotencyKey`, `entitlement`).
- Unlock-flag snapshots in both status and redemption fixtures so reviewers can verify before/after state deterministically.

## Deterministic fixtures
- `packages/contracts/fixtures/shanghai.secret-location.status.sample.json`
- `packages/contracts/fixtures/shanghai.secret-location.redeem.sample.json`

## Out of scope in this partial
- No scene, onboarding, or panorama runtime edits.
- No mutation-persistent redemption flow in server runtime.
