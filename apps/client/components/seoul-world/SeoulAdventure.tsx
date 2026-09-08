'use client';

import dynamic from 'next/dynamic';
import { Component, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './SeoulAdventure.module.css';
import {
  COMPANIONS,
  LOCATIONS,
  MISSION,
} from '@/lib/seoul-adventure/content';
import {
  completeHangout,
  completeLesson,
  completeMission,
  missionReady,
  newProgress,
  nextObjective,
  restoreProgress,
  visitLocation,
} from '@/lib/seoul-adventure/progress';
import type { CompanionId, LocationId, Phrase, Progress } from '@/lib/seoul-adventure/types';

const SAVE_KEY = 'tong.seoul-adventure.v1';

type WorldProps = {
  locations: { id: string; name: string; korean: string; position: [number, number]; color: string }[];
  target: { x: number; z: number } | null;
  input: { x: number; z: number };
  paused: boolean;
  conversation: boolean;
  focusId: string | null;
  companion: 'haeun' | 'jin';
  onNear: (id: string | null) => void;
  onPosition: (p: { x: number; z: number }) => void;
  onReady: () => void;
  onError: (message: string) => void;
};

const SeoulWorld = dynamic<WorldProps>(() => import('./SeoulWorld'), {
  ssr: false,
  loading: () => <div className={styles.worldLoading} aria-label="Preparing Seoul"><span>Opening the streets of Seoul…</span></div>,
});

type Panel = 'welcome' | 'poi' | 'learn' | 'hangout' | 'journal' | 'mission' | 'fallback' | null;

class WorldErrorBoundary extends Component<{ onError: (message: string) => void; children: ReactNode }> {
  componentDidCatch(error: Error) { this.props.onError(error.message || 'The 3D neighborhood could not start.'); }
  render() { return this.props.children; }
}

function phraseText(phrase: Phrase) {
  return `${phrase.romanization} · ${phrase.en}`;
}

export default function SeoulAdventure() {
  const [panel, setPanel] = useState<Panel>('welcome');
  const [progress, setProgress] = useState<Progress>(() => newProgress());
  const [nearId, setNearId] = useState<LocationId | null>(null);
  const [focusId, setFocusId] = useState<LocationId | null>(null);
  const [target, setTarget] = useState<{ x: number; z: number } | null>(null);
  const [input, setInput] = useState({ x: 0, z: 0 });
  const [companion, setCompanion] = useState<CompanionId>('haeun');
  const [worldReady, setWorldReady] = useState(false);
  const [worldError, setWorldError] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const location = useMemo(
    () => LOCATIONS.find((entry) => entry.id === (focusId ?? nearId)) ?? null,
    [focusId, nearId],
  );
  const isOverlay = panel !== null;
  const objective = nextObjective(progress);

  useEffect(() => {
    try {
      setProgress(restoreProgress(window.localStorage.getItem(SAVE_KEY)));
    } catch {
      setSaveNote('Progress will stay in this visit — saving is unavailable.');
    }
  }, []);

  const updateProgress = useCallback((next: Progress) => {
    setProgress(next);
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(next));
    } catch {
      setSaveNote('Progress will stay in this visit — saving is unavailable.');
    }
  }, []);

  const openPanel = useCallback((next: Panel, element?: HTMLElement | null) => {
    if (element) lastFocus.current = element;
    setResult(null);
    setRevealed(false);
    setPanel(next);
  }, []);

  const closePanel = useCallback(() => {
    setInput({ x: 0, z: 0 });
    setPanel(null);
    window.setTimeout(() => lastFocus.current?.focus(), 0);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && panel !== 'welcome') closePanel();
      if (isOverlay || event.metaKey || event.ctrlKey || event.altKey) return;
      const vectors: Record<string, { x: number; z: number }> = {
        w: { x: 0, z: -1 }, ArrowUp: { x: 0, z: -1 },
        s: { x: 0, z: 1 }, ArrowDown: { x: 0, z: 1 },
        a: { x: -1, z: 0 }, ArrowLeft: { x: -1, z: 0 },
        d: { x: 1, z: 0 }, ArrowRight: { x: 1, z: 0 },
      };
      if (event.key.toLowerCase() === 'e' && nearId) {
        event.preventDefault();
        setFocusId(nearId);
        openPanel('poi', document.activeElement as HTMLElement);
      } else if (vectors[event.key]) {
        event.preventDefault();
        setTarget(null);
        setInput(vectors[event.key]);
      }
    };
    const stop = () => setInput({ x: 0, z: 0 });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', stop);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', stop); };
  }, [closePanel, isOverlay, nearId, openPanel, panel]);

  const selectMapLocation = (entry: typeof LOCATIONS[number]) => {
    setFocusId(entry.id);
    setTarget({ x: entry.position[0], z: entry.position[1] });
    closePanel();
  };

  const beginLocation = () => {
    if (!location) return;
    updateProgress(visitLocation(progress, location.id));
    openPanel('learn');
  };

  const answerLesson = (answer: number) => {
    if (!location) return;
    const completion = completeLesson(progress, location.id, answer);
    updateProgress(completion.progress);
    setResult(completion.message);
    if (completion.correct) window.setTimeout(() => { setResult(null); setPanel(null); }, 1200);
  };

  const answerHangout = (answer: number) => {
    if (!location) return;
    const completion = completeHangout(progress, location.id, companion, answer);
    updateProgress(completion.progress);
    setResult(completion.message);
  };

  const answerMission = (answer: number) => {
    const completion = completeMission(progress, answer);
    updateProgress(completion.progress);
    setResult(completion.message);
  };

  const currentCompanion = COMPANIONS.find((entry) => entry.id === companion) ?? COMPANIONS[0];
  const learnedHere = !!location && progress.learned.includes(location.id);
  const canHangout = learnedHere;

  return (
    <main className={styles.adventure} data-testid="seoul-adventure">
      {!worldError && <WorldErrorBoundary onError={(message) => { setWorldError(message); setPanel('fallback'); }}><SeoulWorld
        locations={LOCATIONS.map(({ id, name, korean, position, color }) => ({ id, name, korean, position, color }))}
        target={target}
        input={isOverlay ? { x: 0, z: 0 } : input}
        paused={isOverlay}
        conversation={panel === 'hangout'}
        focusId={focusId}
        companion={companion}
        onNear={(id) => setNearId(id as LocationId | null)}
        onPosition={() => undefined}
        onReady={() => setWorldReady(true)}
        onError={(message) => { setWorldError(message); setPanel('fallback'); }}
      /></WorldErrorBoundary>}

      {!worldError && <div className={styles.vignette} aria-hidden="true" />}

      {panel !== 'hangout' && <>
        <header className={styles.topbar} aria-label="Seoul adventure status">
          <div className={styles.brand}><span>TONG</span><small>서울 · {worldReady ? 'Golden hour' : 'Arriving'}</small></div>
          <div className={styles.objective}><span>Next</span><strong>{objective}</strong></div>
          <div className={styles.topActions}>
            <button type="button" onClick={(e) => openPanel('journal', e.currentTarget)} aria-label="Open journal">Journal</button>
            <button type="button" onClick={(e) => openPanel('journal', e.currentTarget)} aria-label="Open Seoul map">Map</button>
          </div>
        </header>

        <div className={styles.companionSwitch} aria-label="Choose companion">
          {COMPANIONS.map((entry) => <button key={entry.id} type="button" className={entry.id === companion ? styles.activeCompanion : ''} onClick={() => setCompanion(entry.id)} aria-pressed={entry.id === companion}>
            <span className={styles.companionDot} style={{ background: entry.color }} /> {entry.name}
          </button>)}
        </div>

        <aside className={styles.controls} aria-label="Movement controls">
          <div className={styles.dpad}>
            {(['↑', '←', '↓', '→'] as const).map((arrow) => <button key={arrow} type="button" aria-label={`Walk ${arrow === '↑' ? 'forward' : arrow === '↓' ? 'backward' : arrow === '←' ? 'left' : 'right'}`} onPointerDown={() => setInput(arrow === '↑' ? { x: 0, z: -1 } : arrow === '↓' ? { x: 0, z: 1 } : arrow === '←' ? { x: -1, z: 0 } : { x: 1, z: 0 })} onPointerUp={() => setInput({ x: 0, z: 0 })}>{arrow}</button>)}
          </div>
          <span>WASD to wander</span>
        </aside>

        <nav className={styles.minimap} aria-label="Seoul locations">
          <span className={styles.mapLabel}>Seoul</span>
          {LOCATIONS.map((entry, index) => <button key={entry.id} type="button" title={`Walk to ${entry.name}`} aria-label={`Walk to ${entry.name}`} className={styles.mapPin} style={{ left: `${16 + ((index * 23) % 70)}%`, top: `${18 + ((index * 31) % 68)}%`, background: entry.color }} onClick={() => selectMapLocation(entry)} />)}
          <i className={styles.youAreHere} aria-label="Your position" />
        </nav>

        <div className={styles.poiAction}>
          {nearId && location ? <button type="button" data-testid="nearby-poi" onClick={(e) => { setFocusId(nearId); openPanel('poi', e.currentTarget); }}><span>Nearby</span><strong>{location.name}</strong><kbd>E</kbd></button> : <span>Take the long way. Seoul is listening.</span>}
        </div>
        {saveNote && <p className={styles.saveNote} role="status">{saveNote}</p>}
      </>}

      {panel === 'welcome' && <section className={styles.welcome} role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <p className={styles.kicker}>TONG / 서울</p><h1 id="welcome-title">Seoul, at your<br />own pace.</h1><p>Meet a phrase. Take a walk. Let a small conversation become a memory.</p>
        <button autoFocus type="button" data-testid="enter-seoul" onClick={closePanel}>Start walking <span>→</span></button>
      </section>}

      {panel === 'poi' && location && <section className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="poi-title">
        <button className={styles.close} onClick={closePanel} aria-label="Close location options">×</button><p className={styles.kicker}>{location.korean}</p><h2 id="poi-title">{location.name}</h2><p>{location.description}</p><small>{location.objective}</small>
        <div className={styles.modeActions}><button type="button" data-testid="start-learn" onClick={beginLocation}>Learn <span>→</span></button><button type="button" disabled={!canHangout} data-testid="start-hangout" onClick={() => openPanel('hangout')}>Hang out {!canHangout && <em>Learn first</em>}</button></div>
      </section>}

      {panel === 'learn' && location && <LessonSheet title={`${location.name} · learn`} phrase={location.phrase} lesson={location.lesson} result={result} revealed={revealed} setRevealed={setRevealed} onAnswer={answerLesson} onStartNew={() => { setResult(null); setRevealed(false); }} onHistory={() => openPanel('journal')} onClose={closePanel} />}

      {panel === 'hangout' && location && <section className={styles.hangout} role="dialog" aria-modal="true" aria-labelledby="hangout-title">
        <div className={styles.dialogue}><p className={styles.kicker}>{currentCompanion.korean} / {location.korean}</p><h2 id="hangout-title">{currentCompanion.name}</h2><p className={styles.script}>{location.hangout[companion]}</p><p className={styles.tongHint}>Tong’s hint: answer with the phrase you met here.</p>
          {result ? <><p className={styles.result} role="status">{result}</p><button type="button" onClick={closePanel}>Back to the street</button></> : <ChoiceList lesson={location.hangoutReply} onAnswer={answerHangout} />}
        </div>
      </section>}

      {panel === 'journal' && <section className={`${styles.sheet} ${styles.journal}`} role="dialog" aria-modal="true" aria-labelledby="journal-title">
        <button className={styles.close} onClick={closePanel} aria-label="Close journal">×</button><p className={styles.kicker}>Your little Seoul book</p><h2 id="journal-title">Journal</h2><div className={styles.progressLine}><span>{progress.xp} XP</span><span>{progress.sp} SP</span><span>Haeun {progress.rp.haeun} RP</span><span>Jin {progress.rp.jin} RP</span></div>
        <h3>Places</h3>{LOCATIONS.map((entry) => <button type="button" className={styles.journalPlace} key={entry.id} onClick={() => selectMapLocation(entry)}><span style={{ background: entry.color }} /><b>{entry.name}</b><small>{progress.learned.includes(entry.id) ? 'phrase learned' : 'go for a walk'}</small></button>)}
        {missionReady(progress) && <button type="button" data-testid="open-mission" className={styles.missionButton} onClick={() => openPanel('mission')}>A message from Seoul awaits</button>}
        <h3>Previous sessions</h3><p className={styles.history}>{progress.history.length ? `${progress.history.length} moments saved in this story.` : 'Your first small moment is waiting outside.'}</p>
      </section>}

      {panel === 'mission' && <LessonSheet title="Seoul after dark" phrase={{ ko: '오늘 즐거웠어요', romanization: 'oneul jeulgeowosseoyo', en: 'I had fun today.' }} lesson={MISSION} result={result} revealed={revealed} setRevealed={setRevealed} onAnswer={answerMission} onStartNew={() => { setResult(null); setRevealed(false); }} onHistory={() => openPanel('journal')} onClose={closePanel} />}

      {panel === 'fallback' && <section className={styles.fallback} role="dialog" aria-modal="true" aria-labelledby="fallback-title"><p className={styles.kicker}>TONG / 서울</p><h1 id="fallback-title">3D view unavailable</h1><p>{worldError ?? 'The neighborhood needs a moment.'} You can still take your Seoul walk.</p><div>{LOCATIONS.map((entry) => <button key={entry.id} type="button" onClick={() => { setFocusId(entry.id); setPanel('poi'); }}>{entry.name}<small>{entry.korean}</small></button>)}</div></section>}
    </main>
  );
}

function ChoiceList({ lesson, onAnswer }: { lesson: { choices: Phrase[]; prompt: string }; onAnswer: (choice: number) => void }) {
  return <div className={styles.choices}>{lesson.choices.map((choice, index) => <button type="button" key={`${choice.ko}-${index}`} onClick={() => onAnswer(index)}><strong>{choice.ko}</strong><span>{phraseText(choice)}</span></button>)}</div>;
}

function LessonSheet({ title, phrase, lesson, result, revealed, setRevealed, onAnswer, onStartNew, onHistory, onClose }: { title: string; phrase: Phrase; lesson: { prompt: string; choices: Phrase[]; explanation: string }; result: string | null; revealed: boolean; setRevealed: (revealed: boolean) => void; onAnswer: (answer: number) => void; onStartNew: () => void; onHistory: () => void; onClose: () => void }) {
  return <section className={`${styles.sheet} ${styles.learnSheet}`} role="dialog" aria-modal="true" aria-labelledby="lesson-title"><button className={styles.close} onClick={onClose} aria-label="Close lesson">×</button><p className={styles.kicker}>Kakao lesson</p><h2 id="lesson-title">{title}</h2><div className={styles.chat}><p>What would you say?</p><button type="button" className={styles.phraseBubble} onClick={() => setRevealed(!revealed)} aria-expanded={revealed}><strong>{phrase.ko}</strong><span>{revealed ? phraseText(phrase) : 'Tap to reveal pronunciation'}</span></button></div><p className={styles.prompt}>{lesson.prompt}</p>{result ? <p className={styles.result} role="status">{result}</p> : <ChoiceList lesson={lesson} onAnswer={onAnswer} />}<p className={styles.explanation}>{lesson.explanation}</p><div className={styles.sessionLinks}><button type="button" onClick={onStartNew}>Start new session</button><button type="button" onClick={onHistory}>View previous sessions</button></div></section>;
}
