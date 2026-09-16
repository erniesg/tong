import { finishPaymentHold, startPaymentHold } from '@/lib/live-auction/server';

export const runtime = 'nodejs';

type PaymentHoldRequest = {
  participantId?: string;
  action?: 'start' | 'resume';
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as PaymentHoldRequest;

    if (!body.participantId) {
      return Response.json({ error: 'Participant ID is required.' }, { status: 400 });
    }

    const snapshot =
      body.action === 'resume'
        ? finishPaymentHold(body.participantId)
        : startPaymentHold(body.participantId);

    return Response.json({ snapshot });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Payment hold failed.' },
      { status: 400 },
    );
  }
}
