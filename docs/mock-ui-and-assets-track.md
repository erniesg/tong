# Mock UI And Creative Assets Track

## Purpose
Unblock demo validation early while API/plumbing is still in progress.

## Mock UI deliverables
1. Clickable high-fidelity demo flow for all run-of-show segments.
2. Deterministic happy-path toggles:
- `demo_fast_path=true`
- `auto_pass_checks=true`
3. Scripted scene data to simulate:
- first food hangout,
- learn session history/new session,
- Shanghai texting reward chain.
4. UI review checklist and stakeholder signoff snapshots.

## Creative assets deliverables
1. Initial city/location art pack:
- Seoul/Tokyo/Shanghai,
- shared 5 locations per city.
2. Reward media placeholders:
- video-call unlock clip placeholder,
- polaroid collectible card templates.
3. Asset manifest:
- id, usage context, source, rights, prompt/template, status.
- Canonical key contract published at `assets/manifest/canonical-asset-manifest.json` with runtime projection at `assets/manifest/runtime-asset-manifest.json`.
4. Compression and naming conventions for mobile-first loading.

## Integration contract
1. Mock UI must consume fixtures under `packages/contracts/fixtures`.
2. Asset references should use stable IDs, not hardcoded file names.
3. Stable IDs follow `domain.scope.name.variant` and must resolve through the runtime manifest.
4. Starter references for content packs and rewards live in:
   - `assets/content-packs/city-location-character.starter.template.json`
   - `assets/content-packs/seoul-food-street.starter.json`
   - `assets/content-packs/seoul-cafe.starter.json`
   - `assets/content-packs/seoul-convenience-store.starter.json`
   - `assets/content-packs/seoul-subway-hub.starter.json`
   - `assets/content-packs/seoul-practice-studio.starter.json`
   - `assets/content-packs/tokyo-train-station.starter.json`
   - `assets/content-packs/tokyo-izakaya.starter.json`
   - `assets/content-packs/tokyo-konbini.starter.json`
   - `assets/content-packs/tokyo-tea-house.starter.json`
   - `assets/content-packs/tokyo-ramen-shop.starter.json`
   - `assets/content-packs/shanghai-metro-station.starter.json`
   - `assets/content-packs/shanghai-bbq-stall.starter.json`
   - `assets/content-packs/shanghai-convenience-store.starter.json`
   - `assets/content-packs/shanghai-milk-tea-shop.starter.json`
   - `assets/content-packs/shanghai-dumpling-shop.starter.json`
   - `assets/rewards/shanghai-reward-bundle.placeholder.json`
   Pack data should use contract IDs such as `food_street`; reserve hyphenated slugs such as `food-street` for asset keys and file naming.
   - `assets/content-packs/starter-cast-roster.spec.md`
   - `assets/manifest/starter-cast-registry.json`
   These files are the approved starter-cast and per-character asset-bundle source of truth for downstream city-pack work.
   Tokyo intentionally has no live `practice_studio` pin, while Shanghai's live `milk_tea_shop` pin resolves to `dagLocationSlot: practice_studio` and keeps the advanced reward hooks on that starter pack.
5. Scripted messaging promo scenes should live under each relevant starter pack as `scriptedMessagingScenes` and follow `packages/contracts` `ScriptedMessagingScene` shape (`sceneId`, `cityId`, `objectiveId`, `title`, `hookText`, `speakers`, `rows`).
6. `sceneId` values should stay stable and manifest-friendly with a city/platform/location prefix (example: `promo.seoul.kakao.food_street.*`).
7. `npm run demo:smoke` now cross-checks concrete client `/assets/...` refs against the runtime manifest and on-disk files.
8. Final plumbing should swap data sources without redesigning screens.


## Scripted messaging promo recording proof (follow-up)

Use the deterministic starter-pack promo presets:

- `http://localhost:3000/mock/messaging-promo?fixture=seoul_default`
- `http://localhost:3000/mock/messaging-promo?fixture=tokyo_bilingual`
- `http://localhost:3000/mock/messaging-promo?fixture=shanghai_bilingual`

Short reviewer checklist:

1. Verify first-message typing is visible immediately (no hook/title mask).
2. Trigger playback with visible click/tap on `Play` or `Restart`.
3. Confirm stable post-state where delivered bubbles and typing cadence are readable.
