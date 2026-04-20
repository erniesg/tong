# GitHub Agent Bootstrap

Issue `#239` is the canonical GitHub-side bootstrap contract for Tong's autonomous-agent rollout.
Issues `#240`-`#243` should reference this document instead of restating setup assumptions.

This document defines the control plane only:

1. GitHub environments
2. secrets and variables
3. workflow permissions
4. branch protection and approval boundaries
5. protected-path policy
6. subscription-vs-API-key boundary

It does not implement the orchestrator itself.

## Credential model

| Mode | Where it runs | Credential source | Allowed use | Not allowed |
| --- | --- | --- | --- | --- |
| Interactive/manual agent use | Local Codex, Codex cloud task UI, Claude desktop/web, maintainer terminal | Personal Codex or Claude subscription, maintainer-local auth, maintainer-local API keys | Exploration, validation, supervised code changes, drafting PRs | Unattended GitHub Actions or any automation that depends on a maintainer being logged in |
| Unattended GitHub automation | GitHub Actions, trusted publish jobs, headless PR jobs | GitHub Actions secrets and variables such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `CLOUDFLARE_API_TOKEN` | Issue/PR automation, trusted publish, repo-visible proposal generation | Using a maintainer's personal subscription session, browser cookies, or laptop-local auth state |

Rules:

1. Personal Codex or Claude subscriptions are for interactive/manual use only.
2. Unattended GitHub Actions must use API keys or scoped service credentials stored in GitHub secrets.
3. Never place personal browser cookies, local session exports, or laptop-only auth state into GitHub secrets.
4. Production merge and production promotion remain human-gated even when unattended automation prepares the branch or evidence.

## Minimum GitHub Project contract

The minimum queue contract for unattended routing is the field set in [agent-native-project-setup.md](agent-native-project-setup.md):

1. `Workflow Status`
2. `Priority`
3. `Type`
4. `Initiative`
5. `Lane`
6. `Execution Mode`
7. `Portable Context`
8. `Proof Required`
9. `Scenario Seed`
10. `Checkpoint Needed`
11. `Remote Dependencies`
12. `Agent Ready`
13. `Blocked By`

`#239` is the prerequisite that makes these fields operational for `#240`-`#243`.
If an issue does not carry this minimum metadata, unattended routing is not ready.

## Required GitHub environments

Create these GitHub environments now:

| Environment | Purpose | Reviewer rule | Notes |
| --- | --- | --- | --- |
| `staging` | Preview deploys, rehearsal publish steps, non-production automation that needs an environment boundary | No required reviewer by default | Use `tong-stg.berlayar.ai` as the shared staging app hostname when deploy flows are added |
| `production` | Live deploy or promotion jobs | Require at least 1 human reviewer | Keep `tong.berlayar.ai` as the production app hostname. Start with `@erniesg` as a required reviewer if no maintainer team exists yet. Do not count bots or service accounts as reviewers |

Rules:

1. Any workflow that can promote or deploy live traffic must target `environment: production`.
2. `production` must always require human review before the job starts.
3. `staging` may run unattended, but it must never be treated as implicit approval for production.
4. The current checked-in control-plane workflows (`codex-headless-pr`, `codex-create-pr`, `qa-publish`) do not target `staging` or `production` because they prepare PRs or publish reviewer proof only. Environment-gated jobs start when deploy or promotion workflows are introduced.

## Required GitHub Actions secrets and variables

Store the unattended credential surface explicitly.

| Name | Scope | Kind | Required | Notes |
| --- | --- | --- | --- | --- |
| `OPENAI_API_KEY` | Repository | Secret | Yes | Required for unattended OpenAI-backed jobs such as `Codex Headless PR` |
| `ANTHROPIC_API_KEY` | Repository | Secret | Optional | Keep only if Claude-in-Actions remains supported. If not supported, remove the secret and disable that path |
| `CLOUDFLARE_API_TOKEN` | Repository | Secret | Yes | Required by the trusted QA publish/upload path today. When deploy workflows are added, use environment-scoped deploy tokens for `staging` and `production` jobs instead of widening repo-scope production credentials |
| `CLOUDFLARE_ACCOUNT_ID` | Repository | Variable | Yes | Required by trusted publish and Cloudflare-facing jobs |
| `TONG_RUNS_R2_BUCKET` | Repository | Variable | Yes | Reviewer-visible QA evidence bucket |
| `TONG_RUNS_PUBLIC_BASE_URL` | Repository | Variable | Yes | Public base URL for reviewer-visible QA evidence |
| `NEXT_PUBLIC_TONG_ASSETS_BASE_URL` | Repository | Variable | Yes | Public base URL for player-facing runtime assets |
| `TONG_ASSETS_R2_BUCKET` | Repository | Variable | Yes | Runtime asset bucket name |
| `TONG_RUNTIME_ASSET_MANIFEST_KEY` | Repository | Variable | Yes | Canonical runtime asset manifest key |
| `TONG_PLAYTEST_READ_API_TOKEN` | Repository | Secret | Conditional | Reserve this exact name if playtest orchestration needs non-public Worker or API reads. Keep it read-only and do not replace it with personal cookies or browser-session material |

Boundary rules:

1. `tong-assets` and `tong-runs` stay separate.
2. Runtime asset vars are not QA evidence vars.
3. Any secret that can mutate live production state belongs behind a human-gated environment before a production workflow consumes it.

## Workflow permission expectations

Keep GitHub Actions permissions narrow and capability-specific.

| Capability | Minimum permission | Current checked-in workflow surface |
| --- | --- | --- |
| Create commits, branches, or PRs | `contents: write`, `pull-requests: write` | `.github/workflows/codex-headless-pr.yml`, `.github/workflows/codex-create-pr.yml` |
| Comment on issues or PRs | `issues: write`, `pull-requests: write` | `.github/workflows/codex-create-pr.yml`, `.github/workflows/qa-publish.yml` |
| Dispatch another workflow | `actions: write` | `.github/workflows/codex-headless-pr.yml`, `.github/workflows/codex-create-pr.yml` |
| Read repo contents only | `contents: read`, `actions: read` | `.github/workflows/qa-publish.yml` |
| Update GitHub Project fields | `repository-projects: write` only when a workflow actually edits Project state | Not required by the checked-in workflows today |

Rules:

1. Do not grant `repository-projects: write` until a workflow actually performs Project mutations.
2. Do not broaden workflow permissions to compensate for missing operator setup.
3. Keep publish/comment workflows separate from merge/deploy approval.

## Branch protection defaults

Apply these defaults to `main` in GitHub branch protection:

1. Require a pull request before merging.
2. Require at least 1 approving review.
3. Require review from Code Owners.
4. Dismiss stale approvals when new commits are pushed.
5. Require conversation resolution before merge.
6. Block direct pushes, force pushes, and branch deletion.
7. Do not grant GitHub Actions or bot accounts an unconditional bypass on protected-branch review requirements.
8. Required status checks should be product-validation checks only. Do not make orchestration helpers such as `codex-headless-pr`, `codex-create-pr`, or `qa-publish` required merge checks.

## Protected-path policy

Unattended agents may validate and propose changes to these paths, but they must not self-merge changes that touch them.
These paths require human review and approval.

| Path or glob | Why it is protected |
| --- | --- |
| `.github/workflows/**` | Changes automation authority, secrets usage, and dispatch behavior |
| `.github/CODEOWNERS` | Changes who can approve protected control-plane edits |
| `.github/ISSUE_TEMPLATE/**` | Changes issue portability and queue intake contract |
| `.agents/skills/**` | Changes agent execution and publish/update behavior |
| `docs/github-agent-bootstrap.md` | Canonical GitHub control-plane contract |
| `docs/agent-native-project-setup.md` | Project field and routing contract |
| `docs/codex-cloud-issue-runbook.md` | Remote execution and publish contract |
| `docs/deployment-track.md` | Deploy boundary and runtime/evidence hosting contract |
| `docs/qa-evidence-uploads.md` | Reviewer-proof publication contract |
| `scripts/deploy*.sh` | Deployment authority |
| `scripts/release*.sh` | Release authority |
| `scripts/healthcheck*.sh` | Release verification surface |
| `.env.example` | Repo-visible env contract |
| `apps/client/.env.example` | Client env contract |
| `apps/client/wrangler.toml` | Client Cloudflare config surface |
| `apps/worker/wrangler.toml` | Worker Cloudflare config surface |
| `packages/contracts/**` | Shared API and schema boundary |

Routing rule:

1. If a proposed unattended fix touches any protected path, stop at validate-and-propose unless a human explicitly requests supervised work on that path.
2. Protected-path PRs may be created for review, but they must not auto-merge.

## Human approval points

Human approval is required at these boundaries:

1. Before merging a PR that touches protected paths.
2. Before merging any PR to `main` when branch protection requires approval.
3. Before starting any `production` environment job.
4. Before any live production deploy or promotion.

Allowed unattended behavior:

1. Open a PR against non-protected paths when the issue is `safe-unattended`.
2. Publish reviewer-proof evidence with trusted secrets.
3. Update issue or PR comments within the documented workflow permission boundary.

Not allowed unattended behavior:

1. Direct push to `main`.
2. Self-approval of production promotion.
3. Self-merging a protected-path PR.

## GitHub UI operator checklist

Complete these steps manually in GitHub:

1. Open the Tong GitHub Project (`erniesg` Project `#3`) and create the queue fields and option sets documented in `docs/agent-native-project-setup.md`.
2. Populate the minimum queue contract on any issue before routing unattended work. For control-plane or protected-path issues, default `Execution Mode` to `validate-and-propose-only` until a human explicitly changes that posture.
3. Create the `staging` and `production` environments under `Settings -> Environments`.
4. Add at least one human required reviewer to `production`. Use `@erniesg` first if no maintainer team exists yet.
5. Add the repository secrets and variables listed above under `Settings -> Secrets and variables -> Actions`.
6. If playtest orchestration needs non-public reads, add `TONG_PLAYTEST_READ_API_TOKEN` as a read-only secret. Do not create alternate secret names.
7. Enable branch protection on `main` with PR review, code-owner review, stale-approval dismissal, conversation resolution, and no direct pushes.
8. Enable review from Code Owners so `.github/CODEOWNERS` protects the listed paths.
9. Confirm GitHub Actions workflows keep the minimum permissions documented above and do not receive broad admin bypass.
10. Keep production deploy credentials behind `environment: production` before any workflow is allowed to promote live state.

## How to test / verify

1. Open this repo in GitHub and confirm `staging` and `production` exist, with `production` requiring a human reviewer.
2. Confirm every secret and variable in the table exists under GitHub Actions settings, and that no personal subscription token or browser cookie has been stored there.
3. Confirm `main` branch protection requires PR review, code-owner review, stale approval dismissal, and conversation resolution.
4. Open a test PR that changes one protected path such as `docs/github-agent-bootstrap.md` and verify Code Owner review is requested before merge.
5. Verify the follow-on docs link back here so `#240`-`#243` can treat this document as the single setup contract.
