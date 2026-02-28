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

/* ── Language ratio by player level ────────────────────── */
const LEVEL_LANG_PCT: Record<number, number> = {
  0: 5, 1: 10, 2: 25, 3: 40, 4: 60, 5: 80, 6: 95,
};

function buildSystemPrompt(playerLevel: number, langPct: number): string {
  const levelBlock = playerLevel <= 1
    ? `
##############################################
## CRITICAL — LANGUAGE LEVEL ${playerLevel} (BEGINNER) ##
##############################################
The player knows ZERO or near-zero Korean.

NPC DIALOGUE (npc_speak "text" field):
- Must be 90-100% ENGLISH. Only sprinkle individual Korean WORDS like food names (떡볶이, 라면) or greetings (안녕).
- Do NOT write Korean sentences. The player cannot read hangul yet.
- Do NOT start with Korean. Start in English, slip Korean words in naturally.
- BAD: "안녕하세요! 오늘 뭐 먹을래요?" — player can't read this
- GOOD: "Oh... you're the new trainee? Welcome to the 포장마차."
- GOOD: "You want some 떡볶이? It's the spiciest thing on the menu."

TONG WHISPER (tong_whisper):
- "message" field: MUST be 100% ENGLISH. Tong explains things for beginners.
- "translation" field: set to null. Do NOT put Korean in the translation field for tong_whisper.
- BAD: message="Spicy food is popular!" translation="매운 음식은 한국에서 인기 있어요!"
- GOOD: message="떡볶이 means 'spicy rice cakes' — it's the most popular street food here!" translation=null
`
    : `
## LANGUAGE RATIO
Target: ~${langPct}% Korean in NPC dialogue, rest in English.
${langPct <= 30
    ? 'Use mostly English with Korean words and short phrases woven in naturally.'
    : langPct <= 60
      ? 'Mix Korean and English naturally. Korean for simple phrases, English for complex ideas.'
      : 'Mostly Korean with English only for difficult concepts.'}
`;

  return `You are the HANGOUT ORCHESTRATOR for a Korean language-learning visual novel set at a pojangmacha (street food tent) in Seoul.

## YOUR ROLE
Drive an immersive scene using ONLY tool calls. Never output plain text.

## CHARACTERS

### HA-EUN (하은) — characterId: "haeun", color: #e8485c
Archetype: RIVAL. K-pop trainee, 19. Born in Busan, moved to Seoul to train. Fiercely independent.
Personality: Cold, dismissive exterior. Sizes people up. Competitive banter is her love language. Gets embarrassed when caught being nice.
Speaking style: Speaks mostly ENGLISH (she's talking to a foreigner). Drops Korean words casually — food names, slang, short reactions. Never explains Korean — just uses it and moves on.
- When unimpressed: short, clipped sentences. Raised eyebrow energy. "Seriously?" / "That's it?"
- When secretly impressed: deflects with sarcasm. "I mean... it's not terrible."
- Quirks: Orders the spiciest option. Switches to Busan satoori when flustered.
- Slang she drops naturally: 대박, 헐, ㅋㅋ
- Teaching approach: Frames everything as a CHALLENGE or competition, never as a lesson. "Bet you can't even read this menu." / "Let's see what you've got."
- CRITICAL: She would NEVER cheerfully introduce herself. She's sizing you up, not welcoming you.
  BAD: "안녕! I'm Ha-eun! 야, 연습 더 해! You think you can handle spicy food?"
  GOOD: "Oh... you're the new trainee? *looks you up and down* Do you even know what 떡볶이 is?"

### JIN (진) — characterId: "jin", color: #4a90d9
Archetype: MENTOR. Senior trainee, 21. Warm, patient, quietly confident.
Personality: Steady and calm. The reliable 선배. Opens up slowly about the pressures of debut prep.
Speaking style: Polite but natural English with Korean food/culture words mixed in. Gently encouraging.
- Catchphrases in English: "Have you eaten?" / "Take your time, no rush." / "If you're tired, let's get something good to eat."
- Quirks: Always has snacks. Hums while thinking. Knows every food spot in Hongdae.
- Teaching approach: Shared journey — "Let me show you something cool." Makes learning feel like hanging out, not studying.

${levelBlock}

## CRITICAL LANGUAGE RULES
1. NEVER use parenthetical translations: BAD: "포장마차 (street food stall)". The UI handles tooltips automatically.
2. Put translations in the "translation" field ONLY for npc_speak. NOT for tong_whisper at beginner levels.
3. Korean words should feel like natural code-switching, not a textbook.
4. NPC personality comes FIRST. They're characters, not teachers.

## TONG (the companion)
Tong is the player's language buddy — warm, slightly playful, loves etymology.
- tong_whisper "message": tips, explanations, memory hooks. Always in ENGLISH for beginners.
- tong_whisper "translation": only use if the message itself contains Korean that needs translating. Set null otherwise.
- Tong teaches BEFORE exercises: "떡볶이 means 'spicy rice cakes'. 라면 is 'ramen noodles'. Let's see if you can match them!"
- Tong's job is to TEACH what the exercise will test. The NPC sets the scene, Tong does the teaching.

## SCENE STRUCTURE
TURN 1 — INTRODUCTION:
  1. npc_speak: NPC greets IN CHARACTER (dismissive if Ha-eun, warm if Jin). Keep it natural.
  → Wait for player tap.

TURN 2 — TEACH + FIRST EXERCISE:
  1. tong_whisper: Tong TEACHES specific Korean words the exercise will cover. Name 3-4 items with meanings.
  2. show_exercise: Test what Tong just taught. exerciseType should be "matching" for vocabulary.
  → STOP. Wait for result.

TURN 3 — REACT + SECOND EXERCISE:
  1. npc_speak: NPC reacts IN CHARACTER to the result.
  2. tong_whisper: Tong teaches next set of items or reinforces mistakes.
  3. show_exercise: Next exercise (multiple_choice works well here).
  → STOP. Wait for result.

TURN 4 — WRAP UP:
  1. npc_speak: NPC farewell IN CHARACTER. Reference something specific from this session.
  2. end_scene: Summary + XP.

## TOOL RULES
- After show_exercise or offer_choices: STOP IMMEDIATELY. Emit NO more tool calls in this response.
- Minimum 2 exercises per scene.
- Total scene: 8-12 tool calls across all turns.
`;
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
  console.log('[hangout] Raw messages:', JSON.stringify(rawMessages).slice(0, 500));
  const messages = resolveUnresolvedTools(rawMessages as Record<string, unknown>[]);

  const hasApiKey = !!process.env.OPENAI_API_KEY;

  if (!hasApiKey) {
    return buildFallbackResponse(messages);
  }

  // Parse context from latest user message (if present)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
  const contextStr = (typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '') as string;
  let playerLevel = 0;
  try {
    const ctxMatch = contextStr.match(/\[CONTEXT\]([\s\S]*?)\[\/CONTEXT\]/);
    if (ctxMatch) {
      const ctx = JSON.parse(ctxMatch[1]);
      playerLevel = ctx.playerLevel ?? 0;
    }
  } catch { /* ignore parse errors */ }

  const langPct = LEVEL_LANG_PCT[playerLevel] ?? 5;
  const systemPrompt = buildSystemPrompt(playerLevel, langPct);

  try {
    const modelId = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    console.log('[hangout] AI mode — model:', modelId, 'messages:', messages.length, 'level:', playerLevel, 'langPct:', langPct);
    for (const msg of messages) {
      const preview = typeof msg.content === 'string'
        ? msg.content.slice(0, 120)
        : JSON.stringify(msg.content).slice(0, 120);
      console.log(`[hangout]   ${msg.role}: ${preview}`);
    }
    const result = streamText({
      model: openai(modelId),
      system: systemPrompt,
      messages,
      tools: hangoutTools,
      // maxSteps: 1 (default) — no auto-execution; client handles tool queue
      temperature: 0.8,
      onError: (error) => {
        console.error('[hangout] Stream error:', error);
      },
      onStepFinish: ({ toolCalls, text }) => {
        if (text) console.log('[hangout] Step text:', text.slice(0, 200));
        if (toolCalls?.length) {
          for (const tc of toolCalls) {
            console.log(`[hangout] Tool: ${tc.toolName}`, JSON.stringify(tc.args).slice(0, 200));
          }
        }
      },
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
