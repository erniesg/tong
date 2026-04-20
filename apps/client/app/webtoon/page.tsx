'use client';

import Link from 'next/link';
import { WEBTOON_FIXTURES } from '@/lib/content/shanghai/fixtures';

export default function WebtoonIndex() {
  return (
    <main style={{ padding: 32, minHeight: '100dvh', background: '#0d0d1a', color: '#fff8ee' }}>
      <h1 style={{ marginTop: 0, fontSize: '1.6rem' }}>Webtoon preview gallery</h1>
      <p style={{ color: 'rgba(255,255,255,0.55)' }}>Tap a fixture to open the scrolling strip.</p>
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
