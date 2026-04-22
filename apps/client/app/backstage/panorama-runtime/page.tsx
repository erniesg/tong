'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { SceneView } from '@/components/scene/SceneView';

const DEMO_ACCESS_TOKEN = 'TONG-DEMO-ACCESS';

export default function PanoramaRuntimePage() {
  const searchParams = useSearchParams();
  const hasAccess = searchParams.get('demo') === DEMO_ACCESS_TOKEN;
  const [panoramaDeltaX, setPanoramaDeltaX] = useState(0);
  const [mode, setMode] = useState<'cover' | 'panorama'>('panorama');

  const cinematic = useMemo(() => ({
    // Repo-visible stand-in media keeps this route independent from production onboarding wiring.
    videoUrl: '/assets/webtoon/shanghai/h1/0.png',
    caption: 'Keep your head down. Listen before they notice you.',
    captionTranslation: 'Panorama runtime sandbox — drag sideways to inspect framing.',
    autoAdvance: true,
    muted: true,
  }), []);

  if (!hasAccess) {
    return (
      <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#05050a', color: '#f5f5f5', padding: 24 }}>
        <div style={{ maxWidth: 620 }}>
          <h1 style={{ marginTop: 0 }}>Panorama runtime sandbox</h1>
          <p>Use <code>?demo={DEMO_ACCESS_TOKEN}</code> to open this backstage-only route.</p>
          <p>This page is intentionally separate from production onboarding.</p>
          <Link href="/" style={{ color: '#f0c040' }}>Back home</Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100dvh', background: '#000' }}>
      <SceneView
        backgroundUrl=""
        ambientDescription="Backstage panorama runtime test"
        cinematic={cinematic}
        cinematicMediaFit={mode}
        cinematicAuthoredDimensions={{ width: 4096, height: 1536 }}
        onCinematicPanoramaDeltaChange={setPanoramaDeltaX}
      />

      <section
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          right: 12,
          zIndex: 300,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            pointerEvents: 'auto',
            background: 'rgba(5,5,10,0.75)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 14,
            padding: '8px 12px',
            color: '#f5f5f5',
            fontSize: 13,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        >
          <div>mode: {mode}</div>
          <div data-testid="panorama-transform-delta">transformX: {panoramaDeltaX.toFixed(2)}px</div>
        </div>

        <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto' }}>
          <button
            type="button"
            onClick={() => setMode('panorama')}
            style={{
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.2)',
              background: mode === 'panorama' ? '#f0c040' : 'rgba(5,5,10,0.8)',
              color: mode === 'panorama' ? '#111' : '#f5f5f5',
              padding: '8px 12px',
              fontWeight: 700,
            }}
          >
            Panorama mode
          </button>
          <button
            type="button"
            onClick={() => setMode('cover')}
            style={{
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.2)',
              background: mode === 'cover' ? '#f0c040' : 'rgba(5,5,10,0.8)',
              color: mode === 'cover' ? '#111' : '#f5f5f5',
              padding: '8px 12px',
              fontWeight: 700,
            }}
          >
            Cover mode
          </button>
        </div>
      </section>
    </main>
  );
}
