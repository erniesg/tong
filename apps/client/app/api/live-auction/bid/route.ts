import type { LiveAuctionBidRequest } from '@/lib/live-auction/contracts';
import { placeBid } from '@/lib/live-auction/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json() as LiveAuctionBidRequest;
    return Response.json({ snapshot: placeBid(body.participantId, body.amount) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Bid failed.' },
      { status: 400 },
    );
  }
}
