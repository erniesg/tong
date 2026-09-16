import { subscribe } from '@/lib/live-auction/server';

export const runtime = 'nodejs';

function formatSse(data: string) {
  return `data: ${data}\n\n`;
}

export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let keepAlive: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      unsubscribe = subscribe((snapshot) => {
        if (closed) return;
        controller.enqueue(encoder.encode(formatSse(JSON.stringify(snapshot))));
      });

      keepAlive = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(': keepalive\n\n'));
      }, 15_000);
    },
    cancel() {
      closed = true;
      if (keepAlive) clearInterval(keepAlive);
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
