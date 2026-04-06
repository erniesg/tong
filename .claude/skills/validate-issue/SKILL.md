---
name: validate-issue
description: Validate a GitHub issue or bug report, save a rerunnable QA artifact bundle, and auto-publish a structured issue update when policy allows. Use when the user asks to work through issues, reproduce a bug, verify a fix, or validate behavior with evidence.
argument-hint: "[issue-number|issue-url|description] [--verify-fix]"
allowed-tools: Read, Grep, Glob, Bash(gh *), Bash(git *), Bash(python *), Bash(npm run demo:smoke)
---

Read and follow the canonical skill at `../../../.agents/skills/validate-issue/SKILL.md`.

Shared runtime and config live in `../../../.agents/skills/_functional-qa/`.

Invocation arguments: $ARGUMENTS
