'use client';

import { cn } from '@/lib/utils/cn';
import { KoreanText } from '@/components/shared/KoreanText';

interface TongOverlayProps {
  message: string;
  translation?: string;
  visible: boolean;
  onDismiss?: () => void;
}

export function TongOverlay({ message, translation, visible, onDismiss }: TongOverlayProps) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        'tong-whisper absolute z-30 left-3 right-3 top-3 p-3 transition-all duration-300 fade-in',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      )}
      onClick={onDismiss}
    >
      <div className="flex items-start gap-2">
        <span className="shrink-0 text-lg">💡</span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-[var(--color-accent-gold)] m-0">Tong</p>
          <p className="mt-0.5 text-sm text-ko leading-snug m-0"><KoreanText text={message} /></p>
          {translation && (
            <p className="mt-1 text-xs text-[var(--color-text-muted)] italic m-0">{translation}</p>
          )}
        </div>
      </div>
    </div>
  );
}
