'use client';

import { KoreanText } from '@/components/shared/KoreanText';

interface DialogueBoxProps {
  speakerName: string;
  avatarUrl?: string | null;
  onAvatarError?: () => void;
  content: string;
  canContinue: boolean;
  isTypewriting: boolean;
  onContinue?: () => void;
}

export function DialogueBox({
  speakerName,
  avatarUrl,
  onAvatarError,
  content,
  canContinue,
  isTypewriting,
  onContinue,
}: DialogueBoxProps) {
  return (
    <section
      className={`scene-dialogue-box ${canContinue ? 'scene-dialogue-box-tappable' : ''}`}
      role={canContinue ? 'button' : undefined}
      tabIndex={canContinue ? 0 : -1}
      onClick={canContinue ? onContinue : undefined}
      onKeyDown={(event) => {
        if (!canContinue || !onContinue) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onContinue();
      }}
    >
      <header className="scene-dialogue-head">
        <div className="scene-dialogue-speaker-pill">
          {avatarUrl ? (
            <img className="scene-dialogue-avatar" src={avatarUrl} alt={`${speakerName} avatar`} onError={onAvatarError} />
          ) : (
            <span className="scene-dialogue-avatar-fallback">{speakerName.slice(0, 1)}</span>
          )}
          <strong>{speakerName}</strong>
        </div>
        <span className="scene-dialogue-status">{canContinue ? 'TAP TO CONTINUE' : 'YOUR TURN'}</span>
      </header>
      <p className="scene-dialogue-copy">
        <KoreanText text={content} />
      </p>
    </section>
  );
}
