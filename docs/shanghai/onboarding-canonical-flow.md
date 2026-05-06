# Shanghai Onboarding Hangout — Canonical H1 Flow

## Product Intent

Shanghai H1 is the first Mandarin onboarding hangout. It is not a city-map explainer, not a business lesson, and not a generic vocabulary tutorial. The route drops the player into a lived-in 小笼包 shop; the scene teaches them to read the room before direct character hangouts begin.

The first aha moment is: "I understood the social pressure in a scene before I could understand every Chinese sentence."

The player is an observer in H1. They do not meet 丁漫 or 瞿守成 yet. Later Shanghai hangouts at the same location should seed them one at a time, either randomly from an eligible pool or by a scheduled progression rule. H1 only creates curiosity, world texture, and the first Mandarin anchors.

## Non-Negotiable Rules

- English explanation UI calls the guide `Tong`. Do not localize Tong to `小通` just because the target language is Chinese.
- Target-language words stay in native script: `方案`, `看过了`, `想法`, `小笼包`, `不一样`.
- On-screen English should say `plan` for `方案` in H1. `Proposal` can exist in dictionary detail, not as Tong's first framing.
- Tong teaches and interprets. Characters never teach the player.
- 丁漫 and 瞿守成 speak to each other, not the player.
- H1 starts with world and mood, then one anchor exercise, then eavesdrop. Do not open with "This is not the city map."
- H1 has no "facing Dingman" or "facing Shoucheng" branch, no `hangoutSeat`, and no character tap target.
- H1 unlocks a future Shanghai hangout pool; it does not decide which lead the player meets next.
- Do not display admin/debug/meta panels in the active scene.
- Do not make Tong narrate UI mechanics as prose. Use visible interaction cues for pan/scroll/click actions in QA proof.
- Hover/tap language tooltips are disabled inside Tong onboarding narration unless the user is explicitly interacting with a vocabulary token surface.

## Canonical Player State

- Entry trigger: player prioritized Mandarin / Chinese during profile setup.
- Route: `/onboarding/shanghai?entry=chinese-priority&reset=1`
- Initial visual: right edge of `shanghai-onboarding.mp4`; warm fluorescent shop, rain/glass, steam, table noise.
- Scene state starts at `pre_anchor`.
- Completion flags:
  - `shanghai_h1_overheard=true`
  - `shanghai_h1_anchor_fangan=true`
  - `shanghai_h1_webtoon_complete=true`
  - `shanghai_next_hangout_pool_unlocked=true`
- Explicitly not written: `hangoutSeat`.
- Relationship changes: no direct RP for 丁漫 or 瞿守成 in H1. Optional `fangayi +1` only if the implementation includes her closing acknowledgement.
- Learning rewards: XP for anchor comprehension. SP unlock remains separate from H1 unless a later credit gate is implemented.

## Complete Flow

### Beat 1 — Arrival: The Shop Before The Lesson

Visual: panorama video loops in the phone frame. The camera is held on the right edge, away from the far table. No character sprites, no webtoon panels yet.

Tong lines:

1. `Shanghai starts quietly. Steam on glass, low voices, rain at the window.`
2. `Two people at the far table. One is eating. One is not.`
3. `That is enough to know where to look.`

Implementation rule: these are Tong whispers in the standard overlay. The speaker name is `Tong` for English UI.

### Beat 2 — First Anchor: 方案

Tong lines:

1. `Before you listen, take one word with you: 方案. A plan.`
2. `You do not need every sentence yet. Watch what happens when 方案 lands.`

Exercise 1:

```json
{
  "type": "multiple_choice",
  "id": "shanghai-h1-anchor-fangan",
  "objectiveId": "zh-vocab-shanghai-negotiation",
  "difficulty": 1,
  "prompt": "In this scene, 方案 is closest to...",
  "options": [
    { "id": "plan", "text": "The plan on the table" },
    { "id": "food", "text": "The soup dumplings on the table" },
    { "id": "phone", "text": "The phone call outside the scene" }
  ],
  "correctOptionId": "plan",
  "explanation": "方案 is the plan being discussed. The food is how 丁漫 avoids answering."
}
```

Correct response from Tong:

`Good. Now you have one handle before the conversation starts.`

Wrong response from Tong:

`Close, but not yet. 小笼包 is what you can see. 方案 is what the room is avoiding.`

### Beat 3 — Pan Unlock: Eavesdrop With Intent

Tong lines:

1. `Listen for how short the lines are. This is not a lesson. It is pressure.`
2. `Slide left slowly. Do not interrupt. Just overhear it.`

UI action:

- Show `Drag left to listen in.`
- Add a visible drag highlight in QA proof.
- Panning left moves from right-edge ambience to the far-table view.
- When the pan crosses the threshold, transition to the H1 webtoon strip.

### Beat 4 — Webtoon Part 1: Pressure Lands

Panel line:

`瞿守成: 方案你看过了。`

English subtitle:

`You looked over the plan.`

Tong interpretation:

`看过了 means she has already looked it over. He is skipping small talk.`

Exercise 2:

```json
{
  "type": "multiple_choice",
  "id": "shanghai-h1-kanguole",
  "objectiveId": "zh-vocab-shanghai-negotiation",
  "difficulty": 1,
  "prompt": "When 守成 says 看过了, what is he pressing?",
  "options": [
    { "id": "seen", "text": "She has already seen the plan" },
    { "id": "order", "text": "She should order more food" },
    { "id": "call", "text": "She missed a call" }
  ],
  "correctOptionId": "seen",
  "explanation": "看过了 means the looking is already complete. He moves straight to her response."
}
```

### Beat 5 — Webtoon Part 2: Minimal Replies

Panel lines:

1. `丁漫: 看了。`
2. `瞿守成: 想法？`

Tong interpretation:

`想法 means thoughts or opinion. One word, no cushion.`

Exercise 3:

```json
{
  "type": "multiple_choice",
  "id": "shanghai-h1-xiangfa",
  "objectiveId": "zh-vocab-shanghai-negotiation",
  "difficulty": 1,
  "prompt": "想法？ feels like...",
  "options": [
    { "id": "opinion", "text": "A direct request for her opinion" },
    { "id": "greeting", "text": "A casual greeting" },
    { "id": "order", "text": "A food order" }
  ],
  "correctOptionId": "opinion",
  "explanation": "想法 is the opinion he wants from her. The question is short because he is pressing."
}
```

### Beat 6 — Webtoon Part 3: Food As Deflection

Panel line:

`丁漫: 小笼包不错。`

English subtitle:

`The xiaolongbao is good.`

Tong interpretation:

`She answers with food. That is not random. It is a dodge.`

Exercise 4:

```json
{
  "type": "multiple_choice",
  "id": "shanghai-h1-food-dodge",
  "objectiveId": "zh-vocab-shanghai-food-deflection",
  "difficulty": 1,
  "prompt": "Why does 丁漫 say 小笼包不错?",
  "options": [
    { "id": "dodge", "text": "To avoid answering directly" },
    { "id": "lesson", "text": "To teach a food word" },
    { "id": "topic", "text": "Because the plan is about dumplings" }
  ],
  "correctOptionId": "dodge",
  "explanation": "The food line protects her from accepting his frame."
}
```

### Beat 7 — Webtoon Part 4: The Pitch And The Retort

Panel lines:

1. `瞿守成: 这个节目跟其他的不一样。`
2. `丁漫: 每个节目都说自己不一样。`

Tong interpretation:

`节目 is the show. 不一样 means different. He pitches; she has heard this pitch before.`

Exercise 5:

```json
{
  "type": "multiple_choice",
  "id": "shanghai-h1-buyiyang",
  "objectiveId": "zh-vocab-shanghai-negotiation",
  "difficulty": 1,
  "prompt": "不一样 means...",
  "options": [
    { "id": "different", "text": "different" },
    { "id": "delicious", "text": "delicious" },
    { "id": "already-read", "text": "already read" }
  ],
  "correctOptionId": "different",
  "explanation": "不一样 is the claim that this show is different. 丁漫 undercuts it immediately."
}
```

### Beat 8 — Exit: Curiosity, Not Closure

Tong lines:

1. `Good read. 方案 was the plan on the table. Food was the dodge.`
2. `Shanghai will bring them back one at a time.`

End scene:

```json
{
  "summary": "You entered a Shanghai 小笼包 shop, learned to track 方案, 看过了, 想法, 小笼包不错, and 不一样, then overheard the first pressure beat between 守成 and 丁漫.",
  "xpEarned": 70,
  "affinityChanges": [],
  "calibratedLevel": 0
}
```

## QA Acceptance

- The first visible Tong speaker label is `Tong` in English UI.
- The first Tong line is not a negation about the city map.
- No visible line says `First anchor:` or frames H1 as a business proposal explainer.
- The 方案 exercise appears before webtoon takeover.
- QA video visibly shows click/drag/scroll actions with highlights.
- Webtoon proof scrolls through the panel sequence instead of jumping to a static end state.
- Mobile text never clips outside the phone frame or Tong overlay.
- Tooltips do not randomly snap open inside Tong narration.
- Completion returns to a stable Shanghai post-onboarding state.
