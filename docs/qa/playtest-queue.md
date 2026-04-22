# Playtest Queue Operations

The playtest queue digest is a GitHub issue comment surface backed by the `#240` Worker ledger and the `#241` orchestrator routes.

## Queue digest

Run the `Playtest Queue` workflow or comment `/playtest-queue refresh` on the queue issue to update the digest comment.

The digest groups findings into:

- `Pending`
- `In Progress`
- `Blocked`
- `Completed`

Each finding entry shows:

- current route status, reason, and confidence
- linked issue and PR refs
- inferred lane and protected-path flag
- current executor and next action
- a reusable manual Codex/Claude prompt

## Trusted comment controls

Maintainers can operate the queue from the queue issue with:

```text
/playtest-queue refresh
/playtest-queue hold --finding-id <id> --note "reason"
/playtest-queue retry --finding-id <id>
/playtest-queue approve --finding-id <id> --note "reason"
/playtest-queue reject --finding-id <id> --note "reason"
/playtest-queue route-to-human --finding-id <id> --note "reason"
/playtest-queue force-manual --finding-id <id> --note "reason"
```

Control semantics:

- `hold`: keep the item visible but block unattended routing behind a human decision
- `retry`: clear the active override and return the item to `unrouted`
- `approve`: mark the queued item `done` with an explicit human approval note
- `reject`: mark the item `skip` with an explicit rejection note
- `route-to-human`: persist `human_review` as the route state
- `force-manual`: persist `human_review` and leave the manual prompt in the digest for interactive handoff

## Safety notes

- The workflow only trusts same-repo maintainer comments.
- Protected-path findings stay visible in the queue and should not be auto-routed out of human review without explicit maintainer action.
- The orchestrator honors active manual overrides so later unattended passes do not silently overwrite queue decisions.
