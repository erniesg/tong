import { createDataStreamResponse, formatDataStreamPart, streamText, tool, type DataStreamWriter } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import {
  buildHangoutOrchestratorPrompt,
  type HangoutOrchestratorVars,
} from '@/lib/ai/prompts/hangout-orchestrator';
import {
  buildIntroductionHangoutPrompt,
  type IntroductionHangoutVars,
} from '@/lib/ai/prompts/introduction-hangout';
import { buildShanghaiOnboardingH1Prompt } from '@/lib/ai/prompts/shanghai-onboarding-h1';
import { CHARACTER_MAP, HAEUN, TUTORIAL_VIDEO_CONFIG } from '@/lib/content/characters';
import { POJANGMACHA } from '@/lib/content/pojangmacha';
import { runtimeAssetUrl } from '@/lib/runtime-assets';
import { getShanghaiFixture } from '@/lib/content/shanghai/fixtures';
import { buildFixtureResolutionEvents, runFixture, type HangoutEvent } from '@/lib/hangout/fixture-runtime';
import { validateLine } from '@/lib/ai/validators/voice-rules';
import type { SceneFixture } from '@/lib/hangout/fixture-types';
import type { Character, RelationshipStage, Relationship } from '@/lib/types/relationship';
import type { MasterySnapshot } from '@/lib/types/mastery';

export const runtime = 'nodejs';
export const maxDuration = 60;

const webtoonBubbleGateSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('free') }),
  z.object({ kind: z.literal('credits'), cost: z.number() }),
  z.object({ kind: z.literal('gamePass') }),
]);

const webtoonBubbleLayoutSchema = z.object({
  outside: z.boolean().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  offsetXPx: z.number().optional(),
  offsetYPx: z.number().optional(),
  tailOffsetPct: z.number().optional(),
  outsideOverlapPx: z.number().optional(),
  reserveSpacePx: z.number().optional(),
  maxWidth: z.string().optional(),
});

const webtoonBubbleSchema = z.object({
  zh: z.string(),
  py: z.array(z.string()).optional(),
  en: z.string().optional(),
  speaker: z.string(),
  position: z.enum(['top', 'bottom', 'center-bottom']),
  layout: webtoonBubbleLayoutSchema.optional(),
  gate: webtoonBubbleGateSchema.optional(),
});

const webtoonGapSchema = z.object({
  px: z.number(),
  color: z.string().optional(),
  gradient: z.tuple([z.string(), z.string()]).optional(),
  dark: z.object({
    color: z.string().optional(),
    gradient: z.tuple([z.string(), z.string()]).optional(),
  }).optional(),
});

const webtoonPanelFrameSchema = z.object({
  edges: z.enum(['all', 'top-bottom']),
  color: z.string().optional(),
  widthPx: z.number().optional(),
  dark: z.object({
    color: z.string().optional(),
  }).optional(),
});

const webtoonPanelLayoutSchema = z.object({
  align: z.enum(['left', 'center', 'right']).optional(),
  liftPx: z.number().optional(),
  widthPct: z.number().optional(),
  flipX: z.boolean().optional(),
  cropAspectRatio: z.string().optional(),
  cropPosition: z.string().optional(),
  backdropColor: z.string().optional(),
  darkBackdropColor: z.string().optional(),
});

const webtoonPanelSchema = z.object({
  id: z.string(),
  imageUrl: z.string(),
  widthType: z.enum(['full-bleed', 'full-width', 'inset']),
  heightClass: z.enum(['short', 'standard', 'tall', 'ultra-tall']),
  aspectRatio: z.string(),
  shotType: z.string(),
  gapBefore: webtoonGapSchema,
  frame: webtoonPanelFrameSchema.optional(),
  layout: webtoonPanelLayoutSchema.optional(),
  isThumbStop: z.boolean().optional(),
  bubble: webtoonBubbleSchema.optional(),
  transition: z.enum(['fade', 'cut', 'darken']),
});

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
      characterId: z.string().describe('The NPC character ID (e.g., haeun, jin)'),
      text: z.string().describe('The dialogue text (mix of Korean + English based on language ratio). Any Korean/CJK term must stay in native script, never bare romanization.'),
      translation: z.string().nullable().describe('Separate translation UI text for Korean parts, or null. Do not repeat romanization inline in text.'),
      expression: z.enum([
        'neutral', 'happy', 'surprised', 'thinking', 'embarrassed', 'sad', 'angry', 'flirty',
      ]).nullable().describe('NPC facial expression'),
      affinityDelta: z.number().nullable().describe('Affinity change -3 to +5, or null'),
    }),
    execute: async (args) => {
      const validation = validateLine(args.characterId, args.text);
      if (!validation.ok) {
        console.warn('[hangout] Voice rule violation:', {
          characterId: args.characterId,
          text: args.text,
          violations: validation.violations,
        });
      }
      return args;
    },
  }),
  tong_whisper: tool({
    description: 'Tong gives the player a tip, teaching, or encouragement. Tong is the SOLE teacher — all language explanations go through here. Brief, 1-2 sentences.',
    parameters: z.object({
      message: z.string().describe('The tip/teaching message. Keep Korean/CJK terms in native script, never bare romanization.'),
      translation: z.string().nullable().describe('Separate translation UI text if message contains Korean, or null'),
      vocab: z.array(z.object({
        zh: z.string(),
        py: z.string(),
        en: z.string(),
      })).nullable().optional().describe('Optional vocab breakdown items for richer overlays.'),
      free: z.boolean().optional().describe('Whether this Tong beat is free or part of a spend gate.'),
    }),
    execute: async (args) => args,
  }),
  set_atmosphere: tool({
    description: 'Describe an ambient beat or scene action without direct dialogue. Use for rings, table movement, exits, or other room-state shifts the player notices.',
    parameters: z.object({
      description: z.string().describe('A short narrator-style atmosphere line.'),
    }),
    execute: async (args) => args,
  }),
  show_exercise: tool({
    description: 'Show an interactive exercise. After calling this, STOP and wait for the player result. PREFERRED: provide exerciseData with the complete exercise object for contextual, adaptive exercises. FALLBACK: set exerciseData to null and the client generates locally from hints.',
    parameters: z.object({
      exerciseType: z.enum([
        'drag_drop', 'matching', 'multiple_choice',
        'sentence_builder', 'fill_blank', 'pronunciation_select',
        'pattern_recognition', 'stroke_tracing', 'block_crush',
        'error_correction', 'free_input',
      ]).describe('Exercise UI type'),
      objectiveId: z.string().describe('Learning objective this tests'),
      exerciseData: z.string().nullable().describe('JSON-encoded complete exercise object. When provided, client parses and uses it directly. When null, client generates locally from hints. ID convention: "ai-{type}-{timestamp}".'),
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
      masteryUpdates: z.array(z.object({
        id: z.string(),
        item: z.string(),
        firstContact: z.boolean().optional(),
      })).optional().describe('Mastery items to mark during scene resolution.'),
      stateUpdates: z.record(z.unknown()).nullable().optional().describe('Additional game state updates to persist.'),
      nextHook: z.string().nullable().optional().describe('Optional next-scene hook identifier.'),
    }),
    execute: async (args) => args,
  }),
  set_backdrop: tool({
    description: 'Change the scene backdrop. Use to transition between areas within a location (e.g., from outside to inside the stall, from counter to kitchen).',
    parameters: z.object({
      backdropUrl: z.string().describe('Resolved runtime asset URL for the backdrop image'),
      transition: z.enum(['fade', 'cut']).describe('Transition type: fade (smooth 0.5s) or cut (instant)'),
      ambientDescription: z.string().nullable().describe('Ambient text shown if image fails to load, or null'),
      pov: z.string().nullable().optional().describe('Optional selected POV seat identifier.'),
      offscreenVoice: z.string().nullable().optional().describe('Optional offscreen voice note for the selected POV.'),
    }),
    execute: async (args) => args,
  }),
  show_webtoon: tool({
    description: 'Display a multi-panel webtoon sequence. Use for cliffhangers, memory reveals, or eavesdrop moments that need visual framing.',
    parameters: z.object({
      panels: z.array(webtoonPanelSchema),
      autoAdvance: z.boolean().optional().default(false),
    }),
    execute: async (args) => args,
  }),
  credit_gate: tool({
    description: 'Pause the scene and let the player decide whether to spend SP for an optional reveal.',
    parameters: z.object({
      cost: z.number(),
      spendPayload: z.object({
        additionalLines: z.array(z.object({
          zh: z.string(),
          py: z.string().optional(),
          en: z.string().optional(),
          expression: z.string().optional(),
          clarity: z.enum(['full', 'fragment']).optional(),
        })).optional(),
        tongExplanation: z.string().optional(),
        vocabUnlocks: z.array(z.string()).optional(),
      }),
      skipPayload: z.object({
        tongFallback: z.string().optional(),
      }),
    }),
    execute: async (args) => args,
  }),
  play_cinematic: tool({
    description: 'Play a short video clip (location establishing shot, character intro, scene transition). The scene pauses until playback ends. Use sparingly — only for key dramatic moments.',
    parameters: z.object({
      videoUrl: z.string().describe('URL of the video clip to play'),
      caption: z.string().nullable().describe('Optional text overlay during playback, or null'),
      autoAdvance: z.boolean().describe('If true, auto-advance after playback. If false, wait for player tap.'),
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

type HangoutMode = 'dynamic' | 'fixture';

function readHangoutConfig(req: Request, body?: Record<string, unknown>) {
  const url = new URL(req.url);
  const modeParam = url.searchParams.get('mode') ?? (typeof body?.mode === 'string' ? body.mode : null);
  const mode: HangoutMode = modeParam === 'fixture' ? 'fixture' : 'dynamic';
  const directFixtureId = url.searchParams.get('fixtureId') ?? (typeof body?.fixtureId === 'string' ? body.fixtureId : null);
  const city = url.searchParams.get('city') ?? (typeof body?.city === 'string' ? body.city : null);
  const scene = url.searchParams.get('scene') ?? (typeof body?.scene === 'string' ? body.scene : null);
  const seatParam = url.searchParams.get('seat') ?? (typeof body?.seat === 'string' ? body.seat : null);
  const seat: ShanghaiSeat | null = seatParam === 'shoucheng' ? 'shoucheng' : seatParam === 'dingman' ? 'dingman' : null;
  const fixtureId = directFixtureId || (city === 'shanghai' && scene === 'h1' ? 'shanghai/h1-negotiation' : null);

  return { mode, fixtureId, city, scene, seat };
}

function buildFixtureResponse(fixtureId: string, seat: ShanghaiSeat | null = null) {
  const fixture = getShanghaiFixture(fixtureId);
  if (!fixture) {
    return new Response(`Unknown fixtureId: ${fixtureId}`, { status: 404 });
  }

  return createDataStreamResponse({
    execute: async (dataStream) => {
      const messageId = `fixture-${fixture.id.replace(/[^a-zA-Z0-9_-]+/g, '-')}`;
      dataStream.write(formatDataStreamPart('start_step', { messageId }));

      for await (const event of runFixture(fixture, seat ? { povOverride: seat } : undefined)) {
        writeFixtureEvent(dataStream, event);
        if (event.toolName === 'credit_gate') {
          break;
        }
      }

      dataStream.write(formatDataStreamPart('finish_step', {
        isContinued: false,
        finishReason: 'stop',
      }));
      dataStream.write(formatDataStreamPart('finish_message', {
        finishReason: 'stop',
      }));
    },
    onError: (error) => {
      console.error('[hangout] Fixture stream error:', error);
      return error instanceof Error ? error.message : 'Fixture stream failed';
    },
  });
}

function writeFixtureEvent(
  dataStream: DataStreamWriter,
  event: HangoutEvent,
) {
  dataStream.write(formatDataStreamPart('tool_call', {
    toolCallId: event.toolCallId,
    toolName: event.toolName,
    args: event.args,
  }));
  dataStream.write(formatDataStreamPart('tool_result', {
    toolCallId: event.toolCallId,
    result: event.args,
  }));
}

type FallbackToolCall = {
  toolName: string;
  args: Record<string, unknown>;
  pauses?: boolean;
};

type ShanghaiSeat = 'dingman' | 'shoucheng';

const SHANGHAI_PRIMARY_PAIR_SEED = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function resolveShanghaiSeat(parsedContext: Record<string, unknown> | null): ShanghaiSeat {
  const seat = parsedContext?.seat;
  return seat === 'shoucheng' ? 'shoucheng' : 'dingman';
}

function isShanghaiH1DynamicRequest(
  mode: HangoutMode,
  city: string | null,
  scene: string | null,
  parsedContext: Record<string, unknown> | null,
): boolean {
  if (mode !== 'dynamic') return false;
  if (city === 'shanghai' && scene === 'h1') return true;
  return parsedContext?.city === 'shanghai' && parsedContext?.scene === 'h1';
}

function buildShanghaiH1SystemPrompt(parsedContext: Record<string, unknown> | null): string {
  const fixture = getShanghaiFixture('shanghai/h1-negotiation');
  if (!fixture) {
    throw new Error('Shanghai H1 fixture missing');
  }

  const playerProfile = isRecord(parsedContext?.playerProfile) ? parsedContext.playerProfile : null;
  const englishName = typeof playerProfile?.englishName === 'string' && playerProfile.englishName.trim().length > 0
    ? playerProfile.englishName.trim()
    : typeof parsedContext?.playerName === 'string' && parsedContext.playerName.trim().length > 0
      ? parsedContext.playerName.trim()
      : 'Player';
  const chineseName = typeof playerProfile?.chineseName === 'string' && playerProfile.chineseName.trim().length > 0
    ? playerProfile.chineseName.trim()
    : undefined;
  const explainLang = parsedContext?.explainIn === 'zh' ? 'zh' : 'en';
  const seat = resolveShanghaiSeat(parsedContext);

  return buildShanghaiOnboardingH1Prompt({
    fixture,
    playerName: englishName,
    playerChineseName: chineseName,
    seat,
    masterySnapshot: parsedContext?.mastery as MasterySnapshot | undefined,
    explainLang,
  });
}

function buildFallbackStreamResponse(toolCalls: FallbackToolCall[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (let i = 0; i < toolCalls.length; i += 1) {
        const tc = toolCalls[i];
        const toolCallId = `fallback-${Date.now()}-${i}`;

        controller.enqueue(encoder.encode(`9:${JSON.stringify({
          toolCallId,
          toolName: tc.toolName,
          args: tc.args,
        })}\n`));

        if (!tc.pauses) {
          controller.enqueue(encoder.encode(`a:${JSON.stringify({
            toolCallId,
            result: tc.args,
          })}\n`));
        }
      }

      controller.enqueue(encoder.encode(`d:${JSON.stringify({
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0 },
      })}\n`));
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

function mapHangoutEventsToFallbackToolCalls(events: HangoutEvent[]): FallbackToolCall[] {
  return events.map((event) => ({
    toolName: event.toolName,
    args: event.args as Record<string, unknown>,
    pauses: event.pauses,
  }));
}

function splitShanghaiH1Turns(events: HangoutEvent[]): HangoutEvent[][] {
  const turns: HangoutEvent[][] = [];
  let currentTurn: HangoutEvent[] = [];

  for (const event of events) {
    currentTurn.push(event);
    if (
      event.toolName === 'show_exercise'
      || event.toolName === 'credit_gate'
      || event.toolName === 'end_scene'
    ) {
      turns.push(currentTurn);
      currentTurn = [];
    }
  }

  if (currentTurn.length > 0) {
    turns.push(currentTurn);
  }

  return turns;
}

async function collectShanghaiH1PreludeEvents(
  fixture: SceneFixture,
  seat: ShanghaiSeat,
): Promise<HangoutEvent[]> {
  const events: HangoutEvent[] = [];

  for await (const event of runFixture(fixture, {
    seed: SHANGHAI_PRIMARY_PAIR_SEED,
    povOverride: seat,
  })) {
    events.push(event);
    if (event.toolName === 'credit_gate') {
      break;
    }
  }

  return events;
}

function buildShanghaiH1ResolutionToolCalls(
  fixture: SceneFixture,
  seat: ShanghaiSeat,
  spent: boolean,
): FallbackToolCall[] {
  return mapHangoutEventsToFallbackToolCalls(
    buildFixtureResolutionEvents(fixture, spent ? 'spend' : 'skip', seat),
  );
}

async function buildShanghaiH1FallbackResponse(
  messages: Array<Record<string, unknown>>,
  parsedContext: Record<string, unknown> | null,
) {
  const fixture = getShanghaiFixture('shanghai/h1-negotiation');
  if (!fixture) {
    return buildFallbackResponse('shoucheng', true, messages);
  }

  const seat = resolveShanghaiSeat(parsedContext);
  const userMsgs = messages.filter(
    (msg): msg is Record<string, unknown> & { role: 'user'; content: string } =>
      msg.role === 'user' && typeof msg.content === 'string',
  );
  const lastContent = userMsgs[userMsgs.length - 1]?.content ?? '';
  const exerciseCount = userMsgs.filter((msg) => msg.content.includes('Exercise result:')).length;

  if (lastContent.includes('Credit gate decision:')) {
    const spent = lastContent.includes('Credit gate decision: spend');
    return buildFallbackStreamResponse(buildShanghaiH1ResolutionToolCalls(fixture, seat, spent));
  }

  const preludeEvents = await collectShanghaiH1PreludeEvents(fixture, seat);
  const turns = splitShanghaiH1Turns(preludeEvents);
  const turn = turns[Math.min(exerciseCount, turns.length - 1)];
  if (!turn || turn.length === 0) {
    return buildFallbackResponse('shoucheng', true, messages);
  }

  return buildFallbackStreamResponse(mapHangoutEventsToFallbackToolCalls(turn));
}

export async function GET(req: Request) {
  const { mode, fixtureId, seat } = readHangoutConfig(req);
  if (mode !== 'fixture') {
    return new Response('GET is only supported for fixture mode.', { status: 405 });
  }
  if (!fixtureId) {
    return new Response('fixtureId is required when mode=fixture.', { status: 400 });
  }

  return buildFixtureResponse(fixtureId, seat);
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (e) {
    console.error('[hangout] Failed to parse request body:', e);
    return new Response('Invalid JSON', { status: 400 });
  }

  const { mode, fixtureId, city, scene, seat } = readHangoutConfig(req, body);
  if (mode === 'fixture') {
    if (!fixtureId) {
      return new Response('fixtureId is required when mode=fixture.', { status: 400 });
    }

    return buildFixtureResponse(fixtureId, seat);
  }

  const rawMessages = body.messages ?? [];
  const messages = resolveUnresolvedTools(rawMessages as Record<string, unknown>[]);

  // Parse context from latest user message
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
  const contextStr = (typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '') as string;

  let hangoutVars: HangoutOrchestratorVars | null = null;
  let characterId = 'haeun';
  let parsedContext: Record<string, unknown> | null = null;

  try {
    // Try new HANGOUT_CONTEXT format first, fall back to old CONTEXT format
    const hangoutMatch = contextStr.match(/\[HANGOUT_CONTEXT\]([\s\S]*?)\[\/HANGOUT_CONTEXT\]/);
    const legacyMatch = contextStr.match(/\[CONTEXT\]([\s\S]*?)\[\/CONTEXT\]/);
    const ctxMatch = hangoutMatch ?? legacyMatch;

    if (ctxMatch) {
      const ctx = JSON.parse(ctxMatch[1]);
      parsedContext = isRecord(ctx) ? ctx : null;
      characterId = ctx.characterId ?? 'haeun';
      const char: Character = CHARACTER_MAP[characterId] ?? HAEUN;
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
        explainIn: ctx.explainIn ?? 'en',
      };
    }
  } catch { /* ignore parse errors */ }

  const isShanghaiH1Dynamic = isShanghaiH1DynamicRequest(mode, city, scene, parsedContext);
  if (isShanghaiH1Dynamic && !parsedContext) {
    parsedContext = {
      city: 'shanghai',
      scene: 'h1',
      explainIn: 'en',
      playerName: 'Player',
      characterId: 'shoucheng',
    };
  }

  if (isShanghaiH1Dynamic) {
    characterId = 'shoucheng';
  }

  const hasApiKey = !!process.env.OPENAI_API_KEY;

  if (!hasApiKey) {
    if (isShanghaiH1Dynamic) {
      return buildShanghaiH1FallbackResponse(messages as Record<string, unknown>[], parsedContext);
    }
    return buildFallbackResponse(characterId, hangoutVars?.isFirstEncounter ?? true, messages);
  }

  // Build system prompt
  const char: Character = CHARACTER_MAP[characterId] ?? HAEUN;

  // Check for introduction mode (first encounter with a character)
  let isIntroduction = false;
  let introCtx: Record<string, unknown> = {};
  try {
    const hangoutMatch2 = contextStr.match(/\[HANGOUT_CONTEXT\]([\s\S]*?)\[\/HANGOUT_CONTEXT\]/);
    const legacyMatch2 = contextStr.match(/\[CONTEXT\]([\s\S]*?)\[\/CONTEXT\]/);
    const ctxMatch2 = hangoutMatch2 ?? legacyMatch2;
    if (ctxMatch2) {
      const parsedCtx = JSON.parse(ctxMatch2[1]);
      // Support both old isTutorial and new isIntroduction flags
      isIntroduction = parsedCtx.isIntroduction === true || parsedCtx.isTutorial === true;
      introCtx = parsedCtx;
    }
  } catch { /* ignore */ }

  let systemPrompt: string;

  if (isShanghaiH1Dynamic) {
    systemPrompt = buildShanghaiH1SystemPrompt(parsedContext);
    console.log('[hangout] Shanghai H1 dynamic mode');
  } else if (isIntroduction) {
    const videoConfig = TUTORIAL_VIDEO_CONFIG[characterId];
    const playerLevel = (introCtx.playerLevel as number) ?? 0;
    // Korean % scales with level: 5, 10, 20, 35, 50, 70, 90
    const TARGET_LANG_PCT = [5, 10, 20, 35, 50, 70, 90];
    const targetLangPct = TARGET_LANG_PCT[Math.min(playerLevel, TARGET_LANG_PCT.length - 1)] ?? 5;

    const introVars: IntroductionHangoutVars = {
      playerName: (introCtx.playerName as string) ?? 'Player',
      playerProfile: introCtx.playerProfile as IntroductionHangoutVars['playerProfile'],
      character: char,
      explainIn: (introCtx.explainIn as string) ?? 'en',
      playerLevel,
      targetLangPct,
      introVideoUrl: (introCtx.introVideoUrl as string) ?? videoConfig?.introVideoUrls?.[0] ?? null,
      exitLine: (introCtx.exitLine as string) ?? '',
      videoStatus: (introCtx.videoStatus as 'generating' | 'ready' | 'failed') ?? 'generating',
      exitVideoUrl: (introCtx.exitVideoUrl as string) ?? null,
      exercisesDone: (introCtx.exercisesDone as number) ?? 0,
      minExercises: 3,
      introAct: (introCtx.introAct as 1 | 2) ?? 1,
      backdropUrl: (introCtx.backdropUrl as string) ?? runtimeAssetUrl('city.seoul.location.food-street.backdrop.default'),
      chargePercent: (introCtx.chargePercent as number) ?? 0,
      chargeComplete: (introCtx.chargeComplete as boolean) ?? false,
    };
    systemPrompt = buildIntroductionHangoutPrompt(introVars);
    console.log('[hangout] Introduction mode for', characterId, '| act:', introVars.introAct, '| videoStatus:', introVars.videoStatus, '| charge:', introVars.chargePercent + '%');
  } else {
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
    systemPrompt = buildHangoutOrchestratorPrompt(defaultVars);
  }
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
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 55000);

    const result = streamText({
      model: openai(modelId),
      system: systemPrompt,
      messages,
      tools: hangoutTools,
      toolCallStreaming: true,
      maxSteps: 2,
      temperature: isShanghaiH1Dynamic ? 0.4 : 0.8,
      abortSignal: abortController.signal,
      onError: (error) => {
        console.error('[hangout] Stream error:', error);
      },
      onFinish: () => {
        clearTimeout(timeout);
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
    if (isShanghaiH1Dynamic) {
      return buildShanghaiH1FallbackResponse(messages as Record<string, unknown>[], parsedContext);
    }
    return buildFallbackResponse(characterId, hangoutVars?.isFirstEncounter ?? true, messages);
  }
}

/**
 * Fallback when no API key is available.
 * Turn-aware: examines conversation history to determine which turn we're on.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFallbackResponse(characterId: string, isFirstEncounter: boolean, messages: any[]) {
  const isHauen = characterId === 'haeun';

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
        translation: isHauen ? null : '포장마차 = street food stall',
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
        message: "Let's learn some food words! 떡볶이 = spicy rice cakes, 김밥 = seaweed rice roll, 라면 = ramen noodles, 순대 = blood sausage.",
        translation: null,
      },
    });
    toolCalls.push({
      toolName: 'show_exercise',
      args: {
        exerciseType: 'matching',
        objectiveId: 'ko-vocab-food-items',
        exerciseData: null,
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
          ? "Now let's try 오뎅 = fish cake, 튀김 = fried snacks, 만두 = dumplings, 물 = water!"
          : "Let's review! 떡볶이 = spicy rice cakes, 김밥 = seaweed rice roll. You've got this!",
        translation: null,
      },
    });
    toolCalls.push({
      toolName: 'show_exercise',
      args: {
        exerciseType: 'multiple_choice',
        objectiveId: 'ko-vocab-food-items',
        exerciseData: null,
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
        exerciseData: null,
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

  return buildFallbackStreamResponse(toolCalls);
}
