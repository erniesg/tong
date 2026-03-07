import type { Location } from '../types/objectives';
import { POJANGMACHA } from './pojangmacha';

/**
 * Location registry mapping "cityId:locationId" → Location object.
 * Pojangmacha has full static content; other locations have stubs
 * with minimal vocab that the AI can expand at runtime.
 */
const LOCATION_REGISTRY: Record<string, Location> = {
  'seoul:food_street': POJANGMACHA,

  /* ── Seoul stub locations ─────────────────────────────────── */
  'seoul:cafe': {
    id: 'cafe',
    cityId: 'seoul',
    name: { en: 'Cafe', ko: '카페' },
    domain: 'cafe_culture',
    order: 1,
    backgroundImageUrl: '',
    ambientDescription: 'A cozy Korean café with iced Americanos and sweet bingsu.',
    levels: [
      {
        level: 0,
        name: 'Menu Reading',
        description: 'Read the café menu board',
        objectives: [],
        estimatedSessionMinutes: 10,
        assessmentCriteria: { minAccuracy: 0.6, minItemsCompleted: 3, requiredObjectives: [] },
      },
    ],
    vocabularyTargets: [],
    grammarTargets: [],
  },

  'seoul:convenience_store': {
    id: 'convenience_store',
    cityId: 'seoul',
    name: { en: 'Convenience Store', ko: '편의점' },
    domain: 'shopping',
    order: 2,
    backgroundImageUrl: '',
    ambientDescription: 'A bright 24-hour convenience store with triangle kimbap and instant ramen.',
    levels: [
      {
        level: 0,
        name: 'Snack Run',
        description: 'Buy snacks at the convenience store',
        objectives: [],
        estimatedSessionMinutes: 10,
        assessmentCriteria: { minAccuracy: 0.6, minItemsCompleted: 3, requiredObjectives: [] },
      },
    ],
    vocabularyTargets: [],
    grammarTargets: [],
  },

  'seoul:subway_hub': {
    id: 'subway_hub',
    cityId: 'seoul',
    name: { en: 'Subway Hub', ko: '지하철' },
    domain: 'transportation',
    order: 3,
    backgroundImageUrl: '',
    ambientDescription: 'A bustling Seoul subway station with LED signs and rushing commuters.',
    levels: [
      {
        level: 0,
        name: 'Finding the Line',
        description: 'Navigate the subway system',
        objectives: [],
        estimatedSessionMinutes: 10,
        assessmentCriteria: { minAccuracy: 0.6, minItemsCompleted: 3, requiredObjectives: [] },
      },
    ],
    vocabularyTargets: [],
    grammarTargets: [],
  },

  'seoul:practice_studio': {
    id: 'practice_studio',
    cityId: 'seoul',
    name: { en: 'Chimaek Place', ko: '치맥' },
    domain: 'social_dining',
    order: 4,
    backgroundImageUrl: '',
    ambientDescription: 'A lively Korean fried chicken and beer place with friends and K-pop on the TV.',
    levels: [
      {
        level: 0,
        name: 'Chicken Time',
        description: 'Order fried chicken and drinks with friends',
        objectives: [],
        estimatedSessionMinutes: 10,
        assessmentCriteria: { minAccuracy: 0.6, minItemsCompleted: 3, requiredObjectives: [] },
      },
    ],
    vocabularyTargets: [],
    grammarTargets: [],
  },

  /* ── Shanghai stub locations ──────────────────────────────── */
  'shanghai:metro_station': {
    id: 'metro_station',
    cityId: 'shanghai',
    name: { en: 'Metro Station', zh: '地铁站' },
    domain: 'transportation',
    order: 0,
    backgroundImageUrl: '',
    ambientDescription: 'A sleek Shanghai metro station with automated gates and bilingual signs.',
    levels: [
      {
        level: 0,
        name: 'Getting Around',
        description: 'Navigate the Shanghai metro',
        objectives: [],
        estimatedSessionMinutes: 10,
        assessmentCriteria: { minAccuracy: 0.6, minItemsCompleted: 3, requiredObjectives: [] },
      },
    ],
    vocabularyTargets: [],
    grammarTargets: [],
  },

  'shanghai:bbq_stall': {
    id: 'bbq_stall',
    cityId: 'shanghai',
    name: { en: 'BBQ Stall', zh: '烧烤摊' },
    domain: 'street_food',
    order: 1,
    backgroundImageUrl: '',
    ambientDescription: 'A smoky street-side BBQ stall with skewers and cold beer.',
    levels: [
      {
        level: 0,
        name: 'Skewer Ordering',
        description: 'Order BBQ skewers at the stall',
        objectives: [],
        estimatedSessionMinutes: 10,
        assessmentCriteria: { minAccuracy: 0.6, minItemsCompleted: 3, requiredObjectives: [] },
      },
    ],
    vocabularyTargets: [],
    grammarTargets: [],
  },

  'shanghai:convenience_store': {
    id: 'convenience_store',
    cityId: 'shanghai',
    name: { en: 'Convenience Store', zh: '便利店' },
    domain: 'shopping',
    order: 2,
    backgroundImageUrl: '',
    ambientDescription: 'A FamilyMart with tea eggs, onigiri, and QR code payments.',
    levels: [
      {
        level: 0,
        name: 'Quick Shopping',
        description: 'Buy everyday items at the convenience store',
        objectives: [],
        estimatedSessionMinutes: 10,
        assessmentCriteria: { minAccuracy: 0.6, minItemsCompleted: 3, requiredObjectives: [] },
      },
    ],
    vocabularyTargets: [],
    grammarTargets: [],
  },

  'shanghai:milk_tea_shop': {
    id: 'milk_tea_shop',
    cityId: 'shanghai',
    name: { en: 'Milk Tea Shop', zh: '奶茶店' },
    domain: 'cafe_culture',
    order: 3,
    backgroundImageUrl: '',
    ambientDescription: 'A trendy bubble tea shop with long lines and colourful menus.',
    levels: [
      {
        level: 0,
        name: 'Bubble Tea Order',
        description: 'Order customized milk tea',
        objectives: [],
        estimatedSessionMinutes: 10,
        assessmentCriteria: { minAccuracy: 0.6, minItemsCompleted: 3, requiredObjectives: [] },
      },
    ],
    vocabularyTargets: [],
    grammarTargets: [],
  },

  'shanghai:dumpling_shop': {
    id: 'dumpling_shop',
    cityId: 'shanghai',
    name: { en: 'Dumpling Shop', zh: '小笼包店' },
    domain: 'restaurant',
    order: 4,
    backgroundImageUrl: '',
    ambientDescription: 'A busy xiaolongbao restaurant with bamboo steamers stacked high.',
    levels: [
      {
        level: 0,
        name: 'Dumpling Feast',
        description: 'Order dumplings at a traditional restaurant',
        objectives: [],
        estimatedSessionMinutes: 10,
        assessmentCriteria: { minAccuracy: 0.6, minItemsCompleted: 3, requiredObjectives: [] },
      },
    ],
    vocabularyTargets: [],
    grammarTargets: [],
  },

  /* ── Tokyo stub locations ───────────────────────────────── */
  'tokyo:train_station': {
    id: 'train_station',
    cityId: 'tokyo',
    name: { en: 'Train Station', ja: '駅' },
    domain: 'transportation',
    order: 0,
    backgroundImageUrl: '',
    ambientDescription: 'A bustling Tokyo train station with electronic departure boards and the melody of arriving trains.',
    levels: [
      {
        level: 0,
        name: 'Reading Signs',
        description: 'Navigate the train station',
        objectives: [],
        estimatedSessionMinutes: 10,
        assessmentCriteria: { minAccuracy: 0.6, minItemsCompleted: 3, requiredObjectives: [] },
      },
    ],
    vocabularyTargets: [],
    grammarTargets: [],
  },

  'tokyo:izakaya': {
    id: 'izakaya',
    cityId: 'tokyo',
    name: { en: 'Izakaya', ja: '居酒屋' },
    domain: 'dining',
    order: 1,
    backgroundImageUrl: '',
    ambientDescription: 'A warm izakaya with paper lanterns, wooden counters, and the sound of clinking glasses.',
    levels: [
      {
        level: 0,
        name: 'First Round',
        description: 'Order food and drinks at an izakaya',
        objectives: [],
        estimatedSessionMinutes: 10,
        assessmentCriteria: { minAccuracy: 0.6, minItemsCompleted: 3, requiredObjectives: [] },
      },
    ],
    vocabularyTargets: [],
    grammarTargets: [],
  },

  'tokyo:konbini': {
    id: 'konbini',
    cityId: 'tokyo',
    name: { en: 'Convenience Store', ja: 'コンビニ' },
    domain: 'shopping',
    order: 2,
    backgroundImageUrl: '',
    ambientDescription: 'A brightly lit konbini with onigiri, bento, and the chime of the automatic door.',
    levels: [
      {
        level: 0,
        name: 'Quick Stop',
        description: 'Buy snacks at the konbini',
        objectives: [],
        estimatedSessionMinutes: 10,
        assessmentCriteria: { minAccuracy: 0.6, minItemsCompleted: 3, requiredObjectives: [] },
      },
    ],
    vocabularyTargets: [],
    grammarTargets: [],
  },

  'tokyo:tea_house': {
    id: 'tea_house',
    cityId: 'tokyo',
    name: { en: 'Tea House', ja: '茶屋' },
    domain: 'cafe_culture',
    order: 3,
    backgroundImageUrl: '',
    ambientDescription: 'A quiet traditional tea house with tatami mats, matcha, and wagashi sweets.',
    levels: [
      {
        level: 0,
        name: 'Tea Ceremony',
        description: 'Experience a Japanese tea house',
        objectives: [],
        estimatedSessionMinutes: 10,
        assessmentCriteria: { minAccuracy: 0.6, minItemsCompleted: 3, requiredObjectives: [] },
      },
    ],
    vocabularyTargets: [],
    grammarTargets: [],
  },

  'tokyo:ramen_shop': {
    id: 'ramen_shop',
    cityId: 'tokyo',
    name: { en: 'Ramen Shop', ja: 'ラーメン屋' },
    domain: 'food',
    order: 4,
    backgroundImageUrl: '',
    ambientDescription: 'A tiny ramen counter with steaming bowls, a ticket machine, and the slurping of noodles.',
    levels: [
      {
        level: 0,
        name: 'Ticket Machine',
        description: 'Order ramen from the vending machine',
        objectives: [],
        estimatedSessionMinutes: 10,
        assessmentCriteria: { minAccuracy: 0.6, minItemsCompleted: 3, requiredObjectives: [] },
      },
    ],
    vocabularyTargets: [],
    grammarTargets: [],
  },
};

/** Get a location by city and location ID. Returns null if not found. */
export function getLocation(
  cityId: string,
  locationId: string,
): Location | null {
  return LOCATION_REGISTRY[`${cityId}:${locationId}`] ?? null;
}

/** Get a location or fall back to POJANGMACHA. */
export function getLocationOrDefault(
  cityId: string,
  locationId: string,
): Location {
  return LOCATION_REGISTRY[`${cityId}:${locationId}`] ?? POJANGMACHA;
}

/** Register a location in the registry. */
export function registerLocation(
  cityId: string,
  locationId: string,
  location: Location,
): void {
  LOCATION_REGISTRY[`${cityId}:${locationId}`] = location;
}

/** Get all registered location keys. */
export function getRegisteredLocationKeys(): string[] {
  return Object.keys(LOCATION_REGISTRY);
}

/** Map city to its target language. */
export function getLanguageForCity(cityId: string): 'ko' | 'zh' | 'ja' {
  switch (cityId) {
    case 'shanghai': return 'zh';
    case 'tokyo': return 'ja';
    default: return 'ko';
  }
}

/** Get vocabulary items from a location as VocabItem-shaped objects. */
export function getLocationVocab(
  cityId: string,
  locationId: string,
): Array<{ word: string; translation: string; romanization: string }> {
  const loc = getLocation(cityId, locationId);
  if (!loc) return [];
  return loc.vocabularyTargets.map((v) => ({
    word: v.word,
    translation: v.translation,
    romanization: v.romanization,
  }));
}
