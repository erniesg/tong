# Hackathon Architecture (Next.js + Capacitor)

## Objective
Ship one coherent demo across:
- Web (desktop/mobile browser)
- iOS (Capacitor wrapper)
- Android (Capacitor wrapper)

## Core decision
Use a client-heavy Next.js app first, then progressively swap in server APIs.

Why:
- Fast iteration for UI-heavy demo flows.
- Keeps SSR optional for early milestones.
- Lets iOS/Android use the same front-end code through Capacitor.

## Proposed repo layout
```
apps/
  client/        # Next.js app (mobile-first)
  server/        # Server-side features (API + ingestion + ranking)
packages/
  contracts/     # Shared API and domain contracts
docs/
  ...
```

## Runtime architecture
1. `apps/client` renders overlay, dictionary card, and game scenes.
2. `apps/client` starts with local mocks/fixtures for all server contracts.
3. `apps/server` implements endpoints behind the same contracts.
4. Client toggles `USE_SERVER_API=true` to switch from mock to real API.

## Demo capability map
- Caption augmentation:
  - Input: source caption segment + timestamp.
  - Output: native line, romanization, English translation, token-level metadata.
- Dictionary hover/tap:
  - Input: token + source language.
  - Output: meaning, example usages, CJK equivalents, cross-language readings.
- 3-day personalization:
  - Input: transcript/lyrics corpus from last 72 hours.
  - Output: ranked vocabulary list and confidence scores.
- Game bootstrap:
  - Input: user profile/proficiency.
  - Output: world intro scene + first actions + Tong guide prompt.

## Fastest build sequence
1. Client shell + mock contracts.
2. Subtitle overlay + dictionary interaction.
3. Game "start new game" and profile setup.
4. Server ingestion + ranked vocabulary.
5. Replace mocks with live server endpoints.

## Non-goals for hackathon
- Full production auth stack.
- Deep offline sync.
- Perfect subtitle/NLP accuracy across all content types.
