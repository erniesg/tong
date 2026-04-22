'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import type {
  CinematicPresentation,
  CreditGateState,
  ExerciseData,
  SessionMessage,
  WebtoonSequence,
} from '@/lib/types/hangout';
import type { TargetLang } from '@/components/shared/KoreanText';
import { CHARACTER_MAP } from '@/lib/content/characters';
import { Background } from './Background';
import { CharacterSprite } from './CharacterSprite';
import { DialogueBox } from './DialogueBox';
import { ChoiceButtons, type DialogueChoice } from './ChoiceButtons';
import { TongOverlay } from './TongOverlay';
import { CinematicOverlay } from './CinematicOverlay';
import { ExerciseRenderer } from '../exercises/ExerciseRenderer';
import { WebtoonPanel } from './WebtoonPanel';

interface SceneViewProps {
  backgroundUrl: string;
  backgroundTransition?: 'fade' | 'cut';
  ambientDescription?: string;
  cinematic?: {
    videoUrl: string;
    caption?: string;
    captionTranslation?: string;
    autoAdvance: boolean;
    muted?: boolean;
    presentation?: CinematicPresentation;
  } | null;
  onCinematicEnd?: () => void;
  npcName?: string;
  npcColor?: string;
  npcSpriteUrl?: string;
  npcIdleVideoUrl?: string;
  currentMessage?: SessionMessage | null;
  currentExercise?: ExerciseData | null;
  choices?: DialogueChoice[] | null;
  choicePrompt?: string | null;
  tongTip?: { message: string; translation?: string } | null;
  currentWebtoon?: WebtoonSequence | null;
  currentCreditGate?: CreditGateState | null;
  playerSp?: number;
  isStreaming?: boolean;
  dialogueIsStreaming?: boolean;
  sceneBusy?: boolean;
  hudContent?: React.ReactNode;
  targetLang?: TargetLang;
  continueLabel?: string;
  onChoice?: (choiceId: string) => void;
  onContinue?: () => void;
  onExerciseResult?: (exerciseId: string, correct: boolean) => void;
  onExerciseDismiss?: () => void;
  onDismissTong?: () => void;
  onWebtoonComplete?: () => void;
  onCreditGateDecision?: (decision: 'spend' | 'skip') => void;
  // Extended props used by GamePageClient VN mode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

const SPEAKER_COLORS: Record<string, string> = {
  haeun: '#e8485c',
  jin: '#4a90d9',
  tong: '#f0c040',
  shoucheng: '#7a8ee6',
  dingman: '#e88f5b',
  fangayi: '#d06d57',
};

export function SceneView({
  backgroundUrl,
  backgroundTransition,
  ambientDescription = '',
  cinematic = null,
  onCinematicEnd = () => {},
  npcName = '',
  npcColor = 'var(--color-primary)',
  npcSpriteUrl = '',
  npcIdleVideoUrl,
  currentMessage = null,
  currentExercise = null,
  choices = null,
  choicePrompt,
  tongTip = null,
  currentWebtoon = null,
  currentCreditGate = null,
  playerSp = 0,
  isStreaming = false,
  dialogueIsStreaming = false,
  sceneBusy = false,
  hudContent,
  targetLang = 'ko',
  continueLabel = 'Tap to continue',
  sceneReady = true,
  onChoice = () => {},
  onContinue = () => {},
  onExerciseResult = () => {},
  onExerciseDismiss,
  onDismissTong = () => {},
  onWebtoonComplete = () => {},
  onCreditGateDecision = () => {},
}: SceneViewProps) {
  const [exerciseDone, setExerciseDone] = useState(false);
  const [exerciseHidden, setExerciseHidden] = useState(false);
  const [mountedExercise, setMountedExercise] = useState(currentExercise);

  useEffect(() => {
    if (currentExercise) {
      setMountedExercise(currentExercise);
      setExerciseDone(false);
      setExerciseHidden(false);
    } else if (mountedExercise) {
      // Dismissed — hide but keep mounted to preserve state
      setExerciseHidden(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentExercise]);

  const prevBackdropRef = useRef(backgroundUrl);
  const backdropTransition = backgroundTransition === 'fade' && prevBackdropRef.current !== backgroundUrl;
  if (prevBackdropRef.current !== backgroundUrl) {
    prevBackdropRef.current = backgroundUrl;
  }

  const handleCinematicEnd = useCallback(() => {
    onCinematicEnd();
  }, [onCinematicEnd]);
  const TONG_LABELS: Record<string, string> = { zh: '小通 Tong', ja: 'トン Tong', ko: '통 Tong' };
  const YOU_LABELS: Record<string, string> = { zh: '你', ja: 'あなた', ko: '나' };

  const labelForCharacter = (characterId: string): string | undefined => {
    const character = CHARACTER_MAP[characterId];
    if (!character) return undefined;

    if (targetLang === 'zh' && character.name.zh) return character.name.zh;
    if (targetLang === 'ko' && character.name.ko) return character.name.ko;
    if (targetLang === 'ja' && character.name.ja) return character.name.ja;
    return character.name.en;
  };

  const getSpeakerName = (msg: SessionMessage): string | undefined => {
    if (msg.role === 'narrator' || msg.role === 'system') return undefined;
    if (msg.role === 'tong') return TONG_LABELS[targetLang] ?? 'Tong';
    if (msg.role === 'user') return YOU_LABELS[targetLang] ?? 'You';
    if (msg.characterId) return labelForCharacter(msg.characterId) ?? npcName;
    return npcName;
  };

  const getSpeakerColor = (msg: SessionMessage): string => {
    if (msg.characterId) return SPEAKER_COLORS[msg.characterId] ?? npcColor;
    return SPEAKER_COLORS[msg.role] ?? 'var(--color-primary)';
  };

  return (
    <div className="absolute inset-0 overflow-hidden select-none">
      {/* Layer 0: HUD */}
      {hudContent}

      {/* Layer 1: Background */}
      <Background imageUrl={backgroundUrl} ambientDescription={ambientDescription} fade={backdropTransition} />

      {/* Cinematic overlay (above everything when playing) */}
      {cinematic && (
        <CinematicOverlay
          videoUrl={cinematic.videoUrl}
          caption={cinematic.caption}
          captionTranslation={cinematic.captionTranslation}
          autoAdvance={cinematic.autoAdvance}
          muted={cinematic.muted ?? false}
          presentation={cinematic.presentation}
          targetLang={targetLang}
          onEnd={handleCinematicEnd}
        />
      )}

      {/* Layer 2: Character sprite — always mounted so idle video preloads behind cinematic */}
      <CharacterSprite
        spriteUrl={npcSpriteUrl}
        idleVideoUrl={npcIdleVideoUrl}
        name={npcName}
        nameColor={npcColor}
        position="center"
        active={true}
      />

      {/* Layer 3: Tong whisper */}
      <TongOverlay
        message={tongTip?.message ?? ''}
        translation={tongTip?.translation}
        visible={!!tongTip}
        targetLang={targetLang}
        onDismiss={onDismissTong}
      />

      {currentWebtoon && (
        <WebtoonPanel
          panels={currentWebtoon.panels}
          autoAdvance={currentWebtoon.autoAdvance}
          onComplete={onWebtoonComplete}
        />
      )}

      {currentCreditGate && (
        <div className="credit-gate-overlay">
          <div className="credit-gate-card" onClick={(event) => event.stopPropagation()}>
            <p className="credit-gate-kicker">Cliffhanger Unlock</p>
            <h2 className="credit-gate-title">{currentCreditGate.cost} SP to hear the rest</h2>
            <p className="credit-gate-copy">
              Spend now to unlock Fang Ayi&apos;s full line and Tong&apos;s breakdown, or skip and keep the tease for later.
            </p>
            <div className="credit-gate-actions">
              <button
                type="button"
                className="credit-gate-btn credit-gate-btn--primary"
                disabled={playerSp < currentCreditGate.cost}
                onClick={() => onCreditGateDecision('spend')}
              >
                Spend {currentCreditGate.cost} SP
              </button>
              <button
                type="button"
                className="credit-gate-btn credit-gate-btn--secondary"
                onClick={() => onCreditGateDecision('skip')}
              >
                Skip for now
              </button>
            </div>
            <p className="credit-gate-balance">
              You have {playerSp} SP.
            </p>
          </div>
        </div>
      )}

      {/* Layer 4a: Exercise — stays mounted when dismissed to preserve tracing state */}
      {mountedExercise && !currentWebtoon && !currentCreditGate && (
        <div
          className={`exercise-float-wrapper${exerciseDone ? ' exercise-float-dismissing' : ''}`}
          style={exerciseHidden ? { display: 'none' } : undefined}
        >
          <div className="exercise-float-card" onClick={(e) => e.stopPropagation()}>
            <button
              className="exercise-dismiss-btn"
              onClick={(e) => { e.stopPropagation(); onExerciseDismiss?.(); }}
              aria-label="Minimize exercise"
            >
              &#x25BE;
            </button>
            <ExerciseRenderer
              exercise={mountedExercise}
              onResult={(correct) => {
                setExerciseDone(true);
                onExerciseResult(mountedExercise.id, correct);
                setTimeout(() => {
                  setMountedExercise(null);
                  onExerciseDismiss?.();
                }, 300);
              }}
            />
          </div>
        </div>
      )}

      {/* Layer 4b: Other interactive elements (show when exercise is hidden or absent) */}
      {(exerciseHidden || !mountedExercise) && !currentWebtoon && !currentCreditGate && (choices ? (
        <ChoiceButtons choices={choices} prompt={choicePrompt} onSelect={onChoice} disabled={isStreaming} targetLang={targetLang} />
      ) : currentMessage ? (
        <DialogueBox
          speakerName={getSpeakerName(currentMessage)}
          speakerColor={getSpeakerColor(currentMessage)}
          content={currentMessage.content}
          translation={currentMessage.translation}
          isStreaming={dialogueIsStreaming}
          targetLang={targetLang}
          continueLabel={continueLabel}
          onContinue={onContinue}
        />
      ) : isStreaming || sceneBusy || !sceneReady ? (
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{ padding: '20px 20px calc(20px + var(--safe-bottom, 0px))' }}
        >
          <div className="scene-continue-label animate-pulse">
            …
          </div>
        </div>
      ) : (
        <div
          className="absolute bottom-0 left-0 right-0 cursor-pointer"
          style={{ padding: '20px 20px calc(20px + var(--safe-bottom, 0px))' }}
          onClick={tongTip ? onDismissTong : onContinue}
        >
          <div className="scene-continue-label animate-pulse">
            {continueLabel}
          </div>
        </div>
      ))}
    </div>
  );
}
