import type { LiveAuctionJoinRequest } from '@/lib/live-auction/contracts';
import { joinRoom } from '@/lib/live-auction/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json() as LiveAuctionJoinRequest;
  return Response.json(joinRoom(body));
}
