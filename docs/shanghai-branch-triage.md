# Shanghai Remote Branch Triage (2026-04-22)

Canonical H1 base for triage: `origin/feat/shanghai-onboarding`.

Comparison branches used:
- `origin/feat/shanghai-onboarding`
- `origin/feat/shanghai-p2-new-game-routing`
- `origin/main`

Target player flow used for triage decisions:
1. Tong-guided right-edge-first panoramic onboarding
2. Later pan-left reveal
3. Tap-to-eavesdrop
4. World-map auction entry handoff

---

## 1) Branch-by-branch triage

## `origin/codex/implement-secrets-for-shanghai-location-2z820q`
**Short summary**
- Commerce contract expansion for Shanghai secret-location unlocks, including invitation token flows, richer fixtures, worker mock routes, and ID coherence fixes.

**Key touched files (unique vs `origin/feat/shanghai-p2-new-game-routing`)**
- `apps/worker/src/index.ts`
- `packages/contracts/types.ts`
- `packages/contracts/api-contract.md`
- `packages/contracts/fixtures/commerce.*.sample.json` (entitlements, purchase event, unlock grant, invitation redeem, secret-location status, unlock flags snapshot)
- `docs/shanghai/ISSUE-256-reviewer-note.md`

**Problem solved**
- Defines and exercises the mock contract surface needed for Shanghai secret-location/commerce unlock gating.

**Fit to target flow**
- Indirect but important for the final "world-map auction entry" gating and unlock path.
- Not a panorama UX branch; primarily contracts/mocks.

**Recommendation**
- **Cherry-pick into the active Shanghai implementation line** (or merge if policy prefers full history).
- **Status:** keep.
- **Best use:** foundational backend/mock contract layer.

---

## `origin/codex/prepare-slice-for-#259-in-tong-xo44dd`
**Short summary**
- Small H1 onboarding hardening slice: resume behavior improvements, entry-intent carry-through (`cover`/`panorama`), and placeholder art handling to avoid missing assets.

**Key touched files (unique vs `origin/feat/shanghai-p2-new-game-routing`)**
- `apps/client/app/onboarding/shanghai/page.tsx`
- `apps/client/lib/content/shanghai/fixtures/h1-webtoon.ts`
- `apps/client/public/assets/webtoon/shanghai/h1/placeholder.svg`

**Problem solved**
- Fixes stale onboarding entry intent and stabilizes onboarding while later panels are still placeholder-backed.

**Fit to target flow**
- Helpful glue for handoff continuity to map entry, but does not implement panoramic right-edge-first/pan-left interaction model itself.

**Recommendation**
- **Cherry-pick** the two onboarding-related commits as a polish slice on top of the chosen panorama line.
- **Status:** keep as a utility slice, not as the primary branch.

---

## `origin/codex/implement-panorama-mode-enhancements-1imziv`
**Short summary**
- Most complete panorama package among candidates: runtime panorama mode enhancements, draggable overlay behavior, backstage runtime harness, and Shanghai cold-open content pack fixture/docs.

**Key touched files (unique vs `origin/feat/shanghai-p2-new-game-routing`)**
- `apps/client/components/scene/CinematicOverlay.tsx`
- `apps/client/components/scene/SceneView.tsx`
- `apps/client/app/backstage/panorama-runtime/page.tsx`
- `apps/client/lib/content/shanghai/panorama/cold-open.ts`
- `apps/client/lib/content/shanghai/panorama/index.ts`
- `docs/shanghai/panorama-content-pack.md`

**Problem solved**
- Adds the panorama-capable runtime path plus concrete Shanghai cold-open fixture data for hotspot/timing/callout handoff.

**Fit to target flow**
- **Best branch for continued implementation** of panoramic onboarding.
- Already includes tap-able hotspot windows and scripted Tong callout cadence.
- Still needs explicit right-edge-first camera initialization + deterministic later pan-left reveal behavior finalized against product target.

**Recommendation**
- **Keep and continue implementation from this branch**.
- **Status:** primary continuation branch.

---

## `origin/codex/define-and-mock-commerce-contract-5d3xxd`
**Short summary**
- Initial commerce mock contract slice: core types/docs/fixtures + worker routes.

**Key touched files (unique vs `origin/feat/shanghai-p2-new-game-routing`)**
- `apps/worker/src/index.ts`
- `packages/contracts/api-contract.md`
- `packages/contracts/fixtures/commerce.entitlements.sample.json`
- `packages/contracts/fixtures/commerce.purchase-event.sample.json`
- `packages/contracts/fixtures/commerce.unlock-grant.sample.json`

**Problem solved**
- Provides baseline commerce API mocks for unlock and entitlement flows.

**Fit to target flow**
- Supporting infrastructure only.

**Recommendation**
- **Close** in favor of `origin/codex/implement-secrets-for-shanghai-location-2z820q` (superset with additional Shanghai secret-location coverage and follow-up fixes).

---

## `origin/codex/add-shanghai-panorama-onboarding-data-pack-v1tryd`
**Short summary**
- Adds a standalone panorama cold-open data pack and documentation.

**Key touched files (unique vs `origin/feat/shanghai-p2-new-game-routing`)**
- `apps/client/lib/content/shanghai/panorama-cold-open.ts`
- `docs/shanghai/panorama-content-pack.md`

**Problem solved**
- Introduces authored fixture config for Shanghai panorama cold-open timing/callouts/hotspots.

**Fit to target flow**
- Useful content definition but isolated; no integrated runtime improvements in this branch.

**Recommendation**
- **Close** in favor of `origin/codex/implement-panorama-mode-enhancements-1imziv` (superset that includes panorama runtime + content-pack equivalent).

---

## `origin/codex/add-panorama-capable-cinematic-presentation-mode-z2uv10`
**Short summary**
- Adds panorama-capable cinematic presentation mode, scene wiring, and backstage page.

**Key touched files (unique vs `origin/feat/shanghai-p2-new-game-routing`)**
- `apps/client/components/scene/CinematicOverlay.tsx`
- `apps/client/components/scene/SceneView.tsx`
- `apps/client/lib/types/hangout.ts`
- `apps/client/app/backstage/panorama-runtime/page.tsx`
- `apps/client/app/globals.css`

**Problem solved**
- Establishes a generic panoramic cinematic mode with runtime harnessing.

**Fit to target flow**
- Strong runtime base, but missing the richer integrated Shanghai cold-open fixture shape present in later branch.

**Recommendation**
- **Close** in favor of `origin/codex/implement-panorama-mode-enhancements-1imziv` (later and broader panorama slice).

---

## 2) Overlap and duplication analysis

## High-overlap clusters

### Panorama cluster (duplication)
- `origin/codex/add-panorama-capable-cinematic-presentation-mode-z2uv10`
- `origin/codex/add-shanghai-panorama-onboarding-data-pack-v1tryd`
- `origin/codex/implement-panorama-mode-enhancements-1imziv`

`...-1imziv` is effectively the converged superset branch:
- It contains cinematic panorama runtime work similar to `...-z2uv10`.
- It contains Shanghai cold-open data-pack work similar to `...-v1tryd`.
- It also includes additional fallback/runtime handling and dedicated panorama content module structure.

### Commerce cluster (duplication)
- `origin/codex/define-and-mock-commerce-contract-5d3xxd`
- `origin/codex/implement-secrets-for-shanghai-location-2z820q`

`...-2z820q` supersedes `...-5d3xxd` by adding:
- Shanghai invitation-redeem + secret-location status fixtures
- Unlock flag snapshot fixture
- Contract/type adjustments and mock ID coherence fixes

### Onboarding hardening side-slice (partial overlap, not duplicate)
- `origin/codex/prepare-slice-for-#259-in-tong-xo44dd`

This is not a full duplicate of panorama or commerce work; it is a small compatibility/hardening slice that can be selectively cherry-picked.

---

## 3) Recommended action matrix

| Branch | Action | Why |
|---|---|---|
| `origin/codex/implement-secrets-for-shanghai-location-2z820q` | **Cherry-pick / keep** | Best Shanghai commerce/secret unlock contract superset. |
| `origin/codex/prepare-slice-for-#259-in-tong-xo44dd` | **Cherry-pick / keep utility** | Useful onboarding resume and entry-intent hardening, but not a primary implementation lane. |
| `origin/codex/implement-panorama-mode-enhancements-1imziv` | **Keep (primary continuation)** | Best base for continuing target panoramic onboarding flow. |
| `origin/codex/define-and-mock-commerce-contract-5d3xxd` | **Close** | Superseded by `origin/codex/implement-secrets-for-shanghai-location-2z820q`. |
| `origin/codex/add-shanghai-panorama-onboarding-data-pack-v1tryd` | **Close** | Superseded by `origin/codex/implement-panorama-mode-enhancements-1imziv`. |
| `origin/codex/add-panorama-capable-cinematic-presentation-mode-z2uv10` | **Close** | Superseded by `origin/codex/implement-panorama-mode-enhancements-1imziv`. |

---

## 4) Explicit continuation vs dead-end guidance

## Best for continued implementation
- **Primary:** `origin/codex/implement-panorama-mode-enhancements-1imziv`
  - Continue here to align runtime behavior with the explicit target sequence (right-edge-first start, controlled later pan-left reveal, tap-to-eavesdrop, then map auction entry).
- **Secondary support:** contract/mocks from `origin/codex/implement-secrets-for-shanghai-location-2z820q`.
- **Optional polish picks:** onboarding intent/resume fixes from `origin/codex/prepare-slice-for-#259-in-tong-xo44dd`.

## Dead-end slices (close after extracting anything needed)
- `origin/codex/define-and-mock-commerce-contract-5d3xxd`
- `origin/codex/add-shanghai-panorama-onboarding-data-pack-v1tryd`
- `origin/codex/add-panorama-capable-cinematic-presentation-mode-z2uv10`

These are narrower predecessor slices now covered by broader branches.
