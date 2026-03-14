# Issue #18 reviewer evidence checklist (Block Crush review dismissal)

Use this checklist to capture the correct proof for `erniesg/tong#18`.

## Proof moment to capture

From the real Act 2 hangout flow:
1. Open the generated `browser-playbook.md` route for the run.
2. Progress until a Block Crush exercise completes.
3. Wait until the review overlay shows `Tap to continue`.
4. Tap to dismiss.
5. Capture the dismissal through the first stable post-dismiss frame.

## Required evidence

1. Preferred: a short screen recording or GIF that starts on the visible review overlay and runs through the post-dismiss frame.
2. Fallback: ordered frames for `review-visible`, `review-ready`, `dismiss-t0`, `dismiss-t90`, `dismiss-t220`, `dismiss-t440`, and `post-dismiss`.

## Route shape

Use the real hangout route, not the isolated dev exercise tester:

`/game?dev_intro=1&dev_act=2&demo=TONG-JUDGE-DEMO&qa_trace=1`

## Notes

- Do not use `?dev=exercise` for this issue. That bypasses the real parent exercise dismissal path.
- A local artifact path by itself is not reviewer-visible proof. Link or attach the recording or ordered frames in the PR body, task result, or issue comment.
- For this issue class, a single still image is not sufficient evidence.
