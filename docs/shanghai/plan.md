# Shanghai Content Plan

## Issue 2.1 — Shanghai location + vocabulary

Status: implemented in `apps/client/lib/content/shanghai/location.ts` and wired in the location + city registries.

### Scope

- Add Shanghai curriculum location `shanghai:xiaolongbao` (`小笼包店`) with full L0–L3 content.
- Keep backward compatibility with existing `shanghai:dumpling_shop` references by aliasing both keys to the same location object.
- Register Shanghai in a dedicated city registry.

### Curriculum targets

- **L0 (script):** 方, 案, 不, 一, 样, 愿, 意, 装, 小, 笼, 包
- **L1 (pronunciation):** tone pairs (`方案 fāng'àn`, `愿意 yuànyì`) and `装/跑` minimal-pair drills
- **L2 (vocabulary):** 方案, 愿意, 装, 不一样, 小笼包, 蟹壳黄, 阿姨, 犟, 本事, 接, 重要
- **L3 (grammar):** 不会 vs 不愿意, formal/informal 你/您, 了 aspect, ~不下去 potential complement

### Acceptance checks

- `getLocationOrDefault('shanghai:xiaolongbao')` resolves to a populated location.
- Shanghai is listed in `CITY_REGISTRY`.
- L0–L3 objectives include stable IDs suitable for mastery tracking.
- Backdrop asset path is populated via runtime asset key.
