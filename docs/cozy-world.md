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

- **WASD / arrows:** move; **Shift / Run:** run; **Space / Jump:** hop. In dialogue, Space advances the conversation instead.
- **Drag the world:** full orbit; **scroll / trackpad / pinch / + / −:** zoom. The visible zoom buttons work without opening a menu. Touch movement uses the dedicated joystick, leaving the rest of the world available for look/pinch gestures.
- **E / interaction button:** talk, practice a phrase, use transit or choose a flight at an airport connection.
- **B:** phrasebook; **N:** map; **H:** ask Tong; **Escape:** close panels or return from a scenic camera. The map can be expanded with its expand button or by tapping it.
- **Tools → Get around:** choose walking, skateboard, scooter or bicycle. Rides accelerate and coast; **Brake / X / Control** slows them. They are packed away inside rooms. Movement uses gravity and bounded collision substeps, not a full vehicle physics simulation.
- **Tools → Neighbourhood guide:** find every location category, set a walking waypoint or select a camera-only landmark view. Moving returns scenic cameras to the player.
- **Tools → Demo shortcuts:** explicitly enable immediate city/stop visits. Demo defaults OFF, does not reset progress and is separate from normal flights. Turn it off to disable shortcuts.
- **Tools → Screen layout / Text size:** use Auto for the actual window/device orientation, or preview portrait/landscape in a contained, letterboxed stage. Previews do not force OS screen rotation. Large text also enlarges the on-screen wayfinding label; game zoom does not shrink HUD text.
- **Tools → Take your time:** dawn, noon, sunset, night and pause/play/fast-forward. These affect the game clock, not real time. Seoul's food tent retains its original 19:00–03:00 opening hours.
- Local transit stays within the current city. Reach the airport connection on foot or using local transit, then interact with its flight marker. Flights arrive at the destination's terminal, advance the shared clock two hours and retain learned phrases, relationships and local objectives. Shanghai local time is one hour behind Seoul/Tokyo.
- Each city has a snack pickup → café delivery → scenic postcard errand. Answer the local phrase correctly at each target. Incorrect answers do not advance the objective. Seoul also retains the original shops, Ha-eun/Jin schedules, relationship activities and night-out story.
- Progress is stored in this browser's `localStorage`. **Continue** restores city, safe position and objectives; **New game** starts a new session. Existing Seoul v2 saves default to Seoul. Saves are not account-backed or cross-device.

## Compressed geography

These are authored neighbourhood interpretations, **not navigational maps or literal city-scale replicas**. Each city's five core location types now have furnished, walk-in spaces or open-sided food/transit pavilions. Walk through their actual door gaps. Inside, the roof and camera-facing walls cut away; other walls remain opaque and all physical walls remain solid. Declared room ceilings constrain jumps even when visually cut away. Surrounding decorative buildings are still exterior frontages, not universally enterable.

| City | Spatial anchors | Airport interpretation |
| --- | --- | --- |
| Seoul | Retained Hongdae activity core, lateral snack/busking loops, Yeonnam/Gyeongui park to the north, compressed Mangwon/Han links south, distant Namsan east on the north bank | AREX connection to Gimpo/Incheon; the airport is not depicted inside Hongdae |
| Tokyo | Asakusa-style timber shopping/temple lanes west of the Sumida, riverside loops and crossings, Skytree east | Haneda/Narita transit connection, not a downtown runway |
| Shanghai | Lilong/food/tea lanes inland west of the Huangpu, Bund promenade on its west bank, decorative Pudong skyline east | Pudong/Hongqiao transit connection |

Every city has food, café, convenience-store, subway and practice-studio destinations. Streets have alternate routes and connected exploration loops. Water is not swimmable; Shanghai's far-bank skyline is scenery rather than another playable district. Existing Tong character art and city illustrations are reused; the new buildings/streets are procedural geometry, not stretched vertical backdrops.

## Source ownership

- `apps/client/public/cozy/js/cities/*.js`: city descriptors, streets, landmarks, collision geometry and day/night-aware lighting.
- `js/world.js`: original Seoul activity buildings, terrain, river and props.
- `js/main.js`: input/camera, city selection, interaction, travel, maps, progression, stage sizing and saves.
- `js/interiors.js`: room registry, furnished shells, selective cutaway/material handling and physical ceiling declarations.
- `js/traversal.js`, `js/rides.js`: renderer-independent movement/gravity/collision steps and attached ride models.
- `js/nature.js`, `js/characters.js`: seeded city-specific trees and chibi characters/cat.
- `js/sky.js`: shared sun/moon/sky, fog, window glow and lights.
- `js/story.js`, `js/dialogue.js`: Seoul scripted narrative.

City descriptors use disjoint scene coordinates. The runtime shows only the selected city's geometry and dispatches its terrain/bounds; original Seoul interior terrain is preserved. World coordinates use `+z` north for Seoul and `-z` north for the new cities; the map corrects this so north is always up.

## Focused checks

Pure movement/ceiling checks need no browser:

```sh
node --test scripts/cozy-playability.test.mjs
```

With the private server running and Playwright available, check the new actual controls independently of reload/long-session behavior:

```sh
node scripts/cozy-controls-check.mjs
```

That focused scenario exercises visible zoom, wheel, more than one full drag orbit, actual two-touch pinch, responsive resize, run/jump/landing and all three rendered ride/brake inputs. It uses a labelled diagnostic paused/noon setup, not the clock UI as proof. It does not prove all interiors, device performance or every older gameplay path.

The older combined `node scripts/cozy-browser-check.mjs` includes reload and a longer journey. Its unresolved VM timeout history remains a separate hold; new feature checks do not erase it.

Optional environment variables:

- `PLAYWRIGHT_MODULE`: path to an existing Playwright module if it is not resolvable in this checkout.
- `COZY_URL`: override the browser-game URL.
- `COZY_CHROMIUM_EXECUTABLE`: use another installed Chromium executable. Software-rendered Chromium 1208 and 1228 have timed out during longer/reload scenarios on this VM; a small isolated reload/Continue scenario also succeeded with 1228. The cause is not established. Do not interpret an interrupted full run as a pass.
- `COZY_EVIDENCE_DIR`: write screenshots and a final JSON report outside source history.
- `COZY_DIAGNOSTIC_PIXEL_RATIO`: optional renderer-quality override for the focused controls script; record it explicitly and do not call it native/default-resolution proof.
- `COZY_CAPTURE=1`: capture the final ride only after behavior assertions finish.
- `COZY_RECORD_VIDEO=1`: optional continuous recording. Avoid it for already slow software rendering: readbacks can stall controls. Ordered frames with input/state cues are a separate supported proof path.

The older combined check uses diagnostic local transit to shorten walking, ordinary flight-selection and phrase-answer buttons, day/night state, reload/Continue, a return trip, keyboard movement and a touch-sized viewport. It is not an uninterrupted manual walking playthrough, real-device performance test, model-integration test or complete Seoul story acceptance. Only a completed report establishes that particular run passed.
