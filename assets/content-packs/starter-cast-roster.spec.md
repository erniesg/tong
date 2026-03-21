# Starter cast roster and per-character asset bundle contract

This file is the repo-visible source of truth for issue `#69`. It defines the approved starter cast roster for Seoul, Tokyo, and Shanghai, keyed by the canonical `mapLocationId -> dagLocationSlot` registry in `packages/contracts/world-map-registry.sample.json`.

## Contract decisions

1. **Canonical identity source**: downstream packs must resolve each live `mapLocationId` through `packages/contracts/world-map-registry.sample.json` before choosing characters or rewards.
2. **Starter roster coverage target**: each shared `dagLocationSlot` gets **two local starter characters per city when that slot is backed by a current live map pin**. When multiple live map pins in a city map to the same shared slot, they intentionally reuse the same two-character roster. Do not keep reserved starter pairs for non-live map pins in checked-in roster sources unless the canonical world-map registry exposes a live backing pin.
3. **Tong remains global**: Tong is still available as the assistant guide in every session, but Tong is not counted toward the two-character local starter roster.
4. **Stable logical IDs**:
   - Character ID: `char.<city>.<dagLocationSlot>.<name>`
   - Slot roster ID: `slot.<city>.<dagLocationSlot>.starter`
   - Starter pack ID: `pack.<city>.<mapLocationId>.starter`
   - Asset keys: `character.<city>.<dagLocationSlot>.<name>.<logicalAssetType>`
5. **Runtime fallback rule**: the minimum shippable bundle is `portrait.default`, `sprite.default`, `scene.default`, and `voice.reference`. Optional cinematic, expression, and reward outputs can land later without invalidating the roster contract.
6. **Reward hooks**: the Shanghai advanced texting path is the only starter roster path that reserves both video-call and polaroid reward hooks at this stage. Those hooks live on the `milk_tea_shop -> practice_studio` mapping because `#114` made that slot mapping explicit.

## Required per-character asset bundle

| Logical asset type | Required | Runtime / downstream use |
| --- | --- | --- |
| `portrait.default` | Yes | Dialogue avatar, roster cards, learn session headers |
| `sprite.default` | Yes | First-person hangout companion or counterpart render |
| `scene.default` | Yes | Static fallback still when layered animation is unavailable |
| `voice.reference` | Yes | Prompt-pack persona note for creative-assets and game-engine authoring |
| `sprite.expression-set` | Optional | Additional mood/pose coverage (`neutral`, `cheerful`, `shy`, `focused`) |
| `intro.video` | Optional | First-meet or location-intro cinematic |
| `reward.polaroid` | Optional | Collectible memory card reward |
| `reward.video-call` | Optional except advanced reward paths | Video-call reward asset for reward completion scenes |

## City + live map pin coverage

| City | Live `mapLocationId` | Shared `dagLocationSlot` | Approved starter characters | Starter pack ID | Notes |
| --- | --- | --- | --- | --- | --- |
| Seoul | `food_street` | `food_street` | `char.seoul.food_street.minseo`, `char.seoul.food_street.jiho` | `pack.seoul.food_street.starter` | Food-street lead pair |
| Seoul | `cafe` | `cafe` | `char.seoul.cafe.sora`, `char.seoul.cafe.donghyun` | `pack.seoul.cafe.starter` | Study / cafe social pair |
| Seoul | `convenience_store` | `convenience_store` | `char.seoul.convenience_store.eunji`, `char.seoul.convenience_store.hyunwoo` | `pack.seoul.convenience_store.starter` | Quick errand + slang practice |
| Seoul | `subway_hub` | `subway_hub` | `char.seoul.subway_hub.nari`, `char.seoul.subway_hub.taemin` | `pack.seoul.subway_hub.starter` | Transit navigation + commute talk |
| Seoul | `practice_studio` | `practice_studio` | `char.seoul.practice_studio.yujin`, `char.seoul.practice_studio.seungwoo` | `pack.seoul.practice_studio.starter` | Live pin is displayed to players as **Chimaek Place** while the registry-backed internal `mapLocationId` remains `practice_studio` |
| Tokyo | `train_station` | `subway_hub` | `char.tokyo.subway_hub.akira`, `char.tokyo.subway_hub.mei` | `pack.tokyo.train_station.starter` | Reuses shared subway-hub slot |
| Tokyo | `izakaya` | `food_street` | `char.tokyo.food_street.rin`, `char.tokyo.food_street.daichi` | `pack.tokyo.izakaya.starter` | Same slot pair reused across Tokyo food pins |
| Tokyo | `konbini` | `convenience_store` | `char.tokyo.convenience_store.yui`, `char.tokyo.convenience_store.kaito` | `pack.tokyo.konbini.starter` | Konbini-specific wrapper on shared slot |
| Tokyo | `tea_house` | `cafe` | `char.tokyo.cafe.hina`, `char.tokyo.cafe.ren` | `pack.tokyo.tea_house.starter` | Tea-house social-learning lane |
| Tokyo | `ramen_shop` | `food_street` | `char.tokyo.food_street.rin`, `char.tokyo.food_street.daichi` | `pack.tokyo.ramen_shop.starter` | Shares approved Tokyo food-street slot pair |
| Shanghai | `metro_station` | `subway_hub` | `char.shanghai.subway_hub.lin`, `char.shanghai.subway_hub.wei` | `pack.shanghai.metro_station.starter` | Transit challenge pair |
| Shanghai | `bbq_stall` | `food_street` | `char.shanghai.food_street.qiao`, `char.shanghai.food_street.ming` | `pack.shanghai.bbq_stall.starter` | Shared food-street slot pair |
| Shanghai | `convenience_store` | `convenience_store` | `char.shanghai.convenience_store.an`, `char.shanghai.convenience_store.yue` | `pack.shanghai.convenience_store.starter` | Everyday texting + errand lane |
| Shanghai | `milk_tea_shop` | `practice_studio` | `char.shanghai.practice_studio.xinyi`, `char.shanghai.practice_studio.zhen` | `pack.shanghai.milk_tea_shop.starter` | **Advanced texting mission reward path** with video-call + polaroid hooks |
| Shanghai | `dumpling_shop` | `food_street` | `char.shanghai.food_street.qiao`, `char.shanghai.food_street.ming` | `pack.shanghai.dumpling_shop.starter` | Shares approved Shanghai food-street slot pair |

## Character roster notes

The machine-readable roster lives in `assets/manifest/starter-cast-registry.json`. Downstream packs should reference that file instead of duplicating names, IDs, or asset key shapes.

### Reserved shared-slot rosters without a current live map pin
- Shanghai `cafe` still gets an approved starter pair even though the current live Shanghai map pins do not expose that slot yet.

### Seoul
- `char.seoul.food_street.minseo` — night-market host, lead
- `char.seoul.food_street.jiho` — late-shift foodie, support
- `char.seoul.cafe.sora` — study-barista, lead
- `char.seoul.cafe.donghyun` — indie songwriter, support
- `char.seoul.convenience_store.eunji` — overnight clerk, lead
- `char.seoul.convenience_store.hyunwoo` — snack reviewer, support
- `char.seoul.subway_hub.nari` — commuter mentor, lead
- `char.seoul.subway_hub.taemin` — busker commuter, support
- `char.seoul.practice_studio.yujin` — dance captain, lead
- `char.seoul.practice_studio.seungwoo` — producer trainee, support

### Tokyo
- `char.tokyo.subway_hub.akira` — rail guide, lead
- `char.tokyo.subway_hub.mei` — rush-hour illustrator, support
- `char.tokyo.food_street.rin` — izakaya server, lead
- `char.tokyo.food_street.daichi` — ramen regular, support
- `char.tokyo.convenience_store.yui` — konbini shift lead, lead
- `char.tokyo.convenience_store.kaito` — after-school gamer, support
- `char.tokyo.cafe.hina` — tea house host, lead
- `char.tokyo.cafe.ren` — calligrapher regular, support

### Shanghai
- `char.shanghai.subway_hub.lin` — metro navigator, lead
- `char.shanghai.subway_hub.wei` — delivery rider, support
- `char.shanghai.food_street.qiao` — BBQ vendor, lead
- `char.shanghai.food_street.ming` — dumpling scout, support
- `char.shanghai.convenience_store.an` — night cashier, lead
- `char.shanghai.convenience_store.yue` — study-group organizer, support
- `char.shanghai.cafe.jing` — milk-foam barista, lead
- `char.shanghai.cafe.hao` — tabletop sketch artist, support
- `char.shanghai.practice_studio.xinyi` — dance challenge streamer, lead
- `char.shanghai.practice_studio.zhen` — sound engineer, support

## Downstream issue guidance

- `#62` should cite this file and `assets/manifest/starter-cast-registry.json` as the approved Seoul roster/bundle source, and should explicitly call out the player-facing **Chimaek Place** label versus the internal `practice_studio` pin ID.
- `#63` should cite the same sources for Tokyo, especially the dual-pin reuse of the `food_street` slot pair across `izakaya` and `ramen_shop`.
- `#64` should cite the same sources for Shanghai, especially the `milk_tea_shop -> practice_studio` mapping and reward hooks for the advanced texting mission.
- Runtime-assets can treat the required asset keys in the registry as the coverage checklist for future manifest entries.
- Game-engine prompt packs can treat `voice.reference` as a required non-visual deliverable for every starter character before scene authoring is considered complete.
