// Bridge to the Tong app that hosts this game in an iframe on /cozy.
// Contract: packages/contracts/types.ts, "Cozy 3D game ↔ host page bridge".
// Learning progress (XP, relationships, word mastery, hangout counts) lives in
// the host's shared store; this game keeps only world state in its own save.
// Opened directly (no host), progress is kept in memory for the session only.

const PROTOCOL = 'tong-cozy-bridge';
const VERSION = 1;

/** One cozy heart (a warm story choice) is worth this much shared affinity. */
export const AFFINITY_PER_HEART = 5;
/** Affinity of someone the store has no record of yet (defaultRelationship in lib/types/relationship.ts). */
export const DEFAULT_AFFINITY = 10;

export const affinityOf = (progress, characterId) => progress.relationships[characterId]?.affinity ?? DEFAULT_AFFINITY;

export const STAGES = [
  [91, 'romantic', '연인'],
  [76, 'close', '가까운 사이'],
  [56, 'friends', '친구'],
  [36, 'colleagues', '동료'],
  [16, 'acquaintances', '아는 사이'],
  [0, 'strangers', '낯선 사람'],
];

export function stageOf(affinity) {
  const [, en, ko] = STAGES.find(([min]) => affinity >= min);
  return { en, ko };
}

const emptyProgress = () => ({ xp: 0, sp: 0, level: null, relationships: {}, locationHangoutCounts: {}, items: {} });

/** Deterministic id for a legacy save so the host imports it only once. */
export function legacySaveId(save) {
  const key = JSON.stringify([save.name ?? '', save.aff ?? 0, save.jinAff ?? 0, save.phrases ?? []]);
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return `legacy-v2-${(h >>> 0).toString(36)}`;
}

/** The legacy (pre-bridge) save's learning progress, or null when there is nothing to import. */
export function legacyProgress(save) {
  if (!save || save.sharedImport) return null;
  const hearts = [
    { characterId: 'haeun', hearts: Math.max(0, Math.min(8, Math.floor(Number(save.aff) || 0))) },
    { characterId: 'jin', hearts: Math.max(0, Math.min(8, Math.floor(Number(save.jinAff) || 0))) },
  ];
  const phrases = (Array.isArray(save.phrases) ? save.phrases : [])
    .filter((p) => Array.isArray(p) && typeof p[0] === 'string' && p[0].trim() && p[0].length <= 40)
    .slice(0, 400)
    .map(([ko, gloss]) => ({ ko, ...(typeof gloss?.en === 'string' && gloss.en.length <= 120 ? { en: gloss.en } : {}) }));
  if (!hearts.some((h) => h.hearts) && !phrases.length) return null;
  return { saveId: legacySaveId(save), hearts, phrases };
}

export function createBridge({ win = window, helloTimeout = 1500, helloAttempts = 40 } = {}) {
  const hosted = win.parent && win.parent !== win;
  const origin = win.location.origin;
  const pending = new Map();
  const listeners = { progress: new Set(), viewport: new Set() };
  let seq = 0;
  let connected = false;
  let connecting = null; // promise while saying hello; the host page may still be hydrating
  const queued = []; // events reported before the host answered
  let progress = emptyProgress();

  const emit = (kind, value) => listeners[kind].forEach((fn) => fn(value));
  const setProgress = (p) => {
    if (!p || typeof p !== 'object') return;
    progress = p;
    emit('progress', progress);
  };

  function request(type, payload, timeout = 0) {
    const requestId = `c${Date.now().toString(36)}-${++seq}`;
    return new Promise((resolve, reject) => {
      const timer = timeout ? setTimeout(() => (pending.delete(requestId), reject(new Error(`${type}: no reply`))), timeout) : 0;
      pending.set(requestId, { resolve, reject, timer });
      win.parent.postMessage({ protocol: PROTOCOL, version: VERSION, type, requestId, payload }, origin);
    });
  }

  win.addEventListener('message', (e) => {
    if (!hosted || e.source !== win.parent || e.origin !== origin) return;
    const m = e.data;
    if (!m || m.protocol !== PROTOCOL || m.version !== VERSION || typeof m.type !== 'string') return;
    const p = m.payload ?? {};
    if (m.type === 'host:viewport') return emit('viewport', p);
    if (p.progress) setProgress(p.progress);
    const waiter = m.requestId && pending.get(m.requestId);
    if (!waiter) return;
    pending.delete(m.requestId);
    clearTimeout(waiter.timer);
    if (m.type === 'host:error') waiter.reject(new Error(p.reason ?? 'host error'));
    else waiter.resolve(p);
  });

  // Standalone: keep the session's progress in memory so the HUD still responds.
  function applyLocally(events) {
    const next = structuredClone(progress);
    for (const e of events) {
      if (e.kind === 'affinity') {
        const r = next.relationships[e.characterId] ?? { affinity: DEFAULT_AFFINITY };
        const affinity = Math.max(0, Math.min(100, r.affinity + e.delta));
        next.relationships[e.characterId] = { affinity, stage: stageOf(affinity).en };
      } else if (e.kind === 'item_seen' && !next.items[e.itemId]) {
        next.items[e.itemId] = { masteryLevel: 'new', correct: 0, incorrect: 0 };
      } else if (e.kind === 'location_hangout') {
        const k = `${e.cityId}:${e.locationId}`;
        next.locationHangoutCounts[k] = (next.locationHangoutCounts[k] ?? 0) + 1;
      }
    }
    setProgress(next);
  }

  return {
    get hosted() { return hosted; },
    get connected() { return connected; },
    get progress() { return progress; },
    on(kind, fn) {
      listeners[kind].add(fn);
      return () => listeners[kind].delete(fn);
    },
    /** Say hello until a Tong host answers (it may still be loading); resolves true when connected. */
    connect() {
      if (!hosted) return Promise.resolve(false);
      connecting ??= (async () => {
        for (let i = 0; i < helloAttempts && !connected; i++) {
          try {
            await request('cozy:hello', {}, helloTimeout);
            connected = true;
          } catch {
            /* not listening yet */
          }
        }
        connecting = null;
        // The contract caps a progress message at 50 events.
        while (connected && queued.length) request('cozy:progress', { events: queued.splice(0, 50) }).catch(() => {});
        queued.length = 0;
        return connected;
      })();
      return connecting;
    },
    /** Resolves once the hello settles: true when a Tong host answered. */
    ready() {
      return connecting ?? Promise.resolve(connected);
    },
    /** Report world events (affinity, words met, hangouts). Never throws. */
    report(events) {
      if (!events.length) return;
      // Show the change at once; the host's snapshot replaces it.
      applyLocally(events);
      if (!connected) {
        if (connecting) queued.push(...events);
        return;
      }
      // The contract caps a progress message at 50 events.
      for (let i = 0; i < events.length; i += 50) request('cozy:progress', { events: events.slice(i, i + 50) }).catch(() => {});
    },
    /** Ask the host to run a shared exercise. Resolves with a CozyExerciseResult. */
    async exercise(req) {
      const unavailable = (reason) => ({ outcome: 'unavailable', correct: null, exerciseId: null, exerciseType: req.exerciseType, recordedItems: [], xpAwarded: 0, progress, reason });
      if (connecting) await connecting;
      if (!connected) return unavailable('standalone');
      try {
        // Generous: the player may take their time, but a lost reply must not freeze the world.
        return await request('cozy:exercise', req, 20 * 60 * 1000);
      } catch (err) {
        return unavailable(String(err?.message ?? err));
      }
    },
    /** Open Tong's Learn or Review over the game. Resolves with a CozyPracticeResult. */
    async practice(req) {
      const unavailable = (reason) => ({ outcome: 'unavailable', mode: req.mode, exercises: 0, correct: 0, xpAwarded: 0, progress, reason });
      if (connecting) await connecting;
      if (!connected) return unavailable('standalone');
      try {
        // A lesson can run long; a lost reply must still not freeze the world forever.
        return await request('cozy:practice', req, 2 * 60 * 60 * 1000);
      } catch (err) {
        return unavailable(String(err?.message ?? err));
      }
    },
    /** Import a legacy save once. Resolves with { applied } or null when not hosted. */
    async migrate(migration) {
      if (connecting) await connecting;
      if (!connected) return null;
      try {
        return await request('cozy:migrate', migration, 10000);
      } catch {
        return null;
      }
    },
  };
}
