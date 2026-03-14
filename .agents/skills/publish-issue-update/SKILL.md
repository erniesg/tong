---
name: publish-issue-update
description: Render or publish a structured GitHub issue update from a functional QA artifact bundle using the repo publish policy.
---

# Publish Issue Update

Use this skill to publish or re-publish a structured issue update from an existing functional QA run.

## Shared platform

Read:

- `.agents/skills/_functional-qa/config/publish-policy.json`
- `.agents/skills/_functional-qa/templates/publish-comment.md.tmpl`
- `.agents/skills/_functional-qa/scripts/qa_runtime.py`

## Target input

Use the invocation arguments as either:

- a run directory under `artifacts/qa-runs/...`
- a run id that you first resolve to a run directory

## Workflow

1. Confirm `publish.md` reflects the current `run.json`, `summary.md`, and `evidence.json`.

2. If needed, re-render the publish draft by re-running `finalize-run` on the existing run directory.

3. Publish according to policy:

   ```bash
   python .agents/skills/_functional-qa/scripts/qa_runtime.py publish-github --run-dir <RUN_DIR>
   ```

4. Use `--dry-run` for a safe preview:

   ```bash
   python .agents/skills/_functional-qa/scripts/qa_runtime.py publish-github --run-dir <RUN_DIR> --dry-run
   ```

5. Only force publication if the policy would otherwise skip it and you have a concrete reason:

   ```bash
   python .agents/skills/_functional-qa/scripts/qa_runtime.py publish-github --run-dir <RUN_DIR> --force
   ```

6. If `tong-runs` evidence hosting is configured, upload reviewer-facing artifacts before posting a manual PR comment:

   ```bash
   npm run qa:upload-evidence -- --run-dir <RUN_DIR> --include-supporting
   npm run qa:render-comment -- --run-dir <RUN_DIR>
   ```

   Use the generated `uploaded-comment.md` when you need clean public links, an inline GIF preview, or an MP4 proof link without committing binaries into git.

7. For reviewer-visible UI fixes such as layout, typography, subtitle, translation, tooltip, or focus-style changes, make the published update easy to review:
   - include a full before/after comparison panel
   - include a focused comparison crop when the changed region is small or text-heavy
   - if automation cannot generate those assets yet, say that explicitly and return paste-ready markdown that points to the raw before/after screenshots instead of pretending the evidence is complete

8. Handle issue closure explicitly after publication:

- if the issue is fully fixed and this PR is the complete resolution, use a PR body closing keyword such as `Fixes #123` or close the issue immediately after merge
- if the issue is only partially fixed, keep it open and state the remaining scope directly in the issue update
- do not close umbrella or epic issues from a narrow child PR unless the umbrella itself is truly complete

## Output requirements

- Never publish a run with a placeholder summary.
- Keep GitHub as the default coordination surface.
- Do not describe visual evidence as reviewer-ready when the comment only contains raw run IDs or uncropped artifact links for a subtle UI change.
- If GitHub auth is unavailable, stop and report that explicitly.
