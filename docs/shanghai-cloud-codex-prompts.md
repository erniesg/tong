# Shanghai Cloud Codex Prompts

These prompts are meant for Codex cloud runs that may **not** have the local `tong-shanghai` sibling worktree. Each prompt is self-contained: if the referenced Shanghai onboarding files are missing, the agent should create them from scratch in the current repo.

Current local work in `/Users/erniesg/code/erniesg/tong` already covers:
- Shanghai world-map auction pin
- countdown drawer entry
- in-game auction room phase

So the prompts below focus on the Shanghai onboarding runtime, fixture system, webtoon scene type, and dynamic orchestration path.

## Prompt 1: Fixture Runtime + Route Mode

```text
Implement the Shanghai onboarding fixture runtime in the current repo.

Goal:
- Add a generic scene fixture system for hangout scenes.
- Support `mode=fixture` and `mode=dynamic` on `/api/ai/hangout`.
- For `city=shanghai&scene=h1`, resolve fixture id `shanghai/h1-negotiation`.

If the Shanghai files do not already exist, create them.

Required files:
- `apps/client/lib/hangout/fixture-types.ts`
- `apps/client/lib/hangout/fixture-runtime.ts`
- `apps/client/lib/hangout/fixture-runtime.test.ts`
- `apps/client/lib/hangout/fixture-loader.ts`
- modify `apps/client/app/api/ai/hangout/route.ts`

Schema requirements:
- `SceneFixture`, `Beat`, `POVVariant`, `TongBeat`, `ExerciseHook`, `CliffhangerSpec`, `WebtoonSpec`, `WebtoonPanel`, `WebtoonBubble`, `CreditGate`, `ResolutionSpec`
- match the Shanghai H1 plan:
  - ordered beats
  - `pairGroup`
  - `tongBeat.trigger` before/after
  - `exerciseHook`
  - `show_webtoon`
  - `credit_gate`
  - final `end_scene`

Runtime requirements:
- deterministic by seed
- first locked line for V1
- respect `pairGroup`
- async iterable of tool-call-like hangout events
- pause on credit gate until externally resolved

Route requirements:
- `GET /api/ai/hangout?mode=fixture&fixtureId=shanghai/h1-negotiation` streams valid SSE
- `mode=dynamic` keeps existing behavior intact
- `mode=fixture` without fixtureId returns 400
- unknown fixtureId returns 404

Tests:
- seed stability
- beat ordering
- tong after beat
- exercise hook ordering
- show_webtoon emitted
- credit gate pause/resume

Constraints:
- do not break existing Seoul hangout flow
- keep changes additive
- include a short "How to test" section in the final response
```

## Prompt 2: Shanghai H1 Content + Voice Rules + Dynamic Prompt

```text
Implement Shanghai H1 content and dynamic orchestration in the current repo.

Goal:
- Add Shanghai character sheets, location content, H1 fixture content, dynamic prompt, and post-generation voice-rule validation.
- The player is an observer. NPCs do not address the player directly during H1.
- Tong is the only teacher.

If the Shanghai files do not already exist, create them.

Required files:
- `apps/client/lib/content/shanghai/location.ts`
- `apps/client/lib/content/shanghai/characters.ts`
- `apps/client/lib/content/shanghai/fixtures/h1-negotiation.ts`
- `apps/client/lib/content/shanghai/fixtures/index.ts`
- `apps/client/lib/ai/prompts/shanghai-onboarding-h1.ts`
- `apps/client/lib/ai/validators/voice-rules.ts`
- `apps/client/lib/ai/validators/voice-rules.test.ts`
- modify `apps/client/lib/content/locations.ts`
- modify `apps/client/lib/content/characters.ts`
- modify `apps/client/app/api/ai/hangout/route.ts`

Use this behavior:
- H1 fixture id: `shanghai/h1-negotiation`
- opening Tong whisper: "Two people. One's eating, one isn't..."
- locked negotiation beats around:
  - `方案你看过了。`
  - `看了。`
  - `想法？`
  - `蟹壳黄不错。`
  - `这个节目跟其他的不一样。`
  - paired branch using `装不下去` primary and `不愿意` alternate
  - phone ring / `你接吧。` / `不重要。` / `响三次了。很重要。`
  - `我先走。`
  - `小瞿你又多给了！`
- cliffhanger emits `show_webtoon`
- credit gate reveal from 方阿姨
- resolution writes `hangoutSeat`

Voice rules:
- 守成 must reject banned tokens: `不一样的`, `就是这样`, `你懂的`, `明白吧`, `对吧`
- 守成: short declarative, no self-explanation, no invented history
- 丁漫: minimal-response beats must stay short, no backstory references
- 方阿姨: use diminutives `小瞿` and `小丁`
- validator regenerates once or twice, then falls back to locked line

Dynamic prompt requirements:
- fixture is scaffolding, not optional flavor
- enforce beat order
- no `offer_choices`
- Tong only at beat transitions
- output tool calls only
- begin with `set_backdrop`, then Tong whisper, then b1a

Validation:
- `npx tsc --noEmit`
- unit tests for validator
- existing Seoul prompt path still works

Constraints:
- keep all schema changes additive
- no destructive refactors
- include a concise change summary and "How to test"
```

## Prompt 3: Webtoon Scene Type + Credit Gate UI

```text
Implement the Shanghai webtoon cliffhanger scene type in the current repo.

Goal:
- Add a reusable `show_webtoon` scene type for hangouts.
- Render a multi-panel mobile-first webtoon sequence inside the existing scene runtime.
- Pause on the final panel for a credit gate, then resume scene flow.

If files are missing, create them.

Required files:
- `apps/client/components/scene/WebtoonPanel.tsx`
- `apps/client/components/scene/WebtoonBubble.tsx`
- modify `apps/client/components/scene/SceneView.tsx`
- modify `apps/client/lib/types/hangout.ts`
- modify `apps/client/app/api/ai/hangout/route.ts`
- modify `apps/client/app/globals.css`

Panel behavior:
- width types: `full-bleed`, `full-width`, `inset-wide`, `inset-narrow`, `floating`
- height classes: `short`, `standard`, `tall`, `ultra-tall`
- transitions: `fade`, `cut`, `darken`
- tap anywhere or keyboard (`Enter`, `Space`, right arrow) advances
- thumb-stop panel supports delayed bubble reveal
- renderer hides normal dialogue/exercise UI while active

Shanghai H1 specifics:
- 3 panels
- panel 3 is the thumb-stop
- final panel speech bubble contains `瞿家的小儿子……`
- after final panel, if credit gate exists, do not auto-complete until gate resolves

Acceptance:
- works in fixture mode and dynamic mode
- mobile viewport looks intentional
- accessibility labels present
- no regression in existing Seoul scene rendering

Constraints:
- plain CSS, no Tailwind rewrite
- keep changes scoped to scene/webtoon handling
- include a short "How to test"
```

## Prompt 4: Shanghai Right-Edge-First Onboarding Camera

```text
Implement the Shanghai onboarding camera behavior in the current repo so it feels like Seoul onboarding, not a literal page flow.

Primary UX:
1. The player enters a wide Shanghai scene framed inside a portrait viewport.
2. Act 1 shows only the **right edge first** of the wider source, not the full frame.
3. Tong sets context from that right-edge crop and can trigger an exercise while the player remains in guided mode.
4. Only after Tong advances the scene does the player gain horizontal pan/scroll control to move left.
5. Panning left reveals Shoucheng and Dingman at the table.
6. Tong then prompts the player to tap them to begin the eavesdropping/webtoon progression.
7. Flow continues into the existing Shanghai H1 orchestration path and returns cleanly to the world map.

If the Shanghai onboarding files are missing, create the minimal runtime needed in the current repo.

Preferred files:
- modify `apps/client/app/game/page.tsx`
- modify `apps/client/components/scene/SceneView.tsx`
- add a Shanghai-specific panoramic scene component if needed, for example:
  - `apps/client/components/scene/ShanghaiPreludeViewport.tsx`
- modify `apps/client/app/globals.css`

Important constraints:
- Do not replace the Seoul onboarding runtime.
- Gate this behavior behind `city=shanghai&scene=h1`.
- The wide source should behave like a horizontally navigable scene inside a 9:16 phone viewport.
- Act 1 must be guided: no free pan until Tong explicitly unlocks it.
- After unlock, user pan should feel intentional on mobile and desktop.
- The tap target for Shoucheng/Dingman should be explicit once revealed.
- Trigger the existing or newly-added `show_webtoon` / fixture progression when they are tapped.
- Avoid generic admin/demo UI language. This is an in-world scene.

Deliverables:
- camera/viewport behavior
- Tong-led guided copy hooks
- pan unlock state
- revealed tap affordance
- handoff into eavesdrop/webtoon flow

Validation:
- `/game?phase=hangout&city=shanghai&scene=h1&mode=fixture`
- guided right-edge-first behavior works
- later pan-left reveal works
- tapping the pair enters the eavesdrop/webtoon path
- Seoul onboarding still works

Include a short "How to test" section.
```

## Prompt 5: Live Auction Backend Path

```text
Build the real live-auction data path for the Shanghai auction room in the current repo.

Context:
- The player should enter the auction from the Shanghai world map via a special countdown pin.
- The current local UI may already exist as an in-game room, but it needs a real data/API path.
- Cloud environment may not have the local Shanghai onboarding worktree, so keep the task self-contained.

Goal:
- Add shareable event-room APIs and client helpers for:
  - join room as bidder/admin
  - fetch live room state
  - place bid
  - admin actions: extend, close, reset, announcement/media update
- Keep it demo-safe and additive.

Suggested files:
- `packages/contracts` for response/request shapes
- `apps/client/lib/api.ts` for client helpers
- server route files under `apps/server` or existing API surface used by this repo
- optional direct route `apps/client/app/events/[eventId]/page.tsx` if the repo does not already have one

Requirements:
- event id default for Shanghai demo can be `shoucheng-dingman`
- status model: open / closed
- leader, participants, recent bids, countdown, unlock state
- bidder and admin roles
- meaningful errors for invalid event/admin credentials
- no destructive schema changes

Validation:
- client can join, bid, extend, close
- state refresh works
- build passes

Include "How to test" and any assumptions.
```
