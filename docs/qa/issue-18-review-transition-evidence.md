# Issue #18 reviewer evidence checklist (Block Crush review dismissal)

Use this checklist to capture the correct proof for `erniesg/tong#18`.

## Proof moment to capture

From the real Act 2 hangout flow:
1. Open the generated `browser-playbook.md` route for the run.
2. Progress until a Block Crush exercise completes.
3. Wait until the review overlay is fully settled and `Tap to continue` is clearly readable.
4. Hold that readable state on screen long enough for a reviewer to parse it.
5. Show the actual tap to dismiss.
6. Capture the dismissal through the first stable post-dismiss frame and linger there briefly.

## Required evidence

1. Preferred: a short screen recording or GIF that starts on the readable review overlay, visibly waits, shows the tap, and runs through the first stable post-dismiss frame.
2. Fallback: ordered frames for `review-visible`, `review-ready`, `dismiss-t0`, `dismiss-t90`, `dismiss-t220`, `dismiss-t440`, and `post-dismiss`.

## Route shape

Use the real hangout route, not the isolated dev exercise tester:

`/game?dev_intro=1&dev_act=2&demo=TONG-JUDGE-DEMO&qa_trace=1`

## Notes

- Do not use `?dev=exercise` for this issue. That bypasses the real parent exercise dismissal path.
- A local artifact path by itself is not reviewer-visible proof. Link or attach the recording or ordered frames in the PR body, task result, or issue comment.
- For this issue class, a single still image is not sufficient evidence.
- If deterministic fast-forward or state injection is used to skip the full playthrough, the captured review state must still make sense to a reviewer. Do not post a clip whose visible objective or HUD implies a different target than the review state being dismissed.
