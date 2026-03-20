'use client';

import { useEffect, useRef, useState } from 'react';
import {
  fetchObjectiveNext,
  respondHangout,
  startHangout,
  startOrResumeGame,
  type CityId,
  type LocationId,
  type ObjectiveNextResponse,
  type ProficiencyLevel,
  type ScoreState,
} from '@/lib/api';
import {
  hasRuntimeAssetKey,
  resolveCharacterAssetUrl,
  resolveRuntimeAssetUrl,
  resolveRuntimeAssetUrls,
  runtimeAssetUrl,
} from '@/lib/runtime-assets';

/* ── Inline types — not exported from api.ts ──────────────── */
interface GameProfile {
  nativeLanguage: string;
  targetLanguages: string[];
  proficiency: Record<string, ProficiencyLevel>;
}

interface HangoutRenderOp {
  tool: string;
  text?: string;
  speakerName?: string;
  choices?: string[];
  [key: string]: unknown;
}

interface ObjectiveProgressState {
  percent?: number;
  current?: number;
  target?: number;
}

interface ProgressLoopState {
  masteryTier: number;
  learnReadiness: number;
  missionGate: {
    status: string;
    validatedHangouts: number;
    requiredValidatedHangouts: number;
  };
}

interface RelationshipState {
  stage?: string;
  [key: string]: unknown;
}

interface RouteState {
  stage?: string;
  [key: string]: unknown;
}

interface SceneCharacter {
  name?: string;
  id?: string;
  role?: string;
  avatarEmoji?: string;
  mood?: string;
  assetKey?: string;
  [key: string]: unknown;
}

interface SceneLine {
  speaker: 'character' | 'you' | 'tong' | 'narrator';
  text: string;
  speakerName?: string;
  expression?: string;
}
import { SceneView } from '@/components/scene/SceneView';

interface DialogueChoice {
  id: string;
  text: string;
}
import { LearnPanel } from '@/components/learn/LearnPanel';

type CjkLang = 'ko' | 'ja' | 'zh';
type EntryPhase = 'opening' | 'entry' | 'tong-intro' | 'onboarding' | 'playing';
type ProficiencyGaugeLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type MapPosition = 'left' | 'center' | 'right';

interface PresetResponse {
  text: string;
  note?: string;
}

interface ActiveResumeCard {
  sessionId: string;
  city: CityId;
  location: LocationId;
  objectiveId: string | null;
  checkpointId: string | null;
  bond: string;
  npcName: string | null;
}

interface CityDefinition {
  id: CityId;
  label: string;
  language: CjkLang;
  languageLabel: string;
  mapPosition: MapPosition;
  vibe: string;
  backdropImage: string;
  backdropVideo?: string;
}

interface GamePageClientProps {
  initialEntryPhase?: EntryPhase;
  autoNewGame?: boolean;
  autoLaunchHangout?: boolean;
}

const DEFAULT_CITY: CityId = 'seoul';
const DEFAULT_LOCATION: LocationId = 'food_street';
const ACTIVE_USER_ID_STORAGE_KEY = 'tong_active_user_id';

const GAME_LOGO_PATH = runtimeAssetUrl('app.logo.transparent.default');
const TONG_INTRO_PATH = runtimeAssetUrl('app.intro.video.default');
const OPENING_ANIMATION_PATH = TONG_INTRO_PATH;
const SEOUL_FIRST_SCENE_BACKDROP = runtimeAssetUrl('city.seoul.location.food-street.backdrop.default');

const MAX_PROFICIENCY_GAUGE_LEVEL: ProficiencyGaugeLevel = 6;
const REQUESTED_GAUGE_PRESET: Record<CjkLang, ProficiencyGaugeLevel> = {
  ko: 0,
  ja: 0,
  zh: 5,
};

const CITY_DEFINITIONS: CityDefinition[] = [
  {
    id: 'tokyo',
    label: 'Tokyo',
    language: 'ja',
    languageLabel: 'Japanese',
    mapPosition: 'left',
    vibe: 'Shibuya after-hours energy',
    backdropImage: runtimeAssetUrl('city.tokyo.map.static.default'),
    backdropVideo: runtimeAssetUrl('city.tokyo.map.video.default'),
  },
  {
    id: 'seoul',
    label: 'Seoul',
    language: 'ko',
    languageLabel: 'Korean',
    mapPosition: 'center',
    vibe: 'Hongdae late-night food lane',
    backdropImage: runtimeAssetUrl('city.seoul.map.static.default'),
    backdropVideo: runtimeAssetUrl('city.seoul.map.video.default'),
  },
  {
    id: 'shanghai',
    label: 'Shanghai',
    language: 'zh',
    languageLabel: 'Chinese',
    mapPosition: 'right',
    vibe: 'Bund neon and river glow',
    backdropImage: runtimeAssetUrl('city.shanghai.map.static.default'),
    backdropVideo: runtimeAssetUrl('city.shanghai.map.video.default'),
  },
];

const CITY_BY_ID = CITY_DEFINITIONS.reduce<Record<CityId, CityDefinition>>((acc, city) => {
  acc[city.id] = city;
  return acc;
}, {} as Record<CityId, CityDefinition>);

const CJK_LANG_ORDER: CjkLang[] = ['ja', 'ko', 'zh'];

const LANGUAGE_LABELS: Record<CjkLang, string> = {
  ko: 'Korean',
  ja: 'Japanese',
  zh: 'Chinese',
};

const LOCATION_LABELS: Record<LocationId, string> = {
  food_street: 'Food Street',
  cafe: 'Cafe',
  convenience_store: 'Convenience Store',
  subway_hub: 'Subway Hub',
  practice_studio: 'Practice Studio',
  metro_station: 'Metro Station',
  bbq_stall: 'BBQ Stall',
  milk_tea_shop: 'Milk Tea Shop',
  dumpling_shop: 'Dumpling Shop',
  train_station: 'Train Station',
  izakaya: 'Izakaya',
  konbini: 'Convenience Store',
  tea_house: 'Tea House',
  ramen_shop: 'Ramen Shop',
};

const LOCATIONS: LocationId[] = [
  'food_street',
  'cafe',
  'convenience_store',
  'subway_hub',
  'practice_studio',
];

const LOCATION_CHARACTERS_BY_CITY: Record<CityId, Record<LocationId, SceneCharacter>> = {
  seoul: {
    food_street: { name: 'Haeun', role: 'Primary romance route lead', avatarEmoji: 'HR', mood: 'warm' },
    cafe: { name: 'Jin', role: 'Primary romance route lead', avatarEmoji: 'JN', mood: 'charming' },
    convenience_store: { name: 'Min', role: 'Store clerk', avatarEmoji: 'CV', mood: 'helpful' },
    subway_hub: { name: 'Haneul', role: 'Commuter guide', avatarEmoji: 'SB', mood: 'focused' },
    practice_studio: { name: 'Ara', role: 'Practice partner', avatarEmoji: 'PS', mood: 'energetic' },
    metro_station: { name: 'Haneul', role: 'Commuter guide', avatarEmoji: 'SB', mood: 'focused' },
    bbq_stall: { name: 'Ara', role: 'Grill vendor', avatarEmoji: 'BB', mood: 'lively' },
    milk_tea_shop: { name: 'Jin', role: 'Tea connoisseur', avatarEmoji: 'MT', mood: 'chill' },
    dumpling_shop: { name: 'Min', role: 'Dumpling chef', avatarEmoji: 'DM', mood: 'proud' },
    train_station: { name: 'Haneul', role: 'Commuter guide', avatarEmoji: 'SB', mood: 'focused' },
    izakaya: { name: 'Haeun', role: 'Evening companion', avatarEmoji: 'HR', mood: 'warm' },
    konbini: { name: 'Min', role: 'Store clerk', avatarEmoji: 'CV', mood: 'helpful' },
    tea_house: { name: 'Jin', role: 'Tea connoisseur', avatarEmoji: 'JN', mood: 'charming' },
    ramen_shop: { name: 'Ara', role: 'Ramen enthusiast', avatarEmoji: 'PS', mood: 'energetic' },
  },
  tokyo: {
    food_street: { name: 'Haeun', role: 'Primary romance route lead', avatarEmoji: 'HR', mood: 'warm' },
    cafe: { name: 'Jin', role: 'Primary romance route lead', avatarEmoji: 'JN', mood: 'charming' },
    convenience_store: { name: 'Sora', role: 'Store clerk', avatarEmoji: 'CV', mood: 'helpful' },
    subway_hub: { name: 'Daichi', role: 'Commuter guide', avatarEmoji: 'SB', mood: 'focused' },
    practice_studio: { name: 'Mika', role: 'Practice partner', avatarEmoji: 'PS', mood: 'energetic' },
    metro_station: { name: 'Daichi', role: 'Commuter guide', avatarEmoji: 'SB', mood: 'focused' },
    bbq_stall: { name: 'Kenji', role: 'Grill master', avatarEmoji: 'BB', mood: 'lively' },
    milk_tea_shop: { name: 'Yui', role: 'Tea server', avatarEmoji: 'MT', mood: 'sweet' },
    dumpling_shop: { name: 'Takeshi', role: 'Gyoza vendor', avatarEmoji: 'DM', mood: 'cheerful' },
    train_station: { name: 'Daichi', role: 'Station guide', avatarEmoji: 'SB', mood: 'focused' },
    izakaya: { name: 'Kenji', role: 'Izakaya regular', avatarEmoji: 'IZ', mood: 'lively' },
    konbini: { name: 'Sora', role: 'Konbini clerk', avatarEmoji: 'CV', mood: 'helpful' },
    tea_house: { name: 'Yui', role: 'Tea ceremony host', avatarEmoji: 'TH', mood: 'serene' },
    ramen_shop: { name: 'Takeshi', role: 'Ramen chef', avatarEmoji: 'RM', mood: 'passionate' },
  },
  shanghai: {
    food_street: { name: 'Mei', role: 'Street food guide', avatarEmoji: 'FS', mood: 'warm' },
    cafe: { name: 'Lian', role: 'Cafe regular', avatarEmoji: 'CF', mood: 'charming' },
    convenience_store: { name: 'Bo', role: 'Store clerk', avatarEmoji: 'CV', mood: 'helpful' },
    subway_hub: { name: 'Wei', role: 'Commuter guide', avatarEmoji: 'SB', mood: 'focused' },
    practice_studio: { name: 'Qin', role: 'Practice partner', avatarEmoji: 'PS', mood: 'energetic' },
    metro_station: { name: 'Wei', role: 'Commuter guide', avatarEmoji: 'MT', mood: 'focused' },
    bbq_stall: { name: 'Da Peng', role: 'BBQ vendor', avatarEmoji: 'BB', mood: 'boisterous' },
    milk_tea_shop: { name: 'Lian', role: 'Tea enthusiast', avatarEmoji: 'NC', mood: 'bubbly' },
    dumpling_shop: { name: 'Mei', role: 'Dumpling auntie', avatarEmoji: 'XL', mood: 'warm' },
    train_station: { name: 'Wei', role: 'Commuter guide', avatarEmoji: 'SB', mood: 'focused' },
    izakaya: { name: 'Da Peng', role: 'Evening host', avatarEmoji: 'BB', mood: 'boisterous' },
    konbini: { name: 'Bo', role: 'Store clerk', avatarEmoji: 'CV', mood: 'helpful' },
    tea_house: { name: 'Lian', role: 'Tea house regular', avatarEmoji: 'CF', mood: 'charming' },
    ramen_shop: { name: 'Mei', role: 'Noodle vendor', avatarEmoji: 'FS', mood: 'warm' },
  },
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getObjectiveRatio(progress?: ObjectiveProgressState): number | null {
  if (!progress) return null;
  if (typeof progress.percent === 'number') {
    return clamp01(progress.percent > 1 ? progress.percent / 100 : progress.percent);
  }
  if (typeof progress.current === 'number' && typeof progress.target === 'number' && progress.target > 0) {
    return clamp01(progress.current / progress.target);
  }
  return null;
}

function normalizeGaugeLevel(value: number): ProficiencyGaugeLevel {
  return Math.max(0, Math.min(MAX_PROFICIENCY_GAUGE_LEVEL, Math.round(value))) as ProficiencyGaugeLevel;
}

function gaugeLevelToProficiency(level: ProficiencyGaugeLevel): ProficiencyLevel {
  if (level <= 0) return 'none';
  if (level <= 2) return 'beginner';
  if (level <= 4) return 'intermediate';
  if (level === 5) return 'advanced';
  return 'native';
}

function proficiencyLabel(level: ProficiencyLevel): string {
  if (level === 'none') return 'None';
  if (level === 'beginner') return 'Beginner';
  if (level === 'intermediate') return 'Intermediate';
  if (level === 'advanced') return 'Advanced';
  return 'Native';
}

function proficiencySubtitle(level: ProficiencyLevel): string {
  if (level === 'none') return 'Starting from zero';
  if (level === 'beginner') return 'Basic words and short patterns';
  if (level === 'intermediate') return 'Comfortable with short conversations';
  if (level === 'advanced') return 'Handle nuanced social talk';
  return 'Near-native comfort';
}

function buildProfileFromGauge(gauge: Record<CjkLang, ProficiencyGaugeLevel>): GameProfile {
  return {
    nativeLanguage: 'en',
    targetLanguages: ['ko', 'ja', 'zh'],
    proficiency: {
      ko: gaugeLevelToProficiency(gauge.ko),
      ja: gaugeLevelToProficiency(gauge.ja),
      zh: gaugeLevelToProficiency(gauge.zh),
    },
  };
}

function mergeCharacterPayload(base: SceneCharacter, payload?: SceneCharacter): SceneCharacter {
  if (!payload) return base;
  return {
    ...base,
    ...payload,
    avatarEmoji: payload.avatarEmoji || base.avatarEmoji,
  };
}

/** Default sprite per character — uses descriptive filename so we know exactly what's showing */
const CHARACTER_DEFAULT_SPRITE: Record<string, string> = {
  haeun: 'eye_front_casual.png',
  jin: 'eye_front_casual.png',
};

/**
 * Expression → sprite mapping. Populate as we generate more poses.
 * Unmapped expressions fall back to the default sprite above.
 */
const EXPRESSION_SPRITES: Record<string, Partial<Record<string, string>>> = {
  haeun: {
    // TODO: generate dedicated expression poses using reference images
    // angry: 'eye_front_casual_grimace.png',
    // surprised: 'eye_right_bare_teeth.png',
  },
  jin: {
    // TODO: generate dedicated expression poses using reference images
    // angry: 'eye_front_bare_grimace.png',
    // surprised: 'eye_right_bare_teeth.png',
  },
};

function getCharacterSpriteUrl(value?: SceneCharacter, expression?: string): string | null {
  if (!value) return null;
  const safeName = (value.name || '').toLowerCase().trim();
  const safeId = (value.id || '').toLowerCase().trim();

  let charKey: string | null = null;
  if (safeId === 'npc_haeun' || safeName === 'haeun') charKey = 'haeun';
  if (safeId === 'npc_jin' || safeId === 'npc_ding_man' || safeName === 'jin' || safeName === 'ding') charKey = 'jin';

  if (charKey) {
    const exprFile = expression && EXPRESSION_SPRITES[charKey]?.[expression];
    const file = exprFile || CHARACTER_DEFAULT_SPRITE[charKey] || `${charKey}.png`;
    return resolveCharacterAssetUrl(`${charKey}/${file}`);
  }

  if (value.assetKey) {
    if (hasRuntimeAssetKey(value.assetKey)) return runtimeAssetUrl(value.assetKey);
    return resolveCharacterAssetUrl(value.assetKey);
  }
  return null;
}

function getCharacterAvatarPaths(value?: SceneCharacter): string[] {
  if (!value) return [];
  const options: string[] = [];

  const safeName = (value.name || '').toLowerCase().trim();
  const safeId = (value.id || '').toLowerCase().trim();

  if (safeId === 'npc_haeun' || safeName === 'haeun') {
    options.push(runtimeAssetUrl('character.haeun.portrait.eye-front-casual'));
    options.push(runtimeAssetUrl('character.haeun.portrait.default'));
  }

  if (safeId === 'npc_jin' || safeId === 'npc_ding_man' || safeName === 'jin' || safeName === 'ding') {
    options.push(runtimeAssetUrl('character.jin.portrait.eye-front-casual'));
    options.push(runtimeAssetUrl('character.jin.portrait.default'));
    options.push(runtimeAssetUrl('character.ding-man.portrait.default'));
  }

  if (value.assetKey) {
    if (hasRuntimeAssetKey(value.assetKey)) {
      options.push(runtimeAssetUrl(value.assetKey));
    } else {
      options.push(resolveCharacterAssetUrl(value.assetKey));
    }
  }

  return resolveRuntimeAssetUrls(options);
}

function getCharacterForCityLocation(city: CityId, location: LocationId): SceneCharacter {
  return LOCATION_CHARACTERS_BY_CITY[city]?.[location] || LOCATION_CHARACTERS_BY_CITY[DEFAULT_CITY][DEFAULT_LOCATION];
}

function createSessionUserId(): string {
  return `user_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

function isDialogueLine(line: SceneLine): line is SceneLine & { speaker: 'character' | 'you' } {
  return (line.speaker === 'character' || line.speaker === 'you') && Boolean(line.text.trim());
}

export default function GamePageClient({
  initialEntryPhase = 'opening',
  autoNewGame = false,
  autoLaunchHangout = false,
}: GamePageClientProps) {
  const openingVideoRef = useRef<HTMLVideoElement | null>(null);
  const startupHandledRef = useRef(false);

  const [entryPhase, setEntryPhase] = useState<EntryPhase>(initialEntryPhase);
  const [bootstrapComplete, setBootstrapComplete] = useState(false);

  const [activeUserId, setActiveUserId] = useState(() => createSessionUserId());
  const [hasSavedUserId, setHasSavedUserId] = useState(false);

  const [mode, setMode] = useState<'hangout' | 'learn'>('hangout');
  const [showWorldPanel, setShowWorldPanel] = useState(false);

  const [city, setCity] = useState<CityId>(DEFAULT_CITY);
  const [location, setLocation] = useState<LocationId>(DEFAULT_LOCATION);
  const [worldCity, setWorldCity] = useState<CityId>(DEFAULT_CITY);
  const [worldLocation, setWorldLocation] = useState<LocationId>(DEFAULT_LOCATION);
  const [proficiencyGauge, setProficiencyGauge] = useState<Record<CjkLang, ProficiencyGaugeLevel>>({
    ...REQUESTED_GAUGE_PRESET,
  });

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sceneSessionId, setSceneSessionId] = useState<string | null>(null);
  const [objective, setObjective] = useState<ObjectiveNextResponse | null>(null);
  const [objectiveRatio, setObjectiveRatio] = useState(0);

  const [score, setScore] = useState<ScoreState>({ xp: 0, sp: 0, rp: 0 });
  const [relationshipState, setRelationshipState] = useState<RelationshipState | null>(null);
  const [routeState, setRouteState] = useState<RouteState | null>(null);
  const [progressionLoop, setProgressionLoop] = useState<ProgressLoopState | null>(null);
  const [engineMode, setEngineMode] = useState<'dynamic_ai' | 'scripted_fallback'>('scripted_fallback');
  const [activeResumeCard, setActiveResumeCard] = useState<ActiveResumeCard | null>(null);

  const [character, setCharacter] = useState<SceneCharacter>(getCharacterForCityLocation(DEFAULT_CITY, DEFAULT_LOCATION));

  const [status, setStatus] = useState(
    initialEntryPhase === 'onboarding'
      ? 'Set your language baseline, then start your first hangout challenge.'
      : 'Start a new game to begin your first hangout.',
  );
  const [error, setError] = useState<string | null>(null);

  const [sceneLines, setSceneLines] = useState<SceneLine[]>([]);
  const [sceneLineIndex, setSceneLineIndex] = useState(0);
  const [awaitingUserTurn, setAwaitingUserTurn] = useState(false);
  const [pendingUserLine, setPendingUserLine] = useState<string | null>(null);
  const [lastNpcLine, setLastNpcLine] = useState<string | null>(null);
  const [typedDialogueText, setTypedDialogueText] = useState('');
  const [dialogueTypeDone, setDialogueTypeDone] = useState(true);

  const [tongHint, setTongHint] = useState<string | null>(null);
  const [presetResponses, setPresetResponses] = useState<PresetResponse[]>([]);
  const [userUtterance, setUserUtterance] = useState('');

  const [loadingStart, setLoadingStart] = useState(initialEntryPhase === 'playing' && autoLaunchHangout);
  const [sendingTurn, setSendingTurn] = useState(false);
  // Learn state removed — now handled by LearnPanel
  const [needsIntroTap, setNeedsIntroTap] = useState(false);

  // learnSessions + learnMessage removed — now handled by LearnPanel

  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [avatarPathIndex, setAvatarPathIndex] = useState(0);

  const cityConfig = CITY_BY_ID[city];
  const worldCityConfig = CITY_BY_ID[worldCity];
  const selectedLang = cityConfig.language;

  const characterAvatarOptions = getCharacterAvatarPaths(character);
  const characterAvatarSrc = characterAvatarOptions[avatarPathIndex] || null;

  const activeSceneLine = pendingUserLine ? null : sceneLines[sceneLineIndex] || null;
  const currentExpression = activeSceneLine?.expression;
  const expressionSpriteUrl = getCharacterSpriteUrl(character, currentExpression);
  const isUserTurn = awaitingUserTurn && Boolean(sceneSessionId) && !sendingTurn;

  const activeSpeakerLabel = pendingUserLine
    ? 'You'
    : activeSceneLine
      ? activeSceneLine.speaker === 'tong'
        ? 'Tong'
        : activeSceneLine.speaker === 'you'
          ? 'You'
          : activeSceneLine.speakerName || character.name || `${cityConfig.label} partner`
      : character.name || `${cityConfig.label} partner`;

  const activeDialogueText = pendingUserLine
    ? pendingUserLine
    : activeSceneLine?.text
      ? activeSceneLine.text
      : isUserTurn
        ? lastNpcLine || ''
        : loadingStart
          ? 'Launching hangout...'
          : '';

  const canTapContinue = Boolean(activeSceneLine) && !sendingTurn && !pendingUserLine;
  const canAnswerTurn = isUserTurn;
  const isTypewriting = canTapContinue && !dialogueTypeDone && !pendingUserLine;

  const sceneChoices: DialogueChoice[] = presetResponses.map((preset) => ({
    id: preset.text,
    text: preset.text,
    subtext: preset.note,
  }));

  const sceneBackdrop = city === 'seoul' ? SEOUL_FIRST_SCENE_BACKDROP : cityConfig.backdropImage;
  const activeResumeMatchesSelection = Boolean(
    activeResumeCard && activeResumeCard.city === worldCity && activeResumeCard.location === worldLocation,
  );

  useEffect(() => {
    const savedUserId = window.localStorage.getItem(ACTIVE_USER_ID_STORAGE_KEY);
    if (savedUserId) {
      setActiveUserId(savedUserId);
      setHasSavedUserId(true);
    }
    setBootstrapComplete(true);
  }, []);

  useEffect(() => {
    if (!bootstrapComplete || startupHandledRef.current) return;

    if (autoLaunchHangout) {
      startupHandledRef.current = true;
      setEntryPhase('playing');
      if (hasSavedUserId) {
        void quickStartHangout(activeUserId);
      } else {
        const nextUserId = beginNewGame('playing');
        void quickStartHangout(nextUserId);
      }
      return;
    }

    if (autoNewGame) {
      startupHandledRef.current = true;
      beginNewGame('onboarding');
    }
  }, [bootstrapComplete, autoLaunchHangout, autoNewGame, hasSavedUserId, activeUserId]);

  useEffect(() => {
    if (entryPhase !== 'opening') return;
    const timer = window.setTimeout(() => {
      setEntryPhase('entry');
    }, 5400);
    return () => window.clearTimeout(timer);
  }, [entryPhase]);

  useEffect(() => {
    if (entryPhase !== 'opening') {
      setNeedsIntroTap(false);
      return;
    }

    const video = openingVideoRef.current;
    if (!video) return;

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        setNeedsIntroTap(true);
      });
    }
  }, [entryPhase]);

  // Learn sessions refresh removed — now handled by LearnPanel

  useEffect(() => {
    setAvatarLoadFailed(false);
    setAvatarPathIndex(0);
  }, [character.id, character.name, character.assetKey]);

  useEffect(() => {
    if (!activeDialogueText || pendingUserLine || !activeSceneLine || activeSceneLine.speaker === 'you') {
      setTypedDialogueText(activeDialogueText);
      setDialogueTypeDone(true);
      return;
    }

    setTypedDialogueText('');
    setDialogueTypeDone(false);
    const source = activeDialogueText;
    const stepSize = Math.max(1, Math.ceil(source.length / 46));
    let index = 0;

    const timer = window.setInterval(() => {
      index = Math.min(source.length, index + stepSize);
      setTypedDialogueText(source.slice(0, index));
      if (index >= source.length) {
        setDialogueTypeDone(true);
        window.clearInterval(timer);
      }
    }, 28);

    return () => window.clearInterval(timer);
  }, [activeDialogueText, activeSceneLine, pendingUserLine]);

  function persistActiveUserId(nextUserId: string) {
    setActiveUserId(nextUserId);
    setHasSavedUserId(true);
    window.localStorage.setItem(ACTIVE_USER_ID_STORAGE_KEY, nextUserId);
  }

  function resetSceneState(nextLocation: LocationId, nextCity: CityId = city) {
    setSceneSessionId(null);
    setObjective(null);
    setObjectiveRatio(0);
    setSceneLines([]);
    setSceneLineIndex(0);
    setAwaitingUserTurn(false);
    setPendingUserLine(null);
    setTongHint(null);
    setLastNpcLine(null);
    setUserUtterance('');
    setPresetResponses([]);
    setTypedDialogueText('');
    setDialogueTypeDone(true);
    setCharacter(getCharacterForCityLocation(nextCity, nextLocation));
  }

  function beginNewGame(nextPhase: EntryPhase = 'onboarding') {
    const nextUserId = createSessionUserId();
    persistActiveUserId(nextUserId);
    setCity(DEFAULT_CITY);
    setLocation(DEFAULT_LOCATION);
    setWorldCity(DEFAULT_CITY);
    setWorldLocation(DEFAULT_LOCATION);
    setSessionId(null);
    setObjective(null);
    setRouteState(null);
    setRelationshipState(null);
    setProgressionLoop(null);
    setActiveResumeCard(null);
    setScore({ xp: 0, sp: 0, rp: 0 });
    setEngineMode('scripted_fallback');
    setError(null);
    setStatus('Set your language baseline, then start your first hangout challenge.');
    setMode('hangout');
    setShowWorldPanel(false);
    setProficiencyGauge({ ...REQUESTED_GAUGE_PRESET });
    setEntryPhase(nextPhase);
    resetSceneState(DEFAULT_LOCATION, DEFAULT_CITY);
    return nextUserId;
  }

  function finishOpeningAnimation() {
    setEntryPhase((current) => (current === 'opening' ? 'entry' : current));
  }

  function openWorldMap() {
    setMode('hangout');
    setWorldCity(activeResumeCard?.city || city);
    setWorldLocation(activeResumeCard?.location || location);
    setShowWorldPanel(true);
    setStatus(
      activeResumeCard
        ? 'World map open. Your active hangout is parked at the latest safe checkpoint.'
        : 'World map open. Choose a city and location to start a hangout.',
    );
  }

  function closeWorldMap() {
    setShowWorldPanel(false);
    if (activeResumeCard) {
      setStatus(
        `${CITY_BY_ID[activeResumeCard.city].label} · ${LOCATION_LABELS[activeResumeCard.location]} ready to resume.`,
      );
    }
  }

  function applyServerReplies(replies?: string[]) {
    if (!replies?.length) {
      setPresetResponses([]);
      return;
    }
    setPresetResponses(replies.slice(0, 6).map((text) => ({ text })));
  }

  function extractRenderHint(renderOps?: HangoutRenderOp[]): string | null {
    if (!renderOps?.length) return null;
    for (const op of renderOps) {
      if (op.tool === 'tong_whisper' && op.text?.trim()) {
        return op.text.trim();
      }
    }
    return null;
  }

  function extractRenderReplies(renderOps?: HangoutRenderOp[]): string[] | undefined {
    if (!renderOps?.length) return undefined;
    const choices = renderOps.find((op) => op.tool === 'offer_choices' && Array.isArray(op.choices))?.choices;
    if (!choices?.length) return undefined;
    return choices.filter((choice) => Boolean(choice?.trim())).slice(0, 6);
  }

  function extractRenderLines(renderOps?: HangoutRenderOp[]): SceneLine[] {
    if (!renderOps?.length) return [];
    return renderOps
      .filter((op) => op.tool === 'npc_speak' && Boolean(op.text?.trim()))
      .map((op) => ({
        speaker: 'character' as const,
        text: op.text!.trim(),
        speakerName: op.speakerName,
        expression: typeof op.expression === 'string' ? op.expression : undefined,
      }));
  }

  function mergeIncomingLines(lines: SceneLine[], unlockInputAfter = true) {
    const filteredLines = lines.filter((line) => line && line.text && line.text.trim());

    const tongLines = filteredLines.filter((line) => line.speaker === 'tong');
    if (tongLines.length > 0) {
      const latestHint = tongLines[tongLines.length - 1];
      setTongHint(latestHint?.text?.trim() || null);
    }

    const spokenLines = filteredLines.filter(isDialogueLine);
    const lastCharacterLine = [...spokenLines].reverse().find((line) => line.speaker === 'character');
    if (lastCharacterLine?.text) {
      setLastNpcLine(lastCharacterLine.text);
    }

    setPendingUserLine(null);
    setSceneLineIndex(0);
    setSceneLines(spokenLines);
    setAwaitingUserTurn(spokenLines.length === 0 && unlockInputAfter);
  }

  function handleTapToContinue() {
    if (!canTapContinue) return;
    if (isTypewriting) {
      setTypedDialogueText(activeDialogueText);
      setDialogueTypeDone(true);
      return;
    }

    if (sceneLineIndex < sceneLines.length - 1) {
      setSceneLineIndex((current) => current + 1);
      return;
    }

    setSceneLines([]);
    setSceneLineIndex(0);
    setAwaitingUserTurn(true);
  }

  async function quickStartHangout(
    userIdOverride?: string,
    selectionOverride?: { city?: CityId; location?: LocationId },
  ) {
    const sessionUserId = userIdOverride || activeUserId;
    const requestedCity = selectionOverride?.city || worldCity || city;
    const requestedLocation = selectionOverride?.location || worldLocation || location;

    try {
      setLoadingStart(true);
      setMode('hangout');
      setShowWorldPanel(false);
      setError(null);
      setStatus(`Preparing ${CITY_BY_ID[requestedCity].label} · ${LOCATION_LABELS[requestedLocation]}...`);
      resetSceneState(requestedLocation, requestedCity);

      const game = await startOrResumeGame({
        userId: sessionUserId,
        city: requestedCity,
        profile: buildProfileFromGauge(proficiencyGauge),
        preferRomance: true,
      });
      const resolvedCity = game.city || requestedCity;
      const resolvedLocation = game.location || requestedLocation;
      const resolvedLang =
        game.gameSession?.activeObjective?.lang === 'ko' ||
        game.gameSession?.activeObjective?.lang === 'ja' ||
        game.gameSession?.activeObjective?.lang === 'zh'
          ? game.gameSession.activeObjective.lang
          : CITY_BY_ID[resolvedCity].language;

      setCity(resolvedCity);
      setLocation(resolvedLocation);
      setWorldCity(resolvedCity);
      setWorldLocation(resolvedLocation);
      setCharacter(getCharacterForCityLocation(resolvedCity, resolvedLocation));

      setSessionId(game.sessionId);
      setEngineMode(game.engineMode || 'scripted_fallback');
      setRelationshipState(game.relationshipState || null);
      setRouteState(
        game.routeState || {
          sessionId: game.sessionId,
          checkpointId: game.activeCheckpoint?.checkpointId || null,
        },
      );
      setProgressionLoop(game.progressionLoop || null);
      if (game.progression) {
        setScore({
          xp: game.progression.xp,
          sp: game.progression.sp,
          rp: game.progression.rp,
        });
      }

      const nextObjective = await fetchObjectiveNext({
        userId: sessionUserId,
        city: resolvedCity,
        location: resolvedLocation,
        mode: 'hangout',
        lang: resolvedLang,
      });
      setObjective(nextObjective);

      const hangout = await startHangout({
        objectiveId: nextObjective.objectiveId,
        userId: sessionUserId,
        sessionId: game.sessionId,
        city: resolvedCity,
        location: resolvedLocation,
        lang: resolvedLang,
        preferRomance: true,
      });

      setSceneSessionId(hangout.sceneSessionId);
      setEngineMode(hangout.engineMode || game.engineMode || 'scripted_fallback');
      setCharacter((current) => mergeCharacterPayload(current, hangout.character || hangout.npc));
      setScore(hangout.state.score);
      setRelationshipState(hangout.relationshipState || hangout.state.relationshipState || null);
      const nextRouteState =
        hangout.routeState ||
        hangout.state.routeState ||
        game.routeState || {
          sessionId: game.sessionId,
          checkpointId: hangout.activeCheckpoint?.checkpointId || game.activeCheckpoint?.checkpointId || null,
        };
      setRouteState(nextRouteState);
      setProgressionLoop(hangout.progressionLoop || hangout.state.progressionLoop || null);
      setActiveResumeCard({
        sessionId: game.sessionId,
        city: resolvedCity,
        location: resolvedLocation,
        objectiveId: nextObjective.objectiveId,
        checkpointId:
          (typeof hangout.activeCheckpoint?.checkpointId === 'string' && hangout.activeCheckpoint.checkpointId) ||
          (typeof game.activeCheckpoint?.checkpointId === 'string' && game.activeCheckpoint.checkpointId) ||
          (typeof nextRouteState?.checkpointId === 'string' && nextRouteState.checkpointId) ||
          null,
        bond:
          (typeof nextRouteState?.stage === 'string' && nextRouteState.stage) ||
          (typeof hangout.relationshipState?.stage === 'string' && hangout.relationshipState.stage) ||
          (typeof hangout.state?.relationshipState?.stage === 'string' && hangout.state.relationshipState.stage) ||
          'stranger',
        npcName: hangout.character?.name || hangout.npc?.name || null,
      });

      const startProgress =
        getObjectiveRatio(hangout.state.objectiveProgress) ?? getObjectiveRatio(hangout.objectiveProgress);
      if (startProgress !== null) {
        setObjectiveRatio(startProgress);
      }

      const renderHint = extractRenderHint(hangout.renderOps);
      setTongHint(renderHint || (hangout.tongHint || '').trim() || null);

      const renderReplies = extractRenderReplies(hangout.renderOps);
      if (renderReplies) {
        applyServerReplies(renderReplies);
      } else {
        applyServerReplies(hangout.quickReplies);
      }

      const renderLines = extractRenderLines(hangout.renderOps);
      const openingLines =
        renderLines.length > 0
          ? renderLines
          : hangout.initialLines && hangout.initialLines.length > 0
            ? hangout.initialLines
            : [hangout.initialLine];

      mergeIncomingLines(openingLines, true);
      setStatus(`${CITY_BY_ID[resolvedCity].label} hangout live.`);
      return true;
    } catch (startError) {
      const message =
        startError instanceof Error ? startError.message : `Failed to start the ${CITY_BY_ID[requestedCity].label} hangout.`;
      setError(message);
      setStatus('Start failed. Try again.');
      return false;
    } finally {
      setLoadingStart(false);
    }
  }

  async function sendHangoutTurn(presetText?: string) {
    if (!sceneSessionId) {
      setError('Start a hangout scene first.');
      return;
    }

    const utterance = (presetText ?? userUtterance).trim();
    if (!utterance || sendingTurn) return;

    setError(null);
    setSendingTurn(true);
    setAwaitingUserTurn(false);
    setSceneLines([]);
    setSceneLineIndex(0);
    setPendingUserLine(utterance);
    setUserUtterance('');

    try {
      const response = await respondHangout(sceneSessionId, utterance);
      setEngineMode(response.engineMode || engineMode);
      setScore(response.state.score);
      setCharacter((current) => mergeCharacterPayload(current, response.character || response.npc));

      const renderHint = extractRenderHint(response.renderOps);
      setTongHint(renderHint || (response.feedback.tongHint || '').trim() || null);

      const renderReplies = extractRenderReplies(response.renderOps);
      if (renderReplies) {
        applyServerReplies(renderReplies);
      } else {
        applyServerReplies(response.feedback.suggestedReplies);
      }

      setRelationshipState(
        response.relationshipState ||
          response.state.relationshipState ||
          response.feedback.relationshipState ||
          response.completionSummary?.relationshipState ||
          null,
      );

      setRouteState(
        response.routeState ||
          response.state.routeState ||
          response.feedback.routeState ||
          response.completionSummary?.routeState ||
          routeState ||
          null,
      );
      setActiveResumeCard((current) =>
        current
          ? {
              ...current,
              checkpointId:
                (typeof response.activeCheckpoint?.checkpointId === 'string' && response.activeCheckpoint.checkpointId) ||
                (typeof response.routeState?.checkpointId === 'string' && response.routeState.checkpointId) ||
                current.checkpointId,
              bond:
                (typeof response.routeState?.stage === 'string' && response.routeState.stage) ||
                (typeof response.relationshipState?.stage === 'string' && response.relationshipState.stage) ||
                (typeof response.state?.relationshipState?.stage === 'string' && response.state.relationshipState.stage) ||
                current.bond,
            }
          : current,
      );

      setProgressionLoop(
        response.progressionLoop ||
          response.state.progressionLoop ||
          response.feedback.progressionLoop ||
          progressionLoop ||
          null,
      );

      setObjectiveRatio((previous) => {
        const fromState = getObjectiveRatio(response.state.objectiveProgress);
        if (fromState !== null) return fromState;

        const fromFeedback = getObjectiveRatio(response.feedback.objectiveProgress);
        if (fromFeedback !== null) return fromFeedback;

        const delta = response.feedback.objectiveProgressDelta;
        const normalizedDelta = delta > 1 ? delta / 100 : delta;
        return clamp01(previous + normalizedDelta);
      });

      const renderLines = extractRenderLines(response.renderOps);
      const nextLines =
        renderLines.length > 0
          ? renderLines
          : response.nextLines && response.nextLines.length > 0
            ? response.nextLines
            : [response.nextLine];

      mergeIncomingLines(nextLines, true);

      if (response.completion?.isCompleted) {
        setStatus(
          response.completion.completionSignal === 'objective_validated'
            ? 'Objective validated. Hangout complete.'
            : 'Scene complete. Start another hangout from World.',
        );
      }
    } catch (turnError) {
      setError(turnError instanceof Error ? turnError.message : 'Failed to send your response.');
      setPendingUserLine(null);
      setAwaitingUserTurn(true);
    } finally {
      setSendingTurn(false);
    }
  }

  // refreshLearnSessions + startNewLearnSession removed — now handled by LearnPanel

  async function completeOnboardingAndLaunch() {
    setEntryPhase('playing');
    const started = await quickStartHangout();
    if (!started) {
      setShowWorldPanel(true);
    }
  }

  async function resumeLatestGame() {
    if (!hasSavedUserId) return;
    setEntryPhase('playing');
    const started = await quickStartHangout(activeUserId);
    if (!started) {
      setEntryPhase('entry');
    }
  }

  function handleProficiencyChange(lang: CjkLang, nextValue: number) {
    setProficiencyGauge((current) => ({
      ...current,
      [lang]: normalizeGaugeLevel(nextValue),
    }));
  }

  function applyGaugePreset(preset: 'requested' | 'balanced' | 'starter') {
    if (preset === 'requested') {
      setProficiencyGauge({ ...REQUESTED_GAUGE_PRESET });
      return;
    }
    if (preset === 'balanced') {
      setProficiencyGauge({ ko: 2, ja: 2, zh: 2 });
      return;
    }
    setProficiencyGauge({ ko: 0, ja: 0, zh: 0 });
  }

  async function resumeActiveHangout() {
    if (!hasSavedUserId) return;
    setMode('hangout');
    await quickStartHangout(activeUserId, {
      city: activeResumeCard?.city || city,
      location: activeResumeCard?.location || location,
    });
  }

  function handleWorldLocationChange(nextLocation: LocationId) {
    if (nextLocation === worldLocation) return;
    setWorldLocation(nextLocation);
    setStatus(`${worldCityConfig.label} · ${LOCATION_LABELS[nextLocation]} selected on the world map.`);
  }

  function handleWorldCityChange(nextCity: CityId) {
    if (nextCity === worldCity) return;
    setWorldCity(nextCity);
    setWorldLocation(DEFAULT_LOCATION);
    setStatus(`${CITY_BY_ID[nextCity].label} selected on the world map.`);
  }

  function handleStartFromMenu() {
    beginNewGame('tong-intro');
  }

  const shouldShowAvatar = !pendingUserLine && (activeSceneLine?.speaker === 'character' || isUserTurn);

  return (
    <main className={`tg-shell ${entryPhase === 'playing' ? 'tg-shell-playing' : 'tg-shell-entry'}`}>
      <section className={`tg-stage ${entryPhase === 'playing' ? 'tg-stage-playing' : ''}`}>
        {entryPhase !== 'playing' && (
          <>
            <div className="tg-ambient" aria-hidden>
              <span className="tg-blob tg-blob-a" />
              <span className="tg-blob tg-blob-b" />
            </div>
            <div className="tg-scrim" aria-hidden />
          </>
        )}

        <article className={`tg-phone ${entryPhase === 'playing' ? 'tg-phone-playing' : 'tg-phone-entry'}`}>
          {entryPhase === 'opening' && (
            <div className="tg-opening-video-wrap">
              <video
                ref={openingVideoRef}
                className="tg-opening-video"
                src={OPENING_ANIMATION_PATH}
                autoPlay
                muted
                playsInline
                preload="auto"
                onEnded={finishOpeningAnimation}
                onError={finishOpeningAnimation}
              />
              <p className="tg-opening-loading">Booting your world...</p>
              <button className="tg-text-link" type="button" onClick={finishOpeningAnimation}>
                Skip
              </button>
              {needsIntroTap && (
                <button className="tg-secondary" type="button" onClick={() => void openingVideoRef.current?.play()}>
                  Tap To Play Intro
                </button>
              )}
            </div>
          )}

          {entryPhase === 'entry' && (
            <div className="tg-entry-panel">
              <img className="tg-logo" src={GAME_LOGO_PATH} alt="Tong logo" />
              <p className="tg-brand">Tong</p>
              <h1 className="tg-title">
                <span>Live the drama.</span>
                <span className="tg-title-accent">Learn the language.</span>
              </h1>
              <p className="tg-copy">Start a new game, or continue your last session.</p>

              <div className="tg-actions">
                <button type="button" onClick={handleStartFromMenu}>
                  Start New Game
                </button>
                <button type="button" className="tg-secondary" onClick={() => void resumeLatestGame()} disabled={!hasSavedUserId}>
                  Continue
                </button>
              </div>

              <div className="tg-city-list" aria-hidden>
                <span>Seoul — K-Drama</span>
                <span>Tokyo — Coming Soon</span>
                <span>Shanghai — Coming Soon</span>
              </div>
            </div>
          )}

          {entryPhase === 'tong-intro' && (
            <div className="tg-tong-intro">
              <video
                className="tg-tong-intro-video"
                autoPlay
                muted
                playsInline
                preload="auto"
                onEnded={() => setEntryPhase('onboarding')}
                onError={() => setEntryPhase('onboarding')}
                ref={(el) => {
                  if (!el) return;
                  // Timeout fallback: if video doesn't start within 3s, skip
                  const t = setTimeout(() => { if (el.readyState < 2) setEntryPhase('onboarding'); }, 3000);
                  el.addEventListener('playing', () => clearTimeout(t), { once: true });
                }}
              >
                <source src={TONG_INTRO_PATH} type="video/webm" />
              </video>
              <p className="tg-tong-intro-name">Tong</p>
              <button className="btn-skip tg-skip-bottom" type="button" onClick={() => setEntryPhase('onboarding')}>
                Skip
              </button>
            </div>
          )}

          {entryPhase === 'onboarding' && (
            <div className="tg-onboarding-panel">
              <div className="tg-onboarding-avatar">T</div>
              <p className="tg-onboarding-line">Hey! I&apos;m Tong, your language buddy.</p>
              <p className="tg-onboarding-line tg-onboarding-line-strong">
                Set your current level, then we jump into your first hangout.
              </p>

              <article className="tg-slider-card">
                <header>
                  <p>Language Gauge</p>
                  <span>7 levels</span>
                </header>
                {CJK_LANG_ORDER.map((lang) => {
                  const level = gaugeLevelToProficiency(proficiencyGauge[lang]);
                  return (
                    <label key={lang} className="tg-slider-row">
                      <div className="tg-slider-head">
                        <strong>
                          {LANGUAGE_LABELS[lang]} ({lang.toUpperCase()})
                        </strong>
                        <span>
                          {proficiencyGauge[lang] + 1}/7 · {proficiencyLabel(level)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={MAX_PROFICIENCY_GAUGE_LEVEL}
                        step={1}
                        value={proficiencyGauge[lang]}
                        onChange={(event) => handleProficiencyChange(lang, Number(event.target.value))}
                      />
                      <small>{proficiencySubtitle(level)}</small>
                    </label>
                  );
                })}
              </article>

              <div className="tg-preset-row">
                <button className="tg-secondary" type="button" onClick={() => applyGaugePreset('requested')}>
                  Requested
                </button>
                <button className="tg-secondary" type="button" onClick={() => applyGaugePreset('balanced')}>
                  Balanced
                </button>
                <button className="tg-secondary" type="button" onClick={() => applyGaugePreset('starter')}>
                  Zero
                </button>
              </div>

              <div className="tg-actions">
                <button type="button" onClick={() => void completeOnboardingAndLaunch()} disabled={loadingStart}>
                  {loadingStart ? 'Launching...' : 'Start First Hangout Challenge'}
                </button>
                <button type="button" className="tg-secondary" onClick={() => setEntryPhase('entry')} disabled={loadingStart}>
                  Back
                </button>
              </div>

              <p className="tg-status">{status}</p>
              {error && <p className="tg-error">{error}</p>}
            </div>
          )}

          {entryPhase === 'playing' && (
            <div className="tg-playing-shell">
              <header className="tg-scene-header">
                <div>
                  <p className="tg-scene-kicker">
                    {cityConfig.label.toUpperCase()} · {LOCATION_LABELS[location].toUpperCase()}
                  </p>
                  <strong className="tg-scene-title">
                    {mode === 'hangout' ? `${character.name || cityConfig.label} hangout` : `${cityConfig.languageLabel} learn`}
                  </strong>
                </div>
                <div className="tg-scene-actions">
                  <button
                    className={`tg-chip ${mode === 'learn' ? 'active' : ''}`}
                    type="button"
                    onClick={() => setMode((current) => (current === 'hangout' ? 'learn' : 'hangout'))}
                  >
                    {mode === 'hangout' ? 'Learn' : 'Hangout'}
                  </button>
                  <button
                    className={`tg-chip ${showWorldPanel ? 'active' : ''}`}
                    type="button"
                    onClick={() => (showWorldPanel ? closeWorldMap() : openWorldMap())}
                  >
                    {showWorldPanel ? 'Back to Hangout' : activeResumeCard ? 'Return to World Map' : 'World Map'}
                  </button>
                </div>
              </header>

              {showWorldPanel && (
                <section className="tg-world-sheet">
                  {activeResumeCard && (
                    <article className="tg-resume-card">
                      <div>
                        <p className="tg-resume-label">Active Hangout</p>
                        <strong>
                          {CITY_BY_ID[activeResumeCard.city].label} · {LOCATION_LABELS[activeResumeCard.location]}
                        </strong>
                        <p>
                          {activeResumeCard.npcName || 'Partner'} · Bond {activeResumeCard.bond}
                          {activeResumeCard.objectiveId ? ` · ${activeResumeCard.objectiveId}` : ''}
                        </p>
                        <p>
                          Resume from the latest safe checkpoint
                          {activeResumeCard.checkpointId ? ` (${activeResumeCard.checkpointId})` : ''}.
                        </p>
                      </div>
                      <button type="button" onClick={() => void resumeActiveHangout()} disabled={loadingStart}>
                        {loadingStart ? 'Resuming...' : 'Resume Active Hangout'}
                      </button>
                    </article>
                  )}

                  <div className="tg-world-row">
                    {CITY_DEFINITIONS.map((cityOption) => (
                      <button
                        key={cityOption.id}
                        type="button"
                        className={`tg-city-pill ${cityOption.id === worldCity ? 'active' : ''}`}
                        onClick={() => handleWorldCityChange(cityOption.id)}
                      >
                        {cityOption.label}
                      </button>
                    ))}
                  </div>

                  <div className="tg-world-row tg-world-row-locations">
                    {LOCATIONS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={`tg-location-pill ${item === worldLocation ? 'active' : ''}`}
                        onClick={() => handleWorldLocationChange(item)}
                      >
                        {LOCATION_LABELS[item]}
                      </button>
                    ))}
                  </div>

                  {!activeResumeCard && (
                    <button
                      type="button"
                      onClick={() => void quickStartHangout(undefined, { city: worldCity, location: worldLocation })}
                      disabled={loadingStart}
                    >
                      {loadingStart ? 'Starting...' : 'Start Hangout'}
                    </button>
                  )}
                  {activeResumeCard && !activeResumeMatchesSelection && (
                    <p className="tg-status">
                      A hangout is already active in {CITY_BY_ID[activeResumeCard.city].label} ·{' '}
                      {LOCATION_LABELS[activeResumeCard.location]}. Resume that scene before starting somewhere else.
                    </p>
                  )}
                  <p className="tg-status">{status}</p>
                  {error && <p className="tg-error">{error}</p>}
                </section>
              )}

              <div className="tg-scene-body">
                {mode === 'hangout' ? (
                  <SceneView
                    backgroundUrl={sceneBackdrop}
                    tongHint={tongHint}
                    onDismissTong={() => setTongHint(null)}
                    speakerName={activeSpeakerLabel}
                    npcSpriteUrl={shouldShowAvatar && !avatarLoadFailed ? (expressionSpriteUrl || characterAvatarSrc || '') : ''}
                    npcName={character.name || ''}
                    npcColor={character.name?.toLowerCase() === 'jin' ? '#4a90d9' : '#e8485c'}
                    avatarUrl={shouldShowAvatar && !avatarLoadFailed ? characterAvatarSrc : null}
                    onAvatarError={() => {
                      const nextIndex = avatarPathIndex + 1;
                      if (nextIndex < characterAvatarOptions.length) {
                        setAvatarPathIndex(nextIndex);
                        return;
                      }
                      setAvatarLoadFailed(true);
                    }}
                    dialogueText={isTypewriting ? typedDialogueText : activeDialogueText}
                    canContinue={canTapContinue}
                    isTypewriting={isTypewriting}
                    onContinue={handleTapToContinue}
                    canAnswerTurn={canAnswerTurn}
                    choices={sceneChoices}
                    onChoice={(choiceId) => void sendHangoutTurn(choiceId)}
                    choiceDisabled={!sceneSessionId || sendingTurn}
                    userInput={userUtterance}
                    onUserInput={setUserUtterance}
                    onSend={() => void sendHangoutTurn()}
                    sendDisabled={!sceneSessionId || !userUtterance.trim() || sendingTurn}
                    sendingTurn={sendingTurn}
                    isLoading={loadingStart}
                  />
                ) : (
                  <LearnPanel
                    cityId={city}
                    locationId={location}
                    userId={activeUserId}
                    objectiveId={objective?.objectiveId}
                    lang={selectedLang}
                  />
                )}
              </div>

              <footer className="tg-footer-status">
                <p>
                  {engineMode === 'dynamic_ai' ? 'Dynamic AI' : 'Scripted fallback'} · Bond:{' '}
                  {routeState?.stage || relationshipState?.stage || 'stranger'}
                </p>
                <p>
                  XP {score.xp} · SP {score.sp} · RP {score.rp} · Objective {Math.round(objectiveRatio * 100)}%
                </p>
                {progressionLoop && (
                  <p>
                    Tier {progressionLoop.masteryTier} · Readiness {Math.round(progressionLoop.learnReadiness * 100)}% · Gate{' '}
                    {progressionLoop.missionGate.status} ({progressionLoop.missionGate.validatedHangouts}/
                    {progressionLoop.missionGate.requiredValidatedHangouts})
                  </p>
                )}
                {objective && <p>Objective: {objective.objectiveId}</p>}
              </footer>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
