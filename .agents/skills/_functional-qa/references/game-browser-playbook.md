# Game Browser Playbook

Use this reference when the target issue is on the `/game` surface.

## QA mode

Open `/game` with:

- `demo=TONG-JUDGE-DEMO`
- `qa_run_id=<run id>`
- `qa_trace=1`

This enables:

- run-scoped QA metadata in session logs
- `window.__TONG_QA__` browser helpers
- richer trace output for continue and tool-queue flows

## Browser helpers

When the page is running in QA mode, use:

- `window.__TONG_QA__.getState()`
- `window.__TONG_QA__.downloadState()`
- `window.__TONG_QA__.getLogs()`
- `window.__TONG_QA__.downloadLogs()`

The state helper should be treated as the current surface snapshot. The log helper should be treated as the correlated session trace.

## Capture rules

1. For interaction and transition bugs, prefer burst screenshots or screen recording.
2. Capture pre-action and post-action states with the same viewport.
3. Export state and session logs immediately after reproducing the issue.
4. Save visual artifacts into the run's `screenshots/` directory and JSON exports into `logs/`.
5. For cloud runs or PR validation, also attach or link the reviewer-visible media in the task result, PR body, or issue comment. Local artifact paths alone do not count as shipped evidence.
6. For reviewer-facing interaction proof, visibly wait on the ready state before input, show the actual tap or click, and hold on the first clean post-action frame instead of racing through the transition.
7. If you use a deterministic jump or state injection to skip ahead, start recording only once the surface is semantically consistent to a human reviewer, or clearly label the clip as engineering-only trace evidence instead of acceptance proof.
8. If the viewport contains unrelated chrome that makes the proof easy to misread, either include enough lead-in to explain the state or crop the proof to the relevant surface.

## Current issue focus

- `#17`: distinguish expected typewriter skip from a true wasted tap
- `#18`: capture the stale game-board flash during dismissal, not just the endpoints
- `#19`: capture visible timing, not just transport behavior
