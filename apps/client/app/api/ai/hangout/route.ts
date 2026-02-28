import { streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import {
  buildHangoutOrchestratorPrompt,
  type HangoutOrchestratorVars,
} from '@/lib/ai/prompts/hangout-orchestrator';
import { CHARACTER_MAP, HAUEN } from '@/lib/content/characters';
import { POJANGMACHA } from '@/lib/content/pojangmacha';
import type { Character, RelationshipStage, Relationship } from '@/lib/types/relationship';
import type { MasterySnapshot } from '@/lib/types/mastery';

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
 *   assess_result  → mastery update
 *   end_scene      → summary + XP/SP awards
 */

const hangoutTools = {
  npc_speak: tool({
    description: 'The NPC says something to the player. Use for all NPC dialogue. The NPC is a CHARACTER — never a teacher.',
    parameters: z.object({
      characterId: z.string().describe('The NPC character ID (e.g., hauen, jin)'),
      text: z.string().describe('The dialogue text (mix of Korean + English based on language ratio)'),
      translation: z.string().nullable().describe('English translation of Korean parts, or null'),
      expression: z.enum([
        'neutral', 'happy', 'surprised', 'thinking', 'embarrassed', 'sad', 'angry', 'flirty',
      ]).nullable().describe('NPC facial expression'),
      affinityDelta: z.number().nullable().describe('Affinity change -3 to +5, or null'),
    }),
    execute: async (args) => args,
  }),
  tong_whisper: tool({
    description: 'Tong gives the player a tip, teaching, or encouragement. Tong is the SOLE teacher — all language explanations go through here. Brief, 1-2 sentences.',
    parameters: z.object({
      message: z.string().describe('The tip/teaching message'),
      translation: z.string().nullable().describe('Translation if message contains Korean, or null'),
    }),
    execute: async (args) => args,
  }),
  show_exercise: tool({
    description: 'Show an interactive exercise. After calling this, STOP and wait for the player result.',
    parameters: z.object({
      exerciseType: z.enum([
        'drag_drop', 'matching', 'multiple_choice',
      ]).describe('Exercise UI type'),
      objectiveId: z.string().describe('Learning objective this tests'),
      context: z.string().nullable().describe('Scene context for exercise prompt, or null'),
      hintItems: z.array(z.string()).nullable().describe('Specific characters/words to include in the exercise. The exercise generator will prioritize these items. null if no specific items.'),
      hintCount: z.number().nullable().describe('How many items the exercise should contain. null for default.'),
      hintSubType: z.enum(['sound_quiz', 'visual_recognition']).nullable().describe('Exercise flavor for script exercises. null for default.'),
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
  assess_result: tool({
    description: 'Record assessment of a learning objective after exercises.',
    parameters: z.object({
      objectiveId: z.string().describe('The objective being assessed'),
      score: z.number().describe('Score from 0-100'),
      feedback: z.string().describe('Brief assessment feedback'),
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
    console.log(`[hangout] Auto-resolved ${resolved} unresolved tool invocations`);
  }
  return result;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (e) {
    console.error('[hangout] Failed to parse request body:', e);
    return new Response('Invalid JSON', { status: 400 });
  }
  const rawMessages = body.messages ?? [];
  const messages = resolveUnresolvedTools(rawMessages as Record<string, unknown>[]);

  // Parse context from latest user message
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
  const contextStr = (typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '') as string;

  let hangoutVars: HangoutOrchestratorVars | null = null;
  let characterId = 'hauen';

  try {
    // Try new HANGOUT_CONTEXT format first, fall back to old CONTEXT format
    const hangoutMatch = contextStr.match(/\[HANGOUT_CONTEXT\]([\s\S]*?)\[\/HANGOUT_CONTEXT\]/);
    const legacyMatch = contextStr.match(/\[CONTEXT\]([\s\S]*?)\[\/CONTEXT\]/);
    const ctxMatch = hangoutMatch ?? legacyMatch;

    if (ctxMatch) {
      const ctx = JSON.parse(ctxMatch[1]);
      characterId = ctx.characterId ?? 'hauen';
      const char: Character = CHARACTER_MAP[characterId] ?? HAUEN;
      const stage: RelationshipStage = ctx.stage ?? 'strangers';
      const rel: Relationship = ctx.relationship ?? {
        characterId,
        affinity: 10,
        stage,
        interactionCount: 0,
        lastInteraction: 0,
        storyFlags: {},
        significantMoments: [],
      };
      const mastery: MasterySnapshot = ctx.mastery ?? {
        script: { learned: [], total: 24 },
        pronunciation: { accuracy: 0, weakSounds: [] },
        vocabulary: { strong: [], weak: [], total: 45, mastered: 0 },
        grammar: { mastered: [], learning: [], notStarted: ['N+주세요', '을/를', 'N+개'] },
      };

      const locLevel = ctx.locationLevel ?? ctx.playerLevel ?? 0;
      const effLevel = Math.min(locLevel, POJANGMACHA.levels.length - 1);

      hangoutVars = {
        location: POJANGMACHA,
        playerLevel: ctx.playerLevel ?? 0,
        selfAssessedLevel: ctx.selfAssessedLevel ?? null,
        calibratedLevel: ctx.calibratedLevel ?? null,
        character: char,
        relationship: rel,
        stage,
        mastery,
        objectives: ctx.objectives ?? POJANGMACHA.levels[effLevel]?.objectives ?? [],
        isFirstEncounter: ctx.isFirstEncounter ?? true,
      };
    }
  } catch { /* ignore parse errors */ }

  const hasApiKey = !!process.env.OPENAI_API_KEY;

  if (!hasApiKey) {
    return buildFallbackResponse(characterId, hangoutVars?.isFirstEncounter ?? true, messages);
  }

  // Build system prompt
  const char: Character = CHARACTER_MAP[characterId] ?? HAUEN;
  const defaultVars: HangoutOrchestratorVars = hangoutVars ?? {
    location: POJANGMACHA,
    playerLevel: 0,
    selfAssessedLevel: 0,
    calibratedLevel: null,
    character: char,
    relationship: {
      characterId,
      affinity: 10,
      stage: 'strangers',
      interactionCount: 0,
      lastInteraction: 0,
      storyFlags: {},
      significantMoments: [],
    },
    stage: 'strangers',
    mastery: {
      script: { learned: [], total: 24 },
      pronunciation: { accuracy: 0, weakSounds: [] },
      vocabulary: { strong: [], weak: [], total: 45, mastered: 0 },
      grammar: { mastered: [], learning: [], notStarted: ['N+주세요', '을/를', 'N+개'] },
    },
    objectives: POJANGMACHA.levels[0]?.objectives ?? [],
    isFirstEncounter: true,
  };

  const systemPrompt = buildHangoutOrchestratorPrompt(defaultVars);
  const modelId = process.env.OPENAI_MODEL ?? 'gpt-5.2';

  console.log('[hangout] AI mode — model:', modelId, 'messages:', messages.length);
  console.log('[hangout] System prompt length:', systemPrompt.length);
  for (const msg of messages) {
    const preview = typeof msg.content === 'string'
      ? msg.content.slice(0, 120)
      : JSON.stringify(msg.content).slice(0, 120);
    console.log(`[hangout]   ${msg.role}: ${preview}`);
  }

  try {
    const result = streamText({
      model: openai(modelId),
      system: systemPrompt,
      messages,
      tools: hangoutTools,
      maxSteps: 2,
      temperature: 0.8,
      onError: (error) => {
        console.error('[hangout] Stream error:', error);
      },
      onStepFinish: ({ toolCalls, text }) => {
        if (text) console.log('[hangout] Step text:', text.slice(0, 200));
        if (toolCalls?.length) {
          for (const tc of toolCalls) {
            console.log(`[hangout] Tool: ${tc.toolName}`, JSON.stringify(tc.args).slice(0, 300));
          }
        }
      },
    });
    return result.toDataStreamResponse();
  } catch (err) {
    console.error('[hangout] AI error, falling back:', err);
    return buildFallbackResponse(characterId, hangoutVars?.isFirstEncounter ?? true, messages);
  }
}

/**
 * Fallback when no API key is available.
 * Turn-aware: examines conversation history to determine which turn we're on.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFallbackResponse(characterId: string, isFirstEncounter: boolean, messages: any[]) {
  const isHauen = characterId === 'hauen';

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

  console.log(`[hangout] Fallback turn: userMsgs=${userMsgs.length}, exerciseCount=${exerciseCount}`);

  const toolCalls: Array<{ toolName: string; args: Record<string, unknown>; pauses?: boolean }> = [];

  if (userMsgs.length <= 1) {
    // ── TURN 1: Introduction ──
    toolCalls.push({
      toolName: 'npc_speak',
      args: {
        characterId,
        text: isHauen
          ? "Oh... you're the new trainee? Do you even speak any Korean?"
          : "Hey! You're the new trainee, right? Welcome to the 포장마차!",
        translation: isHauen ? null : '포장마차 = pojangmacha (street food stall)',
        expression: isHauen ? 'neutral' : 'happy',
        affinityDelta: 1,
      },
    });
    toolCalls.push({
      toolName: 'tong_whisper',
      args: {
        message: isHauen
          ? "That's Ha-eun — she's competitive but secretly nice. She's testing you!"
          : "That's Jin — a senior trainee, super friendly. He wants to help you settle in!",
        translation: null,
      },
    });

  } else if (exerciseCount === 0) {
    // ── TURN 2: Tong teaches + first exercise ──
    toolCalls.push({
      toolName: 'npc_speak',
      args: {
        characterId,
        text: isHauen
          ? "Let's see what you've got. Can you even read the menu?"
          : "Let me show you the menu! It's the best 포장마차 in Hongdae.",
        translation: null,
        expression: isHauen ? 'thinking' : 'happy',
        affinityDelta: 0,
      },
    });
    toolCalls.push({
      toolName: 'tong_whisper',
      args: {
        message: "Let's learn some food words! 떡볶이 (tteokbokki) = spicy rice cakes, 김밥 (gimbap) = seaweed rice roll, 라면 (ramyeon) = ramen noodles, 순대 (sundae) = blood sausage.",
        translation: null,
      },
    });
    toolCalls.push({
      toolName: 'show_exercise',
      args: {
        exerciseType: 'matching',
        objectiveId: 'ko-vocab-food-items',
        context: isHauen
          ? "Ha-eun points at the menu with a smirk."
          : "Jin points at the menu board warmly.",
        hintItems: ['떡볶이', '김밥', '라면', '순대'],
        hintCount: 4,
        hintSubType: null,
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
          ? (isHauen
            ? "Hmph... not bad for a beginner."
            : "Nice job! You're picking this up fast.")
          : (isHauen
            ? "Seriously? Let me give you another shot."
            : "No worries! Let's try again."),
        translation: null,
        expression: lastWasCorrect
          ? (isHauen ? 'thinking' : 'happy')
          : (isHauen ? 'angry' : 'thinking'),
        affinityDelta: lastWasCorrect ? 2 : 0,
      },
    });
    toolCalls.push({
      toolName: 'tong_whisper',
      args: {
        message: lastWasCorrect
          ? "Now let's try 오뎅 (odeng) = fish cake, 튀김 (twigim) = fried snacks, 만두 (mandu) = dumplings, 물 (mul) = water!"
          : "Let's review! 떡볶이 = spicy rice cakes, 김밥 = seaweed rice roll. You've got this!",
        translation: null,
      },
    });
    toolCalls.push({
      toolName: 'show_exercise',
      args: {
        exerciseType: 'multiple_choice',
        objectiveId: 'ko-vocab-food-items',
        context: isHauen
          ? "Ha-eun raises an eyebrow."
          : "Jin nods encouragingly.",
        hintItems: lastWasCorrect
          ? ['오뎅', '튀김', '만두', '물']
          : ['떡볶이', '김밥', '라면', '순대'],
        hintCount: 4,
        hintSubType: null,
      },
      pauses: true,
    });

  } else if (exerciseCount === 2) {
    // ── TURN 4: React + third exercise ──
    toolCalls.push({
      toolName: 'npc_speak',
      args: {
        characterId,
        text: lastWasCorrect
          ? (isHauen ? "Okay, one more." : "Great! Let's try one more.")
          : (isHauen ? "Come on, focus." : "Almost! One more try."),
        translation: null,
        expression: lastWasCorrect ? 'neutral' : 'thinking',
        affinityDelta: lastWasCorrect ? 1 : 0,
      },
    });
    toolCalls.push({
      toolName: 'tong_whisper',
      args: {
        message: "Now drag the Korean words to their meanings! 소주 = soju, 김치 = kimchi, 호떡 = sweet pancake, 비빔밥 = mixed rice.",
        translation: null,
      },
    });
    toolCalls.push({
      toolName: 'show_exercise',
      args: {
        exerciseType: 'drag_drop',
        objectiveId: 'ko-vocab-food-items',
        context: isHauen ? "Ha-eun watches closely." : "Jin smiles.",
        hintItems: ['소주', '김치', '호떡', '비빔밥'],
        hintCount: 4,
        hintSubType: null,
      },
      pauses: true,
    });

  } else {
    // ── TURN 5+: Wrap up ──
    const allCorrect = correctCount === exerciseCount && exerciseCount > 0;
    const noneCorrect = correctCount === 0;
    const xpEarned = 30 + correctCount * 10;
    const affinityDelta = allCorrect ? 6 : noneCorrect ? 2 : 4;
    const assessScore = exerciseCount > 0 ? Math.round((correctCount / exerciseCount) * 100) : 50;

    toolCalls.push({
      toolName: 'npc_speak',
      args: {
        characterId,
        text: allCorrect
          ? (isHauen
            ? "Oh... better than I expected? Next time I'll really test you. Don't be late."
            : "Wow, you're actually pretty good! Come back anytime!")
          : noneCorrect
            ? (isHauen
              ? "Hmm... you need more practice. But at least you tried."
              : "Hey, don't worry! Everyone struggles at first. Come back and we'll try again!")
            : (isHauen
              ? "Not terrible, but not great either. 야, 연습 더 해."
              : "Good effort! A bit more practice and you'll nail it."),
        translation: null,
        expression: allCorrect
          ? (isHauen ? 'surprised' : 'happy')
          : noneCorrect
            ? (isHauen ? 'thinking' : 'sad')
            : (isHauen ? 'neutral' : 'thinking'),
        affinityDelta: allCorrect ? 3 : noneCorrect ? 1 : 2,
      },
    });
    toolCalls.push({
      toolName: 'tong_whisper',
      args: {
        message: allCorrect
          ? "Amazing work! You practiced 떡볶이, 김밥, 라면, 순대, and more today. Keep it up!"
          : "Good session! You worked on food vocabulary today. Practice the words you missed!",
        translation: null,
      },
    });
    if (isFirstEncounter) {
      toolCalls.push({
        toolName: 'assess_result',
        args: {
          objectiveId: 'ko-vocab-food-items',
          score: assessScore,
          feedback: allCorrect
            ? 'Great start with food vocabulary!'
            : noneCorrect
              ? 'Needs more practice with food vocabulary basics.'
              : 'Making progress with food vocabulary.',
        },
      });
    }
    toolCalls.push({
      toolName: 'end_scene',
      args: {
        summary: allCorrect
          ? (isHauen
            ? "You survived Ha-eun's menu challenge! She's tough but you earned her respect."
            : "Great first meal with Jin! You nailed the exercises and made a friend.")
          : noneCorrect
            ? (isHauen
              ? "Ha-eun's menu challenge was brutal. But she noticed you kept trying."
              : "The exercises were tough, but Jin says not to worry.")
            : (isHauen
              ? "Ha-eun's challenge was mixed, but she sees potential."
              : "A solid start with Jin! You're on the right track."),
        xpEarned,
        affinityChanges: [{ characterId, delta: affinityDelta }],
        calibratedLevel: isFirstEncounter ? 0 : null,
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
