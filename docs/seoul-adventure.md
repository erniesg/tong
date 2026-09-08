# Seoul adventure prototype

An additive, procedural 3D chapter for Tong. Open `/seoul`; `/game/seoul` redirects there. The existing `/game` experience is preserved.

## Run

```sh
npm --prefix apps/client install
npm run dev:client
```

Open `http://localhost:3000/seoul`. The current local preview can also be served on port 3011.

## Play

- Walk with WASD, arrow keys, the touch direction pad, or by clicking/tapping the ground. Drag the world to rotate the camera.
- Choose a destination on the minimap or Map screen. Approach a location and press E or tap its nearby action.
- Learn a Korean phrase, then use it in a first-person hangout with Jin or Ha-eun. Tap Korean dialogue to reveal its translation.
- Three validated hangouts open the evening mission in the Journal. Passing awards a memory and the next mastery title.
- The Journal lists prior sessions, XP/SP/RP and memories. Sessions can be replayed; rewards are granted once per location.
- When WebGL is unavailable, the location selector and Journal support the same learning and mission loop.

This is a self-contained prototype with authored conversations and a browser-local save (`tong.seoul-adventure.v1`). It does not alter existing Tong saves or call the game's backend. Cross-device saves, larger city districts, additional mastery chapters and generative dialogue are future work.

## Verify

```sh
npm run test:seoul
npm run test:graph-contracts
npm --prefix apps/client run build
python3 .agents/skills/_functional-qa/scripts/test_remote_agent_orchestration.py
```

With a local server running and Playwright available:

```sh
SEOUL_BASE_URL=http://127.0.0.1:3011 node scripts/seoul-adventure-browser.mjs
```

If Playwright is supplied by an external tool runtime, set `PLAYWRIGHT_MODULE` to its installed module directory. Screenshots and machine-readable results go to `artifacts/qa-runs/seoul-adventure/`. The browser checks cover real lessons and hangouts, mission rewards, persistence, keyboard/touch movement, portrait and landscape layouts, and the complete WebGL fallback path.

## Source sync record

The original local changes were preserved in checkpoint `721669e`. GitHub and Rucksack's clean coding checkout at `/home/ubuntu/code/erniesg/tong` were fetched and compared at remote `main` revision `64680af`. Rewritten local/remote histories were compared using patch equivalence. The two additional remote changes were imported while preserving the newer local playtest pipeline and provider configuration; the planner/dispatcher compatibility changes have local dry-run tests.

No deployment, remote workflow dispatch, or remote branch push is part of this prototype. Existing upstream deployment/Discord concurrency behavior outside the sync compatibility changes has not been expanded into this task.
