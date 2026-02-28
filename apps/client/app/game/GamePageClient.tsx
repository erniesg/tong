'use client';

import { useEffect, useRef, useState } from 'react';
import {
  assessMission,
  createLearnSession,
  fetchLearnSessions,
  fetchObjectiveNext,
  respondHangout,
  startHangout,
  startOrResumeGame,
  type CityId,
  type GameProfile,
  type HangoutRenderOp,
  type LearnSession,
  type LocationId,
  type ObjectiveNextResponse,
  type ObjectiveProgressState,
  type ProgressLoopState,
  type ProficiencyLevel,
  type RelationshipState,
  type RouteState,
  type SceneCharacter,
  type SceneLine,
  type ScoreState,
} from '@/lib/api';
import { SceneView, type DialogueChoice } from '@/components/scene/SceneView';

interface DialogueMessage {
  id: string;
  speaker: 'character' | 'you';
  text: string;
}

interface PresetResponse {
  text: string;
  note?: string;
}

type CjkLang = 'ko' | 'ja' | 'zh';
type EntryPhase = 'opening' | 'entry' | 'onboarding' | 'playing';
type ProficiencyGaugeLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

type MapPosition = 'left' | 'center' | 'right';

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

const CITY_DEFINITIONS: CityDefinition[] = [
  {
    id: 'tokyo',
    label: 'Tokyo',
    language: 'ja',
    languageLabel: 'Japanese',
    mapPosition: 'left',
    vibe: 'Shibuya after-hours energy',
    backdropImage: '/assets/locations/tokyo-static.png',
  },
  {
    id: 'seoul',
    label: 'Seoul',
    language: 'ko',
    languageLabel: 'Korean',
    mapPosition: 'center',
    vibe: 'Hongdae late-night food lane',
    backdropImage: '/assets/locations/seoul-static.png',
    backdropVideo: '/assets/locations/seoul.mp4',
  },
  {
    id: 'shanghai',
    label: 'Shanghai',
    language: 'zh',
    languageLabel: 'Chinese',
    mapPosition: 'right',
    vibe: 'Bund neon and river glow',
    backdropImage: '/assets/locations/shanghai-static.png',
    backdropVideo: '/assets/locations/shanghai.mp4',
  },
];

const CITY_ORDER = CITY_DEFINITIONS.map((city) => city.id);

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
  },
  tokyo: {
    food_street: { name: 'Haeun', role: 'Primary romance route lead', avatarEmoji: 'HR', mood: 'warm' },
    cafe: { name: 'Jin', role: 'Primary romance route lead', avatarEmoji: 'JN', mood: 'charming' },
    convenience_store: { name: 'Sora', role: 'Store clerk', avatarEmoji: 'CV', mood: 'helpful' },
    subway_hub: { name: 'Daichi', role: 'Commuter guide', avatarEmoji: 'SB', mood: 'focused' },
    practice_studio: { name: 'Mika', role: 'Practice partner', avatarEmoji: 'PS', mood: 'energetic' },
  },
  shanghai: {
    food_street: { name: 'Haeun', role: 'Primary romance route lead', avatarEmoji: 'HR', mood: 'warm' },
    cafe: { name: 'Jin', role: 'Primary romance route lead', avatarEmoji: 'JN', mood: 'charming' },
    convenience_store: { name: 'Bo', role: 'Store clerk', avatarEmoji: 'CV', mood: 'helpful' },
    subway_hub: { name: 'Wei', role: 'Commuter guide', avatarEmoji: 'SB', mood: 'focused' },
    practice_studio: { name: 'Qin', role: 'Practice partner', avatarEmoji: 'PS', mood: 'energetic' },
  },
};

const EMPTY_PRESET_RESPONSES: PresetResponse[] = [];

const ACTIVE_USER_ID_STORAGE_KEY = 'tong_active_user_id';
const GAME_LOGO_PATH = '/assets/app/logo_transparent.png';
const OPENING_ANIMATION_PATH = '/assets/app/tong_opening.mp4';
const MAX_PROFICIENCY_GAUGE_LEVEL = 6;
const SEOUL_FIRST_SCENE_BACKDROP = '/assets/scenes/scene1.png';
const REQUESTED_GAUGE_PRESET: Record<CjkLang, ProficiencyGaugeLevel> = {
  ko: 0,
  ja: 0,
  zh: 5,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function isDialogueLine(line: SceneLine): line is SceneLine & { speaker: 'character' | 'you' } {
  return (line.speaker === 'character' || line.speaker === 'you') && Boolean(line.text.trim());
}

function lineToDialogue(lines: SceneLine[]): DialogueMessage[] {
  return lines
    .filter(isDialogueLine)
    .map((line) => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      speaker: line.speaker,
      text: line.text,
    }));
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

function mergeCharacterPayload(base: SceneCharacter, payload?: SceneCharacter): SceneCharacter {
  if (!payload) return base;
  return {
    ...base,
    ...payload,
    avatarEmoji: payload.avatarEmoji || base.avatarEmoji,
  };
}

function getCharacterAvatarPaths(value?: SceneCharacter): string[] {
  if (!value) return [];
  const options: string[] = [];

  const safeName = (value.name || '').toLowerCase().trim();
  const safeId = (value.id || '').toLowerCase().trim();

  if (safeId === 'npc_haeun' || safeName === 'haeun') {
    options.push('/assets/characters/haeun/haeun.png');
    options.push('/assets/characters/hauen/haeun.png');
  }

  if (safeId === 'npc_jin' || safeId === 'npc_ding_man' || safeName === 'jin' || safeName === 'ding') {
    // Prefer explicit Jin uploads first, then legacy ding_man fallback.
    options.push('/assets/characters/jin/jin.png');
    options.push('/assets/characters/ding_man/avatar.png');
    options.push('/assets/characters/ding_man/ding_man.png');
  }

  if (value.assetKey) {
    // Keep server-provided asset key as fallback, but after canonical routes.
    options.push(`/assets/characters/${value.assetKey}`);
  }

  return [...new Set(options)];
}

function getCharacterForCityLocation(city: CityId, location: LocationId): SceneCharacter {
  return LOCATION_CHARACTERS_BY_CITY[city]?.[location] || LOCATION_CHARACTERS_BY_CITY[DEFAULT_CITY][DEFAULT_LOCATION];
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
  if (level === 'beginner') return 'You know a few basics';
  if (level === 'intermediate') return 'You can hold short chats';
  if (level === 'advanced') return 'You can speak with nuance';
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

function cityMapHint(position: MapPosition): string {
  if (position === 'left') return 'Left lane';
  if (position === 'center') return 'Center lane';
  return 'Right lane';
}

function createSessionUserId(): string {
  return `user_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

export default function GamePageClient({
  initialEntryPhase = 'opening',
  autoNewGame = false,
  autoLaunchHangout = false,
}: GamePageClientProps) {
  const cityTrackRef = useRef<HTMLDivElement | null>(null);
  const openingVideoRef = useRef<HTMLVideoElement | null>(null);
  const autoLaunchHandledRef = useRef(false);
  const autoLaunchRetryRef = useRef(0);

  const [entryPhase, setEntryPhase] = useState<EntryPhase>(initialEntryPhase);
  const [activeUserId, setActiveUserId] = useState(() => createSessionUserId());
  const [hasSavedUserId, setHasSavedUserId] = useState(false);
  const [showSetupPanel, setShowSetupPanel] = useState(false);

  const [mode, setMode] = useState<'hangout' | 'learn'>('hangout');
  const [city, setCity] = useState<CityId>(DEFAULT_CITY);
  const [location, setLocation] = useState<LocationId>(DEFAULT_LOCATION);
  const [proficiencyGauge, setProficiencyGauge] = useState<Record<CjkLang, ProficiencyGaugeLevel>>({
    ...REQUESTED_GAUGE_PRESET,
  });

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sceneSessionId, setSceneSessionId] = useState<string | null>(null);
  const [objective, setObjective] = useState<ObjectiveNextResponse | null>(null);
  const [objectiveRatio, setObjectiveRatio] = useState(0);
  const [character, setCharacter] = useState<SceneCharacter>(getCharacterForCityLocation(DEFAULT_CITY, DEFAULT_LOCATION));

  const [score, setScore] = useState<ScoreState>({ xp: 0, sp: 0, rp: 0 });
  const [relationshipState, setRelationshipState] = useState<RelationshipState | null>(null);
  const [routeState, setRouteState] = useState<RouteState | null>(null);
  const [progressionLoop, setProgressionLoop] = useState<ProgressLoopState | null>(null);
  const [engineMode, setEngineMode] = useState<'dynamic_ai' | 'scripted_fallback'>('scripted_fallback');
  const [randomizeCharacter, setRandomizeCharacter] = useState(false);
  const [status, setStatus] = useState('Set your language baseline, then start your first hangout challenge.');
  const [messages, setMessages] = useState<DialogueMessage[]>([]);
  const [userUtterance, setUserUtterance] = useState('');
  const [presetResponses, setPresetResponses] = useState<PresetResponse[]>(EMPTY_PRESET_RESPONSES);
  const [sceneLines, setSceneLines] = useState<SceneLine[]>([]);
  const [sceneLineIndex, setSceneLineIndex] = useState(0);
  const [awaitingUserTurn, setAwaitingUserTurn] = useState(false);
  const [pendingUserLine, setPendingUserLine] = useState<string | null>(null);
  const [tongHint, setTongHint] = useState<string | null>(null);
  const [lastNpcLine, setLastNpcLine] = useState<string | null>(null);
  const [typedDialogueText, setTypedDialogueText] = useState('');
  const [dialogueTypeDone, setDialogueTypeDone] = useState(true);

  const [learnSessions, setLearnSessions] = useState<LearnSession[]>([]);
  const [learnMessage, setLearnMessage] = useState('');

  const [loadingStart, setLoadingStart] = useState(false);
  const [sendingTurn, setSendingTurn] = useState(false);
  const [loadingLearn, setLoadingLearn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [avatarPathIndex, setAvatarPathIndex] = useState(0);
  const [needsIntroTap, setNeedsIntroTap] = useState(false);

  const cityConfig = CITY_BY_ID[city];
  const selectedLang = cityConfig.language;
  const validatedHangouts = routeState?.validatedHangouts ?? progressionLoop?.missionGate.validatedHangouts ?? 0;
  const hasCompletedFirstHangout = validatedHangouts >= 1;
  const showSceneOneBackdrop = mode === 'hangout' && !hasCompletedFirstHangout;
  const characterAvatarOptions = getCharacterAvatarPaths(character);
  const characterAvatarSrc = characterAvatarOptions[avatarPathIndex] || null;
  const sceneOneBackdropLayers =
    city === 'seoul' ? [`url(${SEOUL_FIRST_SCENE_BACKDROP})`] : [`url(${cityConfig.backdropImage})`];
  const sceneOneBackdropStyle = showSceneOneBackdrop
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(14, 20, 28, 0.2), rgba(14, 20, 28, 0.68)), ${sceneOneBackdropLayers.join(', ')}`,
      }
    : undefined;
  const activeSceneLine = pendingUserLine ? null : sceneLines[sceneLineIndex] || null;
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
        ? lastNpcLine || 'Choose a reply or type your own response.'
        : loadingStart || (autoLaunchHangout && !sceneSessionId)
          ? 'Launching your first hangout...'
          : sceneSessionId
          ? 'Hangout live. Use World to restart this scene.'
          : 'Open World and start your first hangout.';
  const canTapContinue = Boolean(activeSceneLine) && !sendingTurn && !pendingUserLine;
  const canAnswerTurn = isUserTurn;
  const isTypewriting = canTapContinue && !dialogueTypeDone && !pendingUserLine;
  const isDirectHangoutPending = autoLaunchHangout && !sceneSessionId && (loadingStart || !error);
  const sceneChoices: DialogueChoice[] = presetResponses.map((preset) => ({
    id: preset.text,
    text: preset.text,
    subtext: preset.note,
  }));

  useEffect(() => {
    const track = cityTrackRef.current;
    if (!track) return;
    const initialIndex = CITY_ORDER.indexOf(DEFAULT_CITY);
    track.scrollTo({ left: initialIndex * track.clientWidth, behavior: 'auto' });
  }, []);

  useEffect(() => {
    if (!autoNewGame) return;
    beginNewGame();
  }, [autoNewGame]);

  useEffect(() => {
    if (!autoLaunchHangout || autoLaunchHandledRef.current) return;
    autoLaunchHandledRef.current = true;
    const nextUserId = beginNewGame('playing');
    void quickStartHangout(nextUserId);
  }, [autoLaunchHangout]);

  useEffect(() => {
    if (!autoLaunchHangout || sceneSessionId || loadingStart) return;
    if (autoLaunchRetryRef.current >= 2) return;
    const timer = window.setTimeout(() => {
      autoLaunchRetryRef.current += 1;
      void quickStartHangout(activeUserId);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [autoLaunchHangout, sceneSessionId, loadingStart, activeUserId]);

  useEffect(() => {
    if (entryPhase !== 'opening') return;
    const timer = window.setTimeout(() => {
      setEntryPhase('entry');
    }, 5200);
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

  useEffect(() => {
    const savedUserId = window.localStorage.getItem(ACTIVE_USER_ID_STORAGE_KEY);
    if (!savedUserId) return;
    setActiveUserId(savedUserId);
    setHasSavedUserId(true);
  }, []);

  useEffect(() => {
    if (mode === 'learn') {
      void refreshLearnSessions();
    }
  }, [mode, city, selectedLang, activeUserId]);

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

  function resetSceneState(nextLocation: LocationId, nextCity: CityId = city) {
    setSceneSessionId(null);
    setObjective(null);
    setObjectiveRatio(0);
    setMessages([]);
    setSceneLines([]);
    setSceneLineIndex(0);
    setAwaitingUserTurn(false);
    setPendingUserLine(null);
    setTongHint(null);
    setLastNpcLine(null);
    setUserUtterance('');
    setPresetResponses(EMPTY_PRESET_RESPONSES);
    setTypedDialogueText('');
    setDialogueTypeDone(true);
    setCharacter(getCharacterForCityLocation(nextCity, nextLocation));
  }

  function persistActiveUserId(nextUserId: string) {
    setActiveUserId(nextUserId);
    setHasSavedUserId(true);
    window.localStorage.setItem(ACTIVE_USER_ID_STORAGE_KEY, nextUserId);
  }

  function finishOpeningAnimation() {
    setEntryPhase((current) => (current === 'opening' ? 'entry' : current));
  }

  function beginNewGame(nextPhase: EntryPhase = 'onboarding') {
    const nextUserId = createSessionUserId();
    persistActiveUserId(nextUserId);
    setCity(DEFAULT_CITY);
    setLocation(DEFAULT_LOCATION);
    setSessionId(null);
    setRouteState(null);
    setRelationshipState(null);
    setProgressionLoop(null);
    setScore({ xp: 0, sp: 0, rp: 0 });
    setMessages([]);
    setError(null);
    setStatus('Set your language baseline, then launch your first hangout challenge.');
    setMode('hangout');
    setProficiencyGauge({ ...REQUESTED_GAUGE_PRESET });
    setEntryPhase(nextPhase);
    setShowSetupPanel(false);
    resetSceneState(DEFAULT_LOCATION, DEFAULT_CITY);
    return nextUserId;
  }

  async function resumeLatestGame() {
    if (!hasSavedUserId) return;
    setError(null);
    setEntryPhase('onboarding');
    setStatus('Adjust your baseline if needed, then jump into your first challenge.');
  }

  function selectCity(nextCity: CityId) {
    if (nextCity === city) return;
    setCity(nextCity);
    setLocation(DEFAULT_LOCATION);
    setLearnSessions([]);
    resetSceneState(DEFAULT_LOCATION, nextCity);
    setStatus(`${CITY_BY_ID[nextCity].label} selected. Start or resume to enter ${LOCATION_LABELS[DEFAULT_LOCATION]}.`);
  }

  function handleCityTrackScroll(event: React.UIEvent<HTMLDivElement>) {
    const track = event.currentTarget;
    if (!track.clientWidth) return;
    const nearestIndex = Math.round(track.scrollLeft / track.clientWidth);
    const boundedIndex = Math.max(0, Math.min(CITY_ORDER.length - 1, nearestIndex));
    const nextCity = CITY_ORDER[boundedIndex];
    if (nextCity && nextCity !== city) {
      selectCity(nextCity);
    }
  }

  function handleCityCardPress(nextCity: CityId) {
    const track = cityTrackRef.current;
    if (track) {
      const cityIndex = CITY_ORDER.indexOf(nextCity);
      track.scrollTo({ left: cityIndex * track.clientWidth, behavior: 'smooth' });
    }
    selectCity(nextCity);
  }

  function handleProficiencyChange(lang: CjkLang, nextValue: number) {
    setProficiencyGauge((current) => ({
      ...current,
      [lang]: normalizeGaugeLevel(nextValue),
    }));
  }

  function applyGaugePreset(preset: 'seoul' | 'balanced' | 'starter') {
    if (preset === 'seoul') {
      setProficiencyGauge({ ...REQUESTED_GAUGE_PRESET });
      return;
    }
    if (preset === 'balanced') {
      setProficiencyGauge({ ko: 2, ja: 2, zh: 2 });
      return;
    }
    setProficiencyGauge({ ko: 0, ja: 0, zh: 0 });
  }

  function handleLocationChange(nextLocation: LocationId) {
    setLocation(nextLocation);
    resetSceneState(nextLocation, city);
    setStatus(`${cityConfig.label} · ${LOCATION_LABELS[nextLocation]} selected. Start or resume to enter the scene.`);
  }

  function applyServerReplies(replies?: string[]) {
    if (!replies?.length) {
      setPresetResponses(EMPTY_PRESET_RESPONSES);
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
      }));
  }

  function mergeIncomingLines(lines: SceneLine[], unlockInputAfter = true) {
    const filteredLines = lines.filter((line) => line && line.text && line.text.trim());
    const tongLines = filteredLines.filter((line) => line.speaker === 'tong');
    if (tongLines.length > 0) {
      const latestHint = tongLines[tongLines.length - 1];
      setTongHint(latestHint?.text?.trim() || null);
    }

    const spokenLines = filteredLines.filter((line) => line.speaker !== 'tong');
    const dialogueLines = lineToDialogue(spokenLines);
    if (dialogueLines.length) {
      setMessages((prev) => [...prev, ...dialogueLines]);
    }
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

  async function quickStartHangout(userIdOverride?: string) {
    const sessionUserId = userIdOverride || activeUserId;
    try {
      setLoadingStart(true);
      setError(null);
      setMode('hangout');
      setStatus(`Preparing ${cityConfig.label} · ${LOCATION_LABELS[location]}...`);
      resetSceneState(location, city);

      const game = await startOrResumeGame({
        userId: sessionUserId,
        city,
        profile: buildProfileFromGauge(proficiencyGauge),
        randomizeCharacter,
        preferRomance: true,
      });
      setSessionId(game.sessionId);
      setEngineMode(game.engineMode || 'scripted_fallback');
      setRelationshipState(game.relationshipState || null);
      setRouteState(game.routeState || null);
      setProgressionLoop(game.progressionLoop || null);
      if (game.progression) {
        setScore({
          xp: game.progression.xp,
          sp: game.progression.sp,
          rp: game.progression.rp,
        });
      } else {
        setScore({ xp: 0, sp: 0, rp: 0 });
      }

      const nextObjective = await fetchObjectiveNext({
        userId: sessionUserId,
        city,
        location,
        mode: 'hangout',
        lang: selectedLang,
      });
      setObjective(nextObjective);

      const hangout = await startHangout({
        objectiveId: nextObjective.objectiveId,
        userId: sessionUserId,
        sessionId: game.sessionId,
        city,
        location,
        lang: selectedLang,
        randomizeCharacter,
        preferRomance: true,
      });

      setSceneSessionId(hangout.sceneSessionId);
      setShowSetupPanel(false);
      setStatus(`${cityConfig.label} hangout live.`);
      setEngineMode(hangout.engineMode || game.engineMode || 'scripted_fallback');
      setCharacter((current) => mergeCharacterPayload(current, hangout.character || hangout.npc));
      setScore(hangout.state.score);
      setRelationshipState(hangout.relationshipState || hangout.state.relationshipState || null);
      setRouteState(hangout.routeState || hangout.state.routeState || game.routeState || null);
      setProgressionLoop(hangout.progressionLoop || hangout.state.progressionLoop || null);

      const startProgress =
        getObjectiveRatio(hangout.state.objectiveProgress) ?? getObjectiveRatio(hangout.objectiveProgress);
      if (startProgress !== null) {
        setObjectiveRatio(startProgress);
      }

      applyServerReplies(hangout.quickReplies);
      const renderHint = extractRenderHint(hangout.renderOps);
      setTongHint(renderHint || (hangout.tongHint || '').trim() || null);
      const renderReplies = extractRenderReplies(hangout.renderOps);
      if (renderReplies) applyServerReplies(renderReplies);
      const renderLines = extractRenderLines(hangout.renderOps);
      const openingLines =
        renderLines.length > 0
          ? renderLines
          : hangout.initialLines && hangout.initialLines.length > 0
            ? hangout.initialLines
            : [hangout.initialLine];
      mergeIncomingLines(openingLines, true);
      return true;
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : `Failed to start the ${cityConfig.label} hangout.`);
      setStatus('Start failed. Try again.');
      return false;
    } finally {
      setLoadingStart(false);
    }
  }

  async function sendHangoutTurn(presetText?: string) {
    if (!sceneSessionId) {
      setError('Start or resume first to open the hangout scene.');
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
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        speaker: 'you',
        text: utterance,
      },
    ]);

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
      setProgressionLoop(
        response.progressionLoop ||
          response.state.progressionLoop ||
          response.feedback.progressionLoop ||
          (response.completionSummary?.progressionLoop
            ? {
                masteryTier: response.completionSummary.progressionLoop.masteryTier || progressionLoop?.masteryTier || 1,
                learnReadiness:
                  response.completionSummary.progressionLoop.learnReadiness || progressionLoop?.learnReadiness || 0,
                missionGate: {
                  status:
                    (response.completionSummary.progressionLoop.missionGateStatus as
                      | 'locked'
                      | 'ready'
                      | 'passed'
                      | undefined) || progressionLoop?.missionGate.status || 'locked',
                  requiredValidatedHangouts: progressionLoop?.missionGate.requiredValidatedHangouts || 2,
                  validatedHangouts:
                    response.completionSummary.progressionLoop.validatedHangouts ||
                    progressionLoop?.missionGate.validatedHangouts ||
                    0,
                },
              }
            : null),
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
        renderLines.length > 0 ? renderLines : response.nextLines && response.nextLines.length > 0 ? response.nextLines : [response.nextLine];
      mergeIncomingLines(nextLines, true);

      if (response.completion?.isCompleted) {
        if (response.completion.completionSignal === 'objective_validated') {
          setStatus('Objective validated. Mission gate progress updated.');
        } else {
          setStatus('Scene complete. Retry once more to fully validate objective.');
        }
      }
    } catch (turnError) {
      setError(turnError instanceof Error ? turnError.message : 'Failed to send your scene response.');
      setPendingUserLine(null);
      setAwaitingUserTurn(true);
    } finally {
      setSendingTurn(false);
    }
  }

  async function refreshLearnSessions() {
    try {
      setLoadingLearn(true);
      setError(null);
      const sessions = await fetchLearnSessions({ userId: activeUserId, city, lang: selectedLang });
      setLearnSessions(sessions.items);
    } catch (learnError) {
      setError(learnError instanceof Error ? learnError.message : 'Failed to load learn sessions.');
    } finally {
      setLoadingLearn(false);
    }
  }

  async function startNewLearnSession() {
    try {
      setLoadingLearn(true);
      setError(null);
      const created = await createLearnSession({
        objectiveId: objective?.objectiveId || 'ko_food_l2_001',
        userId: activeUserId,
        city,
        lang: selectedLang,
      });
      setLearnMessage(created.firstMessage.text);
      await refreshLearnSessions();
    } catch (learnError) {
      setError(learnError instanceof Error ? learnError.message : 'Failed to start learn session.');
    } finally {
      setLoadingLearn(false);
    }
  }

  async function runMissionAssessment() {
    if (!sessionId) {
      setError('Start or resume a game session first.');
      return;
    }

    try {
      setError(null);
      const mission = await assessMission({
        userId: activeUserId,
        sessionId,
        city,
        location,
        lang: selectedLang,
      });
      setProgressionLoop(mission.progressionLoop);
      setRelationshipState(mission.relationshipState || null);
      setRouteState(mission.routeState || routeState || null);
      if (mission.rewards) {
        setScore((previous) => ({
          xp: previous.xp + mission.rewards!.xp,
          sp: previous.sp + mission.rewards!.sp,
          rp: previous.rp + mission.rewards!.rp,
        }));
      }
      setStatus(mission.message);
    } catch (missionError) {
      setError(missionError instanceof Error ? missionError.message : 'Mission assessment failed.');
    }
  }

  async function completeOnboardingAndLaunch() {
    const started = await quickStartHangout();
    if (!started) return;
    setEntryPhase('playing');
    setShowSetupPanel(false);
    setStatus(`${cityConfig.label} hangout live.`);
  }

  return (
    <main className={`game-root ${entryPhase === 'playing' ? 'game-root-playing' : 'game-root-entry'}`}>
      {entryPhase !== 'playing' && (
        <section className="game-opening-stage">
          <div className="game-opening-ambient" aria-hidden>
            <span className="game-opening-blob game-opening-blob-a" />
            <span className="game-opening-blob game-opening-blob-b" />
            <span className="game-opening-blob game-opening-blob-c" />
          </div>
          <div className="game-opening-scrim" />
          <article className="mobile-frame game-opening-mobile-frame">
            {entryPhase === 'opening' ? (
              <div className="game-opening-intro-wrap">
                <video
                  ref={openingVideoRef}
                  className="game-opening-intro-video"
                  src={OPENING_ANIMATION_PATH}
                  autoPlay
                  muted
                  playsInline
                  preload="auto"
                  onLoadedMetadata={(event) => {
                    if (event.currentTarget.currentTime < 0.12) {
                      event.currentTarget.currentTime = 0.12;
                    }
                  }}
                  onEnded={finishOpeningAnimation}
                  onError={finishOpeningAnimation}
                />
                <p className="game-opening-loading">Preparing your first scene...</p>
                {needsIntroTap && (
                  <button className="secondary" type="button" onClick={() => void openingVideoRef.current?.play()}>
                    Tap To Play Intro
                  </button>
                )}
              </div>
            ) : (
              <div
                className={`game-opening-content ${entryPhase === 'entry' ? 'game-opening-content-centered' : ''}`}
              >
                {entryPhase === 'entry' && (
                  <>
                    <img className="game-opening-logo" src={GAME_LOGO_PATH} alt="Tong logo" />
                    <p className="game-opening-kicker">Tong</p>
                    <h1 className="game-opening-title">
                      <span>Live the drama.</span>
                      <span className="game-opening-title-accent">Learn the language.</span>
                    </h1>
                    <p className="game-opening-copy">
                      Start a new game. Tong will onboard you, then drop you into your first hangout.
                    </p>

                    <div className="game-opening-actions">
                      <button onClick={() => beginNewGame()}>Start New Game</button>
                      <button className="secondary" onClick={() => void resumeLatestGame()} disabled={!hasSavedUserId}>
                        Resume Last Session
                      </button>
                    </div>
                  </>
                )}

                {entryPhase === 'onboarding' && (
                  <div className="game-onboarding-shell">
                    <p className="game-opening-kicker">Starter Setup</p>
                    <p className="game-opening-copy game-onboarding-copy">
                      Set your baseline and jump into your first hangout challenge.
                    </p>

                    <div className="card stack game-onboarding-story">
                      <p className="game-card-kicker" style={{ margin: 0 }}>
                        Starter Setup
                      </p>
                      <div className="chat-bubble chat-tong">
                        Set your current proficiency in Korean, Japanese, and Chinese. Then Tong drops you straight into
                        your first Seoul hangout challenge.
                      </div>

                      <article className="game-slider-card stack">
                        <div className="row" style={{ alignItems: 'center' }}>
                          <p className="game-card-kicker" style={{ margin: 0 }}>
                            Language Gauge
                          </p>
                          <span className="pill">7 levels</span>
                        </div>
                        <p className="game-slider-copy">
                          Requested preset: Korean 0, Japanese 0, Chinese advanced. Tune anything before launch.
                        </p>
                        <div className="game-gauge-preset-row">
                          <button
                            className="secondary"
                            type="button"
                            onClick={() => applyGaugePreset('seoul')}
                            disabled={loadingStart}
                          >
                            Apply requested preset
                          </button>
                          <button
                            className="secondary"
                            type="button"
                            onClick={() => applyGaugePreset('balanced')}
                            disabled={loadingStart}
                          >
                            Balance all
                          </button>
                          <button
                            className="secondary"
                            type="button"
                            onClick={() => applyGaugePreset('starter')}
                            disabled={loadingStart}
                          >
                            Reset to zero
                          </button>
                        </div>
                        {CJK_LANG_ORDER.map((lang) => {
                          const level = gaugeLevelToProficiency(proficiencyGauge[lang]);
                          return (
                            <label key={lang} className="game-slider-row">
                              <div className="row">
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
                              <span className="game-slider-copy">{proficiencySubtitle(level)}</span>
                            </label>
                          );
                        })}
                      </article>

                      <div className="game-opening-actions">
                        <button type="button" onClick={() => void completeOnboardingAndLaunch()} disabled={loadingStart}>
                          {loadingStart ? 'Launching Challenge...' : 'Start First Hangout Challenge'}
                        </button>
                        <button
                          className="secondary"
                          type="button"
                          onClick={() => setEntryPhase('entry')}
                          disabled={loadingStart}
                        >
                          Back
                        </button>
                      </div>
                      <p className="game-status">{status}</p>
                      {error && <p className="game-error">{error}</p>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </article>
        </section>
      )}

      {entryPhase === 'playing' && (
        <section className="game-mobile-wrap">
          <article
            className={`mobile-frame game-mobile-frame ${showSceneOneBackdrop ? 'game-mobile-frame-scene1' : ''}`}
            style={sceneOneBackdropStyle}
          >
            <div className={`mobile-head game-mobile-head ${mode === 'hangout' ? 'game-mobile-head-hangout' : ''}`}>
              <div className={`row game-head-row ${mode === 'hangout' ? 'game-head-row-hangout' : ''}`}>
                <div className="stack" style={{ gap: 4 }}>
                  <p className="game-mobile-kicker">
                    {cityConfig.label.toUpperCase()} · {LOCATION_LABELS[location].toUpperCase()}
                  </p>
                  <strong>
                    {mode === 'hangout' ? `${character.name || cityConfig.label} hangout` : `${cityConfig.languageLabel} learn`}
                  </strong>
                </div>
                <div className="game-head-actions">
                  <button
                    className={`secondary game-head-button ${mode === 'learn' ? 'active' : ''}`}
                    type="button"
                    onClick={() => setMode((current) => (current === 'hangout' ? 'learn' : 'hangout'))}
                  >
                    {mode === 'hangout' ? 'Learn' : 'Hangout'}
                  </button>
                  <button
                    className={`secondary game-head-button ${showSetupPanel ? 'active' : ''}`}
                    type="button"
                    onClick={() => setShowSetupPanel((current) => !current)}
                  >
                    {showSetupPanel ? 'Close' : 'World'}
                  </button>
                </div>
              </div>
            </div>

            <div className={`mobile-body game-mobile-body ${showSceneOneBackdrop ? 'game-mobile-body-scene1' : ''}`}>
              {showSetupPanel && (
                <section className="game-world-panel stack">
                  <p className="game-card-kicker" style={{ margin: 0 }}>
                    World setup
                  </p>

                  {hasCompletedFirstHangout ? (
                    <article className="game-map-card stack">
                      <div className="row">
                        <p className="game-card-kicker" style={{ margin: 0 }}>
                          Swipe map
                        </p>
                        <span className="pill">{cityConfig.label}</span>
                      </div>
                      <div className="game-city-track" ref={cityTrackRef} onScroll={handleCityTrackScroll}>
                        {CITY_DEFINITIONS.map((cityOption) => (
                          <button
                            key={cityOption.id}
                            type="button"
                            className={`game-city-card ${cityOption.id === city ? 'active' : ''}`}
                            onClick={() => handleCityCardPress(cityOption.id)}
                          >
                            <div className="game-city-media">
                              {cityOption.backdropVideo && cityOption.id === city ? (
                                <video
                                  className="game-city-backdrop"
                                  poster={cityOption.backdropImage}
                                  src={cityOption.backdropVideo}
                                  autoPlay
                                  muted
                                  loop
                                  playsInline
                                />
                              ) : (
                                <img
                                  className="game-city-backdrop"
                                  src={cityOption.backdropImage}
                                  alt={`${cityOption.label} backdrop`}
                                />
                              )}
                              <div className="game-city-overlay">
                                <p>{cityMapHint(cityOption.mapPosition)}</p>
                                <strong>{cityOption.label}</strong>
                                <span>
                                  {cityOption.languageLabel} · {cityOption.vibe}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </article>
                  ) : (
                    <article className="game-map-card stack game-map-locked">
                      <p className="game-city-hint">
                        City map unlocks after the first completed hangout challenge.
                      </p>
                    </article>
                  )}

                  <article className="game-slider-card stack">
                    <p className="game-card-kicker" style={{ margin: 0 }}>
                      Language gauge
                    </p>
                    {CJK_LANG_ORDER.map((lang) => {
                      const level = gaugeLevelToProficiency(proficiencyGauge[lang]);
                      return (
                        <label key={lang} className="game-slider-row">
                          <div className="row">
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
                        </label>
                      );
                    })}
                  </article>

                  <article className="game-slider-card stack">
                    <p className="game-card-kicker" style={{ margin: 0 }}>
                      Scene setup
                    </p>
                    <div className="game-location-row">
                      {LOCATIONS.map((item) => (
                        <button
                          key={item}
                          className={`game-location-pill ${item === location ? 'active' : ''}`}
                          onClick={() => handleLocationChange(item)}
                        >
                          {LOCATION_LABELS[item]}
                        </button>
                      ))}
                    </div>
                    <label className="row" style={{ alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={randomizeCharacter}
                        onChange={(event) => setRandomizeCharacter(event.target.checked)}
                      />
                      <span>Randomize character next launch</span>
                    </label>
                    <button onClick={() => void quickStartHangout()} disabled={loadingStart}>
                      {loadingStart
                        ? 'Starting...'
                        : sceneSessionId
                          ? `Restart ${cityConfig.label} hangout`
                          : `Start ${cityConfig.label} hangout`}
                    </button>
                    {progressionLoop?.missionGate.status === 'ready' && (
                      <button className="secondary" onClick={() => void runMissionAssessment()}>
                        Run mission assessment
                      </button>
                    )}
                    <p className="game-status">
                      Engine: {engineMode === 'dynamic_ai' ? 'Dynamic AI' : 'Scripted fallback'} · Bond:{' '}
                      {routeState?.stage || relationshipState?.stage || 'stranger'}
                    </p>
                    <p className="game-status">{status}</p>
                    {error && <p className="game-error">{error}</p>}
                  </article>
                </section>
              )}

              {mode === 'hangout' && (
                <>
                  <SceneView
                    backgroundUrl={city === 'seoul' ? SEOUL_FIRST_SCENE_BACKDROP : cityConfig.backdropImage}
                    tongHint={tongHint}
                    onDismissTong={() => setTongHint(null)}
                    speakerName={activeSpeakerLabel}
                    avatarUrl={!pendingUserLine && activeSceneLine?.speaker === 'character' && !avatarLoadFailed ? characterAvatarSrc : null}
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
                    launchPending={isDirectHangoutPending}
                    launchError={autoLaunchHangout && !sceneSessionId ? error : null}
                    onRetryLaunch={() => void quickStartHangout(activeUserId)}
                  />
                </>
              )}

              {mode === 'learn' && (
                <>
                  <section className="game-learn-head stack">
                    <h3 style={{ margin: 0 }}>{cityConfig.label} learn chat sessions</h3>
                    <p style={{ margin: 0 }}>
                      Review previous {cityConfig.languageLabel} sessions or launch a new objective-focused drill.
                    </p>
                    <div className="row">
                      <button className="secondary" onClick={() => void refreshLearnSessions()} disabled={loadingLearn}>
                        View previous sessions
                      </button>
                      <button onClick={() => void startNewLearnSession()} disabled={loadingLearn}>
                        Start new session
                      </button>
                    </div>
                  </section>

                  {learnMessage && <div className="chat-bubble chat-tong">Tong: {learnMessage}</div>}
                  {loadingLearn && <p>Loading learn sessions...</p>}
                  {!loadingLearn && learnSessions.length === 0 && <p>No prior sessions yet.</p>}
                  {error && <p className="game-error">{error}</p>}

                  <section className="stack">
                    {learnSessions.map((session) => (
                      <article key={session.learnSessionId} className="game-learn-item">
                        <div className="row" style={{ alignItems: 'flex-start' }}>
                          <div>
                            <strong>{session.title}</strong>
                            <p>Objective: {session.objectiveId}</p>
                          </div>
                          <span className="pill">{new Date(session.lastMessageAt).toLocaleDateString()}</span>
                        </div>
                      </article>
                    ))}
                  </section>
                </>
              )}
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
