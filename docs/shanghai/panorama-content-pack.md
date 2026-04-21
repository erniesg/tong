# Shanghai Panorama Cold-Open Content Pack (V1)

This document records the authored content assumptions for the temporary panorama onboarding slice that supports issue #257 route/runtime wiring.

## Source of truth
- `apps/client/lib/content/shanghai/panorama-cold-open.ts`

## Coordinate assumptions
- Hotspot rectangles are normalized to the source frame as `{ x, y, width, height }` in the `0..1` range.
- Runtime should project normalized coordinates into the rendered video viewport _after_ applying whatever letterbox/crop policy the player uses.
- Timing windows are clip-relative milliseconds.

## Temporary media assumption
- The final Shanghai wide onboarding clip is not yet committed in this repo slice.
- V1 uses repo-visible placeholders:
  - clip: `/assets/tong_intro.webm`
  - poster: `/assets/locations/shanghai-static.png`
- Future route/runtime work should treat this as a swap-only media reference change, not a schema change.
