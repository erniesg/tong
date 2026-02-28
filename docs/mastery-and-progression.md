# Mastery And Progression Contract

## Mastery levels
Use these exact tiers:

0. SCRIPT: Can I read the symbols?
1. PRONUNCIATION: Can I say what I read?
2. VOCABULARY: Do I know what words mean?
3. GRAMMAR: Can I structure sentences?
4. SENTENCES: Can I construct and understand full sentences?
5. CONVERSATION: Can I interact fluidly?
6. MASTERY: Honorifics, domain nuance, humor.

## Objective model per level
Every level must define:
1. Target vocabulary set.
2. Target grammar patterns.
3. Target sentence structures.
4. Completion criteria for Hangout and Learn modes.
5. Personalization overlays from user-specific media consumption (YouTube/Spotify).

Objective payload shape:
```json
{
  "objectiveId": "ko_food_l2_001",
  "level": 2,
  "location": "food_street",
  "mode": "hangout",
  "coreTargets": {
    "vocabulary": ["메뉴", "주문", "맵다"],
    "grammar": ["-고 싶어요", "-주세요"],
    "sentenceStructures": ["N + 주세요", "N이/가 + adjective"]
  },
  "personalizedTargets": [
    { "source": "youtube", "lemma": "무대" },
    { "source": "spotify", "lemma": "연습" }
  ],
  "completionCriteria": {
    "requiredTurns": 4,
    "requiredAccuracy": 0.75
  }
}
```

## Shared locations in every city
Every city reuses the same 5 locations:
1. Food Street
2. Cafe
3. Convenience Store
4. Subway Hub
5. Practice Studio

## Modes in every location
1. `hangout`: contextual validation and relationship progression.
2. `learn`: structured teaching and targeted drills.

## Mode UX constraints
1. Hangout UI:
- First-person immersive scene.
- Only character dialogue + Tong hints/tips on active screen.
2. Learn UI:
- Country-themed chat UX (e.g., Kakao/LINE/WeChat-inspired styling).
- Must provide session history view.
- Must support starting a new objective-specific session at any time.

## Progression currencies
1. XP: language mastery progression.
2. SP: unlock currency for locations/missions.
3. RP: relationship progression with characters.

## Unlock loop
1. Learn sessions build readiness score.
2. Hangouts validate readiness in contextual interactions.
3. Validated hangouts raise location mastery confidence.
4. When confidence threshold is met, mission opens.
5. Mission pass grants tier unlock and SP rewards.

## Advanced reward loop
1. High-tier Shanghai route unlocks texting mission (WeChat-style).
2. Mission completion unlocks video call event.
3. Event grants collectible polaroid card and content unlock flags.
