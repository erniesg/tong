import type { SceneFixture } from './fixture-types';
import { getShanghaiFixture } from '@/lib/content/shanghai/fixtures';

const FIXTURE_SCENE_ALIASES: Record<string, string> = {
  'shanghai:h1': 'shanghai/h1-negotiation',
};

export function resolveFixtureId(params: {
  fixtureId?: string | null;
  city?: string | null;
  scene?: string | null;
}): string | null {
  const directFixtureId = normalizeNullableString(params.fixtureId);
  if (directFixtureId) {
    return directFixtureId;
  }

  const city = normalizeNullableString(params.city);
  const scene = normalizeNullableString(params.scene);
  if (!city || !scene) {
    return null;
  }

  return FIXTURE_SCENE_ALIASES[`${city}:${scene}`] ?? null;
}

export function getSceneFixture(fixtureId: string): SceneFixture | null {
  return getShanghaiFixture(fixtureId);
}

function normalizeNullableString(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
