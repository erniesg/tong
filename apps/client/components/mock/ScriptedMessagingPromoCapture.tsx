'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  GraphCityId,
  ScriptedMessagingPlayerState,
  ScriptedMessagingTranslationMode,
} from '../../../../packages/contracts';
import {
  buildPromoQuery,
  PROMO_CITY_ORDER,
  PROMO_MODE_ORDER,
  PROMO_ROUTE_FIXTURES,
  resolvePromoScene,
} from '@/lib/mock/scriptedMessagingPromo';
import { ScriptedMessagingPlayer, type ScriptedMessagingPlayerHandle } from '@/components/learn/ScriptedMessagingPlayer';

interface ScriptedMessagingPromoCaptureProps {
  initialSearchParams: Record<string, string | string[] | undefined>;
}

function normalizeParams(input: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') params.set(key, value);
  }
  return params;
}

export function ScriptedMessagingPromoCapture({ initialSearchParams }: ScriptedMessagingPromoCaptureProps) {
  const router = useRouter();
  const playerRef = useRef<ScriptedMessagingPlayerHandle>(null);
  const [playerState, setPlayerState] = useState<ScriptedMessagingPlayerState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [params, setParams] = useState(() => normalizeParams(initialSearchParams));

  const resolved = useMemo(() => resolvePromoScene(params), [params]);

  useEffect(() => {
    if (resolved.autoplay) {
      playerRef.current?.restart();
    } else {
      playerRef.current?.jumpToSceneStart();
    }
  }, [resolved.autoplay, resolved.selectedScene.sceneId, resolved.mode, resolved.tickMs]);

  const navigate = (next: {
    city: GraphCityId;
    mode: ScriptedMessagingTranslationMode;
    scene: string;
    autoplay?: boolean;
  }) => {
    const query = buildPromoQuery({ ...next, hook: resolved.hookMode, tickMs: resolved.tickMs });
    setParams(new URLSearchParams(query));
    router.replace(`/mock/messaging-promo?${query}`);
  };

  return (
    <main style={{ padding: 16, display: 'grid', gap: 12 }}>
      <header style={{ display: 'grid', gap: 6 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Mock Messaging Promo Capture</h1>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
          Deterministic 9:16 route for scripted messaging capture. Keep autoplay and tickMs fixed for repeatable recordings.
        </p>
      </header>

      <section className="card" style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PROMO_CITY_ORDER.map((city) => (
            <button
              key={city}
              type="button"
              className={`tg-chip ${resolved.city === city ? 'active' : ''}`}
              onClick={() => navigate({ city, mode: resolved.mode, scene: resolved.scenesForCity[0]?.sceneId ?? resolved.selectedScene.sceneId, autoplay: resolved.autoplay })}
            >
              {city}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {resolved.scenesForCity.map((scene) => (
            <button
              key={scene.sceneId}
              type="button"
              className={`tg-chip ${resolved.selectedScene.sceneId === scene.sceneId ? 'active' : ''}`}
              onClick={() => navigate({ city: resolved.city, mode: resolved.mode, scene: scene.sceneId, autoplay: resolved.autoplay })}
            >
              {scene.title}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PROMO_MODE_ORDER.map((mode) => (
            <button
              key={mode}
              type="button"
              className={`tg-chip ${resolved.mode === mode ? 'active' : ''}`}
              onClick={() => navigate({ city: resolved.city, mode, scene: resolved.selectedScene.sceneId, autoplay: resolved.autoplay })}
            >
              {mode}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12, color: 'var(--muted)', display: 'grid', gap: 4 }}>
          <span>
            <strong>Recording presets:</strong>{' '}
            {Object.entries(PROMO_ROUTE_FIXTURES).map(([fixtureKey, fixture]) => {
              const href = `/mock/messaging-promo?${new URLSearchParams(fixture).toString()}`;
              return (
                <a key={fixtureKey} href={href} style={{ marginRight: 10, textDecoration: 'underline' }}>
                  {fixtureKey.replace(/_/g, " ")}
                </a>
              );
            })}
          </span>
          <span>
            State: {playerState} · t={elapsedMs}ms · tickMs={resolved.tickMs}
          </span>
        </div>
      </section>

      <section
        style={{
          margin: '0 auto',
          width: 'min(100%, 380px)',
          aspectRatio: '9 / 16',
          borderRadius: 24,
          overflow: 'hidden',
          border: '1px solid rgba(30,41,59,0.16)',
          boxShadow: '0 14px 28px rgba(15, 23, 42, 0.24)',
          background: '#0f172a',
        }}
      >
        <ScriptedMessagingPlayer
          ref={playerRef}
          scene={resolved.selectedScene}
          translationMode={resolved.mode}
          tickMs={resolved.tickMs}
          showHookOverlay={resolved.showHookOverlay}
          showControls={false}
          showSceneMeta={false}
          onStateChange={setPlayerState}
          onElapsedChange={setElapsedMs}
        />
      </section>

      <section className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className="tg-chip" onClick={() => playerRef.current?.play()}>Play</button>
        <button type="button" className="tg-chip" onClick={() => playerRef.current?.pause()}>Pause</button>
        <button type="button" className="tg-chip" onClick={() => playerRef.current?.restart()}>Restart</button>
        <button type="button" className="tg-chip" onClick={() => playerRef.current?.jumpToSceneStart()}>Jump to scene start</button>
      </section>
    </main>
  );
}
