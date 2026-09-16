import type { LiveAuctionTopUpRequest } from '@/lib/live-auction/contracts';
import { topUpParticipant } from '@/lib/live-auction/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json() as LiveAuctionTopUpRequest;
    return Response.json({ snapshot: topUpParticipant(body.participantId, body.amount) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Top-up failed.' },
      { status: 400 },
    );
  }
}
