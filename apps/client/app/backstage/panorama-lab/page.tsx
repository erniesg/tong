'use client';

import { useMemo } from 'react';
import { CinematicOverlay } from '@/components/scene/CinematicOverlay';

const SAMPLE_VIDEO_URL = '/assets/locations/shanghai.mp4';

export default function PanoramaLabPage() {
  const sampleOverlays = useMemo(() => ([
    { id: 'viewport-title', anchor: 'viewport' as const, label: 'Viewport overlay (fixed)', x: 0.5, y: 0.1 },
    { id: 'world-food', anchor: 'world' as const, label: 'World marker: Food Street', x: 0.24, y: 0.42 },
    { id: 'world-subway', anchor: 'world' as const, label: 'World marker: Subway Hub', x: 0.74, y: 0.5 },
  ]), []);

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <header>
        <p className="kicker">Backstage • Non-production harness</p>
        <h2 style={{ margin: '4px 0 8px' }}>Panorama Cinematic Lab</h2>
        <p className="page-copy">
          Drag horizontally (mouse or touch) to pan. World overlays move with the media while viewport overlays stay fixed.
        </p>
      </header>

      <div
        style={{
          position: 'relative',
          borderRadius: 18,
          overflow: 'hidden',
          border: '1px solid var(--line)',
          width: '100%',
          aspectRatio: '9 / 16',
          maxHeight: 'min(72svh, 760px)',
          background: '#000',
        }}
      >
        <CinematicOverlay
          videoUrl={SAMPLE_VIDEO_URL}
          caption="외탄 야경부터 지하철 허브까지 — 시선을 움직여 보세요."
          captionTranslation="From Bund night lights to the subway hub — drag to explore the panorama."
          autoAdvance={false}
          muted
          mode="panorama"
          initialPan={0.5}
          overlays={sampleOverlays}
          onEnd={() => {}}
        />
      </div>
    </section>
  );
}
