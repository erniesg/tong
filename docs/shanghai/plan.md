# Shanghai Onboarding — Plan, Epics & Issues

Branch: `feat/shanghai-onboarding`
Worktree: `/Users/erniesg/code/erniesg/tong-shanghai`
Dev port: 3002

---

## Goal

Ship H1 of a Shanghai onboarding hangout that:
- Runs **prebaked from a fixture** for fast iteration and QA determinism
- Runs **dynamically via AI** in production, with the same fixture as scaffolding
- Includes a **webtoon multi-panel cliffhanger** (new scene type)
- Enforces **voice rules** so generated dialogue never produces the known cringe patterns (`不一样的` meta-tag, invented backstory, etc.)

V1 = H1 only. H2 branches + show transition = V1.1. Critique pass = V2.

---

## Architecture summary

### Two runtimes, one content file

```
┌─────────────────────────────────────────────┐
│ Scene Fixture (shanghai/h1-negotiation)     │
│   - beats (locked lines + variants + rules) │
│   - POV variants                            │
│   - webtoon cliffhanger                     │
│   - exercise hooks                          │
│   - tong interjections                      │
└────────────────┬────────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌────────────────┐  ┌─────────────────────────┐
│ Fixture runtime│  │ Dynamic orchestrator    │
│ (verbatim)     │  │ (fixture = scaffolding) │
│ dev / QA       │  │ prod                    │
└────────┬───────┘  └─────────┬───────────────┘
         │                    │
         └────────┬───────────┘
                  ▼
      Same SSE tool-call stream
                  ▼
            SceneView renders
```

### New scene component: Webtoon

```
show_webtoon({ panels, autoAdvance }) tool call
  ↓
<WebtoonPanel /> mounts inside SceneView
  ↓
sequences through panels with transitions + gaps per spec
  ↓
speech bubble overlay on thumb-stop panels
  ↓
credit gate on final panel
  ↓
resumes scene or emits end_scene
```

---

## Dependency graph

```
Epic 1 (Fixture abstraction)
 ├─ 1.1 types ──────────┬── 1.2 runtime ──── 1.3 route integration
 │                      │
Epic 2 (Content)        │
 ├─ 2.1 location ───────┼── 2.3 H1 fixture
 └─ 2.2 characters ─────┘        │
                                 │
Epic 3 (Webtoon)                 │
 ├─ 3.1 panel component ── 3.2 tool ── 3.3 H1 panel assets
 │                                           │
 └───────────────────────────────────────────┘
                                 │
Epic 4 (Dynamic integration)     │
 ├─ 4.1 prompt ───────────── (uses 2.3)
 ├─ 4.2 voice rules validator ─ (uses 2.2)
 └─ 4.3 POV seat state ──────── (uses 1.2)

Epic 6 (QA)
 ├─ 6.1 dev toggle
 ├─ 6.2 regression tests
 └─ 6.3 playtest doc
```

**Parallelizable:** 1.1 | 2.1 | 2.2 | 3.1 can all start immediately.
**Critical path:** 1.1 → 1.2 → 1.3 → 2.3 → 4.1 → end-to-end H1.

---

## Issue card template (explanation)

Every card uses this shape so any dev can pick it up cold:

- **Red** — current failing state (the problem / gap)
- **Green** — target state (what exists after)
- **Files** — where work happens
- **Acceptance criteria** — testable conditions
- **Dependencies** — other cards that must complete first
- **Estimate** — S / M / L

---

# Epic 1 — Scene Fixture abstraction

Generic system that lets us define prebaked scenes that can run as fixture-verbatim or be used as AI scaffolding.

## Issue 1.1 — Fixture types + schema

**Red:** No type system for scene fixtures. Can't represent "beat with locked line + variants + style rules" anywhere.

**Green:** TypeScript types exported from `fixture-types.ts` covering every construct used by the H1 fixture.

**Files:**
- `apps/client/lib/hangout/fixture-types.ts` (new)

**Types to define:**
```ts
export type SceneFixture = {
  id: string;                    // "shanghai/h1-negotiation"
  location: string;              // "shanghai:xiaolongbao"
  entryNarration?: string;
  povVariants?: Record<string, POVVariant>;
  seatingRandomized?: boolean;
  beats: Beat[];
  cliffhanger?: CliffhangerSpec;
  resolution: ResolutionSpec;
};

export type Beat = {
  id: string;
  speaker: "dingman" | "shoucheng" | "ayi" | "ambient" | "webtoon";
  intent: string;
  lockedLines?: string[];         // verbatim candidates
  variantExamples?: string[];     // priming for AI
  styleRules?: string[];
  expression?: string;
  clarity?: "full" | "fragment";
  translation?: string;
  tongBeat?: TongBeat;
  exerciseHook?: ExerciseHook;
  pairGroup?: string;             // "b2-pair-A" — beats with same pairGroup must stay together
  followUp?: string;              // free-text stage direction
};

export type POVVariant = {
  seatDescription: string;
  offscreenVoice?: string;
};

export type TongBeat = {
  trigger: "before" | "after";
  text: string;
  free: boolean;                  // fires without credit spend
  vocab?: { zh: string; py: string; en: string }[];
};

export type ExerciseHook = {
  type: string;                   // matches existing exercise-type union
  target: string;                 // vocab item
  radicalBreakdown?: string;
};

export type CliffhangerSpec = {
  webtoon: WebtoonSpec;
  tongBeat?: TongBeat;
  creditGate?: CreditGate;
};

export type WebtoonSpec = {
  panels: WebtoonPanel[];
  autoAdvance?: boolean;
};

export type WebtoonPanel = {
  id: string;
  imageUrl: string;
  widthType: "full-bleed" | "full-width" | "inset-wide" | "inset-narrow" | "floating";
  heightClass: "short" | "standard" | "tall" | "ultra-tall";
  aspectRatio: string;            // "2:3" | "1:1" | "4:7" etc
  shotType: string;               // "wide-establishing" | "medium-ots" | "extreme-closeup" etc
  gapBefore: { px: number; color: string };
  isThumbStop?: boolean;
  bubble?: WebtoonBubble;
  transition: "fade" | "cut" | "darken";
};

export type WebtoonBubble = {
  zh: string;
  py?: string;
  en?: string;
  speaker: string;                 // "ayi" | "dingman" | "shoucheng" | "narrator"
  position: "top" | "bottom" | "center-bottom";
};

export type CreditGate = {
  cost: number;
  spendPayload: {
    additionalLines?: AyiLine[];
    tongExplanation?: string;
    vocabUnlocks?: string[];
  };
  skipPayload: {
    tongFallback?: string;
  };
};

export type ResolutionSpec = {
  masteryUpdates: { id: string; item: string; firstContact?: boolean }[];
  affinityChanges: { characterId: string; delta: number; note?: string }[];
  stateUpdates?: Record<string, unknown>;
  nextHook?: string;
};
```

**Acceptance:**
- `npx tsc --noEmit` passes
- Types are importable from `@/lib/hangout/fixture-types`
- Unused-export lint passes (every exported type used somewhere downstream, or marked public-api)
- Runtime validator optional but if added, use Zod schema matching types 1:1

**Dependencies:** none
**Estimate:** S (half day)

---

## Issue 1.2 — Fixture runtime

**Red:** Given a SceneFixture, there's no code that replays it as hangout tool-call events.

**Green:** `runFixture(fixture, ctx)` returns an async iterable of the same events the AI path emits (npc_speak, tong_whisper, show_exercise, show_webtoon, set_atmosphere, set_backdrop, credit_gate, end_scene).

**Files:**
- `apps/client/lib/hangout/fixture-runtime.ts` (new)
- `apps/client/lib/hangout/fixture-runtime.test.ts` (new)

**Implementation notes:**
- Input: `{ fixture: SceneFixture, seed?: number, povOverride?: string }`
- Output: `AsyncIterable<HangoutEvent>` where `HangoutEvent` is a discriminated union matching the existing SSE event shape in `app/api/ai/hangout/route.ts`
- POV randomization: if `seed` provided use deterministic PRNG, otherwise `Math.random()`
- For beats with multiple `lockedLines`, pick the first one (V1) — selection strategy can be extended later
- Respect pairGroup: pick one pair at scene start, stay in it
- Tong interjections fire at trigger points (before/after parent beat)
- Exercise hooks emit `show_exercise` after the parent beat's tong (if any)
- Credit gate pauses the iterable until resolved externally (see 1.3 for wiring)

**Acceptance:**
- Unit test: fixture with 3 beats emits 3 npc_speak events in order
- Unit test: beat with tongBeat trigger=after emits npc_speak then tong_whisper
- Unit test: beat with exerciseHook emits npc_speak → tong → show_exercise
- Unit test: seed=42 twice → identical output
- Unit test: pairGroup respected — no mixing across pairs
- Unit test: cliffhanger webtoon emits show_webtoon with all panels
- Unit test: credit gate pauses until resolution signal

**Dependencies:** 1.1
**Estimate:** M (1-2 days)

---

## Issue 1.3 — Hangout route fixture mode

**Red:** `/api/ai/hangout` only supports AI-generated scenes.

**Green:** Same route accepts `mode=fixture&fixtureId=...` and streams fixture events in the existing SSE format. SceneView renders fixture-driven scenes unchanged.

**Files:**
- `apps/client/app/api/ai/hangout/route.ts` (modify)
- Optionally: `apps/client/lib/hangout/fixture-loader.ts` (new) — maps fixtureId to import

**Implementation notes:**
- Parse query params: `mode` ∈ `{"dynamic", "fixture"}`, default `"dynamic"`; `fixtureId` required if mode=fixture
- When mode=fixture: load fixture via fixture-loader, run through `runFixture`, pipe events as SSE
- When mode=dynamic: existing behavior unchanged for V1 (epic 4 integrates fixture as scaffolding)
- Credit-gate resolution: new POST endpoint or query-param continuation — decide during implementation (see open questions)

**Acceptance:**
- `GET /api/ai/hangout?mode=fixture&fixtureId=shanghai/h1-negotiation` streams valid SSE
- SceneView renders the fixture-driven scene without modifications
- Dynamic mode unchanged — existing Seoul flow works
- Error: unknown fixtureId → 404 with meaningful message
- Error: mode=fixture without fixtureId → 400

**Dependencies:** 1.2, 2.3 (needs fixture to exist)
**Estimate:** S-M (1 day)

**Open question:** credit-gate resolution mechanism — SSE + client POST continuation vs WebSocket. Document the choice in code.

---

# Epic 2 — Shanghai content V1

## Issue 2.1 — Shanghai location + vocabulary

**Red:** No Shanghai city in content registry.

**Green:** Shanghai city with location `shanghai:xiaolongbao` (`小笼包店`), complete L0–L3 curriculum.

**Files:**
- `apps/client/lib/content/shanghai/location.ts` (new)
- `apps/client/lib/content/locations.ts` (modify — register shanghai:xiaolongbao)
- `apps/client/lib/content/cities.ts` (modify if exists, or create shanghai entry)

**Curriculum spec:**
- **L0 — Script:** pinyin basics; character recognition for 方, 案, 不, 一, 样, 愿, 意, 装, 小, 笼, 包
- **L1 — Pronunciation:** tone pairs (方案 fāng'àn, 愿意 yuànyì), tone-sandhi drills, 装 and 跑 minimal pairs
- **L2 — Vocabulary:** 方案 proposal, 愿意 willing, 装 pretend/install, 不一样 different, 小笼包, 蟹壳黄, 阿姨, 犟 stubborn, 本事 ability, 接 answer (phone), 重要 important
- **L3 — Grammar:** 不会 vs 不愿意 (inability vs unwillingness); 你 formal/informal; ~了 aspect (看了); ~不下去 potential complement (装不下去)

**Acceptance:**
- `getLocationOrDefault("shanghai:xiaolongbao")` returns fully populated location
- Shanghai visible in cities registry
- Each level lists its objectives with ids matching mastery tracking
- Backdrop asset path populated (pending Epic 3 for actual asset)

**Dependencies:** none
**Estimate:** M (1 day)

---

## Issue 2.2 — Shanghai character sheets

**Red:** No character sheets for 丁漫, 守成, 方阿姨 — dialogue generation has no voice rules to enforce.

**Green:** Three character sheets with personality, voice rules, forbidden moves, and relationship stages. Physical descriptions stay minimal — full art direction lives in `docs/shanghai/h1-generation-prompts.md`.

**Files:**
- `apps/client/lib/content/shanghai/characters.ts` (new)
- `apps/client/lib/content/characters.ts` (modify — re-export shanghai characters)

**Per character — required fields:**
- `id`, `name`, `nameZh`, `age`, `gender`
- `archetype` (one-liner)
- `personality.traits[]`, `personality.likes[]`, `personality.dislikes[]`, `personality.motivations[]`, `personality.quirks[]`
- `voiceRules.forbiddenMoves[]` — list of strings (e.g., `"Never append meta-tag 不一样的 to own distinction"`)
- `voiceRules.patterns[]` — list of observed patterns
- `voiceRules.forbiddenTokens[]` — literal tokens that trigger regeneration
- `speechStyle` by relationship stage (strangers / friends / close / romantic)
- `relationshipStages[]` — same shape as Seoul characters (Ha-eun, Jin)
- `romanceable: boolean`

**守成 specifics:**
```ts
voiceRules: {
  forbiddenMoves: [
    "Never append meta-tags to his own distinctions",
    "Never explain his own insight — state it and stop",
    "Never echo his OWN earlier words (he only echoes HER words)",
    "Never reference history the player hasn't witnessed",
    "No flattery, no softeners, no throat-clearing",
  ],
  forbiddenTokens: ["不一样的", "就是这样", "你懂的", "明白吧", "对吧"],
  patterns: [
    "Short declarative sentences",
    "Rehearsed pitch register at pitch moments",
    "Flat life-delivery on personal calls",
  ],
}
```

**丁漫 specifics:**
```ts
voiceRules: {
  forbiddenMoves: [
    "Minimum viable response to open business questions",
    "Never acknowledge business framing head-on — redirect or mirror",
    "No references to her past (fame, scandal, mentor role) in H1",
  ],
  forbiddenTokens: [],
  patterns: [
    "Food-as-deflection",
    "Mirror his register to strip authority",
    "Uses the 阿姨 as a deflection foil when pressed",
  ],
}
```

**方阿姨 specifics:**
```ts
voiceRules: {
  forbiddenMoves: [
    "Only character who can reference backstory directly",
    "Always uses diminutives 小瞿 / 小丁 when referring to them",
  ],
  forbiddenTokens: [],
  patterns: [
    "Scolding-but-familiar when addressing either lead",
    "Observational narration when player is audience",
  ],
}
romanceable: false
```

**Acceptance:**
- `getCharacter("shoucheng")`, `getCharacter("dingman")`, `getCharacter("fangayi")` return full sheets
- Voice rule blocks can be serialized into prompt context via helper `voiceRulesBlock(characterId)`
- 守成 and 丁漫 flagged romanceable; 方阿姨 is not
- Relationship stage defaults: player starts at `strangers` for all three

**Dependencies:** none
**Estimate:** M (1 day)

---

## Issue 2.3 — H1 fixture content

**Red:** No `shanghai/h1-negotiation` fixture exists.

**Green:** Fixture file contains all beats, POV variants, cliffhanger, exercise hooks per the locked design in `docs/shanghai/h1-generation-prompts.md` and the prior plan conversation.

**Files:**
- `apps/client/lib/content/shanghai/fixtures/h1-negotiation.ts` (new)
- `apps/client/lib/content/shanghai/fixtures/index.ts` (new — barrel export)

**Beat checklist (must all be present):**
- Opening Tong free whisper: "Two people. One's eating, one isn't..."
- b1a 守成 locked `方案你看过了。` + variants
- b1b 丁漫 locked `看了。` + variant `嗯。`
- b1c 守成 locked `想法？` + variants `然后呢。` / `怎么样。`
- b1d 丁漫 locked `蟹壳黄不错。` + variants `小笼包不错。` / `汤包今天馅多了。` / `醋要不要。`
- Tong after b1d + exercise hook on 方案
- b2a 守成 locked `这个节目跟其他的不一样。`
- b2b 丁漫 locked `每个节目都说自己不一样。`
- b2c 守成 locked `...你说得对。`
- b2d 守成 — PAIR A locked `那我换个说法。这个节目需要一个不装的人。`; PAIR B alternate `那我换个说法。这个节目需要一个不会说假话的人。`
- b2e 丁漫 — PAIR A `...你觉得我不装？`; PAIR B `...你觉得我不会说假话？`
- b2f 守成 — PAIR A `我觉得你装不下去。`; PAIR B `我觉得你不愿意。`
- Tong after b2f + exercise hook on 愿意
- ex1 ambient phone rings
- ex2 丁漫 LOCKED `你接吧。`
- ex3 守成 `不重要。`
- ex4 丁漫 LOCKED `响三次了。很重要。`
- ex5 守成 LOCKED `...我知道了。`
- ex6 守成 `我先走。`
- ex7 action: leaves cash, too much
- ex8 阿姨 LOCKED `小瞿你又多给了！`
- Cliffhanger webtoon: 3 panels (spec in generation-prompts doc)
- Tong free after webtoon: "小儿子 — younger son. She knows his family."
- Credit gate: spend → 阿姨 extended line `跟他爸一个脾气，犟。但是他爸犟是因为有本事。他犟是因为要证明自己也有本事。` + tong explanation; skip → tong fallback
- Resolution: masteryUpdates (方案, 愿意 or 装, 不一样); affinityChanges (fangayi +3); stateUpdates `hangoutSeat`

**Acceptance:**
- Fixture validates against SceneFixture type (passes `tsc --noEmit`)
- All 3 webtoon panels reference asset paths (placeholders OK until 3.3)
- PairGroup metadata lets AI orchestrator stay within one pair
- Loads via fixture-loader in 1.3

**Dependencies:** 1.1, 2.2
**Estimate:** M (1 day)

---

# Epic 3 — Webtoon scene type

## Issue 3.1 — WebtoonPanel component

**Red:** No way to render a multi-panel visual sequence.

**Green:** React component that renders a sequence of panels with transitions, gap pacing, and speech bubbles, following the webtoon layout spec.

**Files:**
- `apps/client/components/scene/WebtoonPanel.tsx` (new)
- `apps/client/components/scene/WebtoonBubble.tsx` (new)
- `apps/client/app/globals.css` — add `.webtoon-panel-*` classes (per project convention, plain CSS not Tailwind)

**Spec:**
- Props: `{ panels: WebtoonPanel[], autoAdvance?: boolean, onComplete: () => void }`
- Renders one panel at a time, mobile-first (phone viewport 9:16)
- Layout must stay metadata-driven per panel. Do not hardcode H1-specific CSS branches by panel id.
- Panel layout respects:
  - widthType — full-bleed = edge-to-edge; full-width = ~95% with thin margin; inset-wide = ~75% centered; inset-narrow = ~50% centered; floating = positioned, surrounded by empty space
  - aspectRatio — CSS `aspect-ratio` property
  - heightClass — `height: calc(var(--viewport-h) * factor)`; short=0.5, standard=0.8, tall=1.2, ultra-tall=2.0
  - gapBefore — colored block rendered above the panel with height = gapBefore.px
  - transition — `fade` (opacity 0→1), `cut` (instant), `darken` (fade-to-black between panels, hold, fade-in)
- Follow `docs/shanghai/webtoon-layout-system.md` for pacing and width/height decisions.
- Speech bubbles:
  - `<WebtoonBubble zh py en speaker position>` — renders character + pinyin annotation + translation tooltip on tap
  - Positioning: absolute over the panel per `position` prop
  - Animation: 200ms fade + 100ms settle on mount
- Tap anywhere (or right-arrow/Enter) advances to next panel
- When `panels[last]` completes and a credit gate is pending, pause on final panel until resolution

**Acceptance:**
- Storybook story with 3-panel sequence (Panel 1 / 2 / 3 from H1 fixture) renders correctly
- Backstage or mock layout harness renders the same sequence with placeholder images so layout can be tested before art lands
- Panel 3 thumb-stop with wide black gap pacing visibly different from 1→2 transition
- Speech bubble on Panel 3 shows 瞿家的小儿子…… with pinyin tooltip on tap
- Keyboard advance: Enter/Space/→ advances panel
- Mobile tap: tap anywhere on panel advances
- Accessibility: each panel has aria-label matching its shotType + narrative intent; bubbles have proper role

**Dependencies:** 1.1
**Estimate:** M (2 days)

---

## Issue 3.2 — show_webtoon tool

**Red:** Hangout orchestrator has no tool call for triggering a webtoon.

**Green:** `show_webtoon` tool registered in hangout route tool definitions; SceneView handles the event and mounts WebtoonPanel.

**Files:**
- `apps/client/app/api/ai/hangout/route.ts` (modify — add tool schema)
- `apps/client/components/scene/SceneView.tsx` (modify — handle event)
- `apps/client/lib/types/hangout.ts` (modify — add WebtoonEvent to event union)

**Tool schema:**
```ts
{
  name: "show_webtoon",
  description: "Display a multi-panel webtoon sequence. Use for cliffhangers, memory reveals, or eavesdrop moments that need visual framing.",
  input_schema: {
    type: "object",
    properties: {
      panels: { type: "array", items: { /* WebtoonPanel */ } },
      autoAdvance: { type: "boolean", default: false },
    },
    required: ["panels"],
  },
}
```

**Acceptance:**
- Tool appears in `tools` array of hangout route
- SceneView receives webtoon event and mounts WebtoonPanel with panels
- Other dialogue/exercise UI hides while webtoon is active
- After last panel + credit gate resolution, scene resumes
- Works in both fixture mode (via runtime 1.2) and dynamic mode

**Dependencies:** 3.1
**Estimate:** S (half day)

---

## Issue 3.3 — H1 webtoon panel assets

**Red:** H1 fixture references 3 panel image paths that don't exist.

**Green:** 3 panel images generated and stored in `public/assets/webtoon/shanghai/h1/`, matching generation-prompts spec exactly.

**Files:**
- `apps/client/public/assets/webtoon/shanghai/h1/p1.png` (new)
- `apps/client/public/assets/webtoon/shanghai/h1/p2.png` (new)
- `apps/client/public/assets/webtoon/shanghai/h1/p3.png` (new)
- Optional: character reference sheets in `public/assets/webtoon/shanghai/refs/`

**Process:**
1. Generate character reference sheets first using locked tokens from generation-prompts doc
2. Generate Panel 1 → check consistency against refs
3. Generate Panel 2 using Panel 1 as style reference
4. Generate Panel 3 using refs + style consistency notes
5. Save at 2x resolution (1600×2400 for 2:3, etc.) for retina; downscale on export
6. Keep important composition inside the center-safe area from `docs/shanghai/webtoon-layout-system.md`
7. Leave Panel 3 lower 40% empty for compositor bubble overlay

**Acceptance:**
- Each panel matches aspect ratio spec (2:3, 1:1, 4:7)
- Characters spatially consistent across panels (same person, same outfit, same chair position continuity)
- Style consistent hand-painted webtoon aesthetic
- Panel 3 has empty lower 40% for speech bubble overlay (no text baked into image)
- Art remains readable when dropped directly into the backstage webtoon lab without additional per-image CSS adjustments
- Palette consistent with art direction
- Manual review signoff from creative lead before merge

**Dependencies:** 2.3 (fixture needs to reference paths)
**Estimate:** L (asset work — 2-3 days with iteration)

---

## Issue 3.6 — Per-bubble reveal gating (free / credits / game pass) — GitHub #230

**Status update (2026-04-21):** shipped for V1 onboarding demo.

**Red:** Bubbles in the webtoon strip always reveal EN translation freely — no way to demo the SA / Game Pass paywall hook or gate a premium scene reveal.

**Green:** Fixture bubbles carry an optional `gate` field. `WebtoonStrip` resolves each bubble's `reveal` prop from `gate` + runtime entitlement (game pass / SP balance / dev bypass). Pinyin ruby always stays free; the paywall sits only on EN translation and (for premium gates) the bubble opening itself.

**Files:**
- `apps/client/lib/hangout/fixture-types.ts` — `WebtoonBubbleGate` union + `WebtoonBubble.gate` field. ✅
- `apps/client/components/scene/WebtoonStrip.tsx` — `WebtoonEntitlement` prop + `resolveBubbleReveal()`. ✅
- `apps/client/lib/store/game-store.ts` — `GamePassEntitlement` + `SET_GAME_PASS` action + loadState backfill. ✅
- `apps/client/app/webtoon/[fixtureId]/page.tsx` — URL-param entitlement override. ✅
- `apps/client/app/onboarding/shanghai/page.tsx` — combines store entitlement with URL override. ✅
- `apps/client/lib/content/shanghai/fixtures/h1-webtoon.ts` — gating policy applied: p1/p2 free, p3-p17 credits (1 SP), p18 Game Pass. ✅

**Demo knobs:** `?dev_pass=1` bypass, `?game_pass=1` simulate pass, `?sp=5` preload credits.

**Deferred to V1.1:** (1) bubble tap triggers a purchase sheet when gated and SP insufficient — right now the gated bubble is simply non-interactive and shows a lock affordance; (2) actual Stripe Checkout + webhook to flip `gamePass.active` server-side; (3) credit-spend micro-transactions (tapping a 1-credit bubble deducts SP rather than relying on pre-loaded balance).

**Acceptance:**
- ✅ `WebtoonBubble.gate` optional; omission means free.
- ✅ Game Pass unlocks all gates. SP balance ≥ cost unlocks credit gates. `bypass` unlocks everything (dev/demo).
- ✅ Lock affordance in `aria-label` ("Help unlocks for N credits" / "Help unlocks with Game Pass") so gated state is screen-reader friendly.
- ⏳ Tapping a gated bubble opens a purchase sheet (V1.1).
- ⏳ Spend flow deducts SP and sets `reveal: free` for that bubble's lifetime (V1.1).

---

## Issue 3.10 — Onboarding playtest route — NEW

**Red:** No dedicated link for playing the onboarding hangout with completion side effects (mastery/affinity/xp dispatched into the game store).

**Green:** `/onboarding/shanghai` — wraps the Shanghai H1 webtoon in a full-viewport scroll container, reads entitlement from game store + URL override, and on scene completion dispatches `RECORD_ITEM_RESULT` for the 5 surfaced vocab items, `UPDATE_AFFINITY` (`fangayi +3`), `INCREMENT_LOCATION_HANGOUT` (`shanghai:dumpling_shop`), `ADD_XP (+40)`. A completion chip offers "Return to map".

**Files:**
- `apps/client/app/onboarding/shanghai/page.tsx` ✅
- `apps/client/app/webtoon/page.tsx` — gallery now surfaces the playable entry separately from raw fixtures.

**Open follow-on:** first-hangout default routing (if player picks Chinese as priority language, drop into `/onboarding/shanghai` from the game flow instead of showing the map). Deferred pending a priority-language selection step in the game flow.

---

# Epic 4 — Dynamic prompt integration

## Issue 4.1 — Shanghai onboarding prompt

**Status update (2026-04-21):** revised for webtoon-as-scene model.

**Red:** No AI prompt for Shanghai hangout that uses the H1 fixture as scaffolding. V1 ships fixture-verbatim at `/onboarding/shanghai`; this issue delivers the dynamic follow-on so the orchestrator can produce tool-calls under the same fixture constraints.

**Green:** `buildShanghaiOnboardingH1Prompt({ fixture, playerName, seat, masterySnapshot, explainLang })` composer that emits a system prompt carrying: role framing (eavesdrop scene — only 方阿姨 addresses the player), three-character voice rules imported from `shanghai/characters.ts` via `voiceRulesBlock()`, the POV variant for the selected seat, the beat outline (locked vs variant), webtoon instructions (one `show_webtoon` at start, panels come from fixture, never invent art), validator compliance, and the resolution spec.

**Files:**
- `apps/client/lib/ai/prompts/shanghai-onboarding-h1.ts` — scaffold landed 2026-04-21 (commit `e6632db`).
- `apps/client/app/api/ai/hangout/route.ts` — NOT yet wired to the new composer. Dynamic path still goes through generic orchestrator.

**Content source:** prose guidelines in `docs/shanghai/h1-generation-prompts.md` §6; the TS composer imports voice rules + POV + beats directly from data so the prompt stays in sync with fixture edits.

**Acceptance (updated):**
- ✅ Prompt accepts `{ fixture, playerName, seat, masterySnapshot, explainLang }` input shape (scaffold done).
- ⏳ Wired into `/api/ai/hangout` when `city=shanghai`, `scene=h1`, `onboarded=false`.
- ⏳ Output is a series of tool calls in beat order; opens with `show_webtoon` containing the full panel array, not with a traditional `set_backdrop`.
- ⏳ Locked lines respected on ≥ 95% of beats (spot check 10 runs).
- ⏳ No `不一样的` on 守成 lines across 10 runs (voice rule validator must regenerate).
- ⏳ Every `npc_speak` passes the voice validator on attempt 1 or 2; attempt 3 falls back to `lockedLines[0]`.
- ⏳ Seat defaults to `'dingman'` for onboarding (deterministic); `povVariants` randomization is H2-and-beyond.
- ⏳ On credit_gate resolution: spend emits extended 方阿姨 lines + tong explanation; skip emits tong fallback only.
- ⏳ Ends with `end_scene` carrying `masteryUpdates`, `affinityChanges` (`fangayi +3`), and `stateUpdates` from the fixture resolution.

**Dependencies:** 2.2 (done), 2.3 (done), 4.2 (uncommitted — validator exists but not guaranteed on all paths).
**Estimate:** M (1-2 days) — scaffold done; remaining work is route wiring + regression test harness.

---

## Issue 4.2 — Voice rule validator

**Red:** AI can still generate lines that violate character forbidden moves (meta-tags, invented backstory).

**Green:** Post-generation validator scans npc_speak output for forbidden tokens/patterns per character, regenerates the offending beat up to 2 times before falling back to the locked line.

**Files:**
- `apps/client/lib/ai/validators/voice-rules.ts` (new)
- `apps/client/lib/ai/validators/voice-rules.test.ts` (new)
- Integration point: `apps/client/app/api/ai/hangout/route.ts` — wrap npc_speak stream events

**Validator API:**
```ts
validateLine(characterId: string, line: string, beatContext?: Beat): ValidationResult

type ValidationResult =
  | { ok: true }
  | { ok: false, violations: string[] }
```

**Checks per character:**
- 守成: scan for forbiddenTokens (`不一样的` etc); scan for own-echo (his earlier lines in scene); check no meta-tag appended to distinction beats
- 丁漫: scan for over-length in minimum-viable beats (b1b, b1c reply, exit beats) — character count limit per beat styleRule
- 方阿姨: ensure diminutive used when referring to 丁漫/守成; mostly permissive

**Acceptance:**
- Unit test: `validateLine("shoucheng", "我觉得你不愿意。不一样的。")` returns violation
- Unit test: `validateLine("shoucheng", "我觉得你装不下去。")` returns ok
- Unit test: `validateLine("dingman", "看了。")` returns ok for b1b
- Unit test: `validateLine("dingman", "看了看，感觉还行。", {id: "b1b"})` returns over-length violation
- Integration: hangout stream with mocked AI emitting a cringe line regenerates once, succeeds on second attempt, or falls back to locked line after 2 retries

**Dependencies:** 2.2
**Estimate:** M (1-2 days)

---

## Issue 4.3 — POV seat state

**Red:** No game-state field for which NPC the player faced — H2 branch has nothing to read.

**Green:** `hangoutSeat: Record<sceneId, "shoucheng" | "dingman">` persisted in game store, written at scene start, available for H2 routing.

**Files:**
- `apps/client/lib/store/game-store.ts` (modify — add hangoutSeat field to GameState)
- `apps/client/lib/hangout/fixture-runtime.ts` (modify — emit stateUpdate event on scene start)
- `apps/client/lib/store/checkpoint-resume.ts` (modify if needed — include hangoutSeat in persisted state)

**Acceptance:**
- After running H1 fixture, `useGameState().hangoutSeat["shanghai/h1-negotiation"]` is either `"shoucheng"` or `"dingman"`
- Value persists across localStorage reloads
- Unit test: dispatch state update → game store reflects it
- H2 branch stub (V1.1) can read this value

**Dependencies:** 1.2
**Estimate:** S (half day)

---

# Epic 5 — H2 branches + show transition (V1.1, stubbed)

Not implemented in V1. Cards listed for later pickup.

## Issue 5.1 — H2 shoucheng-alone fixture
Skeleton fixture that runs when `hangoutSeat["shanghai/h1-negotiation"] === "shoucheng"`. Content beats per prior conversation: notebook, 2017 footage phone call, dad call (`我在处理。你跟爸说我在处理`), 阿姨 brings tea unrequested.

## Issue 5.2 — H2 dingman-alone fixture
Content beats: one steamer instead of two, earlier arrival, scrolling survival-show clips, asks 阿姨 about 守成's folder `给我看看` / `我拿回去看`, 阿姨 says `迟早的事`.

## Issue 5.3 — Show venue scene (replaces H4)
After H2 completes, next game entry drops player into the show venue, not back to the 小笼包店. 丁漫 in a different outfit, hair done, posture different. 守成 in a proper suit, on phone, not eating. Tong: "Wait — isn't that the person from the 小笼包店?"

## Issue 5.4 — Cross-scene recognition flags
If player faced 丁漫 in H1 and she was facing you, a half-second of almost-recognition in the show scene. If they faced 守成, he doesn't register.

---

# Epic 6 — QA + iteration loop

## Issue 6.1 — Fixture dev toggle

**Red:** No way to force fixture mode while developing.

**Green:** Query param `?mode=fixture` forces fixture mode for the current scene. Dev-only toggle in backstage UI optional.

**Files:**
- `apps/client/app/game/page.tsx` (modify — read mode param, pass to hangout API)

**Acceptance:**
- `/game?phase=hangout&city=shanghai&scene=h1&mode=fixture` runs fixture verbatim
- No param: defaults to dynamic mode (which still uses fixture as scaffolding via Epic 4)
- Dev build shows current mode in debug overlay

**Dependencies:** 1.3
**Estimate:** S (half day)

---

## Issue 6.2 — Voice rule regression tests

**Red:** No automated way to detect dialogue quality regressions.

**Green:** Snapshot test runs the dynamic prompt against H1 fixture (with seed) and asserts no voice rule violations in output.

**Files:**
- `apps/client/lib/ai/prompts/shanghai-onboarding-h1.test.ts` (new)

**Test:**
```ts
test("H1 dynamic output honors voice rules (10 runs)", async () => {
  for (let i = 0; i < 10; i++) {
    const events = await runDynamicH1(seed + i);
    const npcSpeaks = events.filter(e => e.type === "npc_speak");
    for (const evt of npcSpeaks) {
      const result = validateLine(evt.characterId, evt.text, evt.beat);
      expect(result.ok).toBe(true);
    }
  }
});
```

**Acceptance:**
- Test file runs via `npx vitest` (or project test runner)
- 10 runs with varied seeds all pass voice validation
- Mock or canned AI responses to keep test deterministic (real AI call optional, gated behind integration flag)

**Dependencies:** 4.1, 4.2
**Estimate:** M (1 day)

---

## Issue 6.3 — Playtest script

**Red:** No human QA script for H1.

**Green:** `docs/shanghai/playtest-h1.md` with happy path + edge cases, ready for manual QA.

**File:**
- `docs/shanghai/playtest-h1.md` (new)

**Must cover:**
- Happy path both POVs
- Credit spend at cliffhanger
- Credit skip at cliffhanger
- Exercise hook success
- Exercise hook failure + retry
- Voice rule violation (simulated) → regeneration observable
- Mobile viewport rendering of webtoon panels
- Accessibility: keyboard-only traversal
- Resume from checkpoint mid-scene

**Dependencies:** H1 end-to-end functional (epics 1–4 complete)
**Estimate:** S (half day)

---

# Dev onboarding

## Environment

```bash
# you're in the worktree
cd /Users/erniesg/code/erniesg/tong-shanghai
git branch --show-current   # should show feat/shanghai-onboarding

# install
cd apps/client && npm install

# dev (port 3002 — main repo uses 3000, other worktrees may use 3001)
npx next dev -p 3002

# type check
npx tsc --noEmit

# tests (when present)
npx vitest run
```

## Picking up a card

1. Read the card's **Red / Green / Acceptance** sections
2. Check all **Dependencies** are merged to `feat/shanghai-onboarding`
3. Create a sub-branch: `git checkout -b feat/shanghai-{issue-id}-{short-desc}`
4. Implement. Each card is scoped to be completable by one dev.
5. Run `npx tsc --noEmit` and relevant tests
6. Open PR into `feat/shanghai-onboarding`
7. When `feat/shanghai-onboarding` reaches V1 acceptance, PR into `main`

## Testing quick-start

### Running the fixture in the browser (after Epic 1–3 are merged)

```
http://localhost:3002/game?phase=hangout&city=shanghai&scene=h1&mode=fixture
```

### Running dynamic mode

```
http://localhost:3002/game?phase=hangout&city=shanghai&scene=h1
```

(defaults to mode=dynamic once Epic 4 is merged)

### Voice rule unit tests

```bash
npx vitest run lib/ai/validators/voice-rules
```

---

# V1 acceptance (whole feature)

The feature is V1-shippable when:

1. `mode=fixture` runs H1 end-to-end without error, producing all beats + webtoon + credit gate
2. `mode=dynamic` runs H1 end-to-end, every npc_speak passes voice validation
3. Webtoon panels render correctly on mobile (≤375px viewport) and desktop (≥1024px)
4. Credit spend unlocks full 阿姨 line + tong explanation
5. Credit skip shows tong fallback
6. `hangoutSeat` written to game store and persists across reload
7. Playtest script (6.3) runs cleanly with zero blockers
8. Type check passes, relevant unit tests pass
9. No regressions in Seoul flow

---

# Open decisions captured during planning

Decisions approved by user (locked for V1):
- Primary locked pair for b2d/e/f = 装 pair (`装不下去`), alt = 不会/不愿意
- 方阿姨 extended reveal line drops the trailing `不一样的` (kept as plain statement)
- No folder prop in H1
- No 丁漫 phone-watch moment
- H4 skipped — transition to show venue scene instead
- Worktree port 3002
- Webtoon is a new tool (`show_webtoon`), not an extension of cinematic

Deferred decisions (not blocking V1):
- Whether to add Zod runtime validation for fixtures
- Credit-gate SSE resolution mechanism (POST continuation vs WebSocket) — decide during Issue 1.3
- Whether voice rule validator uses LLM-as-judge or string/regex only (V2 consideration)
- Whether to generate webtoon panels via API pipeline (V2) or commission statically (V1)
