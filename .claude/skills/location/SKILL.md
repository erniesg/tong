---
name: location
description: Add new cities or locations to the game map. Use when adding cities, configuring map pins, creating location content, or setting up vocabulary/objectives.
---

# Adding Cities & Locations

## Steps to Add a New City

### 1. Add to CityMap config
**File:** `apps/client/components/city-map/CityMap.tsx`

```typescript
// Add to CITY_ORDER array (controls swipe order)
const CITY_ORDER: CityId[] = ['tokyo', 'seoul', 'shanghai', 'NEW_CITY'];

// Add to CITY_META
const CITY_META = {
  new_city: { en: 'City Name', local: '本地名', hasVideo: false },
};

// Add locations with pin positions (% from top-left)
const CITY_LOCATIONS = {
  new_city: [
    { id: 'location_id', en: 'English Name', local: '本地名', top: '30%', left: '50%' },
  ],
};
```

### 2. Register CityId type
**File:** `apps/client/lib/api.ts` — Add to `CityId` union type.

### 3. Create location content
**File:** `apps/client/lib/content/locations.ts`

Minimal stub (AI generates content at runtime):
```typescript
const MY_LOCATION: Location = {
  id: 'location_id', cityId: 'new_city',
  name: { en: 'Name', ko: '이름' },
  domain: 'food', order: 0,
  ambientDescription: 'Scene description for AI context',
  backgroundImageUrl: '',
  vocabularyTargets: [], grammarTargets: [],
  levels: [{ levelNumber: 0, name: 'Script', description: '...', objectives: [], ... }],
};
registerLocation(MY_LOCATION);
```

For rich content, see `pojangmacha.ts` as the canonical reference (42 vocab items, 4 levels, full objectives).

### 4. Add language mapping
**File:** `apps/client/lib/content/locations.ts`

`getLanguageForCity()` maps cityId → 'ko' | 'ja' | 'zh'. Add your new city.

### 5. Add public assets
**Directory:** `apps/client/public/assets/locations/`

- `{cityId}-static.png` — Required. Fallback/poster image.
- `{cityId}.mp4` — Optional. Looping video background (enables dissolve loop). Set `hasVideo: true` in CITY_META.

### 6. Add city name mapping
**File:** `apps/client/app/game/page.tsx`

Add to `CITY_NAMES` and `LOCATION_NAMES` constants.

## Key Files

| File | Role |
|------|------|
| `components/city-map/CityMap.tsx` | CITY_ORDER, CITY_META, CITY_LOCATIONS, video dissolve |
| `components/city-map/LocationPin.tsx` | Map pin rendering with tooltips |
| `components/city-map/LocationSheet.tsx` | Bottom drawer (Learn/Hangout/Mission) |
| `lib/content/locations.ts` | Location registry + language mapping |
| `lib/content/pojangmacha.ts` | Reference: full location with 42 vocab items |
| `lib/content/scripts/hangul.ts` | Korean script design principles |
| `lib/content/scripts/pinyin.ts` | Chinese pinyin reference |
| `lib/content/scripts/kana.ts` | Japanese kana reference |
| `lib/types/objectives.ts` | Location, LocationLevel, LearningObjective types |

## Existing Cities

| City | CityId | Language | hasVideo | Locations |
|------|--------|----------|----------|-----------|
| Seoul | `seoul` | ko | yes | food_street, cafe, convenience_store, subway_hub, practice_studio |
| Shanghai | `shanghai` | zh | yes | metro_station, bbq_stall, convenience_store, milk_tea_shop, dumpling_shop |
| Tokyo | `tokyo` | ja | no | (none yet — Coming Soon) |
