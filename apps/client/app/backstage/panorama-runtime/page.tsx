'use client';

import { useState } from 'react';
import { CinematicOverlay } from '@/components/scene/CinematicOverlay';

const SHANGHAI_SAMPLE_ASSET = '/assets/locations/shanghai.mp4';

export default function PanoramaRuntimeBackstagePage() {
  const [playing, setPlaying] = useState(true);

  return (
    <main className="panorama-runtime-page">
      <div className="panorama-runtime-note">
        <h1>Panorama Runtime Harness (Non-production)</h1>
        <p>
          Isolated QA surface for onboarding cinematic pan behavior.
          This route is intentionally separate from <code>/onboarding/shanghai</code>.
        </p>
        {!playing && (
          <button type="button" className="panorama-runtime-replay" onClick={() => setPlaying(true)}>
            Replay panorama sample
          </button>
        )}
      </div>

      {playing && (
        <CinematicOverlay
          videoUrl={SHANGHAI_SAMPLE_ASSET}
          caption="上海的夜风有点甜。"
          captionTranslation="The night breeze in Shanghai feels a little sweet."
          autoAdvance={false}
          muted
          presentation={{
            mode: 'panorama',
            mediaWidth: 1920,
            mediaHeight: 1080,
            overlays: [
              { id: 'street', anchor: 'world', x: 520, y: 700, label: 'Food Street' },
              { id: 'cafe', anchor: 'world', x: 1290, y: 600, label: 'Cafe' },
            ],
          }}
          onEnd={() => setPlaying(false)}
        />
      )}
    </main>
  );
}
