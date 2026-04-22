# Issue #256 (partial) — Reviewer note

This partial update only covers contract + fixture definitions for the Shanghai secret-location commerce flow.

Included:
- Secret location concept payload (`shanghai.secret.riverside_speakeasy`) with discovery/reveal states.
- Invitation-token redemption shape using commerce-aligned terminology (`productKey`, `unlockKey`, `grantSource`, `entitlement`).
- Deterministic unlock-flag snapshot payloads before and after redemption.

Out of scope in this change:
- UI wiring, onboarding scene behavior, or panorama runtime changes.
- Stateful worker mutation logic beyond existing fixture-backed deterministic responses.
