'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  createLearnSession,
  fetchLearnSessions,
  fetchObjectiveNext,
  respondHangout,
  startHangout,
  startOrResumeGame,
  type CityId,
  type LearnSession,
  type LocationId,
  type ObjectiveNextResponse,
  type ObjectiveProgressState,
  type SceneCharacter,
  type SceneLine,
  type ScoreState,
} from '@/lib/api';

interface DialogueMessage {
  id: string;
  speaker: 'character' | 'you';
  text: string;
}

interface PresetResponse {
  text: string;
  note: string;
}

const SEOUL: CityId = 'seoul';
const DEFAULT_LOCATION: LocationId = 'food_street';

const LOCATION_LABELS: Record<LocationId, string> = {
  food_street: 'Food Street',
  cafe: 'Cafe',
  convenience_store: 'Convenience Store',
  subway_hub: 'Subway Hub',
  practice_studio: 'Practice Studio',
};

const LOCATIONS: LocationId[] = [
  'food_street',
  'cafe',
  'convenience_store',
  'subway_hub',
  'practice_studio',
];

const LOCATION_CHARACTERS: Record<LocationId, SceneCharacter> = {
  food_street: { name: 'Jae', role: 'Street food buddy', avatarEmoji: 'FS', mood: 'welcoming' },
  cafe: { name: 'Yuna', role: 'Cafe friend', avatarEmoji: 'CF', mood: 'calm' },
  convenience_store: { name: 'Min', role: 'Store clerk', avatarEmoji: 'CV', mood: 'helpful' },
  subway_hub: { name: 'Haneul', role: 'Commuter guide', avatarEmoji: 'SB', mood: 'focused' },
  practice_studio: { name: 'Ara', role: 'Practice partner', avatarEmoji: 'PS', mood: 'energetic' },
};

const DEFAULT_PRESET_RESPONSES: PresetResponse[] = [
  { text: '떡볶이 주세요.', note: 'Order tteokbokki' },
  { text: '보통맛으로 해주세요.', note: 'Set spice level' },
  { text: '한 개 주세요, 감사합니다.', note: 'Confirm quantity politely' },
  { text: '포장해 주세요.', note: 'Ask for takeout' },
  { text: '물도 주세요.', note: 'Ask for water' },
];

const INITIAL_HINT = 'Tong hint: Use one short polite order phrase per turn.';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lineToHint(lines: SceneLine[]): string | null {
  for (const line of lines) {
    if (line.speaker === 'tong' && line.text.trim()) return line.text;
  }
  return null;
}

function isDialogueLine(line: SceneLine): line is SceneLine & { speaker: 'character' | 'you' } {
  return (line.speaker === 'character' || line.speaker === 'you') && Boolean(line.text.trim());
}

function lineToDialogue(lines: SceneLine[]): DialogueMessage[] {
  return lines
    .filter(isDialogueLine)
    .map((line) => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      speaker: line.speaker,
      text: line.text,
    }));
}

function getObjectiveRatio(progress?: ObjectiveProgressState): number | null {
  if (!progress) return null;
  if (typeof progress.percent === 'number') {
    return clamp01(progress.percent > 1 ? progress.percent / 100 : progress.percent);
  }
  if (typeof progress.current === 'number' && typeof progress.target === 'number' && progress.target > 0) {
    return clamp01(progress.current / progress.target);
  }
  return null;
}

function buildObjectiveSummary(objective: ObjectiveNextResponse | null): string {
  if (!objective) return 'Validate practical food-order language in context.';
  const vocab = objective.coreTargets.vocabulary.slice(0, 2).join(', ');
  const grammar = objective.coreTargets.grammar[0];
  if (!vocab && !grammar) return 'Validate practical food-order language in context.';
  if (vocab && grammar) return `Use ${vocab} with ${grammar}.`;
  return `Use ${vocab || grammar} naturally in scene dialogue.`;
}

function mergeCharacterPayload(base: SceneCharacter, payload?: SceneCharacter): SceneCharacter {
  if (!payload) return base;
  return {
    ...base,
    ...payload,
    avatarEmoji: payload.avatarEmoji || base.avatarEmoji,
  };
}

export default function GamePage() {
  const [mode, setMode] = useState<'hangout' | 'learn'>('hangout');
  const [location, setLocation] = useState<LocationId>(DEFAULT_LOCATION);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sceneSessionId, setSceneSessionId] = useState<string | null>(null);
  const [objective, setObjective] = useState<ObjectiveNextResponse | null>(null);
  const [objectiveRatio, setObjectiveRatio] = useState(0);
  const [character, setCharacter] = useState<SceneCharacter>(LOCATION_CHARACTERS[DEFAULT_LOCATION]);

  const [score, setScore] = useState<ScoreState>({ xp: 0, sp: 0, rp: 0 });
  const [hint, setHint] = useState(INITIAL_HINT);
  const [status, setStatus] = useState('Tap once to start or resume and jump into the first Seoul hangout.');
  const [messages, setMessages] = useState<DialogueMessage[]>([]);
  const [userUtterance, setUserUtterance] = useState('');
  const [presetResponses, setPresetResponses] = useState<PresetResponse[]>(DEFAULT_PRESET_RESPONSES);

  const [learnSessions, setLearnSessions] = useState<LearnSession[]>([]);
  const [learnMessage, setLearnMessage] = useState('');

  const [loadingStart, setLoadingStart] = useState(false);
  const [sendingTurn, setSendingTurn] = useState(false);
  const [loadingLearn, setLoadingLearn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const objectiveSummary = useMemo(() => buildObjectiveSummary(objective), [objective]);

  const requiredTurns = objective?.completionCriteria.requiredTurns ?? 4;
  const objectivePercent = Math.round(objectiveRatio * 100);
  const objectiveTurnProgress = Math.min(requiredTurns, Math.round(objectiveRatio * requiredTurns));

  const scorePercent = useMemo(() => {
    return {
      xp: Math.min(100, score.xp * 2.5),
      sp: Math.min(100, score.sp * 8),
      rp: Math.min(100, score.rp * 10),
    };
  }, [score]);

  useEffect(() => {
    if (mode === 'learn' && learnSessions.length === 0) {
      void refreshLearnSessions();
    }
  }, [mode]);

  function resetSceneState(nextLocation: LocationId) {
    setSceneSessionId(null);
    setObjective(null);
    setObjectiveRatio(0);
    setMessages([]);
    setUserUtterance('');
    setPresetResponses(DEFAULT_PRESET_RESPONSES);
    setCharacter(LOCATION_CHARACTERS[nextLocation]);
    setHint(INITIAL_HINT);
  }

  function handleLocationChange(nextLocation: LocationId) {
    setLocation(nextLocation);
    resetSceneState(nextLocation);
    setStatus(`Seoul · ${LOCATION_LABELS[nextLocation]} selected. Start or resume to enter the scene.`);
  }

  function applyServerReplies(replies?: string[]) {
    if (!replies?.length) return;
    setPresetResponses(replies.slice(0, 6).map((text) => ({ text, note: 'Suggested reply' })));
  }

  function mergeIncomingLines(lines: SceneLine[]) {
    const nextHint = lineToHint(lines);
    const dialogueLines = lineToDialogue(lines);
    if (nextHint) setHint(nextHint);
    if (dialogueLines.length) {
      setMessages((prev) => [...prev, ...dialogueLines]);
    }
  }

  async function quickStartHangout() {
    try {
      setLoadingStart(true);
      setError(null);
      setMode('hangout');
      setStatus(`Preparing Seoul · ${LOCATION_LABELS[location]}...`);
      resetSceneState(location);

      const game = await startOrResumeGame();
      setSessionId(game.sessionId);
      if (game.progression) {
        setScore({
          xp: game.progression.xp,
          sp: game.progression.sp,
          rp: game.progression.rp,
        });
      } else {
        setScore({ xp: 0, sp: 0, rp: 0 });
      }

      const nextObjective = await fetchObjectiveNext({
        city: SEOUL,
        location,
        mode: 'hangout',
        lang: 'ko',
      });
      setObjective(nextObjective);

      const hangout = await startHangout({
        objectiveId: nextObjective.objectiveId,
        city: SEOUL,
        location,
        lang: 'ko',
      });

      setSceneSessionId(hangout.sceneSessionId);
      setStatus('Hangout live. Use a preset phrase to test flow quickly.');
      setCharacter((current) => mergeCharacterPayload(current, hangout.character || hangout.npc));
      setScore(hangout.state.score);

      const startProgress =
        getObjectiveRatio(hangout.state.objectiveProgress) ?? getObjectiveRatio(hangout.objectiveProgress);
      if (startProgress !== null) {
        setObjectiveRatio(startProgress);
      }

      applyServerReplies(hangout.quickReplies);
      const openingLines =
        hangout.initialLines && hangout.initialLines.length > 0 ? hangout.initialLines : [hangout.initialLine];
      mergeIncomingLines(openingLines);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Failed to start the Seoul hangout.');
      setStatus('Start failed. Try again.');
    } finally {
      setLoadingStart(false);
    }
  }

  async function sendHangoutTurn(presetText?: string) {
    if (!sceneSessionId) {
      setError('Start or resume first to open the hangout scene.');
      return;
    }

    const utterance = (presetText ?? userUtterance).trim();
    if (!utterance || sendingTurn) return;

    setError(null);
    setSendingTurn(true);
    setUserUtterance('');
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        speaker: 'you',
        text: utterance,
      },
    ]);

    try {
      const response = await respondHangout(sceneSessionId, utterance);
      setScore(response.state.score);
      setHint(response.feedback.tongHint || INITIAL_HINT);
      setCharacter((current) => mergeCharacterPayload(current, response.character || response.npc));
      applyServerReplies(response.feedback.suggestedReplies);

      setObjectiveRatio((previous) => {
        const fromState = getObjectiveRatio(response.state.objectiveProgress);
        if (fromState !== null) return fromState;

        const fromFeedback = getObjectiveRatio(response.feedback.objectiveProgress);
        if (fromFeedback !== null) return fromFeedback;

        const delta = response.feedback.objectiveProgressDelta;
        const normalizedDelta = delta > 1 ? delta / 100 : delta;
        return clamp01(previous + normalizedDelta);
      });

      const nextLines =
        response.nextLines && response.nextLines.length > 0 ? response.nextLines : [response.nextLine];
      mergeIncomingLines(nextLines);

      if (response.completion?.isCompleted) {
        if (response.completion.completionSignal === 'objective_validated') {
          setStatus('Objective validated. Seoul mission gate preview unlocked.');
        } else {
          setStatus('Scene complete. Retry once more to fully validate objective.');
        }
      }
    } catch (turnError) {
      setError(turnError instanceof Error ? turnError.message : 'Failed to send your scene response.');
    } finally {
      setSendingTurn(false);
    }
  }

  async function refreshLearnSessions() {
    try {
      setLoadingLearn(true);
      setError(null);
      const sessions = await fetchLearnSessions({ city: SEOUL, lang: 'ko' });
      setLearnSessions(sessions.items);
    } catch (learnError) {
      setError(learnError instanceof Error ? learnError.message : 'Failed to load learn sessions.');
    } finally {
      setLoadingLearn(false);
    }
  }

  async function startNewLearnSession() {
    try {
      setLoadingLearn(true);
      setError(null);
      const created = await createLearnSession({
        objectiveId: objective?.objectiveId || 'ko_food_l2_001',
        city: SEOUL,
        lang: 'ko',
      });
      setLearnMessage(created.firstMessage.text);
      await refreshLearnSessions();
    } catch (learnError) {
      setError(learnError instanceof Error ? learnError.message : 'Failed to start learn session.');
    } finally {
      setLoadingLearn(false);
    }
  }

  return (
    <main className="app-shell game-shell">
      <header className="page-header">
        <p className="kicker">Game Quick-Start</p>
        <h1 className="page-title">Seoul new game to first hangout</h1>
        <p className="page-copy">
          Mobile-first flow with one-tap start or resume, objective progression, and fast response chips for demo
          testing.
        </p>
        <div className="nav-links">
          <Link href="/" className="nav-link">
            Home
          </Link>
          <Link href="/overlay" className="nav-link">
            Overlay
          </Link>
          <Link href="/insights" className="nav-link">
            Insights
          </Link>
        </div>
      </header>

      <section className="card stack game-quickstart-card">
        <div className="row">
          <div className="stack" style={{ gap: 6 }}>
            <span className="pill">Seoul Quick Start</span>
            <h2 className="game-section-title">One tap to first hangout</h2>
          </div>
          <span className="pill">{sceneSessionId ? 'Hangout live' : sessionId ? 'Session ready' : 'New game'}</span>
        </div>

        <div className="game-mode-toggle">
          <button className={mode === 'hangout' ? '' : 'secondary'} onClick={() => setMode('hangout')}>
            Hangout Mode
          </button>
          <button className={mode === 'learn' ? '' : 'secondary'} onClick={() => setMode('learn')}>
            Learn Mode
          </button>
        </div>

        <button onClick={() => void quickStartHangout()} disabled={loadingStart}>
          {loadingStart ? 'Starting...' : sceneSessionId ? 'Restart Seoul Hangout' : 'Start or Resume Seoul Hangout'}
        </button>

        <p className="game-status">{status}</p>
        {error && <p className="game-error">{error}</p>}
      </section>

      <section className="game-mobile-wrap">
        <article className="mobile-frame game-mobile-frame">
          <div className="mobile-head game-mobile-head">
            <p className="game-mobile-kicker">City · Location</p>
            <div className="row">
              <strong>
                Seoul · {LOCATION_LABELS[location]}
              </strong>
              <span className="pill">{mode}</span>
            </div>
            <div className="game-location-row">
              {LOCATIONS.map((item) => (
                <button
                  key={item}
                  className={`game-location-pill ${item === location ? 'active' : ''}`}
                  onClick={() => handleLocationChange(item)}
                >
                  {LOCATION_LABELS[item]}
                </button>
              ))}
            </div>
          </div>

          <div className="mobile-body game-mobile-body">
            {mode === 'hangout' && (
              <>
                <section className="game-character-card">
                  <span className="game-character-avatar">{character.avatarEmoji || 'KO'}</span>
                  <div>
                    <p className="game-card-kicker">Hangout character</p>
                    <strong>{character.name || 'Seoul friend'}</strong>
                    <p>{character.role || 'Local conversation partner'}</p>
                  </div>
                </section>

                <section className="game-progress-card stack">
                  <div>
                    <div className="row">
                      <strong>Objective progress</strong>
                      <span>
                        {objectiveTurnProgress}/{requiredTurns} turns
                      </span>
                    </div>
                    <p className="game-objective-copy">{objectiveSummary}</p>
                    <div className="metric-bar">
                      <div className="metric-fill game-progress-fill" style={{ width: `${objectivePercent}%` }} />
                    </div>
                  </div>

                  <div className="stack" style={{ gap: 8 }}>
                    <div>
                      <div className="row">
                        <span>XP</span>
                        <span>{score.xp}</span>
                      </div>
                      <div className="metric-bar">
                        <div className="metric-fill" style={{ width: `${scorePercent.xp}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="row">
                        <span>SP</span>
                        <span>{score.sp}</span>
                      </div>
                      <div className="metric-bar">
                        <div className="metric-fill" style={{ width: `${scorePercent.sp}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="row">
                        <span>RP</span>
                        <span>{score.rp}</span>
                      </div>
                      <div className="metric-bar">
                        <div className="metric-fill" style={{ width: `${scorePercent.rp}%` }} />
                      </div>
                    </div>
                  </div>
                </section>

                <div className="chat-bubble chat-tong">
                  <strong>Tong hint:</strong> {hint}
                </div>

                <section className="game-dialogue-feed">
                  {messages.length === 0 && (
                    <p className="game-empty-state">Tap start to enter dialogue, then test with a preset phrase.</p>
                  )}
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`chat-bubble ${message.speaker === 'you' ? 'chat-user' : 'chat-character'}`}
                    >
                      {message.text}
                    </div>
                  ))}
                </section>

                <section className="game-chip-grid">
                  {presetResponses.map((preset) => (
                    <button
                      key={preset.text}
                      className="secondary game-chip"
                      onClick={() => void sendHangoutTurn(preset.text)}
                      disabled={!sceneSessionId || sendingTurn}
                    >
                      <span className="game-chip-main">{preset.text}</span>
                      <span className="game-chip-note">{preset.note}</span>
                    </button>
                  ))}
                </section>

                <div className="stack">
                  <textarea
                    rows={2}
                    value={userUtterance}
                    placeholder="Type your own response"
                    onChange={(event) => setUserUtterance(event.target.value)}
                  />
                  <button
                    onClick={() => void sendHangoutTurn()}
                    disabled={!sceneSessionId || !userUtterance.trim() || sendingTurn}
                  >
                    {sendingTurn ? 'Sending...' : 'Send response'}
                  </button>
                </div>
              </>
            )}

            {mode === 'learn' && (
              <>
                <section className="game-learn-head stack">
                  <h3 style={{ margin: 0 }}>Learn chat sessions</h3>
                  <p style={{ margin: 0 }}>
                    Review previous Seoul sessions or launch a new objective-focused drill before your next hangout.
                  </p>
                  <div className="row">
                    <button className="secondary" onClick={() => void refreshLearnSessions()} disabled={loadingLearn}>
                      View previous sessions
                    </button>
                    <button onClick={() => void startNewLearnSession()} disabled={loadingLearn}>
                      Start new session
                    </button>
                  </div>
                </section>

                {learnMessage && <div className="chat-bubble chat-tong">Tong: {learnMessage}</div>}
                {loadingLearn && <p>Loading learn sessions...</p>}
                {!loadingLearn && learnSessions.length === 0 && <p>No prior sessions yet.</p>}

                <section className="stack">
                  {learnSessions.map((session) => (
                    <article key={session.learnSessionId} className="game-learn-item">
                      <div className="row" style={{ alignItems: 'flex-start' }}>
                        <div>
                          <strong>{session.title}</strong>
                          <p>Objective: {session.objectiveId}</p>
                        </div>
                        <span className="pill">{new Date(session.lastMessageAt).toLocaleDateString()}</span>
                      </div>
                    </article>
                  ))}
                </section>
              </>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
