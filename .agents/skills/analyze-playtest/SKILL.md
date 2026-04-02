---
name: analyze-playtest
description: Analyze a playtest session using Gemini AI. Fetches screenshots and annotations from R2, runs structured analysis (UX friction, translation quality, engagement, trends), and outputs triaged issues. Use when reviewing playtest sessions, triaging bugs from playtests, or running the daily pipeline.
argument-hint: <session-id> [--preset ux_friction|translation_quality|content_engagement|trend_analysis] [--mode screenshots|video]
---

# Analyze Playtest Session

Analyze a playtest session's screenshots and annotations using Gemini AI to produce structured, actionable issues.

## Prerequisites

- `GOOGLE_GEMINI_API_KEY` environment variable must be set
- Session must exist in the Worker API with status `submitted`
- Screenshots and annotations must be uploaded to R2

## Usage

### Quick analysis (screenshot mode, default)

```bash
node scripts/analyze-playtest-session.mjs --session-id $ARGUMENTS --preset ux_friction
```

### Full video analysis (more expensive, use for deep-dive)

```bash
node scripts/analyze-playtest-session.mjs --session-id $ARGUMENTS --mode video --preset ux_friction
```

### Save results and update session

```bash
node scripts/analyze-playtest-session.mjs \
  --session-id $ARGUMENTS \
  --preset ux_friction \
  --update-session \
  --output /tmp/analysis-result.json
```

## Analysis Presets

| Preset | Use for | Cost |
|--------|---------|------|
| `ux_friction` | UI bugs, confusing flows, blocked interactions | Default |
| `translation_quality` | Wrong translations, unnatural phrasing, missing tooltips | |
| `content_engagement` | Drop-off points, boring sections, difficulty issues | |
| `trend_analysis` | Social media trend extraction (for campaign content) | |

## Screenshot vs Video Mode

- **Screenshots** (default): Sends annotated screenshots to Gemini as inline images. ~70% cheaper than video. Best for most triage.
- **Video**: Uploads full recording to Gemini Files API. Use when you need to analyze state transitions, animations, or timing-sensitive bugs.

The CLI auto-detects: if annotations have `screenshotUrl` fields, it uses screenshot mode. Falls back to video if no screenshots.

## Output

JSON with:
- `result.issues[]` — each with timestamp, category, severity, description, suggestedFix, autoFixable, affectedComponent
- `result.overallScore` — 1-10
- `result.topPriority` — single most impactful fix
- `summary.autoFixableCount` — how many can be auto-fixed

## After Analysis

Review the issues. For auto-fixable ones:
1. Read the affected component
2. Generate a fix
3. Validate with `npx tsc --noEmit` in `apps/client`
4. Create a PR on an `autofix/` branch

For issues requiring design decisions, create GitHub issues with the analysis context.

## References

- Analysis presets: `apps/server/src/gemini-video.mjs` (ANALYSIS_PRESETS)
- CLI script: `scripts/analyze-playtest-session.mjs`
- R2 storage: `playtest/{sessionId}/screenshots/`, `playtest/{sessionId}/annotations.json`
