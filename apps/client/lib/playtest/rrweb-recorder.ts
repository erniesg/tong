/**
 * rrweb DOM event recording for playtest sessions. Events are buffered and
 * streamed to the worker as numbered JSON batches (mirroring the
 * recording-chunks pattern), so a session that never reaches Submit still
 * leaves a replayable stream behind.
 */
import { getPublicApiBase } from '@/lib/public-api-base';
import { sessionLogger } from '@/lib/debug/session-logger';

type RrwebEvent = { type: number; data: unknown; timestamp: number };

const FLUSH_INTERVAL_MS = 10_000;
// keepalive request bodies share a ~64KB in-flight budget per page
const KEEPALIVE_BODY_CAP = 60_000;
// Memory bound for sessions that stream-fail for a long stretch (~15 min of
// dialogue play stays well under this; a runaway mutation loop won't OOM us)
const MAX_BUFFERED_EVENTS = 50_000;

export interface RrwebRecorderHandle {
  flush: (keepalive?: boolean) => Promise<void>;
  stop: () => Promise<void>;
}

/* ── html2canvas clone-iframe filter ─────────────────────────────────
   The snapshot fallback clones the document into an iframe every 2.5s.
   blockSelector stops rrweb serializing the iframe element, but rrweb's
   iframe-load hook still attaches to its contentDocument (upstream bug),
   emitting ~280KB of clone-document events per capture. The game has no
   same-origin iframes of its own, so drop attach events for blocked
   html2canvas iframes plus any later events targeting their nodes. */

type RrwebNode = {
  id?: number;
  tagName?: string;
  attributes?: Record<string, unknown>;
  childNodes?: RrwebNode[];
};

type MutationData = {
  source?: number;
  id?: number;
  isAttachIframe?: boolean;
  adds?: { parentId?: number; node?: RrwebNode }[];
  removes?: { parentId?: number; id?: number }[];
  texts?: { id: number }[];
  attributes?: { id: number }[];
};

const isCloneIframe = (n: RrwebNode): boolean =>
  n.tagName === 'iframe' &&
  typeof n.attributes?.class === 'string' &&
  (n.attributes.class as string).includes('html2canvas-container');

const subtreeIds = (n: RrwebNode, acc: number[]): number[] => {
  if (typeof n.id === 'number') acc.push(n.id);
  n.childNodes?.forEach((c) => subtreeIds(c, acc));
  return acc;
};

const createCloneIframeFilter = () => {
  let blockedIframeIds = new Set<number>();
  let droppedRanges: [number, number][] = [];

  const inDropped = (id: number): boolean =>
    blockedIframeIds.has(id) || droppedRanges.some(([lo, hi]) => id >= lo && id <= hi);

  const scan = (n: RrwebNode): void => {
    if (isCloneIframe(n) && typeof n.id === 'number') blockedIframeIds.add(n.id);
    n.childNodes?.forEach(scan);
  };

  return (event: RrwebEvent): boolean => {
    if (event.type === 2) {
      // Checkout: new id space — reset and rescan the snapshot tree
      blockedIframeIds = new Set();
      droppedRanges = [];
      const node = (event.data as { node?: RrwebNode }).node;
      if (node) scan(node);
      return false;
    }
    if (event.type !== 3) return false;
    const data = event.data as MutationData;
    if (data.source !== 0) {
      // Non-mutation incrementals (canvas, scroll, media…) carry a single
      // target id — drop those aimed inside a dropped clone document
      return typeof data.id === 'number' && inDropped(data.id);
    }
    data.adds?.forEach((a) => { if (a.node) scan(a.node); });
    if (data.isAttachIframe) {
      const parentId = data.adds?.[0]?.parentId;
      if (typeof parentId === 'number' && blockedIframeIds.has(parentId) && data.adds?.[0]?.node) {
        const ids = subtreeIds(data.adds[0].node, []);
        if (ids.length) {
          droppedRanges.push([
            ids.reduce((a, b) => Math.min(a, b)),
            ids.reduce((a, b) => Math.max(a, b)),
          ]);
        }
        return true;
      }
      return false;
    }
    const ids: number[] = [];
    data.adds?.forEach((a) => { if (typeof a.parentId === 'number') ids.push(a.parentId); });
    data.removes?.forEach((r) => {
      if (typeof r.id === 'number') ids.push(r.id);
      if (typeof r.parentId === 'number') ids.push(r.parentId);
    });
    data.texts?.forEach((t) => ids.push(t.id));
    data.attributes?.forEach((a) => ids.push(a.id));
    return ids.length > 0 && ids.every(inDropped);
  };
};

const gzip = async (text: string): Promise<Blob | null> => {
  if (typeof CompressionStream !== 'function') return null;
  try {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    return await new Response(stream).blob();
  } catch {
    return null;
  }
};

export async function startRrwebRecording(sessionId: string): Promise<RrwebRecorderHandle | null> {
  if (typeof window === 'undefined') return null;
  let record: typeof import('rrweb').record;
  try {
    ({ record } = await import('rrweb'));
  } catch {
    return null; // bundle failed to load — snapshot pipeline remains the capture
  }

  const buffer: RrwebEvent[] = [];
  let seq = 0;
  let dropped = 0;
  let flushBusy = false;
  let stopped = false;

  const endpoint = (gz: boolean) =>
    `${getPublicApiBase()}/api/v1/playtest/sessions/${sessionId}/rrweb-events?seq=${seq}${gz ? '&gz=1' : ''}`;

  const postBatch = async (events: RrwebEvent[], keepalive: boolean): Promise<boolean> => {
    const json = JSON.stringify(events);
    const gzBody = await gzip(json);
    const body: BodyInit = gzBody ?? json;
    const size = gzBody ? gzBody.size : json.length;
    if (keepalive && size > KEEPALIVE_BODY_CAP) {
      // Too big for the keepalive budget — split and send halves separately;
      // a single oversized event is dropped (next checkout re-snapshots).
      if (events.length < 2) return false;
      const mid = Math.ceil(events.length / 2);
      const first = await postBatch(events.slice(0, mid), keepalive);
      if (!first) return false;
      return postBatch(events.slice(mid), keepalive);
    }
    try {
      const res = await fetch(endpoint(Boolean(gzBody)), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive,
      });
      if (res.ok) {
        seq += 1;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const flush = async (keepalive = false): Promise<void> => {
    if (flushBusy || buffer.length === 0) return;
    flushBusy = true;
    const pending = buffer.splice(0, buffer.length);
    try {
      const ok = await postBatch(pending, keepalive);
      if (!ok) buffer.unshift(...pending); // retry on the next flush
    } finally {
      flushBusy = false;
    }
  };

  const shouldDropCloneEvent = createCloneIframeFilter();

  const stopRecordFn = record({
    emit(event: RrwebEvent) {
      if (shouldDropCloneEvent(event)) return;
      buffer.push(event);
      if (buffer.length > MAX_BUFFERED_EVENTS) {
        buffer.shift();
        dropped += 1;
      }
    },
    // Periodic full snapshots keep batches independently replayable
    checkoutEveryNms: 30_000,
    maskAllInputs: false, // it's a game; nothing sensitive is typed
    recordCanvas: true, // StrokeTracing exercises draw on canvas
    slimDOMOptions: 'all',
    inlineStylesheet: true,
    // The html2canvas fallback clones the document into this iframe every
    // 2.5s — without blocking it, every clone lands in the event stream
    // as a ~280KB mutation
    blockSelector: 'iframe.html2canvas-container',
  });

  if (!stopRecordFn) return null;

  sessionLogger.logTrace('rrweb_recording_start', {
    sessionId,
    checkoutEveryNms: 30_000,
    maxBufferedEvents: MAX_BUFFERED_EVENTS,
  });

  const interval = setInterval(() => { void flush(); }, FLUSH_INTERVAL_MS);

  const stop = async (): Promise<void> => {
    if (stopped) return;
    stopped = true;
    clearInterval(interval);
    try { stopRecordFn(); } catch { /* already stopped */ }
    if (dropped > 0) {
      sessionLogger.logTrace('rrweb_events_dropped', { sessionId, dropped });
    }
    await flush();
  };

  return { flush, stop };
}
