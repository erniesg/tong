import { streamText } from 'ai';
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
 * Input: { comment, sceneContext, timestamp }
 * Output: streamed text — either a clarifying question or "CLEAR" if no follow-up needed.
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

export async function POST(req: Request) {
  const body = await req.json();
  const { comment, sceneContext, timestamp, sessionId } = body;

  if (!comment) {
    return new Response(JSON.stringify({ error: 'comment is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userMessage = [
    `Session: ${sessionId || 'unknown'}`,
    `Timestamp: ${timestamp || 'unknown'}`,
    sceneContext ? `Scene context: ${sceneContext}` : '',
    `User comment: "${comment}"`,
    '',
    'Is this comment clear enough to action, or do you need to ask a follow-up question?',
  ]
    .filter(Boolean)
    .join('\n');

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    maxTokens: 100,
  });

  return result.toDataStreamResponse();
}
