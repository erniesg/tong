---
name: trace-ui-state
description: Trace ambiguous or timing-sensitive UI bugs by correlating input events, visible behavior, logs, and internal state transitions. Use after validation when the bug appears race-like, intermittent, or the visible behavior does not match the expected state path.
argument-hint: "[issue-number|issue-url|surface]"
allowed-tools: Read, Grep, Glob, Bash(gh *), Bash(git *), Bash(python *), Bash(npm run demo:smoke)
---

Read and follow the canonical skill at `../../../.agents/skills/trace-ui-state/SKILL.md`.

Shared runtime and config live in `../../../.agents/skills/_functional-qa/`.

Invocation arguments: $ARGUMENTS
