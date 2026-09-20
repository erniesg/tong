# PM Orchestrator

The PM orchestrator is the always-on project manager for Tong's agent-native pipeline. It scores issues, ranks the agent-ready queue, dispatches implementation agents through the existing trusted workflows, and pings humans via Discord when work is stuck or budgets are exhausted.

For the overnight operating contract and live playtest-dispatch readiness checklist, see `docs/autonomous-overnight-operations.md`.

It is **deterministic by default** (regex + label/age math + repo reference checks) so it stays cheap and stable. The LLM is an optional polish layer for natural-language comments.

## Where it sits in the pipeline

```
playtest annotation → playtest-analysis-to-issues.mjs → GitHub issue
                                                            │
                                                            ▼
                                              [PM gatekeeper: score-issue]
                                                            │
                                                ┌─────────┴─────────┐
                                                │ pm:agent-ready    │ pm:portability-gap
                                                ▼                   ▼
                                  [PM cron: orchestrate-queue]    (gap comment, await human/agent fill)
                                                │
                                                ▼
                          remote_agent_queue.py plan #N #M …
                                                │
                                                ▼
                          dispatch-remote-agent-queue.mjs (codex|claude subscription)
                                                │
                                                ▼
                                  codex-headless-pr.yml | claude-headless-pr.yml
                                                │
                                                ▼
                                          PR opened (auto-self-heal label)
                                                │
                                                ▼
                                       qa-publish.yml (trusted)
                                          │            │
                              success: auto-merge   failure → self-heal-pr.yml
                                                                  │
                                                          retry up to 2x
                                                                  │
                                                  exhaustion → Discord ping + label

                          [PM cron: lane-health] (every other tick)
                                                │
                                                ▼
                              Discord ping if stuck issues / PRs / exhausted PRs
```

## Operations

| Operation | Trigger | What it does |
|-----------|---------|--------------|
| `score-issue` | `issues` event (opened/edited/labeled/unlabeled/reopened) | Posts a PM comment listing missing portable-issue sections, reconciles `pm:scored` / `pm:agent-ready` / `pm:portability-gap` labels |
| `orchestrate-queue` | cron (default: every 2h, alternating with lane-health) | Ranks `pm:agent-ready` issues, chooses an available provider, dispatches top-N via `remote_agent_queue.py plan` + `dispatch-remote-agent-queue.mjs` |
| `lane-health` | cron (every 4h offset from orchestrate) | Detects stuck issues/PRs and exhausted self-heal PRs awaiting human review, pings Discord |

All three are exposed as `workflow_dispatch` for manual runs.

## Cron cadence

The cron triggers every 2 hours. The workflow alternates operations based on UTC hour modulo 4:

- Hours 0, 4, 8, 12, 16, 20 UTC → `lane-health`
- Hours 2, 6, 10, 14, 18, 22 UTC → `orchestrate-queue`

That gives roughly 6 dispatch ticks/day and 6 health ticks/day. Tune by editing the cron line + the modulo in `pm-orchestrator.yml > resolve > step`.

The cron is global backlog automation, not playtest-only automation. Playtest-created issues enter the same queue after they pass `score-issue`. If a playtest workflow requests immediate dispatch, it calls `orchestrate-queue` with `--issue-numbers` so only the freshly created ready issues are considered while the same lane/provider caps still apply.

## Labels the PM uses

| Label | Set by | Meaning |
|-------|--------|---------|
| `pm:scored` | PM | The PM has scored this issue at least once |
| `pm:agent-ready` | PM (or human) | All required portable-issue sections present, no anti-patterns; eligible for cron dispatch |
| `pm:portability-gap` | PM | Missing required sections or anti-pattern detected; not eligible until resolved |
| `priority:p0` / `p1` / `p2` | Human or upstream automation | Drives prioritisation score |
| `lane:<id>` | Human or upstream automation | Constrains parallelism (one dispatch per lane per tick) |
| `provider:claude` | Human or upstream automation (optional) | Force Claude as dispatch provider for this issue. Prefer config-driven provider policy for routine scheduling. |
| `blocked-on-human` | PM (escalation) | Stops PM from re-pinging on the same item |

## Example: a brand new issue

1. Human opens issue #200.
2. `pm-orchestrator.yml` fires on `issues:opened`.
3. PM gatekeeper runs `scripts/pm/score-issue.mjs --number 200`.
4. Body is missing `## Visible proof sequence` and `## Reviewer proof required`.
5. PM posts a comment listing both gaps and adds `pm:portability-gap` label.
6. Human (or another agent) edits the issue to fill the sections.
7. `issues:edited` fires; PM re-scores; this time complete.
8. PM updates the same comment to "All required sections present" and swaps to `pm:agent-ready`.
9. Next cron tick at the orchestrate-queue hour: PM ranks #200 against other agent-ready issues, decides it has lane and provider capacity, chooses the best available provider from `.agents/skills/_functional-qa/config/remote-agent-providers.json`, then dispatches.
10. Codex opens PR with `auto-self-heal` label.
11. qa-publish runs. Pass → auto-merge if branch is `autofix/`; fail → self-heal-pr.yml re-prompts Codex.
12. Two failed attempts → `self-heal:exhausted` → Discord ping → next lane-health tick surfaces in summary if it stays unreviewed.

## Configuration

`.agents/skills/_functional-qa/config/pm-orchestrator.json`

```json
{
  "include_label": "pm:agent-ready",
  "skip_labels": ["pm:portability-gap", "self-heal:exhausted", "do-not-merge", "blocked-on-human"],
  "max_dispatches_per_run": 3,
  "provider_concurrency_caps": { "codex": 3, "claude": 3 },
  "stale_age_days": 14,
  "stuck_issue_hours": 48,
  "stuck_pr_hours": 12,
  "priority_label_weights": { "priority:p0": 100, "priority:p1": 50, "priority:p2": 10 },
  "severity_body_weight": 10,
  "age_weight_per_day": 1
}
```

Edit weights, caps, and thresholds without touching code.

Provider caps are backpressure, not priority. They count open `auto-self-heal` PRs per provider so the PM does not launch more concurrent agent work than QA/self-heal can absorb. Provider availability and model strengths live in `.agents/skills/_functional-qa/config/remote-agent-providers.json`; set `availability.status=paused` or `availability.unavailable_until=<ISO timestamp>` when a subscription is exhausted until reset.

## Manual operations

```bash
# Score a specific issue
node scripts/pm/score-issue.mjs --number 200

# Dry-run the queue (no plan, no dispatch)
node scripts/pm/orchestrate-queue.mjs --dry-run

# Dry-run a specific ready issue subset, useful for playtest dispatch smoke
node scripts/pm/orchestrate-queue.mjs --issue-numbers "#123 #124" --provider auto --dry-run

# Plan but skip dispatch (useful for testing the planner end-to-end)
node scripts/pm/orchestrate-queue.mjs --skip-dispatch --queue-out-dir /tmp/pm-test

# Lane health snapshot
node scripts/pm/lane-health.mjs

# Force a workflow run from CLI
gh workflow run pm-orchestrator.yml -f operation=orchestrate-queue
gh workflow run pm-orchestrator.yml -f operation=score-issue -f issue_number=200
gh workflow run pm-orchestrator.yml -f operation=lane-health
```

## What it deliberately does NOT do

- Re-implement queue planning (that lives in `remote_agent_queue.py`).
- Decide what's a good fix (the implementation agent's job; the PM ensures the issue is well-specified going in).
- Re-dispatch failed PRs (the self-heal pipeline owns that).
- Auto-set `Priority` or `Lane` (those need human/agent judgement; LLM polish layer can suggest, never decide).
- Make judgement calls about whether an issue is strategically worth doing. It only validates that the issue is portable and references real repo paths/scripts unless they are explicitly new work products.

## Next steps

1. Add a Claude polish hook on `score-issue` that rewrites the gap comment in plain language when subscription auth is configured.
2. Wire the lane-health "exhausted awaiting review" findings into a structured Discord button payload once the worker callback path lands (see `docs/handoff-notes.md`).
3. Add an `auto-priority` skill that proposes `priority:pN` labels from issue body + playtest severity, requiring a human ack to apply.
