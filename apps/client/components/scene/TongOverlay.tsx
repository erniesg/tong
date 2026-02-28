'use client';

import { KoreanText } from '@/components/shared/KoreanText';

interface TongOverlayProps {
  message: string;
  visible: boolean;
  onDismiss?: () => void;
}

export function TongOverlay({ message, visible, onDismiss }: TongOverlayProps) {
  if (!visible || !message.trim()) return null;

  return (
    <button className="scene-tong-overlay" type="button" onClick={onDismiss}>
      <strong>Tong:</strong> <KoreanText text={message} />
    </button>
  );
}
