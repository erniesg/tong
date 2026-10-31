# Integration Notes

Use this file for short, current coordination notes only.
Keep entries focused on active integration risks instead of dated work logs.

Template:
- Area:
- Scope:
- Contract touch points:
- Integration risks:
- Next owner:

Current note:
- Area: Shanghai onboarding and webtoon runtime
- Scope: Scene rendering, onboarding flow, and adjacent shared contracts
- Contract touch points: `packages/contracts/**`, `apps/client/app/globals.css`, `apps/client/components/scene/**`, `apps/client/lib/content/shanghai/**`
- Integration risks: shared scene files and contract fixtures can drift if edited in parallel
- Next owner: whoever takes the next cross-stream integration pass

Current note:
- Area: Discord human-review routing
- Scope: Queue orchestration notifications and Discord interaction callbacks for `route-human`
- Contract touch points: `.github/workflows/issue-queue-orchestrator.yml`, `.agents/skills/_functional-qa/scripts/**`, `apps/worker/src/index.ts`, worker secrets/env wiring
- Integration risks: worker callback route and GitHub dispatch token handling need one owner while the Discord path is landing
- Next owner: infra-deploy / qa-platform integration pass

- Area: Remote orchestration deploy promotion
- Scope: GitHub deploy workflows, Cloudflare client deploy script, Discord route-human wiring, and the shared `package.json` script entry
- Contract touch points: `.github/workflows/**`, `scripts/deploy-client-cloudflare.sh`, `apps/worker/src/index.ts`, `package.json`, `docs/deployment-track.md`
- Integration risks: `package.json` and workflow entrypoints should not drift from the provider-neutral queue control plane landing in `#293`
- Next owner: infra-deploy until the promotion workflow PR lands

- Area: Cozy playability and responsive cutaway-world integration
- Scope: demo travel; camera/zoom; jump, run and rideable transport; usable city interiors; tree/cat/sign polish; orientation-safe typography and controls
- Contract touch points: `apps/client/public/cozy/**`; all four implementation lanes finished, coordinator now owns integration. Runtime/UI/interior/nature interfaces are integrated; preserve existing saves/story and pushed recovery point `38e0f0d`.
- Integration risks: PR #363 remains draft. Mirror appearance, integrated responsive visual comparison, comprehensive location/story/native checks and unclassified browser timeouts remain held; source/CPU checks are not universal gameplay acceptance. Current details and evidence belong in the PR, not this note.
- Retained resources: feature worktree/remote branch `feat/cozy-pojangmacha-3d`; loopback preview 8420 serves its public directory through the scratch `preview-current` symlink. QA bundles and failed histories are under `artifacts/qa-runs/` and bounded scratch `tong-cozy-playability`/`tong-cozy-preview`; baseline snapshot retained for comparison. No test browser or implementation worker remains active. Preexisting workerd processes are not owned by this pass.
- Next owner: cozy feature-branch coordinator/PR reviewer; revisit retained resources when acceptance or abandonment is decided. No main merge or deployment authority.
- Current follow-up checkpoint: product `d3efee8` extended the passed `15b4c88` Tokyo pilot to remaining generic rooms/staff and one three-storey apartment per city, preserving authored Seoul cast/rooms. All54 actual Three/source-geometry checks and new Seoul/Shanghai doorway/staff +45 physical apartment-route/return waypoints per city (90 total) passed. Earlier Tokyo cafe +72-waypoint/two-upper-home journey remains genuine historical evidence, not replayed or upgraded to native/reload acceptance.
- Review/repair: integrated `149ecc7` review4 completed **NOT APPROVED** (missing ride-selector binding; stock inside opaque shelving). Product `03cf8ea` repairs these and a causally reproduced lower-body partition cutaway defect.57 configured CPU checks pass; actual UI/model/movement for all3 rides and store doorway/stock checks pass. New apartment angle/restoration views are explicitly diagnostic body/Y/camera setups, not new stair/reload proof. A first restoration-only driver timeout came from attempting to close already-hidden Tools; corrected actual Overview/material/camera settlement passed, with failed logs retained.
- Continuation: fresh independent outcome authority checkpoint reconciled obsolete default3+1 guidance with the current developer no-default-lifetime-cap instruction; no finite owner ceiling found, no reset/renewed counts or retrospective enlargement of old approval. All actual reviews1–4 and old city-build/failed histories remain; openly numbered review5 now assesses real repairs/affected contracts. Review5 narrowly approved the selector/stock/partition source repairs, retaining translucent apartment views and a P3 waypoint-count wording error (corrected to45 per city/90 total). Full acceptance remains incomplete. Product `9a4d22e` removes settled stacked-home ghost planes/shadows after a positive same-pose causal visual probe; actual source57 checks and normal jump/landing + diagnostic room/opposite/exterior checks pass. First opposite view remains visually inconclusive; a separate all-hidden/extra-render-progress view is clear, not a replacement for its retained image. Review6 now assesses that real visibility delta; no old pilot, mirror/reload/native replay, merge/deployment or publication authority.
- Operational handoff: same-native runtime checkpoint released; original staged attempt resumed without replaying successful pilots or resetting histories, not cancellation or product reprioritisation. Trusted-VM scratch `tong-cozy-occupied-world/checkpoint.md` owns precise next actions, actual QA/report paths and retained 8420/current + 8422/frozen-baseline listeners. No worker/browser/pilot process remains; keep source and evidence, do not replay completed effects on rejoin.
