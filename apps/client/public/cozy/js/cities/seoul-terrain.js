// Pure Yeonhui hillside geometry (no renderer), shared by physics, placement,
// the map and tests. North of Yeonnam the city climbs toward Ansan: a gentle
// lower slope, a retaining wall (옹벽) crossed only by a stair alley (계단길) or a
// sloped lane, and an upper terrace with a lookout pavilion.
// Kept dependency-free (no util.js/Three) so Node tests can import it directly.
const smooth = (a, b, v) => {
  const k = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

export const HILL_START = 73;
export const HILL_END = 113;
export const WALL = { z0: 90, z1: 91 };
export const lowerH = (z) => 3 * smooth(HILL_START, WALL.z0, z);
export const upperH = (z) => 6 + 3 * smooth(WALL.z1, 110, z);
// Corridors run straight through the wall at a walkable grade (< .9 rise/run).
export const STAIR = { id: 'stair', minX: -15, maxX: -11, z0: 84, z1: 96 };
export const LANE = { id: 'lane', minX: 21, maxX: 27, z0: 80, z1: 101 };
export const corridorH = (c, z) => lowerH(c.z0) + (upperH(c.z1) - lowerH(c.z0)) * (z - c.z0) / (c.z1 - c.z0);

/** Ground height (m) anywhere in Seoul outside the original activity core. */
export function hillHeight(x, z) {
  if (z <= HILL_START) return 0;
  for (const c of [STAIR, LANE]) if (x >= c.minX && x <= c.maxX && z >= c.z0 && z <= c.z1) return corridorH(c, z);
  if (z < (WALL.z0 + WALL.z1) / 2) return lowerH(Math.min(z, WALL.z0));
  return upperH(Math.max(z, WALL.z1));
}

// Map/minimap lanes; also drawn in-world as terrain-following ribbons.
export const HILL_ROADS = [
  { points: [[-44, 68.2], [-44, 77], [24, 77], [44, 77]], width: 3.6, color: '#c7b397' },
  { points: [[4, 66], [4, 77]], width: 2.6, color: '#c7b397' },
  { points: [[-13, 77], [-13, 84]], width: 4, color: '#c7b397' },
  { points: [[-13, 96], [-13, 100], [24, 100], [44, 100]], width: 4, color: '#c7b397' },
  { points: [[24, 77], [24, 101]], width: 6, color: '#a89a89' },
  { points: [[-13, 100], [-30, 104]], width: 3, color: '#c7b397' },
];
export const HILL_STAIRS = [{ points: [[-13, 84], [-13, 96]], width: 4, color: '#c7b397' }];
export const LOOKOUT = { x: -34, z: 106 };

export const hillPlace = {
  id: 'seoul-hill-lookout', ko: '연희동 언덕 전망대', en: 'Yeonhui Hill Lookout', icon: '⛰️', category: 'scenic',
  spawn: [-28, hillHeight(-28, 104), 104], yaw: Math.PI, radius: 4,
  description: 'North of Yeonnam the city climbs toward Ansan. Take the stair alley or the sloped lane up past the retaining wall to a pavilion looking back over Hongdae. A compressed interpretation, not a survey.',
  phrase: { text: '여기서 보는 야경이 최고예요.', rom: 'Yeogiseo boneun yagyeongi choegoyeyo.', en: 'The night view from here is the best.' },
};

export const hillVista = {
  id: 'seoul-hill-view', title: 'Yeonhui hill lookout', nativeName: '연희동 언덕 전망',
  spawn: hillPlace.spawn, position: [LOOKOUT.x + 2, hillHeight(LOOKOUT.x, LOOKOUT.z) + 4.5, LOOKOUT.z - 3], look: [12, 1, 20],
  description: 'From the upper terrace, down the stair alley and over the rooftops toward Hongdae.',
};

export function hillZone(x, z) {
  return z > HILL_START && x > -62 && x < 62 ? { id: 'seoul-hill-lookout', indoor: false } : null;
}

