---
name: director
description: AI Director for generating game content - locations, characters, curriculum, backdrops. Use when adding new content to cities, expanding stub locations, or creating entirely new locations.
---

# AI Director Skill

Generate game content through the backstage pipeline. This skill helps create new locations, characters, curriculum, and backdrops for the Tong language learning game.

## Architecture

The director system consists of:

- **Backstage UI**: `/backstage` page for visual content authoring
- **Director API**: `/api/ai/director/route.ts` - streaming AI that generates proposals
- **Director Store**: `lib/store/director-store.ts` - pipeline state management
- **Director Prompt**: `lib/ai/prompts/director.ts` - system prompt builder
- **Director Types**: `lib/types/director.ts` - type definitions
- **Server Publish**: `POST /api/v1/director/publish` - saves approved content as JSON
- **Server Content**: `GET /api/v1/director/content` - serves published content

## Pipeline Stages

1. **Concept**: Location theme, domain, ambient description, cultural/narrative hooks
2. **Characters**: NPC profiles with personality, speech style, backstory
3. **Curriculum**: Vocabulary targets, grammar patterns, learning objectives, levels
4. **Backdrops**: Image generation prompts for Volcengine Seedream
5. **Published**: Content saved to server, available for players

## Key Files

- `apps/client/app/backstage/page.tsx` - Backstage UI
- `apps/client/app/api/ai/director/route.ts` - Director API route
- `apps/client/lib/store/director-store.ts` - Pipeline state
- `apps/client/lib/ai/prompts/director.ts` - System prompt
- `apps/client/lib/types/director.ts` - Types
- `apps/server/src/index.mjs` - Server publish/content endpoints

## Content Format

Published content is stored as JSON in `apps/server/data/content/`:

```json
{
  "pipelineId": "seoul:cafe",
  "concept": { "id": "cafe", "name": { "en": "Cafe", "ko": "카페" }, ... },
  "characters": [{ "id": "barista", ... }],
  "curriculum": { "levels": [...], "vocabularyTargets": [...], "grammarTargets": [...] },
  "backdrop": { "prompt": "...", "timeOfDay": "afternoon", "mood": "warm" },
  "publishedAt": "2025-..."
}
```

## Expanding Stub Locations

Current stub locations with empty objectives/vocab that need expansion:
- Seoul: cafe, convenience_store, subway_hub, practice_studio
- Shanghai: metro_station, bbq_stall, convenience_store, milk_tea_shop, dumpling_shop
- Tokyo: train_station, izakaya, konbini, tea_house, ramen_shop

## Reference

See `apps/client/lib/content/pojangmacha.ts` for a fully fleshed-out location example with 42 vocab items, 4 levels, and complete objectives.

## Workflow

1. Open backstage: `http://localhost:3001/backstage`
2. Create pipeline for target city:location
3. Generate concepts, review, select one
4. Generate characters, approve/reject each
5. Generate curriculum, review objectives and vocab
6. Generate backdrop prompts (can trigger Volcengine from server)
7. Publish to server

To integrate published content into the game, register it in `lib/content/locations.ts` using `registerLocation()`.
