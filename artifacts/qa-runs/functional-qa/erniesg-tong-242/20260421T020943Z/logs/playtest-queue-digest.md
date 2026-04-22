<!-- playtest-queue-digest -->

## Playtest Queue Digest

- Generated: `2026-04-20T18:05:32.075Z`
- Queue issue: #242
- Findings shown: `2`

### Status Summary
- Pending: `0`
- In progress: `1`
- Blocked: `1`
- Completed: `0`

### Trusted Commands
- `/playtest-queue refresh`
- `/playtest-queue hold --finding-id <id> --note "reason"`
- `/playtest-queue retry --finding-id <id>`
- `/playtest-queue approve --finding-id <id> --note "reason"`
- `/playtest-queue reject --finding-id <id> --note "reason"`
- `/playtest-queue route-to-human --finding-id <id> --note "reason"`
- `/playtest-queue force-manual --finding-id <id> --note "reason"`

### Pending
- None.

### In Progress
- `finding_90e97942-5b93-4d6b-bc18-08418880038e` Continue CTA is hard to see after dialogue ends.
  - route: `direct_pr` (single_lane_non_protected_scope, confidence 0.90)
  - executor: `playtest-orchestrator`
  - next action: review linked PR
  - lane: `client-runtime`
  - refs: erniesg/tong#242, erniesg/tong#248

<details><summary>Manual Codex/Claude prompt for `finding_90e97942-5b93-4d6b-bc18-08418880038e`</summary>

```text
Work playtest finding finding_90e97942-5b93-4d6b-bc18-08418880038e in erniesg/tong.

Use this queued finding as the source of truth.
- Summary: Continue CTA is hard to see after dialogue ends.
- Severity: high
- Route status: direct_pr
- Route reason: single_lane_non_protected_scope
- Route confidence: 0.90
- Inferred component: apps/client/components/scene/ContinueButton.tsx
- Inferred lane: client-runtime
- Protected path: no
- Existing refs: erniesg/tong#242, erniesg/tong#248
- Artifact links: https://runs.tong.berlayar.ai/playtest/verify-242-queue/recording.webm, https://runs.tong.berlayar.ai/playtest/verify-242-queue/annotations.json, https://runs.tong.berlayar.ai/playtest/verify-242-queue/analysis.json

Constraints:
- Keep scope aligned to the queued finding only.
- Respect protected-path review for workflow, contract, and control-plane files.
- Validate before claiming fixed and include reviewer-visible evidence or a precise blocker.
- If the finding is ambiguous or spills across lanes, route it back to human review instead of guessing.
```

</details>

### Blocked
- `finding_7abbd89b-d1ad-4e10-ad81-d3a1aa28e13d` Protected workflow needs a maintainer decision.
  - route: `human_review` (hold_requested, confidence 1.00)
  - executor: `playtest-queue`
  - next action: maintainer review or manual handoff
  - lane: `infra-deploy` protected-path
  - refs: none
  - override: `human_review` by `playtest-queue` (hold_requested)

<details><summary>Manual Codex/Claude prompt for `finding_7abbd89b-d1ad-4e10-ad81-d3a1aa28e13d`</summary>

```text
Work playtest finding finding_7abbd89b-d1ad-4e10-ad81-d3a1aa28e13d in erniesg/tong.

Use this queued finding as the source of truth.
- Summary: Protected workflow needs a maintainer decision.
- Severity: medium
- Route status: human_review
- Route reason: hold_requested
- Route confidence: 1.00
- Inferred component: .github/workflows/qa-publish.yml
- Inferred lane: infra-deploy
- Protected path: yes
- Existing refs: none
- Artifact links: https://runs.tong.berlayar.ai/playtest/verify-242-queue/analysis.json, https://runs.tong.berlayar.ai/playtest/verify-242-queue/recording.webm, https://runs.tong.berlayar.ai/playtest/verify-242-queue/annotations.json

Constraints:
- Keep scope aligned to the queued finding only.
- Respect protected-path review for workflow, contract, and control-plane files.
- Validate before claiming fixed and include reviewer-visible evidence or a precise blocker.
- If the finding is ambiguous or spills across lanes, route it back to human review instead of guessing.
```

</details>

### Completed
- None.
