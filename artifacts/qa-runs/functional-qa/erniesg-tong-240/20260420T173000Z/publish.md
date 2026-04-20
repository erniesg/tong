# Functional QA Update

- Run ID: `functional-qa-validate-issue-20260420T173000Z-erniesg-tong-240`
- Mode: `validate-issue`
- Issue ref: `erniesg/tong#240`
- Classification: `data-contract-api`
- Execution mode: `safe-unattended`
- Evidence plan: `contract-assertions, network-trace`
- Verdict: `fixed`
- Confidence: `0.89`

## Issue Accuracy

accurate

## Summary

# Summary

- Mode: `validate-issue`
- Target: `erniesg/tong#240`
- Execution mode: `safe-unattended`
- Portability preflight: `portable`
- Verdict: `fixed`
- Confidence: `0.89`

## Notes

- This verify-fix run was captured from branch `codex/issue-240-worker-findings-ledger` in a clean worktree on top of current `origin/main`.
- `npm --prefix apps/worker test` passed with 4/4 targeted ledger tests.
- `npm --prefix apps/worker run deploy -- --dry-run` passed and bundled the Worker with the new D1/R2 bindings intact.
- `npm run demo:smoke` still fails on the pre-existing missing runtime asset `/assets/app/tong_opening.mp4`; that blocker is outside the `#240` Worker lane.
- Local Worker validation on `http://localhost:8788` confirmed:
  - `PUT /api/v1/playtest/sessions/:sessionId/artifacts` ingests `analysis.result.issues[]` from the current Gemini schema and returns ledger metadata.
  - rerunning the same finding dedupes to the same internal `findingId` instead of inserting a duplicate row.
  - `route`, `refs`, `retry`, `reopen`, and `override` all persist the expected lifecycle state.
  - missing findings return `404 {"error":"finding_not_found"}`.
- The live HTTP replay also confirmed the current upstream Worker surfaces remain intact, including the broader CORS header set from `origin/main`.

## Evidence

- `console_logs`: 3 item(s)
- `network_traces`: 9 item(s)
- `contract_assertions`: 4 item(s)
- `cross_env_matrix`: 1 item(s)

## Portability Preflight

- Portability preflight: `portable`
- Portability summary: Portable from repo state plus documented setup.

## Validation Gates

- Execution mode: `safe-unattended`
- Direct issue evidence: `complete`
- UI acceptance gate: `complete`
- Reviewer-proof pack: `not-required`
- Runtime modes exercised: `worker-local, d1-local, r2-local, http-contract`
- Live model confirmation: `confirmed`
- Human review: `complete`

## Regression Checks

- The prior repro no longer occurs. Keep adjacent smoke checks green.

## Open Questions

- None.

## Artifact Bundle

- Summary: `artifacts/qa-runs/functional-qa/erniesg-tong-240/20260420T173000Z/summary.md`
- Steps: `artifacts/qa-runs/functional-qa/erniesg-tong-240/20260420T173000Z/steps.md`
- Evidence: `artifacts/qa-runs/functional-qa/erniesg-tong-240/20260420T173000Z/evidence.json`
- Run manifest: `artifacts/qa-runs/functional-qa/erniesg-tong-240/20260420T173000Z/run.json`

