# Replay-Driven Issue Routing

This is the #351 replay QA loop built on the rrweb capture path from #342/#343.

## Reviewer Pin

1. Open Backstage Playtest Viewer.
2. Select a session with rrweb events.
3. Seek to the visible failure timestamp in the Replay tab.
4. Click `Pin`.
5. Edit the exported JSON fields before routing:
   - `severity`
   - `componentHint`
   - `title`
   - `description`

The export is a normalized replay finding input. It includes session id, replay timestamp, route/surface, public proof URL, render artifact URL, severity, and component hint.

## Dry-Run Routing

```bash
npm run qa:route-replay-finding -- route \
  --finding /path/to/finding.json \
  --safe-unattended \
  --portable-context
```

The router writes:

- `artifacts/qa-runs/functional-qa/replay-findings/ledger.json`
- `artifacts/qa-runs/functional-qa/replay-routing/<timestamp>/dispatch-summary.json`
- `artifacts/qa-runs/functional-qa/replay-routing/<timestamp>/dispatch-summary.md`

The ledger is keyed by `dedupe_key`, so reruns update the same finding instead of duplicating it. Routing records one of:

- `new_issue`
- `update_issue`
- `direct_pr`
- `human_review`
- `skip`

## Apply Mode

GitHub mutation is off by default. To create or comment on an issue, use `--apply` from a trusted shell that has appropriate GitHub auth. Do not run branch app/test code with a write token in the environment.

## Direct PR Gate

Use `--prefer-direct-pr` only when the finding is safe for unattended implementation. The router blocks direct PR routing unless all gates pass:

- safe-unattended policy asserted
- portable context asserted
- exactly one lane
- reviewer-visible proof URL exists
- no protected path edits
- no design ambiguity

Dry-run summaries include the generated `codex-headless-pr.yml` dispatch payload for `direct_pr` decisions. In apply mode, the router triggers that workflow from the trusted shell:

```bash
npm run qa:route-replay-finding -- route \
  --finding /path/to/finding.json \
  --prefer-direct-pr \
  --safe-unattended \
  --portable-context \
  --base-branch main \
  --apply
```

Do not run the router with write-token environment variables while executing untrusted branch code. The apply step should be a short trusted control-plane action only.

## Verification

The dispatch summary includes reviewer-proof instructions that reuse the same rrweb session and timestamp. The expected verification path is to rerender or cite the same rrweb replay evidence, then post reviewer-visible proof links to the issue or PR.
