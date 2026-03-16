# Browser Playbook

- Run ID: `functional-qa-validate-issue-20260314T044052Z-erniesg-tong-16`
- Issue ref: `erniesg/tong#16`
- Surface: `game`
- Route: `http://localhost:3000/game?dev_intro=1&demo=TONG-JUDGE-DEMO&qa_run_id=functional-qa-validate-issue-20260314T044052Z-erniesg-tong-16&qa_trace=1`

## Capture Steps

1. Open a hangout scene with Korean dialogue visible in the main immersive text.
2. Capture the main sentence and verify it uses native script with no inline parenthetical romanization.
3. Tap a Korean token and capture the tooltip or dictionary state that exposes pronunciation placement.
4. Record whether the run exercised live-model output, fallback content, or only a static or dev route.

## Screenshot Targets

- actual Korean dialogue state in the main message bubble
- tooltip or dictionary state for the tapped Korean token
- pronunciation placement outside the main immersive sentence

## State Targets

- phase
- currentMessage
- tongTip

## Browser Helpers

- `window.__TONG_QA__.getState()`
- `window.__TONG_QA__.downloadState()`
- `window.__TONG_QA__.getLogs()`
- `window.__TONG_QA__.downloadLogs()`

## Local Artifact Targets

- Save screenshots in `artifacts/qa-runs/functional-qa/erniesg-tong-16/20260314T044052Z/screenshots`
- Save exported logs in `artifacts/qa-runs/functional-qa/erniesg-tong-16/20260314T044052Z/logs`

