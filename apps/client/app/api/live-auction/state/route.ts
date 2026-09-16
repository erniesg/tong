import { getSnapshot } from '@/lib/live-auction/server';

export const runtime = 'nodejs';

export async function GET() {
  return Response.json(getSnapshot());
}
