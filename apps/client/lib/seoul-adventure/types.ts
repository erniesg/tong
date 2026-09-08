export type LocationId =
  | 'food_street'
  | 'cafe'
  | 'convenience_store'
  | 'subway_hub'
  | 'practice_studio';

export type CompanionId = 'haeun' | 'jin';

export interface Phrase {
  ko: string;
  romanization: string;
  en: string;
}

export interface Lesson {
  prompt: string;
  choices: Phrase[];
  answer: number;
  explanation: string;
}

export interface Location {
  id: LocationId;
  name: string;
  korean: string;
  position: [number, number];
  color: string;
  description: string;
  objective: string;
  phrase: Phrase;
  lesson: Lesson;
  hangout: Record<CompanionId, string>;
  hangoutTranslation?: Record<CompanionId, string>;
  hangoutReply: Lesson;
}

export interface Companion {
  id: CompanionId;
  name: string;
  korean: string;
  description: string;
  color: string;
}

export interface Progress {
  version: 1;
  xp: number;
  sp: number;
  rp: Record<CompanionId, number>;
  learned: LocationId[];
  hangouts: LocationId[];
  visited: LocationId[];
  missionComplete: boolean;
  memories: string[];
  history: {
    id: string;
    location: LocationId;
    mode: 'learn' | 'hangout' | 'mission';
    success: boolean;
    at: string;
  }[];
}
