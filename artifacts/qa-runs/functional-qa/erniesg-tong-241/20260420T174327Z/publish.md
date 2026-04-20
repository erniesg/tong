# Functional QA Update

- Run ID: `functional-qa-validate-issue-20260420T174327Z-erniesg-tong-241`
- Mode: `validate-issue`
- Issue ref: `erniesg/tong#241`
- Classification: `data-contract-api`
- Execution mode: `safe-unattended`
- Evidence plan: `contract-assertions, network-trace`
- Verdict: `fixed`
- Confidence: `0.76`

## Issue Accuracy

accurate

## Summary

# Summary

- Mode: `validate-issue`
- Target: `erniesg/tong#241`
- Execution mode: `safe-unattended`
- Portability preflight: `portable`
- Verdict: `fixed`
- Confidence: `0.76`

## Notes

- This implementation is stacked on branch `codex/issue-240-worker-findings-ledger` because `#241` depends on the `#240` Worker ledger contract.
- `npm run test:playtest-orchestrator` passed with 5/5 unit tests covering protected-path routing, issue matching, direct-PR routing, and fallback decisions.
- A live dry-run against the local Worker ledger on `http://localhost:8788` inspected two seeded findings and chose:
  - `direct_pr` for a single-lane non-protected `apps/client/components/scene/ContinueButton.tsx` finding
  - `human_review` for a protected-path `.github/workflows/qa-publish.yml` finding
- The new workflow was not executed end-to-end in GitHub Actions from this run because `main` does not yet carry the `#240` findings ledger endpoints. Validation here proves the route engine and workflow shape locally, not a deployed remote run on `main`.

## Evidence

- `console_logs`: 2 item(s)
- `network_traces`: 2 item(s)
- `contract_assertions`: 3 item(s)
- `cross_env_matrix`: 1 item(s)

## Portability Preflight

- Portability preflight: `portable`
- Portability summary: Portable from repo state plus documented setup.

## Validation Gates

- Execution mode: `safe-unattended`
- Direct issue evidence: `complete`
- UI acceptance gate: `complete`
- Reviewer-proof pack: `not-required`
- Runtime modes exercised: `worker-local, http-contract, orchestrator-dry-run`
- Live model confirmation: `confirmed`
- Human review: `complete`

## Regression Checks

- The prior repro no longer occurs. Keep adjacent smoke checks green.

## Open Questions

- None.

## Artifact Bundle

- Summary: `artifacts/qa-runs/functional-qa/erniesg-tong-241/20260420T174327Z/summary.md`
- Steps: `artifacts/qa-runs/functional-qa/erniesg-tong-241/20260420T174327Z/steps.md`
- Evidence: `artifacts/qa-runs/functional-qa/erniesg-tong-241/20260420T174327Z/evidence.json`
- Run manifest: `artifacts/qa-runs/functional-qa/erniesg-tong-241/20260420T174327Z/run.json`

