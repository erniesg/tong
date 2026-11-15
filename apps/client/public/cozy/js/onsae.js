// Onsae Entertainment: where things are (docs/seoul-first-day.md).
// Plain data, no three.js: node tests and scene code import these. The walls,
// stairs and furniture are authored in level-support.js (`layout: 'agency'`)
// and dressed in onsae-build.js; scripts/cozy-onsae.test.mjs keeps them in step.
//
// The block stands on the west half of the terrace, front door facing +z
// (the walk along the terrace edge, west of the top of the stone stairs).
//   1F  lobby (reception, artist wall, floor guide) + stair hall
//   2F  corridor, 연습실 A (mirror wall), 연습실 B (small, behind the stairwell)
//   3F  corridor, 사물함 lockers, 휴게실 lounge, 보컬실 vocal booth

export const ONSAE = Object.freeze({ id: 'seoul-onsae', city: 'seoul', x: -9, z: -38, w: 14, d: 12, floors: 3, storeyHeight: 3.4, baseY: 2.4, rooftop: false, layout: 'agency' });
export const FLOOR_Y = [0, 1, 2].map((level) => +(ONSAE.baseY + level * ONSAE.storeyHeight).toFixed(3));
export const LEVEL_IDS = FLOOR_Y.map((_, level) => `${ONSAE.id}-level-${level}`);

const r = (n) => +n.toFixed(3);
/** Local metres (u east, v toward the front door) on a floor → world [x, y, z]. */
const at = (u, v, level = 0, dy = 0) => [r(ONSAE.x + u), r(FLOOR_Y[level] + dy), r(ONSAE.z + v)];
const rect = (u0, u1, v0, v1, level) => ({ minX: r(ONSAE.x + u0), maxX: r(ONSAE.x + u1), minZ: r(ONSAE.z + v0), maxZ: r(ONSAE.z + v1), floorY: FLOOR_Y[level], level });

// Yaw: rotation.y = 0 faces +z (the terrace), π/2 faces +x (east), π faces -z (the river), -π/2 faces -x.
const EAST = Math.PI / 2, WEST = -Math.PI / 2, RIVER = Math.PI, FRONT = 0;

/** Room name → world bounds and floor height. `stairs` spans every floor. */
export const ROOMS = {
  lobby: rect(-1.7, 6.9, -5.9, 5.9, 0),
  stairs: rect(-6.9, -1.7, -1.9, 5.9, 0),
  corridor2: rect(-1.7, 0.3, -5.9, 5.9, 1),
  practice_a: rect(0.3, 6.9, -5.9, 5.9, 1),
  practice_b: rect(-6.9, -1.7, -5.9, -1.9, 1),
  corridor3: rect(-1.7, 0.3, -5.9, 5.9, 2),
  lockers: rect(0.3, 6.9, 0, 5.9, 2),
  lounge: rect(0.3, 6.9, -5.9, 0, 2),
  vocal: rect(-6.9, -1.7, -5.9, -1.9, 2),
};

/** Which room of the building is this point in? null outside (or inside a wall). */
export function roomAt(x, y, z) {
  const ry = y - ONSAE.baseY;
  if (!Number.isFinite(ry) || ry < -0.05 || ry >= ONSAE.floors * ONSAE.storeyHeight) return null;
  if (Math.abs(x - ONSAE.x) > ONSAE.w / 2 || Math.abs(z - ONSAE.z) > ONSAE.d / 2) return null;
  const within = (b) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
  if (within(ROOMS.stairs)) return 'stairs';
  const level = Math.min(ONSAE.floors - 1, Math.floor((ry + 0.025) / ONSAE.storeyHeight));
  for (const [name, b] of Object.entries(ROOMS)) if (name !== 'stairs' && b.level === level && within(b)) return name;
  return null;
}

/** Named spots as [x, y, z]. Unless noted, the player (or a character) stands there. */
export const door = at(0, 7.2); // outside the front door, on the terrace walk
export const lobby = at(2, 1.5);
export const desk = at(3.5, -1.2); // in front of the empty reception desk
export const artistWall = at(2, -4.2); // facing the back wall of framed posters
export const guide = at(-0.6, 1.3); // facing the floor guide by the stair door
export const stairDoor1 = at(-1, 3.25); // lobby side of the stair door
export const stair1 = at(-5.55, 2.9); // foot of the first flight
export const stair2 = at(-2.95, 3.25, 1); // 2F landing, top of the flight
export const stair3 = at(-2.95, 3.25, 2);
export const corridor2 = at(-0.7, 0.5, 1);
export const roomADoor = at(-0.5, 1.1, 1); // corridor side of 연습실 A's door
export const roomA = at(3.4, 0, 1);
export const roomAFront = at(5.4, 0, 1); // by the mirror, facing the room: manager and coach
export const mirror = at(5.9, -1.5, 1); // at the barre
export const whiteboard = at(2.6, -4.7, 1); // word-quiz whiteboard on the back wall
export const evalBoard = at(4.7, -4.7, 1); // schedule board, right of the whiteboard
export const roomBDoor = at(-0.9, -3.85, 1); // corridor side of 연습실 B's ajar door
export const roomBWatch = at(-2.5, -3.85, 1); // just inside the door
export const roomB = at(-4.3, -4.2, 1); // where Ha-eun drills, facing her mirror panel
// Sit here, back against the corridor wall beside the door, facing the window and her. Keep the camera on the
// corridor side (cam.yaw ≈ π/2) or the river side: north of this room is the stairwell, which does not cut away.
export const roomBWall = at(-2.1, -2.7, 1);
export const corridor3 = at(-0.7, 0.5, 2);
export const lockersDoor = at(-0.5, 3.25, 2);
export const locker = at(3.6, 1.2, 2); // in front of the middle locker
export const lockerLabel = at(3.6, 0.59, 2, 1.62); // the half-scraped label itself (not a standing spot)
export const vocalDoor = at(-0.9, -3.85, 2);
export const vocal = at(-3.4, -4.2, 2);
export const loungeDoor = at(-0.5, -2.4, 2);
export const lounge = at(2.8, -2.6, 2);

export const SPOTS = { door, lobby, desk, artistWall, guide, stairDoor1, stair1, stair2, stair3, corridor2, roomADoor, roomA, roomAFront,
  mirror, whiteboard, evalBoard, roomBDoor, roomBWatch, roomB, roomBWall, corridor3, lockersDoor, locker, lockerLabel, vocalDoor, vocal, loungeDoor, lounge };
/** Spot → the room it is in (lockerLabel is a point on the locker door, door is outside). */
export const SPOT_ROOMS = { lobby: 'lobby', desk: 'lobby', artistWall: 'lobby', guide: 'lobby', stairDoor1: 'lobby', stair1: 'stairs', stair2: 'stairs', stair3: 'stairs',
  corridor2: 'corridor2', roomADoor: 'corridor2', roomA: 'practice_a', roomAFront: 'practice_a', mirror: 'practice_a', whiteboard: 'practice_a', evalBoard: 'practice_a',
  roomBDoor: 'corridor2', roomBWatch: 'practice_b', roomB: 'practice_b', roomBWall: 'practice_b', corridor3: 'corridor3', lockersDoor: 'corridor3', locker: 'lockers',
  vocalDoor: 'corridor3', vocal: 'vocal', loungeDoor: 'corridor3', lounge: 'lounge' };
/** Which way to face at a spot (yaw), where it matters. */
export const SPOT_YAW = { door: RIVER, artistWall: RIVER, guide: WEST, desk: EAST, roomADoor: EAST, roomAFront: WEST, mirror: EAST, whiteboard: RIVER, evalBoard: RIVER,
  roomBDoor: WEST, roomBWatch: WEST, roomB: RIVER, roomBWall: WEST, locker: RIVER, lounge: RIVER, vocal: WEST };

/** Where wall-mounted things hang: centre [x, y, z] and the yaw their face points. */
export const MOUNTS = {
  whiteboard: { at: at(2.6, -5.885, 1, 1.6), yaw: FRONT },
  evalBoard: { at: at(4.7, -5.885, 1, 1.6), yaw: FRONT },
  mirror: { at: at(6.87, 0, 1, 1.5), yaw: WEST, size: [11.4, 2.5] },
  lockerLabel: { at: lockerLabel, yaw: FRONT },
  guide: { at: at(-1.6, 1.3, 0, 1.55), yaw: EAST },
};

/** Orientation in 연습실 A: staff at the mirror facing the room, six trainees on the floor facing them. */
export const CAST_SPOTS = {
  manager_choi: { at: at(5.5, 0.7, 1), yaw: WEST, pose: 'stand' },
  coach_park: { at: at(5.7, -1.7, 1), yaw: WEST - 0.25, pose: 'stand' },
  minji: { at: at(2.3, 3.0, 1), yaw: EAST + 0.3, pose: 'stand' },
  yerin: { at: at(3.1, 3.6, 1), yaw: EAST + 0.45, pose: 'stand' },
  daon: { at: at(3.7, 0.3, 1), yaw: EAST, pose: 'stand' },
  yunseo: { at: at(2.5, -1.1, 1), yaw: EAST - 0.1, pose: 'stand' },
  dohee: { at: at(3.5, -2.7, 1), yaw: EAST - 0.3, pose: 'stand' },
  boram: { at: at(2.1, -3.5, 1), yaw: EAST - 0.35, pose: 'stand' },
};

/** Practice lets out: the same six in twos, strung from 연습실 A's door along the corridor to the stair landing. */
export const CORRIDOR_SPOTS = {
  minji: { at: at(-0.45, 2.0, 1), yaw: FRONT - 0.5, pair: 0 },
  yerin: { at: at(-1.1, 2.5, 1), yaw: FRONT + 0.6, pair: 0 },
  dohee: { at: at(-0.4, -0.5, 1), yaw: FRONT - 0.3, pair: 1 },
  boram: { at: at(-1.05, -1.1, 1), yaw: FRONT + 0.4, pair: 1 },
  daon: { at: at(-4.6, 4.7, 1), yaw: EAST + 0.4, pair: 2 },
  yunseo: { at: at(-5.4, 4.0, 1), yaw: EAST - 0.2, pair: 2 },
};
