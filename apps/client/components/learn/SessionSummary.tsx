'use client';

interface LearnedItem {
  char: string;
  romanization?: string;
}

interface SessionSummaryProps {
  summary: string;
  exercisesCompleted: number;
  exercisesCorrect: number;
  xpEarned: number;
  learnedItems?: LearnedItem[];
  levelUp?: boolean;
  onDone?: () => void;
}

export function SessionSummary({
  summary,
  exercisesCompleted,
  exercisesCorrect,
  xpEarned,
  learnedItems,
  levelUp,
  onDone,
}: SessionSummaryProps) {
  const accuracy = exercisesCompleted > 0
    ? Math.round((exercisesCorrect / exercisesCompleted) * 100)
    : 0;

  return (
    <div className="session-summary">
      <div className="session-summary__title">Session complete!</div>

      <div className="session-summary__stats">
        <div className="session-summary__stat">
          <div className="session-summary__stat-value">{accuracy}%</div>
          <div className="session-summary__stat-label">Accuracy</div>
        </div>
        <div className="session-summary__stat">
          <div className="session-summary__stat-value">{exercisesCompleted}</div>
          <div className="session-summary__stat-label">Exercises</div>
        </div>
        <div className="session-summary__stat">
          <div className="session-summary__stat-value">{exercisesCorrect}</div>
          <div className="session-summary__stat-label">Correct</div>
        </div>
        <div className="session-summary__stat">
          <div className="session-summary__stat-value">+{xpEarned}</div>
          <div className="session-summary__stat-label">XP</div>
        </div>
      </div>

      {summary && <p className="text-sm mb-3 m-0">{summary}</p>}

      {learnedItems && learnedItems.length > 0 && (
        <div className="session-summary__items">
          {learnedItems.map((item, i) => (
            <span key={`${item.char}-${i}`} className="session-summary__item text-ko">
              {item.char}
              {item.romanization && <span className="text-xs opacity-60 ml-1">{item.romanization}</span>}
            </span>
          ))}
        </div>
      )}

      {levelUp && (
        <div className="session-summary__level-up">Level up!</div>
      )}

      {onDone && (
        <button
          className="mt-3 w-full rounded-lg py-3 font-semibold bg-[var(--msg-accent)] text-[var(--msg-accent-text)] transition hover:opacity-85"
          onClick={onDone}
          type="button"
        >
          Done
        </button>
      )}
    </div>
  );
}
