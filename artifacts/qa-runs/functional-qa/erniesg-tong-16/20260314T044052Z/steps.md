# Steps

1. Reviewed `erniesg/tong#16`, the previous scaffold run, and the repo routing note that this issue requires `live-model` evidence before claiming a fix.
2. Patched the active issue-16 worktree to:
   - forbid bare romanization in the live hangout prompts and tool schemas
   - normalize Korean Hanja/CJK speech + reading handling in `KoreanText`
3. Ran `npm run build` in `apps/client` on the worktree and confirmed a clean production build.
4. Ran `npm run demo:smoke` at the repo root and confirmed the demo smoke suite passed.
5. Exercised the live `/api/ai/hangout` route directly with:
   - a baseline ordering prompt
   - a romanization-bait prompt containing `pojangmacha` and `juseyo`
6. Captured a live browser session on `/game?phase=hangout...` against the same worktree app at `http://localhost:3101`, then saved:
   - the main immersive dialogue screenshot
   - the tapped tooltip screenshot for `포장마차`
   - a short MP4 with the tap interaction and recorded token audio
   - QA state and raw captured text
7. Compared the new run against the previous `20260313T191234Z` scaffold, which had no completed evidence, then finalized this verify-fix run based on live output plus UI capture.

## Validation Gates

- Execution mode: `requires-live-model`
- Direct issue evidence required: `yes`
- UI acceptance gate required: `yes`
- Live model required for a fixed verdict: `yes`
- Human review required before a fixed verdict: `no`

### Direct Evidence Targets

- Capture the exact UI state that demonstrates the claimed issue or fix.
- Generic, background, or unrelated screenshots do not count as direct evidence.
- Capture an actual Korean dialogue sentence in the main immersive bubble.
- Capture the tapped tooltip or dictionary card for the same Korean token.
- Capture where pronunciation or romanization appears instead of inline parentheses.

### UI Acceptance Checks

- No overlap or collision in the mobile viewport.
- No awkward wrapping in critical HUD or status UI.
- Primary interaction keeps stronger hierarchy than any added status or helper UI.
- The fix reduces cognitive load instead of adding clutter.
- Native script remains primary in the main immersive sentence.
- Inline parenthetical romanization does not appear in immersive dialogue.
- Pronunciation is available in tooltip, dictionary, or audio UI without displacing the main sentence.

### Required Runtime Modes For Fixed

- `live-model`

### Stop Conditions

- If only fallback or canned or dev content was exercised, mark the run partial or blocked and do not claim the issue fixed.

## Replay the previous run

- Previous run id: `functional-qa-validate-issue-20260313T191234Z-erniesg-tong-16`
- Previous run dir: `/Users/erniesg/code/erniesg/tong/artifacts/qa-runs/functional-qa/erniesg-tong-16/20260313T191234Z`
- Reuse the prior steps before claiming a fix.
