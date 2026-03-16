export type ObjectiveCategory =
  | 'script'
  | 'pronunciation'
  | 'vocabulary'
  | 'grammar'
  | 'sentences'
  | 'conversation'
  | 'mastery';

export interface LearningObjective {
  id: string;
  levelNumber: number;
  category: ObjectiveCategory;
  title: string;
  description: string;
  targetItems: string[];
  targetCount: number;
  assessmentThreshold: number;
  prerequisites: string[];   // IDs of objectives that must be completed first
  tags: string[];            // searchable tags for AI to reference
}

export interface VocabularyTarget {
  word: string;
  romanization: string;
  translation: string;
  category: string;
  level: number;
  sceneContext?: string;
  visualCue?: string;
}

export interface GrammarTarget {
  id: string;
  pattern: string;
  explanation: string;
  examples: { target: string; translation: string }[];
  level: number;
  locationId: string;
}

export interface AssessmentCriteria {
  minAccuracy: number;
  minItemsCompleted: number;
  requiredObjectives: string[];
}

export interface LocationLevel {
  level: number;
  name: string;
  description: string;
  objectives: LearningObjective[];
  estimatedSessionMinutes: number;
  assessmentCriteria: AssessmentCriteria;
}

export interface Location {
  id: string;
  cityId: string;
  name: Record<string, string>;
  domain: string;
  order: number;
  backgroundImageUrl: string;
  ambientDescription: string;
  levels: LocationLevel[];
  vocabularyTargets: VocabularyTarget[];
  grammarTargets: GrammarTarget[];
}
