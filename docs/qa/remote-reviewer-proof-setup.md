# Remote Reviewer-Proof Setup

Use this when you want a local or remote operator to publish reviewer-visible QA clips from Tong.

## What "remote ready" means

Remote proof is ready when all of the following are true:
- the issue is portable from tracked repo state plus environment setup
- the shell that will publish evidence has the `tong-runs` uploader env configured
- the shell has the media tooling needed by the uploader
- the resulting PR or issue comment links public `tong-runs` URLs instead of local artifact paths

This is enough for short reviewer-proof clips on portable issues.

It is not the same as final product acceptance. The full end-to-end acceptance recording still stays local/browser-backed after the progression issues land.

## Required environment

Export these before trying to publish reviewer-visible proof:

```bash
export TONG_RUNS_R2_BUCKET=tong-runs
export TONG_RUNS_PUBLIC_BASE_URL=https://runs.tong.berlayar.ai
```

The uploader uses the Wrangler auth already configured for `apps/client`.

## Required tooling

The publishing shell needs:
- `node`
- `npm`
- `python3`
- `ffmpeg`
- `ffprobe`
- `npm --prefix apps/client exec wrangler -- --version`

Optional but recommended:
- `magick`

Without `magick`, upload still works, but the auto-generated comparison panel and focused crop are skipped.

## One-command preflight

Run this in the exact shell or environment that will publish the evidence:

```bash
npm run qa:preflight-reviewer-proof
```

The command fails if a required env var, tool, or repo entry point is missing.

## Publishing flow

From an existing QA run bundle:

```bash
npm run qa:upload-evidence -- --run-dir <RUN_DIR> --include-supporting
python3 .agents/skills/_functional-qa/scripts/capture_reviewer_proof.py --run-dir <RUN_DIR>
npm run qa:render-comment -- --run-dir <RUN_DIR>
```

Expected outputs:
- `upload-manifest.json`
- `reviewer-proof.json`
- `reviewer-proof.md`
- `uploaded-comment.md`

Required review surface:
- `uploaded-comment.md` should point at public `tong-runs` URLs
- do not treat `artifacts/qa-runs/...` as reviewer-visible proof

## Codex cloud handoff

Before sending a portable issue to Codex cloud:

```bash
npm run codex:cloud-plan
```

Use the generated task prompt and PR notes for the issue. If the issue needs timing-sensitive proof, keep the evidence requirement explicit in the task prompt and require public links in the final PR body or comment.

## Current acceptance boundary

As of March 15, 2026:
- remote can publish reviewer-visible clips for portable issue validation and fix verification
- remote should not be treated as the final full-demo acceptance recorder yet

Why:
- `#49` landed the persisted checkpoint backend path
- `#50` is still needed for player-facing return-to-map and resume UX
- `#51` is still needed for deterministic `/game` checkpoint mounts that make short proof clips practical
