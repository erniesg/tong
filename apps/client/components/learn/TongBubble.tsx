'use client';

interface TongBubbleProps {
  text: string;
  translation?: string | null;
}

export function TongBubble({ text, translation }: TongBubbleProps) {
  return (
    <div className="msg-bubble msg-bubble--npc bubble-tail-left">
      <p className="m-0 text-ko">{text}</p>
      {translation && (
        <p className="m-0 mt-1 text-xs opacity-70">{translation}</p>
      )}
    </div>
  );
}
