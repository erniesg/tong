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
 * Input: comment + playtest context.
 * Output: JSON payload with either:
 *   { status: "CLEAR" }
 *   { status: "FOLLOW_UP", followUp: { question, options[], allowOther } }
 */
const RequestSchema = z.object({
  comment: z.string().min(1),
  timestamp: z.number().int().nonnegative().optional(),
  sessionId: z.string().optional(),
  sceneContext: z.string().optional(),
  sessionMetadata: z.object({
    city: z.string().optional(),
    sceneType: z.string().optional(),
    language: z.string().optional(),
    locationId: z.string().optional(),
    hangoutId: z.string().optional(),
  }).optional(),
  screenshotUrl: z.string().url().optional(),
  stateLogExcerpt: z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())]).optional(),
});

const VAGUE_COMMENT = /\b(weird|odd|confusing|unclear|bad|wrong|off|hard|difficult|broken|buggy|laggy|slow|not good|meh)\b/i;

function buildFollowUp(comment: string) {
  const lowered = comment.toLowerCase();
  if (/\b(text|font|subtitle|translation|caption|wording|copy)\b/.test(lowered)) {
    return {
      question: 'What felt wrong in the text?',
      options: [
        { id: 'text-size', label: 'Text size/readability' },
        { id: 'text-meaning', label: 'Meaning or translation' },
        { id: 'text-placement', label: 'Placement or clipping' },
      ],
      allowOther: true,
    };
  }
  if (/\b(tap|click|button|press|gesture|control|input)\b/.test(lowered)) {
    return {
      question: 'What happened when you interacted?',
      options: [
        { id: 'input-no-response', label: 'Tap/click did nothing' },
        { id: 'input-wrong-result', label: 'Wrong action happened' },
        { id: 'input-late', label: 'Response felt delayed' },
      ],
      allowOther: true,
    };
  }
  return {
    question: 'Which part should we focus on first?',
    options: [
      { id: 'layout', label: 'Layout or visual hierarchy' },
      { id: 'content', label: 'Text/translation clarity' },
      { id: 'behavior', label: 'Interaction/behavior bug' },
    ],
    allowOther: true,
  };
}

export async function POST(req: Request) {
  const raw = await req.json();
  const parsed = RequestSchema.safeParse(raw);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'comment is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const { comment, sceneContext, screenshotUrl, sessionMetadata, stateLogExcerpt } = parsed.data;

  const contextSignals = [
    Boolean(sceneContext?.trim()),
    Boolean(screenshotUrl),
    Boolean(sessionMetadata && Object.values(sessionMetadata).some(Boolean)),
    Boolean(stateLogExcerpt),
  ].filter(Boolean).length;

  const commentHasSpecificSignal =
    comment.trim().split(/\s+/).length >= 7 ||
    /\b(left|right|top|bottom|button|tap|translation|subtitle|audio|tooltip|screen|exercise|session)\b/i.test(comment);

  const shouldClarify = VAGUE_COMMENT.test(comment) && !commentHasSpecificSignal && contextSignals < 2;
  if (!shouldClarify) {
    return Response.json({
      status: 'CLEAR',
      confidence: contextSignals >= 2 ? 0.92 : 0.78,
      rationale: 'Comment is actionable with current context.',
    });
  }

  return Response.json({
    status: 'FOLLOW_UP',
    confidence: 0.8,
    rationale: 'Comment appears ambiguous without enough context.',
    followUp: buildFollowUp(comment),
  });
}
