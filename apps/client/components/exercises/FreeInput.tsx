'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { FreeInputExercise } from '@/lib/types/hangout';

interface Props {
  exercise: FreeInputExercise;
  onResult: (correct: boolean) => void;
}

export function FreeInput({ exercise, onResult }: Props) {
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Normalize for comparison: trim, lowercase, remove extra spaces
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const isCorrect = exercise.expectedAnswers.some(
    (ans) => normalize(input) === normalize(ans),
  );

  const handleSubmit = () => {
    if (!input.trim() || submitted) return;
    setSubmitted(true);
    onResult(isCorrect);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="exercise-card p-5">
      <p className="text-lg font-medium mb-4 m-0">{exercise.prompt}</p>

      {exercise.hint && (
        <p className="text-sm text-[var(--color-text-muted)] mb-3 m-0">{exercise.hint}</p>
      )}

      <input
        type="text"
        value={input}
        onChange={(e) => !submitted && setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={submitted}
        placeholder="Type your answer..."
        className="w-full rounded-lg px-4 py-3 text-lg text-ko"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '2px solid rgba(255,255,255,0.15)',
          color: 'var(--color-text)',
          outline: 'none',
        }}
        autoFocus
        lang="ko"
      />

      {submitted && exercise.explanation && (
        <p className="mt-3 text-sm text-[var(--color-text-muted)] m-0">{exercise.explanation}</p>
      )}

      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!input.trim()}
          className={cn(
            'mt-4 w-full rounded-lg py-3 font-semibold transition',
            input.trim()
              ? 'bg-[var(--color-accent-gold)] text-[#1a1a2e] hover:brightness-110'
              : 'bg-white/10 text-[var(--color-text-muted)] cursor-not-allowed',
          )}
        >
          Check
        </button>
      )}

      {submitted && (
        <div
          className={cn(
            'mt-4 rounded-lg px-4 py-3 text-center text-sm',
            isCorrect
              ? 'bg-[var(--color-accent-green)]/20 text-[var(--color-accent-green)]'
              : 'bg-red-500/20 text-red-400',
          )}
        >
          {isCorrect
            ? 'Correct!'
            : `Expected: ${exercise.expectedAnswers.join(' or ')}`}
        </div>
      )}
    </div>
  );
}
