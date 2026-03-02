import { streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { buildLearnSystemPrompt, type LearnPromptVars } from '@/lib/ai/prompts/tong-learn';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Streaming lesson API — drives the learn chat via tool calls.
 *
 * Tools:
 *   teach_concept   → TeachingCard with jamo/vocab grid
 *   show_exercise   → ExerciseModal with type + hints
 *   offer_choices   → MenuChoices for topic selection
 *   give_feedback   → FeedbackBubble (correct/incorrect)
 *   wrap_up         → SessionSummary with stats
 */

const lessonTools = {
  teach_concept: tool({
    description: 'Teach vocabulary or jamo to the player. Shows a card with items they can tap to hear pronunciation.',
    parameters: z.object({
      message: z.string().describe('Teaching explanation (1-2 sentences)'),
      korean: z.string().nullable().describe('Space-separated Korean characters/words to display, or null'),
      translation: z.string().nullable().describe('Space-separated romanizations/meanings matching korean items, or null'),
    }),
    execute: async (args) => args,
  }),
  show_exercise: tool({
    description: 'Show an interactive exercise. After calling this, STOP and wait for the player result. PREFERRED: provide exerciseData with the complete exercise object for contextual, adaptive exercises. FALLBACK: set exerciseData to null and the client generates locally from hints.',
    parameters: z.object({
      exerciseType: z.enum([
        'matching', 'multiple_choice', 'drag_drop',
        'sentence_builder', 'fill_blank', 'pronunciation_select',
        'pattern_recognition', 'stroke_tracing', 'error_correction', 'free_input',
      ]).describe('Exercise UI type'),
      objectiveId: z.string().describe('Learning objective this tests'),
      exerciseData: z.string().nullable().describe('JSON-encoded complete exercise object. When provided, client parses and uses it directly. When null, client generates locally from hints. ID convention: "ai-{type}-{timestamp}".'),
      hintItems: z.array(z.string()).nullable().describe('Specific Korean chars/words to include in the exercise, or null'),
      hintCount: z.number().nullable().describe('How many items the exercise should contain, or null for default'),
      hintSubType: z.enum(['sound_quiz', 'visual_recognition']).nullable().describe('Exercise flavor for script exercises, or null'),
    }),
    execute: async (args) => args,
  }),
  offer_choices: tool({
    description: 'Present topic choices for the player. After calling this, STOP and wait for their choice.',
    parameters: z.object({
      prompt: z.string().describe('Question for the player'),
      choices: z.array(z.object({
        id: z.string(),
        text: z.string(),
      })).describe('Available choices'),
    }),
    execute: async (args) => args,
  }),
  give_feedback: tool({
    description: 'Give feedback on an exercise result.',
    parameters: z.object({
      positive: z.boolean().describe('True if the player got it right'),
      message: z.string().describe('Brief feedback message (1-2 sentences)'),
      detail: z.string().nullable().describe('Optional explanation or hint, or null'),
    }),
    execute: async (args) => args,
  }),
  wrap_up: tool({
    description: 'End the learning session with a summary.',
    parameters: z.object({
      summary: z.string().describe('Brief session recap'),
      xpEarned: z.number().describe('Total XP earned (base 30 + 10 per correct exercise)'),
      learnedItems: z.array(z.object({
        char: z.string(),
        romanization: z.string().nullable(),
      })).describe('Items learned in this session'),
    }),
    execute: async (args) => args,
  }),
};

/**
 * Deep-resolve any tool invocations still in 'call' state.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveUnresolvedTools(messages: any[]): any[] {
  let resolved = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function deepResolve(obj: any): any {
    if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(deepResolve);
    if (obj.state === 'call' && obj.toolCallId && obj.toolName) {
      resolved++;
      return { ...obj, state: 'result', result: obj.result ?? obj.args ?? {} };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      result[key] = deepResolve(val);
    }
    return result;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = messages.map((msg: any) => msg.role !== 'assistant' ? msg : deepResolve(msg));
  if (resolved > 0) {
    console.log(`[lesson] Auto-resolved ${resolved} unresolved tool invocations`);
  }
  return result;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (e) {
    console.error('[lesson] Failed to parse request body:', e);
    return new Response('Invalid JSON', { status: 400 });
  }

  const rawMessages = body.messages ?? [];
  const messages = resolveUnresolvedTools(rawMessages as Record<string, unknown>[]);

  // Parse context from latest user message
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
  const contextStr = (typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '') as string;

  let promptVars: LearnPromptVars | null = null;

  try {
    const ctxMatch = contextStr.match(/\[LEARN_CONTEXT\]([\s\S]*?)\[\/LEARN_CONTEXT\]/);
    if (ctxMatch) {
      const ctx = JSON.parse(ctxMatch[1]);
      promptVars = {
        playerLevel: ctx.playerLevel ?? 0,
        selfAssessedLevel: ctx.selfAssessedLevel ?? null,
        calibratedLevel: ctx.calibratedLevel ?? null,
        mastery: ctx.mastery ?? {
          script: { learned: [], total: 24 },
          pronunciation: { accuracy: 0, weakSounds: [] },
          vocabulary: { strong: [], weak: [], total: 45, mastered: 0 },
          grammar: { mastered: [], learning: [], notStarted: ['N+주세요', '을/를', 'N+개'] },
        },
        objectives: ctx.objectives ?? [],
        cityId: ctx.cityId ?? 'seoul',
        locationId: ctx.locationId ?? 'food_street',
        sessionExercisesCompleted: ctx.sessionExercisesCompleted ?? 0,
        sessionExercisesCorrect: ctx.sessionExercisesCorrect ?? 0,
      };
    }
  } catch { /* ignore parse errors */ }

  const hasApiKey = !!process.env.OPENAI_API_KEY;

  if (!hasApiKey) {
    return buildFallbackResponse(messages);
  }

  const defaultVars: LearnPromptVars = promptVars ?? {
    playerLevel: 0,
    selfAssessedLevel: null,
    calibratedLevel: null,
    mastery: {
      script: { learned: [], total: 24 },
      pronunciation: { accuracy: 0, weakSounds: [] },
      vocabulary: { strong: [], weak: [], total: 45, mastered: 0 },
      grammar: { mastered: [], learning: [], notStarted: ['N+주세요', '을/를', 'N+개'] },
    },
    objectives: [],
    cityId: 'seoul',
    locationId: 'food_street',
    sessionExercisesCompleted: 0,
    sessionExercisesCorrect: 0,
  };

  const systemPrompt = buildLearnSystemPrompt(defaultVars);
  const modelId = process.env.OPENAI_MODEL ?? 'gpt-5.2';

  console.log('[lesson] AI mode — model:', modelId, 'messages:', messages.length);

  try {
    const result = streamText({
      model: openai(modelId),
      system: systemPrompt,
      messages,
      tools: lessonTools,
      maxSteps: 2,
      temperature: 0.7,
      onError: (error) => {
        console.error('[lesson] Stream error:', error);
      },
      onStepFinish: ({ toolCalls, text }) => {
        if (text) console.log('[lesson] Step text:', text.slice(0, 200));
        if (toolCalls?.length) {
          for (const tc of toolCalls) {
            console.log(`[lesson] Tool: ${tc.toolName}`, JSON.stringify(tc.args).slice(0, 300));
          }
        }
      },
    });
    return result.toDataStreamResponse();
  } catch (err) {
    console.error('[lesson] AI error, falling back:', err);
    return buildFallbackResponse(messages);
  }
}

/**
 * Fallback when no API key is available.
 * Scripted 3-exercise session: teach → exercise → feedback → teach → exercise → feedback → teach → exercise → feedback → wrap up.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFallbackResponse(messages: any[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMsgs = messages.filter((m: any) => m.role === 'user');
  const lastContent = typeof userMsgs[userMsgs.length - 1]?.content === 'string'
    ? userMsgs[userMsgs.length - 1].content : '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exerciseCount = userMsgs.filter((m: any) => {
    const c = typeof m.content === 'string' ? m.content : '';
    return c.includes('Exercise result:');
  }).length;
  const lastWasCorrect = lastContent.includes('Exercise result:')
    && lastContent.includes('correct')
    && !lastContent.includes('incorrect');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const correctCount = userMsgs.filter((m: any) => {
    const c = typeof m.content === 'string' ? m.content : '';
    return c.includes('Exercise result:') && c.includes('correct') && !c.includes('incorrect');
  }).length;

  console.log(`[lesson] Fallback turn: userMsgs=${userMsgs.length}, exerciseCount=${exerciseCount}`);

  const toolCalls: Array<{ toolName: string; args: Record<string, unknown>; pauses?: boolean }> = [];

  if (userMsgs.length <= 1) {
    // ── TURN 1: Greeting + teach jamo ──
    toolCalls.push({
      toolName: 'teach_concept',
      args: {
        message: "Hi! I'm Tong, your Korean learning buddy! Let's start with some basic Korean consonants. Tap each one to hear how it sounds!",
        korean: 'ㄱ ㄴ ㄷ ㄹ ㅁ',
        translation: 'g n d r/l m',
      },
    });
    toolCalls.push({
      toolName: 'show_exercise',
      args: {
        exerciseType: 'matching',
        objectiveId: 'ko-script-consonants',
        exerciseData: null,
        hintItems: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ'],
        hintCount: 5,
        hintSubType: 'sound_quiz',
      },
      pauses: true,
    });
  } else if (exerciseCount === 1) {
    // ── TURN 2: Feedback + teach vowels + exercise ──
    toolCalls.push({
      toolName: 'give_feedback',
      args: {
        positive: lastWasCorrect,
        message: lastWasCorrect
          ? 'Great job! You matched them all correctly!'
          : "Don't worry, consonants take practice. Let's keep going!",
        detail: null,
      },
    });
    toolCalls.push({
      toolName: 'teach_concept',
      args: {
        message: "Now let's learn some vowels! Korean vowels are based on simple shapes.",
        korean: 'ㅏ ㅓ ㅗ ㅜ ㅡ ㅣ',
        translation: 'a eo o u eu i',
      },
    });
    toolCalls.push({
      toolName: 'show_exercise',
      args: {
        exerciseType: 'pronunciation_select',
        objectiveId: 'ko-script-vowels',
        exerciseData: null,
        hintItems: ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ'],
        hintCount: 4,
        hintSubType: null,
      },
      pauses: true,
    });
  } else if (exerciseCount === 2) {
    // ── TURN 3: Feedback + teach food words + exercise ──
    toolCalls.push({
      toolName: 'give_feedback',
      args: {
        positive: lastWasCorrect,
        message: lastWasCorrect
          ? 'Perfect! You have a great ear for Korean sounds!'
          : "Korean vowels can be tricky. You'll get better with practice!",
        detail: null,
      },
    });
    toolCalls.push({
      toolName: 'teach_concept',
      args: {
        message: "Now let's learn some food words you'll see at a 포장마차 (street food stall)!",
        korean: '떡볶이 김밥 라면 순대',
        translation: 'tteokbokki gimbap ramyeon sundae',
      },
    });
    toolCalls.push({
      toolName: 'show_exercise',
      args: {
        exerciseType: 'multiple_choice',
        objectiveId: 'ko-vocab-food-items',
        exerciseData: null,
        hintItems: ['떡볶이', '김밥', '라면', '순대'],
        hintCount: 4,
        hintSubType: null,
      },
      pauses: true,
    });
  } else {
    // ── TURN 4+: Feedback + wrap up ──
    const xpEarned = 30 + correctCount * 10;
    toolCalls.push({
      toolName: 'give_feedback',
      args: {
        positive: lastWasCorrect,
        message: lastWasCorrect
          ? "Awesome! You're doing great!"
          : "Good effort! Review the ones you missed.",
        detail: null,
      },
    });
    toolCalls.push({
      toolName: 'wrap_up',
      args: {
        summary: `Great session! You practiced ${exerciseCount} exercises and got ${correctCount} correct. Keep up the great work!`,
        xpEarned,
        learnedItems: [
          { char: 'ㄱ', romanization: 'g' },
          { char: 'ㄴ', romanization: 'n' },
          { char: 'ㄷ', romanization: 'd' },
          { char: 'ㅏ', romanization: 'a' },
          { char: 'ㅓ', romanization: 'eo' },
          { char: '떡볶이', romanization: 'tteokbokki' },
          { char: '김밥', romanization: 'gimbap' },
        ],
      },
    });
  }

  // Build AI SDK data stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (let i = 0; i < toolCalls.length; i++) {
        const tc = toolCalls[i];
        const toolCallId = `fallback-${Date.now()}-${i}`;

        const toolCallData = JSON.stringify({
          toolCallId,
          toolName: tc.toolName,
          args: tc.args,
        });
        controller.enqueue(encoder.encode(`9:${toolCallData}\n`));

        if (!tc.pauses) {
          const toolResultData = JSON.stringify({
            toolCallId,
            result: tc.args,
          });
          controller.enqueue(encoder.encode(`a:${toolResultData}\n`));
        }
      }

      const finishData = JSON.stringify({
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0 },
      });
      controller.enqueue(encoder.encode(`d:${finishData}\n`));

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Vercel-AI-Data-Stream': 'v1',
    },
  });
}
