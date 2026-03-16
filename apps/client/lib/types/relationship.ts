export type RelationshipStage =
  | 'strangers'
  | 'acquaintances'
  | 'colleagues'
  | 'friends'
  | 'close'
  | 'romantic';

export interface Relationship {
  characterId: string;
  affinity: number;         // 0-100
  stage: RelationshipStage;
  interactionCount: number;
  lastInteraction: number;  // Date.now()
  storyFlags: Record<string, boolean>;
  significantMoments: RelationshipMoment[];
}

export interface RelationshipMoment {
  description: string;
  affinityAtTime: number;
  timestamp: number;
}

export interface CharacterPersonality {
  traits: string[];
  likes: string[];
  dislikes: string[];
  quirks: string[];
  motivations: string;
  emotionalRange: string;
}

export interface CharacterSpeechStyle {
  defaultRegister: string;
  slang: string[];
  catchphrases: string[];
  dialectNotes?: string;
  byRelationshipStage: Record<
    RelationshipStage,
    {
      register: string;
      targetLangPercent: number;
      tone: string;
      exampleLine: string;
    }
  >;
}

export interface Character {
  id: string;
  name: Record<string, string>;
  cityId: string;
  role: string;
  context: string;
  archetype: string;
  personality: CharacterPersonality;
  speechStyle: CharacterSpeechStyle;
  backstory: string;
  defaultLocationId: string;
  romanceable: boolean;
  voiceId?: string;
  voiceDescription?: string;
}

export function getRelationshipStage(affinity: number): RelationshipStage {
  if (affinity >= 91) return 'romantic';
  if (affinity >= 76) return 'close';
  if (affinity >= 56) return 'friends';
  if (affinity >= 36) return 'colleagues';
  if (affinity >= 16) return 'acquaintances';
  return 'strangers';
}

export function computeTargetLangPercent(
  playerLevel: number,
  stage: RelationshipStage,
): number {
  const levelBase: Record<number, number> = {
    0: 5, 1: 10, 2: 25, 3: 40, 4: 60, 5: 80, 6: 95,
  };
  const stageModifier: Record<RelationshipStage, number> = {
    strangers: -5,
    acquaintances: 0,
    colleagues: 5,
    friends: 10,
    close: 15,
    romantic: 15,
  };
  const base = levelBase[playerLevel] ?? 50;
  const mod = stageModifier[stage] ?? 0;
  return Math.max(0, Math.min(100, base + mod));
}

export function defaultRelationship(characterId: string): Relationship {
  return {
    characterId,
    affinity: 10,
    stage: 'strangers',
    interactionCount: 0,
    lastInteraction: 0,
    storyFlags: {},
    significantMoments: [],
  };
}
