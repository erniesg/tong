'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import type { SessionMessage, ExerciseData } from '@/lib/types/hangout';
import type { TargetLang } from '@/components/shared/KoreanText';
import { Background } from './Background';
import { CharacterSprite } from './CharacterSprite';
import { DialogueBox } from './DialogueBox';
import { ChoiceButtons, type DialogueChoice } from './ChoiceButtons';
import { TongOverlay } from './TongOverlay';
import { CinematicOverlay } from './CinematicOverlay';
import { ExerciseRenderer } from '../exercises/ExerciseRenderer';

interface SceneViewProps {
  backgroundUrl: string;
  backgroundTransition?: 'fade' | 'cut';
  ambientDescription?: string;
  cinematic?: { videoUrl: string; caption?: string; autoAdvance: boolean; muted?: boolean } | null;
  onCinematicEnd?: () => void;
  npcName?: string;
  npcColor?: string;
  npcSpriteUrl?: string;
  currentMessage?: SessionMessage | null;
  currentExercise?: ExerciseData | null;
  choices?: DialogueChoice[] | null;
  choicePrompt?: string | null;
  tongTip?: { message: string; translation?: string } | null;
  isStreaming?: boolean;
  hudContent?: React.ReactNode;
  targetLang?: TargetLang;
  continueLabel?: string;
  onChoice?: (choiceId: string) => void;
  onContinue?: () => void;
  onExerciseResult?: (exerciseId: string, correct: boolean) => void;
  onExerciseDismiss?: () => void;
  onDismissTong?: () => void;
  // Extended props used by GamePageClient VN mode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

const SPEAKER_COLORS: Record<string, string> = {
  haeun: '#e8485c',
  jin: '#4a90d9',
  tong: '#f0c040',
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
  currentMessage = null,
  currentExercise = null,
  choices = null,
  choicePrompt,
  tongTip = null,
  isStreaming = false,
  hudContent,
  targetLang = 'ko',
  continueLabel = 'Tap to continue',
  onChoice = () => {},
  onContinue = () => {},
  onExerciseResult = () => {},
  onExerciseDismiss,
  onDismissTong = () => {},
}: SceneViewProps) {
  const [exerciseDone, setExerciseDone] = useState(false);
  // Reset exerciseDone when exercise changes
  useEffect(() => { setExerciseDone(false); }, [currentExercise]);

  // Auto-dismiss exercise after completion — no second "tap to continue" needed
  useEffect(() => {
    if (!exerciseDone) return;
    const timer = setTimeout(() => {
      onExerciseDismiss?.();
    }, 600);
    return () => clearTimeout(timer);
  }, [exerciseDone, onExerciseDismiss]);

  const prevBackdropRef = useRef(backgroundUrl);
  const backdropTransition = backgroundTransition === 'fade' && prevBackdropRef.current !== backgroundUrl;
  if (prevBackdropRef.current !== backgroundUrl) {
    prevBackdropRef.current = backgroundUrl;
  }

  const handleCinematicEnd = useCallback(() => {
    onCinematicEnd();
  }, [onCinematicEnd]);
  const getSpeakerName = (msg: SessionMessage): string | undefined => {
    if (msg.role === 'narrator' || msg.role === 'system') return undefined;
    if (msg.role === 'tong') return 'Tong';
    if (msg.role === 'user') return 'You';
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
          autoAdvance={cinematic.autoAdvance}
          muted={cinematic.muted ?? false}
          onEnd={handleCinematicEnd}
        />
      )}

      {/* Layer 2: Character sprite */}
      <CharacterSprite
        spriteUrl={npcSpriteUrl}
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

      {/* Layer 4: Interactive area at bottom */}
      {currentExercise ? (
        <div
          className="exercise-float-wrapper"
          onClick={(e) => {
            // Tap outside the card → hide temporarily (only when not done)
            if (!exerciseDone && e.target === e.currentTarget && onExerciseDismiss) {
              onExerciseDismiss();
            }
          }}
        >
          <div className="exercise-float-card">
            <ExerciseRenderer
              exercise={currentExercise}
              onResult={(correct) => {
                setExerciseDone(true);
                onExerciseResult(currentExercise.id, correct);
              }}
            />
          </div>
        </div>
      ) : choices ? (
        <ChoiceButtons choices={choices} prompt={choicePrompt} onSelect={onChoice} disabled={isStreaming} targetLang={targetLang} />
      ) : currentMessage ? (
        <DialogueBox
          speakerName={getSpeakerName(currentMessage)}
          speakerColor={getSpeakerColor(currentMessage)}
          content={currentMessage.content}
          translation={currentMessage.translation}
          isStreaming={isStreaming}
          targetLang={targetLang}
          continueLabel={continueLabel}
          onContinue={onContinue}
        />
      ) : isStreaming ? (
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <div className="scene-continue-label animate-pulse">...</div>
        </div>
      ) : (
        <div
          className="absolute bottom-0 left-0 right-0 p-5 cursor-pointer"
          onClick={onContinue}
        >
          <div className="scene-continue-label animate-pulse">
            {continueLabel}
          </div>
        </div>
      )}
    </div>
  );
}
