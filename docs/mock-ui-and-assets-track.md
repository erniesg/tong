# Mock UI And Creative Assets Track

## Purpose
Unblock demo validation early while API/plumbing is still in progress.

## `codex/mock-ui` deliverables
1. Clickable high-fidelity demo flow for all run-of-show segments.
2. Deterministic happy-path toggles:
- `demo_fast_path=true`
- `auto_pass_checks=true`
3. Scripted scene data to simulate:
- first food hangout,
- learn session history/new session,
- Shanghai texting reward chain.
4. UI review checklist and stakeholder signoff snapshots.

## `codex/creative-assets` deliverables
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
   - `assets/rewards/shanghai-reward-bundle.placeholder.json`
5. `npm run demo:smoke` now cross-checks concrete client `/assets/...` refs against the runtime manifest and on-disk files.
6. Final plumbing should swap data sources without redesigning screens.
