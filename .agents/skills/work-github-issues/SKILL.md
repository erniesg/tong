---
name: work-github-issues
description: Route GitHub issues through the repo's functional QA workflow, choose the right skill sequence, and assign safe worktrees or parallel lanes when the user asks to step through issues, fix the issue queue, or decide what can run in parallel.
---

# Work GitHub Issues

Use this skill as the front door when the user wants the agent to work through GitHub issues, fix issues autonomously, or decide which issue work can run in parallel.

## Shared platform

Read these before doing substantive work:

- `.agents/skills/_functional-qa/config/repo-adapter.json`
- `.agents/skills/_functional-qa/config/publish-policy.json`
- `.agents/skills/_functional-qa/config/worktree-routing.json`
- `.agents/skills/_functional-qa/config/codex-cloud.json` when the user asks for Codex cloud or GitHub PR execution
- `docs/agent-native-project-setup.md`
- `docs/worktree-ownership-map.md`
- `docs/workstreams.md`
- `docs/codex-cloud-issue-runbook.md` when the user asks for Codex cloud or GitHub PR execution

The shared scripts are:

```bash
python .agents/skills/_functional-qa/scripts/issue_router.py
python .agents/skills/_functional-qa/scripts/qa_runtime.py
python .agents/skills/_functional-qa/scripts/codex_cloud_queue.py
```

## Workflow

1. Generate the queue plan:

   ```bash
   python .agents/skills/_functional-qa/scripts/issue_router.py plan $ARGUMENTS
   ```

   If no arguments are passed, plan against the repo's open GitHub issues.

2. Use the generated `queue-plan.json` and `queue-plan.md` as the execution source of truth.

   Treat each issue's `execution_mode` as binding:

- `safe-unattended`: validate, fix, rerun `--verify-fix`, then publish.
- `requires-live-model`: do not claim fixed unless the run captured direct issue evidence from live-model output.
- `validate-and-propose-only`: validate, trace if needed, then stop with evidence and a scoped proposal instead of making unattended product or architecture changes.
- `needs-human-design-review`: validate, capture visual evidence, and defer before subjective UX or hierarchy changes.

   Treat `Portable Context` and the issue body as gates too:

- if the issue depends on `/Users/...`, private repos, or unpublished laptop-only assets, mark it non-portable before attempting unattended cloud execution
- do not silently fill in missing acceptance criteria from memory; capture the gap and stop if the visible proof sequence is underspecified
- the queue planner should honor the GitHub Project `Lane` and `Execution Mode` fields when present instead of re-deriving everything from issue text

3. Follow the planned skill sequence per issue:

- start with `validate-issue` unless the queue plan points to `trace-ui-state` because an earlier validation run already ended ambiguous
- use `trace-ui-state` for ambiguous, race-like, or timing-sensitive follow-up work
- rerun `validate-issue --verify-fix` after a code change before claiming a fix
- finish with `publish-issue-update` or let the runtime publish automatically when policy allows

4. Respect the worktree routing:

- issues in different worktrees and without shared-zone collisions may run in parallel
- issues in the same worktree serialize within that lane, with one active worker per collision lane unless the work is intentionally combined in one PR
- issues touching shared zones or spanning multiple worktrees must stay serialized

5. If the plan identifies multiple independent worktrees and the worktrees are missing, ensure them first:

   ```bash
   python .agents/skills/_functional-qa/scripts/issue_router.py plan $ARGUMENTS --ensure-worktrees
   ```

6. When the agent platform supports delegation or background workers, split work by worktree lane, not by raw issue count.

   Use the lane model from `docs/agent-native-project-setup.md`:

- `client-ui`
- `client-runtime`
- `client-overlay`
- `qa-platform`
- `runtime-assets`
- `server-api`
- `server-ingestion`
- `game-engine`
- `infra-deploy`
- `mock-ui`
- `creative-assets`

7. If the user explicitly wants Codex cloud or GitHub PR execution, generate the cloud queue plan too:

   ```bash
   python .agents/skills/_functional-qa/scripts/codex_cloud_queue.py plan $ARGUMENTS
   ```

   Use the generated task prompt files and PR notes as the execution handoff for direct Codex environment tasks.
   Prefer the direct Codex environment flow: launch a task, let Codex return a diff, then create a PR from the task result.
   Do not assume shell-level `git push` or `gh` is available inside the cloud task.
   Use GitHub comments for `@codex review` or explicitly manual experiments, not as the default implementation path.

8. Be explicit about issue closure:

- if the PR fully resolves the issue, plan to close it via a GitHub closing keyword in the PR body such as `Fixes #123` or by closing it immediately after merge
- if the PR is only a partial fix, an audit pass, or work under an umbrella or epic issue, do not close the issue; update the issue title/body or comment so the remaining scope is explicit
- do not treat merged PRs as sufficient evidence that an issue should close unless the merged scope actually matches the current issue text

## Output requirements

- Keep the queue plan under `artifacts/qa-runs/functional-qa/issue-queue/...`.
- Keep each issue's validation and fix artifacts under `artifacts/qa-runs/functional-qa/...`.
- Do not claim issues are safe to parallelize without checking shared-zone collisions.
- Do not skip fix verification before publishing a "fixed" update.
- Do not upgrade a validation-only or design-review issue into a fix run unless a human explicitly changes the direction.
- Flag issues that are not remote-portable before sending them to Codex cloud or unattended workers.
