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
- `docs/worktree-ownership-map.md`
- `docs/hackathon-workstreams.md`
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

3. Follow the planned skill sequence per issue:

- start with `validate-issue` unless the queue plan points to `trace-ui-state` because an earlier validation run already ended ambiguous
- use `trace-ui-state` for ambiguous, race-like, or timing-sensitive follow-up work
- rerun `validate-issue --verify-fix` after a code change before claiming a fix
- finish with `publish-issue-update` or let the runtime publish automatically when policy allows

4. Respect the worktree routing:

- issues in different worktrees and without shared-zone collisions may run in parallel
- issues in the same worktree serialize within that lane
- issues touching shared zones or spanning multiple worktrees must stay serialized

5. If the plan identifies multiple independent worktrees and the worktrees are missing, ensure them first:

   ```bash
   python .agents/skills/_functional-qa/scripts/issue_router.py plan $ARGUMENTS --ensure-worktrees
   ```

6. When the agent platform supports delegation or background workers, split work by worktree lane, not by raw issue count.

7. If the user explicitly wants Codex cloud or GitHub PR execution, generate the cloud queue plan too:

   ```bash
   python .agents/skills/_functional-qa/scripts/codex_cloud_queue.py plan $ARGUMENTS
   ```

   Use the generated branch names, PR body files, and `@codex` task comments as the execution handoff.
   In an existing PR context, the current PR branch is the only delivery branch: push fixes back to it, do not create a follow-up PR, and do not rely on gitignored artifacts as committed evidence.

## Output requirements

- Keep the queue plan under `artifacts/qa-runs/functional-qa/issue-queue/...`.
- Keep each issue's validation and fix artifacts under `artifacts/qa-runs/functional-qa/...`.
- Do not claim issues are safe to parallelize without checking shared-zone collisions.
- Do not skip fix verification before publishing a "fixed" update.
