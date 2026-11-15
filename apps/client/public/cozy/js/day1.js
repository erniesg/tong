// Day 1 in Seoul (docs/seoul-first-day.md): the airport train → Hongdae → Onsae → the dorm.
// Plain helpers (tested in scripts/cozy-day1.test.mjs) plus the studio cast
// that fills the practice room for orientation. No three.js imports, so node
// tests can load it; main.js passes the character factory (makeCastMember) in.

import { CAST_SPOTS } from './onsae.js';

export const ORIGINS = [
  { id: 'athlete', ko: '운동선수', en: 'Athlete' },
  { id: 'creator', ko: '크리에이터', en: 'Creator' },
  { id: 'intl_kid', ko: '국제학교 출신', en: 'International-School Kid' },
];
export const originFlag = (origin) => (ORIGINS.some((o) => o.id === origin) ? `origin_${origin}` : null);

/** Day 1 starts seated on the airport train at 4:20pm. */
export const START_HOUR = 16 + 20 / 60;
/** You come up at the station at 4:25pm. */
export const HONGDAE_HOUR = 16 + 25 / 60;
export const hongdaeArrival = () => ({ at: 'station', hour: HONGDAE_HOUR });

/**
 * When you reach Onsae's second floor, from who you met on the way. Straight up from the
 * station: early, and Ha-eun is alone in Room B (haeun.d1.room_b). Ate at the tent first
 * (Jin, jin.j0): on time, practice lets out past you. The tent and then another stop
 * (tally.d1_stops): late, unless your origin's perk got you there (d1_shortcut).
 */
export function arrivalTiming(flags, tally = {}) {
  if (!flags.j0_done) return 'early';
  return (tally.d1_stops ?? 0) >= 1 && !flags.d1_shortcut ? 'late' : 'ontime';
}
export const ARRIVAL_HOURS = { early: 16 + 35 / 60, ontime: 16 + 58 / 60, late: 17 + 20 / 60 };
/** The clock when you reach the second floor (never earlier than now). */
export function studioHour(flags, now) {
  const at = flags.d1_late ? ARRIVAL_HOURS.late : flags.d1_ontime ? ARRIVAL_HOURS.ontime : ARRIVAL_HOURS.early;
  return Math.max(now, at);
}
/** Minutes a stop takes on day one, shown as "+12분". */
export const STOP_MINUTES = { 'jin.j0': 25, 'seoul.d1.busker': 12 };

/**
 * Saves from before Day 1 started in Incheon begin at the agency: mark the new
 * steps done so nothing waits on an airport they never saw.
 */
export function migrateDay1(flags) {
  if (flags.d1_started) return flags;
  const played = Object.fromEntries(DAY1_SCENES.map((id) => [`played:${id}`, true]));
  // The first-night talk is for tonight only if they haven't reached the dorm yet.
  if (!flags.dorm_arrived) delete played['played:seoul.d1.bedtime'];
  return { ...flags, ...played, d1_started: true, d1_arrived_hongdae: true, d1_street_seen: true, d1_lobby_seen: true, d1_arrival_seen: true, orientation_done: true, d1_legacy: true };
}
const DAY1_SCENES = [...['train', 'street', 'lobby', 'arrive', 'orientation', 'bedtime'].map((s) => `seoul.d1.${s}`), 'haeun.d1.room_b'];

/** Is Day 1 still waiting on its own scenes (the airport through orientation)? */
export const dayOneOpen = (f) => !f.orientation_done;
/** The clock waits from the train until the second floor: who you stop for sets the time, not how long you walk. */
export const dayOneClockHeld = (f) => !!f.d1_started && !f.d1_arrival_seen;

/** The arrival chain on the Today list, ticked from story flags. */
export const ARRIVAL_STEPS = [
  ['train', '🚆 Get off at Hongdae'],
  ['agency', '🏢 Onsae by 5:00, up the stone stairs'],
  ['locker', '🔑 Find your locker on 3F'],
  ['register', '📝 Hand in your registration card'],
  ['dorm', '🏠 Get to the dorm (Yeonnam Apartments)'],
  ['firstNight', '🛏️ Sleep in your bunk'],
];
export function arrivalState(f, { day = 1, registered = false } = {}) {
  // Waking on day 2 ticks what's left, but never before orientation: a clock left running can't skip Day 1.
  const past = day >= 2 && !!f.orientation_done;
  return {
    train: !!f.d1_arrived_hongdae || past,
    agency: !!f.orientation_done || past,
    locker: !!f.h0_done || past,
    register: registered || past,
    dorm: !!f.dorm_arrived || past,
    firstNight: past,
  };
}

/** Is the studio full for orientation (the cohort is in from the on-time arrival until the lockers)? */
export function studioCastOn(f, { day = 1, hour = 0 } = {}) {
  // From day 2 the cohort and staff are in for practice, 10:00–18:00.
  if (day >= 2 && f.orientation_done) return hour >= PRACTICE[0] && hour < PRACTICE[1];
  // Day one: they are behind Room A's door until you have met whoever was in the corridor.
  if (!f.d1_arrived_hongdae || f.orientation_done || f.d1_legacy) return false;
  return !!f.d1_arrival_seen;
}
export const PRACTICE = [10, 18];
/** Who is in the studio from day 2: Da-on has middle school in the mornings (canon/cohort.ts). */
export const inForPractice = (id, hour) => (id === 'daon' ? hour >= 14 : true);

// 연습실 A on Onsae's second floor (js/onsae.js CAST_SPOTS): staff at the mirror, six trainees facing them.
const CAST = [
  { id: 'manager_choi', seed: 801 },
  { id: 'coach_park', seed: 811 },
  { id: 'minji', seed: 727 },
  { id: 'yerin', seed: 733 },
  { id: 'daon', seed: 701 },
  { id: 'yunseo', seed: 743 },
  { id: 'dohee', seed: 719 },
  { id: 'boram', seed: 709 },
].map((c) => ({ ...c, at: [CAST_SPOTS[c.id].at[0], CAST_SPOTS[c.id].at[2]], y: CAST_SPOTS[c.id].at[1], yaw: CAST_SPOTS[c.id].yaw }));

export function createStudioCast({ group, floorY, makeCastMember }) {
  const actors = CAST.map((c) => {
    const character = makeCastMember(c.id, c.seed);
    character.root.name = `studio:${c.id}`;
    character.root.position.set(c.at[0], c.y ?? floorY, c.at[1]);
    character.root.rotation.y = c.yaw;
    character.root.visible = false;
    group.attach(character.root);
    return { ...c, character };
  });
  return {
    actors,
    /** `hour` set from day 2 (practice): who's in follows inForPractice. */
    update(on, hour = null) {
      for (const a of actors) a.character.root.visible = on && (hour == null || inForPractice(a.id, hour));
    },
  };
}
