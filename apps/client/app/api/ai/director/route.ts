import { streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { buildDirectorPrompt } from '@/lib/ai/prompts/director';
import type { LocationPipeline } from '@/lib/types/director';

export const runtime = 'nodejs';
export const maxDuration = 120;

/* ── Shared schemas ────────────────────────────────────────── */

/** Explicit name object — no z.record() since OpenAI strict mode forbids additionalProperties. */
const nameSchema = z.object({
  en: z.string().describe('English name'),
  local: z.string().describe('Native language name (Korean/Chinese/Japanese)'),
});

const personalitySchema = z.object({
  traits: z.array(z.string()),
  likes: z.array(z.string()),
  dislikes: z.array(z.string()),
  quirks: z.array(z.string()),
  motivations: z.string(),
  emotionalRange: z.string(),
});

const stageEntrySchema = z.object({
  register: z.string(),
  targetLangPercent: z.number(),
  tone: z.string(),
  exampleLine: z.string(),
});

const speechStyleSchema = z.object({
  defaultRegister: z.string(),
  slang: z.array(z.string()),
  catchphrases: z.array(z.string()),
  dialectNotes: z.string(),
  byRelationshipStage: z.object({
    strangers: stageEntrySchema,
    acquaintances: stageEntrySchema,
    colleagues: stageEntrySchema,
    friends: stageEntrySchema,
    close: stageEntrySchema,
    romantic: stageEntrySchema,
  }),
});

const objectiveSchema = z.object({
  id: z.string(),
  levelNumber: z.number(),
  category: z.enum(['script', 'pronunciation', 'vocabulary', 'grammar', 'sentences', 'conversation', 'mastery']),
  title: z.string(),
  description: z.string(),
  targetItems: z.array(z.string()),
  targetCount: z.number(),
  assessmentThreshold: z.number(),
  prerequisites: z.array(z.string()),
  tags: z.array(z.string()),
});

const levelSchema = z.object({
  level: z.number(),
  name: z.string(),
  description: z.string(),
  objectives: z.array(objectiveSchema),
  estimatedSessionMinutes: z.number(),
  assessmentCriteria: z.object({
    minAccuracy: z.number(),
    minItemsCompleted: z.number(),
    requiredObjectives: z.array(z.string()),
  }),
});

const vocabSchema = z.object({
  word: z.string(),
  romanization: z.string(),
  translation: z.string(),
  category: z.string(),
  level: z.number(),
  sceneContext: z.string(),
  visualCue: z.string(),
});

const grammarSchema = z.object({
  id: z.string(),
  pattern: z.string(),
  explanation: z.string(),
  examples: z.array(z.object({ target: z.string(), translation: z.string() })),
  level: z.number(),
  locationId: z.string(),
});

/* ── Director tools ────────────────────────────────────────── */

const directorTools = {
  propose_concept: tool({
    description: 'Propose a location concept. Call this 3 times for 3 distinct proposals.',
    parameters: z.object({
      id: z.string().describe('lowercase_snake_case location identifier'),
      name: nameSchema,
      cityId: z.string(),
      domain: z.string().describe('Thematic domain: street_food, cafe_culture, entertainment, shopping, etc.'),
      order: z.number().describe('Display order on the city map'),
      ambientDescription: z.string().describe('Vivid 2-3 sentence scene description'),
      culturalHook: z.string().describe('Why this place matters culturally'),
      narrativeHook: z.string().describe('How it ties into the trainee storyline'),
      suggestedNpcCount: z.number().describe('Recommended number of NPCs (1-3)'),
    }),
    execute: async (args) => args,
  }),

  propose_character: tool({
    description: 'Propose an NPC character for this location.',
    parameters: z.object({
      id: z.string(),
      name: nameSchema,
      cityId: z.string(),
      role: z.string(),
      context: z.string(),
      archetype: z.string(),
      personality: personalitySchema,
      speechStyle: speechStyleSchema,
      backstory: z.string(),
      defaultLocationId: z.string(),
      romanceable: z.boolean(),
      voiceDescription: z.string(),
    }),
    execute: async (args) => args,
  }),

  propose_curriculum: tool({
    description: 'Propose a complete curriculum for this location.',
    parameters: z.object({
      levels: z.array(levelSchema),
      vocabularyTargets: z.array(vocabSchema),
      grammarTargets: z.array(grammarSchema),
    }),
    execute: async (args) => args,
  }),

  propose_backdrop: tool({
    description: 'Propose a backdrop image concept for this location.',
    parameters: z.object({
      prompt: z.string().describe('Detailed visual description for image generation'),
      timeOfDay: z.enum(['morning', 'day', 'afternoon', 'evening', 'night', 'rain']),
      mood: z.enum(['warm', 'cool', 'energetic', 'melancholy', 'mysterious', 'romantic']),
    }),
    execute: async (args) => args,
  }),

  director_message: tool({
    description: 'Send a message to the developer about the current stage, asking for feedback or explaining decisions.',
    parameters: z.object({
      message: z.string(),
    }),
    execute: async (args) => args,
  }),
};

/* ── POST handler ──────────────────────────────────────────── */

export async function POST(req: Request) {
  const body = await req.json();
  const { pipeline, feedback, messages: chatMessages } = body as {
    pipeline: LocationPipeline;
    feedback?: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  if (!pipeline) {
    return new Response(JSON.stringify({ error: 'No pipeline provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const systemPrompt = buildDirectorPrompt(pipeline, feedback);

  const result = streamText({
    model: openai('gpt-4o', { structuredOutputs: true }),
    system: systemPrompt,
    messages: chatMessages,
    tools: directorTools,
    maxSteps: 10,
  });

  return result.toDataStreamResponse();
}
