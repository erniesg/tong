'use client';

import { useEffect, useRef, useState } from 'react';
import {
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
  type ProficiencyLevel,
  type ProgressLoopState,
  type RelationshipState,
  type RouteState,
  type SceneCharacter,
  type SceneLine,
  type ScoreState,
} from '@/lib/api';
import { SceneView, type DialogueChoice } from '@/components/scene/SceneView';

type CjkLang = 'ko' | 'ja' | 'zh';
type EntryPhase = 'opening' | 'entry' | 'onboarding' | 'playing';
type ProficiencyGaugeLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type MapPosition = 'left' | 'center' | 'right';

interface PresetResponse {
  text: string;
  note?: string;
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

const GAME_LOGO_PATH = '/assets/app/logo_transparent.png';
const OPENING_ANIMATION_PATH = '/assets/app/tong_opening.mp4';
const SEOUL_FIRST_SCENE_BACKDROP = '/assets/scenes/scene1.png';

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
    options.push('/assets/characters/jin/jin.png');
    options.push('/assets/characters/ding_man/avatar.png');
    options.push('/assets/characters/ding_man/ding_man.png');
  }

  if (value.assetKey) {
    options.push(`/assets/characters/${value.assetKey}`);
  }

  return [...new Set(options)];
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
  const [loadingLearn, setLoadingLearn] = useState(false);
  const [needsIntroTap, setNeedsIntroTap] = useState(false);

  const [learnSessions, setLearnSessions] = useState<LearnSession[]>([]);
  const [learnMessage, setLearnMessage] = useState('');

  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [avatarPathIndex, setAvatarPathIndex] = useState(0);

  const cityConfig = CITY_BY_ID[city];
  const selectedLang = cityConfig.language;

  const characterAvatarOptions = getCharacterAvatarPaths(character);
  const characterAvatarSrc = characterAvatarOptions[avatarPathIndex] || null;

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

  useEffect(() => {
    if (mode !== 'learn' || entryPhase !== 'playing') return;
    void refreshLearnSessions();
  }, [mode, entryPhase, city, selectedLang, activeUserId]);

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
    setSessionId(null);
    setObjective(null);
    setRouteState(null);
    setRelationshipState(null);
    setProgressionLoop(null);
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

  async function quickStartHangout(userIdOverride?: string) {
    const sessionUserId = userIdOverride || activeUserId;

    try {
      setLoadingStart(true);
      setMode('hangout');
      setShowWorldPanel(false);
      setError(null);
      setStatus(`Preparing ${cityConfig.label} · ${LOCATION_LABELS[location]}...`);
      resetSceneState(location, city);

      const game = await startOrResumeGame({
        userId: sessionUserId,
        city,
        profile: buildProfileFromGauge(proficiencyGauge),
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
        preferRomance: true,
      });

      setSceneSessionId(hangout.sceneSessionId);
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
      setStatus(`${cityConfig.label} hangout live.`);
      return true;
    } catch (startError) {
      const message = startError instanceof Error ? startError.message : `Failed to start the ${cityConfig.label} hangout.`;
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

  function handleLocationChange(nextLocation: LocationId) {
    if (nextLocation === location) return;
    setLocation(nextLocation);
    resetSceneState(nextLocation, city);
    setStatus(`${cityConfig.label} · ${LOCATION_LABELS[nextLocation]} selected.`);
  }

  function handleCityChange(nextCity: CityId) {
    if (nextCity === city) return;
    setCity(nextCity);
    setLocation(DEFAULT_LOCATION);
    resetSceneState(DEFAULT_LOCATION, nextCity);
    setStatus(`${CITY_BY_ID[nextCity].label} selected.`);
  }

  function handleStartFromMenu() {
    beginNewGame('onboarding');
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
                    onClick={() => setShowWorldPanel((current) => !current)}
                  >
                    World
                  </button>
                </div>
              </header>

              {showWorldPanel && (
                <section className="tg-world-sheet">
                  <div className="tg-world-row">
                    {CITY_DEFINITIONS.map((cityOption) => (
                      <button
                        key={cityOption.id}
                        type="button"
                        className={`tg-city-pill ${cityOption.id === city ? 'active' : ''}`}
                        onClick={() => handleCityChange(cityOption.id)}
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
                        className={`tg-location-pill ${item === location ? 'active' : ''}`}
                        onClick={() => handleLocationChange(item)}
                      >
                        {LOCATION_LABELS[item]}
                      </button>
                    ))}
                  </div>

                  <button type="button" onClick={() => void quickStartHangout()} disabled={loadingStart}>
                    {loadingStart ? 'Starting...' : sceneSessionId ? 'Restart Hangout' : 'Start Hangout'}
                  </button>
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
                  <section className="tg-learn-panel">
                    <div className="tg-learn-header">
                      <h3>{cityConfig.label} learn sessions</h3>
                      <p>Session history + objective-focused drills.</p>
                      <div className="tg-actions">
                        <button className="tg-secondary" type="button" onClick={() => void refreshLearnSessions()}>
                          View previous sessions
                        </button>
                        <button type="button" onClick={() => void startNewLearnSession()}>
                          Start new session
                        </button>
                      </div>
                    </div>

                    {learnMessage && <p className="tg-learn-message">Tong: {learnMessage}</p>}
                    {loadingLearn && <p className="tg-status">Loading learn sessions...</p>}
                    {!loadingLearn && learnSessions.length === 0 && <p className="tg-status">No sessions yet.</p>}

                    <div className="tg-learn-list">
                      {learnSessions.map((session) => (
                        <article key={session.learnSessionId} className="tg-learn-item">
                          <strong>{session.title}</strong>
                          <p>{session.objectiveId}</p>
                          <span>{new Date(session.lastMessageAt).toLocaleDateString()}</span>
                        </article>
                      ))}
                    </div>
                  </section>
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
