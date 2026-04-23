# Remote Agent Control Plane

Tong's remote issue queue is repo-native.

The orchestrator owns:

- queue state
- lane routing
- execution gates
- validation and reviewer-proof requirements
- human review routing

Providers are pluggable backends.

- `codex` is the current working backend
- `claude` is wired as a placeholder contract in this slice
- future runners should plug in through the same adapter boundary instead of reshaping the queue model

## Repo-native actions

The stable queue actions are:

- `queue`
- `run`
- `retry`
- `hold`
- `route-human`

These actions are durable in queue plans, workflow inputs, dispatch summaries, and human-review writebacks regardless of which provider executes a work item.

## Provider policy

Provider choice is configuration and policy, not the orchestrator API.

- Policy lives in `.agents/skills/_functional-qa/config/remote-agent-providers.json`
- The default provider is configurable there
- Workflow dispatch can override the provider with `auto`, `codex`, or `claude`
- Per-issue, per-lane, and per-execution-mode overrides can also live in policy

## Trigger surfaces

Repo-native GitHub queue commands use `/tong ...`.

Examples:

- `/tong queue`
- `/tong run #292`
- `/tong retry #292`
- `/tong hold #292`
- `/tong route-human #292`

Compatibility notes:

- the Discord `route-human` surface should write back `/tong ...` comments so the repo-native command stays the durable API
- `/codex ...` still works as a legacy compatibility trigger for older Discord cards and manual maintainer comments
- raw `@codex ...` remains vendor-native and is not the main orchestration API

## Current slice

Phase 1 makes the control plane provider-agnostic without breaking the current Codex path.

- queue plans emit provider metadata per work item
- dispatch goes through provider adapters
- `codex` dispatch remains working through its adapter
- `claude` has a prompt and PR-note contract plus placeholder dispatch wiring
- Discord `route-human` stays stable by posting repo-native queue commands back to GitHub
