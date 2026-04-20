# Agent PR Validator

The agent PR validator is the GitHub-native control-plane layer for agent-created pull requests.

## What it does

- watches agent-created PRs
- summarizes validator status directly on the PR
- links the current trusted QA publish state and any reviewer-visible proof comment
- records an explicit retry budget for machine rework
- keeps merge and production approval human-gated

## Triggers

- pull request open, synchronize, reopen, ready-for-review
- completion of the `Trusted QA Publish` workflow
- maintainer PR comment commands:

```text
/pr-validator validate
/pr-validator retry
```

## Retry policy

- Maximum automated rework cycles: `2`
- A retry is only allowed when actionable review feedback exists.
- Once the retry cap is exhausted, the PR must route back to a human instead of looping indefinitely.

The validator records retry attempts on the PR so later runs can enforce the cap.

## Human final approval boundary

- Validator success does not auto-merge a PR.
- Validator success does not approve production promotion.
- Merge to `main` still requires explicit human approval.
- Any production or release promotion remains human-gated even after validator and QA publish pass.

## Evidence policy

- The validator reuses the existing `Trusted QA Publish` path for reviewer-visible evidence.
- If the PR exposes CI-rerunnable QA metadata, the trusted publish workflow remains the proof engine.
- If reviewer-visible evidence cannot be resolved automatically, the validator marks the PR as blocked or human-review-required instead of pretending the proof exists.
