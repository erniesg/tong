'use client';

import { KoreanText } from '@/components/shared/KoreanText';

export interface DialogueChoice {
  id: string;
  text: string;
  subtext?: string;
}

interface ChoiceButtonsProps {
  choices: DialogueChoice[];
  onSelect: (choiceId: string) => void;
  disabled?: boolean;
}

export function ChoiceButtons({ choices, onSelect, disabled }: ChoiceButtonsProps) {
  if (!choices.length) return null;

  return (
    <div className="scene-choice-grid">
      {choices.map((choice) => (
        <button
          key={choice.id}
          className="scene-choice-button"
          type="button"
          onClick={() => onSelect(choice.id)}
          disabled={disabled}
        >
          <span className="scene-choice-main">
            <KoreanText text={choice.text} />
          </span>
          {choice.subtext && <span className="scene-choice-sub">{choice.subtext}</span>}
        </button>
      ))}
    </div>
  );
}
