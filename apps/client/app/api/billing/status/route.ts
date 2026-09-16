import { getStripeDemoConfig } from '@/lib/billing/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(getStripeDemoConfig());
}
