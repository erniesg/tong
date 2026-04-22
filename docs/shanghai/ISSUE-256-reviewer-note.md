# Issue #256 (partial) reviewer note

Scope in this patch is contract + deterministic fixtures only (no UI/runtime scene changes).

## What was added
- Secret Shanghai location contract shape for `night_market_rooftop` with reveal-state progression and entitlement-backed unlock flags.
- Invitation-token redemption response fixture aligned to commerce unlock vocabulary (`unlockKey`, `productKey`, `entitlementId`, `source`).
- Unlock-flag snapshot fixture for deterministic reviewer assertions.

## Intentional non-goals
- No client scene/onboarding updates.
- No panorama runtime edits.
- No live persistence behavior; fixture-backed API contracts remain deterministic.
