'use client';

import Link from 'next/link';
import { WEBTOON_FIXTURES } from '@/lib/content/shanghai/fixtures';

export default function WebtoonIndex() {
  return (
    <main style={{ padding: 32, minHeight: '100dvh', background: '#0d0d1a', color: '#fff8ee' }}>
      <h1 style={{ marginTop: 0, fontSize: '1.6rem' }}>Webtoon preview gallery</h1>
      <p style={{ color: 'rgba(255,255,255,0.55)' }}>Raw strips for art iteration. For the full onboarding hangout (completion dispatch, gating), open one of the playable entries below.</p>

      <section
        style={{
          marginTop: 24,
          padding: 16,
          background: 'rgba(244,210,172,0.08)',
          border: '1px solid rgba(244,210,172,0.25)',
          borderRadius: 12,
        }}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: '1rem', color: '#f4d2ac' }}>Playable</h2>
        <Link href="/onboarding/shanghai" style={{ color: '#f4d2ac', fontWeight: 600 }}>
          Shanghai · H1 onboarding hangout
        </Link>
        <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
          Full scene with per-bubble translation paywall demo. On completion: +40 XP, 方阿姨 +3 affinity, 5 vocab first-contact. Append <code>?dev_pass=1</code> to bypass gates, or <code>?sp=5</code> to preload credits.
        </p>
      </section>

      <h2 style={{ margin: '32px 0 12px', fontSize: '1rem', color: 'rgba(255,255,255,0.7)' }}>Raw fixtures</h2>
      <ul style={{ listStyle: 'none', padding: 0, marginTop: 24, display: 'grid', gap: 12 }}>
        {WEBTOON_FIXTURES.map((entry) => (
          <li
            key={entry.id}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: 16,
            }}
          >
            <Link href={`/webtoon/${encodeURIComponent(entry.id)}`} style={{ color: '#f4d2ac', fontWeight: 600 }}>
              {entry.label}
            </Link>
            <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.55)', fontSize: '0.88rem' }}>{entry.description}</p>
            <p style={{ margin: '4px 0 0', fontFamily: 'monospace', fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>
              {entry.spec.panels.length} panels · id: {entry.id}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
