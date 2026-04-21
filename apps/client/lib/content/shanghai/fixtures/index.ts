import { SHANGHAI_H1_WEBTOON, SHANGHAI_H1_WEBTOON_PANELS } from './h1-webtoon';
import { SHANGHAI_H1_NEGOTIATION_FIXTURE } from './h1-negotiation';
import type { WebtoonSpec } from '@/lib/hangout/fixture-types';

export { SHANGHAI_H1_WEBTOON, SHANGHAI_H1_WEBTOON_PANELS };
export { SHANGHAI_H1_NEGOTIATION_FIXTURE } from './h1-negotiation';

export const SHANGHAI_FIXTURE_REGISTRY = {
  [SHANGHAI_H1_NEGOTIATION_FIXTURE.id]: SHANGHAI_H1_NEGOTIATION_FIXTURE,
} as const;

export function getShanghaiFixture(fixtureId: string) {
  return SHANGHAI_FIXTURE_REGISTRY[fixtureId as keyof typeof SHANGHAI_FIXTURE_REGISTRY] ?? null;
}

export interface WebtoonFixtureEntry {
  id: string;
  label: string;
  description: string;
  spec: WebtoonSpec;
}

export const WEBTOON_FIXTURES: WebtoonFixtureEntry[] = [
  {
    id: 'shanghai-h1',
    label: 'Shanghai · H1 — 小笼包 Negotiation',
    description: 'Seventeen-panel webtoon strip of the 守成/丁漫 dumpling-shop negotiation (onboarding).',
    spec: SHANGHAI_H1_WEBTOON,
  },
];

export function getWebtoonFixture(id: string): WebtoonFixtureEntry | undefined {
  return WEBTOON_FIXTURES.find((entry) => entry.id === id);
}
