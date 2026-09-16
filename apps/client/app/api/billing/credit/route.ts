import { getStripeDemoConfig } from '@/lib/billing/config';
import { findLatestPaidCheckoutSessionSummary, getCheckoutSessionSummary } from '@/lib/billing/stripe';
import { getSnapshot, topUpParticipant } from '@/lib/live-auction/server';

export const runtime = 'nodejs';

type CreditCheckoutRequest = {
  participantId?: string;
  sessionId?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __tongCreditedCheckoutSessions: Set<string> | undefined;
}

function getCreditedSessions() {
  if (!globalThis.__tongCreditedCheckoutSessions) {
    globalThis.__tongCreditedCheckoutSessions = new Set<string>();
  }
  return globalThis.__tongCreditedCheckoutSessions;
}

function getSpAmount(amountTotal: number | null) {
  const config = getStripeDemoConfig();
  const baseAmount = config.demoAmountCents || 700;
  const quantity = amountTotal && amountTotal > 0 ? Math.max(1, Math.round(amountTotal / baseAmount)) : 1;
  return quantity * 300;
}

export async function POST(request: Request) {
  let body: CreditCheckoutRequest;

  try {
    body = await request.json() as CreditCheckoutRequest;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.participantId) {
    return Response.json({ error: 'participantId is required.' }, { status: 400 });
  }

  try {
    const requestedSessionId = body.sessionId && !body.sessionId.includes('CHECKOUT_SESSION_ID')
      ? body.sessionId
      : null;
    const summary = requestedSessionId
      ? await getCheckoutSessionSummary(requestedSessionId)
      : await findLatestPaidCheckoutSessionSummary(body.participantId);
    if (!summary) {
      return Response.json({ error: 'Stripe checkout could not be found yet.' }, { status: 404 });
    }
    if (summary.paymentStatus !== 'paid') {
      return Response.json({ error: 'Stripe checkout is not paid yet.' }, { status: 409 });
    }

    const creditedSessions = getCreditedSessions();
    if (creditedSessions.has(summary.sessionId)) {
      return Response.json({
        alreadyApplied: true,
        spAmount: 0,
        snapshot: getSnapshot(),
      });
    }

    const spAmount = getSpAmount(summary.amountTotal);
    const snapshot = topUpParticipant(body.participantId, spAmount);
    creditedSessions.add(summary.sessionId);

    return Response.json({
      alreadyApplied: false,
      spAmount,
      snapshot,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe credit sync failed.';
    return Response.json({ error: message }, { status: 500 });
  }
}
