'use client';

import { ShanghaiOnboardingFlow } from '@/components/shanghai/ShanghaiOnboardingFlow';

export default function ShanghaiOnboardingPage() {
  return (
    <div className="scene-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="game-frame">
        <ShanghaiOnboardingFlow />
      </div>
    </div>
  );
}
