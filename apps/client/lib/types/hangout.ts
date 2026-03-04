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

export interface SentenceBuilderExercise {
  type: 'sentence_builder';
  id: string;
  objectiveId: string;
  difficulty: number;
  prompt: string;
  wordTiles: string[];
  correctOrder: string[];
  distractors?: string[];
  explanation?: string;
}

export interface FillBlankExercise {
  type: 'fill_blank';
  id: string;
  objectiveId: string;
  difficulty: number;
  prompt: string;
  sentence: string;
  blankIndex: number;
  options: { id: string; text: string }[];
  correctOptionId: string;
  grammarNote?: string;
  explanation?: string;
}

export interface PronunciationSelectExercise {
  type: 'pronunciation_select';
  id: string;
  objectiveId: string;
  difficulty: number;
  prompt: string;
  targetText: string;
  audioOptions: { id: string; label: string; romanization: string; meaning?: string }[];
  correctOptionId: string;
  explanation?: string;
}

export interface PatternRecognitionExercise {
  type: 'pattern_recognition';
  id: string;
  objectiveId: string;
  difficulty: number;
  prompt: string;
  pairs: { chars: string; explanation: string }[];
  correctPairIndex: number;
  principleId: string;
  explanation?: string;
}

export interface StrokeTracingExercise {
  type: 'stroke_tracing';
  id: string;
  objectiveId: string;
  difficulty: number;
  prompt: string;
  targetChar: string;
  ghostOverlay: boolean;
  explanation?: string;
  romanization?: string;
  meaning?: string;
  sound?: string;
  language?: 'ko' | 'ja' | 'zh';
  exampleWords?: { word: string; romanization: string; meaning: string }[];
}

export type BlockCrushStage = 'intro' | 'recognition' | 'recall';

export interface BlockCrushExercise {
  type: 'block_crush';
  id: string;
  objectiveId: string;
  difficulty: number;
  prompt: string;
  language: 'ko' | 'zh' | 'ja';
  /** Target character to assemble */
  targetChar: string;
  /** Component pieces and their slots */
  components: { piece: string; slot: string; colorHint: string }[];
  romanization: string;
  meaning: string;
  explanation?: string;
  /** Stage for progressive difficulty — defaults to 'recognition' */
  stage?: BlockCrushStage;
}

export interface ErrorCorrectionExercise {
  type: 'error_correction';
  id: string;
  objectiveId: string;
  difficulty: number;
  prompt: string;
  sentence: string;
  errorWordIndex: number;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation?: string;
}

export interface FreeInputExercise {
  type: 'free_input';
  id: string;
  objectiveId: string;
  difficulty: number;
  prompt: string;
  expectedAnswers: string[];
  hint?: string;
  explanation?: string;
}

export type ExerciseData =
  | MultipleChoiceExercise
  | DragDropExercise
  | MatchingExercise
  | SentenceBuilderExercise
  | FillBlankExercise
  | PronunciationSelectExercise
  | PatternRecognitionExercise
  | StrokeTracingExercise
  | BlockCrushExercise
  | ErrorCorrectionExercise
  | FreeInputExercise;
