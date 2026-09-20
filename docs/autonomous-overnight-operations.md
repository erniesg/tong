# Autonomous Overnight Operations

This is the operating contract for running Tong's agent backlog while humans are offline. It covers normal issue backlog work and live playtest-to-agent dispatch.

## Current Shape

The autonomous path is not playtest-only. Any open issue that passes the PM gate and receives `pm:agent-ready` is eligible for the same scheduler:

1. `scripts/pm/score-issue.mjs` validates required portable issue sections plus referenced repo paths and npm scripts.
2. `.github/workflows/pm-orchestrator.yml` runs on issue changes and cron.
3. `scripts/pm/orchestrate-queue.mjs` ranks the ready queue, applies lane serialization, provider availability, and provider caps.
4. `scripts/dispatch-remote-agent-queue.mjs` dispatches to `codex-headless-pr.yml` or `claude-headless-pr.yml`.
5. `qa-publish.yml` publishes trusted reviewer proof.
6. `self-heal-pr.yml` retries failed PRs until the attempt budget is exhausted.
7. `lane-health` pings Discord when ready issues, PRs, or exhausted retries are stuck.

Agent handoff prompts now require checkpoint discipline: implementation agents should work in coherent slices and create small local checkpoint commits when the execution environment supports it. If local commits are unsafe in that environment, the agent must leave coherent worktree slices and put the checkpoint log in the final task output and PR body.

## Overnight Backlog Mode

Overnight work is just PM cron over the whole `pm:agent-ready` backlog.

- Source queue: open GitHub issues with `pm:agent-ready`.
- Excluded labels: `pm:portability-gap`, `self-heal:exhausted`, `do-not-merge`, `blocked-on-human`.
- Cadence: the PM workflow triggers every 2 hours.
- Dispatch ticks: 02:00, 06:00, 10:00, 14:00, 18:00, 22:00 UTC.
- Health ticks: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC.
- Default cap: 3 dispatches per tick, with one issue per lane per tick.
- Provider caps: configured in `.agents/skills/_functional-qa/config/pm-orchestrator.json`.
- Provider availability and strengths: configured in `.agents/skills/_functional-qa/config/remote-agent-providers.json`.

To pause a provider after subscription exhaustion, set either:

```json
{
  "availability": {
    "status": "paused",
    "unavailable_until": "2026-05-06T18:00:00Z"
  }
}
```

When the provider resets, set `status` back to `available` or remove the future `unavailable_until`.

## Live Playtest Dispatch Mode

The playtest pipeline can create issues from annotations and recordings, but immediate dispatch is still intentionally off by default.

Live dispatch sequence when `dispatch_codex=true`:

1. `playtest-agent-pipeline.yml` analyzes the session and creates issues.
2. `scripts/pm/ensure-labels.mjs` ensures PM, lane, provider, and self-heal labels exist.
3. Each created issue is synchronously scored by `scripts/pm/score-issue.mjs`.
4. Only issues that pass the PM gate are included in the remote queue summary.
5. Immediate dispatch calls `scripts/pm/orchestrate-queue.mjs --issue-numbers <created-ready-issues>` so playtest work still respects lane caps, provider caps, availability, and provider selection.

Keep `dispatch_codex=false` until the readiness smoke below passes on the default branch.

## Readiness Smoke Before Live Dispatch

Run these on the default branch before setting Worker-side playtest dispatch to true:

```bash
node scripts/pm/ensure-labels.mjs --repo erniesg/tong --dry-run
node scripts/pm/orchestrate-queue.mjs --repo erniesg/tong --dry-run
python .agents/skills/_functional-qa/scripts/remote_agent_queue.py plan --limit 0 --provider auto --json
```

Then run one low-risk issue through the full loop:

1. File the first pure-docs pipeline issue from `docs/next-issues-draft.md`.
2. Confirm `score-issue` labels it `pm:agent-ready`.
3. Run PM orchestrator manually with `max_dispatches=1`.
4. Confirm the provider opens a PR with `auto-self-heal`.
5. Confirm `qa-publish.yml` runs and either publishes proof or produces an actionable blocker.
6. Confirm a failed QA publish triggers `self-heal-pr.yml` and increments `self-heal:attempt-N`.
7. Confirm lane-health reports no false positive stuck work after the PR path is healthy.

## Still Blocking Full Unattended Finishing

These are real blockers to "agents finish everything overnight":

- The control-plane files must be merged onto the default branch before GitHub cron or issue events can run them.
- Provider subscription secrets must exist: `CODEX_AUTH_JSON` and `CLAUDE_CODE_OAUTH_TOKEN`; API-key fallbacks are intentionally disabled.
- `GITHUB_PIPELINE_DISPATCH_TOKEN` must be configured in the Worker before playtest uploads can trigger GitHub automatically.
- Branch protection and repository auto-merge must be configured. Today `qa-publish.yml` auto-merges only `autofix/*`; routine `codex/*` and `claude/*` implementation PRs still stop at PR-ready unless the merge policy is expanded.
- Persona reviewer implementation is not landed yet. Until it exists, reviewer loops are limited to Trusted QA Publish failures, check failures, and direct review requests.
- Typecheck/lint/test `check_run` self-heal trigger is not landed yet. The current self-heal path handles `Trusted QA Publish` failures/timeouts and `changes_requested` reviews.
- Deterministic QA recipes exist only for covered scenarios. UI issues without a `qa_recipe` still need a trusted environment to regenerate reviewer-visible proof.
- Production deploy-on-merge remains human gated by design. Agents can draft deploy workflows, but enabling production deploy automation needs explicit protected approval.

The practical next step is to dogfood one pure-docs issue through the full loop, then enable overnight backlog dispatch with conservative caps. Live playtest dispatch should come after that smoke test, not before it.
