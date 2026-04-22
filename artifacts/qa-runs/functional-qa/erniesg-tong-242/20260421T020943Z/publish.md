# Functional QA Update

- Run ID: `functional-qa-validate-issue-20260421T020943Z-erniesg-tong-242`
- Mode: `validate-issue`
- Issue ref: `erniesg/tong#242`
- Classification: `persistence-state-sync`
- Execution mode: `safe-unattended`
- Evidence plan: `console-state-trace, contract-assertions`
- Verdict: `fixed`
- Confidence: `0.81`

## Issue Accuracy

accurate

## Summary

# Summary

- Mode: `validate-issue`
- Target: `erniesg/tong#242`
- Execution mode: `validate-and-propose-only`
- Portability preflight: `portable`
- Verdict: `fixed`
- Confidence: `0.81`

## Notes

- This implementation is stacked on `#248` because the queue surface depends on the `#241` orchestrator and the `#240` Worker ledger.
- `npm --prefix apps/worker test` passed with coverage for the additive queue listing endpoint and route-status filters.
- `node --test scripts/__tests__/playtest-orchestrator.test.mjs scripts/__tests__/playtest-queue.test.mjs` passed with coverage for manual override routing, trusted queue command parsing, digest rendering, and queue action helpers.
- A local Worker on `http://127.0.0.1:8789` was seeded with two findings:
  - a `direct_pr`-routed `apps/client/components/scene/ContinueButton.tsx` finding with linked issue/PR refs
  - a protected `.github/workflows/qa-publish.yml` finding held through the new queue control surface
- `node scripts/playtest-queue.mjs --dry-run` rendered a queue digest with `blocked=1` and `in_progress=1`.
- A follow-up `node scripts/playtest-orchestrator.mjs --dry-run` returned zero unrouted findings after the hold action, proving the queue override was not silently re-routed by later passes.
- The workflow was not allowed to post a real GitHub digest comment from this validation run because that would mutate the live repository issue. The local dry-run plus unit coverage validate the behavior without side effects.

## Evidence

- `console_logs`: 2 item(s)
- `network_traces`: 5 item(s)
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
- Runtime modes exercised: `worker-local, http-contract, queue-dry-run`
- Live model confirmation: `confirmed`
- Human review: `complete`

## Regression Checks

- The prior repro no longer occurs. Keep adjacent smoke checks green.

## Open Questions

- None.

## Artifact Bundle

- Summary: `artifacts/qa-runs/functional-qa/erniesg-tong-242/20260421T020943Z/summary.md`
- Steps: `artifacts/qa-runs/functional-qa/erniesg-tong-242/20260421T020943Z/steps.md`
- Evidence: `artifacts/qa-runs/functional-qa/erniesg-tong-242/20260421T020943Z/evidence.json`
- Run manifest: `artifacts/qa-runs/functional-qa/erniesg-tong-242/20260421T020943Z/run.json`

