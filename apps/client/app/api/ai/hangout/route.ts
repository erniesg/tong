import { streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Streaming hangout API — drives the VN scene via tool calls.
 *
 * Tools:
 *   npc_speak      → DialogueBox with NPC sprite
 *   tong_whisper   → TongOverlay tip
 *   show_exercise  → ExerciseRenderer inline
 *   offer_choices  → ChoiceButtons
 *   end_scene      → summary + XP/SP awards
 */

const hangoutTools = {
  npc_speak: tool({
    description: 'The NPC says something to the player. Use for all NPC dialogue.',
    parameters: z.object({
      characterId: z.string().describe('The NPC character ID (e.g., hauen, jin)'),
      text: z.string().describe('The dialogue text (mix of Korean + English)'),
      translation: z.string().nullable().describe('English translation of Korean parts, or null'),
      expression: z.enum([
        'neutral', 'happy', 'surprised', 'thinking', 'embarrassed', 'sad', 'angry', 'flirty',
      ]).nullable().describe('NPC facial expression'),
      affinityDelta: z.number().nullable().describe('Affinity change -3 to +5, or null'),
    }),
    execute: async (args) => args,
  }),
  tong_whisper: tool({
    description: 'Tong gives the player a tip or encouragement. Brief, 1-2 sentences.',
    parameters: z.object({
      message: z.string().describe('The tip message'),
      translation: z.string().nullable().describe('Translation if message contains Korean, or null'),
    }),
    execute: async (args) => args,
  }),
  show_exercise: tool({
    description: 'Show an interactive exercise. After calling this, STOP and wait for the player result.',
    parameters: z.object({
      exerciseType: z.enum(['drag_drop', 'matching', 'multiple_choice']).describe('Exercise UI type'),
      objectiveId: z.string().describe('Learning objective this tests'),
      context: z.string().nullable().describe('Scene context for exercise prompt, or null'),
    }),
    execute: async (args) => args,
  }),
  offer_choices: tool({
    description: 'Present dialogue choices. After calling this, STOP and wait for player choice.',
    parameters: z.object({
      prompt: z.string().describe('The question/prompt for the player'),
      choices: z.array(z.object({ id: z.string(), text: z.string() })).describe('Options'),
    }),
    execute: async (args) => args,
  }),
  end_scene: tool({
    description: 'End the hangout scene.',
    parameters: z.object({
      summary: z.string().describe('Brief recap'),
      xpEarned: z.number().describe('Total XP earned'),
      affinityChanges: z.array(z.object({
        characterId: z.string(),
        delta: z.number(),
      })).describe('Affinity changes per character'),
      calibratedLevel: z.number().nullable().describe('Assessed player level, or null'),
    }),
    execute: async (args) => args,
  }),
};

/**
 * Deep-resolve any tool invocations still in 'call' state.
 * Prevents AI_MessageConversionError when client sends stale messages.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveUnresolvedTools(messages: any[]): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function deepResolve(obj: any): any {
    if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(deepResolve);
    if (obj.state === 'call' && obj.toolCallId && obj.toolName) {
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
  return messages.map((msg: any) => msg.role !== 'assistant' ? msg : deepResolve(msg));
}

export async function POST(req: Request) {
  const body = await req.json();
  const messages = resolveUnresolvedTools(body.messages ?? []);

  const hasApiKey = !!process.env.OPENAI_API_KEY;

  if (!hasApiKey) {
    return buildFallbackResponse(messages);
  }

  try {
    const modelId = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    console.log('[hangout] AI mode — model:', modelId, 'key prefix:', process.env.OPENAI_API_KEY?.slice(0, 12));
    const result = streamText({
      model: openai(modelId),
      system: `You are running a visual-novel-style Korean language hangout scene at a pojangmacha (street food tent) in Seoul. You have two NPC characters available: "haeun" (Ha-eun, competitive but secretly nice, color #e8485c) and "jin" (Jin, friendly senior trainee, color #4a90d9). Use the tools to drive the scene: npc_speak for dialogue, tong_whisper for learning tips, show_exercise for exercises, and end_scene to wrap up. Keep Korean at beginner level. Always end the scene after 2-3 exercises.`,
      messages,
      tools: hangoutTools,
      maxSteps: 2,
      temperature: 0.8,
    });
    return result.toDataStreamResponse();
  } catch (err) {
    console.error('[hangout] AI error, falling back:', err);
    return buildFallbackResponse(messages);
  }
}

/**
 * Fallback when no API key is available.
 * Turn-aware: examines conversation history to determine which turn we're on.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFallbackResponse(messages: any[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMsgs = messages.filter((m: any) => m.role === 'user');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const characterId = 'hauen';
  const toolCalls: Array<{ toolName: string; args: Record<string, unknown>; pauses?: boolean }> = [];

  if (userMsgs.length <= 1) {
    // ── TURN 1: Introduction ──
    toolCalls.push({
      toolName: 'npc_speak',
      args: {
        characterId,
        text: "Oh... you're the new trainee? Do you even speak any Korean?",
        translation: null,
        expression: 'neutral',
        affinityDelta: 1,
      },
    });
    toolCalls.push({
      toolName: 'tong_whisper',
      args: {
        message: "That's Ha-eun — she's competitive but secretly nice. She's testing you!",
        translation: null,
      },
    });

  } else if (exerciseCount === 0) {
    // ── TURN 2: First exercise ──
    toolCalls.push({
      toolName: 'npc_speak',
      args: {
        characterId,
        text: "Let's see if you can even read the menu. Match these Korean food words.",
        translation: null,
        expression: 'thinking',
        affinityDelta: 0,
      },
    });
    toolCalls.push({
      toolName: 'show_exercise',
      args: {
        exerciseType: 'matching',
        objectiveId: 'ko-vocab-food-items',
        context: "Ha-eun points at the menu with a smirk. 'Can you even read that?'",
      },
      pauses: true,
    });

  } else if (exerciseCount === 1) {
    // ── TURN 3: React + second exercise ──
    toolCalls.push({
      toolName: 'npc_speak',
      args: {
        characterId,
        text: lastWasCorrect
          ? "Hmph... not bad for a beginner. Let's see if you can actually order something."
          : "Seriously? That's basic stuff. Let me give you another shot.",
        translation: null,
        expression: lastWasCorrect ? 'thinking' : 'angry',
        affinityDelta: lastWasCorrect ? 2 : 0,
      },
    });
    toolCalls.push({
      toolName: 'tong_whisper',
      args: {
        message: lastWasCorrect
          ? "Now try a multiple choice — 주세요 (juseyo) means 'please give me'!"
          : "Don't worry! 주세요 (juseyo) means 'please give me'. You've got this!",
        translation: null,
      },
    });
    toolCalls.push({
      toolName: 'show_exercise',
      args: {
        exerciseType: 'multiple_choice',
        objectiveId: 'ko-vocab-food-items',
        context: "Ha-eun shoves the menu at you. 'Go on, order something.'",
      },
      pauses: true,
    });

  } else {
    // ── TURN 4+: Wrap up ──
    const allCorrect = correctCount === exerciseCount && exerciseCount > 0;
    const noneCorrect = correctCount === 0;
    const xpEarned = 30 + correctCount * 10;
    const affinityDelta = allCorrect ? 6 : noneCorrect ? 2 : 4;

    toolCalls.push({
      toolName: 'npc_speak',
      args: {
        characterId,
        text: allCorrect
          ? "Oh... better than I expected? Next time I'll make you order something harder."
          : noneCorrect
            ? "Hmm... you need more practice. But at least you tried. Come back tomorrow."
            : "Not terrible, but not great either. You'll need to practice more.",
        translation: null,
        expression: allCorrect ? 'surprised' : noneCorrect ? 'thinking' : 'neutral',
        affinityDelta: allCorrect ? 3 : noneCorrect ? 1 : 2,
      },
    });
    toolCalls.push({
      toolName: 'end_scene',
      args: {
        summary: allCorrect
          ? "You survived Ha-eun's menu challenge! She's tough but you earned her respect."
          : noneCorrect
            ? "Ha-eun's menu challenge was brutal. But she noticed you kept trying."
            : "Ha-eun's challenge was mixed, but she sees potential.",
        xpEarned,
        affinityChanges: [{ characterId, delta: affinityDelta }],
        calibratedLevel: 0,
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

        // Only emit tool result for non-pausing tools
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
