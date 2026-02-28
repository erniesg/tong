'use client';

import { Background } from './Background';
import { ChoiceButtons, type DialogueChoice } from './ChoiceButtons';
import { DialogueBox } from './DialogueBox';
import { TongOverlay } from './TongOverlay';

export type { DialogueChoice } from './ChoiceButtons';

interface SceneViewProps {
  backgroundUrl: string;
  tongHint: string | null;
  onDismissTong: () => void;
  speakerName: string;
  avatarUrl: string | null;
  onAvatarError: () => void;
  dialogueText: string;
  canContinue: boolean;
  isTypewriting: boolean;
  onContinue: () => void;
  canAnswerTurn: boolean;
  choices: DialogueChoice[];
  onChoice: (choiceId: string) => void;
  choiceDisabled: boolean;
  userInput: string;
  onUserInput: (value: string) => void;
  onSend: () => void;
  sendDisabled: boolean;
  sendingTurn: boolean;
  launchPending: boolean;
  launchError: string | null;
  onRetryLaunch: () => void;
}

export function SceneView({
  backgroundUrl,
  tongHint,
  onDismissTong,
  speakerName,
  avatarUrl,
  onAvatarError,
  dialogueText,
  canContinue,
  isTypewriting,
  onContinue,
  canAnswerTurn,
  choices,
  onChoice,
  choiceDisabled,
  userInput,
  onUserInput,
  onSend,
  sendDisabled,
  sendingTurn,
  launchPending,
  launchError,
  onRetryLaunch,
}: SceneViewProps) {
  return (
    <section className="scene-view-root">
      <Background imageUrl={backgroundUrl} />
      <div className="scene-view-content">
        <TongOverlay message={tongHint || ''} visible={Boolean(tongHint)} onDismiss={onDismissTong} />

        {launchPending && (
          <section className="scene-launch-card" aria-live="polite">
            <p>Launching your first hangout...</p>
          </section>
        )}

        {launchError && !launchPending && (
          <section className="scene-launch-card">
            <p>Start failed. Try again.</p>
            <p className="scene-launch-error">{launchError}</p>
            <button type="button" onClick={onRetryLaunch}>
              Retry Launch
            </button>
          </section>
        )}

        <div className="scene-view-bottom">
          <DialogueBox
            speakerName={speakerName}
            avatarUrl={avatarUrl}
            onAvatarError={onAvatarError}
            content={dialogueText}
            canContinue={canContinue}
            isTypewriting={isTypewriting}
            onContinue={onContinue}
          />

          {canAnswerTurn && choices.length > 0 && (
            <ChoiceButtons choices={choices} onSelect={onChoice} disabled={choiceDisabled} />
          )}

          {canAnswerTurn && (
            <div className="scene-input-stack">
              <textarea
                rows={2}
                value={userInput}
                placeholder="Type your own response"
                onChange={(event) => onUserInput(event.target.value)}
              />
              <button type="button" onClick={onSend} disabled={sendDisabled}>
                {sendingTurn ? 'Sending...' : 'Send response'}
              </button>
            </div>
          )}

          {sendingTurn && <p className="scene-turn-status">Character is replying...</p>}
        </div>

        {!launchPending && !launchError && !canContinue && !canAnswerTurn && (
          <div className="scene-waiting">...</div>
        )}
      </div>
    </section>
  );
}
