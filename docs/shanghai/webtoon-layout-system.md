# Shanghai Webtoon Layout System

This captures the layout rules for the Shanghai H1 cliffhanger and the future direction for metadata-driven webtoon composition.

## Why this matters now

For V1, H1 only needs a 3-panel cliffhanger rendered inside the game UI. That means:

- panel layout should stay data-driven per panel, not hardcoded to `p1/p2/p3`
- art can land independently at `apps/client/public/assets/webtoon/shanghai/h1/p{1,2,3}.png`
- layout testing should work even before final art is ready

For V2+, the same metadata can expand into a compositor or tool-driven strip builder that lays out arbitrary panels dynamically.

## V1 contract

Current `WebtoonPanel` data supports:

- `widthType`: `full-bleed | full-width | inset-wide | inset-narrow | floating`
- `heightClass`: `short | standard | tall | ultra-tall`
- `aspectRatio`
- `shotType`
- `gapBefore: { px, color }`
- `transition: fade | cut | darken`
- optional `bubble`

This is enough for the H1 cliffhanger and should remain the source of truth for layout decisions in `#193` and `#195`.

## H1-specific rules

- Upload width target: 800px
- Working width target: 1600px
- Keep important composition inside the center 80% safe area
- Panel 3 must preserve the lower 40% as empty compositor space for the bubble overlay
- Use contrast between narrow and full-width treatments to create thumb-stop impact
- Gap color is part of pacing, not filler

## Layout heuristics

- Use `full-bleed` or `full-width` for reveals, establishing shots, and impact moments
- Use `inset-wide` for dialogue and medium-stakes beats
- Use `inset-narrow` or `floating` for private, quiet, or reflective beats
- Use `tall` or `ultra-tall` panels to slow the reader down
- Use `short` panels and tight gaps for speed
- Use wide black gaps before reveals and cliffhangers

## Future-ready extension

If we later expose webtoon layout through tools or a compositor pipeline, extend the panel contract instead of replacing it.

Candidate future fields:

```json
{
  "width_percent": 100,
  "height_px": 600,
  "alignment": "center",
  "border": "standard",
  "border_color": "#000000",
  "gap_before_px": 120,
  "gap_color": "#FFFFFF",
  "layer_order": 0,
  "narrative_function": "dialogue",
  "is_thumb_stop": false
}
```

That future work is relevant, but it is not required to ship H1. V1 should keep the renderer metadata-driven without overbuilding a full strip compositor yet.

## Testing guidance

- Real-art fixture testing can begin as soon as `p1.png`, `p2.png`, and `p3.png` exist at the final public paths
- Layout-only testing should work with placeholders before art lands
- Use the backstage webtoon lab to verify width, height, gap pacing, and bubble placement independent of the `/game` route

## Issue routing

- `#193` owns metadata-driven panel layout and interaction behavior
- `#195` owns final art and safe-area correctness
- `#188` and `#192` own fixture/runtime payloads that feed the panel data
- `#193` should avoid scene-specific hardcoding so the same component can later serve dynamic multi-panel sequences
