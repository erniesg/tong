# Install And Test (Fast Path)

## Goal
Get to immediate review/testing for:
1. YouTube caption overlays (web + Chrome extension)
2. Mobile game UI flow
3. YouTube/Spotify ingestion + topic/frequency visualization

## Prerequisites
1. Node.js 20+
2. npm 10+
3. Google Chrome (latest)

## Bootstrap
```bash
npm --prefix apps/server install
npm --prefix apps/client install
npm run demo:smoke
npm run ingest:mock
```

## Run services
In terminal 1:
```bash
npm run dev:server
```

In terminal 2:
```bash
npm run dev:client
```

## Web review routes
1. Overlay: `http://localhost:3000/overlay`
2. Mobile game UI: `http://localhost:3000/game`
3. Ingestion insights: `http://localhost:3000/insights`

## Chrome extension test
1. Open `chrome://extensions`
2. Enable Developer mode
3. Load unpacked: `/Users/erniesg/code/erniesg/tong/apps/extension`
4. Open any YouTube watch page
5. Verify:
- Triple-lane overlay appears
- Token clicks open dictionary info
- Overlay follows playback timing

## What `demo:smoke` validates
1. Required contract fixture files exist.
2. JSON fixtures parse successfully.
3. Core progression contract shape remains valid.
4. Objective model includes vocabulary/grammar/sentence structures.
5. Player media profile includes YouTube + Spotify signals.

## Acceptance checklist
1. `/overlay` lane sync + dictionary popover works.
2. Extension overlay appears on YouTube and token lookup works.
3. `/game` supports start/resume, hangout turns, XP/SP/RP updates.
4. `/game` learn mode supports viewing previous + starting new sessions.
5. `/insights` can run ingestion and render frequency + topic clusters.
