'use client';

import type { SessionMessage, ExerciseData } from '@/lib/types/hangout';
import { Background } from './Background';
import { CharacterSprite } from './CharacterSprite';
import { DialogueBox } from './DialogueBox';
import { ChoiceButtons, type DialogueChoice } from './ChoiceButtons';
import { TongOverlay } from './TongOverlay';
import { ExerciseRenderer } from '../exercises/ExerciseRenderer';

interface SceneViewProps {
  backgroundUrl: string;
  ambientDescription: string;
  npcName: string;
  npcColor: string;
  npcSpriteUrl: string;
  currentMessage: SessionMessage | null;
  currentExercise: ExerciseData | null;
  choices: DialogueChoice[] | null;
  choicePrompt?: string | null;
  tongTip: { message: string; translation?: string } | null;
  isStreaming: boolean;
  hudContent?: React.ReactNode;
  onChoice: (choiceId: string) => void;
  onContinue: () => void;
  onExerciseResult: (exerciseId: string, correct: boolean) => void;
  onDismissTong: () => void;
}

const SPEAKER_COLORS: Record<string, string> = {
  hauen: '#e8485c',
  haeun: '#e8485c',
  jin: '#4a90d9',
  tong: '#f0c040',
};

export function SceneView({
  backgroundUrl,
  ambientDescription,
  npcName,
  npcColor,
  npcSpriteUrl,
  currentMessage,
  currentExercise,
  choices,
  choicePrompt,
  tongTip,
  isStreaming,
  hudContent,
  onChoice,
  onContinue,
  onExerciseResult,
  onDismissTong,
}: SceneViewProps) {
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
      <Background imageUrl={backgroundUrl} ambientDescription={ambientDescription} />

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
        onDismiss={onDismissTong}
      />

      {/* Layer 4: Interactive area at bottom */}
      {currentExercise ? (
        <div className="absolute bottom-0 left-0 right-0 max-h-[55vh] overflow-y-auto slide-up">
          <ExerciseRenderer
            exercise={currentExercise}
            onResult={(correct) => onExerciseResult(currentExercise.id, correct)}
          />
        </div>
      ) : choices ? (
        <ChoiceButtons choices={choices} prompt={choicePrompt} onSelect={onChoice} disabled={isStreaming} />
      ) : currentMessage ? (
        <DialogueBox
          speakerName={getSpeakerName(currentMessage)}
          speakerColor={getSpeakerColor(currentMessage)}
          content={currentMessage.content}
          translation={currentMessage.translation}
          isStreaming={isStreaming}
          onContinue={onContinue}
        />
      ) : isStreaming ? (
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <div className="text-xs text-[var(--color-text-muted)] animate-pulse">...</div>
        </div>
      ) : (
        <div
          className="absolute bottom-0 left-0 right-0 p-5 cursor-pointer"
          onClick={onContinue}
        >
          <div className="text-center text-xs text-[var(--color-text-muted)] animate-pulse py-4">
            tap to continue ▼
          </div>
        </div>
      )}
    </div>
  );
}
