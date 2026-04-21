'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import { getWebtoonFixture } from '@/lib/content/shanghai/fixtures';
import { WebtoonStrip, type WebtoonTheme, type WebtoonEntitlement } from '@/components/scene/WebtoonStrip';
import { dispatch, useGameState } from '@/lib/store/game-store';

const FIXTURE_ID = 'shanghai-h1';
const CITY_ID = 'shanghai';
const LOCATION_ID = 'dumpling_shop';
const AYI_ID = 'fangayi';

// Mastery items surfaced by the onboarding scene. Mirrors what the H1 fixture
// resolution spec would apply in the dynamic path — replicated here so the
// fixture-verbatim playtest still writes to the same game state.
const MASTERY_ITEMS: { id: string; category: 'vocabulary' | 'grammar'; item: string }[] = [
  { id: 'shanghai:vocab:方案', category: 'vocabulary', item: '方案' },
  { id: 'shanghai:vocab:愿意', category: 'vocabulary', item: '愿意' },
  { id: 'shanghai:vocab:装', category: 'vocabulary', item: '装' },
  { id: 'shanghai:vocab:不一样', category: 'vocabulary', item: '不一样' },
  { id: 'shanghai:vocab:小笼包', category: 'vocabulary', item: '小笼包' },
];

export default function ShanghaiOnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entry = useMemo(() => getWebtoonFixture(FIXTURE_ID), []);
  const gameState = useGameState();
  const completedRef = useRef(false);
  const [completed, setCompleted] = useState(false);
  const [theme, setTheme] = useState<WebtoonTheme>('warm');
  const [showHelp, setShowHelp] = useState(false);

  const entitlement: WebtoonEntitlement = useMemo(() => {
    const devBypass = searchParams.get('dev_pass') === '1';
    const gamePass = searchParams.get('game_pass') === '1' || gameState.gamePass?.active === true;
    const sp = Number(searchParams.get('sp')) || gameState.sp || 0;
    return { bypass: devBypass, gamePass, sp };
  }, [searchParams, gameState.gamePass?.active, gameState.sp]);

  const onComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setCompleted(true);

    // First-contact mastery for the key vocab surfaced in the scene.
    for (const m of MASTERY_ITEMS) {
      dispatch({ type: 'RECORD_ITEM_RESULT', itemId: m.id, category: m.category, correct: true });
    }
    // Affinity: 方阿姨 sees you listened. Leads (守成/丁漫) untouched — eavesdropping doesn't earn relationship points yet.
    dispatch({ type: 'UPDATE_AFFINITY', characterId: AYI_ID, delta: 3 });
    // Track that the player entered this hangout.
    dispatch({ type: 'INCREMENT_LOCATION_HANGOUT', cityId: CITY_ID, locationId: LOCATION_ID });
    // Small XP payout for completing onboarding.
    dispatch({ type: 'ADD_XP', amount: 40 });
  }, []);

  if (!entry) {
    return (
      <main style={{ padding: 24, minHeight: '100dvh', background: '#0d0d1a', color: '#fff8ee' }}>
        <p>
          Missing fixture <code>{FIXTURE_ID}</code>. Check
          <code> apps/client/lib/content/shanghai/fixtures/index.ts</code>.
        </p>
        <Link href="/webtoon" style={{ color: '#f4d2ac' }}>← Back to gallery</Link>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100dvh', background: theme === 'dark' ? '#0b0b10' : '#ffffff' }}>
      <WebtoonStrip
        panels={entry.spec.panels}
        theme={theme}
        showHelp={showHelp}
        scrollRoot="page"
        entitlement={entitlement}
        onComplete={onComplete}
      />

      <div
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          right: 12,
          zIndex: 50,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        <Link
          href="/game"
          style={{
            pointerEvents: 'auto',
            background: 'rgba(13,13,26,0.75)',
            backdropFilter: 'blur(10px)',
            color: '#f4d2ac',
            fontSize: '0.82rem',
            textDecoration: 'none',
            padding: '6px 14px',
            borderRadius: 18,
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          ← Leave
        </Link>

        <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto' }}>
          <button
            type="button"
            onClick={() => setShowHelp((prev) => !prev)}
            aria-pressed={showHelp}
            style={{
              background: 'rgba(13,13,26,0.75)',
              backdropFilter: 'blur(10px)',
              color: showHelp ? '#fff8ee' : '#f4d2ac',
              fontSize: '0.82rem',
              padding: '6px 12px',
              borderRadius: 18,
              border: '1px solid rgba(255,255,255,0.12)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            ? Help
          </button>
          <button
            type="button"
            onClick={() => setTheme((prev) => (prev === 'warm' ? 'dark' : 'warm'))}
            style={{
              background: 'rgba(13,13,26,0.75)',
              backdropFilter: 'blur(10px)',
              color: '#f4d2ac',
              fontSize: '0.82rem',
              padding: '6px 12px',
              borderRadius: 18,
              border: '1px solid rgba(255,255,255,0.12)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {theme === 'warm' ? '☾ Dark' : '☀ Warm'}
          </button>
        </div>
      </div>

      {completed ? (
        <div
          role="dialog"
          aria-label="Scene complete"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 28,
            transform: 'translateX(-50%)',
            zIndex: 60,
            background: 'rgba(13,13,26,0.92)',
            color: '#fff8ee',
            padding: '14px 18px',
            borderRadius: 16,
            border: '1px solid rgba(244,210,172,0.25)',
            fontSize: '0.9rem',
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            maxWidth: 'calc(100vw - 32px)',
          }}
        >
          <span style={{ color: '#f4d2ac' }}>Scene complete.</span>
          <span style={{ opacity: 0.75 }}>+40 XP · 方阿姨 +3 · 5 vocab first-contact.</span>
          <button
            type="button"
            onClick={() => router.push('/game')}
            style={{
              background: '#f4d2ac',
              color: '#0d0d1a',
              border: 'none',
              padding: '6px 12px',
              borderRadius: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Return to map
          </button>
        </div>
      ) : null}
    </main>
  );
}
