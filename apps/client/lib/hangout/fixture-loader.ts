import { getShanghaiFixture } from '@/lib/content/shanghai/fixtures';
import type { SceneFixture } from '@/lib/hangout/fixture-types';

export function resolveFixtureId(input: {
  fixtureId?: string | null;
  city?: string | null;
  scene?: string | null;
}): string | null {
  if (input.fixtureId) {
    return input.fixtureId;
  }

  if (input.city === 'shanghai' && input.scene === 'h1') {
    return 'shanghai/h1-negotiation';
  }

  return null;
}

export function loadSceneFixture(fixtureId: string): SceneFixture | null {
  if (fixtureId.startsWith('shanghai/')) {
    return getShanghaiFixture(fixtureId);
  }

  return null;
}
