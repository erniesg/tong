import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Inline AI clarification for playtest annotations.
 *
 * When a user drops a comment during a playtest session, this endpoint
 * checks if the comment is clear enough to action, and if not, asks a
 * targeted follow-up question.
 *
 * Input: context-rich annotation payload.
 * Output: structured JSON:
 *  - { status: 'CLEAR' }
 *  - { status: 'FOLLOW_UP', question, options, allowOther: true }
 */

const SYSTEM_PROMPT = `You are a playtest facilitator for a language learning game called Tong.
The user is playing through a scene and has dropped an annotation comment. Your job is to make sure the comment is actionable for the development team.

Rules:
- If the comment is already clear and specific, respond with exactly: CLEAR
- If the comment is vague or could mean multiple things, ask ONE short, specific follow-up question
- Never ask more than one question at a time
- Keep your question under 30 words
- Frame questions as concrete options when possible: "Was it the font size, the translation, or something else?"
- Don't be annoying — if the user says "this is fine" or "skip", accept it
- You are NOT teaching — you are gathering bug reports / UX feedback

Examples of vague comments that need follow-up:
- "this is weird" → "Was it the layout, the text content, or how it responded to your tap?"
- "confusing" → "Was the instruction unclear, or did the UI not behave as expected?"
- "too hard" → "Was the vocabulary too advanced, or were the exercise controls unclear?"

Examples of clear comments that DON'T need follow-up:
- "the Korean text is cut off on the right side" → CLEAR
- "I expected tapping the character to show a translation tooltip" → CLEAR
- "this exercise should have audio" → CLEAR`;

const requestSchema = z.object({
  comment: z.string().min(1),
  sessionId: z.string().optional(),
  timestamp: z.number().optional(),
  sceneContext: z.string().optional(),
  sessionMetadata: z.record(z.unknown()).optional(),
  screenshotContext: z.object({
    hasScreenshot: z.boolean().optional(),
    screenshotUrl: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
  }).optional(),
  stateLogExcerpt: z.array(z.record(z.unknown())).optional(),
});

const responseSchema = z.union([
  z.object({
    status: z.literal('CLEAR'),
    rationale: z.string().optional(),
  }),
  z.object({
    status: z.literal('FOLLOW_UP'),
    question: z.string().min(4).max(180),
    options: z.array(z.string().min(1).max(80)).min(2).max(3),
    allowOther: z.literal(true),
    rationale: z.string().optional(),
  }),
]);

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'comment is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const {
    comment,
    sceneContext,
    timestamp,
    sessionId,
    sessionMetadata,
    screenshotContext,
    stateLogExcerpt,
  } = parsed.data;

  const userMessage = [
    `Session: ${sessionId || 'unknown'}`,
    `Timestamp: ${timestamp || 'unknown'}`,
    sceneContext ? `Scene context: ${sceneContext}` : '',
    sessionMetadata ? `Session metadata: ${JSON.stringify(sessionMetadata)}` : '',
    screenshotContext ? `Screenshot context: ${JSON.stringify(screenshotContext)}` : '',
    stateLogExcerpt?.length ? `Recent state log excerpt: ${JSON.stringify(stateLogExcerpt)}` : '',
    `User comment: "${comment}"`,
    '',
    'Return either CLEAR, or FOLLOW_UP with one short question and exactly 2-3 options grounded in visible context. Always set allowOther=true for follow-ups.',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      system: `${SYSTEM_PROMPT}

Output JSON only. Use this schema:
{ "status": "CLEAR", "rationale": "optional short note" }
or
{ "status": "FOLLOW_UP", "question": "short question", "options": ["option a", "option b"], "allowOther": true, "rationale": "optional short note" }`,
      messages: [{ role: 'user', content: userMessage }],
      schema: responseSchema,
      maxTokens: 220,
    });

    return Response.json(result.object, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json({
      status: 'FOLLOW_UP',
      question: 'Which part felt off most: wording, layout, or behavior after your action?',
      options: ['Wording/copy', 'Layout/visual placement', 'Interaction behavior'],
      allowOther: true,
      rationale: 'fallback',
    }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
