---
name: pm-orchestrator
description: Score, prioritise, schedule, and route GitHub issues through the agent-native pipeline. Acts as the always-on project manager that gatekeeps issue completeness, ranks the agent-ready queue, dispatches implementation agents, and pings humans when work is stuck or budgets are exhausted. Use when planning a sprint, validating a backlog, prioritising what agents should pick up next, or auditing why work is stalled.
---

# PM Orchestrator

The PM orchestrator is the intelligence layer that sits on top of the existing control plane (`remote_agent_queue.py plan`, `dispatch-remote-agent-queue.mjs`, self-heal, qa-publish). It does not re-implement queue planning; it decides which issues are *eligible* and *ranked* to feed those tools.

## Operations

The PM has three operations. Pick the one that matches the trigger.

### 1. score-issue (gatekeeper)

Trigger: GitHub `issues` event (`opened`, `edited`, `labeled`, `unlabeled`) or manual.

```bash
node scripts/pm/score-issue.mjs --number <n>
```

Behaviour:

- Scores the issue body against required portable-issue sections (route, actual/expected behavior, visible proof sequence, remote dependencies, reviewer-proof type) plus anti-pattern detection (`/Users/...` paths, laptop-only clip paths).
- Validates referenced repo-relative paths and npm scripts so issues do not become `pm:agent-ready` with invented files or commands. Paths/scripts explicitly declared as new work products are allowed.
- Posts or updates a single PM comment (`<!-- pm:scored -->` marker) listing gaps.
- Reconciles labels:
  - All sections present + no anti-patterns → adds `pm:agent-ready`, removes `pm:portability-gap`.
  - Anything missing → adds `pm:portability-gap`, removes `pm:agent-ready`.
  - Always adds `pm:scored` so humans can see the PM has reviewed this issue.
- Idempotent: re-running on the same issue updates the same comment.

Required sections live in `scripts/pm/lib/portability-rules.mjs`. Update there to change the contract.

### 2. orchestrate-queue (cron rank + dispatch)

Trigger: `schedule` (cron) or manual.

```bash
node scripts/pm/orchestrate-queue.mjs
```

Behaviour:

- Lists open issues with the include label (default `pm:agent-ready`) excluding skip labels (`pm:portability-gap`, `self-heal:exhausted`, `do-not-merge`, `blocked-on-human`).
- Ranks by `priority + severity*10 + min(ageDays, stale_age_days)`.
- Applies caps:
  - One dispatch per lane per run (lane label format `lane:<id>`).
  - Provider concurrency caps from config (default 3 codex / 3 claude open at once).
  - Provider availability from `.agents/skills/_functional-qa/config/remote-agent-providers.json` so exhausted or paused subscription providers are not scheduled until reset.
  - `max_dispatches_per_run` ceiling.
- Calls `python remote_agent_queue.py plan #N #M …` to produce a queue plan.
- Calls `node scripts/dispatch-remote-agent-queue.mjs --plan ... --include-unassigned` to dispatch.
- Returns a decision JSON with `selected`, `plan`, and `dispatch` sections so a human reviewer or downstream Discord step can audit it.

Provider selection: explicit `provider:<id>` label wins; otherwise the PM uses issue/lane/execution-mode policy from `remote-agent-providers.json`, then falls back to the first available provider with capacity. PM provider assignments are written back into the generated remote plan before dispatch.

For live playtest dispatch, call `orchestrate-queue` with `--issue-numbers "<created-ready-issues>"` after synchronous `score-issue` gating. This keeps playtest dispatch on the same lane/provider/cap path as overnight backlog work instead of bypassing the scheduler.

For the overnight operating contract and readiness checklist, read `docs/autonomous-overnight-operations.md`.

### 3. lane-health (stuck detection)

Trigger: `schedule` (cron) or manual.

```bash
node scripts/pm/lane-health.mjs
```

Behaviour:

- Flags `pm:agent-ready` issues with no linked PR after `stuck_issue_hours` (default 48h).
- Flags open `auto-self-heal` PRs idle for more than `stuck_pr_hours` (default 12h).
- Flags `self-heal:exhausted` PRs with no human review yet.
- Emits a Discord-friendly JSON report; the workflow forwards it to `discord-notify.mjs` if findings exist.

## Configuration

`.agents/skills/_functional-qa/config/pm-orchestrator.json` is the single source of truth for thresholds:

- `include_label`: which label gates "agent-ready" eligibility.
- `skip_labels`: labels that block dispatch.
- `max_dispatches_per_run`: ceiling per cron tick.
- `provider_concurrency_caps`: per-provider open-PR cap.
- `stale_age_days`: anti-starvation cap for the age component of the score.
- `stuck_issue_hours` / `stuck_pr_hours`: lane-health thresholds.
- `priority_label_weights`: maps `priority:p0/p1/p2` to numeric weights.

## Decision rules

Read [reference/decision-rules.md](reference/decision-rules.md) for the full prioritisation model and human-ping policy.

## What this skill is NOT

- Not a queue planner — the queue model lives in `remote_agent_queue.py` and is provider-agnostic.
- Not a dispatcher — `dispatch-remote-agent-queue.mjs` is the trusted dispatch surface. The PM only decides inputs.
- Not a self-heal — `self-heal-pr.yml` handles failed PR retries. The PM consumes its outcome (e.g. `self-heal:exhausted` triggers a Discord ping) but does not re-dispatch directly.

## Where the LLM helps

The PM is mostly deterministic by design (regex + label/age math) so it stays cheap and stable across triggers. When invoked from a Claude Code session, the LLM adds value in three places:

1. Writing **issue-aware gap comments** when the deterministic gaps need natural-language framing (e.g. why the proof type matters for a specific bug).
2. Inferring **missing fields** (Lane, Initiative, Priority) from the issue body so a human only confirms.
3. Synthesising **lane-health summaries** into actionable Discord messages for the lane owner.

The deterministic scripts do not require an LLM to run. Use the LLM as a polish layer when subscription auth is configured.

## Output format

Every operation prints a single JSON object on stdout for downstream automation. Do not parse human-readable strings — read the JSON.
