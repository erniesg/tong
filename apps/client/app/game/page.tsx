'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
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

interface DialogueMessage {
  id: string;
  speaker: 'character' | 'you';
  text: string;
}

interface PresetResponse {
  text: string;
  note: string;
}

type CjkLang = 'ko' | 'ja' | 'zh';
type EntryPhase = 'opening' | 'entry' | 'onboarding' | 'playing';

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
    cafe: { name: 'Ding', role: 'Primary romance route lead', avatarEmoji: 'DG', mood: 'charming' },
    convenience_store: { name: 'Min', role: 'Store clerk', avatarEmoji: 'CV', mood: 'helpful' },
    subway_hub: { name: 'Haneul', role: 'Commuter guide', avatarEmoji: 'SB', mood: 'focused' },
    practice_studio: { name: 'Ara', role: 'Practice partner', avatarEmoji: 'PS', mood: 'energetic' },
  },
  tokyo: {
    food_street: { name: 'Haeun', role: 'Primary romance route lead', avatarEmoji: 'HR', mood: 'warm' },
    cafe: { name: 'Ding', role: 'Primary romance route lead', avatarEmoji: 'DG', mood: 'charming' },
    convenience_store: { name: 'Sora', role: 'Store clerk', avatarEmoji: 'CV', mood: 'helpful' },
    subway_hub: { name: 'Daichi', role: 'Commuter guide', avatarEmoji: 'SB', mood: 'focused' },
    practice_studio: { name: 'Mika', role: 'Practice partner', avatarEmoji: 'PS', mood: 'energetic' },
  },
  shanghai: {
    food_street: { name: 'Haeun', role: 'Primary romance route lead', avatarEmoji: 'HR', mood: 'warm' },
    cafe: { name: 'Ding', role: 'Primary romance route lead', avatarEmoji: 'DG', mood: 'charming' },
    convenience_store: { name: 'Bo', role: 'Store clerk', avatarEmoji: 'CV', mood: 'helpful' },
    subway_hub: { name: 'Wei', role: 'Commuter guide', avatarEmoji: 'SB', mood: 'focused' },
    practice_studio: { name: 'Qin', role: 'Practice partner', avatarEmoji: 'PS', mood: 'energetic' },
  },
};

const DEFAULT_PRESET_RESPONSES: PresetResponse[] = [
  { text: '떡볶이 주세요.', note: 'Order tteokbokki' },
  { text: '보통맛으로 해주세요.', note: 'Set spice level' },
  { text: '한 개 주세요, 감사합니다.', note: 'Confirm quantity politely' },
  { text: '포장해 주세요.', note: 'Ask for takeout' },
  { text: '물도 주세요.', note: 'Ask for water' },
];

const INITIAL_HINT = 'Tong hint: Use one short polite order phrase per turn.';
const ACTIVE_USER_ID_STORAGE_KEY = 'tong_active_user_id';
const GAME_LOGO_PATH = '/assets/app/logo_transparent.png';
const OPENING_ANIMATION_PATH = '/assets/app/tong_opening.mp4';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lineToHint(lines: SceneLine[]): string | null {
  for (const line of lines) {
    if (line.speaker === 'tong' && line.text.trim()) return line.text;
  }
  return null;
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

function buildObjectiveSummary(objective: ObjectiveNextResponse | null): string {
  if (!objective) return 'Validate practical food-order language in context.';
  const vocab = objective.coreTargets.vocabulary.slice(0, 2).join(', ');
  const grammar = objective.coreTargets.grammar[0];
  if (!vocab && !grammar) return 'Validate practical food-order language in context.';
  if (vocab && grammar) return `Use ${vocab} with ${grammar}.`;
  return `Use ${vocab || grammar} naturally in scene dialogue.`;
}

function mergeCharacterPayload(base: SceneCharacter, payload?: SceneCharacter): SceneCharacter {
  if (!payload) return base;
  return {
    ...base,
    ...payload,
    avatarEmoji: payload.avatarEmoji || base.avatarEmoji,
  };
}

function getCharacterAvatarPath(value?: SceneCharacter): string | null {
  if (!value) return null;
  if (value.assetKey) return `/assets/characters/${value.assetKey}`;

  if (value.id === 'npc_haeun') return '/assets/characters/hauen/haeun.png';
  if (value.id === 'npc_ding_man') return '/assets/characters/ding_man/ding_man.png';

  const safeName = (value.name || '').toLowerCase();
  if (safeName === 'haeun') return '/assets/characters/hauen/haeun.png';
  if (safeName === 'ding') return '/assets/characters/ding_man/ding_man.png';
  return null;
}

function getCharacterForCityLocation(city: CityId, location: LocationId): SceneCharacter {
  return LOCATION_CHARACTERS_BY_CITY[city]?.[location] || LOCATION_CHARACTERS_BY_CITY[DEFAULT_CITY][DEFAULT_LOCATION];
}

function sliderToProficiency(value: number): ProficiencyLevel {
  if (value <= 0) return 'none';
  if (value <= 35) return 'beginner';
  if (value <= 65) return 'intermediate';
  if (value <= 85) return 'advanced';
  return 'native';
}

function proficiencyLabel(level: ProficiencyLevel): string {
  if (level === 'none') return 'None';
  if (level === 'beginner') return 'Beginner';
  if (level === 'intermediate') return 'Intermediate';
  if (level === 'advanced') return 'Advanced';
  return 'Native';
}

function buildProfileFromGauge(gauge: Record<CjkLang, number>): GameProfile {
  return {
    nativeLanguage: 'en',
    targetLanguages: ['ko', 'ja', 'zh'],
    proficiency: {
      ko: sliderToProficiency(gauge.ko),
      ja: sliderToProficiency(gauge.ja),
      zh: sliderToProficiency(gauge.zh),
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

export default function GamePage() {
  const cityTrackRef = useRef<HTMLDivElement | null>(null);
  const openingVideoRef = useRef<HTMLVideoElement | null>(null);

  const [entryPhase, setEntryPhase] = useState<EntryPhase>('opening');
  const [activeUserId, setActiveUserId] = useState('demo-user-1');
  const [hasSavedUserId, setHasSavedUserId] = useState(false);
  const [showSetupPanel, setShowSetupPanel] = useState(false);

  const [mode, setMode] = useState<'hangout' | 'learn'>('hangout');
  const [city, setCity] = useState<CityId>(DEFAULT_CITY);
  const [location, setLocation] = useState<LocationId>(DEFAULT_LOCATION);
  const [proficiencyGauge, setProficiencyGauge] = useState<Record<CjkLang, number>>({
    ko: 58,
    ja: 20,
    zh: 22,
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
  const [hint, setHint] = useState(INITIAL_HINT);
  const [status, setStatus] = useState('Set your language baseline, then start your first hangout challenge.');
  const [messages, setMessages] = useState<DialogueMessage[]>([]);
  const [userUtterance, setUserUtterance] = useState('');
  const [presetResponses, setPresetResponses] = useState<PresetResponse[]>(DEFAULT_PRESET_RESPONSES);

  const [learnSessions, setLearnSessions] = useState<LearnSession[]>([]);
  const [learnMessage, setLearnMessage] = useState('');

  const [loadingStart, setLoadingStart] = useState(false);
  const [sendingTurn, setSendingTurn] = useState(false);
  const [loadingLearn, setLoadingLearn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [needsIntroTap, setNeedsIntroTap] = useState(false);

  const cityConfig = CITY_BY_ID[city];
  const selectedLang = cityConfig.language;
  const objectiveSummary = useMemo(() => buildObjectiveSummary(objective), [objective]);

  const requiredTurns = objective?.completionCriteria.requiredTurns ?? 4;
  const objectivePercent = Math.round(objectiveRatio * 100);
  const objectiveTurnProgress = Math.min(requiredTurns, Math.round(objectiveRatio * requiredTurns));
  const validatedHangouts = routeState?.validatedHangouts ?? progressionLoop?.missionGate.validatedHangouts ?? 0;
  const hasCompletedFirstHangout = validatedHangouts >= 1;
  const showSceneOneBackdrop = mode === 'hangout' && !hasCompletedFirstHangout;
  const characterAvatarSrc = getCharacterAvatarPath(character);
  const sceneOneBackdropStyle = showSceneOneBackdrop
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(14, 20, 28, 0.3), rgba(14, 20, 28, 0.72)), url(${cityConfig.backdropImage})`,
      }
    : undefined;

  const scorePercent = useMemo(() => {
    return {
      xp: Math.min(100, score.xp * 2.5),
      sp: Math.min(100, score.sp * 8),
      rp: Math.min(100, score.rp * 10),
    };
  }, [score]);

  useEffect(() => {
    const track = cityTrackRef.current;
    if (!track) return;
    const initialIndex = CITY_ORDER.indexOf(DEFAULT_CITY);
    track.scrollTo({ left: initialIndex * track.clientWidth, behavior: 'auto' });
  }, []);

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
  }, [characterAvatarSrc]);

  function resetSceneState(nextLocation: LocationId, nextCity: CityId = city) {
    setSceneSessionId(null);
    setObjective(null);
    setObjectiveRatio(0);
    setMessages([]);
    setUserUtterance('');
    setPresetResponses(DEFAULT_PRESET_RESPONSES);
    setCharacter(getCharacterForCityLocation(nextCity, nextLocation));
    setHint(INITIAL_HINT);
  }

  function persistActiveUserId(nextUserId: string) {
    setActiveUserId(nextUserId);
    setHasSavedUserId(true);
    window.localStorage.setItem(ACTIVE_USER_ID_STORAGE_KEY, nextUserId);
  }

  function finishOpeningAnimation() {
    setEntryPhase((current) => (current === 'opening' ? 'entry' : current));
  }

  function beginNewGame() {
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
    setEntryPhase('onboarding');
    setShowSetupPanel(false);
    resetSceneState(DEFAULT_LOCATION, DEFAULT_CITY);
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
      [lang]: nextValue,
    }));
  }

  function handleLocationChange(nextLocation: LocationId) {
    setLocation(nextLocation);
    resetSceneState(nextLocation, city);
    setStatus(`${cityConfig.label} · ${LOCATION_LABELS[nextLocation]} selected. Start or resume to enter the scene.`);
  }

  function applyServerReplies(replies?: string[]) {
    if (!replies?.length) return;
    setPresetResponses(replies.slice(0, 6).map((text) => ({ text, note: 'Suggested reply' })));
  }

  function mergeIncomingLines(lines: SceneLine[]) {
    const nextHint = lineToHint(lines);
    const dialogueLines = lineToDialogue(lines);
    if (nextHint) setHint(nextHint);
    if (dialogueLines.length) {
      setMessages((prev) => [...prev, ...dialogueLines]);
    }
  }

  async function quickStartHangout() {
    try {
      setLoadingStart(true);
      setError(null);
      setMode('hangout');
      setStatus(`Preparing ${cityConfig.label} · ${LOCATION_LABELS[location]}...`);
      resetSceneState(location, city);

      const game = await startOrResumeGame({
        userId: activeUserId,
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
        userId: activeUserId,
        city,
        location,
        mode: 'hangout',
        lang: selectedLang,
      });
      setObjective(nextObjective);

      const hangout = await startHangout({
        objectiveId: nextObjective.objectiveId,
        userId: activeUserId,
        sessionId: game.sessionId,
        city,
        location,
        lang: selectedLang,
        randomizeCharacter,
        preferRomance: true,
      });

      setSceneSessionId(hangout.sceneSessionId);
      setStatus(`${cityConfig.label} hangout live. Use a preset phrase to test flow quickly.`);
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
      const openingLines =
        hangout.initialLines && hangout.initialLines.length > 0 ? hangout.initialLines : [hangout.initialLine];
      mergeIncomingLines(openingLines);
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
      setHint(response.feedback.tongHint || INITIAL_HINT);
      setCharacter((current) => mergeCharacterPayload(current, response.character || response.npc));
      applyServerReplies(response.feedback.suggestedReplies);
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

      const nextLines =
        response.nextLines && response.nextLines.length > 0 ? response.nextLines : [response.nextLine];
      mergeIncomingLines(nextLines);

      if (response.completion?.isCompleted) {
        if (response.completion.completionSignal === 'objective_validated') {
          setStatus('Objective validated. Mission gate progress updated.');
        } else {
          setStatus('Scene complete. Retry once more to fully validate objective.');
        }
      }
    } catch (turnError) {
      setError(turnError instanceof Error ? turnError.message : 'Failed to send your scene response.');
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
    <main className="app-shell game-shell">
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
              <div className="game-opening-content">
                <img className="game-opening-logo" src={GAME_LOGO_PATH} alt="Tong logo" />
                <p className="game-opening-kicker">Tong</p>
                <h1 className="game-opening-title">
                  <span>Live the drama.</span>
                  <span className="game-opening-title-accent">Learn the language.</span>
                </h1>
                <p className="game-opening-copy">Start a new game. Tong will onboard you, then drop you into your first hangout.</p>

                {entryPhase === 'entry' && (
                  <div className="game-opening-actions">
                    <button onClick={() => beginNewGame()}>Start New Game</button>
                    <button className="secondary" onClick={() => void resumeLatestGame()} disabled={!hasSavedUserId}>
                      Resume Last Session
                    </button>
                  </div>
                )}

                {entryPhase === 'onboarding' && (
                  <div className="card stack game-onboarding-story">
                    <p className="game-card-kicker" style={{ margin: 0 }}>
                      Starter Setup
                    </p>
                    <div className="chat-bubble chat-tong">
                      Set your current proficiency in Korean, Japanese, and Chinese. Then we begin your first hangout
                      challenge in Seoul.
                    </div>

                    <article className="game-slider-card stack">
                      <p className="game-card-kicker" style={{ margin: 0 }}>
                        Language Gauge
                      </p>
                      {CJK_LANG_ORDER.map((lang) => {
                        const level = sliderToProficiency(proficiencyGauge[lang]);
                        return (
                          <label key={lang} className="game-slider-row">
                            <div className="row">
                              <strong>
                                {LANGUAGE_LABELS[lang]} ({lang.toUpperCase()})
                              </strong>
                              <span>
                                {proficiencyGauge[lang]} · {proficiencyLabel(level)}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={1}
                              value={proficiencyGauge[lang]}
                              onChange={(event) => handleProficiencyChange(lang, Number(event.target.value))}
                            />
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
                )}
              </div>
            )}
          </article>
        </section>
      )}

      {entryPhase === 'playing' && (
        <>
          <header className="page-header">
            <p className="kicker">Game Story Mode</p>
            <h1 className="page-title">Onboard with Tong, then drop into your hangout</h1>
            <p className="page-copy">
              Story-first flow: opening animation, onboarding, then immediate in-scene practice.
            </p>
            <div className="nav-links">
              <Link href="/" className="nav-link">
                Home
              </Link>
              <Link href="/overlay" className="nav-link">
                Overlay
              </Link>
              <Link href="/insights" className="nav-link">
                Insights
              </Link>
              <button className="nav-link" onClick={() => setShowSetupPanel((current) => !current)}>
                {showSetupPanel ? 'Hide setup' : 'Show setup'}
              </button>
            </div>
          </header>

          {showSetupPanel && (
            <section className="card stack game-quickstart-card">
              <div className="row">
                <div className="stack" style={{ gap: 6 }}>
                  <span className="pill">City Onboarding</span>
                  <h2 className="game-section-title">CJK gauge + swipe map</h2>
                </div>
                <span className="pill">{sceneSessionId ? 'Hangout live' : sessionId ? 'Session ready' : 'New game'}</span>
              </div>

              <div className="game-onboarding-grid">
                {hasCompletedFirstHangout ? (
                  <article className="game-map-card stack">
                    <div className="row">
                      <p className="game-card-kicker" style={{ margin: 0 }}>
                        Swipe Map
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
                    <p className="game-city-hint">
                      Swipe left for Tokyo (Japanese), keep Seoul in center (Korean), and swipe right for Shanghai (Chinese).
                    </p>
                  </article>
                ) : (
                  <article className="game-map-card stack game-map-locked">
                    <p className="game-card-kicker" style={{ margin: 0 }}>
                      Swipe Map
                    </p>
                    <p className="game-city-hint">
                      City map video unlocks after your first completed hangout. Finish Scene 1 first.
                    </p>
                  </article>
                )}

                <article className="game-slider-card stack">
                  <p className="game-card-kicker" style={{ margin: 0 }}>
                    Proficiency Sliders
                  </p>
                  <p className="game-slider-copy">Set your current level by language. Tong uses this profile at start/resume.</p>
                  {CJK_LANG_ORDER.map((lang) => {
                    const level = sliderToProficiency(proficiencyGauge[lang]);
                    return (
                      <label key={lang} className="game-slider-row">
                        <div className="row">
                          <strong>
                            {LANGUAGE_LABELS[lang]} ({lang.toUpperCase()})
                          </strong>
                          <span>
                            {proficiencyGauge[lang]} · {proficiencyLabel(level)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={proficiencyGauge[lang]}
                          onChange={(event) => handleProficiencyChange(lang, Number(event.target.value))}
                        />
                      </label>
                    );
                  })}
                </article>
              </div>

              <div className="game-mode-toggle">
                <button className={mode === 'hangout' ? '' : 'secondary'} onClick={() => setMode('hangout')}>
                  Hangout Mode
                </button>
                <button className={mode === 'learn' ? '' : 'secondary'} onClick={() => setMode('learn')}>
                  Learn Mode
                </button>
              </div>

              <label className="row" style={{ alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={randomizeCharacter}
                  onChange={(event) => setRandomizeCharacter(event.target.checked)}
                />
                <span>Randomize character on next hangout start</span>
              </label>

              <button onClick={() => void quickStartHangout()} disabled={loadingStart}>
                {loadingStart
                  ? 'Starting...'
                  : sceneSessionId
                    ? `Restart ${cityConfig.label} Hangout`
                    : `Start or Resume ${cityConfig.label} Hangout`}
              </button>

              <p className="game-status">{status}</p>
              {error && <p className="game-error">{error}</p>}
            </section>
          )}

          <section className="game-mobile-wrap">
            <article className="mobile-frame game-mobile-frame">
              <div className="mobile-head game-mobile-head">
                <p className="game-mobile-kicker">City · Location</p>
                <div className="row">
                  <strong>
                    {cityConfig.label} · {LOCATION_LABELS[location]}
                  </strong>
                  <span className="pill">{mode}</span>
                </div>
                <div className="row" style={{ alignItems: 'center' }}>
                  <span className="pill">{cityConfig.languageLabel}</span>
                  <span className="pill">{routeState?.characterName ? `Route: ${routeState.characterName}` : 'Route: pending'}</span>
                </div>
                <div className="row" style={{ alignItems: 'center' }}>
                  <span className="pill">Engine: {engineMode === 'dynamic_ai' ? 'Dynamic AI' : 'Scripted Fallback'}</span>
                </div>
                <div className="row" style={{ alignItems: 'center' }}>
                  <span className="pill">Bond: {routeState?.stage || relationshipState?.stage || 'stranger'}</span>
                  <span className="pill">
                    Gate: {progressionLoop?.missionGate.status || 'locked'} ({progressionLoop?.missionGate.validatedHangouts || 0}/
                    {progressionLoop?.missionGate.requiredValidatedHangouts || 2})
                  </span>
                </div>
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
              </div>

              <div
                className={`mobile-body game-mobile-body ${showSceneOneBackdrop ? 'game-mobile-body-scene1' : ''}`}
                style={sceneOneBackdropStyle}
              >
                {mode === 'hangout' && (
                  <>
                    <section className="game-character-card">
                      <span className="game-character-avatar">
                        {characterAvatarSrc && !avatarLoadFailed ? (
                          <img
                            className="game-character-avatar-image"
                            src={characterAvatarSrc}
                            alt={`${character.name || 'Character'} avatar`}
                            onError={() => setAvatarLoadFailed(true)}
                          />
                        ) : (
                          character.avatarEmoji || selectedLang.toUpperCase()
                        )}
                      </span>
                      <div>
                        <p className="game-card-kicker">Hangout character</p>
                        <strong>{character.name || `${cityConfig.label} friend`}</strong>
                        <p>{character.role || 'Local conversation partner'}</p>
                        {routeState?.memoryNotes?.length ? (
                          <p>Recent memory: {routeState.memoryNotes[routeState.memoryNotes.length - 1]}</p>
                        ) : null}
                      </div>
                    </section>

                    <section className="game-progress-card stack">
                      <div>
                        <div className="row">
                          <strong>Objective progress</strong>
                          <span>
                            {objectiveTurnProgress}/{requiredTurns} turns
                          </span>
                        </div>
                        <p className="game-objective-copy">{objectiveSummary}</p>
                        <div className="metric-bar">
                          <div className="metric-fill game-progress-fill" style={{ width: `${objectivePercent}%` }} />
                        </div>
                      </div>

                      <div className="stack" style={{ gap: 8 }}>
                        <div className="row">
                          <span>Mastery Tier</span>
                          <span>{progressionLoop?.masteryTier || 1}</span>
                        </div>
                        <div>
                          <div className="row">
                            <span>Learn Readiness</span>
                            <span>{Math.round((progressionLoop?.learnReadiness || 0) * 100)}%</span>
                          </div>
                          <div className="metric-bar">
                            <div
                              className="metric-fill"
                              style={{ width: `${Math.round((progressionLoop?.learnReadiness || 0) * 100)}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="row">
                            <span>XP</span>
                            <span>{score.xp}</span>
                          </div>
                          <div className="metric-bar">
                            <div className="metric-fill" style={{ width: `${scorePercent.xp}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="row">
                            <span>SP</span>
                            <span>{score.sp}</span>
                          </div>
                          <div className="metric-bar">
                            <div className="metric-fill" style={{ width: `${scorePercent.sp}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="row">
                            <span>RP</span>
                            <span>{score.rp}</span>
                          </div>
                          <div className="metric-bar">
                            <div className="metric-fill" style={{ width: `${scorePercent.rp}%` }} />
                          </div>
                        </div>
                      </div>
                    </section>

                    {progressionLoop?.missionGate.status === 'ready' && (
                      <button onClick={() => void runMissionAssessment()}>Run mission assessment</button>
                    )}

                    <div className="chat-bubble chat-tong">
                      <strong>Tong hint:</strong> {hint}
                    </div>

                    <section className="game-dialogue-feed">
                      {messages.length === 0 && (
                        <p className="game-empty-state">Tap start to enter dialogue, then test with a preset phrase.</p>
                      )}
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`chat-bubble ${message.speaker === 'you' ? 'chat-user' : 'chat-character'}`}
                        >
                          {message.text}
                        </div>
                      ))}
                    </section>

                    <section className="game-chip-grid">
                      {presetResponses.map((preset) => (
                        <button
                          key={preset.text}
                          className="secondary game-chip"
                          onClick={() => void sendHangoutTurn(preset.text)}
                          disabled={!sceneSessionId || sendingTurn}
                        >
                          <span className="game-chip-main">{preset.text}</span>
                          <span className="game-chip-note">{preset.note}</span>
                        </button>
                      ))}
                    </section>

                    <div className="stack">
                      <textarea
                        rows={2}
                        value={userUtterance}
                        placeholder="Type your own response"
                        onChange={(event) => setUserUtterance(event.target.value)}
                      />
                      <button
                        onClick={() => void sendHangoutTurn()}
                        disabled={!sceneSessionId || !userUtterance.trim() || sendingTurn}
                      >
                        {sendingTurn ? 'Sending...' : 'Send response'}
                      </button>
                    </div>
                  </>
                )}

                {mode === 'learn' && (
                  <>
                    <section className="game-learn-head stack">
                      <h3 style={{ margin: 0 }}>{cityConfig.label} learn chat sessions</h3>
                      <p style={{ margin: 0 }}>
                        Review previous {cityConfig.languageLabel} sessions or launch a new objective-focused drill before
                        your next hangout.
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
        </>
      )}
    </main>
  );
}
