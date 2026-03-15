---
name: validate-issue
description: Validate a GitHub issue or bug report, choose the right evidence strategy, save a rerunnable artifact bundle, and publish a structured issue update when policy allows. Use when the user asks to work through issues, reproduce a bug, verify a fix, or validate current behavior with evidence.
---

# Validate Issue

Use this skill to validate whether an issue is real, accurately described, reproducible, and later verifiable after a fix.

## Shared platform

The shared functional QA platform lives in `.agents/skills/_functional-qa/`.

Read these files before doing substantive work:

- `.agents/skills/_functional-qa/references/classification-rules.md`
- `.agents/skills/_functional-qa/references/evidence-strategies.md`
- `.agents/skills/_functional-qa/references/game-browser-playbook.md` when the issue is on `/game`
- `.agents/skills/_functional-qa/config/repo-adapter.json`
- `.agents/skills/_functional-qa/config/publish-policy.json`
- `docs/agent-native-project-setup.md`

## Target input

Use the invocation arguments as the target issue or surface. Accept:

- GitHub issue number such as `17`
- GitHub issue URL
- Plain-language bug description

If the invocation includes `--verify-fix`, replay the most recent matching validation run before claiming the bug is fixed.

## Workflow

1. Initialize the run scaffold:

   ```bash
   python .agents/skills/_functional-qa/scripts/qa_runtime.py init-run validate-issue --target "$ARGUMENTS"
   ```

   Or for fix verification:

   ```bash
   python .agents/skills/_functional-qa/scripts/qa_runtime.py init-run validate-issue --target "$ARGUMENTS" --verify-fix
   ```

2. Open the generated run directory and use it as the source of truth.

   If the run contains `browser-playbook.md`, use that file as the concrete browser capture plan. For `/game` issues it will also include the QA-mode route and browser helper scripts.

3. Read the issue, issue notes, and classification.

   Before claiming the issue is runnable unattended, check whether the issue body is portable:

- no required `/Users/...` path
- no private-repo-only context without copied summary
- route or surface under test is named
- visible proof sequence is named for UI/timing issues
- a scenario seed or checkpoint is supplied when the issue depends on a deterministic near-proof state

4. Run the repo adapter smoke commands before issue-specific validation unless the target is clearly isolated and the adapter says otherwise.

5. Reproduce or disprove the issue using the evidence plan from `run.json`.

6. For UI issues, do not claim success without visual evidence. Use screenshots, ordered frames, or other temporal capture that matches the selected evidence strategy.

   When the fix changes a reviewer-visible UI surface such as layout, typography, subtitles, translation copy, tooltip content, or focus styling, capture the same state before and after the fix and prepare:
   - one full-frame side-by-side comparison
   - one tighter comparison crop when the changed region is small or text-dense

   If the runtime can expose the proof moment directly, record cue timestamps in logs or structured state, for example `token_tapped_at_ms`, `tooltip_opened_at_ms`, `dictionary_card_visible_at_ms`, or `mission_complete_at_ms`. Use those cues when cutting reviewer-facing GIF previews or poster frames.

   For timing-sensitive or transition bugs, reviewer-visible media is required for a "fixed" claim. A gitignored local artifact path is not enough by itself: attach or link the recording or ordered frames in the PR body, task result, or issue comment. If the runtime cannot make that media visible to reviewers, mark the fix verification incomplete and call out the blocker.

   For reviewer-facing interaction or transition clips, do not race the input. Wait on the readable pre-action state, show the actual tap or click, and hold on the first stable post-action frame. If the clip skips or truncates any of those phases, do not treat it as final acceptance proof.

   If you use deterministic fast-forward, state injection, or a dev jump to reach the proof moment, call that out in `summary.md` and keep the recorded UI semantically coherent to a reviewer. If the visible prompt or HUD contradicts the captured state, downgrade the evidence to engineering-only trace material and rerun a cleaner acceptance clip.

   For CJK or pronunciation-placement issues, capture the actual dialogue text, the tapped tooltip or dictionary state, and where pronunciation appears.

   For AI-output issues, record whether the run exercised live-model output, fallback content, or only a static or dev route. If live-model output was required and unavailable, do not claim a full fix.

   For timing-sensitive `/game` issues, capture:

- readable pre-action state
- actual tap/click if it is part of the bug or proof
- stable post-action result

   If a deterministic checkpoint or scenario seed was used, record it explicitly and say whether it was only a setup shortcut or part of the acceptance proof.

7. If the issue is ambiguous, timing-sensitive, or likely state-race-driven, invoke the `trace-ui-state` workflow before finalizing.

8. Record findings in:

- `summary.md`
- `steps.md`
- `evidence.json`
- `screenshots/`
- comparison assets when the evidence strategy calls for them
- `logs/`
- `browser-playbook.md` and `browser/` when the repo adapter generated a browser-backed capture pack

   Treat the run directory under `artifacts/qa-runs/...` as local staging for the current QA tooling, not as the final reviewer-visible proof surface.

9. Finalize the run:

   ```bash
   python .agents/skills/_functional-qa/scripts/qa_runtime.py finalize-run \
     --run-dir <RUN_DIR> \
     --verdict reproduced|not-reproduced|partially-reproduced|ambiguous|blocked|fixed \
     --repro-status reproduced|not-reproduced|partially-reproduced|ambiguous|blocked|not-run \
     --fix-status not-checked|fixed|still-reproduces|inconclusive \
     --issue-accuracy accurate|stale|misdescribed|n/a \
     --confidence 0.00-1.00
   ```

10. Publish the issue update when policy allows:

   ```bash
   python .agents/skills/_functional-qa/scripts/qa_runtime.py publish-github --run-dir <RUN_DIR>
   ```

   If the run needs reviewer-facing media links rather than a text-only QA update, continue with `capture-reviewer-proof` before considering the publication complete. The published proof should land on `tong-runs` when the uploader is configured; the local run bundle remains the staging source.
   For timing-sensitive interaction fixes that need a reviewer-proof pack, upload the run bundle and then build the proof metadata before the final fixed claim:

   ```bash
   npm run qa:upload-evidence -- --run-dir <RUN_DIR> --include-supporting
   python .agents/skills/_functional-qa/scripts/capture_reviewer_proof.py --run-dir <RUN_DIR>
   ```

11. Decide issue closure status deliberately:

- if the verification run shows the issue is fully fixed and no follow-up scope remains, mark the PR or merge plan to close the issue
- if the work is only partial, keep the issue open and rewrite the issue or publish update so the remaining scope is unambiguous
- for epic or umbrella issues, prefer landing and closing child issues instead of closing the umbrella from a narrow PR

## Output requirements

- Use the artifact bundle under `artifacts/qa-runs/functional-qa/...` as the required local staging bundle.
- Make the repro checklist rerunnable.
- If `--verify-fix` was used, explicitly compare against the previous run before claiming a fix.
- If a required evidence type is unavailable, lower confidence and say why.
- For reviewer-visible UI fixes, do not stop at generic screenshots when a comparison view would make the delta materially easier to review.
- Prefer runtime-emitted cue timestamps over visual guesswork when selecting reviewer-facing frames. Treat video-understanding or OCR as a fallback layer, not the primary source of truth, when deterministic state cues are available.
- Do not treat a local screenshot or `.webm` path under `artifacts/qa-runs/` as reviewer-visible proof unless the media is also attached or linked where reviewers can open it.
- For reviewer-facing publication, prefer uploaded `tong-runs` URLs over local artifact paths.
- Do not call a clip reviewer-ready if it omits the visible input, races through the proof moment, or starts from a semantically confusing state created by a deterministic jump.
- If the issue execution mode is `validate-and-propose-only` or `needs-human-design-review`, stop after validation evidence and proposal instead of making unattended UX or product changes.
- If the issue body is not portable enough for remote execution, record that gap in `summary.md` and `evidence.json` before proceeding.
