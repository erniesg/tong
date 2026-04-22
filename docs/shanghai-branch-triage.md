# Shanghai Remote Branch Triage (2026-04-22)

Scope reviewed (remote only):
- `origin/codex/implement-secrets-for-shanghai-location-2z820q`
- `origin/codex/prepare-slice-for-#259-in-tong-xo44dd`
- `origin/codex/implement-panorama-mode-enhancements-1imziv`
- `origin/codex/define-and-mock-commerce-contract-5d3xxd`
- `origin/codex/add-shanghai-panorama-onboarding-data-pack-v1tryd`
- `origin/codex/add-panorama-capable-cinematic-presentation-mode-z2uv10`

Compared against:
- `origin/feat/shanghai-onboarding` (canonical Shanghai H1 base)
- `origin/feat/shanghai-p2-new-game-routing`
- `origin/main`

Method notes:
- All six candidate branches are descendants of `feat/shanghai-onboarding` and `feat/shanghai-p2-new-game-routing` (none are behind either base).
- Relative to `feat/shanghai-p2-new-game-routing`, each branch contributes only 1-4 unique commits.

## 1) Per-branch summaries

### `origin/codex/implement-secrets-for-shanghai-location-2z820q`
- **Short summary:** Expands the commerce mock contract into Shanghai secret-location + invitation token unlock flows.
- **Key touched files:**
  - `packages/contracts/types.ts`
  - `packages/contracts/api-contract.md`
  - `packages/contracts/fixtures/commerce.*.json` (adds invitation/status/flags fixtures)
  - `apps/worker/src/index.ts`
  - `docs/shanghai/ISSUE-256-reviewer-note.md`
- **Problem solved:** Enables mock API + schema coverage for secret unlock pathways needed for gated Shanghai progression.
- **Recommendation:** **KEEP (later integration)**, then **merge/cherry-pick after onboarding panorama flow stabilizes**.
- **Why:** Best branch in this set for commerce/secret-location contract completeness; supersedes the smaller commerce-only slice below.

### `origin/codex/prepare-slice-for-#259-in-tong-xo44dd`
- **Short summary:** Small routing hardening slice for Shanghai onboarding resume/entry intent plus placeholder art.
- **Key touched files:**
  - `apps/client/app/onboarding/shanghai/page.tsx`
  - `apps/client/lib/content/shanghai/fixtures/h1-webtoon.ts`
  - `apps/client/public/assets/webtoon/shanghai/h1/placeholder.svg`
- **Problem solved:** Prevents stale onboarding entry intent and adds safer fallback/placeholder behavior.
- **Recommendation:** **CHERRY-PICK selective fix** (entry-intent routing only) or **CLOSE** if panorama branch already replaces this path.
- **Superseded by (if closing):** `origin/codex/implement-panorama-mode-enhancements-1imziv` for active onboarding direction.

### `origin/codex/implement-panorama-mode-enhancements-1imziv`
- **Short summary:** Introduces panorama cold-open content pack + runtime/backstage support with draggable overlay fallback.
- **Key touched files:**
  - `apps/client/components/scene/CinematicOverlay.tsx`
  - `apps/client/components/scene/SceneView.tsx`
  - `apps/client/app/backstage/panorama-runtime/page.tsx`
  - `apps/client/lib/content/shanghai/panorama/cold-open.ts`
  - `apps/client/lib/content/shanghai/panorama/index.ts`
  - `docs/shanghai/panorama-content-pack.md`
- **Problem solved:** Establishes the core panorama-capable scene runtime + content data model needed for right-edge-first onboarding.
- **Recommendation:** **KEEP + MERGE FIRST** (primary continuation branch).
- **Why:** This is the strongest base for the target player flow (Tong-guided panoramic onboarding, reveal behaviors, and tap-driven scene interactions).

### `origin/codex/define-and-mock-commerce-contract-5d3xxd`
- **Short summary:** Initial commerce contract mock and worker route slice.
- **Key touched files:**
  - `packages/contracts/api-contract.md`
  - `packages/contracts/fixtures/commerce.entitlements.sample.json`
  - `packages/contracts/fixtures/commerce.purchase-event.sample.json`
  - `packages/contracts/fixtures/commerce.unlock-grant.sample.json`
  - `apps/worker/src/index.ts`
- **Problem solved:** Provides baseline purchase/entitlement mock contract.
- **Recommendation:** **CLOSE**.
- **Superseded by:** `origin/codex/implement-secrets-for-shanghai-location-2z820q`.

### `origin/codex/add-shanghai-panorama-onboarding-data-pack-v1tryd`
- **Short summary:** Adds initial panorama cold-open content config + doc.
- **Key touched files:**
  - `apps/client/lib/content/shanghai/panorama-cold-open.ts`
  - `docs/shanghai/panorama-content-pack.md`
- **Problem solved:** Seeds data definition for Shanghai panorama onboarding.
- **Recommendation:** **CLOSE**.
- **Superseded by:** `origin/codex/implement-panorama-mode-enhancements-1imziv` (same objective, expanded + reorganized content/runtime integration).

### `origin/codex/add-panorama-capable-cinematic-presentation-mode-z2uv10`
- **Short summary:** Adds panorama-capable cinematic runtime mode and backstage harness (runtime-side only).
- **Key touched files:**
  - `apps/client/components/scene/CinematicOverlay.tsx`
  - `apps/client/components/scene/SceneView.tsx`
  - `apps/client/app/backstage/panorama-runtime/page.tsx`
  - `apps/client/app/globals.css`
  - `apps/client/lib/types/hangout.ts`
- **Problem solved:** Introduces rendering/runtime primitives for panoramic presentation.
- **Recommendation:** **CHERRY-PICK selectively** into `implement-panorama-mode-enhancements-1imziv` only if specific CSS/type adjustments are still needed; otherwise **CLOSE**.
- **Superseded by (if closing):** `origin/codex/implement-panorama-mode-enhancements-1imziv`.

## 2) Overlap / duplication analysis

### Commerce overlap
- `define-and-mock-commerce-contract-5d3xxd` and `implement-secrets-for-shanghai-location-2z820q` overlap heavily in:
  - `apps/worker/src/index.ts`
  - `packages/contracts/api-contract.md`
  - shared commerce fixtures.
- The **secrets branch is the broader successor** (adds invitation + secret-location status fixtures/types and coherence fixes).

### Panorama overlap
- `add-panorama-capable-cinematic-presentation-mode-z2uv10` and `implement-panorama-mode-enhancements-1imziv` overlap in core runtime files:
  - `CinematicOverlay.tsx`, `SceneView.tsx`, `backstage/panorama-runtime/page.tsx`.
- `add-shanghai-panorama-onboarding-data-pack-v1tryd` overlaps objective-wise with `implement-panorama-mode-enhancements-1imziv` and is effectively an earlier, narrower data-pack slice.
- `implement-panorama-mode-enhancements-1imziv` is the best combined runtime+content path and should be the consolidation target.

### Minimal-overlap branch
- `prepare-slice-for-#259-in-tong-xo44dd` is mostly isolated (onboarding page intent/fallback). Useful only as a tactical cherry-pick if that bug remains.

## 3) Recommended action matrix

| Branch | Action | Superseded by | Notes |
|---|---|---|---|
| `codex/implement-panorama-mode-enhancements-1imziv` | **KEEP + MERGE FIRST** | — | **Best branch for continued implementation** toward panoramic onboarding target flow. |
| `codex/add-panorama-capable-cinematic-presentation-mode-z2uv10` | CHERRY-PICK or CLOSE | `codex/implement-panorama-mode-enhancements-1imziv` | Runtime-only slice; likely absorbed by enhancements branch. |
| `codex/add-shanghai-panorama-onboarding-data-pack-v1tryd` | **CLOSE** | `codex/implement-panorama-mode-enhancements-1imziv` | Data-pack precursor, now redundant. |
| `codex/prepare-slice-for-#259-in-tong-xo44dd` | CHERRY-PICK selective fix or CLOSE | `codex/implement-panorama-mode-enhancements-1imziv` | Keep only if onboarding entry-intent regression still repros. |
| `codex/implement-secrets-for-shanghai-location-2z820q` | **KEEP (defer merge order)** | — | Best commerce/secret unlock branch; integrate after panorama onboarding baseline lands. |
| `codex/define-and-mock-commerce-contract-5d3xxd` | **CLOSE** | `codex/implement-secrets-for-shanghai-location-2z820q` | Narrow predecessor of secrets branch. |

## 4) Explicit path forward (non-feature triage guidance)

- **Primary continuation branch (not a dead-end):**
  - `codex/implement-panorama-mode-enhancements-1imziv`
- **Secondary continuation branch (later gate/economy work):**
  - `codex/implement-secrets-for-shanghai-location-2z820q`
- **Dead-end / superseded slices to close once cherry-picks are extracted:**
  - `codex/define-and-mock-commerce-contract-5d3xxd`
  - `codex/add-shanghai-panorama-onboarding-data-pack-v1tryd`
  - `codex/add-panorama-capable-cinematic-presentation-mode-z2uv10` (unless targeted cherry-picks retained)
  - `codex/prepare-slice-for-#259-in-tong-xo44dd` (unless targeted onboarding intent fix retained)

This ordering best aligns with the desired player flow target:
1. Tong-guided right-edge-first panoramic onboarding,
2. delayed pan-left reveal,
3. tap-to-eavesdrop interaction,
4. then world-map auction entry.
