# Demo Run Of Show

## Target length
8 to 12 minutes total.

## Segment 1: Motivation and caption overlay (2 to 3 min)
1. Explain personal Korean-learning motivation.
2. Open Korean variety video (Karina example).
3. Show augmented subtitle lanes:
- Native script.
- Romanization.
- English translation.
4. Hover/tap a token to open dictionary card with:
- Meaning and usage.
- Equivalent character in other CJK languages.
- Readings in those languages.

## Segment 2: Personalization signal (1 to 2 min)
1. Show "last 3 days" transcript + lyrics ingest result.
2. Display ranked vocabulary feed used for gameplay reinforcement.
3. Point out that spaced repetition pulls from real consumed content.

## Segment 3: Game bootstrap and first hangout (3 to 4 min)
1. Start New Game flow (or resume).
2. Set proficiency profile.
3. Tong introduces world and city.
4. Enter first hangout in `Food Street`.
5. Tong runs an adaptive interaction sequence that also validates prior knowledge.

## Segment 4: Learn mode and progression (1 to 2 min)
1. Enter Learn mode with Tong.
2. Show structured objectives for next mastery tier.
3. Show XP/SP/RP changes from actions.
4. Show location unlock logic using SP + mastery checks.

## Segment 5: Advanced language lane and emotional payoff (1 to 2 min)
1. Swipe map to Shanghai (advanced CN profile).
2. Show WeChat-like texting mission with romanceable character.
3. Complete objective and trigger reward sequence:
- Video call unlock.
- Polaroid memory collectible unlock.

## Demo guardrails
- Keep server-backed and mocked paths functionally identical.
- If remote API is unavailable, run in local-mock mode with same UI.

## Deterministic messaging promo capture route

Use `/mock/messaging-promo` for 9:16 scripted messaging capture.

### Query params

- `fixture`: `seoul_default` | `tokyo_bilingual` | `shanghai_bilingual`
- `city`: `seoul` | `tokyo` | `shanghai`
- `scene`: scene id from `learn.scripted-scenes.sample.json`
- `mode`: `primary_only` | `primary_with_english` | `primary_local_explanation_with_english`
- `autoplay`: `1` or `0`
- `hook`: `overlay` | `inline` | `off`
- `tickMs`: deterministic timer step (clamped 40..400)

### Stable entry examples (starter-pack scenes)

- Seoul default replay: `/mock/messaging-promo?fixture=seoul_default`
- Tokyo JP+EN replay: `/mock/messaging-promo?fixture=tokyo_bilingual`
- Shanghai ZH+EN replay: `/mock/messaging-promo?fixture=shanghai_bilingual`

Exact recording URLs:

- `http://localhost:3000/mock/messaging-promo?fixture=seoul_default`
- `http://localhost:3000/mock/messaging-promo?fixture=tokyo_bilingual`
- `http://localhost:3000/mock/messaging-promo?fixture=shanghai_bilingual`

Playback controls are in-route and deterministic:

1. Play
2. Pause
3. Restart
4. Jump to scene start

### Reviewer-facing recording checklist

1. Keep `hook=off` so first message typing remains visible from frame 1.
2. Capture readable pre-state (first bubble lane visible, timeline at `t=0ms`).
3. Show one visible playback interaction (`Play` or `Restart`).
4. Hold a stable post-state with at least two delivered messages visible.
