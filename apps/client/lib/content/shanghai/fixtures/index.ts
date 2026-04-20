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
    description: 'Seven-panel webtoon strip of the 守成/丁漫 dumpling-shop negotiation.',
    spec: SHANGHAI_H1_WEBTOON,
  },
];

export function getWebtoonFixture(id: string): WebtoonFixtureEntry | undefined {
  return WEBTOON_FIXTURES.find((entry) => entry.id === id);
}
