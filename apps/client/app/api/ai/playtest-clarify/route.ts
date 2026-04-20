import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 30;

const requestSchema = z.object({
  comment: z.string().trim().min(1),
  timestamp: z.number().optional(),
  sessionId: z.string().optional(),
  context: z.object({
    sceneContext: z.string().optional(),
    screenshotUrl: z.string().url().optional(),
    stateLogExcerpt: z.string().optional(),
    city: z.string().optional(),
    sceneType: z.string().optional(),
    language: z.string().optional(),
    locationId: z.string().optional(),
  }).optional(),
});

type ClarifyResponse =
  | { status: 'CLEAR'; reason: string }
  | {
      status: 'FOLLOW_UP';
      reason: string;
      followUp: {
        question: string;
        options: string[];
        allowOther: true;
      };
    };

const VAGUE_MARKERS = [
  'weird',
  'confusing',
  'bad',
  'off',
  'wrong',
  'not good',
  'doesnt work',
  "doesn't work",
  'broken',
];

const SPECIFIC_MARKERS = [
  'button',
  'tap',
  'tooltip',
  'translation',
  'font',
  'layout',
  'cut off',
  'overflow',
  'subtitles',
  'audio',
  'loading',
  'crash',
];

function chooseOptions(comment: string, sceneHint: string): string[] {
  const lower = comment.toLowerCase();
  if (lower.includes('text') || lower.includes('translation') || lower.includes('subtitle')) {
    return ['The text is hard to read', 'The translation meaning is wrong', 'The text appears in the wrong place'];
  }
  if (lower.includes('tap') || lower.includes('click') || lower.includes('button')) {
    return ['Tap did not respond', 'Tap responded too slowly', 'The wrong action happened'];
  }
  if (sceneHint.includes('hangout')) {
    return ['The dialogue felt unclear', 'I was unsure what action to take', 'The pacing felt off'];
  }
  return ['The UI layout is confusing', 'The behavior is not what I expected', 'I cannot tell what to do next'];
}

function getDecision(comment: string, context?: z.infer<typeof requestSchema>['context']): ClarifyResponse {
  const trimmed = comment.trim();
  const lower = trimmed.toLowerCase();
  const hasSpecificMarker = SPECIFIC_MARKERS.some((marker) => lower.includes(marker));
  const hasVagueMarker = VAGUE_MARKERS.some((marker) => lower.includes(marker));
  const hasRichContext = Boolean(context?.screenshotUrl || context?.stateLogExcerpt || context?.sceneContext);

  if ((hasSpecificMarker && trimmed.length >= 14) || (trimmed.length >= 28 && hasRichContext && !hasVagueMarker)) {
    return {
      status: 'CLEAR',
      reason: hasRichContext ? 'comment-specific-with-context' : 'comment-specific',
    };
  }

  if (!hasVagueMarker && trimmed.length >= 24) {
    return {
      status: 'CLEAR',
      reason: 'long-enough-to-action',
    };
  }

  const sceneHint = [context?.sceneType, context?.sceneContext].filter(Boolean).join(' ').toLowerCase();
  return {
    status: 'FOLLOW_UP',
    reason: hasVagueMarker ? 'ambiguous-feedback' : 'needs-scope',
    followUp: {
      question: 'Which part should we prioritize fixing first?',
      options: chooseOptions(trimmed, sceneHint).slice(0, 3),
      allowOther: true,
    },
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'invalid_payload', issues: parsed.error.issues }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const decision = getDecision(parsed.data.comment, parsed.data.context);
  return new Response(JSON.stringify(decision), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
