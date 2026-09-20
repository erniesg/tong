# Review handoff — PM Orchestrator + Self-Heal Pipeline

Paste the prompt below into a fresh `code-quality-reviewer` (or `tech-lead-coordinator`) subagent. It is self-contained: do not assume the reviewer has any prior conversation context.

---

## Reviewer prompt

You are reviewing two new pieces of agent-native infrastructure landed in the `erniesg/tong` repository on branch `codex/stable-webtoon-apr21`. Both are additive: no existing functionality was removed.

**Your job:** independently validate that the implementation is correct, safe, idempotent, and consistent with the existing patterns. Flag bugs, race conditions, security issues, missing failure-mode handling, and any drift from the documented contract. Do not be polite — be specific. Cite file paths and line numbers.

### Scope

You are reviewing only these files (added or modified for this work). Ignore other working-tree changes — those are unrelated work in flight on the same branch.

**Self-heal pipeline (already merged into the branch earlier in the session):**

- `scripts/lib/agent_pr_request.mjs` — PR-body metadata block lib (new)
- `scripts/self-heal-prepare-prompt.mjs` — failure-context extractor + re-prompt builder (new)
- `scripts/dispatch-remote-agent-queue.mjs` — provider-agnostic dispatch refactor (modified)
- `scripts/write_pr_body_with_qa_request.mjs` — embeds Agent PR Request block (modified)
- `.github/workflows/codex-headless-pr.yml` — adds `auto-self-heal` label, agent metadata, subscription-only Codex auth (modified)
- `.github/workflows/claude-headless-pr.yml` — Claude headless dispatch via `anthropics/claude-code-action`, subscription-only (new)
- `.github/workflows/self-heal-pr.yml` — self-heal trigger workflow (new)
- `.agents/skills/_functional-qa/config/remote-agent-providers.json` — Claude promoted to working (modified)
- `docs/self-heal-pipeline.md` — operational doc (new)

**PM orchestrator (built in this session):**

- `scripts/pm/lib/portability-rules.mjs` — deterministic gap rules + comment renderer (new)
- `scripts/pm/score-issue.mjs` — issue gatekeeper (new)
- `scripts/pm/orchestrate-queue.mjs` — cron rank + dispatch (new)
- `scripts/pm/lane-health.mjs` — stuck detection (new)
- `.github/workflows/pm-orchestrator.yml` — three-trigger workflow (new)
- `.agents/skills/_functional-qa/config/pm-orchestrator.json` — thresholds + caps (new)
- `.agents/skills/pm-orchestrator/SKILL.md` — skill contract (new)
- `.agents/skills/pm-orchestrator/reference/decision-rules.md` — full decision rule set (new)
- `docs/pm-orchestrator.md` — operational doc (new)

### Required reading before you review

In this order, read these to anchor your understanding of the existing patterns the new code plugs into:

1. `CLAUDE.md` (root) — repo-level conventions
2. `docs/agent-native-project-setup.md` — Project field model and portable-issue requirements (the score-issue gatekeeper enforces these)
3. `docs/remote-agent-control-plane.md` — provider-agnostic queue model
4. `docs/codex-cloud-issue-runbook.md` — Codex flow expectations
5. `.agents/skills/_functional-qa/scripts/remote_agent_queue.py` (skim, don't deep-read) — the queue planner that orchestrate-queue calls into
6. `docs/self-heal-pipeline.md` and `docs/pm-orchestrator.md` — the contracts you're validating against

### Success criteria

For each piece below, confirm or refute. Write a 1-2 line verdict with the evidence.

**A. Self-heal pipeline correctness**

1. The `Agent PR Request` block round-trips cleanly (render → strip → parse) with multi-line prompts containing backticks and JSON. Round-trip test exists at the top of `scripts/lib/agent_pr_request.mjs` (verify by running the test in the manual-test section below).
2. `self-heal-prepare-prompt.mjs` short-circuits cleanly with `should_run=false, exit 0` when:
   - Review state is not `changes_requested`
   - Workflow_run conclusion is `success`
   - PR is missing the `auto-self-heal` label
   - PR has the `self-heal:exhausted` label
   - PR body has no `Agent PR Request` block
   - Prior attempts >= max_attempts
3. The workflow `concurrency` group correctly dedupes parallel triggers on the same PR for all three trigger types (`pull_request_review`, `workflow_run`, `workflow_dispatch`).
4. The `Dispatch provider workflow` step in `self-heal-pr.yml` passes `PROMPT_BODY` via env var (not a heredoc) so multi-line prompts with arbitrary content cannot break the script. Verify the env-var pattern is used.
5. Both `codex-headless-pr.yml` and `claude-headless-pr.yml` fail fast with a clear error if their respective subscription token is missing — no API-key fallback path exists.
6. The `auto-self-heal` label is applied after PR creation in BOTH provider workflows.
7. The `Agent PR Request` block is embedded into the PR body in BOTH provider workflows via `INPUT_AGENT_PROVIDER` env var.

**B. PM orchestrator correctness**

1. `portability-rules.mjs` regex patterns correctly identify required sections AND ignore false positives (e.g. an "Expected behavior:" line in a code block should still match because the rule is heading-anchored).
2. `score-issue.mjs` is idempotent: running it twice on the same issue does not stack PM comments. The `<!-- pm:scored -->` marker logic should keep exactly one PM comment.
3. `score-issue.mjs` reconcile-labels logic adds AND removes the right labels for both `isComplete=true` and `isComplete=false` paths.
4. `orchestrate-queue.mjs` correctly detects open codex/claude PRs by `headRefName.startsWith("codex/" | "claude/")`. Confirm this matches the branch naming used by both headless workflows.
5. `orchestrate-queue.mjs` provider concurrency cap is enforced AFTER existing open PRs are counted, so re-running mid-tick cannot double-dispatch.
6. `orchestrate-queue.mjs` lane gating limits to one dispatch per `lane:<id>` per tick.
7. `lane-health.mjs` only pings Discord if `hasFindings=true` — no spam on quiet repos.
8. `pm-orchestrator.yml` `resolve` step correctly routes:
   - `issues` event → `score-issue` job
   - `schedule` cron → alternates `orchestrate-queue` and `lane-health` based on UTC hour
   - `workflow_dispatch` → user-selected operation
9. The cron alternation modulo math is correct: `hour % 4 == 0` → lane-health; otherwise → orchestrate. Specifically check that hours 0/4/8/12/16/20 UTC fire lane-health and 2/6/10/14/18/22 UTC fire orchestrate-queue.

**C. Cross-cutting**

1. No `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` references remain as fallback paths anywhere — only as guard conditions that error out cleanly.
2. The PM does NOT reimplement the queue planner. It calls `python remote_agent_queue.py plan` and `node scripts/dispatch-remote-agent-queue.mjs`. Confirm via grep.
3. The PM does NOT reimplement self-heal. It consumes self-heal labels (`self-heal:exhausted`, `auto-self-heal`) without dispatching retries directly.
4. All workflows use `secrets.DISCORD_WEBHOOK_URL` (already configured) — no new Discord secret introduced.
5. New labels introduced (`pm:scored`, `pm:portability-gap`, `pm:agent-ready`, `auto-self-heal`, `self-heal:attempt-N`, `self-heal:exhausted`) are documented somewhere reviewers/users can find them.

### Manual validation (run these)

From the repo root on `codex/stable-webtoon-apr21`:

```bash
# 1. Syntax check all touched scripts
node --check scripts/lib/agent_pr_request.mjs && \
node --check scripts/self-heal-prepare-prompt.mjs && \
node --check scripts/dispatch-remote-agent-queue.mjs && \
node --check scripts/write_pr_body_with_qa_request.mjs && \
node --check scripts/pm/lib/portability-rules.mjs && \
node --check scripts/pm/score-issue.mjs && \
node --check scripts/pm/orchestrate-queue.mjs && \
node --check scripts/pm/lane-health.mjs && \
echo OK

# 2. YAML validate all workflows
python3 -c "import yaml, glob; [yaml.safe_load(open(f)) for f in glob.glob('.github/workflows/*.yml')]" && echo OK

# 3. Unit-test portability rules
node -e "
import('./scripts/pm/lib/portability-rules.mjs').then(({ evaluateBody }) => {
  const complete = '## Real route or surface\n/game\n\n## Actual behavior\nx\n\n## Expected behavior\ny\n\n## Visible proof sequence\n1. tap\n\n## Remote dependencies\nrepo-only\n\n## Reviewer proof required\nClip\n';
  const e = evaluateBody(complete);
  if (!e.isComplete) throw new Error('expected complete');
  console.log('OK');
});"

# 4. Round-trip Agent PR Request lib
node -e "
import('./scripts/lib/agent_pr_request.mjs').then(({ renderAgentPrRequestBlock, parseAgentPrRequest, encodePromptB64, decodePromptB64 }) => {
  const original = { provider: 'codex', prompt_b64: encodePromptB64('multi\nline\n\`\`\`json\n{}\n\`\`\`'), branch: 'codex/x', base_branch: 'main', pr_title: 't', issue_ref: '', route: '', qa_recipe: '', attempts: 0, original_run_url: '' };
  const block = renderAgentPrRequestBlock(original);
  const parsed = parseAgentPrRequest('preamble\n\n' + block);
  if (decodePromptB64(parsed.prompt_b64) !== 'multi\nline\n\`\`\`json\n{}\n\`\`\`') throw new Error('lost prompt');
  console.log('OK');
});"

# 5. Live dry-run against real GitHub (requires gh auth)
node scripts/pm/orchestrate-queue.mjs --repo erniesg/tong --dry-run

# 6. Live lane-health (read-only)
node scripts/pm/lane-health.mjs --repo erniesg/tong

# 7. Synthetic short-circuit tests for self-heal-prepare-prompt
tmpdir=$(mktemp -d)
cat > "$tmpdir/ev.json" <<'EOF'
{ "review": { "state": "approved" }, "pull_request": { "number": 1 } }
EOF
GITHUB_REPOSITORY=erniesg/tong GITHUB_EVENT_PATH="$tmpdir/ev.json" GITHUB_EVENT_NAME=pull_request_review \
  node scripts/self-heal-prepare-prompt.mjs 2>&1 | grep -E "should_run|reason"
rm -rf "$tmpdir"
```

### Specific risks to investigate

These are areas where the implementation might be wrong but tests cannot catch:

1. **`openai/codex-action@v1` behavior with no `openai-api-key` input.** The codex-headless-pr.yml now omits the `openai-api-key` input entirely when running with subscription auth. Confirm by reading `https://github.com/openai/codex-action` whether the input is required or optional, and whether the action falls through to `~/.codex/auth.json` when the input is missing. If the action validates non-empty input, the workflow will fail at startup.

2. **`anthropics/claude-code-action@beta` input shape.** The claude-headless-pr.yml uses `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}` and `mode: agent`. Confirm against the action README that these input names are current. If `@beta` has moved, pin to `@v1` or a specific SHA.

3. **GitHub event payload differences.** `self-heal-prepare-prompt.mjs` reads `event.workflow_run.pull_requests[0].number` to map a workflow_run failure back to a PR. This array is empty for cross-repo workflow runs and sometimes for same-repo runs that don't carry a PR association. Confirm the fallback path produces a sensible reason rather than a crash.

4. **Concurrency group expressions.** `pm-orchestrator.yml`'s concurrency group uses `${{ github.event.issue.number || github.event.schedule || inputs.operation }}`. Verify this expression is valid for all three triggers — specifically that `github.event.schedule` is non-empty on cron triggers (it should be the cron string, e.g. `0 */2 * * *`).

5. **The cron modulo math.** `if [ $((10#$hour % 4)) -eq 0 ]` — confirm the `10#` prefix correctly forces base-10 interpretation for hours like `08` and `09` which would otherwise be invalid octal.

6. **Idempotency of `gh api comments PATCH`.** `score-issue.mjs` calls `gh api repos/.../issues/comments/<id> -X PATCH -f body=...`. Confirm this is the correct API and shape — and that the comment body param isn't size-limited in a way that could truncate long gap comments.

7. **`gh issue comment` with `--body` containing large multi-line content.** Confirm that the gh CLI handles the body argument correctly when it contains markdown headings and code blocks. The implementation passes via `--body` flag rather than a file; if there are size limits, switch to `--body-file`.

### Out of scope

Do not review:
- Unrelated changes in the working tree (Shanghai onboarding work, asset manifest updates, etc).
- Whether the existing playtest pipeline is correct — it predates this work.
- Whether the GitHub Project fields *should* be used instead of labels — that's a deliberate v1 simplification documented in `docs/pm-orchestrator.md`.

### Deliverable

A single review document with:

1. Verdict per success criterion (✅ / ❌ / ⚠️ unclear).
2. List of bugs / risks / inconsistencies, each with file:line citation and a proposed fix.
3. Top 3 follow-up items ranked by risk.

If something is correct but non-obvious, say so — that's also useful signal.
