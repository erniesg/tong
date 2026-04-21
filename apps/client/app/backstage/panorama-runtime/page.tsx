'use client';

import { useState } from 'react';
import { CinematicOverlay } from '@/components/scene/CinematicOverlay';

const SAMPLE_VIDEO = '/assets/locations/shanghai.mp4';

export default function PanoramaRuntimeBackstagePage() {
  const [mode, setMode] = useState<'cover' | 'panorama'>('panorama');
  const [playing, setPlaying] = useState(true);

  return (
    <main style={{ minHeight: '100vh', background: '#111', color: '#fff', padding: 20 }}>
      <h1 style={{ marginTop: 0 }}>Backstage: Panorama Runtime (Non-production)</h1>
      <p style={{ maxWidth: 760, opacity: 0.8 }}>
        Temporary QA harness for issue #258. This route is isolated from onboarding and game production flows.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={() => setMode('cover')}>Cover mode</button>
        <button type="button" onClick={() => setMode('panorama')}>Panorama mode</button>
        <button type="button" onClick={() => setPlaying(true)}>Replay</button>
      </div>

      <div style={{ position: 'relative', width: 'min(960px, 100%)', aspectRatio: '9 / 16', border: '1px solid #333' }}>
        {playing ? (
          <CinematicOverlay
            videoUrl={SAMPLE_VIDEO}
            caption="외탄 강변을 걸어볼까?"
            captionTranslation="Want to take a walk along the Bund?"
            autoAdvance={false}
            muted
            presentationMode={mode}
            worldOverlays={[
              { id: 'left', x: 23, y: 40, content: 'WORLD • Food Street' },
              { id: 'right', x: 73, y: 62, content: 'WORLD • Subway Hub' },
            ]}
            onEnd={() => setPlaying(false)}
          />
        ) : (
          <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%' }}>
            Tap replay to run again.
          </div>
        )}
      </div>
    </main>
  );
}
