# Playtest Agent Pipeline

This is the remote-first path from annotated playtest evidence to GitHub issues, remote-agent queue planning, and Discord notification.

## Flow

1. A playtest session uploads recording, annotations, screenshots, filmstrip, and state log to `tong-runs`.
2. The Worker optionally dispatches the `Playtest Agent Pipeline` GitHub workflow when `GITHUB_PIPELINE_DISPATCH_TOKEN` is configured.
3. The workflow runs Gemini analysis via `scripts/analyze-playtest-session.mjs`.
4. `scripts/playtest-analysis-to-issues.mjs` converts selected findings into portable GitHub issues.
5. `remote_agent_queue.py plan` generates provider metadata and task prompts.
6. If `dispatch_codex=true`, `scripts/dispatch-remote-agent-queue.mjs` launches supported Codex tasks through `codex-headless-pr.yml`.
7. `scripts/discord-notify.mjs` sends the issue, queue, and dispatch summary to Discord.

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

Dispatch supported Codex tasks from a queue plan:

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

This can create issues, generate queue prompts, and launch Codex tasks when `dispatch_codex=true`. Claude remains a provider contract until a trusted dispatch workflow is added.
