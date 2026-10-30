# Cozy city adventure

The browser game lives at `/cozy` in the Next.js client, or `/cozy/index.html` when serving `apps/client/public` directly. It is a self-contained Three.js game; no model API or backend is required for its scripted Seoul story or local city errands. It loads pinned Three.js modules from jsDelivr and fonts from Google, so first load needs internet access.

## Run privately

From the repository root:

```sh
python3 -m http.server 8420 --bind 127.0.0.1 --directory apps/client/public
```

For a remote VM, forward the port from your own machine:

```sh
ssh -N -L 8420:127.0.0.1:8420 erniesg-ai-vm
```

Open `http://localhost:8420/cozy/index.html`. This does not deploy the game or expose the VM listener publicly.

## Play

- **WASD / arrows:** walk; **Shift:** run. Drag to look; scroll to change camera distance.
- **E / interaction button:** talk, practice a phrase, use transit or choose a flight at an airport connection.
- **B:** phrasebook; **N:** map; **H:** ask Tong; **Escape:** close panels.
- Touch devices have a movement stick, drag-to-look and an interaction button. The map can be expanded with its expand button or by tapping the map.
- Clock buttons select dawn, noon, sunset or night. Pause/play/fast-forward affect the game clock, not real time.
- Local transit stays within the current city. Reach the airport connection on foot or using local transit, then interact with its flight marker. Flights arrive at the destination's terminal, advance the shared clock two hours and retain learned phrases, relationships and local objectives. Shanghai local time is one hour behind Seoul/Tokyo.
- Each city has a snack pickup → café delivery → scenic postcard errand. Answer the local phrase correctly at each target. Incorrect answers do not advance the objective. Seoul also retains the original shops, Ha-eun/Jin schedules, relationship activities and night-out story.
- Progress is stored in this browser's `localStorage`. **Continue** restores city, safe position and objectives; **New game** starts a new session. Existing Seoul v2 saves default to Seoul. Saves are not account-backed or cross-device.

## Compressed geography

These are authored neighbourhood interpretations, **not navigational maps or literal city-scale replicas**. Buildings added around the original Seoul activity interiors are exterior frontages; the new Tokyo and Shanghai stops use outdoor interactions.

| City | Spatial anchors | Airport interpretation |
| --- | --- | --- |
| Seoul | Retained Hongdae activity core, lateral snack/busking loops, Yeonnam/Gyeongui park to the north, compressed Mangwon/Han links south, distant Namsan east on the north bank | AREX connection to Gimpo/Incheon; the airport is not depicted inside Hongdae |
| Tokyo | Asakusa-style timber shopping/temple lanes west of the Sumida, riverside loops and crossings, Skytree east | Haneda/Narita transit connection, not a downtown runway |
| Shanghai | Lilong/food/tea lanes inland west of the Huangpu, Bund promenade on its west bank, decorative Pudong skyline east | Pudong/Hongqiao transit connection |

Every city has food, café, convenience-store, subway and practice-studio destinations. Streets have alternate routes and connected exploration loops. Water is not swimmable; Shanghai's far-bank skyline is scenery rather than another playable district. Existing Tong character art and city illustrations are reused; the new buildings/streets are procedural geometry, not stretched vertical backdrops.

## Source ownership

- `apps/client/public/cozy/js/cities/*.js`: city descriptors, streets, landmarks, collision geometry and day/night-aware lighting.
- `js/world.js`: original Seoul activity buildings, terrain, river and props.
- `js/main.js`: movement, city selection, interaction, travel, maps, progression and saves.
- `js/sky.js`: shared sun/moon/sky, fog, window glow and lights.
- `js/story.js`, `js/dialogue.js`: Seoul scripted narrative.

City descriptors use disjoint scene coordinates. The runtime shows only the selected city's geometry and dispatches its terrain/bounds; original Seoul interior terrain is preserved. World coordinates use `+z` north for Seoul and `-z` north for the new cities; the map corrects this so north is always up.

## Browser regression check

With the private server running and Playwright available:

```sh
node scripts/cozy-browser-check.mjs
```

Optional environment variables:

- `PLAYWRIGHT_MODULE`: path to an existing Playwright module if it is not resolvable in this checkout.
- `COZY_URL`: override the browser-game URL.
- `COZY_CHROMIUM_EXECUTABLE`: use another installed Chromium executable. The host's older Chromium 1208 software renderer has timed out during reload; a small isolated reload/Continue scenario succeeded with 1228. Do not interpret an interrupted full run as a pass.
- `COZY_EVIDENCE_DIR`: write screenshots and a final JSON report outside source history.

The check uses diagnostic local transit to shorten walking, ordinary flight-selection and phrase-answer buttons, day/night state, reload/Continue, a return trip, keyboard movement and a touch-sized viewport. It is not an uninterrupted manual walking playthrough, real-device performance test, model-integration test or complete Seoul story acceptance. Only a completed report establishes that particular run passed.
