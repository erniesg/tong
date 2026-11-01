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

## Owner decisions (2026-11-01, later)

- **Several romances at once.** Haeun's and Jin's routes (and any later ones) run side by side in one save, each with its own stage. Whether you can be *official* with more than one is decided later.
- **Flags are save-wide.** Any flag a scene or thread sets is readable from every other character's scenes (`WorldCtx.flags`); counters live in `WorldCtx.tally`.
- **Jin's choices are tagged by what he asks** (generosity vs directive); see *Jin route → Scoring*. (An earlier "yes and no score the same" rule was reverted.)

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
| Cozy wiring: authored scenes play in the 3D world (H0 locker, H1/H2 studio, J0 tent) | `public/cozy/js/scene-player.js`, `main.js`, generated `public/cozy/js/relationship/` | done (#394) |

### State

```
RelState { stage, axes {warmth, tension, trust}, mood {energy, valence, causes},
           memories[], flags{}, knows{}, day, bidsThisWeek{} }
```

- **Stages:** strangers → acquaintances → friends → close → romantic_tension → partners. Milestone eligibility is in `STAGE_MILESTONES` (for example, friends = warmth ≥ 30 + `first_secret`, *or* tension ≥ 40 + `outscored_her`).
- **Leak:** warmth past the stage's ceiling means the relationship leaks through. She texts first, 반말 slips, she sends a second message.
- **Mood tags:** raw / low / ok / high, derived from energy and valence.
- **Knows** uses canon fact ids, so "has the player learned she's from Jeju" is the same key everywhere.
- **Save-wide flags and tallies:** `setFlags` writes to the relationship *and* to `WorldCtx.flags`; a `flags` condition matches either, so Haeun's scenes can read `covered_for_haeun` from Manager Choi's thread. `Effects.tally` bumps a counter; `Condition.tally` bounds it (`{ jin_decided: { min: 3 } }`).
- **Cues:** a beat may carry a stage direction (`sit`, `serve`, `phone_buzz`, `stand`, `leave`) that the 3D world acts on and the lab ignores.

### How the cozy world plays scenes

`scripts/build-relationship-lab.mjs` compiles the engine and every scene into `public/cozy/js/relationship/` (generated; the content test fails if it is stale). `scene-player.js` turns beats into dialogue nodes: the engine picks each line and the visible choices, beat exercises open the shared Tong exercise (a dismissed or unavailable exercise counts as a fail, so Tong assists), and outcomes show as reaction lines. RelState per character and the save-wide flags persist in the cozy save. Warmth changes report to the shared store as affinity, keyed by beat id so replays award nothing.

| Where | When | Scene |
|---|---|---|
| Your locker (studio) | any time, once | H0 · arrival |
| Ha-eun in the studio | 9:00–19:00 after H0 | H1 · paired |
| Ha-eun in the studio | 21:00–23:30 after H1 | H2 · "다시." |
| Man in the cap at the tent | 19:00–03:00 until J0 | J0 · pojangmacha, then he walks off and the day-one card shows |
| Jin at Café Bom | 8:00–18:00 after J0 | JA1, once a day |
| Jin at the river lookout | 18:00–24:00 after J0 | JA2, once a day |
| New game | start | Tong introduces itself (same line sets as `/game`) |
| Ha-eun / your locker | after the story beats | ambient a3 (water break) / a2 (hallway), once a day |

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
| 1 Rivals | 1–3 | **H0** arrival + locker (수아 label, notebook) · **H1** "하은. 저랑 짝이래요." · **H2** "다시." · H3 sneak-out by accident · stage check (friend via warm or rival door, fallback rival H4) |
| 2 Accomplices | 4–7 | H4 "나와." · H5 tutor *or* English-lyrics role reversal · H6 almost caught (stealth minigame) · Chuseok · H7 rooftop (Sua, unread chat, close) |
| 3 What Sua couldn't say | 8–10 | H8 Jeju slips out · rare fogged window · H9 notebook · H10 Sua |
| 4 Debut | 11–12 | H11 decision (Opened / Armored / Stuck) · H12 the night before · final eval · endings |

**Sua's artifacts.** First, her chat on 안읽씹: the preview shows only "잘 지내.", and the notebook mention sits earlier in the thread. Second, the notebook behind your locker drawer, with her copy of their 인생네컷 strip inside.

**Her distance is a polite wall (owner, 2026-11-01).** Korean social rejection is rarely blunt; it's politeness used as a wall, and the player has to pick up the vibe (눈치). Early Ha-eun is impeccably polite with a perfect smile, never drops 존댓말 with you, gives short closed answers, never asks about you or uses your name, deflects (Sua is "그냥 예전에 있던 친구"), and offers empty invitations ("다음에 밥 한번 먹어요"). Her intimacy shows up as breaking politeness: the first "야, 이것도 못 해?" is her letting you in. It's the inverse of Jin.

Tong states observations, never conclusions, and later moments connect the dots:
1. **Observation** (end of H1): "She kept it all 존댓말."
2. **Contrast** (a few weeks later): you see her laughing in 반말 with another trainee. Nobody explains.
3. **Vocab hook** (middle): a trainee jokes someone has "눈치가 없어"; Tong teaches 눈치 there.
4. **Callback** (first 반말 at you, `haeun_first_banmal`): "That's the first time she's used 반말 with you."

Beginners get these neutral pointers; players clearly reading her get silence (Tong lines carry `maxLevel`).

**Thematic mechanic.** If you lean on Haeun (she tutors you, covers for you, takes the blame), her evals slip exactly like they did with Sua. The notebook then reads as a warning addressed to you.

## Jin route

Jin is the warm, easy route that turns out to be about control. The game never rewards possessiveness in the long run; it rewards noticing, and Korean is the detective tool.

**Seo-yeon (canon).** In his breakout year a fan account posted photos of Jin with Seo-yeon, an Onsae trainee he was seeing. The agencies wrote the story: he said on record she was "staff I barely know". A month later she was cut from the debut lineup and left the industry. The lesson he took: *whoever controls the story controls what happens.* Coach Park and Manager Choi remember her; trainees only know the ghost story ("a girl got cut for dating someone"), which is why Ha-eun warns you off him. It rhymes with Sua: someone vanishes from a lineup and nobody says why. You're a trainee too, so history can literally repeat.

**The leak (canon, owner 2026-11-01): Jin leaks it himself.** A photo of you two goes up on a fan account, his timing, his angle, framed sympathetically to you. He's ready the moment it breaks: statement drafted, manager on standby. He swoops in as your protector, you're shaken and he has the answers, and you end up dependent on him, publicly tied to him, and cut off ("stay away from Ha-eun so she doesn't get dragged in"). A manufactured crisis with the rescue built in. He half-believes he's saving you from becoming Seo-yeon; that's what makes him disturbing, not cartoonish.

**Clues** (each one a flag; Korean skill decides whether you catch it):
- The photo is the one from the river (`river_photo`, JA2): an angle only the two of you knew.
- It went up while he said he was on set; his story about the shoot doesn't line up with what he told you at the café.
- You overhear Manager Kang on the phone: "형이 시킨 대로 올렸어요." *(I posted it the way you told me to.)* A listening exercise; you only catch it if your listening is good enough.
- Ha-eun notices something is off first.

**The confession takes spoken Korean.** Confronting him is a tier-3 beat (`minTier: 3`, free speech) that only appears once you hold at least one clue. You have to say it yourself, naming what you know, without Tong (he made sure of that if you agreed to `tong_off_with_jin`). An LLM reads your intent and register; a recognition error is a diegetic "뭐라고?" and a retry, never a fail. Below tier 3, or without a clue, he denies it smoothly and you have to prove it another way, or never find out.

**The confrontation (Act 3 climax).** The hardest Korean test in the game, closer to Ace Attorney than a dialogue choice: he controls stories with language, so you take control back the same way.
- Several rounds at the top input tier (free speech, `minTier: 3`), unlocked by holding at least one clue.
- He deflects like a pro: charm, changing the subject, vague answers ("그냥… 일이 좀 꼬였어" *(things just got a bit tangled)*), flattery, turning it back on you.
- You press with evidence and precise phrasing. You must name the contradiction exactly (the timeline, the angle, Kang's words); vague accusations slide off him.
- Register is a band. Too aggressive and he goes cold and polished (actor mode) and you lose him; too soft and he reassures you and moves on. Clear, steady, specific Korean wins.
- Lean on Tong or switch to English and he escapes into charming English, back on his turf.
- An LLM grades each turn on three things: evidence named, register in the band, Korean only. A recognition error is "뭐라고?" and a retry, never a fail. He confesses only when you've cornered him with the right words.

**Scoring** (owner feedback, 2026-11-01): every yes/no he asks for is tagged by what's being asked (`Choice.ask`).
- *Generosity* (he pays, gives you a ride) is fine to accept and never counts against you.
- *Directives* (where you go, who you see, what you say, when you reply, switching Tong off) count in hidden `tally.jin_directives` when you go along.
- Yes is rewarding now: warmth, and useful perks (a ride home saves an in-game night, a set visit unlocks his acting coach for your pronunciation eval; perks are flags such as `jin_ride_home`).
- No costs something now (a warmth dip, a lost invite) and always builds trust, which pays off later.
- How you say no matters: a kind, clear no (J0 "날짜는 제가 정할게요", JA1 "통은 제 선생님이에요") lands better than a cold one.
- The counter stays hidden; tells show it (a second no lands differently from the first, k14; he gets more polite under pressure).
- The content lint enforces the tagging: accepted directives are counted, generosity never is, and a no to a directive always builds trust.

| Act | Months | Beats |
|---|---|---|
| 1 Easy | 1–3 | **J0** pojangmacha · **JA1** Café Bom (asks you to switch Tong off) · **JA2** the river (the photo; his real name, "almost") · 뭐해? texts |
| 2 Close | 4–7 | The drama set and his acting coach (perk) · first boundary (k12): he gets more polite · Coach Park lets slip he trained at Onsae and almost quit twice · the Seo-yeon ghost story |
| 3 The leak | 8–10 | The river photo goes up. He rescues you from a crisis he made. Clues: the angle, the timeline, Kang's call, Ha-eun. You learn who Seo-yeon was. |
| 4 Who writes the story | 11–12 | Endings below |

**Endings**
- **Kept:** you never find out, or you find out and stay, living inside the story he wrote. A loss dressed as romance.
- **Seen:** you confront him (the spoken confession) and he publicly takes responsibility at real cost to himself, the opposite of what he did to Seo-yeon. Here he tells you his real name: known, not recognised.
- **Released:** he admits it and lets you go. Friends, at a distance.
- **Leave:** you walk away on your own terms.

Which of Seen / Released he can reach after a confession depends on your boundary history (`tally.jin_directives`, `jin_boundary_*`): a Jin who has learned to hear no can change; one who never had to can only let go.

Cross-route hooks (shared flags): Ha-eun reads `met_jin` and the photo; Jin's "other people" trigger reads Ha-eun's stage.

## Content

| Content | Files | Status |
|---|---|---|
| H0 arrival, H1 pairing, H2 drills | `lib/content/routes/haeun/h0-arrival.ts`, `h1-paired.ts`, `h2-again.ts` | drafted, needs native review |
| J0 Jin at the pojangmacha | `lib/content/routes/jin/j0-pojangmacha.ts` | drafted, needs native review |
| Jin ambient: Café Bom (Tong-as-rival), the river (the photo, his real name) | `lib/content/routes/jin/ambient/` | drafted, needs native review |
| Haeun ambient bids | `lib/content/routes/haeun/bids.ts` | drafted |
| Ambient ×3, 3 variants each (ramyeon, hallway, water break) | `lib/content/routes/haeun/ambient/` | drafted |
| 15 KakaoTalk threads | `lib/content/kakao/` | drafted |
| H3–H12, endings | | todo |
| Jin noticing phase and boundary scene | | todo |
| Jeju lines | | needs a Jeju speaker |

## Open decisions

- Retire the legacy `colleagues` stage in `lib/types/relationship.ts` (the new engine has no such stage).
- Speech input (tier 3 voice): which ASR, and whether recognition is constrained to expected candidates at low levels.
- Whether you can be official with more than one person (several active routes are already allowed).

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
| #394 | Move onboarding in cozy | done on branch |
| #392 | Haeun route H3–H12, endings | H0–H2 drafted |
| #393 | Jin route | J0 drafted |
| #396 | Sua's notebook as literacy meter | todo |
| #395 | Native Korean and Jeju review | todo |

## Commands

```sh
cd apps/client
node --test lib/relationship/engine.test.ts lib/relationship/content.test.ts   # Node ≥ 22.18
node scripts/build-relationship-lab.mjs   # rebuilds the lab and public/cozy/js/relationship/
```
