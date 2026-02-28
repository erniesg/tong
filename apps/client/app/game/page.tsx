import GamePageClient from './GamePageClient';

type SearchParams = Record<string, string | string[] | undefined>;

type EntryPhase = 'opening' | 'entry' | 'onboarding' | 'playing';

function readParam(searchParams: SearchParams | undefined, key: string): string | null {
  const value = searchParams?.[key];
  if (Array.isArray(value)) return value[0] ?? null;
  if (typeof value === 'string') return value;
  return null;
}

export default function GamePage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const forceNewGame = readParam(searchParams, 'newGame') === '1';
  const onboarding = readParam(searchParams, 'onboarding') === '1';
  const skipIntro = readParam(searchParams, 'skipIntro') === '1' || readParam(searchParams, 'entry') === '1';

  let initialEntryPhase: EntryPhase = 'opening';
  if (forceNewGame || onboarding) {
    initialEntryPhase = 'onboarding';
  } else if (skipIntro) {
    initialEntryPhase = 'entry';
  }

  return <GamePageClient initialEntryPhase={initialEntryPhase} autoNewGame={forceNewGame} />;
}
