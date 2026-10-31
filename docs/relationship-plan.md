# Relationship engine and Haeun route

Living plan for how relationships, dating and language mastery work together in cozy Seoul. Progress is tracked in the epic (see **Issues**); tick boxes here when a child issue closes.

Branch: `feat/relationship-engine` (worktree `~/code/erniesg/tong-relationship`, based on `feat/cozy-pojangmacha-3d`).

## Principles

1. **Korean is the relationship's UI.** Hidden state shows through her language: register (해요체 → slipping 반말 → your name), reply length, ㅋ count, what she tells you unprompted. Tong reads the tells for you at first and goes quiet as you improve, so learning Korean becomes learning to read her.
2. **Stage is a label; the axes are the feeling.** `warmth`, `tension` and `trust` move with every choice. `stage` changes only at a milestone beat, when the axes make it eligible *and* a scene makes it happen ("말 놓을까?", the rooftop, 고백).
3. **Deterministic, seeded variance.** Mood comes from her schedule, the last hangout and seeded hidden causes (no sleep, a call from home). Same save seed and choices replay the same night, so the harness can reproduce anything. Variance has to be readable in hindsight.
4. **Mistakes are content.** Choices write a reaction now and sometimes a memory that a later scene re-reads. A rupture that gets repaired builds more trust than never fighting.
5. **Language as expressive power, not only a gate.** The input ladder (below) lets the same intent be said with more nuance as you improve. Mastery also unlocks lines nobody else can say, and lets you read what was already there: the notebook, old chats.
6. **Canon first.** Every scene, generator and agent reads `lib/content/canon/*`. Scenes may not contradict it.

## Canon decisions (owner, 2026-11-01)

- Haeun and Sua are from **Jeju** (Haeun: Seogwipo, raised by her 해녀 grandmother). The Busan satoori is retired.
- Jin is an **actor** and former Onsae trainee, not a debuting senior trainee.
- The player can be either gender, so nothing depends on sharing a dorm room. You inherit Sua's **lineup spot and agency locker**.
- Haeun's first meeting moves from the pojangmacha to the **agency (H0 lockers, H1 studio)**. The pojangmacha becomes **Jin's onboarding (J0)**.
- Refusing Jin never lowers the numbers; deferring to him is what gets logged.

## Systems

| System | Where | Status |
|---|---|---|
| Canon store (Haeun, Sua, Jin, world calendar) | `apps/client/lib/content/canon/` | drafted |
| Engine: axes, milestone stages, leak, seeded mood, memories, resolver, ambient bids | `apps/client/lib/relationship/engine.ts`, `types.ts` | drafted, 7 tests |
| Scene format (beats, variants, choices by intent, outcomes by condition, exercise hooks, presets) | `apps/client/lib/relationship/types.ts` | drafted |
| Content lint (links, gates, presets reach an end, every line has `en`) | `apps/client/lib/relationship/content.test.ts` | drafted |
| State harness (sliders + preset replay) | `apps/client/public/studio/relationship/index.html` | drafted |
| Store migration (`Relationship` → `RelState`, legacy affinity derived) | `lib/store/game-store.ts`, cozy bridge | todo |
| Input ladder UI in cozy dialogue | `public/cozy/js/dialogue.js` | todo |
| Interactive KakaoTalk (choices, read "1", deleted messages) | #369 | todo |
| Exercise trigger map (month → targets → slots → exercises → notebook pages) | this doc + `lib/content/routes/` | todo |
| Cozy wiring (onboarding move, schedules → mood, bridge events) | `public/cozy/js/{story,main}.js`, `lib/cozy/bridge.ts` | todo |

### State

```
RelState { stage, axes {warmth, tension, trust}, mood {energy, valence, causes},
           memories[], flags{}, knows{}, day, bidsThisWeek{} }
```

- **Stages:** strangers → acquaintances → friends → close → romantic_tension → partners. Milestone eligibility is in `STAGE_MILESTONES` (for example, friends = warmth ≥ 30 + `first_secret`, *or* tension ≥ 40 + `outscored_her`).
- **Leak:** warmth past the stage's ceiling means the relationship leaks through. She texts first, 반말 slips, she sends a second message.
- **Mood tags:** raw / low / ok / high, derived from energy and valence.
- **Knows** uses canon fact ids, so "has the player learned she's from Jeju" is the same key everywhere.

### Between hangouts (love language)

Ambient **bids** are a lookup, not improvisation:

`effect = need match × mood (bad days count 1.5×) × specific (2× if it references a memory) × diminishing [1, ½, ¼, 0] per week`

On the third repeat she says "또?". Bids can backfire: an expensive gift makes her feel indebted, and letting her win insults her. Time and months gate *when* big things happen. Bids shape *what state* the relationship is in when they do.

### Input ladder

| Tier | Input | Exercise types used |
|---|---|---|
| 0 | Pick an English intent; Tong says it. She notices ("또 그거 써?"). | none |
| 1 | Pick a Korean line. Register traps are social, not marked wrong. | `multiple_choice`, `fill_blank`, `pronunciation_select` |
| 2 | Build the line from chunks for nuance. | `sentence_builder`, `block_crush`, `error_correction` |
| 3 | Say or type it freely; an LLM reads intent and register. | `free_input` (speech later) |

Speech-recognition errors are never punished: a low-confidence read becomes a diegetic "뭐라고?" and a retry. Speaking earns specificity (richer reactions, quote callbacks), not stat points. Climaxes (stealth excuse, notebook, confession) need tier 2+.

### Exercises: when they fire

Each beat can carry an `exercise` hook (type, objective, targets, framing, `onFail`). Failing defaults to `assist`: Tong or a character helps and the scene continues. Struggling learners get drama, not a wall.

| Month | Curriculum targets | Story beats that test them |
|---|---|---|
| 1 | Hangul blocks, names, greetings, native numbers | H0 locker label (수아), H1 water-bottle tags (하은), H2 counts (하나 둘 셋 넷); J0 ordering (주세요) |
| 2–3 | Food, ordering, prices, time | H3 convenience store, ramyeon ritual |
| 4–6 | Past tense, plans, invitations, reasons | H4 "나와.", H5 tutor/role reversal, H6 stealth excuse |
| 7–8 | Feelings, opinions, register shifts | H7 rooftop, 말 놓을까, H8 Jeju slip |
| 9–10 | Natural speech, indirect meaning | H9 notebook last page, H10 Sua |
| 11–12 | Unscaffolded emotional talk | H11 decision, H12 confession |

The notebook is the visible literacy meter: pages decode as targets reach `familiar`.

## Haeun route (12 months)

| Act | Months | Beats |
|---|---|---|
| 1 Rivals | 1–3 | **H0** arrival + locker (수아 label, notebook) · **H1** "하은. 너랑 짝이래." · **H2** "다시." · H3 sneak-out by accident · stage check (friend via warm or rival door, fallback rival H4) |
| 2 Accomplices | 4–7 | H4 "나와." · H5 tutor *or* English-lyrics role reversal · H6 almost caught (stealth minigame) · Chuseok · H7 rooftop (Sua, unread chat, close) |
| 3 What Sua couldn't say | 8–10 | H8 Jeju slips out · rare fogged window · H9 notebook · H10 Sua |
| 4 Debut | 11–12 | H11 decision (Opened / Armored / Stuck) · H12 the night before · final eval · endings |

**Sua's artifacts.** First, her chat on 안읽씹: the preview shows only "잘 지내.", and the notebook mention sits earlier in the thread. Second, the notebook behind your locker drawer, with her copy of their 인생네컷 strip inside.

**Thematic mechanic.** If you lean on Haeun (she tutors you, covers for you, takes the blame), her evals slip exactly like they did with Sua. The notebook then reads as a warning addressed to you.

## Content

| Content | Files | Status |
|---|---|---|
| H0 arrival, H1 pairing, H2 drills | `lib/content/routes/haeun/h0-arrival.ts`, `h1-paired.ts`, `h2-again.ts` | drafted, needs native review |
| J0 Jin at the pojangmacha | `lib/content/routes/jin/j0-pojangmacha.ts` | drafted, needs native review |
| Haeun ambient bids | `lib/content/routes/haeun/bids.ts` | drafted |
| Ambient ×3, 3 variants each (ramyeon, hallway, water break) | `lib/content/routes/haeun/ambient/` | drafted |
| 15 KakaoTalk threads | `lib/content/kakao/` | drafted |
| H3–H12, endings | | todo |
| Jin noticing phase and boundary scene | | todo |
| Jeju lines | | needs a Jeju speaker |

## Open decisions

- Jin's "the leak" secret: what was it?
- Retire the legacy `colleagues` stage in `lib/types/relationship.ts` (the new engine has no such stage).
- Speech input (tier 3 voice): which ASR, and whether recognition is constrained to expected candidates at low levels.
- Whether Haeun's romance route and Jin's can both be active in one save (cross-route jealousy).

## Issues

Epic: #397 (child of #364). The live checklist is on the epic.

| Issue | Scope | State |
|---|---|---|
| #387 | Canon store | drafted, needs owner review |
| #388 | Engine v2 in the game store | engine drafted; store migration todo |
| #389 | Lab harness and content lint in CI | drafted; CI todo |
| #390 | Input ladder in cozy dialogue | todo |
| #391 | 12-month calendar, evals, exercise trigger map | todo |
| #369 | Interactive KakaoTalk (spec in comment) | content drafted; UI todo |
| #394 | Move onboarding in cozy | todo |
| #392 | Haeun route H3–H12, endings | H0–H2 drafted |
| #393 | Jin route | J0 drafted |
| #396 | Sua's notebook as literacy meter | todo |
| #395 | Native Korean and Jeju review | todo |

## Commands

```sh
cd apps/client
node --test lib/relationship/engine.test.ts lib/relationship/content.test.ts   # Node ≥ 22.18
node scripts/build-relationship-lab.mjs   # rebuilds public/studio/relationship/index.html
```
