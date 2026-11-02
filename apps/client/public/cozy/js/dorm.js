// The girls' trainee dorm (canon/cohort.ts DORM_ROOMS): your floor of the
// Seoul home block, the trainees who are in at night, and where Haeun stands.
import { makeCastMember } from './characters.js';

export const DORM_HOME = 'seoul-home', DORM_LEVEL = 1;

// Local offsets from the block's centre (level-support.js dorm layout).
// review: 'native' — tap lines are placeholders.
export const DORM_CAST = [
  { id: 'daon', name: '다온 Da-on', room: 'room_b', at: [5.6, 1.7], yaw: -Math.PI / 2, seed: 701, home: [21, 7.5], line: { ko: '언니! 내일 같이 가요!', en: 'Eonni! Let\'s walk in together tomorrow!' } },
  { id: 'boram', name: '보람 Bo-ram', room: 'room_b', at: [4.2, 1.6], yaw: Math.PI, seed: 709, home: [22.5, 6.5], line: { ko: '통금 전에 씻어. 줄 길어.', en: 'Shower before curfew. The queue is long.' } },
  { id: 'dohee', name: '도희 Do-hee', room: 'room_a', at: [4.4, -2.5], yaw: Math.PI / 2, seed: 719, home: [22.5, 7], line: { ko: '아, 새로 온 분이죠? 반가워요~', en: 'Oh, you\'re the new one? Nice to meet you~' } },
  { id: 'minji', name: '민지 Minji', room: 'room_c', at: [-0.3, -2.6], yaw: 0, seed: 727, home: [22.5, 7], line: { ko: '들었어요? …아, 아니다.', en: 'Did you hear? …Ah, never mind.' } },
  { id: 'yerin', name: '예린 Yerin', room: 'room_c', at: [1.3, -2.8], yaw: 0, seed: 733, home: [22.5, 7], line: { ko: '그치?', en: 'Right?' } },
];
export const HAEUN_DORM = { at: [5.35, -3.4], yaw: Math.PI / 2, line: { ko: '네~ 안녕히 주무세요.', en: 'Sure~ Good night.' } };

/** Is this trainee in at `hour`? home = [from, to], wrapping past midnight. */
export const isHome = ([from, to], hour) => (from > to ? hour >= from || hour < to : hour >= from && hour < to);

/** Midnight to 06:30 the cohort is asleep in their bunks (lieDown). */
export const SLEEP_HOURS = [0, 6.5];
export const asleep = (hour) => isHome(SLEEP_HOURS, hour);

/**
 * Where each sleeper lies at night: local [u, v, mattress top] in the flat
 * (level-support.js dormFlat). Room A: Ha-eun below, Do-hee above. Room B:
 * Da-on above you, Bo-ram's single. Room C: Minji below Ye-rin; Yun-seo below.
 */
export const DORM_BEDS = {
  haeun: [6.35, -4.85, 0.5], dohee: [6.35, -4.85, 1.78],
  daon: [6.35, 0.3, 1.78], boram: [4.3, -0.7, 0.58],
  minji: [-1.05, -4.85, 0.5], yerin: [-1.05, -4.85, 1.78], yunseo: [1.85, -4.85, 0.5],
};
/** Lie a character on their back in their bed, head toward the wall (−z), eyes closed. */
export function lieDown(c, building, id) {
  const [u, v, top] = DORM_BEDS[id];
  c.root.position.set(building.x + u, building.levels[DORM_LEVEL].floorY + top + 0.2, building.z + v + 0.75);
  c.root.rotation.set(-Math.PI / 2, 0, 0);
  c.pose = 'idle';
  if (c.baseExpr !== 'asleep') c.awakeExpr = c.baseExpr;
  c.baseExpr = c.expr = 'asleep';
}
/** Back on their feet at a standing spot. */
export function standAt(c, x, y, z, yaw) {
  c.root.position.set(x, y, z);
  c.root.rotation.set(0, yaw, 0);
  wake(c);
}
/** Eyes open again (their usual face). */
export function wake(c) {
  if (c.baseExpr === 'asleep') c.baseExpr = c.expr = c.awakeExpr ?? 'neutral';
  c.root.rotation.x = 0;
}

/** Is a position on the cohort's floor (where the cast should render)? */
export const onDormFloor = (room) => room?.buildingId === DORM_HOME && room.level === DORM_LEVEL;

export function createDormCast({ building, group }) {
  const y = building.levels[DORM_LEVEL].floorY;
  const actors = DORM_CAST.map((c) => {
    const character = makeCastMember(c.id, c.seed);
    character.root.name = `dorm:${c.id}`;
    character.root.position.set(building.x + c.at[0], y, building.z + c.at[1]);
    character.root.rotation.y = c.yaw;
    character.root.visible = false;
    group.attach(character.root);
    return { ...c, character };
  });
  return {
    actors,
    /** Show the trainees who are in, only while you are on their floor: asleep in bed, or standing. */
    update(hour, playerRoom) {
      const here = onDormFloor(playerRoom);
      for (const a of actors) {
        a.character.root.visible = here && isHome(a.home, hour);
        if (!a.character.root.visible) continue;
        if (asleep(hour)) lieDown(a.character, building, a.id);
        else standAt(a.character, building.x + a.at[0], y, building.z + a.at[1], a.yaw);
      }
    },
  };
}

export const haeunDormSpot = (building) => ({ x: building.x + HAEUN_DORM.at[0], y: building.levels[DORM_LEVEL].floorY, z: building.z + HAEUN_DORM.at[1] });
