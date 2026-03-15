# QA Evidence Uploads

Use two layers for QA evidence:

1. `artifacts/qa-runs/`
   - Local workspace staging area for run manifests, summaries, browser playbooks, logs, screenshots, and intermediate media.
   - Gitignored by design.
   - Required today because the functional QA scripts still write their run bundles there via `.agents/skills/_functional-qa/config/repo-adapter.json`.
2. `tong-runs`
   - External QA evidence host for reviewer-visible clips, GIFs, stills, and published manifests.
   - This is the surface PRs and issues should link to when a human needs to validate correctness remotely.

`artifacts/qa-runs/` remains the local source of truth for reruns, diffing, and debug context. It is not the final reviewer-proof destination.

## Buckets

- `tong-assets`: runtime product assets served by the app
- `tong-runs`: QA screenshots, proof videos, manifests, and reviewer-facing evidence

Suggested public domains:

- `assets.tong.berlayar.ai`
- `runs.tong.berlayar.ai`

## Environment

Set uploader env vars in the shell that runs QA evidence publication:

```bash
export TONG_RUNS_R2_BUCKET=tong-runs
export TONG_RUNS_PUBLIC_BASE_URL=https://runs.tong.berlayar.ai
```

Runtime asset contract reference (managed by runtime app/deploy config, not the uploader):

```bash
export TONG_ASSETS_R2_BUCKET=tong-assets
export NEXT_PUBLIC_TONG_ASSETS_BASE_URL=https://assets.tong.berlayar.ai
export TONG_RUNTIME_ASSET_MANIFEST_KEY=runtime-assets/manifest.json
```

Boundary reminder:

1. `TONG_ASSETS_R2_BUCKET` + `NEXT_PUBLIC_TONG_ASSETS_BASE_URL` are for player-facing runtime assets only.
2. `TONG_RUNS_R2_BUCKET` + `TONG_RUNS_PUBLIC_BASE_URL` are for reviewer-facing QA evidence only.
3. `TONG_RUNTIME_ASSET_MANIFEST_KEY` points to the canonical runtime manifest path.

The uploader uses the Wrangler auth already configured for `apps/client`.

## Preflight the publishing shell

Before asking a local or remote operator to publish reviewer-visible proof, run:

```bash
npm run qa:preflight-reviewer-proof
```

This checks:
- `TONG_RUNS_R2_BUCKET`
- `TONG_RUNS_PUBLIC_BASE_URL`
- `node`, `npm`, `python3`, `ffmpeg`, and `ffprobe`
- `wrangler` through `apps/client`
- the repo entry points used by upload, proof-pack generation, and comment rendering

`magick` is reported as a warning rather than a hard failure because upload still works without auto-generated comparison panels.

## Upload a run bundle

```bash
npm run qa:upload-evidence -- \
  --run-dir artifacts/qa-runs/functional-qa/erniesg-tong-16/20260314T044052Z \
  --include-supporting
```

What this does:

1. Collects screenshots, proof video, summary, and optional supporting traces from the run bundle.
2. For reviewer-visible UI fixes on `--verify-fix` runs, auto-generates:
   - a full before/after comparison panel
   - a focused comparison crop around the detected changed region
3. Generates a GIF preview and poster frame for uploaded videos.
   By default the preview is taken from the end of the recording, so reviewer-facing evidence shows the actual interaction moment instead of the setup frames.
4. Uploads everything to `tong-runs` under:

```text
qa-runs/<suite>/<target-slug>/<run-id>/...
```

5. Writes a local upload manifest in the run directory and uploads `manifest.json` beside the evidence files.

Comparison generation uses the previous validation run linked in `run.json.previous_run_id`. That means the normal path is:

1. run `validate-issue` before the fix
2. run `validate-issue --verify-fix` after the fix
3. upload the verify-fix run bundle

For timing-sensitive reviewer-proof runs, follow the upload with:

```bash
python .agents/skills/_functional-qa/scripts/capture_reviewer_proof.py \
  --run-dir artifacts/qa-runs/functional-qa/erniesg-tong-18/20260314T115603Z
```

That script validates the `reviewer_proof` block in `evidence.json`, writes `reviewer-proof.json` and `reviewer-proof.md`, and augments `upload-manifest.json` with:

1. reviewer-proof status (`reviewer-proof`, `trace-only`, or `incomplete`)
2. ordered frame links for the proof sequence
3. cue timestamps for the proof moment
4. route and deterministic-setup notes
5. any missing reviewer-ready requirements

## Render a PR-ready comment

```bash
npm run qa:render-comment -- \
  --run-dir artifacts/qa-runs/functional-qa/erniesg-tong-16/20260314T044052Z
```

This reads `upload-manifest.json` from the run directory and writes `uploaded-comment.md` with:

- direct links to the before/after comparison panel and focused crop when available
- inline GIF preview
- direct link to the MP4 proof recording with audio
- reviewer-proof stage links and cue timestamps when `capture_reviewer_proof.py` populated the manifest
- dialogue and tooltip screenshot links
- selected trace and summary links

The functional QA publisher now auto-attempts this upload-and-render path during:

```bash
python .agents/skills/_functional-qa/scripts/qa_runtime.py publish-github --run-dir <RUN_DIR>
```

If the run includes screenshots or temporal capture evidence and the uploader succeeds, GitHub gets `uploaded-comment.md` automatically. Use `--no-auto-evidence-upload` only when you intentionally want the plain `publish.md` fallback.

## Dry-run locally

Use `--dry-run` to generate previews and a manifest without uploading:

```bash
npm run qa:upload-evidence -- \
  --run-dir artifacts/qa-runs/functional-qa/erniesg-tong-16/20260314T044052Z \
  --include-supporting \
  --dry-run
```

## Notes

- Do not commit generated QA binaries into git once this flow is in place.
- Use uploaded URLs in PR comments instead of repo blob links.
- If auto-generation cannot find the previous run, cannot match same-state screenshots, or `magick` is unavailable, the rendered comment now calls that out explicitly instead of silently degrading.
- Manual fallback: add pre-rendered files under `comparison_panels` and `comparison_focus_crops` in `evidence.json`, then rerun the uploader.
- If the uploader is unavailable in the current environment, use a dedicated reviewer-proof branch or PR with tracked GIF, stills, summary, and machine-readable trace files. Post those GitHub links instead of local artifact paths.
- For browser or untrusted uploaders later, switch to presigned URLs behind a small Worker instead of direct Wrangler auth.
