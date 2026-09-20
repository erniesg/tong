import { SHANGHAI_H1_WEBTOON, SHANGHAI_H1_WEBTOON_PANELS } from './h1-webtoon';
import type { WebtoonSpec } from '@/lib/hangout/fixture-types';

export { SHANGHAI_H1_WEBTOON, SHANGHAI_H1_WEBTOON_PANELS };

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
    description: 'Full deterministic Shanghai H1 strip: prepped eavesdrop, character-read turn, phone departure, and 方阿姨 callout.',
    spec: SHANGHAI_H1_WEBTOON,
  },
];

export function getWebtoonFixture(id: string): WebtoonFixtureEntry | undefined {
  return WEBTOON_FIXTURES.find((entry) => entry.id === id);
}
