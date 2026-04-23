# Remote Task Runbook

Use this runbook when you want hosted tasks to work portable Tong tasks through the remote environment UI and create PRs from task results instead of local worktrees.

Use `docs/agent-native-project-setup.md` as the source of truth for project fields, lane ownership, and portability rules.
Use `docs/qa-evidence-uploads.md` as the source of truth for the boundary between local QA bundles and published reviewer-visible proof.
Use `docs/remote-agent-control-plane.md` for the provider-neutral control-plane contract.

The orchestrator is repo-native. Providers such as Codex or Claude are pluggable execution backends selected by policy or workflow input.

## What remote tasks can and cannot see

Hosted tasks work from the repository checkout plus the remote environment setup. They do not inherit arbitrary local files from a laptop.

Practical rule:

1. If a task can be reproduced from tracked code, fixtures, and setup commands, it can run remotely.
2. If it depends on local-only assets, unpublished media, or unreproducible device state, keep it local until that dependency is moved to a shared location.
3. If the portable context field is not marked ready, do not send it to remote execution as an unattended fix task.

## Prerequisites

1. The remote GitHub integration must be installed for this repository.
2. The hosted environment should run the Tong setup commands for server, client, smoke, and mock ingestion flows.
3. The shell that will publish reviewer-visible QA evidence should pass the reviewer-proof preflight.
4. If remote tasks need large or private assets later, move them to shared storage first.

## Repo entry points

1. Functional QA front door:
   - `.agents/skills/work-github-issues/SKILL.md`
2. Queue generator:
   - primary: `python .agents/skills/_functional-qa/scripts/remote_agent_queue.py plan`
   - compatibility wrapper for Codex-specific launches: `python .agents/skills/_functional-qa/scripts/codex_cloud_queue.py plan`
   - trusted repo-native trigger workflow: `.github/workflows/issue-queue-orchestrator.yml`
3. Output bundle:
   - `artifacts/qa-runs/functional-qa/`

Treat the generated plan as local staging, not the reviewer-visible evidence host.

## Suggested labels and fields

Helpful labels:

1. `cloud-ok`
2. `local-only`
3. `needs-acceptance-proof`

The authoritative execution gates should still live on the project fields for workflow status, execution mode, portability, proof requirements, and scenario or checkpoint needs.

## Suggested batching order

1. Land portability and environment contract work first.
2. Move queue planner and reviewer-proof infrastructure next.
3. Send only portable tasks to hosted execution.
4. Keep device-bound or asset-bound work local until the blockers are removed.

## Standard remote flow

1. Generate the current queue plan and read the portability notes.
   - provider policy defaults come from `.agents/skills/_functional-qa/config/remote-agent-providers.json`
   - workflow dispatch can override with `auto`, `codex`, or `claude`
   - repo-native GitHub queue comments should use `/tong ...`; `/codex ...` remains compatibility only
2. Open the hosted task UI and start from the generated prompt.
3. Let the remote task return a diff.
4. Review the diff, create the PR, and request a review pass if needed.
5. Publish reviewer-visible proof through the trusted upload path when the task requires it.

## When remote tasks cannot publish directly

If a hosted task cannot post comments or upload reviewer-proof artifacts because task-shell secrets are unavailable, use the trusted GitHub Actions workflow instead.

## PR creation fallback

If a hosted task cannot create a PR directly, hand GitHub Actions a patch that is visible to GitHub and let the repo create the branch and PR for you.

Practical rules:

1. Keep the patch GitHub-visible.
2. Keep the branch name aligned with the current branch naming rules.
3. Prefer the hosted task path only when you specifically want an interactive remote coding session and are willing to create the PR manually afterward.
