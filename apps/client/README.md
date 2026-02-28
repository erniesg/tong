# apps/client

Next.js mobile-first client application.

Initial responsibilities:
1. Video player page with subtitle overlay lanes.
2. Dictionary hover/tap panel.
3. Profile setup and "Start New Game" flow.
4. Game scene UI with Tong assistant chat panel.

Implementation rule:
- Use shared contracts from `packages/contracts` and mocked data first.

## Mock UI demo (current)

A fixture-driven mockup is available for run-of-show validation, including:
- YouTube embed + enriched caption token interactions.
- Dictionary popover with cross-CJK mappings.
- Spotify + YouTube source visualizer from player profile fixture.
- Last 3-day vocab feed panel.
- Start/resume state card with XP/SP/RP.
- Learn-mode session list, first food hangout scene, and Shanghai texting reward chain.

Run from repo root:

```bash
npm run mock:ui
```

Then open:

- `http://localhost:4173`
