import fixtures from '../../../../packages/contracts/fixtures/learn.scripted-scenes.sample.json';
import seoulFoodStreetStarter from '../../../../assets/content-packs/seoul-food-street.starter.json';
import tokyoTeaHouseStarter from '../../../../assets/content-packs/tokyo-tea-house.starter.json';
import shanghaiMilkTeaStarter from '../../../../assets/content-packs/shanghai-milk-tea-shop.starter.json';
import type {
  GraphCityId,
  ScriptedMessagingScene,
  ScriptedMessagingTranslationMode,
} from '../../../../packages/contracts';

export const PROMO_CITY_ORDER: GraphCityId[] = ['seoul', 'tokyo', 'shanghai'];

export const PROMO_MODE_ORDER: ScriptedMessagingTranslationMode[] = [
  'primary_only',
  'primary_with_english',
  'primary_local_explanation_with_english',
];

export const PROMO_ROUTE_FIXTURES = {
  seoul_default: {
    city: 'seoul',
    mode: 'primary_only',
    sceneId: 'promo.seoul.kakao.food_street.night-bite-001',
    hook: 'off',
    autoplay: '1',
    tickMs: '100',
  },
  tokyo_bilingual: {
    city: 'tokyo',
    mode: 'primary_with_english',
    sceneId: 'promo.tokyo.line.tea_house.meetup-001',
    hook: 'off',
    autoplay: '1',
    tickMs: '100',
  },
  shanghai_bilingual: {
    city: 'shanghai',
    mode: 'primary_with_english',
    sceneId: 'promo.shanghai.wechat.milk_tea.mission-001',
    hook: 'off',
    autoplay: '1',
    tickMs: '100',
  },
} as const;

export type PromoFixtureId = keyof typeof PROMO_ROUTE_FIXTURES;

const SCENES = fixtures.scenes as ScriptedMessagingScene[];

type StarterPackWithScenes = {
  city: GraphCityId;
  scriptedMessagingScenes?: ScriptedMessagingScene[];
};

function starterPackScenes(pack: StarterPackWithScenes): ScriptedMessagingScene[] {
  const scenes = pack.scriptedMessagingScenes ?? [];
  return scenes.filter((scene) => scene.cityId === pack.city);
}

const STARTER_PACK_SCENES = [
  ...starterPackScenes(seoulFoodStreetStarter as StarterPackWithScenes),
  ...starterPackScenes(tokyoTeaHouseStarter as StarterPackWithScenes),
  ...starterPackScenes(shanghaiMilkTeaStarter as StarterPackWithScenes),
] as ScriptedMessagingScene[];

const PROMO_SCENES = STARTER_PACK_SCENES.length > 0 ? STARTER_PACK_SCENES : SCENES;

function toCity(value: string | null): GraphCityId | null {
  if (!value) return null;
  return PROMO_CITY_ORDER.includes(value as GraphCityId) ? (value as GraphCityId) : null;
}

function toMode(value: string | null): ScriptedMessagingTranslationMode | null {
  if (!value) return null;
  return PROMO_MODE_ORDER.includes(value as ScriptedMessagingTranslationMode)
    ? (value as ScriptedMessagingTranslationMode)
    : null;
}

export function resolvePromoScene(params: URLSearchParams) {
  const fixtureId = params.get('fixture') as PromoFixtureId | null;
  const fixture = fixtureId ? PROMO_ROUTE_FIXTURES[fixtureId] : null;

  const city = toCity(params.get('city')) ?? (fixture?.city as GraphCityId | undefined) ?? 'seoul';
  const mode = toMode(params.get('mode')) ?? (fixture?.mode as ScriptedMessagingTranslationMode | undefined) ?? 'primary_only';
  const sceneId = params.get('scene') ?? fixture?.sceneId ?? null;
  const hookParam = params.get('hook') ?? fixture?.hook ?? 'off';
  const autoplayParam = params.get('autoplay') ?? fixture?.autoplay ?? '0';
  const tickMsRaw = Number(params.get('tickMs') ?? fixture?.tickMs ?? '100');

  const scenesForCity = PROMO_SCENES.filter((scene) => scene.cityId === city);
  const selectedScene = scenesForCity.find((scene) => scene.sceneId === sceneId) ?? scenesForCity[0] ?? PROMO_SCENES[0];

  const hookMode: 'overlay' | 'inline' | 'off' = hookParam === 'overlay' ? 'overlay' : hookParam === 'inline' ? 'inline' : 'off';

  return {
    city,
    mode,
    selectedScene,
    scenesForCity,
    hookMode,
    showHookOverlay: hookMode === 'overlay',
    autoplay: autoplayParam === '1',
    tickMs: Number.isFinite(tickMsRaw) && tickMsRaw > 0 ? Math.min(Math.max(Math.round(tickMsRaw), 40), 400) : 100,
    fixtureId,
  };
}

export function buildPromoQuery(next: {
  city: GraphCityId;
  mode: ScriptedMessagingTranslationMode;
  scene: string;
  autoplay?: boolean;
  hook?: 'overlay' | 'inline' | 'off';
  tickMs?: number;
}) {
  const params = new URLSearchParams();
  params.set('city', next.city);
  params.set('mode', next.mode);
  params.set('scene', next.scene);
  params.set('autoplay', next.autoplay ? '1' : '0');
  params.set('hook', next.hook ?? 'off');
  if (next.tickMs) params.set('tickMs', String(next.tickMs));
  return params.toString();
}
