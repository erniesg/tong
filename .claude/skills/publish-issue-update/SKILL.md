---
name: publish-issue-update
description: Publish a structured GitHub issue update from an existing functional QA run using the repo publish policy.
argument-hint: "[run-dir|run-id]"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash(gh *), Bash(git *), Bash(python *)
---

Read and follow the canonical skill at `../../../.agents/skills/publish-issue-update/SKILL.md`.

Shared runtime and config live in `../../../.agents/skills/_functional-qa/`.

Invocation arguments: $ARGUMENTS
