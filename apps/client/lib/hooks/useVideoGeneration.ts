'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { volcVideoCreate, volcVideoGet } from '@/lib/api';

export interface VideoGenState {
  taskId: string | null;
  status: 'idle' | 'queued' | 'running' | 'succeeded' | 'failed' | 'error';
  videoUrl: string | null;
  progress: number; // 0-100, synthetic estimate for heart meter
  error: string | null;
}

const POLL_INTERVAL_MS = 10_000;
const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/** Mock: ramp progress over durationMs, then succeed with a placeholder URL */
const MOCK_DURATION_MS = 30_000; // 30s simulated generation
const MOCK_VIDEO_URL = '/assets/cinematics/haeun/exit_3.mp4';

interface UseVideoGenerationOptions {
  mock?: boolean;
}

export function useVideoGeneration(opts?: UseVideoGenerationOptions) {
  const mock = opts?.mock ?? false;

  const [state, setState] = useState<VideoGenState>({
    taskId: null,
    status: 'idle',
    videoUrl: null,
    progress: 0,
    error: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  // Synthetic progress: ramps from 10→90 over ~3 min (real) or rampDuration (mock)
  const computeSyntheticProgress = useCallback((rampMs: number = 3 * 60 * 1000) => {
    if (!startTimeRef.current) return 0;
    const elapsed = Date.now() - startTimeRef.current;
    const ratio = Math.min(elapsed / rampMs, 1);
    return Math.round(10 + 80 * (1 - Math.pow(1 - ratio, 2)));
  }, []);

  const startGeneration = useCallback(async (args: {
    content: Array<{ type: 'text'; text: string } | { type: 'image_url'; imageUrl: string }>;
    ratio?: '16:9' | '9:16' | '4:3' | '1:1';
    duration?: number;
    generateAudio?: boolean;
  }) => {
    cleanup();
    setState({ taskId: null, status: 'queued', videoUrl: null, progress: 5, error: null });
    startTimeRef.current = Date.now();

    /* ── Mock mode ─────────────────────────────────────────── */
    if (mock) {
      const mockId = `mock-${Date.now()}`;
      console.log('[useVideoGeneration] MOCK mode — simulating', MOCK_DURATION_MS / 1000, 's generation');
      setState(prev => ({ ...prev, taskId: mockId, status: 'running', progress: 10 }));

      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        if (elapsed >= MOCK_DURATION_MS) {
          cleanup();
          setState(prev => ({
            ...prev,
            status: 'succeeded',
            videoUrl: MOCK_VIDEO_URL,
            progress: 100,
          }));
          console.log('[useVideoGeneration] MOCK — succeeded');
        } else {
          setState(prev => ({
            ...prev,
            progress: computeSyntheticProgress(MOCK_DURATION_MS * 0.8),
          }));
        }
      }, 2_000); // tick every 2s in mock
      return;
    }

    /* ── Real mode ─────────────────────────────────────────── */
    try {
      const result = await volcVideoCreate({
        content: args.content,
        ratio: args.ratio ?? '9:16',
        duration: args.duration ?? 10,
        generateAudio: args.generateAudio ?? true,
      });

      if (!result.ok || !result.result?.id) {
        setState(prev => ({ ...prev, status: 'error', error: result.error ?? 'Failed to create video task' }));
        return;
      }

      const taskId = result.result.id;
      setState(prev => ({ ...prev, taskId, status: 'running', progress: 10 }));

      // Start polling
      intervalRef.current = setInterval(async () => {
        // Timeout check
        if (Date.now() - startTimeRef.current > TIMEOUT_MS) {
          cleanup();
          setState(prev => ({ ...prev, status: 'error', error: 'Video generation timed out' }));
          return;
        }

        try {
          const poll = await volcVideoGet(taskId);
          const task = poll.result;

          if (task?.status === 'succeeded' && task.videoUrl) {
            cleanup();
            setState(prev => ({
              ...prev,
              status: 'succeeded',
              videoUrl: task.videoUrl!,
              progress: 100,
            }));
          } else if (task?.status === 'failed') {
            cleanup();
            setState(prev => ({
              ...prev,
              status: 'failed',
              error: task.error ?? 'Video generation failed',
            }));
          } else {
            // Still running — update synthetic progress
            setState(prev => ({
              ...prev,
              status: task?.status === 'queued' ? 'queued' : 'running',
              progress: computeSyntheticProgress(),
            }));
          }
        } catch {
          // Polling error — don't stop, just log
          console.warn('[useVideoGeneration] Poll error, retrying...');
        }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }, [cleanup, computeSyntheticProgress, mock]);

  return {
    ...state,
    startGeneration,
  };
}
