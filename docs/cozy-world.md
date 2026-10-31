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
- **E / interaction button:** talk, practice a phrase, use transit or choose a flight at an airport connection. In staffed rooms, walk up to the actual attendant; the activity retains local phrase/errand progress. Subway staff also offer the normal transit menu. Seoul's authored characters and schedules remain distinct.
- **B:** phrasebook; **N:** map; **H:** ask Tong; **Escape:** close panels or return from a scenic camera. The map can be expanded with its expand button or by tapping it.
- **Tools → Get around:** choose walking, skateboard, scooter or bicycle. Rides accelerate and coast; **Brake / X / Control** slows them. They are packed away inside rooms. Movement uses gravity and bounded collision substeps, not a full vehicle physics simulation.
- **Tools → Neighbourhood guide:** find every location category, set a walking waypoint or select one of eight camera-only landmark views: Hangang/Namsan; Sumida–Skytree, Kaminarimon and Sensō-ji; Huangpu–Oriental Pearl, Pudong and the Bund. Views do not teleport the player. Moving or Escape returns to the player; the clock controls let you compare day/night.
- **Tools → Neighbourhood guide → Board artwork:** inspect the full original Seoul concept image in its actual world frame, with the ordinary HUD still visible. This additional camera does not replace the eight named landmark views or teleport the player; movement or Escape returns to follow. The image is concept art, not a literal navigation map. The adjacent **Original concept image · full resolution (new tab)** link is a supplemental detail reader: use native browser image zoom/scroll, then close the tab to return. It retains the original image/watermark; it does not replace the actual world view.
- **Apartments:** find Yeonnam Apartments (Seoul), Asakusa Apartments (Tokyo) or Lilong Apartments (Shanghai) in the guide. Each initial three-storey block has a shared lobby and two furnished upper homes with living/kitchen, bedroom and bathroom spaces. Walk the real stair flights/landings with normal controls; there is no floor-teleport button. Upper structure and residents hide when needed to reveal the occupied lower floor, then restore outside.
- **Tools → Demo shortcuts:** explicitly enable immediate city/stop visits. Demo defaults OFF, does not reset progress and is separate from normal flights. Turn it off to disable shortcuts.
- **Tools → Screen layout / Text size:** use Auto for the actual window/device orientation, or preview portrait/landscape in a contained, letterboxed stage. Previews do not force OS screen rotation. Large text also enlarges the on-screen wayfinding label; game zoom does not shrink HUD text.
- **Tools → Take your time:** dawn, noon, sunset, night and pause/play/fast-forward. These affect the game clock, not real time. Seoul's food tent retains its original 19:00–03:00 opening hours. Its real front header/roller now clears the full player; daytime closure still blocks entry.
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

- `apps/client/public/cozy/js/cities/*.js`: city descriptors, streets, landmarks, collision geometry and day/night-aware lighting. Scenic descriptors declare camera `position`/`look` and optionally a vertical `fov` (clamped to 30–75° before responsive adjustment); river panoramas use wider framing to include the water and named tower.
- `js/world.js`: original Seoul activity buildings, terrain, river and props.
- `js/main.js`: input/camera, city selection, interaction, travel, maps, progression, stage sizing and saves.
- `js/interiors.js`: room registry, furnished shells, selective cutaway/material handling and physical ceiling declarations.
- `js/traversal.js`, `js/rides.js`: renderer-independent movement/gravity/collision steps and attached ride models; finite-Y bodies and explicit feet-height support preserve floor separation and safe positions.
- `js/apartments.js`, `js/level-support.js`: authored multi-storey geometry, real stairs/landings, furnished flats and shared support/ceiling plans.
- `js/occupants.js`: city-local staff/residents, actual nearby selection and finite-height collision bodies.
- `js/surfaces.js`: non-overlapping Tokyo road footprints/triangles and consistent world UVs, rather than layered junction boxes.
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

The occupied-world follow-up adds regressions for actual ride selection/saved-pose dispatch, exposed stock and physical apartment cutaways. Reviews5/6 narrowly approved products `03cf8ea`/`9a4d22e`, not complete acceptance. Product `ee8adbd` also removes settled ghost roof/wall layers and attached signs in single-floor shops, and adds the ordinary world-art camera; 59 configured source/Three checks pass. Actual normal doorway/exit checks cover authored Seoul café, Tokyo café/Aoi and Shanghai store/Mei without replacing Seoul furniture/cast. The board button passes six desktop/portrait/landscape × normal/large-text cases with full poster projection, no measured HUD overlap, unchanged player/progress and normal return. These newer images use pixelRatio1/default-quality software Chromium, not hardware/device performance proof. Earlier apartment views remain explicit body/Y/camera diagnostics, separate from historical physical stair journeys; no reload/full-story acceptance. Review7 narrowly approved that real delta and its accessible composition path, retaining tiny-text/default-follow/native limitations. Product `d98742a` additionally repairs a real original-tent entry blocker: header/roller geometry and physical ceiling now agree at 2.05m instead of a 1.85m query/1.725m lowest roller against the 1.9m player. Actual normal night entry/exit and closed-day blocking pass using the clock buttons. The supplemental same-origin original-image link passes keyboard Tab/Enter, three viewport/text cases, original-byte/watermark retention, native 1:1 zoom/scroll and unchanged game state.60 configured CPU checks pass. These remain scoped software/direct-page proofs, not a meal/story/reload/device acceptance claim; independent review8 narrowly approved the actual changed source/useful partial preview, independently passing60 checks and opening all9 new images. The viewer report's instantaneous fit rectangle and later PNG are not simultaneous measurements. All broader holds remain.

Four further representative cases were inspected on unchanged source: authored Seoul store purchase/price/bag/four earned phrases and normal exit/restoration; Ren/Tokyo food, Lin/Shanghai café and Nao/Tokyo subway answered exercises with normal entry/exit/restoration. Subway proves menu access, not a ticket purchase/ride; café-first does not manufacture snack delivery. The linked earned-word Seoul studio quiz reached3/3 with195 read-only per-frame mirror/camera guards clear. Its final radial-waypoint check timed out despite walking outside: perpendicular drift.181m exceeded the.17m circle. The whole linked driver remains failed, not a full Studio/mirror/stair pass; completed Store/quiz parts were not replayed just to turn it green.

A separate original mild meal reached real greeting/sitting/order/taste/talk/split/bye and affection+3. Its365s authored-exit/summary bound expired on Ha-eun's last path leg,4.505m remaining; night completion/stand-up/save/Continue were NOT proved. Two-shot lighting is visibly overexposed. Preserve this new failure and all old holds; no platform-only diagnosis or silent restart. A single15-room component matrix retains historical/new/missing distinctions.

An independently assessed, immutable [new partial preview](https://runs.tong.berlayar.ai/qa-runs/functional-qa/cozy-occupied-world-preview/cozy-accessible-preview-20261031-sourced98742a/summary.md) hosts nine selected source-labelled images plus metadata (**12 objects**, all fetched/full-byte/SHA verified). Original ten-object snapshot is unchanged. New source/reader/partial-room views are software pixelRatio1, not hardware/device/temporal/performance acceptance; raw state, failed linked-run/meal images and private operational data are excluded. No merge/deploy/automatic fixed publication.

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
