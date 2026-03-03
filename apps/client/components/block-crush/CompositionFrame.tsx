'use client';

import type { CompositionTarget } from '@/lib/content/block-crush-data';
import { getSlotLayout } from '@/lib/content/block-crush-data';

interface Props {
  target: CompositionTarget;
  filledSlots: Record<string, string | null>;
  wrongSlot: string | null;
  showColorHints: boolean;
  onSlotTap: (slotName: string) => void;
}

export function CompositionFrame({ target, filledSlots, wrongSlot, showColorHints, onSlotTap }: Props) {
  const layout = getSlotLayout(target);

  return (
    <div className="block-crush__frame-area">
      <div className={`block-crush__frame block-crush__frame--${layout}`}>
        {target.components.map((comp) => {
          const filled = filledSlots[comp.slot];
          const isWrong = wrongSlot === comp.slot;

          const slotClass = [
            'block-crush__slot',
            filled && 'block-crush__slot--filled',
            isWrong && 'block-crush__slot--wrong',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div
              key={comp.slot}
              className={slotClass}
              style={{
                borderColor: !filled && showColorHints ? `${comp.colorHint}55` : undefined,
                backgroundColor: !filled && showColorHints ? `${comp.colorHint}0a` : undefined,
              }}
              onClick={() => onSlotTap(comp.slot)}
            >
              {filled ?? ''}
              {!filled && (
                <span className="block-crush__slot-label">
                  {comp.slot}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="block-crush__frame-hint">
        {target.romanization} — {target.meaning}
      </div>
    </div>
  );
}
