'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { DragDropExercise } from '@/lib/types/hangout';

interface Props {
  exercise: DragDropExercise;
  onResult: (correct: boolean) => void;
}

export function DragDrop({ exercise, onResult }: Props) {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const allCorrect =
    Object.keys(mapping).length === exercise.items.length &&
    Object.entries(mapping).every(
      ([itemId, targetId]) => exercise.correctMapping[itemId] === targetId
    );

  const handleItemClick = (itemId: string) => {
    if (submitted) return;
    if (itemId in mapping) {
      const { [itemId]: _, ...rest } = mapping;
      setMapping(rest);
      return;
    }
    setSelectedItem(itemId);
  };

  const handleTargetClick = (targetId: string) => {
    if (submitted || !selectedItem) return;
    setMapping({ ...mapping, [selectedItem]: targetId });
    setSelectedItem(null);
  };

  const handleSubmit = () => {
    if (submitted || Object.keys(mapping).length < exercise.items.length) return;
    setSubmitted(true);
    onResult(allCorrect);
  };

  return (
    <div className="exercise-card p-5">
      <p className="text-lg font-medium mb-2 m-0">{exercise.prompt}</p>

      {/* Items (source) */}
      <div className="flex flex-wrap gap-2 mb-4">
        {exercise.items.map((item) => {
          const isPlaced = item.id in mapping;
          const isSelected = selectedItem === item.id;
          const correct = submitted && exercise.correctMapping[item.id] === mapping[item.id];
          const wrong = submitted && isPlaced && !correct;

          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className={cn(
                'rounded-lg px-3 py-2 text-ko transition border',
                !isPlaced && !isSelected && 'border-white/20 hover:border-white/40',
                isSelected && 'border-[var(--color-primary)] bg-[var(--color-primary)]/20 scale-105',
                isPlaced && !submitted && 'border-white/30 opacity-50',
                correct && 'border-[var(--color-accent-green)] bg-[var(--color-accent-green)]/10 opacity-100',
                wrong && 'border-red-500 bg-red-500/10 opacity-100'
              )}
            >
              {item.text}
            </button>
          );
        })}
      </div>

      {/* Targets (drop zones) */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {exercise.targets.map((target) => {
          const placedItem = Object.entries(mapping).find(([, tId]) => tId === target.id);
          const placedItemData = placedItem
            ? exercise.items.find((i) => i.id === placedItem[0])
            : null;

          return (
            <button
              key={target.id}
              onClick={() => handleTargetClick(target.id)}
              className={cn(
                'rounded-lg border border-dashed px-3 py-4 text-center transition min-h-[60px]',
                !placedItemData && selectedItem && 'border-[var(--color-primary)]/50 hover:bg-[var(--color-primary)]/5',
                !placedItemData && !selectedItem && 'border-white/20',
                placedItemData && 'border-white/30 bg-white/5'
              )}
            >
              <span className="text-xs text-[var(--color-text-muted)] block">{target.label}</span>
              {placedItemData && (
                <span className="text-ko font-medium">{placedItemData.text}</span>
              )}
            </button>
          );
        })}
      </div>

      {!submitted ? (
        <button
          onClick={handleSubmit}
          disabled={Object.keys(mapping).length < exercise.items.length}
          className={cn(
            'w-full rounded-lg py-3 font-semibold transition',
            Object.keys(mapping).length === exercise.items.length
              ? 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]'
              : 'bg-white/10 text-[var(--color-text-muted)] cursor-not-allowed'
          )}
        >
          Check
        </button>
      ) : (
        <div
          className={cn(
            'rounded-lg px-4 py-3 text-center font-semibold',
            allCorrect ? 'bg-[var(--color-accent-green)]/20 text-[var(--color-accent-green)]' : 'bg-red-500/20 text-red-400'
          )}
        >
          {allCorrect ? 'All correct!' : 'Some are in the wrong place — review and try again!'}
        </div>
      )}
    </div>
  );
}
