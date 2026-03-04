'use client';

import { KoreanText, type TargetLang } from '@/components/shared/KoreanText';

export interface DialogueChoice {
  id: string;
  text: string;
  subtext?: string;
}

interface ChoiceButtonsProps {
  choices: DialogueChoice[];
  prompt?: string | null;
  onSelect: (choiceId: string) => void;
  disabled?: boolean;
  targetLang?: TargetLang;
}

export function ChoiceButtons({ choices, prompt, onSelect, disabled, targetLang = 'ko' }: ChoiceButtonsProps) {
  return (
    <div className="vn-choices slide-up">
      {prompt && (
        <div className="vn-choices__prompt">
          <KoreanText text={prompt} targetLang={targetLang} />
        </div>
      )}
      {choices.map((choice, i) => (
        <button
          key={choice.id}
          onClick={() => onSelect(choice.id)}
          disabled={disabled}
          className="vn-choices__btn"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <span className="vn-choices__text"><KoreanText text={choice.text} targetLang={targetLang} /></span>
          {choice.subtext && (
            <span className="vn-choices__subtext">{choice.subtext}</span>
          )}
        </button>
      ))}
    </div>
  );
}
