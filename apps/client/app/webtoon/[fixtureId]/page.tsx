'use client';

import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useMemo, useState } from 'react';
import { getWebtoonFixture } from '@/lib/content/shanghai/fixtures';
import { WebtoonStrip, type WebtoonTheme } from '@/components/scene/WebtoonStrip';
import { WebtoonPurchaseSheet } from '@/components/scene/WebtoonPurchaseSheet';
import { useWebtoonUnlocks } from '@/lib/hooks/useWebtoonUnlocks';

function WebtoonInspectContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const raw = Array.isArray(params.fixtureId) ? params.fixtureId[0] : params.fixtureId;
  const fixtureId = useMemo(() => (raw ? decodeURIComponent(raw) : ''), [raw]);
  const entry = useMemo(() => getWebtoonFixture(fixtureId), [fixtureId]);
  const [theme, setTheme] = useState<WebtoonTheme>('warm');
  const [showHelp, setShowHelp] = useState(false);
  const {
    entitlement,
    pendingUnlock,
    autoOpenBubbleId,
    spBalance,
    requestUnlock,
    closePurchaseSheet,
    spendSp,
    activateGamePass,
  } = useWebtoonUnlocks(fixtureId || 'webtoon', searchParams);

  if (!entry) {
    return (
      <main style={{ padding: 24, minHeight: '100dvh', background: '#0d0d1a', color: '#fff8ee' }}>
        <p>Unknown fixture: <code>{fixtureId}</code></p>
        <Link href="/webtoon" style={{ color: '#f4d2ac' }}>← Back to gallery</Link>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100dvh', background: theme === 'dark' ? '#0b0b10' : '#ffffff' }}>
      <WebtoonStrip
        sceneId={fixtureId}
        panels={entry.spec.panels}
        theme={theme}
        showHelp={showHelp}
        scrollRoot="page"
        entitlement={entitlement}
        autoOpenBubbleKey={autoOpenBubbleId}
        onUnlockRequest={requestUnlock}
      />
      <WebtoonPurchaseSheet
        request={pendingUnlock}
        spBalance={spBalance}
        onClose={closePurchaseSheet}
        onSpendSp={spendSp}
        onActivateGamePass={activateGamePass}
      />

      {/* Top chrome: back + theme toggle */}
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
          href="/webtoon"
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
          ← Gallery
        </Link>

        <div
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
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

          <div
            role="group"
            aria-label="Theme"
            style={{
              display: 'flex',
              background: 'rgba(13,13,26,0.75)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 18,
            overflow: 'hidden',
              fontSize: '0.78rem',
            }}
          >
            <button
              type="button"
              onClick={() => setTheme('warm')}
              style={{
                padding: '6px 12px',
                border: 'none',
                background: theme === 'warm' ? 'rgba(244,210,172,0.22)' : 'transparent',
                color: theme === 'warm' ? '#fff8ee' : 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              ☀ Warm
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              style={{
                padding: '6px 12px',
                border: 'none',
                background: theme === 'dark' ? 'rgba(244,210,172,0.22)' : 'transparent',
                color: theme === 'dark' ? '#fff8ee' : 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              ☾ Dark
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function WebtoonInspectPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: '100dvh', background: '#ffffff' }} />}>
      <WebtoonInspectContent />
    </Suspense>
  );
}
