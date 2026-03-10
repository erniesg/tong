'use client';

import type { TongExpression } from '@/lib/content/tong-expressions';
import { tongExpressionUrl } from '@/lib/content/tong-expressions';

interface TongBubbleProps {
  text: string;
  translation?: string | null;
  expression?: TongExpression;
}

export function TongBubble({ text, translation, expression = 'cheerful' }: TongBubbleProps) {
  return (
    <div className="msg-bubble msg-bubble--npc bubble-tail-left">
      <p className="m-0 text-ko">{text}</p>
      {translation && (
        <p className="m-0 mt-1 text-xs msg-bubble__translation">{translation}</p>
      )}
    </div>
  );
}

export function tongAvatarUrl(expression: TongExpression = 'cheerful'): string {
  return tongExpressionUrl(expression);
}
