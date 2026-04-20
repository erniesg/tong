# Shanghai Plan

## Issue 2.1 — Shanghai location + vocabulary

Implemented content contract for `erniesg/tong#190`:

- Added `shanghai:xiaolongbao` location with complete L0–L3 objectives.
- Added Shanghai city registry entry with `xiaolongbao` default location.
- Added vocabulary and grammar targets required by the issue scope.

### Curriculum mapping

- **L0 script:** 方, 案, 不, 一, 样, 愿, 意, 装, 小, 笼, 包
- **L1 pronunciation:** 方案 (`fāng'àn`), 愿意 (`yuànyì`), minimal pair 装/跑
- **L2 vocabulary:** 方案, 愿意, 装, 不一样, 小笼包, 蟹壳黄, 阿姨, 侬, 本事, 接, 重要
- **L3 grammar:** 不会 vs 不愿意, 你 formal/informal, ~了 aspect, ~不下去 potential complement

### Acceptance checklist

- [x] `getLocationOrDefault("shanghai:xiaolongbao")` resolves to populated location.
- [x] Shanghai is present in city registry.
- [x] Every level has objective IDs and matching required objective references.
- [x] Backdrop asset path populated (`city.shanghai.location.dumpling-shop.backdrop.default`).
