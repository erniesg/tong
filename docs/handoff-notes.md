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
- Current follow-up intent: preserve clean pushed `4ee1be2` before investigating owner-reported Tokyo floor flicker, empty/under-furnished shops and newly requested multi-storey apartments with bedrooms. Coordinator owns `main.js`/runtime integration and recovery; proposed separate seams are non-overlapping ground topology, room furnishings/staff metadata, and new vertical-building geometry. No implementation workers active yet. Existing three-pass playability review history and mirror/visual holds remain; obtain fresh scope/changed-strategy review before touching held product paths. Pilot one staffed shop and a genuinely stair-accessible furnished apartment before city-wide fan-out.
