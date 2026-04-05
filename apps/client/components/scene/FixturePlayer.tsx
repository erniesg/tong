'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SessionMessage, ExerciseData, StrokeTracingExercise } from '@/lib/types/hangout';
import { SceneView } from './SceneView';

/* ── Fixture types ────────────────────────────────────────────── */

interface FixtureDialogueScene {
  type: 'dialogue';
  speaker: string;
  text: string;
}

interface FixtureExerciseScene {
  type: 'exercise';
  exerciseType: string;
  exerciseId: string;
  data: Record<string, unknown>;
}

type FixtureScene = FixtureDialogueScene | FixtureExerciseScene;

interface Fixture {
  id: string;
  title: string;
  city: string;
  npc: string;
  npcName: string;
  location: string;
  language: string;
  background: string;
  scenes: FixtureScene[];
}

/* ── Helpers ──────────────────────────────────────────────────── */

const NPC_SPRITES: Record<string, string> = {
  haeun: '/assets/characters/haeun/haeun_neutral.png',
};

function buildExerciseData(scene: FixtureExerciseScene): ExerciseData | null {
  if (scene.exerciseType === 'stroke_tracing') {
    const d = scene.data;
    return {
      type: 'stroke_tracing',
      id: scene.exerciseId,
      objectiveId: `fixture-${scene.exerciseId}`,
      difficulty: 1,
      prompt: `Trace: ${d.label || d.targetChar}`,
      targetChar: String(d.targetChar || ''),
      ghostOverlay: true,
      explanation: String(d.label || ''),
      mode: d.mode as string | undefined,
      reps: d.reps as number | undefined,
    } as StrokeTracingExercise & { mode?: string; reps?: number };
  }
  return null;
}

/* ── Component ────────────────────────────────────────────────── */

interface Props {
  fixture: Fixture;
  startScene?: number;
}

export function FixturePlayer({ fixture, startScene = 0 }: Props) {
  const [sceneIdx, setSceneIdx] = useState(startScene);
  const [exerciseDone, setExerciseDone] = useState(false);

  const scene = fixture.scenes[sceneIdx];
  const isLast = sceneIdx >= fixture.scenes.length - 1;

  // Build SceneView props from current fixture scene
  const currentMessage: SessionMessage | null =
    scene?.type === 'dialogue'
      ? {
          id: `fixture-msg-${sceneIdx}`,
          role: 'npc' as const,
          characterId: scene.speaker,
          content: scene.text,
        }
      : null;

  const currentExercise: ExerciseData | null =
    scene?.type === 'exercise' ? buildExerciseData(scene) : null;

  // Reset exerciseDone when scene changes
  useEffect(() => {
    setExerciseDone(false);
  }, [sceneIdx]);

  const handleContinue = useCallback(() => {
    if (scene?.type === 'exercise' && !exerciseDone) return; // wait for exercise
    if (!isLast) setSceneIdx((i) => i + 1);
  }, [scene, exerciseDone, isLast]);

  const handleExerciseResult = useCallback((_id: string, _correct: boolean) => {
    setExerciseDone(true);
  }, []);

  const handleExerciseDismiss = useCallback(() => {
    if (!isLast) setSceneIdx((i) => i + 1);
  }, [isLast]);

  const handleBack = useCallback(() => {
    if (sceneIdx > 0) setSceneIdx((i) => i - 1);
  }, [sceneIdx]);

  if (!scene) return null;

  return (
    <div className="scene-root">
      <div className="game-frame">
        <SceneView
          backgroundUrl={fixture.background}
          npcName={fixture.npcName}
          npcColor={undefined}
          npcSpriteUrl={NPC_SPRITES[fixture.npc] || ''}
          currentMessage={currentMessage}
          currentExercise={currentExercise}
          isStreaming={false}
          dialogueIsStreaming={false}
          sceneBusy={false}
          targetLang={fixture.language as 'ko' | 'ja' | 'zh'}
          onContinue={handleContinue}
          onExerciseResult={handleExerciseResult}
          onExerciseDismiss={handleExerciseDismiss}
        />

        {/* Scene navigation bar */}
        <div className="fixture-nav">
          <button
            className="fixture-nav-btn"
            onClick={handleBack}
            disabled={sceneIdx === 0}
          >
            &lt; Prev
          </button>
          <span className="fixture-nav-label">
            {sceneIdx + 1}/{fixture.scenes.length} — {scene.type}
            {scene.type === 'exercise' ? ` (${(scene as FixtureExerciseScene).data.targetChar})` : ''}
          </span>
          <button
            className="fixture-nav-btn"
            onClick={handleContinue}
            disabled={isLast}
          >
            Next &gt;
          </button>
        </div>
      </div>
    </div>
  );
}
