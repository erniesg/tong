// Day 1 in Seoul (docs/seoul-day1.md): Incheon → Hongdae → Onsae → the dorm.
// Plain helpers (tested in scripts/cozy-day1.test.mjs) plus the studio cast
// that fills the practice room for orientation. No three.js imports, so node
// tests can load it; main.js passes the character factory in.

export const ORIGINS = [
  { id: 'athlete', ko: '운동선수', en: 'Athlete' },
  { id: 'creator', ko: '크리에이터', en: 'Creator' },
  { id: 'intl_kid', ko: '국제학교 출신', en: 'International-School Kid' },
];
export const originFlag = (origin) => (ORIGINS.some((o) => o.id === origin) ? `origin_${origin}` : null);

/** Day 1 starts at Incheon arrivals at 1:05pm. */
export const START_HOUR = 13 + 5 / 60;

/** Where and when you come up in Hongdae, by how you travelled. */
export function hongdaeArrival(flags) {
  if (flags.d1_taxi) return { at: 'street', hour: 14.5 };
  if (flags.d1_late) return { at: 'station', hour: 15.2 };
  if (flags.d1_ontime) return { at: 'station', hour: 14 + 50 / 60 };
  return { at: 'station', hour: 14 + 25 / 60 };
}
/** The clock when the arrival scene plays at the studio (never earlier than now). */
export function studioHour(flags, now) {
  const at = flags.d1_late ? 15 + 20 / 60 : flags.d1_ontime ? 14 + 58 / 60 : 14 + 25 / 60;
  return Math.max(now, at);
}

/**
 * Saves from before Day 1 started in Incheon begin at the agency: mark the new
 * steps done so nothing waits on an airport they never saw.
 */
export function migrateDay1(flags) {
  if (flags.d1_started) return flags;
  return { ...flags, d1_started: true, d1_exit_done: true, d1_arrived_hongdae: true, d1_arrival_seen: true, orientation_done: true, d1_legacy: true };
}

/** The arrival chain on the Today list, ticked from story flags. */
export const ARRIVAL_STEPS = [
  ['airport', '🛬 Find the way out (출구)'],
  ['train', '🚆 Get to Hongdae'],
  ['agency', '🏢 Onsae by 3:00'],
  ['locker', '🔑 Find your locker'],
  ['register', '📝 Hand in your registration card'],
  ['dorm', '🏠 Get to the dorm (Yeonnam Apartments)'],
  ['firstNight', '🛏️ Sleep in your bunk'],
];
export function arrivalState(f, { day = 1, registered = false } = {}) {
  const past = day >= 2;
  return {
    airport: !!f.d1_exit_done || past,
    train: !!f.d1_arrived_hongdae || past,
    agency: !!f.orientation_done || past,
    locker: !!f.h0_done || past,
    register: registered || past,
    dorm: !!f.dorm_arrived || past,
    firstNight: past,
  };
}

/** Is the studio full for orientation (the cohort is in from the on-time arrival until the lockers)? */
export function studioCastOn(f) {
  if (!f.d1_arrived_hongdae || f.orientation_done || f.d1_legacy) return false;
  return f.d1_early ? !!f['played:seoul.d1.arrive'] : true;
}

// Practice studio (world.js buildStudio): x −16…−6, z −44…−31, floor at TERRACE_Y.
const CAST = [
  { id: 'manager_choi', seed: 801, at: [-7.4, -37.2], yaw: -Math.PI / 2 },
  { id: 'coach_park', seed: 811, at: [-7.6, -34.6], yaw: -Math.PI / 2 },
  { id: 'minji', seed: 727, at: [-10.6, -41.2], yaw: Math.PI / 2 },
  { id: 'yerin', seed: 733, at: [-11.4, -41.6], yaw: Math.PI / 2 },
  { id: 'daon', seed: 701, at: [-10.2, -34.2], yaw: Math.PI / 2 },
  { id: 'yunseo', seed: 743, at: [-12.4, -39.6], yaw: Math.PI / 2 },
  { id: 'dohee', seed: 719, at: [-13.2, -35.4], yaw: Math.PI / 2 },
  { id: 'boram', seed: 709, at: [-12.8, -33.2], yaw: Math.PI / 2 },
];

export function createStudioCast({ group, floorY, makePedestrian }) {
  const actors = CAST.map((c) => {
    const character = makePedestrian(c.seed);
    character.root.name = `studio:${c.id}`;
    character.root.position.set(c.at[0], floorY, c.at[1]);
    character.root.rotation.y = c.yaw;
    character.root.visible = false;
    group.attach(character.root);
    return { ...c, character };
  });
  return {
    actors,
    update(on) {
      for (const a of actors) a.character.root.visible = on;
    },
  };
}
