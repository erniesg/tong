# Shanghai branch triage (remote branches)

Date: 2026-04-22  
Reviewer: Codex

## Scope & comparison bases

Reviewed branches:
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

All six reviewed branches are rooted on top of `feat/shanghai-p2-new-game-routing` and each adds one or more incremental commits beyond that baseline.

---

## 1) Per-branch summary, key files, and solved problem

### A) `origin/codex/implement-secrets-for-shanghai-location-2z820q`
**Short summary**
- Extends Shanghai commerce mock contracts beyond basic unlock grants into invitation-token and secret-location status flows; includes coherence fixes and docs note.

**Key touched files**
- `packages/contracts/types.ts`
- `packages/contracts/api-contract.md`
- `packages/contracts/fixtures/commerce.*.sample.json` (entitlements, purchase event, unlock grant, invitation redeem, secret-location status, unlock flags snapshot)
- `apps/worker/src/index.ts`
- `docs/shanghai/ISSUE-256-reviewer-note.md`

**Problem it solves**
- Establishes a fuller mock contract surface for Shanghai secret-location unlock sequencing (including invitation-token source and status checks), not just one-time purchase grants.

**Recommendation**
- **Keep (primary commerce branch)** for continued implementation in the Shanghai unlock track.
- If not merged as-is, **cherry-pick** its commerce commits into the eventual integration branch.

---

### B) `origin/codex/prepare-slice-for-#259-in-tong-xo44dd`
**Short summary**
- Small stabilization slice for onboarding entry intent + resume behavior; adds placeholder visual asset and minor fixture tweaks.

**Key touched files**
- `apps/client/app/onboarding/shanghai/page.tsx`
- `apps/client/lib/content/shanghai/fixtures/h1-webtoon.ts`
- `apps/client/public/assets/webtoon/shanghai/h1/placeholder.svg`

**Problem it solves**
- Reduces stale onboarding entry-state behavior and hardens fallback content while onboarding media remains partial.

**Recommendation**
- **Cherry-pick** selective fixes (entry intent/resume hardening) into the active Shanghai implementation branch.
- Do **not** treat this as a long-lived feature branch; it is a narrow patch slice.

---

### C) `origin/codex/implement-panorama-mode-enhancements-1imziv`
**Short summary**
- Adds panorama runtime enhancements plus a structured Shanghai panorama cold-open content pack; introduces drag/fallback panorama behavior and a backstage harness.

**Key touched files**
- `apps/client/components/scene/CinematicOverlay.tsx`
- `apps/client/components/scene/SceneView.tsx`
- `apps/client/app/backstage/panorama-runtime/page.tsx`
- `apps/client/lib/content/shanghai/panorama/cold-open.ts`
- `apps/client/lib/content/shanghai/panorama/index.ts`
- `docs/shanghai/panorama-content-pack.md`

**Problem it solves**
- Provides the strongest foundation for panoramic onboarding runtime + authored Shanghai cold-open data required for the target flow.

**Recommendation**
- **Keep (best branch for continued Shanghai panoramic implementation).**
- Preferred branch to carry forward for the right-edge-first onboarding sequence and later pan/interaction orchestration.

---

### D) `origin/codex/define-and-mock-commerce-contract-5d3xxd`
**Short summary**
- Introduces baseline mock commerce contract + worker routes for unlock grants/events.

**Key touched files**
- `packages/contracts/api-contract.md`
- `packages/contracts/fixtures/commerce.entitlements.sample.json`
- `packages/contracts/fixtures/commerce.purchase-event.sample.json`
- `packages/contracts/fixtures/commerce.unlock-grant.sample.json`
- `apps/worker/src/index.ts`

**Problem it solves**
- Establishes initial commerce mock endpoints and schema artifacts for Shanghai unlock testing.

**Recommendation**
- **Close** as a superseded subset once `implement-secrets-for-shanghai-location-2z820q` is adopted.
- Superseded by: `origin/codex/implement-secrets-for-shanghai-location-2z820q`.

---

### E) `origin/codex/add-shanghai-panorama-onboarding-data-pack-v1tryd`
**Short summary**
- Data-pack-only slice for panorama cold-open config and documentation.

**Key touched files**
- `apps/client/lib/content/shanghai/panorama-cold-open.ts`
- `docs/shanghai/panorama-content-pack.md`

**Problem it solves**
- Seeds authored hotspot/callout/handoff content for Shanghai panoramic onboarding, but without full runtime integration.

**Recommendation**
- **Close** as superseded once panorama runtime branch is selected.
- Superseded by: `origin/codex/implement-panorama-mode-enhancements-1imziv` (includes data-pack concept and runtime wiring).

---

### F) `origin/codex/add-panorama-capable-cinematic-presentation-mode-z2uv10`
**Short summary**
- Adds cinematic panorama-capable presentation mode and backstage runtime harness.

**Key touched files**
- `apps/client/components/scene/CinematicOverlay.tsx`
- `apps/client/components/scene/SceneView.tsx`
- `apps/client/app/backstage/panorama-runtime/page.tsx`
- `apps/client/app/globals.css`
- `apps/client/lib/types/hangout.ts`

**Problem it solves**
- Introduces the initial runtime mechanics to display and pan panoramic content in the cinematic shell.

**Recommendation**
- **Close** as superseded.
- Superseded by: `origin/codex/implement-panorama-mode-enhancements-1imziv` (adds stronger runtime behavior plus Shanghai content-pack wiring).

---

## 2) Overlap / duplication analysis

## Commerce track overlap
- `define-and-mock-commerce-contract-5d3xxd` is a strict earlier subset of `implement-secrets-for-shanghai-location-2z820q`.
- The secrets branch contains the baseline contract additions plus follow-on coherence fixes and secret-location/invitation-token fixtures.

## Panorama track overlap
- `add-panorama-capable-cinematic-presentation-mode-z2uv10` and `add-shanghai-panorama-onboarding-data-pack-v1tryd` split runtime and data-pack concerns separately.
- `implement-panorama-mode-enhancements-1imziv` effectively combines and advances both concerns in one branch (runtime + content pack + docs), making the two earlier branches duplicative/dead-end slices.

## Onboarding polish slice overlap
- `prepare-slice-for-#259-in-tong-xo44dd` is largely orthogonal to commerce and panorama contract work; it is a small UX/state hardening patch and not a competing architecture branch.

---

## 3) Keep / merge / cherry-pick / close recommendations

| Branch | Decision | Why |
|---|---|---|
| `origin/codex/implement-panorama-mode-enhancements-1imziv` | **KEEP** | Best candidate for continued Shanghai panoramic onboarding implementation. |
| `origin/codex/implement-secrets-for-shanghai-location-2z820q` | **KEEP** | Most complete commerce/secret-location contract slice; supersedes baseline contract mock branch. |
| `origin/codex/prepare-slice-for-#259-in-tong-xo44dd` | **CHERRY-PICK** | Keep only targeted onboarding entry/resume fixes; not a long-lived branch. |
| `origin/codex/define-and-mock-commerce-contract-5d3xxd` | **CLOSE** | Superseded by `origin/codex/implement-secrets-for-shanghai-location-2z820q`. |
| `origin/codex/add-shanghai-panorama-onboarding-data-pack-v1tryd` | **CLOSE** | Superseded by `origin/codex/implement-panorama-mode-enhancements-1imziv`. |
| `origin/codex/add-panorama-capable-cinematic-presentation-mode-z2uv10` | **CLOSE** | Superseded by `origin/codex/implement-panorama-mode-enhancements-1imziv`. |

---

## 4) Supersession map for branches to close

- `origin/codex/define-and-mock-commerce-contract-5d3xxd` → superseded by `origin/codex/implement-secrets-for-shanghai-location-2z820q`
- `origin/codex/add-shanghai-panorama-onboarding-data-pack-v1tryd` → superseded by `origin/codex/implement-panorama-mode-enhancements-1imziv`
- `origin/codex/add-panorama-capable-cinematic-presentation-mode-z2uv10` → superseded by `origin/codex/implement-panorama-mode-enhancements-1imziv`

---

## 5) Explicit call: best continuation branch vs dead-end slices

**Best branch for continued implementation (panoramic player-flow target):**
- `origin/codex/implement-panorama-mode-enhancements-1imziv`

Reasoning:
- It is the only reviewed branch that ships both panorama runtime behavior and Shanghai-specific panorama cold-open authored data in one place, making it the most direct foundation for:
  1. Tong-guided right-edge-first panoramic onboarding
  2. Later pan-left reveal
  3. Tap-to-eavesdrop timing windows
  4. Handoff toward world-map auction entry

**Dead-end / superseded slices:**
- `origin/codex/add-panorama-capable-cinematic-presentation-mode-z2uv10` (runtime-only precursor)
- `origin/codex/add-shanghai-panorama-onboarding-data-pack-v1tryd` (data-pack-only precursor)
- `origin/codex/define-and-mock-commerce-contract-5d3xxd` (commerce baseline precursor)

`origin/codex/prepare-slice-for-#259-in-tong-xo44dd` remains useful only as a selective cherry-pick source for onboarding-state hardening.
