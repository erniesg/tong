# QA Evidence Uploads

Use this flow when a functional QA run needs reviewable screenshots, GIF previews, or proof videos without checking binary artifacts into git.

## Buckets

- `tong-assets`: runtime product assets served by the app
- `tong-runs`: QA screenshots, proof videos, manifests, and reviewer-facing evidence

Suggested public domains:

- `assets.tong.berlayar.ai`
- `runs.tong.berlayar.ai`

## Environment

Set these in the shell that runs the uploader:

```bash
export TONG_RUNS_R2_BUCKET=tong-runs
export TONG_RUNS_PUBLIC_BASE_URL=https://runs.tong.berlayar.ai
```

The uploader uses the Wrangler auth already configured for `apps/client`.

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

## Render a PR-ready comment

```bash
npm run qa:render-comment -- \
  --run-dir artifacts/qa-runs/functional-qa/erniesg-tong-16/20260314T044052Z
```

This reads `upload-manifest.json` from the run directory and writes `uploaded-comment.md` with:

- direct links to the before/after comparison panel and focused crop when available
- inline GIF preview
- direct link to the MP4 proof recording with audio
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
