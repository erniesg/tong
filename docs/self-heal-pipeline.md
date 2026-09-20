# Self-Heal Pipeline

When an agent-authored PR fails CI or a reviewer requests changes, the self-heal pipeline re-prompts the same agent provider with the failure context and pushes a new commit to the same branch. The loop is provider-agnostic: Codex, Claude Code, and any future provider with a trusted headless workflow can plug in through the same contract.

## Trigger surfaces

The `Self-Heal PR` workflow (`.github/workflows/self-heal-pr.yml`) listens on three events:

1. `pull_request_review` with `state == changes_requested` on a same-repo PR.
2. `workflow_run` for `Trusted QA Publish` with `conclusion == failure` or `timed_out`.
3. `workflow_dispatch` (manual) — supply `pr_number` to force a retry.

All three pass through the same `prepare` job, which decides whether the PR is eligible and emits the new prompt.

## Eligibility

A PR is eligible for self-heal when ALL of these hold:

- It has the `auto-self-heal` label (applied automatically by `codex-headless-pr.yml` and `claude-headless-pr.yml`).
- Its body contains a parseable `## Agent PR Request` block with a known provider (`codex` or `claude`).
- Prior `self-heal:attempt-N` labels are below the budget (default 2; override via `SELF_HEAL_MAX_ATTEMPTS` or `max_attempts` workflow input).
- It does not already carry the `self-heal:exhausted` label.
- It is open (not merged or closed).

Anything else short-circuits with a recorded `reason`.

## Retry budget and exhaustion

- Default budget: 2 attempts beyond the original.
- Each successful dispatch adds a `self-heal:attempt-N` label.
- When the next attempt would exceed the budget, the PR gets `self-heal:exhausted`, the `auto-self-heal` label is removed, an exhaustion comment is posted, and Discord is notified (red embed).
- The workflow runs `scripts/pm/ensure-labels.mjs` before mutating labels so missing repository labels fail early instead of silently disabling self-heal visibility.

To resume after exhaustion: address feedback manually, remove `self-heal:exhausted`, re-add `auto-self-heal`. Or run the workflow with `workflow_dispatch` to force one more attempt.

## Provider routing

The `Agent PR Request` block carries `provider`. The prepare script maps it to a workflow:

| Provider | Workflow | Required secret |
|----------|----------|-----------------|
| `codex` | `codex-headless-pr.yml` | `CODEX_AUTH_JSON` (full `~/.codex/auth.json` from `codex login`) |
| `claude` | `claude-headless-pr.yml` | `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`) |

**API-key fallbacks are intentionally disabled.** Both providers must use subscription OAuth so remote runs are billed against the ChatGPT / Claude subscription, never against pay-per-token API budgets. If the secret is missing, the workflow fails fast with a clear error.

Populate the secrets once:

```bash
# Codex (ChatGPT subscription)
codex login
gh secret set CODEX_AUTH_JSON < ~/.codex/auth.json

# Claude Code (Claude subscription)
claude setup-token
gh secret set CLAUDE_CODE_OAUTH_TOKEN
```

Same OAuth shape as `justrach/codegraff` for Codex and `anthropics/claude-code-action`'s subscription mode for Claude.

Adding a new provider requires:

1. A new headless-PR workflow that accepts the standard inputs (`prompt`, `base_branch`, `branch`, `pr_title`, `issue_ref`, `route`, `qa_recipe`, `auto_qa_publish`, `agent_attempts`, `enable_self_heal`).
2. The workflow must embed `INPUT_AGENT_PROVIDER=<id>` when calling `scripts/write_pr_body_with_qa_request.mjs` so the resulting PR carries an `Agent PR Request` block.
3. The workflow must apply the `auto-self-heal` label after creating the PR.
4. Add an entry to `PROVIDER_WORKFLOWS` in `scripts/self-heal-prepare-prompt.mjs` and `PROVIDER_CONFIG` in `scripts/dispatch-remote-agent-queue.mjs`.
5. Update `.agents/skills/_functional-qa/config/remote-agent-providers.json`.

## Failure context capture

The prepare script gathers feedback differently per trigger:

- `pull_request_review`: review body plus inline review comments via `gh api repos/.../pulls/N/reviews/ID/comments`.
- `workflow_run`: the most recent PR comment matching qa-publish blocker patterns (`Trusted QA publish was blocked`, `Trusted QA publish could not find a repo-visible run bundle`, `Trusted QA publish did not start`).

If neither produces a summary, self-heal short-circuits with `reason="Could not extract a failure summary…"` instead of guessing.

## Re-prompt format

The agent receives a structured prompt:

```
You are continuing a self-healing pull request iteration.
Self-heal attempt: <N>

## Original task
<original prompt from Agent PR Request block>

## Feedback that must be addressed before this PR can merge
<failure summary from review or qa-publish blocker>

## What you must do now
1. Read the feedback carefully and identify every concrete change requested.
2. Apply changes on the existing branch — do not rename or recreate it.
3. Keep the original task acceptance criteria intact while addressing feedback.
4. Work in small coherent slices and create local checkpoint commits when the environment supports them without interfering with PR creation; otherwise include a checkpoint log in the final output.
5. Update the PR body if the scope or evidence requirements have changed.
6. If a request is ambiguous or out of scope, leave a PR comment explaining the gap rather than guessing.
```

## Required secrets

| Secret | Required for | Status |
|--------|--------------|--------|
| `CODEX_AUTH_JSON` | Codex provider — subscription only, no API fallback | Required |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude provider — subscription only, no API fallback | Required |
| `DISCORD_WEBHOOK_URL` | Notifications | Already configured (used by playtest pipeline + qa-publish) |

## Manual test

```bash
# Dry-run the prepare logic against an existing PR
GITHUB_REPOSITORY=erniesg/tong \
GITHUB_EVENT_NAME=workflow_dispatch \
node scripts/self-heal-prepare-prompt.mjs --pr-number 42

# Force a retry from the workflow UI
gh workflow run self-heal-pr.yml -f pr_number=42 -f max_attempts=2
```

## Observability

Each self-heal run posts to the PR:

- Yellow Discord embed when an attempt is dispatched.
- Red Discord embed when the budget is exhausted.
- A retry comment with the failure reason and the new attempt number.
- An exhaustion comment with manual recovery steps.

The `Self-Heal Decision` step summary on the workflow run captures the structured decision JSON for debugging.
