---
name: hangout
description: Build, debug, or modify the hangout (VN scene) system. Use when working on NPC dialogue, scene flow, tool calls, affinity, or hangout prompts.
---

# Hangout System Architecture

## Key Files

| File | Role |
|------|------|
| `apps/client/app/api/ai/hangout/route.ts` | Streaming API route. Defines 6 tools: `npc_speak`, `tong_whisper`, `show_exercise`, `offer_choices`, `assess_result`, `end_scene` |
| `apps/client/lib/ai/prompts/hangout-orchestrator.ts` | System prompt builder. Controls language ratio, character formatting, mastery context, first-encounter calibration, exercise quality rules |
| `apps/client/app/game/page.tsx` | Tool queue processor. Dequeues tool calls sequentially. Handles blocking (npc_speak, show_exercise, offer_choices) and auto-advance (assess_result, end_scene) |
| `apps/client/components/scene/SceneView.tsx` | Master scene renderer. Layers: HUD > Background > NPC sprite > Dialogue/Exercise/Choices |
| `apps/client/components/scene/DialogueBox.tsx` | Typewriter dialogue with speaker name, color, translation row |
| `apps/client/components/scene/CharacterSprite.tsx` | NPC sprite + expression animation |
| `apps/client/components/scene/ChoiceButtons.tsx` | Dialogue choice buttons with affinity hints |
| `apps/client/components/scene/TongOverlay.tsx` | Tong teaching tips overlay |
| `apps/client/components/hud/GameHUD.tsx` | Reusable swipe-down HUD (scores + language flags) |

## Tool Call Flow

1. AI streams response with tool calls
2. `onToolCall` in useChat adds to `toolQueue`
3. useEffect processor dequeues one at a time:
   - `npc_speak` → sets `currentMessage` → **BLOCKS** until tap continue
   - `tong_whisper` → sets `tongTip` → auto-advance (blocks if next is exercise)
   - `show_exercise` → parses AI exerciseData OR generates locally → **BLOCKS** until result
   - `offer_choices` → sets `choices` → **BLOCKS** until selection
   - `assess_result` → dispatches mastery update → auto-advance
   - `end_scene` → sets `sceneSummary`, awards XP/SP → auto-advance

## Prompt Key Sections

- **Language ratio**: NPC dialogue % target language scales with playerLevel (0-7)
- **Relationship stage**: stranger → acquaintance → friend → close_friend
- **Exercise quality rules**: GOLDEN RULE (prompt must not contain answer), valid jamo distractors only
- **Dialogue rules**: `npc_speak` = DIALOGUE ONLY (no narration/actions)

## Quick Test

Navigate to `/game/hangout` or `/game?phase=hangout` to jump directly into a hangout.

## Media Generation Tools (Server)

The server (`apps/server/src/index.mjs`) exposes media tools via `/api/v1/tools/invoke`. Use these for pre-generating hangout assets or triggering async generation during gameplay.

### Backdrops (Seedream 5.0 — ByteDance)
| Tool | Use |
|------|-----|
| `volcengine.backdrop.generate` | Generate 9:16 photorealistic location backdrop from presets (pojangmacha, cafe, park, subway, etc.) with time-of-day and mood |
| `volcengine.backdrop.presets` | List available location presets, times, moods |
| `volcengine.image.generate` | Raw image gen (e.g. character+backdrop composite for video input) |

### Video (Seedance 1.5 — ByteDance)
| Tool | Use |
|------|-----|
| `volcengine.video.create` | Create async video task. Modes: text-to-video, image-to-video (first frame), first+last frame transitions, reference images (1-4), draft-to-full. Supports `returnLastFrame` for clip chaining, `draft` for cheap preview, `generateAudio` for ambient sound, `cameraFixed` for talking-head shots. Default 9:16. |
| `volcengine.video.get` | Poll task status (queued → running → succeeded/failed) |
| `volcengine.video.wait` | Block until task completes (up to 10min) |
| `volcengine.video.list` | List all tasks (auto-delete after 24h) |

### Audio (ElevenLabs)
| Tool | Use |
|------|-----|
| `elevenlabs.sfx.generate` | Ambient SFX loops per location (up to 30s, loopable). E.g. "Korean street food stall sizzling, chatter, night traffic" |
| `elevenlabs.music.generate` | BGM per mood/scene (up to 5min). Prompt or structured composition plan. `forceInstrumental` for no vocals |
| `elevenlabs.tts.speak` | Character voice lines. Multilingual (ko/ja/zh/en). Requires `voiceId` |

### Volcengine TTS (ByteDance)
| Tool | Use |
|------|-----|
| `volcengine.tts.synthesize` | Korean TTS with emotion and speed control |

### Asset Pipeline for New Hangout Locations

1. Generate backdrop: `volcengine.backdrop.generate` → save to `assets/backdrops/<city>/<location>.png`
2. Generate location ambient SFX: `elevenlabs.sfx.generate` with `loop: true`
3. Generate character intro video: `volcengine.video.create` with backdrop as first frame + motion prompt
4. Generate BGM: `elevenlabs.music.generate` per mood
5. Wire into location config in `lib/content/` with `backgroundImageUrl` pointing to the backdrop

### Config
- API keys: `.env` (`VOLCENGINE_ARK_API_KEY`, `ELEVENLABS_API_KEY`)
- Server code: `apps/server/src/volcengine.mjs` (all media functions)
- Tool registry: `apps/server/src/index.mjs` (AGENT_TOOL_DEFINITIONS + invokeAgentTool)

## Common Tasks

- **Change NPC behavior**: Edit prompt in `hangout-orchestrator.ts`
- **Add new tool**: Add zod schema in route.ts + handler in game/page.tsx tool queue processor
- **Fix exercise quality**: Update EXERCISE QUALITY RULES in prompt
- **Modify scene rendering**: Edit SceneView.tsx and child components
- **Change affinity/scoring**: Edit `end_scene` handler in game/page.tsx
- **Add new location**: Use `/location` skill, then generate assets with media tools above
- **Generate backdrop**: Call `volcengine.backdrop.generate` with location preset + time/mood
- **Generate cinematic intro**: Generate backdrop, then `volcengine.video.create` with image as first frame
