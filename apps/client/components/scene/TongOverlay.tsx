'use client';

import { cn } from '@/lib/utils/cn';
import { KoreanText, type TargetLang } from '@/components/shared/KoreanText';

interface TongOverlayProps {
  message: string;
  translation?: string;
  visible: boolean;
  targetLang?: TargetLang;
  onDismiss?: () => void;
}

export function TongOverlay({ message, translation, visible, targetLang = 'ko', onDismiss }: TongOverlayProps) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        'tong-whisper absolute z-30 left-3 right-3 top-14 p-3 transition-all duration-300 fade-in',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      )}
      onClick={onDismiss}
    >
      <div className="flex items-start gap-2">
        <img src="/assets/characters/tong/tong_cheerful.png" alt="Tong" className="tong-whisper__avatar" />
        <div className="min-w-0">
          <p className="text-xs font-bold tong-whisper__label m-0">Tong</p>
          <p className="mt-0.5 text-sm text-ko leading-snug tong-whisper__body m-0"><KoreanText text={message} targetLang={targetLang} /></p>
          {translation && (
            <p className="mt-1 text-xs tong-whisper__translation italic m-0">{translation}</p>
          )}
        </div>
      </div>
    </div>
  );
}
