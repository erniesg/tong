/**
 * Canon: what is true in the world. Scenes, generators and agents read this;
 * they never contradict it. What the *player* has learned lives in
 * RelState.knows, keyed by the same fact ids.
 */
export interface CanonFact {
  id: string;
  fact: string;
  /** Who in the world knows this. 'player' is never listed: that is RelState.knows. */
  knownBy: string[];
}

export interface CanonSecret extends CanonFact {
  /** Plain-language reveal condition; scenes encode it as a Condition. */
  revealWhen: string;
  /** Scene ids allowed to reveal it. */
  revealedIn: string[];
}

export interface CanonEvent {
  /** "2019", "two weeks before you arrive", "m1 d1". */
  when: string;
  event: string;
  knownBy: string[];
}

export interface CanonPerson {
  id: string;
  name: { ko: string; en: string };
  relation: string;
  note: string;
}

export interface CharacterCanon {
  id: string;
  name: { ko: string; en: string };
  age: number;
  hometown: string;
  role: string;
  family: string;
  timeline: CanonEvent[];
  people: CanonPerson[];
  ownedPlaces: { id: string; why: string }[];
  facts: CanonFact[];
  secrets: CanonSecret[];
  model: {
    publicLayer: string;
    privateLayer: string;
    attachment: string;
    gives: string[];
    needs: string[];
    want: string;
    need: string;
    wound: string;
    fear: string;
    conflictStyle: string;
    humor: string;
    values: string[];
    triggers: string[];
    /** 0–1. How hard mood swings; how visible they are is separate. */
    volatility: number;
    moodTells: string[];
  };
  speech: {
    rules: string[];
    tics: string[];
    texting: string[];
    underPressure: string;
    neverSays: string[];
  };
  schedule: { slot: string; where: string; note?: string }[];
  /** Continuity rules agents must not break. */
  mustNot: string[];
}

export interface WorldCanon {
  agency: { ko: string; en: string; note: string };
  calendar: { month: number; label: string; eval: string; beats: string[] }[];
  places: { id: string; name: { ko: string; en: string }; note: string }[];
  people: CanonPerson[];
  rules: string[];
}
