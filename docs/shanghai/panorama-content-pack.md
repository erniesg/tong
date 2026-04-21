# Shanghai Panorama Content Pack (H1 cold-open)

This doc records the authored assumptions for the Shanghai panorama onboarding slice added for issue `#257` support.

## Coordinate assumptions
- Hotspot rect coordinates are normalized in a 0..1 range.
- `x/y` indicate top-left; `width/height` are proportional size.
- Runtime should clamp, then map normalized values to rendered media bounds.

## Temporary media assumption
- The final wide onboarding panorama clip is not yet repo-visible.
- Current pack intentionally points to `/assets/webtoon/shanghai/h1/0.png` as a temporary still fallback.
- Route/runtime should treat this as temporary and swap to the final wide clip asset once available.
