'use client';

import { useMemo, useState } from 'react';
import { SceneView } from '@/components/scene/SceneView';

const SHANGHAI_BACKDROP = '/assets/locations/shanghai-static.png';
const PANORAMA_ASSET = '/assets/locations/shanghai-static.png';

export default function PanoramaRuntimePage() {
  const [mode, setMode] = useState<'panorama' | 'cover'>('panorama');
  const [lastTransform, setLastTransform] = useState(0);
  const [sessionKey, setSessionKey] = useState(0);

  const cinematic = useMemo(() => ({
    videoUrl: '/assets/tong_intro.webm',
    caption: mode === 'panorama' ? 'Drag sideways to pan the Shanghai panorama.' : 'Cover mode control check.',
    captionTranslation: mode === 'panorama' ? `Current transformX: ${Math.round(lastTransform)}px` : 'Existing cover video behavior should remain unchanged.',
    autoAdvance: false,
    muted: true,
    mode,
    panoramaImageUrl: PANORAMA_ASSET,
    panoramaWidth: 3072,
    panoramaHeight: 1024,
    onPanoramaTransformChange: (transformX: number) => setLastTransform(transformX),
  }), [lastTransform, mode]);

  return (
    <main className="relative min-h-[100dvh] bg-[#0a0f1b] text-white">
      <div className="absolute left-3 right-3 top-3 z-40 rounded-xl border border-white/20 bg-black/55 p-3 text-xs backdrop-blur">
        <p className="font-semibold">Panorama Runtime Backstage</p>
        <p className="mt-1 opacity-80">Use this route to verify drag movement and transform output without touching onboarding production flow.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="rounded border border-white/25 px-3 py-1" onClick={() => setMode('panorama')}>
            Panorama mode
          </button>
          <button type="button" className="rounded border border-white/25 px-3 py-1" onClick={() => setMode('cover')}>
            Cover mode
          </button>
          <button type="button" className="rounded border border-white/25 px-3 py-1" onClick={() => { setLastTransform(0); setSessionKey((prev) => prev + 1); }}>
            Reset scene
          </button>
        </div>
        <p className="mt-2">
          Transform delta:
          {' '}
          <span data-testid="panorama-transform-delta" className="font-mono text-amber-300">
            {Math.round(lastTransform)}px
          </span>
        </p>
      </div>

      <div className="absolute inset-0">
        <SceneView
          key={`${mode}-${sessionKey}`}
          backgroundUrl={SHANGHAI_BACKDROP}
          ambientDescription="Backstage panorama runtime check"
          cinematic={cinematic}
          npcName=""
          sceneReady={true}
        />
      </div>
    </main>
  );
}
