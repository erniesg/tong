# Tong

Tong is evolving from a Chrome extension prototype into a multi-platform, mobile-first app using Next.js + Capacitor.

## Hackathon track (active)

Goal:
- One demo flow running on web + iOS + Android.
- Client and server developed in parallel via separate worktrees/branches.

Key docs:
- `AGENTS.md`
- `docs/hackathon-architecture.md`
- `docs/hackathon-workstreams.md`
- `docs/demo-run-of-show.md`
- `docs/mastery-and-progression.md`
- `docs/interaction-modes.md`
- `docs/vocab-modeling-and-clustering.md`
- `docs/agent-execution-board.md`
- `docs/critical-tests.md`
- `docs/mock-ui-and-assets-track.md`
- `docs/install-and-test.md`
- `docs/deployment-track.md`
- `packages/contracts/api-contract.md`
- `packages/contracts/game-loop.json`
- `packages/contracts/objective-catalog.sample.json`

Create parallel worktrees:
```bash
cp .env.example .env
chmod +x scripts/setup-hackathon-worktrees.sh
./scripts/setup-hackathon-worktrees.sh
```

Run local demo contract smoke check:
```bash
npm run demo:smoke
```

## Legacy prototype (v0.1 extension)

The original Chrome MV3 extension scaffold remains in:
- `manifest.json`
- `src/popup.*`
- `src/game.*`
- `src/data/phrases.js`
- `src/options.*`
- `src/background.js`
