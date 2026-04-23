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
