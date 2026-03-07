'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChat } from 'ai/react';
import type { ExerciseData } from '@/lib/types/hangout';
import { generateExercise, type ExerciseHints } from '@/lib/exercises/generators';
import { parseExerciseData } from '@/lib/exercises/validate';
import { extractTargetItems } from '@/lib/exercises/extract-targets';
import { getCitySkin } from '@/lib/theme/city-skins';
import { dispatch as gameDispatch, useGameState, getMasterySnapshot } from '@/lib/store/game-store';
import { dispatchSession, useSessionState, type CompletedSession } from '@/lib/store/session-store';
import { getLocationOrDefault } from '@/lib/content/locations';

import { useUILang } from '@/lib/i18n/UILangContext';
import { t } from '@/lib/i18n/ui-strings';

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
  /** Skip the session picker and auto-start a new session on mount. */
  autoStart?: boolean;
  /** If provided, open this session in review mode instead of starting a new one. */
  initialReviewSession?: CompletedSession;
}

/* ── Component ────────────────────────────────────────────── */

export function LearnPanel({ cityId, locationId, objectiveId, autoStart, initialReviewSession }: LearnPanelProps) {
  const skin = getCitySkin(cityId);
  const gameState = useGameState();
  const sessionState = useSessionState();
  const uiLang = useUILang();

  const learnTitleKey = { seoul: 'learn_korean', tokyo: 'learn_japanese', shanghai: 'learn_chinese' }[cityId] ?? 'learn_korean';
  const tongName = { en: 'Tong', ko: '통', ja: 'トン', zh: '小通' }[uiLang] ?? 'Tong';

  const [mode, setMode] = useState<PanelMode>(initialReviewSession ? 'review' : (autoStart ? 'active' : 'picker'));
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

    // Filter itemMastery to relevant keys (jamo + location vocab) to keep payload small
    const allJamo = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ'.split('');
    const vocabTargets = location.vocabularyTargets?.map((v) => v.word) ?? [];
    const relevantKeys = new Set([...allJamo, ...vocabTargets]);
    const filteredMastery: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(gameState.itemMastery)) {
      if (relevantKeys.has(key)) filteredMastery[key] = val;
    }

    const ctx = {
      playerLevel: level,
      selfAssessedLevel: gameState.selfAssessedLevel,
      calibratedLevel: gameState.calibratedLevel,
      mastery,
      objectives,
      cityId,
      locationId,
      explainIn: gameState.explainIn[cityId as keyof typeof gameState.explainIn] ?? 'en',
      sessionExercisesCompleted: active?.exercisesCompleted ?? 0,
      sessionExercisesCorrect: active?.exercisesCorrect ?? 0,
      itemMastery: filteredMastery,
    };

    return `[LEARN_CONTEXT]${JSON.stringify(ctx)}[/LEARN_CONTEXT]`;
  }, [cityId, locationId, gameState, sessionState.activeSession]);

  /* ── useChat integration ──────────────────────────────── */
  const { append, isLoading } = useChat({
    api: '/api/ai/lesson',
    id: `learn-${sessionState.activeSession?.id ?? 'none'}`,
    maxSteps: 4,
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
          const parsed = parseExerciseData(args.exerciseData);
          if (parsed) {
            exercise = parsed;
          } else {
            const hints: ExerciseHints = {
              objectiveId: (args.objectiveId as string) ?? objectiveId ?? 'ko-vocab-food-items',
              hintItems: (args.hintItems as string[] | null) ?? undefined,
              hintCount: (args.hintCount as number | null) ?? undefined,
              hintSubType: (args.hintSubType as string | null) ?? undefined,
              mastery: gameState.itemMastery,
            };
            exercise = generateExercise(args.exerciseType as string, hints);
          }

          setExerciseMap((prev) => ({ ...prev, [exercise.id]: exercise }));
          setChatEntries((prev) => [
            ...prev,
            { id: toolCallId, kind: 'exercise_prompt', data: { exerciseId: exercise.id } },
          ]);
          // Don't auto-open — let the user tap the exercise prompt to open it
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

  /* ── Auto-start on mount ───────────────────────────── */
  const didAutoStart = useRef(false);
  useEffect(() => {
    if (autoStart && !didAutoStart.current && !initialReviewSession) {
      didAutoStart.current = true;
      startSession();
    }
  }, [autoStart, initialReviewSession, startSession]);

  /* ── Load initial review session ───────────────────── */
  const didLoadReview = useRef(false);
  useEffect(() => {
    if (initialReviewSession && !didLoadReview.current) {
      didLoadReview.current = true;
      setChatEntries(initialReviewSession.messages as ChatEntry[]);
      setExerciseMap(initialReviewSession.exerciseMap ?? {});
      setReviewSession(initialReviewSession);
      setMode('review');
    }
  }, [initialReviewSession]);

  /* ── Handle exercise result ──────────────────────────── */
  const handleExerciseResult = useCallback(
    (exerciseId: string, correct: boolean, summary?: string) => {
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

      // Add result card showing exercise type + score/selection
      const ex = exerciseMap[exerciseId];
      setChatEntries((prev) => [
        ...prev,
        {
          id: `user-ex-${exerciseId}`,
          kind: 'user_text',
          data: {
            isResult: true,
            correct,
            exerciseType: ex?.type ?? 'exercise',
            exerciseSummary: summary ?? '',
          },
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

  /* ── Save session helper ────────────────────────────── */
  const saveCurrentSession = useCallback(() => {
    const summaryEntry = chatEntries.find((e) => e.kind === 'summary');
    const summary = (summaryEntry?.data.summary as string) ?? 'Session completed';
    dispatchSession({
      type: 'SAVE_COMPLETED_SESSION',
      summary,
      messages: chatEntries,
      exerciseMap,
    });
  }, [chatEntries, exerciseMap]);

  /* ── Review this session after done ────────────────── */
  const handleReviewThis = useCallback(() => {
    saveCurrentSession();
    // Stay in the chat scroll but switch to review mode
    setMode('review');
  }, [saveCurrentSession]);

  /* ── Start a new session after done ────────────────── */
  const handleNewSession = useCallback(() => {
    saveCurrentSession();
    startSession();
  }, [saveCurrentSession, startSession]);

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
            <div className="session-picker__title">{t(learnTitleKey, uiLang)}</div>
            <div className="session-picker__subtitle">{t('practice_with_tong', uiLang)}</div>
          </div>

          <button
            className="session-picker__start-btn"
            onClick={startSession}
            type="button"
          >
            {t('start_new_session', uiLang)}
          </button>

          {citySessions.length > 0 && (
            <div className="session-picker__list">
              <div className="session-picker__list-label">{t('past_sessions', uiLang)}</div>
              {citySessions.map((session) => {
                const acc = session.exercisesCompleted > 0
                  ? Math.round((session.exercisesCorrect / session.exercisesCompleted) * 100)
                  : 0;
                return (
                  <button
                    key={session.id}
                    className="session-picker__item"
                    onClick={() => openReview(session)}
                    type="button"
                  >
                    <div className="session-picker__item-header">
                      <span className="session-picker__item-acc">{acc}%</span>
                      <span className="session-picker__item-date">{new Date(session.startedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="session-picker__item-title">
                      {session.summary.slice(0, 80)}
                      {session.summary.length > 80 ? '…' : ''}
                    </div>
                    <div className="session-picker__item-meta">
                      {session.exercisesCompleted} {t('exercises_label', uiLang)} · {session.exercisesCorrect} {t('correct_count', uiLang)}
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
            <div className="learn-chat-topbar">
              <button
                className="learn-chat-topbar__back"
                onClick={() => { setMode('picker'); setChatEntries([]); setExerciseMap({}); setReviewSession(null); }}
                type="button"
              >
                ← {t('back', uiLang)}
              </button>
              <span className="learn-chat-topbar__label">{t('reviewing_session', uiLang)}</span>
            </div>
          )}

          <div ref={scrollRef} className="learn-chat-scroll">
            {chatEntries.map((entry) => {
              switch (entry.kind) {
                case 'tong_text':
                  return (
                    <ChatRow key={entry.id} side="left" name={tongName} avatarEmoji="🐾">
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
                  const typeLabel = t(`ex_${ex?.type}`, uiLang) || ex?.type?.replace('_', ' ') || 'Exercise';
                  return (
                    <ChatRow key={entry.id} side="left" avatarEmoji="✏️">
                      {mode === 'review' && ex ? (
                        <div className="learn-exercise-review">
                          <div className="learn-exercise-review__header">✏️ {typeLabel}</div>
                          <div className="learn-exercise-review__prompt">{ex.prompt}</div>
                          {ex.type === 'matching' && (
                            <div className="learn-exercise-review__pairs">
                              {ex.pairs.map((p, i) => (
                                <div key={i} className="learn-exercise-review__pair">
                                  <span className="text-ko">{p.left}</span> → <span>{p.right}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {ex.type === 'multiple_choice' && (
                            <div className="learn-exercise-review__options">
                              {ex.options.map((o) => (
                                <div key={o.id} className={`learn-exercise-review__option ${o.id === ex.correctOptionId ? 'learn-exercise-review__option--correct' : ''}`}>
                                  {o.id === ex.correctOptionId && <span className="learn-exercise-review__check">✓</span>}
                                  <span className="text-ko">{o.text}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {ex.type === 'fill_blank' && (
                            <div className="learn-exercise-review__detail">
                              <div className="learn-exercise-review__sentence">{ex.sentence}</div>
                              <div className="learn-exercise-review__options">
                                {ex.options.map((o) => (
                                  <div key={o.id} className={`learn-exercise-review__option ${o.id === ex.correctOptionId ? 'learn-exercise-review__option--correct' : ''}`}>
                                    {o.id === ex.correctOptionId && <span className="learn-exercise-review__check">✓</span>}
                                    <span className="text-ko">{o.text}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {ex.type === 'sentence_builder' && (
                            <div className="learn-exercise-review__detail">
                              <span className="learn-exercise-review__answer">{ex.correctOrder.join(' ')}</span>
                            </div>
                          )}
                          {ex.type === 'pronunciation_select' && (
                            <div className="learn-exercise-review__detail">
                              <div className="learn-exercise-review__target text-ko">{ex.targetText}</div>
                              <div className="learn-exercise-review__options">
                                {ex.audioOptions.map((o) => (
                                  <div key={o.id} className={`learn-exercise-review__option ${o.id === ex.correctOptionId ? 'learn-exercise-review__option--correct' : ''}`}>
                                    {o.id === ex.correctOptionId && <span className="learn-exercise-review__check">✓</span>}
                                    {o.romanization}{o.meaning ? ` (${o.meaning})` : ''}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {ex.type === 'drag_drop' && (
                            <div className="learn-exercise-review__pairs">
                              {ex.targets.map((tgt) => {
                                // correctMapping is item-id → target-id, so reverse lookup
                                const itemEntry = Object.entries(ex.correctMapping).find(([, targetId]) => targetId === tgt.id);
                                const item = itemEntry ? ex.items.find((it) => it.id === itemEntry[0]) : null;
                                return (
                                  <div key={tgt.id} className="learn-exercise-review__pair">
                                    <span>{tgt.label}</span> → <span className="text-ko">{item?.text ?? '?'}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {ex.type === 'stroke_tracing' && (
                            <div className="learn-exercise-review__detail">
                              <span className="learn-exercise-review__target-char text-ko">{ex.targetChar}</span>
                              {ex.romanization && <span className="learn-exercise-review__rom">{ex.romanization}</span>}
                              {ex.meaning && <span className="learn-exercise-review__meaning">{ex.meaning}</span>}
                            </div>
                          )}
                          {ex.type === 'error_correction' && (
                            <div className="learn-exercise-review__detail">
                              <div className="learn-exercise-review__sentence">{ex.sentence}</div>
                              <div className="learn-exercise-review__options">
                                {ex.options.map((o) => (
                                  <div key={o.id} className={`learn-exercise-review__option ${o.id === ex.correctOptionId ? 'learn-exercise-review__option--correct' : ''}`}>
                                    {o.id === ex.correctOptionId && <span className="learn-exercise-review__check">✓</span>}
                                    <span className="text-ko">{o.text}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {ex.type === 'pattern_recognition' && (
                            <div className="learn-exercise-review__pairs">
                              {ex.pairs.map((p, i) => (
                                <div key={i} className={`learn-exercise-review__pair ${i === ex.correctPairIndex ? 'learn-exercise-review__pair--correct' : ''}`}>
                                  <span className="text-ko">{p.chars}</span> — <span>{p.explanation}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {('explanation' in ex) && ex.explanation && (
                            <div className="learn-exercise-review__explanation">{ex.explanation}</div>
                          )}
                        </div>
                      ) : (
                        <button
                          className="learn-exercise-prompt-btn"
                          onClick={() => ex && setActiveExercise(ex)}
                          type="button"
                        >
                          <span className="learn-exercise-prompt-btn__label">
                            ✏️ {typeLabel}
                          </span>
                          <span className="learn-exercise-prompt-btn__cta">
                            {t('tap_to_start_exercise', uiLang)} →
                          </span>
                        </button>
                      )}
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
                        onReview={mode === 'active' ? handleReviewThis : undefined}
                        onNewSession={mode === 'active' ? handleNewSession : undefined}
                      />
                    </ChatRow>
                  );
                }

                case 'user_text': {
                  const isResult = entry.data.isResult as boolean | undefined;
                  const isCorrect = entry.data.correct as boolean | undefined;
                  if (isResult) {
                    const exSummary = (entry.data.exerciseSummary as string) ?? '';

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    let detail: any = null;
                    try { detail = JSON.parse(exSummary); } catch { /* plain string or empty */ }

                    return (
                      <ChatRow key={entry.id} side="right">
                        <div className={`learn-result-card ${isCorrect ? 'learn-result-card--correct' : 'learn-result-card--wrong'}`}>
                          <span className="learn-result-card__icon">{isCorrect ? '✓' : '✗'}</span>
                          <div className="learn-result-card__body">
                            {detail?.kind === 'pairs' && (
                              <div className="learn-result-card__pairs">
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {(detail.items as any[]).map((p: { left: string; right: string; ok: boolean }, i: number) => (
                                  <span key={i} className={`learn-result-card__pair ${p.ok ? 'learn-result-card__pair--ok' : 'learn-result-card__pair--wrong'}`}>
                                    <span className="text-ko">{p.left}</span>
                                    <span className="learn-result-card__arrow">{p.ok ? '→' : '✗'}</span>
                                    <span>{p.right}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                            {detail?.kind === 'pick' && (
                              <div className="learn-result-card__pick">
                                <span className="text-ko">{detail.selected}</span>
                                {!isCorrect && (
                                  <span className="learn-result-card__correct-answer">→ {detail.answer}</span>
                                )}
                              </div>
                            )}
                            {!detail && exSummary && (
                              <span className="learn-result-card__status">{exSummary}</span>
                            )}
                            {!detail && !exSummary && (
                              <span className="learn-result-card__status">
                                {isCorrect ? '✓' : '✗'}
                              </span>
                            )}
                          </div>
                        </div>
                      </ChatRow>
                    );
                  }
                  return (
                    <ChatRow key={entry.id} side="right">
                      <div className="msg-bubble msg-bubble--user bubble-tail-right">
                        {entry.data.text as string}
                      </div>
                    </ChatRow>
                  );
                }

                default:
                  return null;
              }
            })}

            {/* Loading indicator — hide if session already has summary */}
            {isLoading && !chatEntries.some((e) => e.kind === 'summary') && (
              <ChatRow side="left" avatarEmoji="🐾" name={tongName}>
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
