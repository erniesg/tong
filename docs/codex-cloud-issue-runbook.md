# Codex Cloud Issue Runbook

Use this runbook when you want Codex cloud tasks to work Tong issues through the Codex environment UI and create PRs from task results instead of local worktrees.

## What Codex cloud can and cannot see

Codex cloud tasks work from the repository checkout plus the cloud environment setup. They do not inherit arbitrary local files from a laptop. Relevant docs:

- [Cloud environments](https://developers.openai.com/codex/cloud/environments)
- [Use Codex in GitHub](https://developers.openai.com/codex/integrations/github)
- [Worktrees](https://developers.openai.com/codex/app/worktrees)

Practical rule:

1. If an issue can be reproduced from tracked code, fixtures, and setup commands, it can be a cloud issue.
2. If it depends on local-only assets, unpublished media, or unreproducible device/local state, keep it local until that dependency is moved to a shared location.

## Prerequisites outside the repo

1. The Codex GitHub integration must be installed for this repository.
2. The Codex cloud environment should run the Tong setup commands:
   - `npm --prefix apps/server install`
   - `npm --prefix apps/client install`
   - `npm run demo:smoke`
   - `npm run ingest:mock`
3. If cloud tasks need large or private assets later, move them to shared storage first. Until then, leave asset-dependent issues as local-only.

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

under `artifacts/qa-runs/functional-qa/codex-cloud-queue/<timestamp>/`.

## Suggested GitHub labels

1. `cloud-ok`
2. `local-only`
3. `needs-acceptance-proof`

The generator emits these as suggestions; it does not modify GitHub labels directly.

## Current Tong batching order

### Batch 1

- `#18` Block Crush review flash
- `#19` fake streaming after loading

These are the first cloud wave because they are the next unresolved `client-shell` bugs after the initial readability pass for `#15` landed in PR `#33` on March 14, 2026.
Run them serially in the listed order. They both sit in the `client-shell` lane, and `#19` should follow `#18` so the queue stays serialized through the transition and streaming work.

### Batch parallel

- `#35` runtime asset bucket/env contract
- `#36` canonical runtime asset manifest
- `#34` QA evidence comparison panels

These can run in parallel with Batch 1 because they sit in `infra-deploy`, `creative-assets`, and non-game QA tooling lanes rather than the active `client-shell` wave.

### Batch parallel

- `#35` runtime asset bucket/env contract
- `#36` canonical runtime asset manifest
- `#34` QA evidence comparison panels

These can run in parallel with Batch 1 because they sit in `infra-deploy`, `creative-assets`, and non-game QA tooling lanes rather than the active `client-shell` wave.

### Batch 2

- `#14` HUD discoverability
- `#11` Onboarding clarity
- `#31` Block Crush first-time hint and early cognitive-load follow-up
- `#18` Block Crush review flash *(capture using `docs/qa/issue-18-review-transition-evidence.md`)*
- `#17` tap-flow wasted tap

These should follow Batch 1 because they are the remaining onboarding and gameplay-shell follow-ups after the priority wave settles.

### Batch 3

- `#15` residual readability audit and mobile-device follow-up

Keep this batch for lower-priority cleanup work after the focused bug-fix waves land. `#15` stays open because PR `#33` only completed the first readability pass; the remaining audit scope should not block `#18` or `#19`.

### Local-only for now

- `#12` hangout backdrop/avatar/immersion issue

This remains local-only until shared asset hosting exists for the looping backdrop and related scene assets.

### Unassigned for now

- `#29` remote-first and agent-native epic

Keep this one split into narrower slices instead of sending the whole epic as one cloud task. Treat unassigned issues as hold items, not launch-ready work.

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
4. Artifact directories under `artifacts/qa-runs/` are gitignored. In the current flow, Codex cloud does not automatically publish those local files into the GitHub PR for reviewers. If a fix needs visual proof, attach or link reviewer-visible media in the task result, PR body, or issue comment. If that cannot be done, leave the verification incomplete and require a final local/browser-backed acceptance recording.
5. Reserve `@codex` GitHub comments for review or explicitly manual experiments, not the default implementation path.
6. Do not treat a truncated or deterministic-jump clip as final acceptance proof unless the interaction sequence is still legible to a human reviewer: readable pre-action state, visible input, and stable post-action result.

## Acceptance policy

Issue workers are not the final product signoff.

After the merged cloud batches, run one local/browser-backed acceptance proof that records:

1. fresh game
2. fresh player name
3. Haeun hangout
4. Block Crush completion
5. return to map

This final proof is the gameplay correctness artifact for the merged set, especially for `#16`, `#17`, and `#19`.
