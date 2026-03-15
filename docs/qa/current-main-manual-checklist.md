# Current Main Manual QA Checklist

Use this checklist to validate the merged baseline on `main` as of March 15, 2026.

Covered scope:
- `#46` reviewer-proof upload and render workflow
- `#48` session/checkpoint contract shape
- `#49` persisted hangout checkpoint resume path
- `#61` starter-pack and reward-hook content fixes

This is a current-state checklist, not final product acceptance. `#50` and `#51` are still open, so do not fail the build just because player-facing map-return resume is not wired yet.

## 1. Sync and install

```bash
git checkout main
git pull origin main

npm --prefix apps/server install
npm --prefix apps/client install
```

Pass when both installs complete without dependency or postinstall errors.

## 2. Run repo smoke

```bash
npm run demo:smoke
```

Pass when the command exits `0`.

What this confirms:
- shared fixtures and contracts still parse
- runtime/demo fixture integrity is intact
- recent content-template corrections did not reintroduce canonical-id drift

## 3. Seed mock ingest data

```bash
npm run ingest:mock
```

Pass when the mock ingestion pipeline completes without crashing.

## 4. Validate the persisted checkpoint API flow

Terminal 1:

```bash
npm run dev:server
```

Terminal 2:

```bash
npm run test:api-flow:local
```

Pass when the strict local flow includes these markers:
- `PASS /api/v1/game/start-or-resume`
- `PASS /api/v1/scenes/hangout/start`
- `PASS /api/v1/scenes/hangout/respond`
- `PASS /api/v1/game/start-or-resume resume`

What this confirms:
- the server writes a checkpoint after a hangout turn
- a later `start-or-resume` reuses the active session
- resume comes back from the stored checkpoint instead of fabricating a fresh scene

## 5. Run a browser sanity pass on `/game`

Terminal 3:

```bash
NEXT_PUBLIC_TONG_API_BASE=http://localhost:8787 npm run dev:client
```

Open:

```text
http://localhost:3000/game?demo=TONG-JUDGE-DEMO
```

Confirm:
- the page loads without a fatal error
- you can start a hangout
- the first scene renders dialogue, objective state, and normal controls
- refreshing the route does not crash the bootstrap path

Expected current limitation:
- there is not yet a finished player-facing `Return to world map` and `Resume active hangout` UX from an in-progress scene. That is `#50`.

## 6. Check reviewer-proof publication readiness

```bash
npm run qa:preflight-reviewer-proof
```

Pass when required env vars, tools, and repo entry points all report `PASS`.

If you already have a finished QA run bundle, publish a reviewer-visible proof pack:

```bash
npm run qa:upload-evidence -- --run-dir <RUN_DIR> --include-supporting
python3 .agents/skills/_functional-qa/scripts/capture_reviewer_proof.py --run-dir <RUN_DIR>
npm run qa:render-comment -- --run-dir <RUN_DIR>
```

Pass when:
- `<RUN_DIR>/upload-manifest.json` exists
- `<RUN_DIR>/reviewer-proof.md` exists for timing-sensitive proof runs
- `<RUN_DIR>/uploaded-comment.md` contains public `tong-runs` links instead of local-only artifact paths

## 7. Know the acceptance boundary

Current `main` is ready for:
- local validation of the persisted resume/checkpoint backend path
- reviewer-visible proof publication for portable QA runs, if uploader env is configured

Current `main` is not yet the final gameplay acceptance baseline because:
- `#50` still needs the player-facing world-map return/resume UX
- `#51` still needs deterministic `/game` checkpoint mounts for short proof capture
- the final full-route acceptance clip still needs one local browser-backed run after those land
