# Steps

1. Ran repo smoke from the adapter: `npm run demo:smoke`.
2. Ran targeted Worker verification: `npm --prefix apps/worker test`.
3. Verified the Worker package build path: `npm --prefix apps/worker run deploy -- --dry-run`.
4. Applied local D1 migrations with `npx wrangler d1 migrations apply tong-signups --local` from `apps/worker`.
5. Started the local Worker via `npm run dev` in `apps/worker`.
6. Exercised the live HTTP contract on a fresh session `verify-240-clean-branch`:
   - uploaded analysis artifact in the current `analysis.result.issues[]` shape
   - listed unrouted findings
   - reran the same artifact to verify dedupe/idempotency
   - updated route state
   - attached GitHub issue/PR refs
   - retried and reopened the finding
   - applied a manual override
   - confirmed missing-finding lifecycle calls return `404`
7. Preserved the newer `origin/main` Worker routes while layering the `#240` ledger hunks on top in a clean branch worktree.

## Validation Gates

- Execution mode: `safe-unattended`
- Direct issue evidence required: `no`
- UI acceptance gate required: `no`
- Live model required for a fixed verdict: `no`
- Human review required before a fixed verdict: `no`

### Portability Preflight

- Portability preflight: `portable`
- Portability summary: Portable from repo state plus documented setup.

## Replay the previous run

- Previous run id: `functional-qa-validate-issue-20260420T171534Z-erniesg-tong-240`
- Previous run dir: `/Users/erniesg/code/erniesg/tong-240-pr/artifacts/qa-runs/functional-qa/erniesg-tong-240/20260420T171534Z`
- Reuse the prior steps before claiming a fix.
