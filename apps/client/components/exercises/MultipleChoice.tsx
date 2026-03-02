'use client';

import { useState } from 'react';
import type { MultipleChoiceExercise } from '@/lib/types/hangout';
import { useUILang } from '@/lib/i18n/UILangContext';
import { t } from '@/lib/i18n/ui-strings';

interface Props {
  exercise: MultipleChoiceExercise;
  onResult: (correct: boolean) => void;
}

export function MultipleChoice({ exercise, onResult }: Props) {
  const lang = useUILang();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const isCorrect = selected === exercise.correctOptionId;

  const handleSelect = (optionId: string) => {
    if (submitted) return;
    setSelected(optionId);
  };

  const handleSubmit = () => {
    if (!selected || submitted) return;
    setSubmitted(true);
    onResult(isCorrect);
  };

  const correctOption = exercise.options.find((o) => o.id === exercise.correctOptionId);

  function getOptionStyle(optId: string): React.CSSProperties {
    const isThis = selected === optId;
    const isCorrectOption = optId === exercise.correctOptionId;
    const showCorrect = submitted && isCorrectOption;
    const showWrong = submitted && isThis && !isCorrect;
    const dimmed = submitted && !isCorrectOption && !isThis;

    if (showCorrect) return { border: '2px solid #34d399', background: 'rgba(52, 211, 153, 0.15)' };
    if (showWrong) return { border: '2px solid #ef4444', background: 'rgba(239, 68, 68, 0.15)' };
    if (dimmed) return { border: '2px solid rgba(255,255,255,0.06)', opacity: 0.35 };
    if (isThis) return { border: '2px solid #f0c040', background: 'rgba(240, 192, 64, 0.2)' };
    return { border: '2px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)' };
  }

  return (
    <div className="exercise-card" style={{ padding: 20 }}>
      <p style={{ fontSize: 18, fontWeight: 500, marginBottom: 16, margin: '0 0 16px' }}>{exercise.prompt}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {exercise.options.map((opt) => {
          const isCorrectOption = opt.id === exercise.correctOptionId;
          const isThis = selected === opt.id;
          const showWrong = submitted && isThis && !isCorrect;

          return (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              style={{
                ...getOptionStyle(opt.id),
                borderRadius: 12,
                padding: '12px 16px',
                textAlign: 'left',
                fontSize: 16,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: submitted ? 'default' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <span>{opt.text}</span>
              {submitted && isCorrectOption && (
                <span style={{ color: '#34d399', fontSize: 12, fontWeight: 600 }}>{t('correct', lang)}</span>
              )}
              {showWrong && (
                <span style={{ color: '#f87171', fontSize: 12, fontWeight: 600 }}>{t('your_pick', lang)}</span>
              )}
            </button>
          );
        })}
      </div>

      {submitted && exercise.explanation && (
        <p style={{ marginTop: 12, fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>{exercise.explanation}</p>
      )}

      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!selected}
          style={{
            marginTop: 16,
            width: '100%',
            borderRadius: 12,
            padding: '13px 0',
            fontWeight: 600,
            fontSize: 15,
            border: 'none',
            cursor: selected ? 'pointer' : 'not-allowed',
            background: selected ? '#f0c040' : 'rgba(255,255,255,0.08)',
            color: selected ? '#1a1a2e' : 'rgba(255,255,255,0.4)',
            transition: 'all 0.15s',
          }}
        >
          {t('check', lang)}
        </button>
      )}

      {submitted && (
        <div
          style={{
            marginTop: 16,
            borderRadius: 12,
            padding: '12px 16px',
            textAlign: 'center',
            fontSize: 14,
            fontWeight: 600,
            background: isCorrect ? 'rgba(52, 211, 153, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: isCorrect ? '#34d399' : '#f87171',
          }}
        >
          {isCorrect
            ? t('correct', lang)
            : `${t('answer_is', lang)} "${correctOption?.text ?? ''}"`}
        </div>
      )}
    </div>
  );
}
