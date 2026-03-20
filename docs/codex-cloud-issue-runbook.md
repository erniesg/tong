# Codex Cloud Issue Runbook

Use this runbook when you want Codex cloud tasks to work Tong issues through the Codex environment UI and create PRs from task results instead of local worktrees.

Use `docs/agent-native-project-setup.md` as the source of truth for Project fields, lane ownership, and issue portability rules.
Use `docs/qa-evidence-uploads.md` as the source of truth for the boundary between local QA bundles and published reviewer-visible proof.

## What Codex cloud can and cannot see

Codex cloud tasks work from the repository checkout plus the cloud environment setup. They do not inherit arbitrary local files from a laptop. Relevant docs:

- [Cloud environments](https://developers.openai.com/codex/cloud/environments)
- [Use Codex in GitHub](https://developers.openai.com/codex/integrations/github)
- [Worktrees](https://developers.openai.com/codex/app/worktrees)

Practical rule:

1. If an issue can be reproduced from tracked code, fixtures, and setup commands, it can be a cloud issue.
2. If it depends on local-only assets, unpublished media, or unreproducible device/local state, keep it local until that dependency is moved to a shared location.
3. If `Portable Context` is not `Yes`, do not send it to Codex cloud as an unattended fix task.

## Prerequisites outside the repo

1. The Codex GitHub integration must be installed for this repository.
2. The Codex cloud environment should run the Tong setup commands:
   - `npm --prefix apps/server install`
   - `npm --prefix apps/client install`
   - `npm run demo:smoke`
   - `npm run ingest:mock`
3. The shell that will publish reviewer-visible QA evidence should pass:
   - `npm run qa:preflight-reviewer-proof`
4. If cloud tasks need large or private assets later, move them to shared storage first. Until then, leave asset-dependent issues as local-only.

## Repo entry points

1. Functional QA front door:
   - `.agents/skills/work-github-issues/SKILL.md`
2. Cloud queue generator:
   - `python .agents/skills/_functional-qa/scripts/codex_cloud_queue.py plan`
3. Shortcut:
   - `npm run codex:cloud-plan`

The generator writes:

1. `cloud-plan.json`
2. `cloud-plan.md`
3. `launch.md`
4. per-issue task prompt and PR notes files

Each generated issue entry now includes a portability preflight summary. Treat `non-portable` as a hard stop for unattended cloud execution and use the listed blockers to update the issue body or Project fields before retrying.

under `artifacts/qa-runs/functional-qa/codex-cloud-queue/<timestamp>/`.

This is local staging, not the reviewer-visible evidence host.

## Suggested GitHub labels

1. `cloud-ok`
2. `local-only`
3. `needs-acceptance-proof`

These are supplemental hints. The authoritative execution gates should live on the GitHub Project fields:

- `Workflow Status`
- `Execution Mode`
- `Portable Context`
- `Proof Required`
- `Scenario Seed`
- `Checkpoint Needed`
- `Agent Ready`

The generator emits these as suggestions; it does not modify GitHub labels directly.

## Current Tong batching order

### Batch 1: remote-first platform

- `#29` remote-first umbrella
- `#35` runtime asset bucket/env contract
- `#36` canonical runtime asset manifest
- `#37` runtime asset resolution with fallbacks
- `#38` fail smoke on unresolved runtime asset references
- `#46` reviewer-proof capture workflow

These unblock unattended cloud execution and reviewer-visible proof.

### Batch 2: progression and deterministic checkpoints

- progression epic and child issues for resumable sessions, world-map return, and deterministic `/game` checkpoints

These make unattended validation and short proof captures practical without replaying the entire hangout loop.

### Batch 3: playtest polish that is safe-unattended

- `#12`
- `#31`
- `#42`

These are the next visual/gameplay fixes once runtime assets and proof tooling are stable.

### Validation-first only

- `#11`
- `#14`
- `#17`
- `#19`

These should stay `validate-and-propose-only` or `needs-human-design-review` until a human narrows the product decision or technical direction.

## Recommended cloud workflow

1. Generate the cloud plan:

   ```bash
   npm run codex:cloud-plan
   ```

2. Start with the earliest batch only.
3. For each issue in the batch:
   - open `chatgpt.com/codex`
   - choose the `tong` environment
   - start a new task using the generated task prompt file
   - let Codex return a diff
   - create the PR from the task result
4. Let Codex:
   - validate the issue
   - fix the code
   - re-validate with `--verify-fix`
   - put reviewer-visible evidence in the task result or PR body, not just a local artifact path
5. Ask for `@codex review` on the PR if wanted after the PR exists.
6. Have a human review and merge.
7. Move to the next batch after the earlier batch stabilizes.

Important delivery rules:

1. The primary implementation path is a direct Codex environment task, not a GitHub comment trigger.
2. Do not rely on shell-level `git push` or `gh` CLI from inside the cloud task.
3. Use Codex's built-in diff and PR creation flow from the task result.
4. Artifact directories under `artifacts/qa-runs/` are gitignored local staging. Evidence must be summarized in the task result or PR body or uploaded to the external QA evidence host before it counts as reviewer-visible proof. If a fix needs visual proof and that cannot be done, leave the verification incomplete and require a final local/browser-backed acceptance recording.
5. Reserve `@codex` GitHub comments for review or explicitly manual experiments, not the default implementation path.
6. Do not treat a truncated or deterministic-jump clip as final acceptance proof unless the interaction sequence is still legible to a human reviewer: readable pre-action state, visible input, and stable post-action result.
7. For timing-sensitive `/game` issues, prefer seeded checkpoint setup plus a short route-faithful proof clip over a full playthrough.
8. For timing-sensitive fix verification, add `reviewer_proof` metadata to `evidence.json`, run `capture_reviewer_proof.py`, and make sure the rendered comment includes ordered frame links and cue timestamps instead of a generic screenshot list.
9. Do not treat local-only artifact paths as reviewer-visible proof.

## Trusted publish via GitHub Actions

When a Codex cloud task cannot post GitHub comments or upload reviewer-proof artifacts directly because task-shell secrets are unavailable, use the trusted GitHub Actions workflow instead.

Trigger options:

1. Add a `QA Publish Request` JSON block to the PR body.
2. Comment `/qa-publish` on the PR as a maintainer.
3. Or run the `Trusted QA Publish` workflow manually with `pr_number`.

Current behavior:

1. The workflow uses trusted GitHub Actions credentials (`GITHUB_TOKEN`) plus repo Cloudflare secrets for publish/upload.
2. It installs the reviewer-proof tooling (`ffmpeg`, `ffprobe`, ImageMagick, Wrangler auth checks) and runs `npm run qa:preflight-reviewer-proof` in the publishing shell.
3. If the requested `run_dir` exists in the checked-out branch, it runs the existing trusted publish path:

   ```bash
   python .agents/skills/_functional-qa/scripts/qa_runtime.py publish-github --run-dir <RUN_DIR>
   ```

4. If the `run_dir` is not repo-visible but the metadata provides a supported `qa_recipe`, the workflow starts local demo services in CI, regenerates a fresh run bundle, and publishes from that CI-created bundle.
5. If neither a repo-visible `run_dir` nor a supported `qa_recipe` is available, the workflow comments a precise blocker instead of pretending publication succeeded.

Important limitation:

- `artifacts/qa-runs/...` is gitignored local staging, so Codex cloud task bundles are not automatically present in the GitHub Actions checkout unless you commit or otherwise publish them into GitHub-visible state.
- CI regeneration only works for explicitly supported `qa_recipe` values. Prefer scaffolding new recipes with `npm run qa:new-recipe -- --issue-ref <owner/repo#num>` so the runner, dispatcher, and default issue mapping stay in sync.
- Before scaffolding, run `npm run qa:suggest-recipe -- --issue-ref <owner/repo#num>` so the decision between existing recipe, new recipe, `trace-ui-state`, and `capture-reviewer-proof` stays explicit.

## Trusted PR creation from GitHub-visible patch artifacts

When a Codex cloud task cannot create a PR directly, you can hand GitHub Actions a patch that is visible to GitHub and let the repo create the branch and PR for you.

Trigger options:

1. Run the `Trusted Codex Create PR` workflow with:
   - `new_branch`
   - `pr_title`
   - one patch source: `patch_text`, `patch_url`, or `patch_path`
2. Or comment `/codex-create-pr` on an issue with:
   - a `## Codex PR Request` JSON block
   - a fenced ```diff block containing the patch

Example issue comment:

~~~md
/codex-create-pr

## Codex PR Request
```json
{
  "base_branch": "main",
  "new_branch": "codex/issue-49-checkpoint-resume",
  "pr_title": "fix: issue #49 - persist and resume hangout checkpoints",
  "issue_ref": "erniesg/tong#49",
  "qa_publish_request": {
    "issue_ref": "erniesg/tong#49",
    "route": "/game",
    "qa_recipe": "haeun_fresh_demo"
  }
}
```

```diff
diff --git a/file.ts b/file.ts
...
```
~~~

Current behavior:

1. The workflow applies the patch onto the requested base branch.
2. It commits and pushes a `codex/*` branch.
3. It opens the PR with the supplied PR body plus the `QA Publish Request` block.
4. If `auto_qa_publish` is enabled, it explicitly dispatches the `Trusted QA Publish` workflow for the newly created PR. This is required because PRs created with `GITHUB_TOKEN` do not automatically fan out into new workflow runs.

Important limitation:

- GitHub Actions cannot see a patch or run bundle that exists only inside Codex cloud task storage.
- The patch must first be made visible to GitHub, for example as workflow input text, a repo-visible patch file, or an issue comment diff block.

## Fully automatic future PRs

If you want future PR creation to be automatic rather than manually clicking `Create PR` in Codex cloud, use the `Codex Headless PR` workflow instead of the Codex cloud web task as the PR engine.

Current behavior:

1. GitHub Actions checks out the repo and runs Codex headlessly with a supplied prompt.
2. `peter-evans/create-pull-request` commits the Codex changes and opens the PR.
3. The PR body includes the `QA Publish Request` block automatically.
4. If `auto_qa_publish` is enabled, the workflow explicitly dispatches `Trusted QA Publish`, which can regenerate reviewer-proof evidence in CI from a supported `qa_recipe`.

Use this path when you want:

- automatic PR creation
- automatic QA publish dispatch
- no manual transfer of patches out of Codex cloud task storage

Use the Codex cloud web task path only when you specifically want an interactive remote coding session and are willing to create the PR manually afterward.

## Acceptance policy

Issue workers are not the final product signoff.

After the merged cloud batches, run one local/browser-backed acceptance proof that records:

1. fresh game
2. fresh player name
3. Haeun hangout
4. Block Crush completion
5. return to map

This final proof is the gameplay correctness artifact for the merged set, especially for `#16`, `#17`, and `#19`.
