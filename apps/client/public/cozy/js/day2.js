// Day 2 onward (docs/seoul-day2.md): the week, the formation drill's call sets,
// and when each origin's weekly loop plays. Plain helpers, tested in
// scripts/cozy-day2.test.mjs; no three.js imports.

/** Day 1 is Sunday 1 March, so day 2 is a Monday. 0 = Sunday. */
export const weekday = (day) => (((day - 1) % 7) + 7) % 7;
export const WEEKDAYS = [
  { ko: '일요일', en: 'Sunday' },
  { ko: '월요일', en: 'Monday' },
  { ko: '화요일', en: 'Tuesday' },
  { ko: '수요일', en: 'Wednesday' },
  { ko: '목요일', en: 'Thursday' },
  { ko: '금요일', en: 'Friday' },
  { ko: '토요일', en: 'Saturday' },
];

/**
 * One light loop per origin, once a week (docs/seoul-origins.md "Origin loops").
 * `when` is where it plays from: 'morning' after the morning board, 'bed' before sleep.
 */
export const LOOPS = {
  athlete: { scene: 'seoul.loop.dawn', weekday: 1, when: 'morning', hour: 5.5 },
  creator: { scene: 'seoul.loop.edit', weekday: 1, when: 'bed' },
  intl_kid: { scene: 'seoul.loop.family_call', weekday: 0, when: 'morning', hour: 10 },
};

/** The origin's loop scene if it's due now ('morning' | 'bed'), else null. Loops start on day 2. */
export function loopDue(origin, day, when, flags = {}) {
  const loop = LOOPS[origin];
  if (!loop || loop.when !== when || day < 2 || weekday(day) !== loop.weekday) return null;
  if (flags[`played:${loop.scene}:d${day}`]) return null;
  // The family call needs a time agreed first (Mum's text on day 2).
  if (origin === 'intl_kid' && !flags.family_call_set) return null;
  return loop.scene;
}

/**
 * Call sets for a formation_grid exercise: `targets` name the kinds of call.
 * Coach Park's first drill is moves and poses; the dawn run is moves only.
 */
export const CALL_KINDS = ['move', 'pose', 'combo', 'give']; // give: you call it, a teammate follows
export const drillKinds = (targets) => {
  const kinds = (targets ?? []).filter((k) => CALL_KINDS.includes(k));
  return kinds.length ? kinds : ['move', 'pose'];
};
/** A pass is most calls right: 4 of 6. */
export const DRILL_CALLS = 6;
export const drillPassed = (results) => results.filter((r) => r.correct).length >= Math.ceil((DRILL_CALLS * 2) / 3);
