# Next-issues draft (dogfood queue) — v2

Six portable issue bodies for the next pieces of agent-native infra work, written to pass the PM gatekeeper (`scripts/pm/lib/portability-rules.mjs`). Reviewed against the gatekeeper rules and code state by `product-requirements-architect`; all flagged edits applied.

**Recommended creation order matches the leverage ranking** in `docs/pm-orchestrator.md > Next steps` and the staggering recommendation from review:

1. File **Issue 1** first as the real meta-test (pure docs, low risk, exercises the full loop).
2. Wait for #1 to merge, then file **Issue 2a** (persona files precursor) and **Issue 2b** (workflow) together.
3. File **Issue 3** in parallel with **Issue 2b** (different workflow files; lane-cap will serialize them).
4. File **Issue 4** last, after stable dogfood evidence.
5. **Issue 5** (typecheck check_run) is a precursor for Issue 3 — file before #3 so the new self-heal triggers have something to listen to.

---

## Issue 1 — Per-surface "what good looks like" reference docs

**Title:** `Add docs/surfaces/<id>.md golden references for /game, /overlay, /insights`

**Recommended labels:** `pm:agent-ready`, `priority:p1`, `lane:qa-platform`, `provider:claude`, `initiative:pipeline-hardening`

**Execution mode:** `safe-unattended` (pure docs)

```markdown
## Context

The PM orchestrator and the planned persona reviewer agents need affirmative reference docs that say "this is what good `/game` looks like" so they can score PRs against an explicit standard. Today we have per-issue playbooks in `repo-adapter.json` (per-issue, point-in-time) but no per-surface invariant docs. This means reviewer agents have nothing to compare against.

## Real route or surface

Three surfaces (extension covered separately):
- `/game` (and sub-routes `/game/hangout`, `/game/map`)
- `/overlay`
- `/insights`

Files to add:
- `docs/surfaces/game.md`
- `docs/surfaces/overlay.md`
- `docs/surfaces/insights.md`

Out of scope for this issue: `extension` (`chrome-extension://apps/extension`). Cover separately when the extension surface stabilises; it is not a webapp route and reviewer-evidence patterns differ.

## Actual behavior

There is no canonical "what good looks like" reference per surface. Reviewer agents and humans rely on:
- Per-issue playbooks in `.agents/skills/_functional-qa/config/repo-adapter.json` (issue-specific, not surface-level)
- Skill DON'Ts in `.agents/skills/impeccable/`
- Implicit knowledge in scattered places

## Expected behavior

Each `docs/surfaces/<id>.md` contains:
1. **Acceptance invariants** — bullet list of always-true properties (e.g. "tap on dialogue advances state OR finishes typewriter; never both, never no-op").
2. **Surface contract** — visible elements always present (HUD pull tab, continue affordance, etc).
3. **Anti-patterns** — explicit DON'Ts specific to this surface.
4. **Reviewer evidence checklist** — what a reviewer should screenshot/clip to validate a PR touching this surface.
5. **Cross-references** — pointers into existing skill docs, fixture files, and contract files.

## Visible proof sequence

1. Open `docs/surfaces/game.md`, `docs/surfaces/overlay.md`, `docs/surfaces/insights.md` in repo browser.
2. Confirm each has the 5 sections above with content.
3. Confirm the `/game` doc references `apps/client/components/scene/`, `apps/client/lib/store/game-store.ts`, and the relevant fixtures in `packages/contracts/fixtures/`.
4. Confirm the `/overlay` doc references `apps/client/app/overlay/` and the caption-lane components.
5. Confirm the `/insights` doc references `apps/client/app/insights/page.tsx` and the `apps/server/src/signals.mjs` (+ `signal-*.mjs`) modules that feed it.
6. Run `grep -r "docs/surfaces" .agents/skills/` — should find at least one skill referencing the new docs.

## Scenario seed or checkpoint

Not applicable (pure documentation work).

## Remote dependencies

`repo-only`. The implementing agent needs only the checked-out tree.

## Reviewer proof required

`None`. Reviewer reads the markdown directly.

## Notes for the implementing agent

- Use the existing `apps/client/components/scene/`, `apps/client/app/game/page.tsx`, and `packages/contracts/fixtures/` to ground the invariants in actual code. Don't invent.
- Cite real files by path. Do not invent paths or directories. Verify every path in the docs by reading it before writing the doc.
- Keep each doc under ~250 lines. Reviewer agents need to load these on every PR review; concise wins.
- Do not duplicate content between surfaces — link instead.

## Follow-up (do NOT include in this PR)

After these docs land, propose a separate issue: wire `docs/surfaces/<id>.md` references into `repo-adapter.json > issue_playbooks` per-surface so reviewer agents pull surface invariants automatically. Do not modify `repo-adapter.json` in this PR — keep the diff scoped to docs only.
```

---

## Issue 2a — Commit persona-agent definitions to repo

**Title:** `Commit frontend-architect, backend-architect, code-quality-reviewer agent files to .claude/agents/`

**Recommended labels:** `pm:agent-ready`, `priority:p1`, `lane:infra-deploy`, `initiative:pipeline-hardening`

**Execution mode:** `validate-and-propose-only` (touches agent-loading paths; human should sanity-check before merge)

```markdown
## Context

The persona reviewer workflow planned in Issue 2b cannot dispatch frontend-architect, backend-architect, or code-quality-reviewer agents because those agent definitions currently live ONLY in `~/.claude/agents/` (user-level, on the maintainer's laptop). GitHub Actions runners cannot access user-level agents. Without committing them to the repo, Issue 2b would silently fail or hallucinate.

## Real route or surface

New files in `.claude/agents/`:
- `.claude/agents/frontend-architect.md`
- `.claude/agents/backend-architect.md`
- `.claude/agents/code-quality-reviewer.md`

(Additional persona files such as `tech-lead-coordinator.md` may be useful but are out of scope for this issue.)

## Actual behavior

`~/.claude/agents/*.md` exist on the maintainer's local machine. The repo has no agent definitions in `.claude/agents/`. CI runners cannot resolve `subagent_type=frontend-architect` etc.

## Expected behavior

The three persona agent definitions are committed to the repo. They are stable, reviewable, and auditable. CI workflows can load them via `claude-code-action`'s agent-files mechanism (or by passing the system prompt content directly to the action's `prompt` input).

## Visible proof sequence

1. Open `.claude/agents/frontend-architect.md`, `.claude/agents/backend-architect.md`, `.claude/agents/code-quality-reviewer.md` in repo browser.
2. Each contains a complete agent definition (frontmatter `name`, `description`, body) ready for `claude-code-action` consumption.
3. Run `gh api repos/erniesg/tong/contents/.claude/agents` — returns three entries.
4. None of the files reference user-specific paths like `/Users/...`.

## Scenario seed or checkpoint

Not applicable.

## Remote dependencies

The maintainer's local `~/.claude/agents/*.md` is the source of truth for the initial commit. After this PR merges, the repo copy becomes canonical and user-level overrides should be considered stale.

## Reviewer proof required

`Screenshot`. Capture the new files in the repo browser plus a green CI run.

## Notes for the implementing agent (validate-and-propose-only)

- Copy from `~/.claude/agents/{frontend-architect,backend-architect,code-quality-reviewer}.md` verbatim where possible. If anything references a maintainer-specific path or context, redact and flag in the PR body.
- Do NOT modify the agent system prompts to "improve" them; the human will review the verbatim copies first.
- Add a one-paragraph `.claude/agents/README.md` explaining: these are repo-tracked agent definitions, the user-level versions in `~/.claude/agents/` should be removed once merged to avoid drift.
- Issue 2b depends on this — call out in the PR body that 2b is unblocked once this lands.
```

---

## Issue 2b — Persona reviewer workflow on PR open

**Title:** `Add persona-reviewer.yml — frontend/backend/code-quality agents on PR open`

**Recommended labels:** `pm:agent-ready`, `priority:p1`, `lane:infra-deploy`, `provider:claude`, `initiative:pipeline-hardening`

**Execution mode:** `safe-unattended`

**Depends on:** Issue 1 (hard — without surface invariant docs, personas have nothing to score against and may produce false-blocking verdicts that trigger self-heal loops on healthy PRs). Issue 2a (hard — persona agent files must be in repo for CI runner to access).

```markdown
## Context

The PM gatekeeps issue completeness and the self-heal loop handles failed PRs, but no agent reviews PR *content* against affirmative quality standards. Today review is human-only via `/review` invocation. We want automated reviewer agents that fan out on PR open: frontend-architect for `apps/client/**`, backend-architect for `apps/server/**` and `apps/worker/**`, code-quality-reviewer always.

## Real route or surface

New workflow: `.github/workflows/persona-reviewer.yml`
New skill: `.agents/skills/persona-reviewer/SKILL.md`
New script: `scripts/persona-review/dispatch-personas.mjs` (helper for parsing changed paths and emitting per-persona output)

## Actual behavior

PRs opened by Codex/Claude (or humans) get qa-publish trusted evidence runs but no agent-driven content review. Humans must manually invoke `/critique` or `/review` if they want a structured second opinion.

## Expected behavior

On PR open, sync, or reopen, `persona-reviewer.yml` triggers and:
1. Identifies which personas to invoke based on changed paths (use `dorny/paths-filter@v3` or `gh pr diff --name-only`):
   - Any change → `code-quality-reviewer`
   - `apps/client/**` change → `frontend-architect`
   - `apps/server/**` or `apps/worker/**` change → `backend-architect`
2. Each persona runs as an INDEPENDENT GitHub Actions job (matrix or three separate jobs). Each job invokes `anthropics/claude-code-action@<pinned-sha>` with a system prompt sourced from `.claude/agents/<persona>.md` and a tool-allowlist limited to `Read`, `Bash(git diff*)`, `Bash(gh pr*)`, `mcp__github__*` — NO `Write`, NO `Edit`. The persona must NOT modify code; it can only post comments.
3. Each persona posts ONE structured PR review comment tagged `<!-- persona:<id> -->` containing:
   - Which surface invariants from `docs/surfaces/*.md` are touched
   - Specific concerns with file:line citations
   - One-line verdict (`looks-good` | `concerns` | `blocking`)
4. If any persona returns `blocking`, post a single PR-level `changes_requested` review (which triggers `self-heal-pr.yml` — closing the loop).
5. Idempotent: re-running on the same PR updates the existing persona comment (one per persona). Use the same upsert pattern as `scripts/pm/score-issue.mjs > postOrUpdateComment`.

## Visible proof sequence

1. Open a PR touching `apps/client/app/game/page.tsx`.
2. Within ~3 minutes, the PR has 2 new comments tagged `<!-- persona:frontend-architect -->` and `<!-- persona:code-quality-reviewer -->`.
3. Each comment has the structured shape (touched invariants, file:line concerns, verdict).
4. Open a second PR touching only `apps/server/src/index.mjs`.
5. Within ~3 minutes, that PR has comments from `<!-- persona:backend-architect -->` and `<!-- persona:code-quality-reviewer -->` but NOT frontend-architect.
6. If a persona's verdict is `blocking`, the PR also has a `changes_requested` review and a `self-heal:attempt-1` label (showing the loop closed).

## Scenario seed or checkpoint

Not applicable.

## Remote dependencies

- Requires `CLAUDE_CODE_OAUTH_TOKEN` secret (already configured for `claude-headless-pr.yml`).
- Requires Issue 1 (hard): `docs/surfaces/*.md` for personas to score against. Without those docs, personas have nothing affirmative to compare against and risk producing false-blocking verdicts.
- Requires Issue 2a (hard): `.claude/agents/<persona>.md` files committed to repo so CI can load them.

## Reviewer proof required

`Clip+Trace`. Capture: (a) the PR comments view with both persona comments and verdict markers, (b) a clip of the workflow run logs showing per-persona job outputs, (c) for the `blocking` test case, a clip showing the resulting `changes_requested` review and `self-heal:attempt-1` label firing.

## Notes for the implementing agent

- Mirror the structure of `claude-headless-pr.yml` for the auth + action invocation pattern. Use the same pinned SHA for `anthropics/claude-code-action`.
- Use `dorny/paths-filter@v3` (or grep `gh pr diff --name-only`) to determine which personas to fan out.
- Each persona is a separate job for parallelism (matrix or three independent jobs). Do NOT try to spawn parallel subagents from a single job — `claude-code-action` does not expose a "spawn three parallel subagents" pattern; use GH Actions matrix instead.
- Idempotency: each persona job upserts ONE comment per PR, identified by the `<!-- persona:<id> -->` marker. Use the same pattern as `scripts/pm/score-issue.mjs > postOrUpdateComment`.
- Do NOT auto-approve PRs. Only `changes_requested` on `blocking` verdict; otherwise, just post comments.
- Concurrency: `concurrency: { group: persona-reviewer-${{ github.event.pull_request.number }}, cancel-in-progress: true }`. Cross-PR caps are out of scope; rely on Claude subscription rate-limit backpressure.
- Add `persona-reviewer:run-N` PR labels for visibility.
```

---

## Issue 3 — Expand self-heal triggers to test/lint failures

**Title:** `Expand self-heal-pr.yml triggers to check_run failures (tsc/lint/tests)`

**Recommended labels:** `pm:agent-ready`, `priority:p2`, `lane:infra-deploy`, `provider:codex`, `initiative:pipeline-hardening`

**Execution mode:** `safe-unattended`

**Depends on:** Issue 5 (typecheck check_run must exist before this trigger has something to listen to).

```markdown
## Context

`self-heal-pr.yml` currently triggers on `pull_request_review` (changes_requested) and `workflow_run` (qa-publish failure). Test, lint, and TypeScript failures are common — and they're the cleanest signal for a self-heal because the failure log IS the prompt context. Adding `check_run.completed` and additional `workflow_run` listeners closes more of the loop.

## Real route or surface

`.github/workflows/self-heal-pr.yml` (extend triggers + permissions)
`scripts/self-heal-prepare-prompt.mjs` (extend failure-summary extraction)
`.agents/skills/_functional-qa/config/pm-orchestrator.json` (add check_run patterns config)

## Actual behavior

A Codex PR that fails `npx tsc --noEmit` or `npm run lint` does not trigger self-heal. The PR sits with a red check until a human notices, manually re-prompts, or files a new task.

## Expected behavior

`self-heal-pr.yml` also triggers on:
- `check_run.completed` with `conclusion=failure` for checks named in a config-driven allowlist (default `typecheck`, `lint`, `test`).
- `workflow_run.completed` with `conclusion=failure` for additional workflow names beyond just `Trusted QA Publish` (configured patterns).

When firing on `check_run`:
- The failure summary extracts the last ~200 lines of the failed check's log via `gh api repos/.../check-runs/<id>/annotations`.
- The re-prompt is built with the same template as today, with check name + log excerpt as the failure context.

Filter must be **explicit**, not implicit: the `check_run` listener filters on `event.check_run.name` and skips names matching `qa-publish*` or workflow name `Trusted QA Publish` (those route via `workflow_run` already; double-trigger would self-heal twice). Allowlist driven by config so the rule lives in `pm-orchestrator.json` next to other patterns.

Same retry budget (default 2), same exhaustion path, same provider routing.

## Visible proof sequence

1. Open a Codex PR that intentionally introduces a `tsc` error (e.g. a missing import).
2. CI typecheck fails (this requires Issue 5 to have landed — see Notes).
3. Within ~2 minutes, `self-heal-pr.yml` fires with operation = check_run-driven self-heal.
4. PR receives `self-heal:attempt-1` label and a comment "Self-heal attempt 1 dispatched via codex-headless-pr.yml" with reason mentioning the failed typecheck.
5. Codex pushes a new commit fixing the import.
6. Re-run typecheck passes.
7. PR moves forward normally.

## Scenario seed or checkpoint

Not applicable.

## Remote dependencies

- Requires GH Actions `permissions: checks: read` (currently the workflow declares `actions: write, contents: read, issues: write, pull-requests: write` — `checks: read` is missing).
- Existing `CODEX_AUTH_JSON` and `CLAUDE_CODE_OAUTH_TOKEN` secrets sufficient.
- Issue 5 (hard): a `typecheck` (or named-equivalent) check_run must exist in CI for the trigger to have anything to fire on.

## Reviewer proof required

`Clip`. Capture the PR timeline showing the failed check → self-heal-pr.yml run → new commit → passing check.

## Notes for the implementing agent

- Update the `permissions:` block of `self-heal-pr.yml` to include `checks: read` (currently missing). Without it, the `gh api ...check-runs/<id>/annotations` call returns 403 silently.
- The current `self-heal-prepare-prompt.mjs > buildFailureSummary` has branches for `pull_request_review` and `workflow_run`. Add a `check_run` branch that:
  - Reads `event.check_run.name` and `event.check_run.html_url`.
  - Calls `gh api repos/.../check-runs/<id>/annotations` and extracts annotation messages.
  - Truncates to ~4000 chars to keep the prompt focused.
- Add a config knob `self_heal.check_run_patterns` in `pm-orchestrator.json` so the workflow only fires on check names that match (e.g. `["typecheck", "lint", "test"]`). Default-deny prevents over-triggering.
- Add a config knob `self_heal.skip_workflow_names` so the `workflow_run` listener can skip names already covered by `check_run` (e.g. avoid double-firing on `Trusted QA Publish`).
- Keep the existing 2-attempt budget; failures from check_run count toward the same total.
- Do NOT enable for `qa-publish` check_run — that already routes via `workflow_run`. Avoid double-triggering.
```

---

## Issue 4 — Auto-deploy on merge to main (Cloudflare client + worker)

**Title:** `Add deploy-on-merge.yml — auto-deploy client + worker to Cloudflare on main push`

**Recommended labels:** `priority:p2`, `lane:infra-deploy`, `initiative:pipeline-hardening`, **NO `pm:agent-ready`** (production-blast-radius; needs human design review)

**Execution mode:** `validate-and-propose-only`

```markdown
## Context

The agent-native pipeline now opens PRs, runs trusted QA, self-heals, and auto-merges autofix branches. But there is no auto-deploy on merge to main. `cf:deploy` and `wrangler deploy` exist as scripts. Wiring them to a workflow that fires on push to main closes the last manual gap before the loop is fully autonomous.

This issue is intentionally NOT `pm:agent-ready`. Production deploy infra needs human design review before merge. An agent may draft the workflow but should not have it auto-merged.

## Real route or surface

New workflow: `.github/workflows/deploy-on-merge.yml`

Targets:
- Client (Next.js via OpenNext) → `tong.berlayar.ai` via `npm run cf:deploy` inside `apps/client/` (which runs `npx opennextjs-cloudflare build && npx wrangler deploy` per the script in `apps/client/package.json`).
- Worker → Cloudflare Workers (custom domain TBD; `apps/worker/wrangler.toml` currently has `workers_dev = true` and no custom route) via `npm --prefix apps/worker run deploy`.

## Actual behavior

A merge to `main` does not deploy. Operators run deploys manually via `./scripts/deploy-client-cloudflare.sh` and `npm --prefix apps/worker run deploy` from a local checkout. There is no audit trail in GH Actions history.

## Expected behavior

`deploy-on-merge.yml` fires on:
- `push` to `main` AND
- only when changed paths include `apps/client/**` (deploy client), `apps/worker/**` (deploy worker), or `assets/manifest/**` (deploy both — manifest changes affect both).

Behaviour:
1. Determine which targets to deploy from `dorny/paths-filter` output.
2. For each target: build, run smoke checks (e.g. `npm run demo:smoke` for shared contracts; `wrangler dev --local` + `curl /health` for the worker). If a smoke target does not exist for a given build artifact, propose adding one in this PR's body and skip the smoke step rather than inventing a synthetic check.
3. Deploy via Wrangler with `--env production` (or equivalent for the OpenNext path).
4. Post a Discord notification with deploy outcome (one embed per target, green on success, red on failure).
5. If a deploy fails, do NOT roll back automatically. Post a blocker comment on the merge commit and Discord-ping `lane:infra-deploy`.

## Visible proof sequence

1. Open and merge a small PR touching `apps/client/app/game/page.tsx`.
2. Within ~5 minutes, `deploy-on-merge.yml` shows a successful run in the Actions tab.
3. The deployed client at `tong.berlayar.ai` reflects the change.
4. A Discord embed appears with title "Tong client deployed" and the merge commit URL.
5. Open and merge a small PR touching only `apps/worker/src/index.ts`.
6. Same flow, but only the worker target deploys; the client is skipped.
7. Force a deploy failure (e.g. invalid Wrangler config) and confirm Discord red embed + blocker comment fire correctly.

## Scenario seed or checkpoint

Not applicable.

## Remote dependencies

- Requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets/vars (already configured for `qa-publish.yml`).
- The Worker named per `apps/worker/wrangler.toml` and the R2 bucket `tong-runs` (bound as `TONG_RUNS_BUCKET`) must already exist and be writable by the deploy token. Verify with `wrangler whoami` and `wrangler r2 bucket list` in the workflow's pre-deploy step before invoking `wrangler deploy`.
- Requires branch protection on `main` to prevent direct pushes that bypass QA.

## Reviewer proof required

`Clip+Trace`. Production deploy is high-blast-radius. Capture:
- Workflow run logs showing build + smoke + deploy stages
- Discord embed
- Live URL screenshot pre/post showing the change
- Wrangler deploy output with the new version ID

## Notes for the implementing agent (validate-and-propose-only)

1. Draft `.github/workflows/deploy-on-merge.yml` with the structure above.
2. Open the PR from a `codex/*` or `claude/*` branch; auto-merge does not fire on those branches (it gates on `startsWith(head_ref, 'autofix/')`), so no `do-not-merge` label is needed.
3. Land the workflow with the actual `deploy` job behind `if: false` (or `if: github.event_name == 'workflow_dispatch'` only) so a merge alone cannot trigger production deploy until a human flips the gate.
4. Post the proposed YAML in the PR body. Wait for human approval before any production secrets are exercised. Do NOT exercise `wrangler deploy` from this PR's CI runs even in dry-run.
5. If branch protection on `main` is not yet configured, propose the protection rules in the PR body and stop. Do not enable deploy-on-merge until protection prevents direct pushes that bypass QA.
```

---

## Issue 5 — Add typecheck check_run to CI (precursor for Issue 3)

**Title:** `Add typecheck.yml — npx tsc --noEmit as a check_run on every PR`

**Recommended labels:** `pm:agent-ready`, `priority:p2`, `lane:infra-deploy`, `provider:codex`, `initiative:pipeline-hardening`

**Execution mode:** `safe-unattended`

```markdown
## Context

Issue 3 expands self-heal triggers to listen on `check_run.completed (failure)` for typecheck/lint/test. But the repo doesn't currently run `tsc --noEmit` as a `check_run` in CI. Without one, the new self-heal trigger has nothing to listen to. This issue adds a minimal typecheck workflow.

## Real route or surface

New workflow: `.github/workflows/typecheck.yml`

## Actual behavior

`apps/client/` has a `tsconfig.json` and a `noEmit` setting. There is no GH Actions workflow that runs `npx tsc --noEmit` on every PR. Type errors are caught locally or not at all.

## Expected behavior

`typecheck.yml` fires on:
- `pull_request` to any branch
- `push` to `main`

Behaviour:
1. Checkout, install deps in `apps/client/` and `apps/server/`.
2. Run `npx tsc --noEmit` in `apps/client/`.
3. Run `npx tsc --noEmit` in `apps/server/` (if `tsconfig.json` exists; gracefully skip if not).
4. Each command becomes a separate check_run on the PR (named `typecheck (client)` and `typecheck (server)`).

## Visible proof sequence

1. Open a PR introducing a deliberate type error in `apps/client/app/game/page.tsx`.
2. Within ~2 minutes, the PR has a red check_run named `typecheck (client)`.
3. Click the check_run; the failure annotations show the type error with file:line.
4. Push a fix; the check_run goes green.

## Scenario seed or checkpoint

Not applicable.

## Remote dependencies

`repo-only`. The implementing agent reads `tsconfig.json` from each app directory.

## Reviewer proof required

`Screenshot`. Capture the PR Checks tab showing the new check_runs (red, then green after a fix push).

## Notes for the implementing agent

- Use `actions/setup-node@v4` with `node-version: 22` to match other workflows.
- Cache `node_modules` via `actions/setup-node`'s built-in cache to keep the check_run fast.
- Each tsc invocation should be a separate workflow job so it surfaces as a separate check_run name.
- Do NOT add lint or test workflows in this issue — keep the scope tight. Lint and test check_runs are useful but separate issues.
- Use `--pretty false` on `tsc` so the output is annotation-friendly.
```

---

## Follow-up issues (deferred — not part of this dogfood batch)

These issues surfaced during review but are not in the immediate batch. File once the dogfood loop is proven on Issues 1–5.

| # | Title | Source | Why deferred |
|---|-------|--------|--------------|
| F1 | Wire Discord button callbacks for route-human decisions | `docs/handoff-notes.md > Discord human-review routing` | In-flight with `infra-deploy / qa-platform` owner; coordinate, don't agent-dispatch |
| F2 | Add `auto-priority` skill — propose `priority:pN` labels from issue body + playtest severity | `docs/pm-orchestrator.md > Next steps:3` | LLM-judgement-heavy; needs human ack gate before applying labels |
| F3 | Add per-package `CLAUDE.md` for `apps/server/`, `apps/worker/`, `apps/client/` | requirements review | Lower leverage but cheap; hardens persona reviewer once Issue 2 lands |
| F4 | Branch protection rules as code (`.github/branch-protection.json` + apply workflow) | requirements review | Implicit dependency of Issue 4 (auto-deploy); medium leverage, asymmetric risk |
| F5 | Lane-health escalation gate (auto-apply `blocked-on-human` label after N pings) | code review Bug 7 | Documented in `decision-rules.md` but not implemented; Discord could spam without this |
| F6 | Observability for silent `workflow_run` drops (no PR association) | code review Bug 8 | Graceful but invisible; emit a workflow run summary line so operators can audit drops |
| F7 | Extend `evaluateBody()` to validate referenced files/scripts/agents exist | requirements review meta-finding | Implemented for deterministic repo paths and npm scripts in `scripts/pm/lib/portability-rules.mjs`; keep future follow-up only for deeper semantic validation |
| F8 | Live test of `openai/codex-action@v1` with subscription auth (no api-key input) | code review Risk 1 | Cannot be code-fixed; needs one real PR to confirm action behavior |

---

## Suggested next move

Once you confirm, I'll create them in this order with `gh issue create`:

```bash
# Round 1: Issue 1 — the real meta-test
gh issue create --title "..." --body-file <issue-1-body> --label "pm:agent-ready,priority:p1,lane:qa-platform,provider:claude,initiative:pipeline-hardening"

# Wait for #1 to merge through the full loop (gatekeeper → cron → dispatch → QA → merge)
# Verify: did the PM gatekeeper score it? Did cron pick it up? Did Claude open a PR? Did self-heal fire if needed?

# Round 2 (after #1 merges): Issues 2a, 5
gh issue create ...  # Issue 2a (persona files)
gh issue create ...  # Issue 5 (typecheck check_run)

# Round 3 (after 2a + 5 merge): Issues 2b, 3, 4
gh issue create ...  # Issue 2b (persona reviewer workflow)
gh issue create ...  # Issue 3 (self-heal triggers)
gh issue create ...  # Issue 4 (deploy-on-merge — validate-and-propose-only)
```

Each round is a checkpoint to confirm the loop works before adding more agents in flight.
