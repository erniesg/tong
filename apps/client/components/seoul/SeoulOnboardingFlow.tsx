'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Background } from '@/components/scene/Background';
import { CharacterSprite } from '@/components/scene/CharacterSprite';
import { ChoiceButtons } from '@/components/scene/ChoiceButtons';
import { CinematicOverlay } from '@/components/scene/CinematicOverlay';
import { DialogueBox } from '@/components/scene/DialogueBox';
import { TongOverlay } from '@/components/scene/TongOverlay';
import { GameHUD } from '@/components/hud/GameHUD';
import { ExerciseModal } from '@/components/learn/ExerciseModal';
import { KoreanText } from '@/components/shared/KoreanText';
import {
  getSelectedReply,
  getSeoulJinOnboardingFlow,
  toDialogueChoices,
} from '@/lib/content/seoul/onboarding-flow';
import type { ExerciseData } from '@/lib/types/hangout';
import { dispatch, useGameState } from '@/lib/store/game-store';

type SeoulOnboardingPhase = 'arrival' | 'cinematic' | 'chat' | 'choice' | 'exercise' | 'complete';

interface StoredCheckpoint {
  phase: SeoulOnboardingPhase;
  tongIndex?: number;
  beatIndex?: number;
  selectedChoiceId?: string | null;
  completed?: boolean;
}

const CHECKPOINT_KEY = 'tong:seoul:onboarding:jin:h1';

function isStoredCheckpoint(value: unknown): value is StoredCheckpoint {
  if (!value || typeof value !== 'object') return false;
  const phase = (value as { phase?: unknown }).phase;
  return phase === 'arrival' || phase === 'cinematic' || phase === 'chat' || phase === 'choice' || phase === 'exercise' || phase === 'complete';
}

export function SeoulOnboardingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameState = useGameState();
  const shouldReset = searchParams.get('reset') === '1';
  const focus = searchParams.get('focus');
  const playerName = gameState.playerProfile.englishName || gameState.playerName || 'trainee';
  const flow = useMemo(() => getSeoulJinOnboardingFlow(playerName), [playerName]);
  const [phase, setPhase] = useState<SeoulOnboardingPhase>('arrival');
  const [tongIndex, setTongIndex] = useState(0);
  const [beatIndex, setBeatIndex] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [currentExercise, setCurrentExercise] = useState<ExerciseData | null>(null);
  const [completed, setCompleted] = useState(false);

  const activeBeat = flow.dialogueBeats[beatIndex] ?? flow.dialogueBeats[0];
  const selectedReply = getSelectedReply(flow.dialogueBeats[1]?.choices ?? [], selectedChoiceId);
  const beatText = activeBeat.id === 'you-reply' ? selectedReply.reply : activeBeat.text;
  const beatTranslation = activeBeat.id === 'you-reply' ? selectedReply.translation : activeBeat.translation;
  const explainLang = gameState.explainIn.seoul ?? 'en';

  const writeCheckpoint = useCallback((checkpoint: StoredCheckpoint) => {
    try {
      window.localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint));
    } catch {
      // Resume is useful, but the route should not fail if storage is blocked.
    }
  }, []);

  useEffect(() => {
    if (shouldReset) {
      window.localStorage.removeItem(CHECKPOINT_KEY);
      setTongIndex(0);
      setBeatIndex(0);
      setSelectedChoiceId(null);
      setCurrentExercise(null);
      setCompleted(false);
      if (focus === 'reveal') {
        setPhase('cinematic');
      } else if (focus === 'chat') {
        setPhase('chat');
      } else if (focus === 'complete') {
        setPhase('complete');
        setCompleted(true);
      } else {
        setPhase('arrival');
      }
      return;
    }

    try {
      const raw = window.localStorage.getItem(CHECKPOINT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!isStoredCheckpoint(parsed)) return;
      setPhase(parsed.phase);
      setTongIndex(parsed.tongIndex ?? 0);
      const restoredBeatIndex = parsed.beatIndex ?? 0;
      setBeatIndex(restoredBeatIndex);
      setSelectedChoiceId(parsed.selectedChoiceId ?? null);
      setCompleted(Boolean(parsed.completed));
      setCurrentExercise(
        parsed.phase === 'exercise'
          ? flow.dialogueBeats[restoredBeatIndex]?.exerciseAfter ?? null
          : null,
      );
    } catch {
      window.localStorage.removeItem(CHECKPOINT_KEY);
    }
  }, [flow.dialogueBeats, focus, shouldReset]);

  const completeFlow = useCallback(() => {
    if (completed) return;
    setCompleted(true);
    setPhase('complete');
    setCurrentExercise(null);
    dispatch({ type: 'ADD_XP', amount: flow.rewards.xp });
    dispatch({ type: 'ADD_SP', amount: flow.rewards.sp });
    dispatch({ type: 'UPDATE_AFFINITY', characterId: flow.npcId, delta: flow.rewards.rp });
    dispatch({ type: 'INCREMENT_INTERACTION', characterId: flow.npcId });
    dispatch({ type: 'INCREMENT_LOCATION_HANGOUT', cityId: flow.cityId, locationId: flow.locationId });
    dispatch({ type: 'UNLOCK_LOCATION', cityId: flow.cityId, locationId: flow.locationId });
    for (const itemId of ['밥 먹었어요', '선배님', '천천히']) {
      dispatch({ type: 'RECORD_ITEM_RESULT', itemId, category: 'vocabulary', correct: true });
    }
    writeCheckpoint({
      phase: 'complete',
      tongIndex,
      beatIndex,
      selectedChoiceId,
      completed: true,
    });
  }, [beatIndex, completed, flow.cityId, flow.locationId, flow.npcId, flow.rewards.rp, flow.rewards.sp, flow.rewards.xp, selectedChoiceId, tongIndex, writeCheckpoint]);

  const advanceTong = useCallback(() => {
    if (tongIndex < flow.tongIntroLines.length - 1) {
      const nextIndex = tongIndex + 1;
      setTongIndex(nextIndex);
      writeCheckpoint({ phase: 'arrival', tongIndex: nextIndex, beatIndex, selectedChoiceId });
      return;
    }
    setPhase('cinematic');
    writeCheckpoint({ phase: 'cinematic', tongIndex, beatIndex, selectedChoiceId });
  }, [beatIndex, flow.tongIntroLines.length, selectedChoiceId, tongIndex, writeCheckpoint]);

  const advanceDialogue = useCallback(() => {
    if (!activeBeat) return;
    if (activeBeat.choices?.length) {
      setPhase('choice');
      writeCheckpoint({ phase: 'choice', tongIndex, beatIndex, selectedChoiceId });
      return;
    }
    if (activeBeat.exerciseAfter) {
      setPhase('exercise');
      setCurrentExercise(activeBeat.exerciseAfter);
      writeCheckpoint({ phase: 'exercise', tongIndex, beatIndex, selectedChoiceId });
      return;
    }
    const nextBeatIndex = beatIndex + 1;
    if (nextBeatIndex < flow.dialogueBeats.length) {
      setBeatIndex(nextBeatIndex);
      setPhase('chat');
      writeCheckpoint({ phase: 'chat', tongIndex, beatIndex: nextBeatIndex, selectedChoiceId });
      return;
    }
    completeFlow();
  }, [activeBeat, beatIndex, completeFlow, flow.dialogueBeats.length, selectedChoiceId, tongIndex, writeCheckpoint]);

  const handleChoice = useCallback((choiceId: string) => {
    setSelectedChoiceId(choiceId);
    const replyBeatIndex = flow.dialogueBeats.findIndex((beat) => beat.id === 'you-reply');
    const nextBeatIndex = replyBeatIndex >= 0 ? replyBeatIndex : beatIndex + 1;
    setBeatIndex(nextBeatIndex);
    setPhase('chat');
    writeCheckpoint({ phase: 'chat', tongIndex, beatIndex: nextBeatIndex, selectedChoiceId: choiceId });
  }, [beatIndex, flow.dialogueBeats, tongIndex, writeCheckpoint]);

  const handleExerciseResult = useCallback((_exerciseId: string, correct: boolean) => {
    dispatch({ type: 'RECORD_ITEM_RESULT', itemId: '밥 먹었어요', category: 'vocabulary', correct });
    const nextBeatIndex = beatIndex + 1;
    setCurrentExercise(null);
    if (nextBeatIndex < flow.dialogueBeats.length) {
      setBeatIndex(nextBeatIndex);
      setPhase('chat');
      writeCheckpoint({ phase: 'chat', tongIndex, beatIndex: nextBeatIndex, selectedChoiceId });
      return;
    }
    completeFlow();
  }, [beatIndex, completeFlow, flow.dialogueBeats.length, selectedChoiceId, tongIndex, writeCheckpoint]);

  const goToSeoulMap = useCallback(() => {
    router.push('/game?phase=city_map&city=seoul');
  }, [router]);

  const hud = (
    <GameHUD
      xp={gameState.xp}
      sp={gameState.sp}
      rp={gameState.relationships.jin?.affinity ?? 0}
      cityId="seoul"
      explainLang={explainLang}
      locationLabel={<>Seoul <span className="korean">서울</span><span className="scene-hud-dot">&middot;</span> Cafe</>}
    />
  );

  if (phase === 'complete') {
    return (
      <main className="scene-root">
        <div className="game-frame summary-screen summary-screen--seoul">
          <Background imageUrl={flow.backdropUrl} ambientDescription="A late-night Seoul cafe after trainee practice." />
          <div className="summary-overlay" />
          <div className="summary-content">
            <h2 className="summary-title">Jin Exists In Seoul</h2>
            <p className="summary-text">
              <KoreanText text={flow.completionTongLine} targetLang="ko" />
            </p>
            <div className="summary-stats">
              <div className="summary-stat">
                <div className="summary-stat-value summary-stat-xp">+{flow.rewards.xp}</div>
                <div className="summary-stat-label">XP earned</div>
              </div>
              <div className="summary-stat">
                <div className="summary-stat-value summary-stat-positive">+{flow.rewards.sp}</div>
                <div className="summary-stat-label">SP earned</div>
              </div>
              <div className="summary-stat">
                <div className="summary-stat-value summary-stat-positive">+{flow.rewards.rp}</div>
                <div className="summary-stat-label">Jin RP</div>
              </div>
            </div>
            <button className="btn-go" type="button" onClick={goToSeoulMap}>
              Open Seoul map
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="scene-root">
      <div className="game-frame">
        <section className="seoul-onboarding" aria-label="Seoul Jin onboarding">
          {hud}
          <Background imageUrl={flow.backdropUrl} ambientDescription="A late-night Seoul cafe after trainee practice." />
          <video
            className="seoul-onboarding__video"
            src={flow.backdropVideoUrl}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
          />
          <div className="seoul-onboarding__scrim" aria-hidden="true" />

          {(phase === 'chat' || phase === 'choice' || phase === 'exercise') && (
            <CharacterSprite
              spriteUrl={flow.jinSpriteUrl}
              name="Jin"
              nameColor="#4a90d9"
              position="center"
              active
            />
          )}

          {phase === 'arrival' && (
            <TongOverlay
              message={flow.tongIntroLines[tongIndex] ?? ''}
              visible
              targetLang="ko"
              speakerName="Tong"
              dismissLabel={tongIndex >= flow.tongIntroLines.length - 1 ? 'Reveal Jin' : 'Continue'}
              onDismiss={advanceTong}
            />
          )}

          {phase === 'cinematic' && (
            <CinematicOverlay
              videoUrl={flow.cinematicVideoUrl}
              caption={flow.cinematicCaption}
              captionTranslation={flow.cinematicCaptionTranslation}
              autoAdvance={false}
              muted
              targetLang="ko"
              onEnd={() => {
                setPhase('chat');
                setBeatIndex(0);
                writeCheckpoint({ phase: 'chat', tongIndex, beatIndex: 0, selectedChoiceId });
              }}
            />
          )}

          {phase === 'chat' && activeBeat?.tongTip && (
            <TongOverlay
              message={activeBeat.tongTip}
              visible
              targetLang="ko"
              speakerName="Tong"
            />
          )}

          {phase === 'chat' && activeBeat && (
            <DialogueBox
              speakerName={activeBeat.speaker === 'jin' ? 'Jin 진' : 'You'}
              speakerColor={activeBeat.speaker === 'jin' ? '#4a90d9' : '#f0c040'}
              content={beatText}
              translation={beatTranslation}
              targetLang="ko"
              continueLabel={activeBeat.choices?.length ? 'Reply' : 'Tap to continue'}
              onContinue={advanceDialogue}
            />
          )}

          {phase === 'choice' && activeBeat?.choices && (
            <ChoiceButtons
              choices={toDialogueChoices(activeBeat.choices)}
              prompt="Answer Jin"
              onSelect={handleChoice}
              targetLang="ko"
            />
          )}

          {phase === 'exercise' && currentExercise && (
            <ExerciseModal
              exercise={currentExercise}
              onResult={handleExerciseResult}
            />
          )}
        </section>
      </div>
    </main>
  );
}
