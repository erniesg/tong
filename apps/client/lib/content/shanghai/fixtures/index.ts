import { SHANGHAI_H1_NEGOTIATION_FIXTURE } from './h1-negotiation';

export { SHANGHAI_H1_NEGOTIATION_FIXTURE } from './h1-negotiation';

export const SHANGHAI_FIXTURE_REGISTRY = {
  [SHANGHAI_H1_NEGOTIATION_FIXTURE.id]: SHANGHAI_H1_NEGOTIATION_FIXTURE,
} as const;

export function getShanghaiFixture(fixtureId: string) {
  return SHANGHAI_FIXTURE_REGISTRY[fixtureId as keyof typeof SHANGHAI_FIXTURE_REGISTRY] ?? null;
}
