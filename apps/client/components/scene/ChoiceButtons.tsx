'use client';

import { cn } from '@/lib/utils/cn';
import { KoreanText } from '@/components/shared/KoreanText';

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
}

export function ChoiceButtons({ choices, prompt, onSelect, disabled }: ChoiceButtonsProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 pb-[calc(1rem+var(--safe-bottom))] flex flex-col gap-2 slide-up">
      {prompt && (
        <div className="text-sm text-[var(--color-text-secondary)] mb-1 px-1">
          <KoreanText text={prompt} />
        </div>
      )}
      {choices.map((choice, i) => (
        <button
          key={choice.id}
          onClick={() => onSelect(choice.id)}
          disabled={disabled}
          className={cn(
            'w-full rounded-xl px-5 py-3.5 text-left transition-all',
            'border border-white/20 bg-[var(--color-bg-card)]/90 backdrop-blur-md',
            'hover:border-[var(--color-primary)]/60 hover:bg-[var(--color-primary)]/10',
            'active:scale-[0.98]',
            disabled && 'opacity-50 pointer-events-none'
          )}
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <span className="text-ko text-sm font-medium"><KoreanText text={choice.text} /></span>
          {choice.subtext && (
            <span className="block mt-1 text-xs text-[var(--color-text-muted)]">
              {choice.subtext}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
