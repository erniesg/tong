'use client';

interface FeedbackBubbleProps {
  positive: boolean;
  message: string;
  detail?: string;
}

export function FeedbackBubble({ positive, message, detail }: FeedbackBubbleProps) {
  return (
    <div
      className={`feedback-bubble ${
        positive ? 'feedback-bubble--correct bubble-tail-left-green' : 'feedback-bubble--incorrect bubble-tail-left-red'
      } bubble-tail-left`}
    >
      <p className="m-0 font-medium">
        {positive ? '✓' : '✗'} {message}
      </p>
      {detail && <p className="m-0 mt-1 text-xs opacity-80">{detail}</p>}
    </div>
  );
}
