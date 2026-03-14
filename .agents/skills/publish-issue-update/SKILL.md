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

## Output requirements

- Never publish a run with a placeholder summary.
- Keep GitHub as the default coordination surface.
- If GitHub auth is unavailable, stop and report that explicitly.
