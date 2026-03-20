# API Contract v0

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
        { "objectiveId": "zh-mission-stage-texting", "legacyObjectiveId": "zh_stage_l3_002", "objectiveAliasIds": ["zh_stage_l3_002"], "reason": "Grammar + vocab gap" }
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
          "minutes": 38
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
          "minutes": 19
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

## POST `/api/v1/ingestion/run-mock`
Request:
```json
{
  "userId": "demo-user-1",
  "profile": {
    "nativeLanguage": "en",
    "targetLanguages": ["ko", "zh"],
    "proficiency": { "ko": "beginner", "ja": "none", "zh": "none" }
  }
}
```

Response:
```json
{
  "success": true,
  "generatedAtIso": "2026-02-28T12:00:00.000Z",
  "sourceCount": { "youtube": 3, "spotify": 3 },
  "topTerms": [
    {
      "lemma": "연습",
      "lang": "ko",
      "count": 3,
      "sourceCount": 2,
      "sourceBreakdown": { "youtube": 1, "spotify": 2 }
    }
  ]
}
```

## Canonical Media Events Fixture (Connector-Independent)
Used by topic modeling/frequency workstreams so they can iterate without live Spotify/YouTube sync.

Path:
`packages/contracts/fixtures/media.events.sample.json`

Shape:
```json
{
  "events": [
    {
      "eventId": "evt_001",
      "userId": "demo-user-1",
      "source": "youtube",
      "mediaId": "yt_a12",
      "title": "K-variety snack challenge",
      "lang": "ko",
      "minutes": 22,
      "consumedAtIso": "2026-02-27T04:30:00.000Z",
      "tokens": ["메뉴", "주문", "먹다", "맵다", "연습"]
    }
  ]
}
```

Related modeling fixture:
- `packages/contracts/fixtures/planner.lesson-context.sample.json` captures generated lesson/scene recommendation inputs derived from canonical media events for ingestion experiments.

## GET `/api/v1/tools`
Response:
```json
{
  "ok": true,
  "tools": [
    {
      "name": "ingestion.run_mock",
      "description": "Run mock ingestion and refresh frequency/insight/media-profile signals for a user.",
      "method": "POST",
      "path": "/api/v1/tools/invoke",
      "args": {
        "userId": "string (optional)",
        "profile": "object (optional)",
        "includeSources": ["youtube", "spotify"]
      }
    }
  ]
}
```

## POST `/api/v1/tools/invoke`
Request:
```json
{
  "tool": "vocab.insights.get",
  "args": {
    "userId": "demo-user-1",
    "lang": "ko"
  }
}
```

## GET `/api/v1/graph/dashboard`
Query:
```json
{
  "learnerId": "persona_kpop_prompting",
  "city": "seoul",
  "location": "food_street"
}
```

Response:
Path: `packages/contracts/fixtures/graph.dashboard.sample.json`

## GET `/api/v1/graph/personas`
Response:
Path: `packages/contracts/fixtures/graph.personas.sample.json`

## GET `/api/v1/graph/next-actions`
Query:
```json
{
  "learnerId": "persona_kpop_prompting",
  "limit": 4
}
```

Response:
Path: `packages/contracts/fixtures/graph.next-actions.sample.json`

## POST `/api/v1/graph/evidence`
Request:
```json
{
  "learnerId": "persona_kpop_prompting",
  "event": {
    "nodeId": "objective:ko-vocab-courtesy",
    "objectiveId": "ko-vocab-courtesy",
    "mode": "learn",
    "quality": 0.86,
    "source": "dashboard.learn"
  }
}
```

Response:
Path: `packages/contracts/fixtures/graph.evidence.record.sample.json`

Contract note:
- `recorded` is the count of accepted events in this call.
- `events[]` echoes normalized event payloads that were persisted.
- `metrics` exposes objective/evidence counters so follow-on endpoints can assert progression deltas.
- `events[].mode` is normalized to one of: `learn`, `hangout`, `mission`, `review`, `exercise`, `media`.

## Graph Tool Payloads
These are invoked through `POST /api/v1/tools/invoke`:

Public contract note:
- Use `learnerId` for graph requests and tool invocations.
- The mocked dashboard runtime also accepts `personaId` as an alias while the first milestone is fixture-driven.

- `graph.dashboard.get` -> `packages/contracts/fixtures/graph.dashboard.sample.json`
- `graph.next_actions.get` -> `packages/contracts/fixtures/graph.next-actions.sample.json`
- `graph.lesson_bundle.get` -> `packages/contracts/fixtures/graph.lesson-bundle.sample.json`
- `graph.hangout_bundle.get` -> `packages/contracts/fixtures/graph.hangout-bundle.sample.json`
- `graph.evidence.record` -> `packages/contracts/fixtures/graph.evidence.record.sample.json`
- `graph.pack.validate` -> `packages/contracts/fixtures/graph.pack.validate.sample.json`
- `graph.overlay.propose` -> `packages/contracts/fixtures/graph.overlay.propose.sample.json`

Response:
```json
{
  "ok": true,
  "tool": "vocab.insights.get",
  "result": {
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
        "lemma": "주문",
        "lang": "ko",
        "score": 0.82,
        "frequency": 26,
        "burst": 1.34,
        "clusterId": "food-ordering",
        "objectiveLinks": [
          { "objectiveId": "ko-vocab-food-items", "legacyObjectiveId": "ko_food_l2_001", "objectiveAliasIds": ["ko_food_l2_001"], "reason": "High utility in next hangout" }
        ]
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
  "location": "food_street",
  "sceneId": "intro_001",
  "mode": "hangout",
  "tongPrompt": "in-character system prompt token or id",
  "profile": {
    "nativeLanguage": "en",
    "targetLanguages": ["ko", "ja", "zh"],
    "proficiency": {
      "ko": "beginner",
      "ja": "none",
      "zh": "advanced"
    }
  },
  "progression": {
    "xp": 110,
    "sp": 45,
    "rp": 12,
    "currentMasteryLevel": 1
  },
  "actions": ["Start hangout validation", "Review personalized learn targets"],
  "resumeSource": "new_session",
  "gameSession": {
    "sessionId": "sess_123",
    "status": "active",
    "cityId": "seoul",
    "locationId": "food_street",
    "currentMode": "hangout",
    "activeSceneId": "food_street_hangout_intro",
    "activeSceneSessionId": "scene_sess_123_001",
    "activeCheckpointId": "ckpt_sess_123_intro"
  },
  "sceneSession": {
    "sceneSessionId": "scene_sess_123_001",
    "gameSessionId": "sess_123",
    "sceneId": "food_street_hangout_intro",
    "phase": "intro",
    "turn": 1,
    "checkpointable": true
  },
  "activeCheckpoint": {
    "checkpointId": "ckpt_sess_123_intro",
    "kind": "player_resume",
    "phase": "intro",
    "turn": 1,
    "route": {
      "pathname": "/game",
      "query": {
        "city": "seoul",
        "location": "food_street",
        "mode": "hangout",
        "resume": "1"
      }
    },
    "rng": {
      "seed": "sess_123_intro",
      "version": 1
    }
  },
  "availableScenarioSeeds": [
    {
      "seedId": "review_ready",
      "qaOnly": true,
      "phase": "review",
      "turn": 4
    }
  ]
}
```

Contract notes:
- The legacy top-level `sessionId`, `city`, `sceneId`, `tongPrompt`, and `actions` fields remain for compatibility with current clients.
- `gameSession` is the durable player session envelope for progression, unlocks, and the active objective.
- `sceneSession` is the currently mounted scene/runtime slice that can advance independently of broader session metadata.
- `activeCheckpoint` is the player-facing resume payload and must stay safe to restore on the real `/game` route.
- `availableScenarioSeeds` are QA/demo-only deterministic setup entries and must stay separate from player resume checkpoints.
- Dedicated samples live at:
  - `packages/contracts/fixtures/game.session.sample.json`
  - `packages/contracts/fixtures/scene.session.sample.json`
  - `packages/contracts/fixtures/checkpoint.player-resume.sample.json`
  - `packages/contracts/fixtures/scenario.seed.review-ready.sample.json`

## GET `/api/v1/objectives/next`

Canonical identity note: `objectiveId` now carries the canonical graph objective id. `legacyObjectiveId` and `objectiveAliasIds` remain additive compatibility fields during migration.

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
  "objectiveId": "ko-vocab-food-items",
  "level": 2,
  "mode": "hangout",
  "lang": "ko",
  "objectiveGraph": {
    "objectiveNodeId": "objective:ko-vocab-food-items",
    "cityId": "seoul",
    "locationId": "food_street",
    "objectiveCategory": "vocabulary",
    "targetNodeIds": ["target:메뉴", "target:주문", "target:맵다"],
    "prerequisiteObjectiveIds": ["ko-pron-food-words"],
    "source": "knowledge_graph"
  },
  "coreTargets": {
    "vocabulary": ["메뉴", "주문", "맵다"],
    "grammar": ["-고 싶어요", "-주세요"],
    "sentenceStructures": ["N + 주세요", "N이/가 + adjective"]
  },
  "personalizedTargets": [
    {
      "lemma": "무대",
      "source": "youtube",
      "linkedNodeIds": ["overlay:youtube:performance-energy", "target:무대"]
    },
    {
      "lemma": "연습",
      "source": "spotify",
      "linkedNodeIds": ["overlay:spotify:practice-studio", "target:연습"]
    }
  ],
  "completionCriteria": {
    "requiredTurns": 4,
    "requiredAccuracy": 0.75,
    "minEvidenceEvents": 3,
    "acceptedEvidenceModes": ["learn", "hangout", "mission"]
  }
}
```

Contract note:
- KG-backed objective responses require `lang`, `objectiveGraph`, and per-item `linkedNodeIds` in `personalizedTargets`.

## POST `/api/v1/scenes/hangout/start`
Request:
```json
{
  "userId": "demo-user-1",
  "city": "seoul",
  "location": "food_street",
  "lang": "ko",
  "objectiveId": "ko-vocab-food-items"
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
      "objectiveId": "ko-vocab-food-items",
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
  "objectiveId": "ko-vocab-food-items"
}
```

Response:
```json
{
  "learnSessionId": "learn_202",
  "mode": "learn",
  "uiTheme": "kakao_like",
  "objectiveId": "ko-vocab-food-items",
  "firstMessage": {
    "speaker": "tong",
    "text": "New session started. We'll train 주문 phrases for your next hangout."
  }
}
```

## Volcengine / ByteDance Tools

All Volcengine tools are invoked via `POST /api/v1/tools/invoke`.

### `volcengine.status` – Check API config
```json
{ "tool": "volcengine.status", "args": {} }
```
Response:
```json
{
  "ok": true,
  "tool": "volcengine.status",
  "result": {
    "arkApiKeyConfigured": true,
    "ttsAppIdConfigured": true,
    "ttsAccessTokenConfigured": true,
    "defaultImageModel": "doubao-seedream-4-5-251128",
    "defaultVideoModel": "doubao-seedance-1-5-pro-251215",
    "defaultTtsVoice": "BV700_V2_streaming"
  }
}
```

### `volcengine.image.generate` – Image generation (Seedream)
Synchronous. Returns image URLs directly.
```json
{
  "tool": "volcengine.image.generate",
  "args": {
    "prompt": "A Korean street food stall at night, warm lighting, realistic",
    "size": "2K",
    "n": 1,
    "seed": 42
  }
}
```
Response:
```json
{
  "ok": true,
  "tool": "volcengine.image.generate",
  "result": {
    "images": [{ "url": "https://..." }],
    "model": "doubao-seedream-4-5-251128",
    "seed": 42
  }
}
```

### `volcengine.video.create` – Video generation (Seedance)
Async task-based. Returns task ID for polling.
```json
{
  "tool": "volcengine.video.create",
  "args": {
    "content": [
      { "type": "image_url", "imageUrl": "https://example.com/frame.jpg" },
      { "type": "text", "text": "The character turns and smiles at the camera" }
    ],
    "resolution": "1080p",
    "ratio": "16:9",
    "duration": 5,
    "generateAudio": true
  }
}
```
Response:
```json
{
  "ok": true,
  "tool": "volcengine.video.create",
  "result": {
    "id": "cgt-2026xxxx",
    "model": "doubao-seedance-1-5-pro-251215",
    "status": "queued",
    "resolution": "1080p",
    "ratio": "16:9",
    "duration": 5,
    "createdAt": 1709366400,
    "updatedAt": 1709366400
  }
}
```

### `volcengine.video.get` – Poll video task status
```json
{
  "tool": "volcengine.video.get",
  "args": { "taskId": "cgt-2026xxxx" }
}
```
Response (when completed):
```json
{
  "ok": true,
  "tool": "volcengine.video.get",
  "result": {
    "id": "cgt-2026xxxx",
    "model": "doubao-seedance-1-5-pro-251215",
    "status": "succeeded",
    "videoUrl": "https://...",
    "seed": 42,
    "resolution": "1080p",
    "ratio": "16:9",
    "duration": 5,
    "createdAt": 1709366400,
    "updatedAt": 1709366500
  }
}
```

### `volcengine.video.list` – List video tasks
```json
{
  "tool": "volcengine.video.list",
  "args": { "limit": 10 }
}
```
Response:
```json
{
  "ok": true,
  "tool": "volcengine.video.list",
  "result": {
    "tasks": [{ "id": "cgt-...", "status": "succeeded", "videoUrl": "..." }],
    "hasMore": false
  }
}
```

### `volcengine.tts.synthesize` – Text-to-speech
Synchronous. Returns base64-encoded audio.
```json
{
  "tool": "volcengine.tts.synthesize",
  "args": {
    "text": "안녕하세요! 오늘 뭐 먹고 싶어요?",
    "voiceType": "BV700_V2_streaming",
    "encoding": "mp3",
    "language": "ko",
    "speedRatio": 0.9
  }
}
```
Response:
```json
{
  "ok": true,
  "tool": "volcengine.tts.synthesize",
  "result": {
    "audioBase64": "SUQzBAAAAAAAI1RTU0UAAAAP...",
    "encoding": "mp3"
  }
}
```

## GET `/api/v1/demo/secret-status`
Notes:
- Protected when `TONG_DEMO_PASSWORD` is configured.
- Returns only configured/missing booleans, never raw secret values.

Response:
```json
{
  "demoPasswordEnabled": true,
  "youtubeApiKeyConfigured": true,
  "spotifyClientIdConfigured": true,
  "spotifyClientSecretConfigured": true,
  "openAiApiKeyConfigured": false
}
```
