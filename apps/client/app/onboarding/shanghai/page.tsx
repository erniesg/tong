import { Suspense } from 'react';
import { ShanghaiOnboardingFlow } from '@/components/shanghai/ShanghaiOnboardingFlow';

export default function ShanghaiOnboardingPage() {
  return (
    <Suspense>
      <ShanghaiOnboardingFlow />
    </Suspense>
  );
}
