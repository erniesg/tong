---
name: work-github-issues
description: Triage, route, and work through GitHub issues using the repo's functional QA workflow and worktree map. Use when asked to step through issues, fix the issue queue, or decide what can run in parallel.
argument-hint: "[issue-number ...] [--limit N] [--ensure-worktrees]"
allowed-tools: Read, Grep, Glob, Bash(gh *), Bash(git *), Bash(python *), Bash(npm run setup:worktrees), Bash(./scripts/setup-hackathon-worktrees.sh), Bash(./scripts/launch-parallel-agents.sh)
---

Read and follow the canonical skill at `../../../.agents/skills/work-github-issues/SKILL.md`.

Shared routing and runtime live in `../../../.agents/skills/_functional-qa/`.

Invocation arguments: $ARGUMENTS
