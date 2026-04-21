# Shanghai Panorama Content Pack (P2 support)

This PR adds a fixture-style config for the Shanghai cold-open panorama so routing/runtime work can consume authored values without hardcoding.

## Coordinate assumptions
- Hotspot rectangles are normalized to `0..1` in media space.
- Runtime should project normalized rects after applying object-fit crop/letterbox math.
- Current windows are authored against the temporary stand-in media frame at `/assets/webtoon/shanghai/h1/0.png`.

## Temporary media assumption
The final wide onboarding clip is not in-repo yet. Until it lands, use the same stand-in key already wired in config:
- `/assets/webtoon/shanghai/h1/0.png`

When the final clip is available, replace `mediaUrl`/`posterUrl` and re-check hotspot rectangles against that true frame.
