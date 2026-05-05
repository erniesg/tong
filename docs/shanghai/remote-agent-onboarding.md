# Shanghai Remote-Agent Onboarding

This is the remote-first process for turning Shanghai onboarding slices into unattended implementation, validation, reviewer-proof publication, and Discord notification.

## Current State

Shanghai onboarding has a content and implementation plan in `docs/shanghai/plan.md` and a local-worker handoff in `docs/shanghai/HANDOFF.md`.

Canonical hangout media is already in the repo:

- `apps/client/public/assets/locations/shanghai-onboarding.mp4`
- `apps/client/public/assets/locations/shanghai-onboarding-poster.jpg`
- `city.shanghai.location.dumpling-shop.panorama.video.default`
- `city.shanghai.location.dumpling-shop.panorama.poster.default`

Remote agents must use those panorama keys for Shanghai onboarding. `apps/client/public/assets/locations/shanghai.mp4` remains the Shanghai city-map loop, not the hangout fixture media.

The repo also has the remote-agent foundation:

- Control-plane fields: `docs/agent-native-project-setup.md`
- Provider-neutral queue: `docs/remote-agent-control-plane.md`
- Hosted task runbook: `docs/codex-cloud-issue-runbook.md`
- Evidence publishing: `docs/qa-evidence-uploads.md`
- Playtest-to-issues pipeline with Discord: `docs/playtest-agent-pipeline.md`

The missing piece was a Shanghai-specific path that says how a slice becomes a portable issue and how the finished proof gets announced. This document is that handoff.

## Required Setup

GitHub Actions secrets:

- `OPENAI_API_KEY`
- `DISCORD_WEBHOOK_URL`
- `CLOUDFLARE_API_TOKEN`

GitHub Actions vars:

- `CLOUDFLARE_ACCOUNT_ID`
- `TONG_RUNS_R2_BUCKET=tong-runs`
- `TONG_RUNS_PUBLIC_BASE_URL=https://runs.tong.berlayar.ai`
- `TONG_ASSETS_R2_BUCKET=tong-assets`
- `NEXT_PUBLIC_TONG_ASSETS_BASE_URL=https://assets.tong.berlayar.ai`
- `TONG_RUNTIME_ASSET_MANIFEST_KEY=runtime-assets/manifest.json`

Project fields must follow `docs/agent-native-project-setup.md`. A Shanghai issue is only eligible for unattended execution when:

- `Execution Mode = safe-unattended`
- `Portable Context = Yes`
- `Agent Ready = Yes`
- `Proof Required` is achievable in CI or hosted task proof capture

## Issue Shape

Each Shanghai slice from `docs/shanghai/plan.md` should become a GitHub issue before it enters the queue.

Use this body structure:

```md
## Slice
Shanghai H1 Slice 1.2 - Fixture runtime

## Context
- Read `docs/shanghai/plan.md`
- Read `docs/shanghai/HANDOFF.md`
- Read `docs/shanghai/remote-agent-onboarding.md`
- Relevant files:
  - `apps/client/lib/hangout/fixture-runtime.ts`
  - `apps/client/lib/hangout/fixture-runtime.test.ts`

## Acceptance
- Unit test: fixture with 3 beats emits 3 npc_speak events in order
- Unit test: seed=42 twice emits identical output
- `npm --prefix apps/client exec tsc -- --noEmit` passes, or document the exact project command if different

## QA Proof
- Route: `/game?phase=hangout&city=shanghai&scene=h1&mode=fixture&qa_trace=1`
- Proof Required: Clip+Trace for runtime/UI slices, Screenshot for visual-only slices, None for pure type/schema slices
- Scenario Seed: `shanghai-h1-fixture`
- Remote Dependencies: repo-only unless the slice uses `tong-assets`

## How to test
- Run the relevant unit tests
- Run the route-level proof recipe once the route exists
- Publish reviewer-visible proof to `tong-runs`
```

Recommended project field mapping:

| Slice kind | Initiative | Lane | Proof Required | Execution Mode |
| --- | --- | --- | --- | --- |
| Fixture schema/runtime | World Content | client-runtime | None or Clip+Trace | safe-unattended |
| Shanghai location/characters/fixture | World Content | game-engine | None or Screenshot | safe-unattended |
| Webtoon UI | World Content | client-ui | Clip+Trace | safe-unattended after assets are available |
| Webtoon assets | Runtime Assets | creative-assets | Screenshot | needs-human-design-review unless art prompts are locked |
| Dynamic prompt/voice validation | World Content | game-engine | Clip+Trace | validate-and-propose-only unless model output is deterministic enough |

## Overnight Flow

1. Convert ready Shanghai slices into GitHub issues.
2. Set the control-plane fields so the queue can distinguish safe unattended work from human-review work.
3. Generate the queue plan:

```bash
npm run remote:agent-plan -- '#123' '#124' --provider auto
```

4. Dispatch supported work:

```bash
npm run remote:dispatch -- \
  --plan artifacts/qa-runs/functional-qa/codex-cloud-queue/<run>/remote-plan.json \
  --include-unassigned \
  --limit 2
```

5. Remote tasks create PRs through `.github/workflows/codex-headless-pr.yml`.
6. PR metadata triggers `.github/workflows/qa-publish.yml` when a `qa_recipe`, repo-visible run bundle, or supported publish request exists.
7. `Trusted QA Publish` uploads reviewer-visible evidence to `tong-runs`, comments on GitHub, and sends a Discord notification with the PR and evidence manifest when `DISCORD_WEBHOOK_URL` is configured.

## Morning Review

Start from Discord, not from local artifacts.

Review in this order:

1. Open the PR link.
2. Open the uploaded `tong-runs` manifest or preview links from the Discord evidence field.
3. Check the GitHub issue comment posted by Trusted QA Publish.
4. Merge only if the public proof satisfies the issue acceptance criteria.
5. Use `/tong route-human #<issue>` for design, asset, or ambiguous validation decisions.

## Shanghai Route Targets

These are the target proof routes once the relevant slices exist:

- Fixture path: `/game?phase=hangout&city=shanghai&scene=h1&mode=fixture&qa_trace=1`
- Dynamic path: `/game?phase=hangout&city=shanghai&scene=h1&qa_trace=1`
- Webtoon focus: `/game?phase=hangout&city=shanghai&scene=h1&mode=fixture&focus=webtoon&qa_trace=1`
- Current Chinese-priority onboarding prototype: `/game?fresh=1&priority=zh` → `/onboarding/shanghai?entry=chinese-priority&reset=1`
- Direct Shanghai onboarding prototype: `/onboarding/shanghai?entry=chinese-priority&reset=1`
- Direct webtoon proof target: `/onboarding/shanghai?entry=chinese-priority&focus=webtoon&reset=1`

Do not require agents to replay a long manual path once deterministic scenario seeds or checkpoint mounts are available.

## Current Gaps

- Shanghai slice issues still need to be created from `docs/shanghai/plan.md`.
- A deterministic Shanghai `qa_recipe` should be added after the fixture route lands.
- Claude is available through the trusted headless dispatch workflow; use it for review-heavy, proposal-only, and persona-style work when provider policy selects it.
- Discord `route-human` interaction callbacks remain an integration risk called out in `docs/handoff-notes.md`.
