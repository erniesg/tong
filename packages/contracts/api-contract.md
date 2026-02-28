# API Contract v0 (Hackathon)

## GET `/api/v1/captions/enriched`
Query:
```json
{ "videoId": "string", "lang": "ko|ja|zh" }
```

Response:
```json
{
  "videoId": "abc123",
  "segments": [
    {
      "startMs": 1230,
      "endMs": 3880,
      "surface": "안녕하세요",
      "romanized": "annyeonghaseyo",
      "english": "hello",
      "tokens": [
        {
          "text": "안녕",
          "lemma": "안녕",
          "pos": "interjection",
          "dictionaryId": "ko-123"
        }
      ]
    }
  ]
}
```

## GET `/api/v1/dictionary/entry`
Query:
```json
{ "term": "안녕", "lang": "ko" }
```

Response:
```json
{
  "term": "안녕",
  "lang": "ko",
  "meaning": "peace; hello",
  "examples": ["안녕, 잘 지냈어?"],
  "crossCjk": {
    "zhHans": "安宁",
    "ja": "安寧"
  },
  "readings": {
    "ko": "annyeong",
    "zhPinyin": "an ning",
    "jaRomaji": "annei"
  }
}
```

## GET `/api/v1/vocab/frequency`
Query:
```json
{ "windowDays": 3, "limit": 100 }
```

Response:
```json
{
  "windowStartIso": "2026-02-25T00:00:00.000Z",
  "windowEndIso": "2026-02-28T00:00:00.000Z",
  "items": [
    { "lemma": "연습", "lang": "ko", "count": 27, "sourceCount": 9 }
  ]
}
```

## GET `/api/v1/vocab/insights`
Query:
```json
{
  "userId": "demo-user-1",
  "windowDays": 3,
  "lang": "ko|ja|zh",
  "limit": 50
}
```

Response:
```json
{
  "windowStartIso": "2026-02-25T00:00:00.000Z",
  "windowEndIso": "2026-02-28T00:00:00.000Z",
  "clusters": [
    {
      "clusterId": "food-ordering",
      "label": "Food Ordering",
      "keywords": ["주문", "메뉴", "맵다"],
      "topTerms": ["주문", "메뉴"]
    }
  ],
  "items": [
    {
      "lemma": "火",
      "lang": "zh",
      "score": 0.91,
      "frequency": 42,
      "burst": 1.55,
      "clusterId": "performance-energy",
      "orthographyFeatures": {
        "scriptType": "han",
        "radical": "火",
        "relatedForms": ["炎", "灯", "烧"]
      },
      "objectiveLinks": [
        { "objectiveId": "zh_stage_l3_002", "reason": "Grammar + vocab gap" }
      ]
    }
  ]
}
```

## GET `/api/v1/player/media-profile`
Query:
```json
{
  "userId": "demo-user-1",
  "windowDays": 3
}
```

Response:
```json
{
  "userId": "demo-user-1",
  "windowDays": 3,
  "generatedAtIso": "2026-02-28T12:00:00.000Z",
  "sourceBreakdown": {
    "youtube": {
      "itemsConsumed": 8,
      "minutes": 143,
      "topMedia": [
        {
          "mediaId": "yt_a12",
          "title": "K-variety snack challenge",
          "lang": "ko",
          "minutes": 38,
          "embedUrl": "https://www.youtube.com/embed/aqz-KE-bpKQ"
        }
      ]
    },
    "spotify": {
      "itemsConsumed": 37,
      "minutes": 121,
      "topMedia": [
        {
          "mediaId": "sp_track_001",
          "title": "밤 산책",
          "lang": "ko",
          "minutes": 19,
          "embedUrl": "https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC?utm_source=generator"
        }
      ]
    }
  },
  "learningSignals": {
    "topTerms": [
      {
        "lemma": "연습",
        "lang": "ko",
        "weightedScore": 0.82,
        "dominantSource": "spotify"
      }
    ],
    "clusterAffinities": [
      {
        "clusterId": "food-ordering",
        "label": "Food Ordering",
        "score": 0.69
      }
    ]
  }
}
```

## POST `/api/v1/game/start-or-resume`
Request:
```json
{
  "userId": "demo-user-1",
  "profile": {
    "nativeLanguage": "en",
    "targetLanguages": ["ko", "ja", "zh"],
    "proficiency": {
      "ko": "beginner",
      "ja": "none",
      "zh": "none"
    }
  }
}
```

Response:
```json
{
  "sessionId": "sess_123",
  "city": "seoul",
  "sceneId": "intro_001",
  "tongPrompt": "in-character system prompt token or id",
  "actions": ["Train vocals", "Attend language class", "Meet cast member"]
}
```

## GET `/api/v1/objectives/next`
Query:
```json
{
  "userId": "demo-user-1",
  "city": "seoul",
  "location": "food_street",
  "mode": "hangout",
  "lang": "ko"
}
```

Response:
```json
{
  "objectiveId": "ko_food_l2_001",
  "level": 2,
  "mode": "hangout",
  "coreTargets": {
    "vocabulary": ["메뉴", "주문", "맵다"],
    "grammar": ["-고 싶어요", "-주세요"],
    "sentenceStructures": ["N + 주세요", "N이/가 + adjective"]
  },
  "personalizedTargets": [
    { "lemma": "무대", "source": "youtube" },
    { "lemma": "연습", "source": "spotify" }
  ],
  "completionCriteria": {
    "requiredTurns": 4,
    "requiredAccuracy": 0.75
  }
}
```

## POST `/api/v1/scenes/hangout/start`
Request:
```json
{
  "userId": "demo-user-1",
  "city": "seoul",
  "location": "food_street",
  "lang": "ko",
  "objectiveId": "ko_food_l2_001"
}
```

Response:
```json
{
  "sceneSessionId": "hang_001",
  "mode": "hangout",
  "uiPolicy": {
    "immersiveFirstPerson": true,
    "allowOnlyDialogueAndHints": true
  },
  "state": {
    "turn": 1,
    "score": { "xp": 0, "sp": 0, "rp": 0 }
  },
  "initialLine": {
    "speaker": "character",
    "text": "오늘 뭐 먹고 싶어요?"
  }
}
```

## POST `/api/v1/scenes/hangout/respond`
Request:
```json
{
  "sceneSessionId": "hang_001",
  "userUtterance": "떡볶이 주세요",
  "toolContext": {
    "dictionaryEnabled": true,
    "objectiveTrackingEnabled": true
  }
}
```

Response:
```json
{
  "accepted": true,
  "feedback": {
    "tongHint": "Great use of 주세요 for polite ordering.",
    "objectiveProgressDelta": 0.25
  },
  "nextLine": {
    "speaker": "character",
    "text": "좋아요, 맵기는 어느 정도로 할까요?"
  },
  "state": {
    "turn": 2,
    "score": { "xp": 8, "sp": 2, "rp": 1 }
  }
}
```

## GET `/api/v1/learn/sessions`
Query:
```json
{
  "userId": "demo-user-1",
  "city": "seoul",
  "lang": "ko",
  "limit": 20
}
```

Response:
```json
{
  "items": [
    {
      "learnSessionId": "learn_101",
      "title": "Food Street L2 Drill",
      "objectiveId": "ko_food_l2_001",
      "lastMessageAt": "2026-02-28T11:20:00.000Z"
    }
  ]
}
```

## POST `/api/v1/learn/sessions`
Request:
```json
{
  "userId": "demo-user-1",
  "city": "seoul",
  "lang": "ko",
  "objectiveId": "ko_food_l2_001"
}
```

Response:
```json
{
  "learnSessionId": "learn_202",
  "mode": "learn",
  "uiTheme": "kakao_like",
  "objectiveId": "ko_food_l2_001",
  "firstMessage": {
    "speaker": "tong",
    "text": "New session started. We'll train 주문 phrases for your next hangout."
  }
}
```
