# QA Evidence Uploads

Use two layers for QA evidence:

1. `artifacts/qa-runs/`
   - Local workspace staging area for run manifests, summaries, browser playbooks, logs, screenshots, and intermediate media.
   - Gitignored by design.
   - Required today because the functional QA scripts still write their run bundles there via `.agents/skills/_functional-qa/config/repo-adapter.json`.
2. `tong-runs`
   - External QA evidence host for reviewer-visible clips, GIFs, stills, and published manifests.
   - This is the surface PRs and issues should link to when a human needs to validate correctness remotely.

## Current rule

`artifacts/qa-runs/` is still needed today.

It is the local source of truth for:
- rerunning or diffing previous validation attempts
- reconstructing issue timelines
- generating `publish.md` and other run outputs
- debugging failed or ambiguous capture attempts

It is not the final reviewer-proof destination.

## Boundary between local and published evidence

Use the local bundle for agent work and the external host for human review.

- Local bundle:
  - `run.json`
  - `summary.md`
  - `publish.md`
  - browser scripts and trace exports
  - raw screenshots and intermediate recordings
- Published evidence:
  - short MP4/WebM clips
  - GIF previews
  - selected still frames
  - stable public URLs referenced from PRs or GitHub issues

Do not cite local filesystem paths as reviewer-visible proof.

## Intended architecture

The intended split is:

1. Functional QA writes a complete local run bundle under `artifacts/qa-runs/`.
2. Reviewer-proof tooling uploads the selected acceptance artifacts to `tong-runs`.
3. PR comments and issue updates reference the published URLs, not the local bundle path.
4. The local bundle remains available for reruns and debugging even after publish.

This lets us keep rich local manifests without committing bulky artifacts into the repo.

## What is still missing

The repo does not yet have a first-class upload pipeline that turns a local run bundle into a published reviewer-proof package automatically.

That missing piece is the gap tracked by the remote-first QA work:
- `#35` runtime asset and evidence host contract
- `#46` first-class reviewer-proof capture and upload workflow

Until that is implemented, `artifacts/qa-runs/` remains necessary even if the long-term reviewer-facing destination is `tong-runs`.

## Migration target

Once the upload flow is automated, we can choose one of two models:

- Keep `artifacts/qa-runs/` as a repo-local cache/staging area.
- Move the local staging path outside the repo entirely.

Do not remove or rename `artifacts/qa-runs/` until the scripts and manifests no longer depend on it.
