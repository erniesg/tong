---
name: capture-reviewer-proof
description: Capture short reviewer-facing proof for timing-sensitive UI interactions, including the readable pre-action state, visible input, stable post-action result, and reviewer-visible links.
---

# Capture Reviewer Proof

Use this skill after validation or fix verification when a human reviewer needs direct visual evidence.

## Shared platform

Read:

- `.agents/skills/_functional-qa/references/evidence-strategies.md`
- `.agents/skills/_functional-qa/references/game-browser-playbook.md` for `/game`
- `.agents/skills/_functional-qa/config/repo-adapter.json`
- `docs/codex-cloud-issue-runbook.md`
- `docs/qa-evidence-uploads.md`

## Workflow

1. Start from a validated or verified issue run.
2. If a deterministic checkpoint or scenario seed exists, use it only to reach the near-proof state.
3. Wait for the readable ready state before recording.
4. Show the actual tap or click if it is part of the issue or fix.
5. Linger long enough on the post-action state for a reviewer to verify the result.
6. Export:
   - short clip
   - GIF preview
   - ordered stills for pre-action, ready, post-input, and stable post-action
7. Record the proof metadata in `evidence.json` under `reviewer_proof`:
   - `classification`: `reviewer-proof` or `trace-only`
   - real route and optional scenario seed
   - ordered still paths for `pre_action`, `ready_state`, `immediate_post_input`, `later_transition`, and `stable_post_action`
   - cue timestamps for the proof moment
   - checks for semantic coherence, visible input, readable hold, stable post-action, and reviewer-visible media
8. Prefer the configured uploader flow in `docs/qa-evidence-uploads.md`.
   The standard `publish-github` runtime now auto-attempts this upload path for runs with visual evidence, so only do it manually when you need to inspect or edit `uploaded-comment.md` first.
9. After upload, build the reviewer-proof pack:

   ```bash
   python .agents/skills/_functional-qa/scripts/capture_reviewer_proof.py --run-dir <RUN_DIR>
   ```

   This writes `reviewer-proof.json`, `reviewer-proof.md`, and augments `upload-manifest.json` so the rendered comment can include ordered-frame links and cue timestamps.
10. If hosted upload is unavailable, fall back to reviewer-openable git-tracked files on a dedicated branch or PR. Do not leave the reviewer with local-only artifact paths.
11. Update the PR body or issue comment with public links.

## Output requirements

- Do not call local artifact paths “proof” if the reviewer cannot open them from the PR or issue comment.
- Say whether the clip uses a deterministic setup shortcut or a purely live path.
- Reject captures that are semantically confusing, truncated, or omit the input event.
