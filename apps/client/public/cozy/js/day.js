// Seoul day loop (#410): one energy meter (기력), sleep → condition, curfew,
// and "tapping Tong stops time". Pure logic plus a small controller; the DOM
// lives in day-ui.js and main.js only adds hooks. Design: docs/seoul-evals.md
// ("Time", "The day", "Energy (기력)"). Numbers marked "proposal" are not in
// the spec and are tuned here, in one place.

/** Every rate and threshold of the day loop. Hours are clock hours (0–24). */
export const DAY_CONFIG = Object.freeze({
  max: 100,
  wakeHour: 7, // the dorm wakes at 07:00; bedtime only changes condition and 기력
  bedFrom: 20, // a real night's sleep from ~20:00; earlier the bed offers a nap
  bedUntil: 7, // ...until 07:00 (after that it's a new day: nap only)
  curfewHour: 23, // canon: curfew 23:00 with Manager Choi's night check
  curfewEnd: 6, // proposal: "after curfew" lasts until 06:00
  drain: {
    walkPerMetre: 0.03, // proposal: ~3 per clock hour of non-stop walking (3.4 m/s, 30 s/hour)
    runPerMetre: 0.08, // proposal: running costs ~2.7× walking per metre (~14 per hour)
    dance: 20, // proposal: one dance drill / rehearsal round in the studio
    nightPerHour: 8, // proposal: away from the dorm after curfew
  },
  restore: {
    meal: 12, // proposal: a sit-down meal (포장마차)
    snack: 5, // proposal: café drink or 편의점 snack
    mealsPerDay: 3, // proposal: food restores at most this many times a day
    benchPerHour: 4, // proposal: "a short rest" on a bench, per clock hour sat
    nap: 15, // proposal: a nap restores a little
    napHours: 1.5, // proposal: and costs this much clock time
  },
  lowEnergy: 20, // proposal: one gentle nudge when 기력 drops below this
  runningSpeed: 3.6, // m/s above walk speed (3.4) counts as running
});

/**
 * Tomorrow's condition, from bedtime (spec: before midnight full, ~02:00
 * partial, all-nighter nothing). `start` is the morning 기력, `wake` the hour
 * you wake. Modifiers are for the eval branch: tired = tighter Perfect window,
 * pricier Tong hints. Values are proposals.
 */
export const CONDITIONS = Object.freeze({
  fresh: { id: 'fresh', ko: '상쾌', en: 'Refreshed', face: '😊', start: 100, wake: 7, timingWindowScale: 1, tongHintCostScale: 1 },
  okay: { id: 'okay', ko: '보통', en: 'Okay', face: '🙂', start: 80, wake: 7, timingWindowScale: 0.95, tongHintCostScale: 1 },
  tired: { id: 'tired', ko: '피곤', en: 'Tired', face: '🥱', start: 60, wake: 7, timingWindowScale: 0.85, tongHintCostScale: 1.25 },
  wrecked: { id: 'wrecked', ko: '엉망', en: 'Wrecked', face: '😵', start: 35, wake: 7, timingWindowScale: 0.7, tongHintCostScale: 1.5 },
});

/**
 * People noticing how you slept. Only a flag for now; scenes decide whether
 * to use it. `minStage` keeps canon: Haeun stays in 존댓말 with you until
 * friends, so this 반말 line can't fire earlier.
 */
export const SLEEP_REACTIONS = Object.freeze([
  { characterId: 'haeun', conditions: ['tired', 'wrecked'], minStage: 'friends', ko: '너 어제 몇 시에 잤어?', en: 'What time did you go to bed last night?', review: 'native' },
]);
const STAGE_ORDER = ['strangers', 'acquaintances', 'colleagues', 'friends', 'close', 'romantic'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap24 = (h) => ((h % 24) + 24) % 24;

/** The day-loop part of the save. */
export function freshDayState(day = 1) {
  return { energy: DAY_CONFIG.max, condition: 'fresh', bedtime: null, wakeDay: day, meals: 0, phrasesAtWake: 0, nightOut: false, curfewNoticed: false, lowNoticed: false };
}

export function normalizeDayState(raw, day = 1) {
  const base = freshDayState(day);
  if (!raw || typeof raw !== 'object') return base;
  return {
    energy: Number.isFinite(raw.energy) ? clamp(raw.energy, 0, DAY_CONFIG.max) : base.energy,
    condition: Object.hasOwn(CONDITIONS, raw.condition) ? raw.condition : base.condition,
    bedtime: Number.isFinite(raw.bedtime) ? wrap24(raw.bedtime) : null,
    wakeDay: Number.isInteger(raw.wakeDay) ? raw.wakeDay : day,
    meals: Number.isInteger(raw.meals) ? clamp(raw.meals, 0, 99) : 0,
    phrasesAtWake: Number.isInteger(raw.phrasesAtWake) ? Math.max(0, raw.phrasesAtWake) : 0,
    nightOut: !!raw.nightOut,
    curfewNoticed: !!raw.curfewNoticed,
    lowNoticed: !!raw.lowNoticed,
  };
}

/**
 * Whether the clock (and with it 기력) runs this frame. Tapping Tong stops
 * time: the Tong menu is a dialogue, Learn/Review/practice run over the game
 * (bridgeBusy), and the phrasebook/collections and every other panel are
 * modal overlays. The bed, recap and morning board are overlays too.
 */
export function clockRuns({ started = false, dialogue = false, modal = false, bridgeBusy = false } = {}) {
  return started && !dialogue && !modal && !bridgeBusy;
}

/** Clock hours a frame advances (S.speed 1 → 30 real seconds per clock hour). */
export const clockHours = (dtSeconds, speed) => (dtSeconds * speed) / 30;

/** After curfew: 23:00–06:00. */
export const afterCurfew = (hour) => wrap24(hour) >= DAY_CONFIG.curfewHour || wrap24(hour) < DAY_CONFIG.curfewEnd;

/** 'sleep' from 20:00 until 07:00, otherwise a 'nap'. */
export const bedKind = (hour) => (wrap24(hour) >= DAY_CONFIG.bedFrom || wrap24(hour) < DAY_CONFIG.bedUntil ? 'sleep' : 'nap');

/** 기력 cost of moving: metres walked and run (rides are free). */
export function movementCost(walkMetres, runMetres) {
  return Math.max(0, walkMetres) * DAY_CONFIG.drain.walkPerMetre + Math.max(0, runMetres) * DAY_CONFIG.drain.runPerMetre;
}

/** Condition from the hour you went to bed. `null` bedtime means an all-nighter. */
export function conditionForBedtime(hour) {
  if (hour == null) return 'wrecked';
  const h = wrap24(hour);
  if (h >= 12) return 'fresh'; // evening, before midnight
  if (h < 1) return 'okay'; // 00:00–01:00
  if (h < 2) return 'tired'; // 01:00–02:00
  return 'wrecked'; // after 02:00
}

/** What a night in bed gives: condition, morning 기력, and hours to sleep until wake. */
export function sleepOutcome(bedHour, energy) {
  const condition = conditionForBedtime(bedHour);
  const c = CONDITIONS[condition];
  // Sleep sets the morning 기력 by condition; an all-nighter restores nothing.
  if (bedHour == null) return { condition, energy: clamp(Math.min(energy, c.start), 0, DAY_CONFIG.max), wakeHour: null, hours: 0 };
  return { condition, energy: c.start, wakeHour: c.wake, hours: wrap24(c.wake - wrap24(bedHour)) };
}

/** Eval-facing modifiers for a condition. */
export function modifiers(condition) {
  const c = CONDITIONS[condition] ?? CONDITIONS.okay;
  return { timingWindowScale: c.timingWindowScale, tongHintCostScale: c.tongHintCostScale };
}

/** The sample line a character would say about last night, or null. */
export function sleepReaction(characterId, condition, stage = 'strangers') {
  const r = SLEEP_REACTIONS.find((x) => x.characterId === characterId && x.conditions.includes(condition));
  if (!r || STAGE_ORDER.indexOf(stage) < STAGE_ORDER.indexOf(r.minStage)) return null;
  return r;
}

export const spend = (d, amount) => { d.energy = clamp(d.energy - Math.max(0, amount), 0, DAY_CONFIG.max); return d.energy; };
export const gain = (d, amount) => { d.energy = clamp(d.energy + Math.max(0, amount), 0, DAY_CONFIG.max); return d.energy; };

/** Food: a meal or snack restores, capped per day. Returns the amount restored. */
export function eat(d, kind = 'meal') {
  if (d.meals >= DAY_CONFIG.restore.mealsPerDay) return 0;
  d.meals++;
  const before = d.energy;
  gain(d, kind === 'snack' ? DAY_CONFIG.restore.snack : DAY_CONFIG.restore.meal);
  return d.energy - before;
}

/**
 * One frame of the running clock. Mutates the clock (`S.hour`, `S.day`) and
 * the day state. `ctx` says where you are and what you did this frame.
 * Returns events: 'midnight', 'curfew' (first time out after curfew tonight),
 * 'low' (crossed the low-energy line), 'allNighter' (reached morning awake).
 */
export function tick(S, d, hours, { walkMetres = 0, runMetres = 0, awayFromDorm = false, resting = false, curfewApplies = true } = {}) {
  const events = [];
  const prev = S.hour;
  S.hour += hours;
  if (S.hour >= 24) {
    S.hour -= 24;
    S.day++;
    events.push('midnight');
  }
  const before = d.energy;
  spend(d, movementCost(walkMetres, runMetres));
  const late = curfewApplies && afterCurfew(S.hour);
  if (late && awayFromDorm) {
    spend(d, hours * DAY_CONFIG.drain.nightPerHour);
    d.nightOut = true;
    if (!d.curfewNoticed) { d.curfewNoticed = true; events.push('curfew'); }
  }
  if (resting) gain(d, hours * DAY_CONFIG.restore.benchPerHour);
  if (before >= DAY_CONFIG.lowEnergy && d.energy < DAY_CONFIG.lowEnergy && !d.lowNoticed) { d.lowNoticed = true; events.push('low'); }
  const crossedWake = (prev < DAY_CONFIG.wakeHour && S.hour >= DAY_CONFIG.wakeHour) || (events.includes('midnight') && S.hour >= DAY_CONFIG.wakeHour);
  if (crossedWake && S.day > d.wakeDay) events.push('allNighter');
  return events;
}

/** Start a new day in the state (after sleep or an all-nighter). */
export function startDay(d, { condition, energy, day, phrases = 0 }) {
  Object.assign(d, { condition, energy: clamp(energy, 0, DAY_CONFIG.max), wakeDay: day, meals: 0, phrasesAtWake: phrases, nightOut: false, curfewNoticed: false, lowNoticed: false });
  return d;
}

/* ── Controller ──────────────────────────────────── */

let current = null;
/** The running day loop (for other modules, e.g. evals). */
export const getDayLoop = () => current;

/**
 * Wires the pure rules to the game. `deps`:
 *   S                 game state (hour, day, phrases, dayLoop)
 *   advanceHours(h)   moves the clock (and S.day)
 *   save()
 *   ui                optional { update(view), recap(info) → Promise<'sleep'|'cancel'>, morning(info) → Promise, toast(html) }
 * Emits 'newday' on window as `cozy:newday` and to on('newday') listeners.
 */
export function createDayLoop({ S, advanceHours, save = () => {}, ui = null, target = globalThis }) {
  const listeners = new Map();
  const emit = (type, detail) => {
    for (const fn of listeners.get(type) ?? []) fn(detail);
    if (typeof target?.dispatchEvent === 'function' && typeof CustomEvent === 'function') target.dispatchEvent(new CustomEvent(`cozy:${type}`, { detail }));
  };
  const d = () => (S.dayLoop ??= freshDayState(S.day));
  let sleeping = false;
  let where = { awayFromDorm: false, curfewApplies: true }; // from the last tick

  const api = {
    config: DAY_CONFIG,
    get state() { return d(); },
    get energy() { return d().energy; },
    get sleeping() { return sleeping; },
    /** Condition as the eval branch needs it. */
    getCondition() {
      const s = d();
      const c = CONDITIONS[s.condition];
      return { id: c.id, ko: c.ko, en: c.en, face: c.face, energy: Math.round(s.energy), bedtime: s.bedtime, nightOut: s.nightOut, ...modifiers(c.id) };
    },
    on(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
      return () => listeners.get(type).delete(fn);
    },
    /** Called by the frame loop while the clock runs. */
    tick(hours, ctx = {}) {
      where = { awayFromDorm: !!ctx.awayFromDorm, curfewApplies: ctx.curfewApplies ?? true };
      const events = tick(S, d(), hours, ctx);
      if (events.includes('curfew')) emit('curfew', { hour: S.hour, day: S.day }); // hook: Manager Choi's night check
      if (events.includes('low')) ui?.toast?.('<b>기력이 없어요</b><span>Low energy. Eat, rest, or go to bed.</span>');
      if (events.includes('allNighter')) api.allNighter();
      ui?.update?.(api.view());
      return events;
    },
    /** Physical/social costs from outside the clock: 'dance' (drill/rehearsal) or a number. */
    spend(what) {
      const amount = typeof what === 'number' ? what : DAY_CONFIG.drain[what] ?? 0;
      spend(d(), amount);
      ui?.update?.(api.view());
      return d().energy;
    },
    /** A meal or snack at a food place. */
    eat(kind = 'meal') {
      const got = eat(d(), kind);
      ui?.update?.(api.view());
      return got;
    },
    /** A nap: a little 기력 for some clock time. */
    nap() {
      advanceHours(DAY_CONFIG.restore.napHours);
      gain(d(), DAY_CONFIG.restore.nap);
      ui?.update?.(api.view());
      save();
    },
    /**
     * Go to bed now: recap (diary stub, #385) → sleep → morning board. With
     * `{ skipRecap: true }` it goes straight to sleep (e.g. the eval eve).
     * Resolves to the morning's condition, or null if the player backed out.
     */
    async sleepUntilMorning({ skipRecap = false, skipMorning = false } = {}) {
      if (sleeping) return null;
      sleeping = true;
      try {
        const s = d();
        const bedHour = S.hour;
        if (!skipRecap && ui?.recap) {
          const words = [...(S.phrases?.keys?.() ?? [])].slice(s.phrasesAtWake);
          const choice = await ui.recap({ hour: bedHour, words, nightOut: s.nightOut, condition: conditionForBedtime(bedHour) });
          if (choice !== 'sleep') return null;
        }
        const out = sleepOutcome(bedHour, s.energy);
        advanceHours(out.hours); // crosses midnight → S.day moves on
        startDay(s, { condition: out.condition, energy: out.energy, day: S.day, phrases: S.phrases?.size ?? 0 });
        s.bedtime = wrap24(bedHour);
        save();
        const detail = { day: S.day, reason: 'sleep', bedtime: s.bedtime, ...api.getCondition() };
        ui?.update?.(api.view());
        emit('newday', detail);
        if (!skipMorning) await ui?.morning?.(detail);
        return detail;
      } finally {
        sleeping = false;
      }
    },
    /** Reached morning without sleeping: nothing restored, start wrecked. */
    allNighter() {
      const s = d();
      const out = sleepOutcome(null, s.energy);
      startDay(s, { condition: out.condition, energy: out.energy, day: S.day, phrases: S.phrases?.size ?? 0 });
      s.bedtime = null;
      save();
      const detail = { day: S.day, reason: 'allNighter', bedtime: null, ...api.getCondition() };
      emit('newday', detail);
      ui?.morning?.(detail);
      return detail;
    },
    /** What a character would say about last night (hook; null if nothing). */
    reaction(characterId, stage) {
      return sleepReaction(characterId, d().condition, stage);
    },
    view() {
      return { ...api.getCondition(), max: DAY_CONFIG.max, afterCurfew: where.curfewApplies && where.awayFromDorm && afterCurfew(S.hour), bed: bedKind(S.hour) };
    },
  };
  current = api;
  return api;
}
