"use client";

import dynamic from "next/dynamic";
import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./SeoulAdventure.module.css";
import { COMPANIONS, LOCATIONS, MISSION } from "@/lib/seoul-adventure/content";
import {
  completeHangout,
  completeLesson,
  completeMission,
  missionReady,
  newProgress,
  nextObjective,
  restoreProgress,
  visitLocation,
} from "@/lib/seoul-adventure/progress";
import type {
  CompanionId,
  LocationId,
  Phrase,
  Progress,
} from "@/lib/seoul-adventure/types";

const SAVE_KEY = "tong.seoul-adventure.v1";
const MAP_BOUNDS = { minX: -18, maxX: 18, minZ: -22, maxZ: 18 };

type WorldProps = {
  locations: {
    id: string;
    name: string;
    korean: string;
    position: [number, number];
    color: string;
  }[];
  target: { x: number; z: number } | null;
  input: { x: number; z: number };
  paused: boolean;
  conversation: boolean;
  focusId: string | null;
  companion: "haeun" | "jin";
  onNear: (id: string | null) => void;
  onPosition: (p: { x: number; z: number }) => void;
  onReady: () => void;
  onError: (message: string) => void;
};

const SeoulWorld = dynamic<WorldProps>(() => import("./SeoulWorld"), {
  ssr: false,
  loading: () => (
    <div className={styles.worldLoading}>
      <span>Opening the streets of Seoul…</span>
    </div>
  ),
});

type Panel =
  | "welcome"
  | "poi"
  | "learn"
  | "hangout"
  | "journal"
  | "map"
  | "mission"
  | "fallback"
  | null;

class WorldErrorBoundary extends Component<
  { children: ReactNode; onError: (message: string) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error.message || "The 3D neighborhood could not start.");
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function phraseText(phrase: Phrase) {
  return `${phrase.romanization} · ${phrase.en}`;
}
function mapPercent(position: [number, number] | { x: number; z: number }) {
  const x = Array.isArray(position) ? position[0] : position.x;
  const z = Array.isArray(position) ? position[1] : position.z;
  return {
    left: `${((x - MAP_BOUNDS.minX) / (MAP_BOUNDS.maxX - MAP_BOUNDS.minX)) * 100}%`,
    top: `${((z - MAP_BOUNDS.minZ) / (MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ)) * 100}%`,
  };
}

function Dialog({
  children,
  className = "",
  onClose,
  label,
}: {
  children: ReactNode;
  className?: string;
  onClose?: () => void;
  label: string;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const first = dialogRef.current?.querySelector<HTMLElement>(
      "button:not([disabled]), [href], input:not([disabled])",
    );
    first?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onClose) {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab") return;
      const focusable = [
        ...(dialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), [href], input:not([disabled])",
        ) ?? []),
      ];
      if (!focusable.length) return;
      const index = focusable.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && index <= 0) {
        event.preventDefault();
        focusable.at(-1)?.focus();
      }
      if (!event.shiftKey && index === focusable.length - 1) {
        event.preventDefault();
        focusable[0].focus();
      }
    };
    window.addEventListener("keydown", trap);
    return () => window.removeEventListener("keydown", trap);
  }, [onClose]);
  return (
    <section
      ref={dialogRef}
      className={className}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      {children}
    </section>
  );
}

export default function SeoulAdventure() {
  const [panel, setPanel] = useState<Panel>("welcome");
  const [progress, setProgress] = useState<Progress>(() => newProgress());
  const [nearId, setNearId] = useState<LocationId | null>(null);
  const [focusId, setFocusId] = useState<LocationId | null>(null);
  const [target, setTarget] = useState<{ x: number; z: number } | null>(null);
  const [input, setInput] = useState({ x: 0, z: 0 });
  const [playerPosition, setPlayerPosition] = useState({ x: 0, z: 8 });
  const [companion, setCompanion] = useState<CompanionId>("haeun");
  const [worldReady, setWorldReady] = useState(false);
  const [worldError, setWorldError] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [hangoutTranslation, setHangoutTranslation] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [resultCorrect, setResultCorrect] = useState(false);
  const lastFocus = useRef<HTMLElement | null>(null);

  const location = useMemo(
    () => LOCATIONS.find((entry) => entry.id === focusId) ?? null,
    [focusId],
  );
  const nearLocation = useMemo(
    () => LOCATIONS.find((entry) => entry.id === nearId) ?? null,
    [nearId],
  );
  const isOverlay = panel !== null;
  const objective = nextObjective(progress);

  useEffect(() => {
    try {
      setProgress(restoreProgress(window.localStorage.getItem(SAVE_KEY)));
    } catch {
      setSaveNote("Progress will stay in this visit — saving is unavailable.");
    }
  }, []);

  const updateProgress = useCallback((next: Progress) => {
    setProgress(next);
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(next));
    } catch {
      setSaveNote("Progress will stay in this visit — saving is unavailable.");
    }
  }, []);
  const recordVisit = useCallback(
    (id: LocationId) => {
      updateProgress(visitLocation(progress, id));
    },
    [progress, updateProgress],
  );

  const openPanel = useCallback((next: Panel, element?: HTMLElement | null) => {
    if (element) lastFocus.current = element;
    setResult(null);
    setResultCorrect(false);
    setRevealed(false);
    setHangoutTranslation(false);
    setPanel(next);
  }, []);
  const closePanel = useCallback(() => {
    setInput({ x: 0, z: 0 });
    setPanel(worldError ? "fallback" : null);
    requestAnimationFrame(() => lastFocus.current?.focus());
  }, [worldError]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isOverlay && event.key.toLowerCase() === "e" && nearLocation) {
        event.preventDefault();
        recordVisit(nearLocation.id);
        setFocusId(nearLocation.id);
        openPanel("poi", document.activeElement as HTMLElement);
      }
    };
    const release = () => setInput({ x: 0, z: 0 });
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", release);
    };
  }, [isOverlay, nearLocation, openPanel]);

  const selectMapLocation = (entry: (typeof LOCATIONS)[number]) => {
    setFocusId(entry.id);
    if (worldError) {
      openPanel("poi");
      return;
    }
    setTarget({ x: entry.position[0], z: entry.position[1] });
    closePanel();
  };
  const setTouchInput = (
    value: { x: number; z: number },
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    setTarget(null);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setInput(value);
  };
  const releaseTouchInput = () => setInput({ x: 0, z: 0 });
  const beginLocation = () => {
    if (!location) return;
    recordVisit(location.id);
    openPanel("learn");
  };
  const answerLesson = (answer: number) => {
    if (!location) return;
    const completion = completeLesson(progress, location.id, answer);
    updateProgress(completion.progress);
    setResult(completion.message);
    setResultCorrect(completion.correct);
  };
  const answerHangout = (answer: number) => {
    if (!location) return;
    const completion = completeHangout(
      progress,
      location.id,
      companion,
      answer,
    );
    updateProgress(completion.progress);
    setResult(completion.message);
    setResultCorrect(completion.correct);
  };
  const answerMission = (answer: number) => {
    const completion = completeMission(progress, answer);
    updateProgress(completion.progress);
    setResult(completion.message);
    setResultCorrect(completion.correct);
  };

  const currentCompanion =
    COMPANIONS.find((entry) => entry.id === companion) ?? COMPANIONS[0];
  const learnedHere = !!location && progress.learned.includes(location.id);
  const memories = progress.memories ?? [];

  return (
    <main className={styles.adventure} data-testid="seoul-adventure">
      {!worldError && (
        <WorldErrorBoundary
          onError={(message) => {
            setWorldError(message);
            setPanel("fallback");
          }}
        >
          <SeoulWorld
            locations={LOCATIONS.map(
              ({ id, name, korean, position, color }) => ({
                id,
                name,
                korean,
                position,
                color,
              }),
            )}
            target={target}
            input={isOverlay ? { x: 0, z: 0 } : input}
            paused={isOverlay}
            conversation={panel === "hangout"}
            focusId={focusId}
            companion={companion}
            onNear={(id) => {
              setNearId(id as LocationId | null);
              if (id) recordVisit(id as LocationId);
            }}
            onPosition={setPlayerPosition}
            onReady={() => setWorldReady(true)}
            onError={(message) => {
              setWorldError(message);
              setPanel("fallback");
            }}
          />
        </WorldErrorBoundary>
      )}
      {!worldError && <div className={styles.vignette} aria-hidden="true" />}

      <div
        className={styles.hud}
        hidden={panel === "hangout"}
        ref={(node) => { if (node) node.inert = isOverlay; }}
        aria-hidden={isOverlay}
        data-blocked={isOverlay || undefined}
      >
        <header className={styles.topbar} aria-label="Seoul adventure status">
          <div className={styles.brand}>
            <span>TONG</span>
            <small>서울 · {worldReady ? "Golden hour" : "Arriving"}</small>
          </div>
          <div className={styles.objective}>
            <span>Next</span>
            <strong>{objective}</strong>
          </div>
          <div className={styles.topActions}>
            <button
              type="button"
              aria-label="Open journal"
              onClick={(e) => openPanel("journal", e.currentTarget)}
            >
              Journal
            </button>
            <button
              type="button"
              aria-label="Open Seoul map"
              onClick={(e) => openPanel("map", e.currentTarget)}
            >
              Map
            </button>
          </div>
        </header>
        <div className={styles.companionSwitch} aria-label="Choose companion">
          {COMPANIONS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={entry.id === companion ? styles.activeCompanion : ""}
              onClick={() => setCompanion(entry.id)}
              aria-pressed={entry.id === companion}
            >
              <span
                className={styles.companionDot}
                style={{ background: entry.color }}
              />{" "}
              {entry.name}
            </button>
          ))}
        </div>
        <aside className={styles.controls} aria-label="Movement controls">
          <div className={styles.dpad}>
            {[
              { label: "forward", mark: "↑", input: { x: 0, z: -1 } },
              { label: "left", mark: "←", input: { x: -1, z: 0 } },
              { label: "backward", mark: "↓", input: { x: 0, z: 1 } },
              { label: "right", mark: "→", input: { x: 1, z: 0 } },
            ].map((direction) => (
              <button
                key={direction.label}
                type="button"
                aria-label={`Walk ${direction.label}`}
                onPointerDown={(event) => setTouchInput(direction.input, event)}
                onPointerUp={releaseTouchInput}
                onPointerCancel={releaseTouchInput}
                onLostPointerCapture={releaseTouchInput}
              >
                {direction.mark}
              </button>
            ))}
          </div>
          <span>WASD to wander</span>
        </aside>
        <nav className={styles.minimap} aria-label="Seoul locations">
          <span className={styles.mapLabel}>Seoul</span>
          {LOCATIONS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              title={`Walk to ${entry.name}`}
              aria-label={`Walk to ${entry.name}`}
              className={styles.mapPin}
              style={{ ...mapPercent(entry.position), background: entry.color }}
              onClick={() => selectMapLocation(entry)}
            />
          ))}
          <i
            className={styles.youAreHere}
            style={mapPercent(playerPosition)}
            aria-label="Your live position"
          />
        </nav>
        <div className={styles.poiAction}>
          {nearLocation ? (
            <button
              type="button"
              data-testid="nearby-poi"
              onClick={(e) => {
                recordVisit(nearLocation.id);
                setFocusId(nearLocation.id);
                openPanel("poi", e.currentTarget);
              }}
            >
              <span>Nearby</span>
              <strong>{nearLocation.name}</strong>
              <kbd>E</kbd>
            </button>
          ) : (
            <span>Take the long way. Seoul is listening.</span>
          )}
        </div>
        {saveNote && (
          <p className={styles.saveNote} role="status">
            {saveNote}
          </p>
        )}
      </div>

      {panel === "welcome" && (
        <Dialog
          className={styles.welcome}
          label="Welcome to Seoul"
          onClose={closePanel}
        >
          <p className={styles.kicker}>TONG / 서울</p>
          <h1>
            Seoul, at your
            <br />
            own pace.
          </h1>
          <p>
            Meet a phrase. Take a walk. Let a small conversation become a
            memory.
          </p>
          <button type="button" data-testid="enter-seoul" onClick={closePanel}>
            Start walking <span>→</span>
          </button>
        </Dialog>
      )}
      {panel === "poi" && location && (
        <LocationDialog
          location={location}
          learned={learnedHere}
          onLearn={beginLocation}
          onHangout={() => openPanel("hangout")}
          onClose={closePanel}
        />
      )}
      {panel === "learn" && location && (
        <LessonSheet
          title={`${location.name} · learn`}
          phrase={location.phrase}
          lesson={location.lesson}
          result={result}
          correct={resultCorrect}
          revealed={revealed}
          onReveal={setRevealed}
          onAnswer={answerLesson}
          onStartNew={() => {
            setResult(null);
            setResultCorrect(false);
            setRevealed(false);
          }}
          onContinue={() => openPanel("poi")}
          onHistory={() => openPanel("journal")}
          onClose={closePanel}
        />
      )}
      {panel === "hangout" && location && (
        <HangoutDialog
          companion={currentCompanion}
          location={location}
          result={result}
          correct={resultCorrect}
          translationVisible={hangoutTranslation}
          onTranslation={() => setHangoutTranslation(!hangoutTranslation)}
          onAnswer={answerHangout}
          onClose={closePanel}
        />
      )}
      {panel === "map" && (
        <MapDialog
          position={playerPosition}
          onSelect={selectMapLocation}
          onClose={closePanel}
        />
      )}
      {panel === "journal" && (
        <JournalDialog
          progress={progress}
          memories={memories}
          onMap={() => openPanel("map")}
          onMission={() => openPanel("mission")}
          onClose={closePanel}
        />
      )}
      {panel === "mission" && (
        <LessonSheet
          title="Seoul after dark"
          phrase={{
            ko: "오늘 즐거웠어요",
            romanization: "oneul jeulgeowosseoyo",
            en: "I had fun today.",
          }}
          lesson={MISSION}
          result={result}
          correct={resultCorrect}
          revealed={revealed}
          onReveal={setRevealed}
          onAnswer={answerMission}
          onStartNew={() => {
            setResult(null);
            setResultCorrect(false);
            setRevealed(false);
          }}
          onContinue={() => openPanel("journal")}
          onHistory={() => openPanel("journal")}
          onClose={closePanel}
          memory={memories.at(-1)}
        />
      )}
      {panel === "fallback" && (
        <FallbackDialog
          error={worldError}
          onSelect={(entry) => {
            setFocusId(entry.id);
            openPanel("poi");
          }}
        />
      )}
    </main>
  );
}

function LocationDialog({
  location,
  learned,
  onLearn,
  onHangout,
  onClose,
}: {
  location: (typeof LOCATIONS)[number];
  learned: boolean;
  onLearn: () => void;
  onHangout: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      className={styles.sheet}
      label={`${location.name} options`}
      onClose={onClose}
    >
      <button
        className={styles.close}
        onClick={onClose}
        aria-label="Close location options"
      >
        ×
      </button>
      <p className={styles.kicker}>{location.korean}</p>
      <h2>{location.name}</h2>
      <p>{location.description}</p>
      <small>{location.objective}</small>
      <div className={styles.modeActions}>
        <button type="button" data-testid="start-learn" onClick={onLearn}>
          Learn <span>→</span>
        </button>
        <button
          type="button"
          disabled={!learned}
          data-testid="start-hangout"
          onClick={onHangout}
        >
          Hang out {!learned && <em>Learn first</em>}
        </button>
      </div>
    </Dialog>
  );
}

function ChoiceList({
  lesson,
  onAnswer,
}: {
  lesson: { choices: Phrase[] };
  onAnswer: (choice: number) => void;
}) {
  return (
    <div className={styles.choices}>
      {lesson.choices.map((choice, index) => (
        <button
          type="button"
          key={`${choice.ko}-${index}`}
          onClick={() => onAnswer(index)}
        >
          <strong>{choice.ko}</strong>
          <span>{phraseText(choice)}</span>
        </button>
      ))}
    </div>
  );
}

function LessonSheet({
  title,
  phrase,
  lesson,
  result,
  correct,
  revealed,
  onReveal,
  onAnswer,
  onStartNew,
  onContinue,
  onHistory,
  onClose,
  memory,
}: {
  title: string;
  phrase: Phrase;
  lesson: { prompt: string; choices: Phrase[]; explanation: string };
  result: string | null;
  correct: boolean;
  revealed: boolean;
  onReveal: (value: boolean) => void;
  onAnswer: (answer: number) => void;
  onStartNew: () => void;
  onContinue: () => void;
  onHistory: () => void;
  onClose: () => void;
  memory?: string;
}) {
  return (
    <Dialog
      className={`${styles.sheet} ${styles.learnSheet}`}
      label={title}
      onClose={onClose}
    >
      <button
        className={styles.close}
        onClick={onClose}
        aria-label="Close lesson"
      >
        ×
      </button>
      <p className={styles.kicker}>Tong · Korean practice</p>
      <h2>{title}</h2>
      <div className={styles.chat}>
        <p>What would you say?</p>
        <button
          type="button"
          className={styles.phraseBubble}
          onClick={() => onReveal(!revealed)}
          aria-expanded={revealed}
        >
          <strong>{phrase.ko}</strong>
          <span>
            {revealed ? phraseText(phrase) : "Tap to reveal pronunciation"}
          </span>
        </button>
      </div>
      <p className={styles.prompt}>{lesson.prompt}</p>
      {result && (
        <p className={styles.result} role="status">
          {result}
        </p>
      )}
      {(!result || !correct) && (
        <ChoiceList lesson={lesson} onAnswer={onAnswer} />
      )}
      {correct && (
        <button
          type="button"
          className={styles.continueButton}
          onClick={onContinue}
        >
          Continue your walk
        </button>
      )}
      {memory && <Polaroid memory={memory} />}
      <p className={styles.explanation}>{lesson.explanation}</p>
      <div className={styles.sessionLinks}>
        <button type="button" onClick={onStartNew}>
          Start new session
        </button>
        <button type="button" onClick={onHistory}>
          View previous sessions
        </button>
      </div>
    </Dialog>
  );
}

function HangoutDialog({
  companion,
  location,
  result,
  correct,
  translationVisible,
  onTranslation,
  onAnswer,
  onClose,
}: {
  companion: (typeof COMPANIONS)[number];
  location: (typeof LOCATIONS)[number];
  result: string | null;
  correct: boolean;
  translationVisible: boolean;
  onTranslation: () => void;
  onAnswer: (answer: number) => void;
  onClose: () => void;
}) {
  const translation = location.hangoutTranslation?.[companion.id];
  return (
    <Dialog
      className={styles.hangout}
      label={`${companion.name} at ${location.name}`}
      onClose={onClose}
    >
      <div className={styles.dialogue}>
        <p className={styles.kicker}>
          {companion.korean} / {location.korean}
        </p>
        <h2>{companion.name}</h2>
        <button
          type="button"
          className={styles.hangoutLine}
          onClick={onTranslation}
          aria-expanded={translationVisible}
        >
          <span>{location.hangout[companion.id]}</span>
          {translationVisible && translation && <small>{translation}</small>}
        </button>
        <p className={styles.tongHint}>
          Tong’s hint: answer with the phrase you met here.
        </p>
        {result && (
          <p className={styles.result} role="status">
            {result}
          </p>
        )}
        {(!result || !correct) && (
          <ChoiceList lesson={location.hangoutReply} onAnswer={onAnswer} />
        )}
        {correct && (
          <button type="button" onClick={onClose}>
            Back to the street
          </button>
        )}
      </div>
    </Dialog>
  );
}

function MapDialog({
  position,
  onSelect,
  onClose,
}: {
  position: { x: number; z: number };
  onSelect: (entry: (typeof LOCATIONS)[number]) => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      className={`${styles.sheet} ${styles.mapSheet}`}
      label="Seoul map"
      onClose={onClose}
    >
      <button
        className={styles.close}
        onClick={onClose}
        aria-label="Close Seoul map"
      >
        ×
      </button>
      <p className={styles.kicker}>Walkable Seoul</p>
      <h2>Choose a destination</h2>
      <div className={styles.largeMap}>
        {LOCATIONS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            style={{ ...mapPercent(entry.position), background: entry.color }}
            onClick={() => onSelect(entry)}
          >
            {entry.name}
          </button>
        ))}
        <i style={mapPercent(position)} aria-label="Your current position" />
      </div>
      <p className={styles.explanation}>
        Tap a place and Tong will set a gentle route through the neighborhood.
      </p>
    </Dialog>
  );
}

function JournalDialog({
  progress,
  memories,
  onMap,
  onMission,
  onClose,
}: {
  progress: Progress;
  memories: string[];
  onMap: () => void;
  onMission: () => void;
  onClose: () => void;
}) {
  const ready = missionReady(progress);
  return (
    <Dialog
      className={`${styles.sheet} ${styles.journal}`}
      label="Journal"
      onClose={onClose}
    >
      <button
        className={styles.close}
        onClick={onClose}
        aria-label="Close journal"
      >
        ×
      </button>
      <p className={styles.kicker}>Your little Seoul book</p>
      <h2>Journal</h2>
      <div className={styles.progressLine}>
        <span>{progress.xp} XP</span>
        <span>{progress.sp} SP</span>
        <span>Haeun {progress.rp.haeun} RP</span>
        <span>Jin {progress.rp.jin} RP</span>
      </div>
      <button type="button" className={styles.journalMap} onClick={onMap}>
        Open the Seoul map <span>→</span>
      </button>
      {ready && !progress.missionComplete && (
        <button
          type="button"
          data-testid="open-mission"
          className={styles.missionButton}
          onClick={onMission}
        >
          A message from Seoul awaits
        </button>
      )}
      {progress.missionComplete && (
        <p className={styles.tier}>
          Mastery tier unlocked · Seoul night walker
        </p>
      )}
      <h3>Previous sessions</h3>
      <ul className={styles.history}>
        {progress.history.length ? (
          progress.history
            .slice()
            .reverse()
            .map((entry) => (
              <li key={entry.id}>
                <b>
                  {LOCATIONS.find((place) => place.id === entry.location)
                    ?.name ?? entry.location}
                </b>
                <span>
                  {entry.mode} · {entry.success ? "completed" : "try again"} ·{" "}
                  {new Date(entry.at).toLocaleDateString()}
                </span>
              </li>
            ))
        ) : (
          <li>Your first small moment is waiting outside.</li>
        )}
      </ul>
      {memories.length > 0 && (
        <>
          <h3>Memories</h3>
          <div className={styles.memoryRow}>
            {memories.map((memory) => (
              <Polaroid key={memory} memory={memory} />
            ))}
          </div>
        </>
      )}
    </Dialog>
  );
}

function Polaroid({ memory }: { memory: string }) {
  return (
    <figure className={styles.polaroid}>
      <div aria-hidden="true">
        ✦<span>서울</span>
      </div>
      <figcaption>{memory === "seoul-first-evening" ? "Our first Seoul evening" : "A Seoul memory"}</figcaption>
    </figure>
  );
}
function FallbackDialog({
  error,
  onSelect,
}: {
  error: string | null;
  onSelect: (entry: (typeof LOCATIONS)[number]) => void;
}) {
  return (
    <Dialog className={styles.fallback} label="3D view unavailable">
      <p className={styles.kicker}>TONG / 서울</p>
      <h1>3D view unavailable</h1>
      <p>
        {error ?? "The neighborhood needs a moment."} Choose a place to keep
        wandering in 2D.
      </p>
      <div>
        {LOCATIONS.map((entry) => (
          <button key={entry.id} type="button" onClick={() => onSelect(entry)}>
            {entry.name}
            <small>{entry.korean}</small>
          </button>
        ))}
      </div>
    </Dialog>
  );
}
