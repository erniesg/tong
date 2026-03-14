# Functional QA Update

- Run ID: `functional-qa-validate-issue-20260314T044052Z-erniesg-tong-16`
- Mode: `validate-issue`
- Issue ref: `erniesg/tong#16`
- Classification: `localization-content`
- Execution mode: `requires-live-model`
- Evidence plan: `screenshots, temporal-capture, contract-assertions`
- Verdict: `fixed`
- Confidence: `0.86`

## Issue Accuracy

accurate

## Summary

# Summary

- Mode: `validate-issue`
- Target: `erniesg/tong#16`
- Execution mode: `requires-live-model`
- Verdict: fixed
- Confidence: 0.86

## Findings

- Verified with a live-model session on `2026-03-14` using the local OpenAI key. The browser capture at [live-dialogue.png](/Users/erniesg/code/erniesg/tong/artifacts/qa-runs/functional-qa/erniesg-tong-16/20260314T044052Z/screenshots/live-dialogue.png) shows Korean tokens in the main immersive bubble (`하은`, `포장마차`) with no inline parenthetical romanization.
- The tapped-token capture at [live-tooltip.png](/Users/erniesg/code/erniesg/tong/artifacts/qa-runs/functional-qa/erniesg-tong-16/20260314T044052Z/screenshots/live-tooltip.png) shows pronunciation and meaning separated from the sentence flow for `포장마차` (`po-jang-ma-cha`, `street food tent`).
- The live API bait run at [live-api-romanization-bait.stream.txt](/Users/erniesg/code/erniesg/tong/artifacts/qa-runs/functional-qa/erniesg-tong-16/20260314T044052Z/logs/live-api-romanization-bait.stream.txt) started from user-provided `pojangmacha` / `juseyo`, and the model corrected its own output to `포장마차` / `주세요` in tool-call payloads instead of repeating bare romanization.
- Source changes also normalize Korean TTS/romanization for Hanja/CJK ideographs inside [KoreanText.tsx](/Users/erniesg/code/erniesg/tong/.worktrees/issue-16-live-fix/apps/client/components/shared/KoreanText.tsx), which closes the bad-tooltip path found in review even though this specific live session surfaced Hangul tokens rather than Hanja.

## Evidence

- `screenshots`: 2 item(s)
- `temporal_capture`: 1 item(s)
- `console_logs`: 2 item(s)
- `contract_assertions`: 3 item(s)

## Validation Gates

- Execution mode: `requires-live-model`
- Direct issue evidence: `complete`
- UI acceptance gate: `complete`
- Runtime modes exercised: `live-model, browser-ui`
- Live model confirmation: `confirmed`
- Human review: `complete`

## Regression Checks

- The prior repro no longer occurs. Keep adjacent smoke checks green.

## Open Questions

- None.

## Artifact Bundle

- Summary: `artifacts/qa-runs/functional-qa/erniesg-tong-16/20260314T044052Z/summary.md`
- Steps: `artifacts/qa-runs/functional-qa/erniesg-tong-16/20260314T044052Z/steps.md`
- Evidence: `artifacts/qa-runs/functional-qa/erniesg-tong-16/20260314T044052Z/evidence.json`
- Run manifest: `artifacts/qa-runs/functional-qa/erniesg-tong-16/20260314T044052Z/run.json`
