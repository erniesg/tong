import { resetAuctionRoom } from '@/lib/live-auction/server';

export const runtime = 'nodejs';

export async function POST() {
  return Response.json({ snapshot: resetAuctionRoom() });
}
