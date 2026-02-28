/** Self-contained VN types for the hangout phase — no game-core dependency */

export type Expression =
  | 'neutral' | 'happy' | 'surprised' | 'thinking'
  | 'embarrassed' | 'sad' | 'angry' | 'flirty';

export interface SessionMessage {
  id: string;
  role: 'npc' | 'tong' | 'user' | 'narrator' | 'system';
  characterId?: string;
  content: string;
  translation?: string;
  expression?: Expression;
  exercise?: ExerciseData;
}

export interface DialogueChoice {
  id: string;
  text: string;
  subtext?: string;
  affinityHint?: 'positive' | 'negative' | 'neutral';
}

export interface ToolQueueItem {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  pauses?: boolean;
}

export interface SceneSummary {
  summary: string;
  xpEarned: number;
  affinityChanges: { characterId: string; delta: number }[];
  calibratedLevel?: number | null;
}

/* ── Exercise types (self-contained) ──────────────────────── */

export interface MultipleChoiceExercise {
  type: 'multiple_choice';
  id: string;
  objectiveId: string;
  difficulty: number;
  prompt: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation?: string;
}

export interface DragDropExercise {
  type: 'drag_drop';
  id: string;
  objectiveId: string;
  difficulty: number;
  prompt: string;
  promptImageUrl?: string;
  items: { id: string; text: string }[];
  targets: { id: string; label: string }[];
  correctMapping: Record<string, string>;
}

export interface MatchingExercise {
  type: 'matching';
  id: string;
  objectiveId: string;
  difficulty: number;
  prompt: string;
  pairs: { left: string; right: string }[];
}

export type ExerciseData = MultipleChoiceExercise | DragDropExercise | MatchingExercise;
