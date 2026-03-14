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
2. Generates a GIF preview and poster frame for uploaded videos.
   By default the preview is taken from the end of the recording, so reviewer-facing evidence shows the actual interaction moment instead of the setup frames.
3. Uploads everything to `tong-runs` under:

```text
qa-runs/<suite>/<target-slug>/<run-id>/...
```

4. Writes a local upload manifest in the run directory and uploads `manifest.json` beside the evidence files.

## Render a PR-ready comment

```bash
npm run qa:render-comment -- \
  --run-dir artifacts/qa-runs/functional-qa/erniesg-tong-16/20260314T044052Z
```

This reads `upload-manifest.json` from the run directory and writes `uploaded-comment.md` with:

- inline GIF preview
- direct link to the MP4 proof recording with audio
- dialogue and tooltip screenshot links
- selected trace and summary links

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
- For browser or untrusted uploaders later, switch to presigned URLs behind a small Worker instead of direct Wrangler auth.
