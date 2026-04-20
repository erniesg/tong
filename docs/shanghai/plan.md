# Shanghai Content Plan

## Issue 2.1 — Shanghai location + vocabulary

Status: delivered in issue `#190`.

### Scope

- Add a Shanghai location module at `apps/client/lib/content/shanghai/location.ts`.
- Register `shanghai:xiaolongbao` in `apps/client/lib/content/locations.ts`.
- Add a city registry entry for Shanghai in `apps/client/lib/content/cities.ts`.

### Curriculum coverage

- **L0 (script):** 方, 案, 不, 一, 样, 愿, 意, 装, 小, 笼, 包.
- **L1 (pronunciation):** tone-pair work for `方案` and `愿意`; minimal-pair drill for `装/跑`.
- **L2 (vocabulary):** 方案, 愿意, 装, 不一样, 小笼包, 蟹壳黄, 阿姨, 灵, 本事, 接, 重要.
- **L3 (grammar):** 不会 vs 不愿意, formal/informal 你 register, `~了`, and `~不下去`.

### Notes

- Backdrop path now points at runtime key `city.shanghai.location.dumpling-shop.backdrop.default`.
- Runtime asset upload/tracking is handled in the runtime-assets stream (Epic 3 dependency).
