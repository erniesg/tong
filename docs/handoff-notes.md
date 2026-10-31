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
- Current follow-up checkpoint: product `d3efee8` extends the passed `15b4c88` Tokyo staffed-cafe/three-storey pilot to remaining generic rooms and one apartment per city. Real native geometry/approach/stair-route CPU checks pass across all cities; new-city browser checks and exact integrated review are being reconciled. All four writers returned ownership; 51 deterministic checks and actual cafe + 72-waypoint apartment control/interaction/descent/save-API pilots passed at diagnostic DPR .35, not native/reload/full acceptance.
- Continuation: complete the already approved staged strategy (remaining generic shops + one validated apartment plot per city), then the ONE remaining final technical review4. Existing three consumed playability passes, old city-build history, failed mirror capture and other holds are unchanged. No fourth pass has run yet; no fifth authorised. No merge/deployment.
- Operational handoff: same-native runtime checkpoint released; original staged attempt resumed without replaying successful pilots or resetting histories, not cancellation or product reprioritisation. Trusted-VM scratch `tong-cozy-occupied-world/checkpoint.md` owns precise next actions, actual QA/report paths and retained 8420/current + 8422/frozen-baseline listeners. No worker/browser/pilot process remains; keep source and evidence, do not replay completed effects on rejoin.
