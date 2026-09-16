import type { LiveAuctionAdminCloseRequest } from '@/lib/live-auction/contracts';
import { closeAuction } from '@/lib/live-auction/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json() as LiveAuctionAdminCloseRequest;
    return Response.json({ snapshot: closeAuction(body.participantId, body.amount) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Admin close failed.' },
      { status: 400 },
    );
  }
}
