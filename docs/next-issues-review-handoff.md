# Review handoff — next-issues drafts

Self-contained prompt for a fresh `product-requirements-architect` (or `tech-lead-coordinator`) subagent to evaluate the issue drafts at `docs/next-issues-draft.md` before they get filed as real GitHub issues.

---

## Reviewer prompt

You are reviewing four draft GitHub issue bodies that will be filed against the `erniesg/tong` repository to dogfood a newly-built agent-native pipeline. The goal of this review is **not** to evaluate code — it is to evaluate whether these issue specifications are good enough for an autonomous agent to pick up and implement successfully.

Working directory: `/Users/erniesg/code/erniesg/tong`. The drafts live in `docs/next-issues-draft.md`. Read that file first.

### Background context (read in this order)

1. `docs/next-issues-draft.md` — the four drafts you're evaluating
2. `docs/pm-orchestrator.md` — the PM orchestrator that will gatekeep these issues, including the operational diagram
3. `docs/self-heal-pipeline.md` — the self-heal loop that downstream PRs will flow through
4. `scripts/pm/lib/portability-rules.mjs` — the deterministic gatekeeper rules; the drafts are written to pass this. Verify they actually do.
5. `docs/agent-native-project-setup.md` — the project field model: lanes, initiatives, execution modes, portability requirements
6. `.agents/skills/_functional-qa/config/repo-adapter.json` — per-issue playbook patterns the implementing agent will need to mirror
7. `CLAUDE.md` (root) — repo conventions

### What we just shipped

This session, two new pieces landed on branch `codex/stable-webtoon-apr21`:

1. **Self-heal pipeline** — PRs from `codex/*` or `claude/*` branches that fail QA publish or get `changes_requested` reviews automatically retry up to 2x with the failure context appended to the original prompt. Codex and Claude both auth via subscription OAuth (no API-key fallback to avoid pay-per-token billing). Exhausted PRs get Discord-pinged for human review.

2. **PM orchestrator** — three operations:
   - `score-issue` (on `issues` events): scores body against portability rules, posts gap comment, sets `pm:agent-ready` or `pm:portability-gap` labels.
   - `orchestrate-queue` (cron, every other 2-hour tick): ranks `pm:agent-ready` issues, dispatches top-N respecting lane/provider caps via the existing `remote_agent_queue.py plan` + `dispatch-remote-agent-queue.mjs`.
   - `lane-health` (cron, every other 2-hour tick): detects stuck issues/PRs and exhausted self-heal PRs, pings Discord.

### The dogfood plan these drafts serve

Open the four drafts as real GitHub issues. The PM gatekeeper should immediately label them `pm:agent-ready` (because they're written portable). The next cron tick should dispatch issues 1–3 to Codex/Claude. Issue 4 stays human-gated (`validate-and-propose-only`).

This is the meta-test of the system. Every gap you find in these drafts is a gap real users will hit when writing real issues.

### What you must evaluate

For each of the 4 drafts, score against these criteria. Be specific — quote the exact section, propose the exact fix.

#### A. Portability gatekeeper compliance (deterministic)

1. Confirm each draft has all 6 required sections by name: `Real route or surface`, `Actual behavior`, `Expected behavior`, `Visible proof sequence`, `Remote dependencies`, `Reviewer proof required`. Verify each is non-empty.
2. Confirm no anti-patterns: no `/Users/...` paths, no `artifacts/qa-runs/...mp4|webm|mov` references in the issue body itself.
3. Run the gatekeeper logic mentally (or actually run `node scripts/pm/score-issue.mjs --number <fake>` after extracting one body to a fake issue — but easier: just paste the body into a node REPL with `evaluateBody(body)`).

#### B. Implementability by an autonomous agent

For each draft, ask:
- Could a Codex/Claude agent open a PR that satisfies "Visible proof sequence" without further questions? If not, what's missing?
- Are file paths concrete and verifiable? Are any invented or wrong?
- Is the scope bounded? Could the agent get lost expanding scope?
- Is the success/done criterion verifiable from the PR diff alone, or does it require runtime evidence the agent can't generate?
- Is the "Notes for the implementing agent" section honest about non-obvious gotchas, or does it skip past complexity?

#### C. Sequencing and dependencies

1. Does Issue 2 (persona reviewer) really depend on Issue 1 (surface docs)? The draft says "can ship in parallel; the reviewer just won't have the doc to read" — verify that's true and not a hidden landmine.
2. Issue 3 (test/lint self-heal triggers) modifies `self-heal-pr.yml` and `self-heal-prepare-prompt.mjs`. Could it conflict with concurrent work in those files? Anything we should serialize?
3. Issue 4 (auto-deploy) is `validate-and-propose-only`. Is the rationale convincing or could it actually be `safe-unattended` with the right gates?

#### D. Priority and execution-mode classification

1. Are the priority labels (`priority:p1`/`p2`) correctly tuned? Does Issue 1 deserve P1 over Issue 2?
2. Are the execution modes correct? Could any agent-eligible issue actually need `validate-and-propose-only`?
3. Is the lane assignment (`lane:qa-platform` for issues 1–3, `lane:infra-deploy` for 4) right?

#### E. Coverage and gaps

1. What issues are MISSING from this dogfood queue? E.g. should there be an issue to wire the Discord button callbacks (in-flight per `handoff-notes.md`)? An auto-priority skill? Per-package `CLAUDE.md` docs (not just per-surface)?
2. What's covered redundantly?
3. Do the issues collectively close the loop, or is there still a gap after all 4 land?

#### F. Risks specific to dogfooding

1. Issue 4's "validate-and-propose-only with `do-not-merge` label" pattern — is that actually how the existing infrastructure handles "draft-only" PRs? Verify against `qa-publish.yml > Auto-merge autofix PRs` step semantics.
2. If all 4 issues fire dispatches in the same cron tick, does the per-provider concurrency cap (3 codex / 3 claude in `pm-orchestrator.json`) handle this gracefully? Note: the live repo currently has 33 open codex PRs which already exceed cap.
3. Issue 1 (docs) and Issue 2 (workflow) might land in the same cron tick. Are there shared-zone collisions that should serialize them per `worktree-routing.json`?

### Deliverable

A single review document with:

1. **Per-issue verdict table**: ready-to-file / needs-edits / blocked. One sentence each.
2. **Specific edits proposed**: section by section, with exact replacement text where useful.
3. **Sequencing recommendation**: file all four at once, or stagger? If stagger, in what order?
4. **Missing issues**: list the gaps in coverage, ranked by leverage.
5. **Top 3 risks** specific to this dogfood plan, ranked by likelihood × impact.

Be direct. The author has been explicit about preferring blunt feedback over polite hedging. If a draft is fine, say so — that's also useful. If something is wrong, cite the section and propose the fix.

### Out of scope

- Don't review the PM/self-heal code — a separate `code-quality-reviewer` is doing that in parallel against `docs/pm-orchestrator-review-handoff.md`.
- Don't critique the existing playtest pipeline or other infrastructure.
- Don't propose new product features unrelated to the agent-native dogfood loop.
