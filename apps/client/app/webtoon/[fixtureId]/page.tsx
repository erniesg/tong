'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMemo } from 'react';
import { getWebtoonFixture } from '@/lib/content/shanghai/fixtures';
import { WebtoonStrip } from '@/components/scene/WebtoonStrip';

export default function WebtoonInspectPage() {
  const params = useParams();
  const raw = Array.isArray(params.fixtureId) ? params.fixtureId[0] : params.fixtureId;
  const fixtureId = useMemo(() => (raw ? decodeURIComponent(raw) : ''), [raw]);
  const entry = useMemo(() => getWebtoonFixture(fixtureId), [fixtureId]);

  if (!entry) {
    return (
      <main style={{ padding: 24, minHeight: '100dvh', background: '#0d0d1a', color: '#fff8ee' }}>
        <p>Unknown fixture: <code>{fixtureId}</code></p>
        <Link href="/webtoon" style={{ color: '#f4d2ac' }}>← Back to gallery</Link>
      </main>
    );
  }

  return (
    <main style={{ position: 'fixed', inset: 0, background: '#0d0d1a' }}>
      <WebtoonStrip panels={entry.spec.panels} />
      <div
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          zIndex: 50,
          background: 'rgba(13,13,26,0.82)',
          backdropFilter: 'blur(8px)',
          padding: '6px 12px',
          borderRadius: 18,
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <Link
          href="/webtoon"
          style={{
            color: '#f4d2ac',
            fontSize: '0.82rem',
            textDecoration: 'none',
          }}
        >
          ← Gallery
        </Link>
      </div>
    </main>
  );
}
