'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  createLearnSession,
  fetchLearnSessions,
  fetchObjectiveNext,
  respondHangout,
  startHangout,
  startOrResumeGame,
  type LearnSession,
  type ScoreState,
} from '@/lib/api';

type CityId = 'seoul' | 'tokyo' | 'shanghai';
type LocationId = 'food_street' | 'cafe' | 'convenience_store' | 'subway_hub' | 'practice_studio';

interface ChatMessage {
  speaker: 'character' | 'tong' | 'you';
  text: string;
}

const CITY_LABELS: Record<CityId, string> = {
  seoul: 'Seoul',
  tokyo: 'Tokyo',
  shanghai: 'Shanghai',
};

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

export default function GamePage() {
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [objectiveId, setObjectiveId] = useState('ko_food_l2_001');
  const [targets, setTargets] = useState<{ vocabulary: string[]; grammar: string[]; sentenceStructures: string[] }>({
    vocabulary: [],
    grammar: [],
    sentenceStructures: [],
  });

  const [mode, setMode] = useState<'hangout' | 'learn'>('hangout');
  const [selectedCity, setSelectedCity] = useState<CityId>('seoul');
  const [selectedLocation, setSelectedLocation] = useState<LocationId>('food_street');

  const [sceneSessionId, setSceneSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [score, setScore] = useState<ScoreState>({ xp: 0, sp: 0, rp: 0 });
  const [hint, setHint] = useState('Tong hints will appear here during hangout turns.');
  const [userUtterance, setUserUtterance] = useState('');

  const [learnSessions, setLearnSessions] = useState<LearnSession[]>([]);
  const [learnMessage, setLearnMessage] = useState('');

  const progress = useMemo(() => {
    const xp = Math.min(100, score.xp * 2.5);
    const sp = Math.min(100, score.sp * 8);
    const rp = Math.min(100, score.rp * 10);
    return { xp, sp, rp };
  }, [score]);

  async function bootstrapSession() {
    try {
      setLoading(true);
      const [game, objective, sessions] = await Promise.all([
        startOrResumeGame(),
        fetchObjectiveNext(),
        fetchLearnSessions(),
      ]);

      setSessionId(game.sessionId);
      setObjectiveId(objective.objectiveId);
      setTargets(objective.coreTargets);
      setLearnSessions(sessions.items);
      setMessages([]);
      setScore({ xp: 0, sp: 0, rp: 0 });
      setSceneSessionId(null);
      setHint('Session ready. Start hangout to enter scene dialogue.');
    } finally {
      setLoading(false);
    }
  }

  async function beginHangout() {
    if (!sessionId) {
      await bootstrapSession();
    }

    const hangout = await startHangout(objectiveId);
    setSceneSessionId(hangout.sceneSessionId);
    setMessages([{ speaker: hangout.initialLine.speaker, text: hangout.initialLine.text }]);
    setScore(hangout.state.score);
    setHint('Stay in-character and use objective vocabulary in each response.');
  }

  async function sendHangoutTurn() {
    if (!sceneSessionId || !userUtterance.trim()) return;

    const utterance = userUtterance.trim();
    setUserUtterance('');
    setMessages((prev) => [...prev, { speaker: 'you', text: utterance }]);

    const response = await respondHangout(sceneSessionId, utterance);
    setMessages((prev) => [...prev, { speaker: response.nextLine.speaker, text: response.nextLine.text }]);
    setScore(response.state.score);
    setHint(response.feedback.tongHint);
  }

  async function refreshLearnSessions() {
    const sessions = await fetchLearnSessions();
    setLearnSessions(sessions.items);
  }

  async function startNewLearnSession() {
    const created = await createLearnSession(objectiveId);
    setLearnMessage(created.firstMessage.text);
    await refreshLearnSessions();
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <p className="kicker">Mobile Game Review</p>
        <h1 className="page-title">Objective-specific session flow (mobile-first)</h1>
        <p className="page-copy">
          This screen validates start/resume, city/location selection, hangout progression, and learn session
          history/new session behavior.
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

      <section className="grid grid-2" style={{ alignItems: 'flex-start' }}>
        <article className="card stack">
          <div className="row">
            <h3>Session Setup</h3>
            <span className="pill">{sessionId ? 'Session active' : 'Not started'}</span>
          </div>
          <button onClick={() => void bootstrapSession()} disabled={loading}>
            {loading ? 'Starting...' : 'Start or Resume'}
          </button>

          <div className="stack">
            <span className="pill">City</span>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {(Object.keys(CITY_LABELS) as CityId[]).map((city) => (
                <button
                  key={city}
                  className={selectedCity === city ? undefined : 'secondary'}
                  onClick={() => setSelectedCity(city)}
                >
                  {CITY_LABELS[city]}
                </button>
              ))}
            </div>
          </div>

          <div className="stack">
            <span className="pill">Location</span>
            <select
              value={selectedLocation}
              onChange={(event) => setSelectedLocation(event.target.value as LocationId)}
            >
              {LOCATIONS.map((location) => (
                <option key={location} value={location}>
                  {LOCATION_LABELS[location]}
                </option>
              ))}
            </select>
          </div>

          <div className="stack">
            <span className="pill">Objective {objectiveId}</span>
            <p>Vocabulary: {targets.vocabulary.join(', ') || '-'}</p>
            <p>Grammar: {targets.grammar.join(', ') || '-'}</p>
            <p>Sentence: {targets.sentenceStructures.join(', ') || '-'}</p>
          </div>

          <div className="row">
            <button className={mode === 'hangout' ? undefined : 'secondary'} onClick={() => setMode('hangout')}>
              Hangout Mode
            </button>
            <button className={mode === 'learn' ? undefined : 'secondary'} onClick={() => setMode('learn')}>
              Learn Mode
            </button>
          </div>
        </article>

        <article className="mobile-frame">
          <div className="mobile-head">
            <div className="row">
              <strong>
                {CITY_LABELS[selectedCity]} · {LOCATION_LABELS[selectedLocation]}
              </strong>
              <span className="pill">{mode}</span>
            </div>
          </div>

          <div className="mobile-body">
            {mode === 'hangout' && (
              <>
                <div className="row">
                  <button onClick={() => void beginHangout()} disabled={!sessionId && loading}>
                    {sceneSessionId ? 'Restart Hangout' : 'Start Hangout'}
                  </button>
                </div>

                <div className="stack">
                  <p className="korean" style={{ margin: 0, color: '#0f766e', fontWeight: 600 }}>
                    Tong hint: {hint}
                  </p>
                  {messages.length === 0 && <p>Start a hangout to begin the first-person dialogue flow.</p>}

                  {messages.map((message, index) => {
                    const toneClass =
                      message.speaker === 'you'
                        ? 'chat-user'
                        : message.speaker === 'tong'
                          ? 'chat-tong'
                          : 'chat-character';
                    return (
                      <div key={`${message.speaker}-${index}`} className={`chat-bubble ${toneClass}`}>
                        <strong style={{ textTransform: 'capitalize' }}>{message.speaker}:</strong> {message.text}
                      </div>
                    );
                  })}
                </div>

                <div className="stack">
                  <textarea
                    rows={2}
                    value={userUtterance}
                    placeholder="Type your in-scene response (e.g., 떡볶이 주세요)"
                    onChange={(event) => setUserUtterance(event.target.value)}
                  />
                  <button onClick={() => void sendHangoutTurn()} disabled={!sceneSessionId || !userUtterance.trim()}>
                    Send turn
                  </button>
                </div>

                <div className="stack">
                  <div>
                    <div className="row">
                      <span>XP</span>
                      <span>{score.xp}</span>
                    </div>
                    <div className="metric-bar">
                      <div className="metric-fill" style={{ width: `${progress.xp}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="row">
                      <span>SP</span>
                      <span>{score.sp}</span>
                    </div>
                    <div className="metric-bar">
                      <div className="metric-fill" style={{ width: `${progress.sp}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="row">
                      <span>RP</span>
                      <span>{score.rp}</span>
                    </div>
                    <div className="metric-bar">
                      <div className="metric-fill" style={{ width: `${progress.rp}%` }} />
                    </div>
                  </div>
                </div>
              </>
            )}

            {mode === 'learn' && (
              <>
                <div className="stack">
                  <h3 style={{ margin: 0 }}>Learn Sessions</h3>
                  <p style={{ margin: 0 }}>View previous sessions and start a new objective-focused drill.</p>
                  <div className="row">
                    <button className="secondary" onClick={() => void refreshLearnSessions()}>
                      View previous sessions
                    </button>
                    <button onClick={() => void startNewLearnSession()}>Start new session</button>
                  </div>
                </div>

                {learnMessage && <div className="chat-bubble chat-tong">Tong: {learnMessage}</div>}

                <div className="stack">
                  {learnSessions.length === 0 && <p>No prior sessions loaded yet.</p>}
                  {learnSessions.map((session) => (
                    <div key={session.learnSessionId} className="card" style={{ padding: 12 }}>
                      <div className="row" style={{ alignItems: 'flex-start' }}>
                        <div>
                          <strong>{session.title}</strong>
                          <p style={{ margin: 0 }}>Objective: {session.objectiveId}</p>
                        </div>
                        <span className="pill">{new Date(session.lastMessageAt).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
