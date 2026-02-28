# Install And Test (Fast Path)

## Goal
Let any contributor run and validate the demo flow locally, even without remote services.

## Prerequisites
1. Node.js 20+
2. npm 10+
3. Git 2.39+
4. Optional iOS: Xcode 15+
5. Optional Android: Android Studio (latest stable)

## Bootstrap
```bash
cp .env.example .env
npm run setup:worktrees
npm run launch:agents
npm run demo:smoke
```

## What `demo:smoke` validates
1. Required contract fixture files exist.
2. JSON fixtures parse successfully.
3. Core keys used by client and server are present.
4. Objective model contains vocabulary + grammar + sentence structures.
5. Player media profile fixture includes both YouTube + Spotify learning signals.

## Local test modes
1. `local-mock` (default): no remote dependencies, uses fixtures.
2. `local-server`: local API process for integration.
3. `remote-server`: deployed API endpoints.

## Configuration switch rule
Always drive backend source via one env key:
- `TONG_BACKEND_MODE=local-mock|local-server|remote-server`

## Device testing
1. Web: browser run on localhost.
2. iOS: Capacitor sync + Xcode run to simulator/device.
3. Android: Capacitor sync + Android Studio emulator/device.

## Acceptance checklist for demo readiness
1. Run-of-show can complete in `local-mock`.
2. First food hangout scene runs end-to-end.
3. XP/SP/RP visibly update after actions.
4. Shanghai advanced texting reward flow can be triggered.
5. Remote deployment can be swapped out without UI changes.
