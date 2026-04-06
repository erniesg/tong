'use client';

import { useMemo, useState } from 'react';
import fixtures from '../../../../../packages/contracts/fixtures/learn.scripted-scenes.sample.json';
import type {
  GraphCityId,
  ScriptedMessagingScene,
  ScriptedMessagingTranslationMode,
} from '../../../../../packages/contracts';
import { ScriptedMessagingPlayer } from '@/components/learn/ScriptedMessagingPlayer';

import styles from './page.module.css';

type PlaybackControl = 'play' | 'pause' | 'restart' | 'jump_to_scene_start';

interface CaptureFixture {
  city: GraphCityId;
  sceneId: string;
  mode: ScriptedMessagingTranslationMode;
  autoplay: boolean;
  startAtMs: number;
}

interface MessagingCapturePageClientProps {
  searchParams: Record<string, string | undefined>;
}

const CITIES: GraphCityId[] = ['seoul', 'tokyo', 'shanghai'];

const MODES: ScriptedMessagingTranslationMode[] = [
  'primary_only',
  'primary_with_english',
  'primary_local_explanation_with_english',
];

const CAPTURE_FIXTURES: Record<string, CaptureFixture> = {
  seoul_intro: {
    city: 'seoul',
    sceneId: 'seoul-food-street-check-in',
    mode: 'primary_with_english',
    autoplay: true,
    startAtMs: 0,
  },
  tokyo_translation: {
    city: 'tokyo',
    sceneId: 'tokyo-cafe-time-check',
    mode: 'primary_with_english',
    autoplay: true,
    startAtMs: 0,
  },
  shanghai_hook: {
    city: 'shanghai',
    sceneId: 'shanghai-subway-plan',
    mode: 'primary_with_english',
    autoplay: false,
    startAtMs: 0,
  },
};

function cityName(city: GraphCityId) {
  if (city === 'tokyo') return 'Tokyo';
  if (city === 'shanghai') return 'Shanghai';
  return 'Seoul';
}

export function MessagingCapturePageClient({ searchParams }: MessagingCapturePageClientProps) {
  const allScenes = fixtures.scenes as ScriptedMessagingScene[];

  const fixtureId = searchParams.fixture ?? '';
  const fixtureConfig = CAPTURE_FIXTURES[fixtureId];

  const cityFromParams = (searchParams.city as GraphCityId | undefined) ?? fixtureConfig?.city ?? 'seoul';
  const safeCity = CITIES.includes(cityFromParams) ? cityFromParams : 'seoul';

  const [city, setCity] = useState<GraphCityId>(safeCity);

  const cityScenes = useMemo(
    () => allScenes.filter((scene) => scene.cityId === city),
    [allScenes, city],
  );

  const initialSceneId = searchParams.sceneId ?? fixtureConfig?.sceneId ?? cityScenes[0]?.sceneId ?? '';
  const [sceneId, setSceneId] = useState(initialSceneId);

  const initialMode = (searchParams.mode as ScriptedMessagingTranslationMode | undefined) ?? fixtureConfig?.mode ?? 'primary_with_english';
  const [mode, setMode] = useState<ScriptedMessagingTranslationMode>(MODES.includes(initialMode) ? initialMode : 'primary_with_english');

  const autoplay = searchParams.autoplay === '1' || fixtureConfig?.autoplay === true;
  const startAtMsParam = Number(searchParams.startAtMs ?? fixtureConfig?.startAtMs ?? 0);
  const startAtMs = Number.isFinite(startAtMsParam) && startAtMsParam >= 0 ? startAtMsParam : 0;

  const scene = useMemo(
    () => cityScenes.find((item) => item.sceneId === sceneId) ?? cityScenes[0] ?? allScenes[0],
    [allScenes, cityScenes, sceneId],
  );

  const [controlSignal, setControlSignal] = useState<{ id: number; action: PlaybackControl } | undefined>(
    autoplay ? { id: 1, action: 'play' } : undefined,
  );
  const [playerState, setPlayerState] = useState('idle');
  const [elapsedMs, setElapsedMs] = useState(startAtMs);

  const sceneStartMs = scene?.rows[0]?.atMs ?? 0;
  const showHookOverlay = Boolean(scene?.hookText) && elapsedMs <= sceneStartMs + 900;

  function sendControl(action: PlaybackControl) {
    setControlSignal({ id: Date.now(), action });
  }

  const exampleRoute = '/mock/messaging-capture?fixture=tokyo_translation&autoplay=1&mode=primary_with_english&startAtMs=0';

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Mock Messaging Capture Route</h1>
        <p className={styles.subtitle}>
          Deterministic 9:16 playback for scripted messaging scenes (Issue #125) using the shared scene/player from #124.
        </p>
      </header>

      <section className={styles.controls}>
        <label>
          City
          <select value={city} onChange={(event) => setCity(event.target.value as GraphCityId)}>
            {CITIES.map((value) => (
              <option key={value} value={value}>{cityName(value)}</option>
            ))}
          </select>
        </label>

        <label>
          Scene
          <select value={scene?.sceneId} onChange={(event) => setSceneId(event.target.value)}>
            {cityScenes.map((value) => (
              <option key={value.sceneId} value={value.sceneId}>{value.sceneId}</option>
            ))}
          </select>
        </label>

        <label>
          Translation
          <select value={mode} onChange={(event) => setMode(event.target.value as ScriptedMessagingTranslationMode)}>
            {MODES.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
      </section>

      <section className={styles.playback}>
        <button type="button" onClick={() => sendControl('play')}>Play</button>
        <button type="button" onClick={() => sendControl('pause')}>Pause</button>
        <button type="button" onClick={() => sendControl('restart')}>Restart</button>
        <button type="button" onClick={() => sendControl('jump_to_scene_start')}>Jump to scene start</button>
        <p className={styles.status}>State: <b>{playerState}</b> · Elapsed: <b>{elapsedMs}ms</b></p>
      </section>

      <section className={styles.viewportWrap}>
        <div className={styles.viewport}>
          {showHookOverlay && scene?.hookText && (
            <aside className={styles.hookOverlay}>
              <p className={styles.hookLabel}>Scene hook</p>
              <p className={styles.hookText}>{scene.hookText}</p>
            </aside>
          )}

          <ScriptedMessagingPlayer
            scene={scene}
            translationMode={mode}
            tickMs={100}
            initialElapsedMs={startAtMs}
            initialState={autoplay ? 'playing' : 'idle'}
            hideDefaultControls
            sceneStartMs={sceneStartMs}
            controlSignal={controlSignal}
            onStateChange={setPlayerState}
            onElapsedChange={setElapsedMs}
          />
        </div>
      </section>

      <section className={styles.notes}>
        <h2>Capture entry points</h2>
        <ul>
          <li><code>fixture</code>: <code>seoul_intro</code>, <code>tokyo_translation</code>, <code>shanghai_hook</code></li>
          <li><code>city</code>: <code>seoul</code> | <code>tokyo</code> | <code>shanghai</code></li>
          <li><code>sceneId</code>: one of the fixture scene ids from <code>learn.scripted-scenes.sample.json</code></li>
          <li><code>mode</code>: translation mode enum used by the shared player</li>
          <li><code>autoplay=1</code> and <code>startAtMs</code> (number) for stable restarts</li>
        </ul>
        <p>Example: <code>{exampleRoute}</code></p>
      </section>
    </main>
  );
}
