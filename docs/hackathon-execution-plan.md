# Hackathon Execution Plan (Tong Fresh Build)

## Intent
Build a clean Tong demo implementation in this repository while using only internal legacy learnings as reference.

## Guardrails
1. No direct code copy from prior internal prototypes into Tong.
2. Rebuild interfaces around Tong contracts under `packages/contracts`.
3. Keep reference notes local-only under gitignored `reference-notes/`.

## Phase 1: Planning And Baseline
1. Publish this execution plan and a living TODO checklist.
2. Add local reference notes directory (gitignored).
3. Add runnable scripts for server/client/dev and mock ingestion.

## Phase 2: API + Ingestion Backbone
1. Implement `apps/server` mock API for contract endpoints:
- `GET /api/v1/captions/enriched`
- `GET /api/v1/dictionary/entry`
- `GET /api/v1/vocab/frequency`
- `GET /api/v1/vocab/insights`
- `GET /api/v1/player/media-profile`
- `POST /api/v1/game/start-or-resume`
- `PUT /api/v1/profile/proficiency`
2. Implement learn + hangout support endpoints for demo flow:
- `GET /api/v1/learn/sessions`
- `POST /api/v1/learn/sessions`
- `GET /api/v1/objectives/next`
- `POST /api/v1/scenes/hangout/start`
- `POST /api/v1/scenes/hangout/respond`
3. Implement mock YT/Spotify ingestion job and generated insights snapshot.

## Phase 3: Web Demo Surfaces (Review/Test)
1. `/overlay` page:
- Triple-lane captions (script/romanization/English)
- Token click dictionary popover
- Playback simulation controls
2. `/game` page:
- Start/resume session
- City + location selection
- Hangout mode (stateful XP/SP/RP)
- Learn mode with previous sessions + start new session
3. `/insights` page:
- Run mock ingestion
- Frequency table with source contributions
- Topic cluster view + source breakdown

## Phase 4: Chrome Extension Demo Surface
1. New `apps/extension` MV3 scaffold (fresh Tong code).
2. YouTube content script overlay synced to video time.
3. Token click dictionary lookup against Tong server.
4. Popup with quick links to web overlay/game/insights.

## Phase 5: Validation + Handoff
1. Run contract smoke check.
2. Run ingestion job once and verify endpoint responses.
3. Provide explicit review/test runbook:
- Web overlay
- Chrome extension
- Mobile game UI
- Ingestion + insights
