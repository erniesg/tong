import type { CreateCheckoutSessionRequest } from '@/lib/billing/contracts';
import { createDemoCheckoutSession } from '@/lib/billing/stripe';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: CreateCheckoutSessionRequest;

  try {
    body = await request.json() as CreateCheckoutSessionRequest;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  try {
    const origin = new URL(request.url).origin;
    const session = await createDemoCheckoutSession(body, origin);
    return Response.json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Checkout session creation failed.';
    const status = message.includes('not configured') ? 503 : 500;

    return Response.json({ error: message }, { status });
  }
}
