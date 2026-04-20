# Webtoon Layout System

Rules for the continuous-scroll webtoon renderer. This is the spec the
`WebtoonStrip` component, the H1 fixture, and the (upcoming) dynamic-layout
skill should stay aligned with.

## Canvas model

- The reader's viewport **is** the canvas. Theme surface is warm parchment
  (`#f4f0e8`) for indoor daytime scenes. Panels sit **on** the surface.
- "Between panels" is never a void — it's the same theme surface, or a
  gradient fading between two panels' dominant colors. Dark voids behind
  narrower panels read as broken layout, not art.
- Real webtoons deliver a long stitched strip where gradients are baked into
  the art. We compose from discrete panels, so we simulate the same effect
  via CSS gradients in the gap between panels.

## Three width tiers — no more

| Tier | Width | When |
|---|---|---|
| **full-bleed** | 100% | Establishing shots, emotional climaxes, reveals. The reader is *inside* the moment. |
| **full-width** | 96% (100% on < 480px) | Standard narrative and dialogue beats. Small side margins of theme surface, not dark. |
| **inset** | 62% (70% on < 480px), centered | Beat compression — a short retort, a private aside. Sits on the theme surface; never on a dark card background. |

Discarded variants: `inset-narrow`, `inset-wide`, `floating`. Those invented
floating cards-on-void aesthetics that break real-webtoon convention.

## Gaps as mood carriers

A gap is `{ px, color? | gradient? }`. Zero px is valid for tight continuity.

- **Solid color** for tight beats in the same mood (use the theme surface).
- **Gradient `[fromColor, toColor]`** for cross-mood transitions. Sample the
  bottom-edge dominant color of panel N and the top-edge dominant of panel
  N+1; let the gap smear between them. For mood pivots (warm indoor → dark
  before a mic drop), use a longer gap (120–200px).
- **Zero gap** creates contiguous intimacy — panels butt up.

Baseline gap scale:

| Gap intent | px |
|---|---|
| Contiguous (same moment) | 0 |
| Beat continuation | 16–40 |
| Scene beat change | 40–80 |
| Mood pivot / dramatic pause | 120–200 |

## Panel heights

Natural aspect ratio of the image drives height. Do not force height classes
that squash or letterbox the art. The fixture's `heightClass` is advisory
metadata for the dynamic-layout skill, not a render-time constraint.

## Speech bubbles

Bubbles are the only UI chrome overlaid on the art. Three rules:

1. **Default closed state shows the line only** — no speaker name, no help
   affordance text competing with the dialogue. The speaker is identified
   by the bubble's **border accent color**:
   - 瞿守成 (shoucheng) → navy `#1d3a6b`
   - 丁漫 (dingman) → warm red `#9c3a2a`
   - 方阿姨 (ayi) → amber `#b5792a`
   - narrator → slate `#555862`
2. **A small pill hints at tappability** ("Tap for help" / "Tap · N credits" /
   "Tap · Game Pass"). Lives under the line, tinted to match the accent.
3. **Tapped state expands in place**: the bubble flips to a dark translucent
   lens showing (a) the speaker label, (b) the original line with ruby
   pinyin aligned above each CJK character, (c) English translation, (d) a
   "Tap to hide" pill. No detached card elsewhere on the page.

Ruby pinyin requires per-syllable arrays aligned to non-punctuation hanzi:

```ts
bubble: {
  zh: '方案你看过了。',
  py: ['Fāng', 'àn', 'nǐ', 'kàn', 'guò', 'le'], // 6 syllables for 6 hanzi
  en: 'You looked at the proposal.',
  speaker: 'shoucheng',
  position: 'bottom',
}
```

## Position tokens

Bubble anchors within its panel:

- `top` — upper ~6% — establishing voice / off-screen
- `bottom` — lower ~7% — standard dialogue
- `center-bottom` — lower ~16% — climactic lines that need more breathing room

## Per-bubble reveal gating

`bubble.reveal` (optional) controls when the translation unlocks:

- `{ kind: 'free' }` (default) — always shows on tap
- `{ kind: 'credits', cost: N }` — deducts credits on first tap
- `{ kind: 'gamePass' }` — requires active game pass

Distinct from scene-level `CreditGate` (which unlocks additional narrative
lines after the cliffhanger).

## Authoring checklist

Before committing a new webtoon fixture:

- [ ] Every panel uses one of the three width tiers
- [ ] No `inset` panel sits on a dark gap — use the theme surface or a
  gradient that stays in the warm range
- [ ] Gaps have a deliberate px scale; no accidental 300px voids
- [ ] Gradient gaps chain dominant colors from neighbors
- [ ] Bubbles have `py` arrays aligned syllable-per-CJK-character
- [ ] Speaker accent colors cover all speakers present
- [ ] Last panel optionally has `isThumbStop: true` for scroll-snap
