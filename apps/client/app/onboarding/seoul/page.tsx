import { Suspense } from 'react';
import { SeoulOnboardingFlow } from '@/components/seoul/SeoulOnboardingFlow';

export default function SeoulOnboardingPage() {
  return (
    <Suspense>
      <SeoulOnboardingFlow />
    </Suspense>
  );
}
