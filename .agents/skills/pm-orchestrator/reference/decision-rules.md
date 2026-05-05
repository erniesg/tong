# PM Orchestrator Decision Rules

Authoritative rule set for prioritisation, scheduling, and human-ping decisions. The deterministic scripts encode these rules; the LLM polishes the natural-language output.

## Issue eligibility

An issue is eligible for unattended dispatch when ALL of these hold:

1. State is `open`.
2. Has the include label (default `pm:agent-ready`).
3. Does NOT have any skip label (`pm:portability-gap`, `self-heal:exhausted`, `do-not-merge`, `blocked-on-human`).
4. Body passes the portability-rules check in `scripts/pm/lib/portability-rules.mjs`:
   - Required sections present: route, actual behavior, expected behavior, visible proof sequence, remote dependencies, reviewer proof type.
   - No anti-patterns: `/Users/...` paths, `artifacts/qa-runs/...` clip paths.
   - Referenced repo-relative paths and npm scripts resolve in the checkout, unless the issue clearly declares them as new files/scripts to add.

If anything fails, the gatekeeper labels `pm:portability-gap` and posts a gap comment until a human or agent fills the missing sections.

## Prioritisation score

```
score = priority_weight + severity * severity_body_weight + min(age_days, stale_age_days) * age_weight_per_day
```

- `priority_weight` from labels:
  - `priority:p0` → 100
  - `priority:p1` → 50
  - `priority:p2` → 10
  - none → 0
- `severity` from issue body line `Severity: N/5` (Gemini playtest analysis writes this). Default 0.
- `age_days` capped at `stale_age_days` to avoid age dominating critical fresh work.

Higher score wins. Ties break on lower issue number (older issues first within the same score).

## Lane and provider gating

Lane (label `lane:<id>`) constrains parallelism: at most one issue per lane is dispatched in a single cron tick. This mirrors the worktree-routing serialization model.

Provider concurrency cap: count open pipeline PRs carrying `auto-self-heal` whose head branch starts with `codex/` or `claude/`. Skip or reroute an issue if dispatching it would exceed the configured cap for its provider.

Provider availability is read from `.agents/skills/_functional-qa/config/remote-agent-providers.json`:

- `availability.status=available` means the provider may receive work.
- `availability.status=paused` or `exhausted` removes it from automatic scheduling.
- `availability.unavailable_until=<ISO timestamp>` removes it until that time, useful for subscription reset windows.

## Dispatch ceiling

`max_dispatches_per_run` (default 3) caps total dispatches per cron tick. This protects against runaway dispatch on a backlog spike and gives humans time to react between waves.

## Provider selection

Default: codex when available. The PM first respects explicit `provider:<id>` labels, then a run-level provider override such as `--provider claude`, then issue/lane/execution-mode policy in `.agents/skills/_functional-qa/config/remote-agent-providers.json`, then availability/capacity fallback. The downstream remote queue planner receives PM provider assignments so dispatch cannot drift from the scheduler decision.

When a workflow needs to dispatch only a specific subset, for example newly created playtest issues, it must pass `--issue-numbers`. The issue still needs `pm:agent-ready`; the flag narrows the eligible set but does not bypass the gatekeeper.

## Human-ping triggers

Discord ping is sent when ANY of:

- A new issue is missing required sections AND has no `human-triage` label yet (the gatekeeper posts a gap comment but humans should still be told).
- A `pm:agent-ready` issue has not produced a linked PR within `stuck_issue_hours` (default 48h).
- An open `auto-self-heal` PR has been idle for more than `stuck_pr_hours` (default 12h).
- A PR is labeled `self-heal:exhausted` and has no human review yet.

The lane-health operation produces a structured JSON report. The workflow forwards it to `discord-notify.mjs` only if `hasFindings` is true so we don't spam Discord with empty checks.

## Anti-patterns the PM enforces

These are checked at gatekeeper time and surfaced as comments:

- `/Users/<name>/...` absolute paths in issue bodies → not portable.
- `artifacts/qa-runs/...mp4|webm|mov` paths → local-only clip; should be uploaded to `tong-runs` first.
- Missing repo paths such as `apps/server/src/signals/` or missing npm scripts such as `npm run cf:build` → not portable unless the issue explicitly says that path/script is being created in this PR.
- (Future) Missing `tong-runs` evidence URL when `Reviewer proof required: Clip` or `Clip+Trace`.

Add new anti-patterns to `ANTI_PATTERNS` in `scripts/pm/lib/portability-rules.mjs`.

## Idempotency

All PM operations are idempotent:

- score-issue: maintains exactly one PM comment per issue (identified by `<!-- pm:scored -->` marker), updates labels by reconciliation rather than blind add.
- orchestrate-queue: dispatch is gated by current open-PR counts so re-running mid-tick will not double-dispatch the same issue (the new PR is already counted in the cap).
- lane-health: read-only.

## When to escalate

If the PM repeatedly flags the same issue/PR across multiple cron ticks, the orchestrator should:

1. Add the `blocked-on-human` label to the underlying issue.
2. Open a thread in Discord (single message, not repeated).
3. Stop pinging until the label is removed.

This is implemented at the workflow level by checking the existing `blocked-on-human` label before pinging.
