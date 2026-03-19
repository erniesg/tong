# Issue 17 Reviewer Proof

This folder contains reviewer-openable proof for [issue #17](https://github.com/erniesg/tong/issues/17) on the fix branch used by [PR #89](https://github.com/erniesg/tong/pull/89).

Capture path:

- actual `/game` route
- deterministic intro setup via `/game?dev_intro=1&demo=TONG-DEMO-ACCESS&qa_trace=1`
- mobile viewport capture
- local fallback hangout content path (no live model required for this issue class)

Files:

- `01-ready-continue.png`: readable dialogue state with a visible `Tap to continue` affordance
- `02-tong-whisper.png`: first stable post-tap blocking state, where Tong whisper is visible instead of an empty transition surface
- `03-next-beat.png`: next beat after dismissing Tong whisper, with the subsequent NPC line visible
- `01-ready-state.json`: QA state snapshot for the readable continue state
- `02-tong-whisper-state.json`: QA state snapshot for the blocking Tong whisper state
- `03-next-beat-state.json`: QA state snapshot for the next visible beat after the whisper dismissal

Ordered stills:

| Ready state | First post-tap state | Next beat |
| --- | --- | --- |
| ![ready continue](./01-ready-continue.png) | ![tong whisper](./02-tong-whisper.png) | ![next beat](./03-next-beat.png) |

Key proof points from the QA state snapshots:

- `01-ready-state.json`: `currentMessage` is present and the player-facing continue affordance is visible.
- `02-tong-whisper-state.json`: after the tap, the scene advances into a blocking Tong whisper state with `toolQueue` still owned by the whisper step.
- `03-next-beat-state.json`: after the Tong whisper dismissal, the next beat is rendered as a new `currentMessage` rather than leaving the scene blank.

Scope note:

- This proof pack makes the PR reviewable from GitHub and shows the fixed route moving through the expected continue -> Tong whisper -> next beat flow.
- The original wasted-tap symptom was intermittent and timing-sensitive in human play, so final accept/reject for issue closure should still use a human browser pass on the same `/game?dev_intro=1&qa_trace=1` route.
