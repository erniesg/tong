'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChat } from 'ai/react';
import type { ExerciseData } from '@/lib/types/hangout';
import { generateExercise, type ExerciseHints } from '@/lib/exercises/generators';
import { isValidExerciseData } from '@/lib/exercises/validate';
import { extractTargetItems } from '@/lib/exercises/extract-targets';
import { getCitySkin } from '@/lib/theme/city-skins';
import { dispatch as gameDispatch, useGameState, getMasterySnapshot } from '@/lib/store/game-store';
import { dispatchSession, useSessionState, type CompletedSession } from '@/lib/store/session-store';
import { getLocationOrDefault } from '@/lib/content/locations';

import { ChatRow } from './ChatRow';
import { TongBubble } from './TongBubble';
import { TeachingCard } from './TeachingCard';
import { FeedbackBubble } from './FeedbackBubble';
import { MenuChoices } from './MenuChoices';
import { SessionSummary } from './SessionSummary';
import { ExerciseModal } from './ExerciseModal';

/* ── Types ─────────────────────────────────────────────────── */

type PanelMode = 'picker' | 'active' | 'review';

interface ChatEntry {
  id: string;
  kind: 'tong_text' | 'teaching' | 'exercise_prompt' | 'feedback' | 'choices' | 'summary' | 'user_text';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}

interface LearnPanelProps {
  cityId: string;
  locationId: string;
  userId: string;
  objectiveId?: string;
  lang: string;
}

/* ── Component ────────────────────────────────────────────── */

export function LearnPanel({ cityId, locationId, objectiveId }: LearnPanelProps) {
  const skin = getCitySkin(cityId);
  const gameState = useGameState();
  const sessionState = useSessionState();

  const [mode, setMode] = useState<PanelMode>('picker');
  const [chatEntries, setChatEntries] = useState<ChatEntry[]>([]);
  const [exerciseMap, setExerciseMap] = useState<Record<string, ExerciseData>>({});
  const [activeExercise, setActiveExercise] = useState<ExerciseData | null>(null);
  const [choiceSelections, setChoiceSelections] = useState<Record<string, string>>({});
  const [reviewSession, setReviewSession] = useState<CompletedSession | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const processedToolCallsRef = useRef(new Set<string>());
  const pausedRef = useRef(false);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatEntries, activeExercise]);

  /* ── Build context block for AI messages ──────────────── */
  const buildContextBlock = useCallback(() => {
    const location = getLocationOrDefault(cityId, locationId);
    const level = gameState.calibratedLevel ?? gameState.selfAssessedLevel ?? 0;
    const effLevel = Math.min(level, location.levels.length - 1);
    const mastery = getMasterySnapshot(location);
    const objectives = location.levels[effLevel]?.objectives ?? [];
    const active = sessionState.activeSession;

    const ctx = {
      playerLevel: level,
      selfAssessedLevel: gameState.selfAssessedLevel,
      calibratedLevel: gameState.calibratedLevel,
      mastery,
      objectives,
      cityId,
      locationId,
      sessionExercisesCompleted: active?.exercisesCompleted ?? 0,
      sessionExercisesCorrect: active?.exercisesCorrect ?? 0,
    };

    return `[LEARN_CONTEXT]${JSON.stringify(ctx)}[/LEARN_CONTEXT]`;
  }, [cityId, locationId, gameState, sessionState.activeSession]);

  /* ── useChat integration ──────────────────────────────── */
  const { append, isLoading } = useChat({
    api: '/api/ai/lesson',
    id: `learn-${sessionState.activeSession?.id ?? 'none'}`,
    maxSteps: 1,
    onResponse: () => {
      pausedRef.current = false;
    },
    onToolCall: ({ toolCall }) => {
      const { toolName, toolCallId, args } = toolCall;
      if (processedToolCallsRef.current.has(toolCallId)) return args;
      if (pausedRef.current) return args;
      processedToolCallsRef.current.add(toolCallId);

      handleToolCall(toolName, toolCallId, args as Record<string, unknown>);

      if (toolName === 'show_exercise' || toolName === 'offer_choices') {
        pausedRef.current = true;
      }

      return args;
    },
    onError: (err) => {
      console.error('[LearnPanel] useChat error:', err);
    },
  });

  /* ── Tool call handler ───────────────────────────────── */
  const handleToolCall = useCallback(
    (toolName: string, toolCallId: string, args: Record<string, unknown>) => {
      switch (toolName) {
        case 'teach_concept': {
          setChatEntries((prev) => [
            ...prev,
            {
              id: toolCallId,
              kind: 'tong_text',
              data: { text: args.message as string },
            },
            {
              id: `${toolCallId}-card`,
              kind: 'teaching',
              data: {
                korean: args.korean as string | null,
                translation: args.translation as string | null,
              },
            },
          ]);
          break;
        }

        case 'show_exercise': {
          let exercise: ExerciseData;
          if (isValidExerciseData(args.exerciseData)) {
            exercise = args.exerciseData;
          } else {
            const hints: ExerciseHints = {
              objectiveId: (args.objectiveId as string) ?? objectiveId ?? 'ko-vocab-food-items',
              hintItems: (args.hintItems as string[] | null) ?? undefined,
              hintCount: (args.hintCount as number | null) ?? undefined,
              hintSubType: (args.hintSubType as string | null) ?? undefined,
            };
            exercise = generateExercise(args.exerciseType as string, hints);
          }

          setExerciseMap((prev) => ({ ...prev, [exercise.id]: exercise }));
          setChatEntries((prev) => [
            ...prev,
            { id: toolCallId, kind: 'exercise_prompt', data: { exerciseId: exercise.id } },
          ]);
          setActiveExercise(exercise);
          break;
        }

        case 'offer_choices': {
          setChatEntries((prev) => [
            ...prev,
            {
              id: toolCallId,
              kind: 'choices',
              data: {
                prompt: args.prompt as string,
                choices: args.choices as { id: string; text: string }[],
              },
            },
          ]);
          break;
        }

        case 'give_feedback': {
          setChatEntries((prev) => [
            ...prev,
            {
              id: toolCallId,
              kind: 'feedback',
              data: {
                positive: args.positive as boolean,
                message: args.message as string,
                detail: args.detail as string | null,
              },
            },
          ]);
          break;
        }

        case 'wrap_up': {
          const learnedItems = (args.learnedItems as { char: string; romanization: string | null }[]) ?? [];
          const xpEarned = (args.xpEarned as number) ?? 30;
          const summary = (args.summary as string) ?? '';

          const active = sessionState.activeSession;
          setChatEntries((prev) => [
            ...prev,
            {
              id: toolCallId,
              kind: 'summary',
              data: {
                summary,
                xpEarned,
                exercisesCompleted: active?.exercisesCompleted ?? 0,
                exercisesCorrect: active?.exercisesCorrect ?? 0,
                learnedItems,
              },
            },
          ]);

          // Award XP and SP
          gameDispatch({ type: 'ADD_XP', amount: xpEarned });
          gameDispatch({ type: 'ADD_SP', amount: Math.round(xpEarned * 0.3) });
          break;
        }
      }
    },
    [objectiveId, sessionState.activeSession],
  );

  /* ── Start new session ───────────────────────────────── */
  const startSession = useCallback(() => {
    dispatchSession({
      type: 'START_SESSION',
      cityId,
      locationId,
      objectiveId,
    });
    setChatEntries([]);
    setExerciseMap({});
    setActiveExercise(null);
    setChoiceSelections({});
    processedToolCallsRef.current.clear();
    pausedRef.current = false;
    setMode('active');

    const ctx = buildContextBlock();
    void append({
      role: 'user',
      content: `${ctx}Start the lesson.`,
    });
  }, [cityId, locationId, objectiveId, append, buildContextBlock]);

  /* ── Handle exercise result ──────────────────────────── */
  const handleExerciseResult = useCallback(
    (exerciseId: string, correct: boolean) => {
      setActiveExercise(null);

      // Update session store
      dispatchSession({ type: 'RECORD_EXERCISE_RESULT', correct });

      // Update game store mastery — dispatch per-item results using actual target words
      const exercise = exerciseMap[exerciseId];
      if (exercise) {
        const targets = extractTargetItems(exercise);
        for (const target of targets) {
          gameDispatch({
            type: 'RECORD_ITEM_RESULT',
            itemId: target.itemId,
            category: target.category,
            correct,
          });
        }
      }

      // Add user response entry
      setChatEntries((prev) => [
        ...prev,
        {
          id: `user-ex-${exerciseId}`,
          kind: 'user_text',
          data: { text: correct ? 'Got it right!' : 'Missed that one.' },
        },
      ]);

      // Send result to AI
      const ctx = buildContextBlock();
      void append({
        role: 'user',
        content: `${ctx}Exercise result: ${correct ? 'correct' : 'incorrect'} (exerciseId: ${exerciseId})`,
      });
    },
    [exerciseMap, append, buildContextBlock],
  );

  /* ── Handle choice selection ─────────────────────────── */
  const handleChoice = useCallback(
    (entryId: string, choiceId: string, choiceText: string) => {
      setChoiceSelections((prev) => ({ ...prev, [entryId]: choiceId }));

      setChatEntries((prev) => [
        ...prev,
        { id: `user-choice-${entryId}`, kind: 'user_text', data: { text: choiceText } },
      ]);

      const ctx = buildContextBlock();
      void append({
        role: 'user',
        content: `${ctx}Player chose: "${choiceText}" (id: ${choiceId})`,
      });
    },
    [append, buildContextBlock],
  );

  /* ── Save completed session ──────────────────────────── */
  const handleSessionDone = useCallback(() => {
    const summaryEntry = chatEntries.find((e) => e.kind === 'summary');
    const summary = (summaryEntry?.data.summary as string) ?? 'Session completed';

    dispatchSession({
      type: 'SAVE_COMPLETED_SESSION',
      summary,
      messages: chatEntries,
      exerciseMap,
    });

    setMode('picker');
    setChatEntries([]);
    setExerciseMap({});
  }, [chatEntries, exerciseMap]);

  /* ── Review a past session ───────────────────────────── */
  const openReview = useCallback((session: CompletedSession) => {
    setReviewSession(session);
    setChatEntries(session.messages as ChatEntry[]);
    setExerciseMap(session.exerciseMap ?? {});
    setMode('review');
  }, []);

  /* ── Filter sessions for current city ────────────────── */
  const citySessions = sessionState.completedSessions.filter((s) => s.cityId === cityId);

  /* ── Render ─────────────────────────────────────────── */
  return (
    <div data-city-skin={skin} className="learn-chat-container">
      {mode === 'picker' && (
        <div className="session-picker">
          <div className="session-picker__header">
            <div className="session-picker__title">Learn Korean</div>
            <div className="session-picker__subtitle">Practice with Tong, your learning companion</div>
          </div>

          <button
            className="session-picker__start-btn"
            onClick={startSession}
            type="button"
          >
            Start new session
          </button>

          {citySessions.length > 0 && (
            <div className="session-picker__list">
              <div className="text-xs font-semibold opacity-50 mb-1">Past sessions</div>
              {citySessions.map((session) => {
                const accuracy = session.exercisesCompleted > 0
                  ? Math.round((session.exercisesCorrect / session.exercisesCompleted) * 100)
                  : 0;
                return (
                  <button
                    key={session.id}
                    className="session-picker__item"
                    onClick={() => openReview(session)}
                    type="button"
                  >
                    <div className="session-picker__item-title">
                      {session.summary.slice(0, 60)}
                      {session.summary.length > 60 ? '...' : ''}
                    </div>
                    <div className="session-picker__item-meta">
                      {accuracy}% accuracy · {session.exercisesCompleted} exercises · {new Date(session.startedAt).toLocaleDateString()}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {(mode === 'active' || mode === 'review') && (
        <>
          {mode === 'review' && (
            <div className="px-3 py-2 text-center text-xs opacity-60 bg-white/20">
              Reviewing past session ·{' '}
              <button
                className="underline"
                onClick={() => {
                  setMode('picker');
                  setReviewSession(null);
                  setChatEntries([]);
                }}
                type="button"
              >
                Back
              </button>
            </div>
          )}

          <div ref={scrollRef} className="learn-chat-scroll">
            {chatEntries.map((entry) => {
              switch (entry.kind) {
                case 'tong_text':
                  return (
                    <ChatRow key={entry.id} side="left" name="Tong" avatarEmoji="🐾">
                      <TongBubble text={entry.data.text as string} />
                    </ChatRow>
                  );

                case 'teaching':
                  return (
                    <ChatRow key={entry.id} side="left" avatarEmoji="📚">
                      <TeachingCard
                        korean={entry.data.korean as string | undefined}
                        translation={entry.data.translation as string | undefined}
                      />
                    </ChatRow>
                  );

                case 'exercise_prompt': {
                  const exId = entry.data.exerciseId as string;
                  const ex = exerciseMap[exId];
                  return (
                    <ChatRow key={entry.id} side="left" avatarEmoji="✏️">
                      <button
                        className="msg-bubble msg-bubble--npc text-sm font-medium"
                        onClick={() => mode !== 'review' && ex && setActiveExercise(ex)}
                        type="button"
                      >
                        {ex ? `Exercise: ${ex.prompt ?? ex.type}` : 'Exercise'}
                        {mode !== 'review' && ' (tap to open)'}
                      </button>
                    </ChatRow>
                  );
                }

                case 'feedback':
                  return (
                    <ChatRow key={entry.id} side="left" avatarEmoji={entry.data.positive ? '✅' : '❌'}>
                      <FeedbackBubble
                        positive={entry.data.positive as boolean}
                        message={entry.data.message as string}
                        detail={entry.data.detail as string | undefined}
                      />
                    </ChatRow>
                  );

                case 'choices':
                  return (
                    <ChatRow key={entry.id} side="left" avatarEmoji="🐾">
                      <div>
                        <TongBubble text={entry.data.prompt as string} />
                        <div className="mt-2">
                          <MenuChoices
                            choices={entry.data.choices as { id: string; text: string }[]}
                            selectedId={choiceSelections[entry.id] ?? null}
                            onSelect={(choiceId) => {
                              const choice = (entry.data.choices as { id: string; text: string }[])
                                .find((c) => c.id === choiceId);
                              if (choice) handleChoice(entry.id, choiceId, choice.text);
                            }}
                            disabled={mode === 'review'}
                          />
                        </div>
                      </div>
                    </ChatRow>
                  );

                case 'summary': {
                  return (
                    <ChatRow key={entry.id} side="left" avatarEmoji="🎉">
                      <SessionSummary
                        summary={entry.data.summary as string}
                        exercisesCompleted={entry.data.exercisesCompleted as number}
                        exercisesCorrect={entry.data.exercisesCorrect as number}
                        xpEarned={entry.data.xpEarned as number}
                        learnedItems={entry.data.learnedItems as { char: string; romanization?: string }[]}
                        onDone={mode === 'active' ? handleSessionDone : undefined}
                      />
                    </ChatRow>
                  );
                }

                case 'user_text':
                  return (
                    <ChatRow key={entry.id} side="right">
                      <div className="msg-bubble msg-bubble--user bubble-tail-right">
                        {entry.data.text as string}
                      </div>
                    </ChatRow>
                  );

                default:
                  return null;
              }
            })}

            {/* Loading indicator */}
            {isLoading && (
              <ChatRow side="left" avatarEmoji="🐾" name="Tong">
                <div className="msg-bubble msg-bubble--npc">
                  <div className="typing-indicator">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              </ChatRow>
            )}
          </div>
        </>
      )}

      {/* Exercise modal */}
      {activeExercise && mode === 'active' && (
        <ExerciseModal
          exercise={activeExercise}
          onResult={handleExerciseResult}
        />
      )}
    </div>
  );
}
