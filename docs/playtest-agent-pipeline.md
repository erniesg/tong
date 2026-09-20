# Playtest Agent Pipeline

This is the remote-first path from annotated playtest evidence to GitHub issues, PM scoring, remote-agent queue planning, and Discord notification.

## Flow

1. A playtest session uploads recording, annotations, screenshots, filmstrip, and state log to `tong-runs`.
2. The Worker optionally dispatches the `Playtest Agent Pipeline` GitHub workflow when `GITHUB_PIPELINE_DISPATCH_TOKEN` is configured.
3. The workflow runs Gemini analysis via `scripts/analyze-playtest-session.mjs`.
4. `scripts/playtest-analysis-to-issues.mjs` converts selected findings into portable GitHub issues.
5. `scripts/pm/ensure-labels.mjs` ensures the PM, lane, provider, and self-heal labels exist.
6. `scripts/pm/score-issue.mjs` synchronously scores each created issue.
7. `remote_agent_queue.py plan` generates provider metadata and task prompts for the scored-ready issues only.
8. If `dispatch_codex=true`, `scripts/pm/orchestrate-queue.mjs --issue-numbers <created-ready-issues>` launches supported provider tasks while still respecting lane caps, provider caps, and provider availability.
9. `scripts/discord-notify.mjs` sends the issue, queue, and dispatch summary to Discord.
10. When a dispatched PR reaches `Trusted QA Publish`, `.github/workflows/qa-publish.yml` posts the GitHub proof comment and sends a Discord completion notification with the PR and uploaded evidence manifest.

## Required Secrets And Vars

GitHub Actions secrets:

- `GOOGLE_GEMINI_API_KEY`
- `DISCORD_WEBHOOK_URL`

GitHub Actions vars:

- `TONG_RUNS_PUBLIC_BASE_URL=https://runs.tong.berlayar.ai`
- `TONG_PLAYTEST_API_BASE=https://tong-api.erniesg.workers.dev`

Worker secrets:

- `GITHUB_PIPELINE_DISPATCH_TOKEN`
  - GitHub token that can call `repository_dispatch` for `erniesg/tong`.
- Optional: `GITHUB_REPOSITORY=erniesg/tong`
- Optional: `PLAYTEST_AGENT_PRESET=ux_friction`
- Optional: `PLAYTEST_AGENT_ANALYSIS_MODE=auto`
- Optional: `PLAYTEST_AGENT_MIN_SEVERITY=2`
- Optional: `REMOTE_AGENT_PROVIDER=auto`
- Optional: `PLAYTEST_AGENT_DISPATCH_CODEX=true`

If `GITHUB_PIPELINE_DISPATCH_TOKEN` is absent, playtest upload still succeeds and returns `agentPipelineDispatch.attempted=false`.

## Manual Run

Analyze a submitted session and create issues:

```bash
npm run playtest:issues -- \
  --session-id <SESSION_ID> \
  --min-severity 2
```

Generate a provider-neutral queue plan:

```bash
npm run remote:agent-plan -- '#123' '#124' --provider auto
```

Dispatch supported provider tasks from a queue plan:

```bash
npm run remote:dispatch -- \
  --plan artifacts/qa-runs/functional-qa/codex-cloud-queue/<run>/remote-plan.json \
  --include-unassigned
```

Notify Discord from generated artifacts:

```bash
npm run notify:discord -- \
  --issues /path/to/issues.json \
  --queue /path/to/remote-plan.json \
  --session-id <SESSION_ID>
```

## Current Boundary

This can create issues, score them with the PM gatekeeper, generate queue prompts, and launch Codex or Claude tasks when `dispatch_codex=true`. The flag name is kept for backwards compatibility with the existing Worker payload, but dispatch now routes through the PM scheduler rather than directly bypassing PM caps.

Keep Worker-side live dispatch off until the readiness smoke in `docs/autonomous-overnight-operations.md` passes on the default branch.

For Shanghai-specific slice dispatch and proof routing, use `docs/shanghai/remote-agent-onboarding.md`.
