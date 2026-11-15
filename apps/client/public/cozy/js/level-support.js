// Apartment authored geometry and its physical queries share these records.
// No renderer, terrain fallback, global current floor, or import-time buildings.
const EPS = 1e-7;
const inside = (b, x, z) => x >= b.minX - EPS && x <= b.maxX + EPS && z >= b.minZ - EPS && z <= b.maxZ + EPS;
export const SUPPORT_REACH = 0.065; // > one running 1/120s substep at slope .71, not a step/elevator.

export function supportAt(building, x, z, feetY) {
  if (!Number.isFinite(feetY)) return null;
  let best = null;
  for (const s of building.supports) {
    if (!inside(s, x, z)) continue;
    const y = s.y + (s.slopeZ || 0) * (z - s.startZ);
    if (y <= feetY + SUPPORT_REACH && (best === null || y > best)) best = y;
  }
  return best;
}

export function ceilingAt(building, x, z, feetY) {
  if (!Number.isFinite(feetY)) return null;
  let best = null;
  for (const s of building.ceilings) {
    // The slab/step we're standing ON isn't an overhead obstruction. The
    // drawn treads sit at most .142 above their continuous physical ramp.
    if (!inside(s, x, z) || s.maxY <= feetY + 0.20) continue;
    if (best === null || s.minY < best) best = s.minY;
  }
  return best;
}

export function zoneAt(building, position) {
  const { x, y, z } = position;
  const ry = y - (building.baseY ?? 0); // height above the building's own ground floor
  if (!inside(building.bounds, x, z) || ry < -0.05 || ry >= building.floors * building.storeyHeight) return null;
  const level = Math.floor((ry + 0.025) / building.storeyHeight);
  return building.levels[Math.min(level, building.floors - 1)] ?? null;
}

/** Small authored switchback home, front +Z. All dimensions in metres.
 *  With `rooftop`, the stairwell continues to a walkable, dressed roof terrace.
 *  `baseY` stands the whole building on raised ground (Onsae on the terrace).
 *  `layout: 'agency'` is Onsae Entertainment: lobby, practice rooms, lockers. */
export function createApartmentPlan({ id, city, x, z, w = 14, d = 12, floors = 3, storeyHeight = 3.4, style = city, rooftop = true, layout = 'flat', baseY = 0 }) {
  if (!id || !city || ![x, z, w, d, storeyHeight].every(Number.isFinite) || w < 14 || d < 10 || !Number.isInteger(floors) || floors < 2 || storeyHeight < 3.2 || storeyHeight > 3.5)
    throw new RangeError('Apartment needs id/city, finite origin, w>=14, d>=10, >=2 floors, and 3.2–3.5m storeys');
  if (layout === 'dorm' && (w !== 14 || d !== 12)) throw new RangeError('The dorm layout is authored for a 14×12m block');
  if (!Number.isFinite(baseY)) throw new RangeError('Apartment baseY must be finite');
  const agency = layout === 'agency';
  if (agency && (w !== 14 || d !== 12 || floors !== 3)) throw new RangeError('The agency layout is authored for a three-floor 14×12m block');
  if (agency) rooftop = false;
  const b = { id, city, x, z, w, d, floors, storeyHeight, style, layout,
    bounds: { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: baseY - 0.16, maxY: baseY + floors * storeyHeight + (rooftop ? 3 : 0.2) },
    entry: [x, baseY, z + d / 2], levels: [], supports: [], ceilings: [], solids: [], pieces: [], route: [], safePoints: [], categoryPositions: [] };
  if (baseY) b.baseY = baseY; // omitted at ground level: existing plans keep their exact records
  const back = -d / 2, front = d / 2;
  const left = -w / 2 + 0.45, right = left + 4.6, divider = right + 0.25;
  const laneA = left + 1, laneB = right - 1;
  const start = 2.2, end = -0.2, rear = -1.8, landingFront = 3.8, run = start - end, rise = storeyHeight / 2;
  const bounds = (u, v, ww, dd) => ({ minX: x + u - ww / 2, maxX: x + u + ww / 2, minZ: z + v - dd / 2, maxZ: z + v + dd / 2 });
  const support = (u, v, ww, dd, y, level, kind = 'floor', slopeZ = 0, startZ = z + v) => {
    const s = { ...bounds(u, v, ww, dd), id: `${id}-support-${b.supports.length}`, y, level, kind, slopeZ, startZ };
    b.supports.push(s); return s;
  };
  const piece = (level, role, color, u, y, v, ww, hh, dd, { solid = false, overhead = false, owner = level, rotationX = 0 } = {}) => {
    const p = { id: `${id}-${role}-${b.pieces.length}`, level: owner, role, color,
      position: [x + u, y + hh / 2, z + v], size: [ww, hh, dd], rotationX,
      ...bounds(u, v, ww, dd), minY: y, maxY: y + hh, buildingId: id, interiorId: `${id}-level-${owner}` };
    if (rotationX) {
      const ey = (Math.abs(hh * Math.cos(rotationX)) + Math.abs(dd * Math.sin(rotationX))) / 2;
      const ez = (Math.abs(dd * Math.cos(rotationX)) + Math.abs(hh * Math.sin(rotationX))) / 2;
      p.minY = p.position[1] - ey; p.maxY = p.position[1] + ey;
      p.minZ = p.position[2] - ez; p.maxZ = p.position[2] + ez;
    }
    if (role === 'wall') p.cutawayPlane = ww <= dd ? { axis: 'x', at: x + u } : { axis: 'z', at: z + v };
    b.pieces.push(p);
    if (solid) b.solids.push(p);
    if (overhead) b.ceilings.push(p);
    return p;
  };
  const slab = (level, u, v, ww, dd, y, kind = 'floor', owner = level - 1) => {
    support(u, v, ww, dd, y, level, kind);
    const p = piece(level, 'slab', 'floor', u, y - 0.16, v, ww, 0.20, dd, { overhead: true, owner: Math.max(0, owner) });
    p.cutaway = level === 0 && y === baseY ? 'base' : kind === 'half-landing' ? 'content' : 'roof';
    return p;
  };
  const point = (u, y, v, kind) => ({ x: x + u, y, z: z + v, kind });
  const walk = (u, y, v, kind) => b.route.push(point(u, y, v, kind));
  const prop = (room, kind, u, y, v, ww, hh, dd, color = 'wood', solid = true) => {
    const mesh = piece(room.level, 'furniture', color, u, y, v, ww, hh, dd, { solid });
    room.furniture.push({ kind, position: [x + u, y, z + v], size: [ww, hh, dd], pieceIds: [mesh.id] });
    return mesh;
  };
  const wall = (room, u, v, ww, dd, hh = storeyHeight - 0.16, bottom = room.floorY, color = 'plaster') =>
    piece(room.level, 'wall', color, u, bottom, v, ww, hh, dd, { solid: true });
  const lintel = (room, u, v, ww, dd) => {
    const p = wall(room, u, v, ww, dd, storeyHeight - 2.6 - 0.16, room.floorY + 2.6, 'trim');
    b.ceilings.push(p); return p;
  };
  // A real window opening: sill/spandrel, lintel, jambs, glass and mullions.
  const windowWall = (room, axis, fixed, lo, hi) => {
    const span = hi - lo, middle = (lo + hi) / 2, aperture = Math.min(2.4, span - 0.8), side = (span - aperture) / 2;
    const part = (along, y, length, h, color, solid = true) => {
      const p = piece(room.level, 'wall', color,
        axis === 'x' ? along : fixed, y, axis === 'x' ? fixed : along,
        axis === 'x' ? length : 0.20, h, axis === 'x' ? 0.20 : length, { solid });
      // Narrow jambs/mullions still belong to the authored window plane.
      p.cutawayPlane = axis === 'x' ? { axis: 'z', at: z + fixed } : { axis: 'x', at: x + fixed };
      return p;
    };
    part(middle, room.floorY, span, 0.95, 'plaster');
    part(middle, room.floorY + 2.55, span, storeyHeight - 2.71, 'plaster');
    for (const sign of [-1, 1]) part(middle + sign * (aperture / 2 + side / 2), room.floorY + 0.95, side, 1.6, 'plaster');
    part(middle, room.floorY + 0.95, aperture, 1.6, 'glass');
    part(middle, room.floorY + 0.95, 0.055, 1.6, 'trim', false);
    for (const y of [0.95, 1.75, 2.5]) part(middle, room.floorY + y, aperture, 0.055, 'trim', false);
  };

  // A trainee dorm flat (Seoul girls' dorm, canon/cohort.ts DORM_ROOMS): three
  // bunk rooms off a short corridor, one bathroom, a kitchen table and the dorm
  // manager's desk by the door. Room B's lower bunk is the player's bed.
  const bunk = (room, u, v, { mine = false, lower = 'linen', upper = 'accent' } = {}) => {
    const y = room.floorY, ww = 1, dd = 2.05;
    prop(room, 'bunk-frame', u, y, v, ww, 0.3, dd);
    prop(room, mine ? 'your-bunk' : 'bunk-mattress', u, y + 0.3, v, ww - 0.06, 0.2, dd - 0.08, lower, false);
    prop(room, 'bunk-deck', u, y + 1.5, v, ww, 0.1, dd);
    prop(room, 'bunk-mattress-upper', u, y + 1.6, v, ww - 0.06, 0.18, dd - 0.08, upper, false);
    for (const du of [-1, 1]) for (const dv of [-1, 1]) prop(room, 'bunk-post', u + du * (ww / 2 - 0.03), y, v + dv * (dd / 2 - 0.03), 0.06, 2.05, 0.06, 'trim');
    for (let i = 1; i <= 4; i++) prop(room, 'bunk-ladder-rung', u - ww / 2 - 0.02, y + i * 0.33, v + dd / 2 - 0.3, 0.04, 0.035, 0.4, 'trim', false);
  };
  const single = (room, u, v, { stripped = false } = {}) => {
    const y = room.floorY;
    prop(room, 'single-frame', u, y, v, 1, 0.32, 2.05);
    prop(room, stripped ? 'stripped-mattress' : 'single-mattress', u, y + 0.32, v, 0.94, 0.18, 1.97, stripped ? 'stone' : 'linen', false);
    if (!stripped) prop(room, 'single-duvet', u, y + 0.5, v + 0.25, 0.96, 0.08, 1.4, 'accent', false);
    else prop(room, 'name-tape-mark', u, y + 0.2, v + 1.035, 0.3, 0.05, 0.01, 'linen', false);
  };
  const doorway = (room, axis, at, lo, hi, from, to) => {
    // Wall along `axis` at `at` from `from` to `to`, with an open doorway lo–hi and a lintel.
    const seg = (a, c) => c - a > 0.01 && (axis === 'z'
      ? wall(room, (a + c) / 2, at, c - a, 0.16) : wall(room, at, (a + c) / 2, 0.16, c - a));
    seg(from, lo); seg(hi, to);
    if (axis === 'z') lintel(room, (lo + hi) / 2, at, hi - lo, 0.16); else lintel(room, at, (lo + hi) / 2, 0.16, hi - lo);
  };
  const dormFlat = (room) => {
    const y = room.floorY, inner = w / 2 - 0.1;
    // Room C (four trainees) behind the kitchen; corridor; rooms A, B and the bathroom on the right.
    doorway(room, 'z', -1, 0.05, 1.15, divider + 0.09, 2.48);
    wall(room, 2.4, (back + -1) / 2, 0.16, -1 - back);
    doorway(room, 'x', 3.6, -3.5, -2.4, back, -1.88);
    doorway(room, 'x', 3.6, 0.4, 1.5, -1.72, 2.32);
    doorway(room, 'x', 3.6, 3.3, 4.3, 2.48, front);
    wall(room, (3.6 + w / 2) / 2, -1.8, w / 2 - 3.6, 0.16);
    wall(room, (3.6 + w / 2) / 2, 2.4, w / 2 - 3.6, 0.16);
    // Room A: Haeun below, Dohee above; Sua's single, stripped, by the window.
    bunk(room, inner - 0.55, -4.85);
    single(room, 4.3, -4.85, { stripped: true });
    // Room B: you below, Daon above; Boram's single by the window.
    bunk(room, inner - 0.55, 0.3, { mine: room.level === 1 });
    prop(room, 'poster', inner - 0.04, y + 1.95, 0.3, 0.02, 0.5, 0.7, 'accent', false);
    single(room, 4.3, -0.7);
    // Room C: two bunks and a shared desk.
    bunk(room, divider + 0.65, -4.85);
    bunk(room, 1.85, -4.85);
    prop(room, 'study-desk', 0.4, y, back + 0.45, 0.9, 0.75, 0.6);
    // Kitchen and living: fridge, counter with the rice cooker, table and stools.
    prop(room, 'fridge', divider + 0.45, y, -0.57, 0.7, 1.8, 0.7, 'linen');
    prop(room, 'kitchen-cabinets', divider + 0.45, y, 0.55, 0.7, 0.9, 1.5, 'accent');
    prop(room, 'kitchen-worktop', divider + 0.45, y + 0.9, 0.55, 0.76, 0.06, 1.54, 'stone');
    prop(room, 'rice-cooker', divider + 0.45, y + 0.96, 0.9, 0.32, 0.28, 0.32, 'white', false);
    prop(room, 'kitchen-table', 0.9, y, 1.3, 1.4, 0.75, 0.8, 'wood');
    for (const [u, v] of [[0.5, 0.6], [1.3, 0.6], [0.5, 2.0], [1.3, 2.0]]) prop(room, 'stool', u, y, v, 0.35, 0.45, 0.35, 'plastic');
    prop(room, 'whiteboard', 1.8, y + 1.0, -0.9, 1.1, 0.85, 0.03, 'white', false);
    for (const dy of [0.2, 0.4, 0.6]) prop(room, 'whiteboard-rota', 1.75, y + 1.0 + dy, -0.885, 0.8, 0.02, 0.01, 'dark', false);
    prop(room, 'drying-rack', 1.9, y, 4.6, 0.6, 1.1, 1.2, 'trim');
    // By the door: the shoe pile and Manager Choi's desk.
    prop(room, 'shoe-rack', divider + 0.5, y, 4.9, 0.8, 0.45, 0.4, 'wood');
    for (const [u, v] of [[-1.15, 4.2], [-0.8, 4.35], [-1.3, 4.5], [-0.95, 4.0]]) prop(room, 'shoe-pair', u, y, v, 0.22, 0.1, 0.28, 'dark', false);
    prop(room, 'manager-desk', 0.4, y, 4.7, 1.4, 0.75, 0.7, 'wood');
    prop(room, 'night-check-clipboard', 0.6, y + 0.75, 4.7, 0.25, 0.02, 0.32, 'linen', false);
    // Bathroom: washing machine, vanity, toilet and shower.
    prop(room, 'washing-machine', 4.3, y, 2.85, 0.64, 0.85, 0.6, 'white');
    prop(room, 'bath-vanity', 4.4, y, 5.5, 1.2, 0.85, 0.7, 'accent');
    prop(room, 'bath-basin', 4.4, y + 0.85, 5.5, 1, 0.12, 0.6, 'linen');
    prop(room, 'toilet-seat', 6.4, y, 5.3, 0.6, 0.45, 0.75, 'stone');
    prop(room, 'shower-tray', 6.2, y, 3.2, 1.2, 0.1, 1.2, 'linen');
    room.zones.push(
      { kind: 'bedroom', name: 'room_a', ...bounds((3.6 + w / 2) / 2, (back - 1.8) / 2, w / 2 - 3.6, -1.8 - back) },
      { kind: 'bedroom', name: 'room_b', ...bounds((3.6 + w / 2) / 2, 0.3, w / 2 - 3.6, 4.2) },
      { kind: 'bathroom', ...bounds((3.6 + w / 2) / 2, (2.4 + front) / 2, w / 2 - 3.6, front - 2.4) },
      { kind: 'bedroom', name: 'room_c', ...bounds((divider + 2.4) / 2, (back - 1) / 2, 2.4 - divider, -1 - back) },
      { kind: 'living-kitchen', ...bounds((divider + 3.6) / 2, 2.5, 3.6 - divider, 7) });
    b.categoryPositions.push(point(5.4, y, 0.6, 'bedside'), point(4.6, y, 3.8, 'bathroom'), point(-0.4, y, 0.2, 'kitchen'));
  };


  // Onsae Entertainment (docs/seoul-first-day.md): 1F lobby; 2F a corridor with
  // practice rooms A (the mirror wall) and B (small, behind the stairwell); 3F
  // lockers, vocal booth and lounge. Same stairwell as the homes; nobody on staff.
  const agencyLevel = (room) => {
    const y = room.floorY, level = room.level, P = 0.3, H = storeyHeight - 0.16;
    const rect = (u0, u1, v0, v1) => bounds((u0 + u1) / 2, (v0 + v1) / 2, u1 - u0, v1 - v0);
    const zone = (name, u0, u1, v0, v1, kind = name) => room.zones.push({ kind, name, ...rect(u0, u1, v0, v1) });
    const put = (kind, u, dy, v, ww, hh, dd, color = 'wood', solid = true) => prop(room, kind, u, y + dy, v, ww, hh, dd, color, solid);
    const deco = (kind, u, dy, v, ww, hh, dd, color) => put(kind, u, dy, v, ww, hh, dd, color, false);
    // A wall run along u (at v = `at`) or along v (at u = `at`) with open doorways and lintels.
    const run = (along, at, from, to, doors = [], thick = 0.16) => {
      const seg = (a, c) => c - a > 0.01 && (along === 'u' ? wall(room, (a + c) / 2, at, c - a, thick) : wall(room, at, (a + c) / 2, thick, c - a));
      let a = from;
      for (const [lo, hi] of doors) {
        seg(a, lo); a = hi;
        if (along === 'u') lintel(room, (lo + hi) / 2, at, hi - lo, thick); else lintel(room, at, (lo + hi) / 2, thick, hi - lo);
      }
      seg(a, to);
    };
    const outer = (along, at, lo, hi, glazed) => glazed ? windowWall(room, along === 'u' ? 'x' : 'z', at, lo, hi) : run(along, at, lo, hi, [], 0.2);
    // One flat piece in an authored wall plane (glass fronts, panels, canopies).
    const inPlane = (along, at, mid, dy, length, hh, color, solid = true, thick = 0.2) => {
      const p = piece(level, 'wall', color, along === 'u' ? mid : at, y + dy, along === 'u' ? at : mid,
        along === 'u' ? length : thick, hh, along === 'u' ? thick : length, { solid });
      p.cutawayPlane = along === 'u' ? { axis: 'z', at: z + at } : { axis: 'x', at: x + at };
      return p;
    };
    const ceilingLight = (u, v, ww, dd) => { piece(level, 'ceiling-light', 'panel', u, y + H - 0.06, v, ww, 0.05, dd).cutaway = 'roof'; };
    const plantPot = (u, v) => { put('plant-pot', u, 0, v, 0.42, 0.42, 0.42, 'pot'); room.plants.push([x + u, y + 0.42, z + v]); };
    const shoes = (u, v, color = 'dark', along = 'v') => deco('shoe-pair', u, 0.04, v, along === 'v' ? 0.22 : 0.28, 0.1, along === 'v' ? 0.28 : 0.22, color);
    const vending = (u, v, face) => { // face: [du, dv] of the lit front
      const deep = 0.75, wide = 0.95, alongV = face[0] !== 0;
      put('vending-machine', u, 0, v, alongV ? deep : wide, 1.9, alongV ? wide : deep, 'red');
      deco('vending-window', u + face[0] * (deep / 2 + 0.01), 0.75, v + face[1] * (deep / 2 + 0.01), alongV ? 0.02 : 0.7, 1, alongV ? 0.7 : 0.02, 'panel');
      for (let i = 0; i < 4; i++) deco('vending-can', u + face[0] * (deep / 2 + 0.03) + (alongV ? 0 : -0.24 + i * 0.16), 1.3, v + face[1] * (deep / 2 + 0.03) + (alongV ? -0.24 + i * 0.16 : 0), alongV ? 0.02 : 0.09, 0.16, alongV ? 0.09 : 0.02, ['blue', 'mustard', 'green', 'rose'][i]);
    };
    const sofa = (u, v, length, facing, color = 'accent') => { // facing: 'w' (back to the east wall) or 's' (back to a +v wall, looking -v)
      const alongV = facing === 'w', ww = alongV ? 0.85 : length, dd = alongV ? length : 0.85;
      put('sofa-base', u, 0, v, ww, 0.42, dd, 'wood');
      put('sofa-cushion', u, 0.42, v, ww, 0.16, dd, color, false);
      if (alongV) put('sofa-back', u + 0.34, 0.42, v, 0.18, 0.62, length, color); else put('sofa-back', u, 0.42, v + 0.34, length, 0.62, 0.18, color);
      for (const s of [-1, 1]) if (alongV) put('sofa-arm', u, 0.42, v + s * (length / 2 - 0.08), 0.85, 0.3, 0.16, color, false); else put('sofa-arm', u + s * (length / 2 - 0.08), 0.42, v, 0.16, 0.3, 0.85, color, false);
      deco('sofa-pillow', alongV ? u + 0.1 : u - length / 4, 0.58, alongV ? v - length / 4 : v + 0.1, 0.36, 0.3, 0.36, 'mustard');
    };
    room.category = 'studio'; room.staff = null; room.plants = [];
    room.center = [x + 2.6, y, z + 0.6];
    if (level) room.door = [x + divider, y, z + 3.25];

    // Shell. The stair hall keeps its door on every floor; the bay behind the
    // stairwell is closed off at ground level and a room upstairs.
    outer('v', -w / 2, -1.9, front, true);
    run('u', -1.9, -w / 2 + 0.1, divider, [], 0.12);
    run('v', divider, back, front, level === 2 ? [[-4.4, -3.3], [-3, -2.1], [2.35, 4.15]] : level ? [[-4.4, -3.3], [2.35, 4.15]] : [[2.35, 4.15]], 0.18);
    deco('door-leaf', divider + 0.13, 0, 1.9, 0.05, 2.45, 0.88, 'wood');
    zone('stairs', -w / 2 + 0.1, divider, -1.9, front - 0.1);
    ceilingLight(-4.25, 4.1, 2.4, 0.35);

    if (!level) {
      outer('u', back, -w / 2, w / 2, false);
      outer('v', -w / 2, back, -1.9, false);
      outer('v', w / 2, back, 0.6, false); outer('v', w / 2, 0.6, front, true);
      // Glass front: plinth, tall panes, a dark header for the fascia, open double doors.
      for (const [lo, hi] of [[-w / 2, -1.1], [1.1, w / 2]]) {
        const span = hi - lo, mid = (lo + hi) / 2, n = Math.round(span / 1.5);
        inPlane('u', front, mid, 0, span, 0.3, 'trim');
        inPlane('u', front, mid, 0.3, span, 2.3, 'glass', true, 0.08);
        inPlane('u', front, mid, 2.6, span, H - 2.6, 'trim');
        for (let i = 0; i <= n; i++) inPlane('u', front, lo + span * i / n, 0.3, 0.09, 2.3, 'trim', false, 0.14);
      }
      lintel(room, 0, front, 2.2, 0.2);
      for (const s of [-1, 1]) {
        deco('glass-door', s * 1.06, 0.02, front - 0.5, 0.05, 2.5, 0.95, 'glass');
        deco('door-handle', s * 1.02, 0.95, front - 0.85, 0.05, 0.4, 0.04, 'gold');
        inPlane('u', front + 0.16, s * 1.5, 1.85, 0.14, 0.34, 'bulb', false, 0.1);
        put('street-planter', s * 3.4, 0, front + 0.5, 2.2, 0.5, 0.5, 'trim');
        deco('street-planter-greens', s * 3.4, 0.5, front + 0.5, 2.05, 0.28, 0.38, 'green');
      }
      inPlane('u', front + 0.55, 0, 2.5, 3.4, 0.09, 'trim', false, 0.9); // canopy
      deco('door-mat', 0, 0.045, front - 0.9, 1.9, 0.015, 1, 'rug2');

      // Reception: nobody behind it. A bell, a dark monitor and an empty chair.
      put('reception-desk', 4.6, 0, -1.2, 0.8, 1.05, 2.8, 'wood');
      deco('reception-front', 4.19, 0.08, -1.2, 0.03, 0.9, 2.6, 'trim');
      deco('reception-top', 4.6, 1.05, -1.2, 0.92, 0.05, 2.92, 'stone');
      deco('reception-monitor', 4.8, 1.1, -1.75, 0.05, 0.34, 0.52, 'black');
      deco('reception-bell', 4.45, 1.1, -0.55, 0.11, 0.06, 0.11, 'gold');
      put('reception-chair', 5.65, 0, -1.2, 0.5, 0.46, 0.5, 'dark');
      deco('reception-chair-back', 5.88, 0.46, -1.2, 0.07, 0.5, 0.48, 'dark');
      // Waiting corner by the front window.
      sofa(6.3, 3.3, 2.3, 'w');
      put('low-table', 5.05, 0, 3.3, 0.6, 0.38, 1.1, 'wood');
      deco('magazine', 5.05, 0.38, 3.05, 0.22, 0.02, 0.3, 'linen');
      deco('magazine', 5.1, 0.38, 3.55, 0.22, 0.02, 0.3, 'rose');
      deco('lobby-rug', 5.5, 0.045, 3.3, 2.6, 0.015, 3.2, 'rug');
      // Trophies along the stair wall.
      put('trophy-cabinet', -1.37, 0, -3.6, 0.45, 0.95, 2.4, 'wood');
      deco('trophy-shelf', -1.45, 1.5, -3.6, 0.3, 0.05, 2.4, 'wood');
      for (const [dv, dy, hh] of [[-0.9, 0.95, 0.34], [-0.3, 0.95, 0.24], [0.35, 0.95, 0.42], [0.9, 0.95, 0.2], [-0.7, 1.55, 0.26], [0, 1.55, 0.36], [0.7, 1.55, 0.22]]) {
        deco('trophy-base', -1.4, dy, -3.6 + dv, 0.18, 0.05, 0.18, 'dark');
        deco('trophy', -1.4, dy + 0.05, -3.6 + dv, 0.11, hh, 0.11, 'gold');
      }
      deco('artist-wall-rail', 2.3, 2.9, back + 0.16, 7.2, 0.05, 0.08, 'bulb');
      vending(6.4, -5.3, [-1, 0]);
      put('water-cooler', -1.3, 0, 5.4, 0.36, 1, 0.36, 'white');
      deco('water-cooler-bottle', -1.3, 1, 5.4, 0.27, 0.42, 0.27, 'water');
      plantPot(1.9, 5.4); plantPot(6.45, 5.4); plantPot(-1.2, -5.45);
      for (const v of [-3.2, 0.6, 4.2]) ceilingLight(2.6, v, 3.2, 0.36);
      zone('lobby', divider, w / 2 - 0.1, back + 0.1, front - 0.1);
    } else if (level === 1) {
      outer('u', back, -w / 2, divider, false); outer('u', back, divider, P, true); outer('u', back, P, w / 2, false);
      outer('v', -w / 2, back, -1.9, true);
      outer('v', w / 2, back, front, false);
      outer('u', front, -w / 2, divider, true); outer('u', front, divider, P, true);
      outer('u', front, P, 3.65, true); outer('u', front, 3.65, w / 2, true);
      run('v', P, back, front, [[0.4, 1.8]]);
      deco('door-leaf', P + 0.12, 0, 2.25, 0.05, 2.45, 0.88, 'wood');
      // Corridor: a bench under the front window, shoes outside the practice room.
      put('corridor-bench', -0.7, 0, 5.4, 1.5, 0.45, 0.5, 'wood');
      deco('corridor-bench-cushion', -0.7, 0.45, 5.4, 1.4, 0.06, 0.44, 'accent');
      plantPot(-0.7, -5.45);
      shoes(0.02, 2.1); shoes(0.02, 2.45, 'white'); shoes(0.0, 2.8, 'rose'); shoes(0.03, 0.05, 'white'); shoes(0.0, -0.3);
      for (const v of [-3.6, 0.8, 4.4]) ceilingLight(-0.7, v, 0.36, 1.7);
      // Practice room A: barre along the mirror wall, speakers, benches, bags and bottles.
      deco('barre', 6.55, 1.05, 0, 0.05, 0.05, 11, 'steel');
      for (const v of [-5, -2.5, 0, 2.5, 5]) deco('barre-bracket', 6.7, 1.03, v, 0.34, 0.04, 0.04, 'steel');
      for (const [v, color] of [[-3.3, 'rose'], [1.2, 'linen'], [3.6, 'mustard']]) deco('towel', 6.55, 0.74, v, 0.07, 0.34, 0.32, color);
      for (const v of [-5.35, 5.35]) {
        put('speaker', 6.45, 0, v, 0.5, 1.1, 0.5, 'black');
        deco('speaker-cone', 6.19, 0.62, v, 0.02, 0.3, 0.3, 'dark');
        deco('speaker-cone', 6.19, 0.2, v, 0.02, 0.34, 0.34, 'dark');
      }
      put('window-bench', 3.6, 0, 5.5, 3.2, 0.45, 0.5, 'wood');
      for (const [u, color] of [[2.5, 'linen'], [2.9, 'rose'], [4.6, 'navy']]) deco('folded-towel', u, 0.45, 5.5, 0.34, 0.1, 0.3, color);
      deco('gym-bag', 3.8, 0.45, 5.5, 0.55, 0.26, 0.3, 'accent');
      put('audio-rack', 0.85, 0, -5.5, 0.6, 0.9, 0.5, 'black');
      deco('audio-deck', 0.85, 0.9, -5.5, 0.5, 0.08, 0.4, 'steel');
      deco('audio-light', 0.85, 0.6, -5.24, 0.4, 0.04, 0.02, 'bulb');
      for (const [v, color] of [[-1.3, 'water'], [-1.6, 'rose'], [-1.9, 'water'], [-2.2, 'mustard'], [-2.5, 'water']]) deco('water-bottle', 0.55, 0.04, v, 0.08, 0.24, 0.08, color);
      deco('gym-bag', 0.7, 0.04, -3.4, 0.32, 0.28, 0.55, 'navy');
      deco('gym-bag', 0.7, 0.04, -4.2, 0.32, 0.26, 0.5, 'accent');
      deco('gym-bag', 0.7, 0.04, 4.6, 0.32, 0.28, 0.55, 'green');
      for (const v of [-3.9, 0, 3.9]) ceilingLight(3.5, v, 5, 0.4);
      // Practice room B: a mirror panel, one speaker, a bottle and a towel on the floor.
      deco('mirror-panel', -4.3, 0.25, back + 0.12, 4.5, 2.3, 0.03, 'mirror');
      deco('mirror-frame', -4.3, 0.18, back + 0.115, 4.62, 0.07, 0.04, 'trim');
      deco('mirror-frame', -4.3, 2.55, back + 0.115, 4.62, 0.07, 0.04, 'trim');
      put('speaker', -6.45, 0, -2.45, 0.45, 1, 0.45, 'black');
      deco('speaker-cone', -6.45, 0.55, -2.69, 0.3, 0.3, 0.02, 'dark');
      deco('water-bottle', -5.3, 0.04, -2.25, 0.08, 0.24, 0.08, 'water');
      deco('towel-on-floor', -4.95, 0.04, -2.3, 0.46, 0.04, 0.3, 'rose');
      deco('gym-bag', -2.25, 0.04, -5.4, 0.5, 0.26, 0.3, 'navy');
      shoes(-1.45, -3.0, 'white', 'u');
      ceilingLight(-4.3, -3.9, 2.6, 0.36);
      zone('corridor2', divider, P, back + 0.1, front - 0.1);
      zone('practice_a', P, w / 2 - 0.1, back + 0.1, front - 0.1);
      zone('practice_b', -w / 2 + 0.1, divider, back + 0.1, -1.9);
    } else {
      outer('u', back, -w / 2, divider, false); outer('u', back, divider, P, true);
      outer('u', back, P, 3.65, true); outer('u', back, 3.65, w / 2, true);
      outer('v', -w / 2, back, -1.9, false);
      outer('v', w / 2, back, 0, true); outer('v', w / 2, 0, front, true);
      outer('u', front, -w / 2, divider, true); outer('u', front, divider, P, true);
      outer('u', front, P, 3.65, true); outer('u', front, 3.65, w / 2, true);
      run('v', P, back, front, [[-3, -1.8], [2.6, 3.9]]);
      run('u', 0, P, w / 2 - 0.1, []);
      for (const [u, v] of [[P + 0.12, 2.15], [P + 0.12, -3.45], [divider - 0.13, -4.85]]) deco('door-leaf', u, 0, v, 0.05, 2.45, 0.88, 'wood');
      // The vocal booth's glass panel on the corridor.
      wall(room, divider, -2.55, 0.18, 0.9, 0.95);
      inPlane('v', divider, -2.55, 0.95, 0.9, 1.65, 'glass', true, 0.05);
      inPlane('v', divider, -2.55, 0.95, 0.9, 0.05, 'trim', false, 0.2);
      // Corridor: shoe rack by the locker room, a plant at the window.
      put('shoe-rack', 0.03, 0, 4.9, 0.36, 0.5, 1.1, 'wood');
      shoes(0.03, 4.6, 'white'); shoes(0.03, 5.0); shoes(0.03, 5.3, 'rose');
      for (const [v, color] of [[4.55, 'dark'], [4.95, 'white'], [5.3, 'mustard']]) deco('shoe-pair', 0.03, 0.5, v, 0.22, 0.1, 0.28, color);
      plantPot(-0.7, 5.45); plantPot(-0.7, -5.45);
      for (const v of [-3.6, 0.8, 4.4]) ceilingLight(-0.7, v, 0.36, 1.7);
      // Lockers: a bank of seven on the inner wall; the middle one is the player's.
      for (let i = 0; i < 7; i++) {
        const u = 1.8 + i * 0.6;
        put(i === 3 ? 'your-locker' : 'locker', u, 0.06, 0.33, 0.58, 1.84, 0.5, 'locker');
        deco('locker-handle', u + 0.18, 0.95, 0.595, 0.04, 0.2, 0.03, 'steel');
        for (let vent = 0; vent < 3; vent++) deco('locker-vent', u, 1.36 + vent * 0.06, 0.585, 0.3, 0.02, 0.012, 'dark');
      }
      put('locker-plinth', 3.6, 0, 0.33, 4.2, 0.06, 0.5, 'dark');
      deco('locker-top-box', 2.1, 1.9, 0.33, 0.5, 0.26, 0.38, 'linen');
      deco('locker-top-box', 5.0, 1.9, 0.33, 0.44, 0.2, 0.36, 'accent');
      put('locker-bench', 4.1, 0, 3.6, 2.4, 0.45, 0.45, 'wood');
      deco('gym-bag', 4.7, 0.45, 3.6, 0.55, 0.26, 0.3, 'navy');
      deco('folded-towel', 3.4, 0.45, 3.6, 0.34, 0.1, 0.3, 'linen');
      shoes(3.3, 3.2, 'white', 'u'); shoes(4.3, 3.2, 'dark', 'u'); shoes(5.0, 4.05, 'rose', 'u');
      for (const [v, color] of [[4.5, 'rose'], [4.95, 'linen'], [5.4, 'mustard']]) {
        deco('towel-hook', P + 0.11, 1.65, v, 0.06, 0.04, 0.04, 'steel');
        deco('hanging-towel', P + 0.12, 1.05, v, 0.04, 0.6, 0.3, color);
      }
      put('laundry-basket', 6.4, 0, 0.5, 0.5, 0.6, 0.5, 'linen');
      deco('bathroom-scale', 6.3, 0.04, 5.2, 0.34, 0.05, 0.34, 'white');
      deco('locker-rug', 3.6, 0.045, 2.1, 3.6, 0.015, 1.5, 'rug2');
      for (const v of [1.6, 4.3]) ceilingLight(3.6, v, 4.4, 0.38);
      // Lounge: sofa facing the river windows, vending machine, kettle counter.
      sofa(4.2, -0.6, 2.4, 's');
      put('low-table', 4.2, 0, -2.1, 1.1, 0.38, 0.6, 'wood');
      deco('mug', 3.95, 0.38, -2.1, 0.1, 0.1, 0.1, 'white'); deco('mug', 4.5, 0.38, -2.0, 0.1, 0.1, 0.1, 'rose');
      put('bean-bag', 2.2, 0, -3.7, 0.8, 0.42, 0.8, 'mustard');
      deco('lounge-rug', 4, 0.045, -2.3, 3.6, 0.015, 2.6, 'rug');
      put('lounge-counter', 6.55, 0, -3.6, 0.6, 0.9, 2.2, 'accent');
      deco('lounge-worktop', 6.55, 0.9, -3.6, 0.66, 0.05, 2.26, 'stone');
      deco('kettle-base', 6.55, 0.95, -3, 0.2, 0.03, 0.2, 'dark');
      deco('kettle', 6.55, 0.98, -3, 0.16, 0.22, 0.16, 'steel');
      deco('microwave', 6.55, 0.95, -4.2, 0.4, 0.28, 0.5, 'black');
      for (const [v, color] of [[-3.3, 'white'], [-3.5, 'white'], [-3.7, 'rose']]) deco('cup', 6.5, 0.95, v, 0.09, 0.1, 0.09, color);
      for (const v of [-2.75, -2.6]) deco('ramen-cup', 6.6, 0.95, v, 0.11, 0.12, 0.11, 'red');
      vending(0.84, -5.2, [1, 0]);
      plantPot(6.45, -5.45);
      for (let i = 0; i < 9; i++) deco('string-bulb', 2.2 + i * 0.5, 2.3 - Math.abs(i - 4) * 0.02, -0.12, 0.07, 0.1, 0.07, 'bulb');
      for (const v of [-1.6, -4.3]) ceilingLight(3.6, v, 4.4, 0.38);
      // Vocal booth: foam on the walls, mic and pop filter, keyboard, a lamp.
      for (let i = 0; i < 5; i++) deco('acoustic-foam', -6.1 + i * 0.9, 0.9 + (i % 2) * 0.45, back + 0.13, 0.8, 0.8, 0.06, i % 2 ? 'accent' : 'foam');
      for (let i = 0; i < 3; i++) deco('acoustic-foam', -w / 2 + 0.13, 0.9 + (i % 2) * 0.45, -5.2 + i * 0.9, 0.06, 0.8, 0.8, i % 2 ? 'foam' : 'accent');
      put('mic-stand-base', -4.4, 0, -4.2, 0.3, 0.04, 0.3, 'black');
      deco('mic-stand-pole', -4.4, 0.04, -4.2, 0.03, 1.42, 0.03, 'steel');
      deco('microphone', -4.4, 1.46, -4.16, 0.06, 0.07, 0.17, 'black');
      deco('pop-filter', -4.4, 1.41, -4.0, 0.17, 0.17, 0.012, 'dark');
      put('keyboard-stand', -6.4, 0, -3.3, 0.3, 0.74, 1.2, 'dark');
      deco('keyboard', -6.4, 0.74, -3.3, 0.36, 0.08, 1.3, 'black');
      deco('keyboard-keys', -6.34, 0.82, -3.3, 0.16, 0.012, 1.24, 'white');
      put('vocal-stool', -5.75, 0, -3.3, 0.36, 0.46, 0.36, 'wood');
      deco('lyric-sheet', -6.52, 0.86, -3.3, 0.02, 0.26, 0.2, 'linen');
      put('floor-lamp-base', -2.2, 0, -5.45, 0.24, 0.04, 0.24, 'dark');
      deco('floor-lamp-pole', -2.2, 0.04, -5.45, 0.03, 1.35, 0.03, 'dark');
      deco('floor-lamp-shade', -2.2, 1.39, -5.45, 0.3, 0.3, 0.3, 'bulb');
      deco('vocal-rug', -4.3, 0.045, -3.9, 2.6, 0.015, 2, 'rug2');
      ceilingLight(-4.3, -3.9, 2.2, 0.34);
      // The stairwell ends here: close the open side where a flight would go on up.
      piece(level, 'rail', 'trim', (left + laneB - 0.9) / 2, y, start + 0.035, laneB - 0.9 - left, 1.05, 0.07, { solid: true });
      zone('corridor3', divider, P, back + 0.1, front - 0.1);
      zone('lockers', P, w / 2 - 0.1, 0, front - 0.1);
      zone('lounge', P, w / 2 - 0.1, back + 0.1, 0);
      zone('vocal', -w / 2 + 0.1, divider, back + 0.1, -1.9);
    }
    b.safePoints.push(point(level ? -0.7 : 0.8, y, 3.25, level ? 'corridor' : 'lobby'));
    if (level) piece(level, 'rail', 'trim', (left + right) / 2, y, rear - 0.035, right - left, 1.05, 0.07, { solid: true });
    if (level) piece(level, 'rail', 'trim', (laneA + laneB) / 2, y, start, laneB - laneA - 1.8, 1.05, 0.07, { solid: true });
    if (level === floors - 1) {
      piece(level, 'slab', 'roof', 0, y + storeyHeight - 0.16, 0, w + 0.3, 0.24, d + 0.3, { overhead: true }).cutaway = 'roof';
      piece(level, 'roof-trim', 'trim', 0, y + storeyHeight + 0.08, front, w + 0.5, 0.12, 0.26);
      for (const [u, v, ww, dd] of [[0, back, w + 0.3, 0.2], [-w / 2, 0, 0.2, d], [w / 2, 0, 0.2, d]]) piece(level, 'roof-trim', 'trim', u, y + storeyHeight + 0.08, v, ww, 0.5, dd);
    }
  };

  for (let level = 0; level < floors; level++) {
    const y = baseY + level * storeyHeight;
    const room = { id: `${id}-level-${level}`, city, category: 'home', buildingId: id, level, floorY: y,
      bounds: { ...b.bounds, minY: y - 0.025, maxY: y + storeyHeight - 0.026 },
      center: [x + 0.6, y, z + 2.8], door: level ? [x + divider, y, z + 3.25] : [x, y, z + front], furniture: [],
      staff: { spawn: [x + (level ? 0.65 : 3.6), y, z + (level ? 1.1 : -0.4)], yaw: 0,
        role: level ? 'resident' : 'concierge', name: level ? `${city === 'tokyo' ? 'Haru' : city === 'shanghai' ? 'Lin' : 'Min'} ${level}` : 'House keeper',
        greeting: level ? 'Welcome home. Shall we find the kitchen and bedroom?' : 'Welcome! The stairs lead to the homes upstairs.', placeId: id },
      zones: [] };
    b.levels.push(room);
    if (!level) slab(0, 0, 0, w - 0.22, d - 0.22, y);
    else {
      // Four slab rectangles around ONE actual stairwell hole. No collider
      // spans it; the back and front strips connect the landing to the flat.
      slab(level, (right + w / 2 - 0.11) / 2, 0, w / 2 - 0.11 - right, d - 0.22, y);
      slab(level, (-w / 2 + 0.11 + left) / 2, 0, left + w / 2 - 0.11, d - 0.22, y);
      slab(level, (left + right) / 2, (back + 0.11 + rear) / 2, right - left, rear - back - 0.11, y);
      slab(level, (left + right) / 2, (start + front - 0.11) / 2, right - left, front - 0.11 - start, y, 'landing');
    }
    if (agency) { agencyLevel(room); continue; }
    // Side/back fenestration and open 2.2m front doorway with physical lintel.
    windowWall(room, 'x', back, -w / 2, w / 2);
    for (const u of [-w / 2, w / 2]) windowWall(room, 'z', u, back, front);
    for (const sign of [-1, 1]) {
      windowWall(room, 'x', front, sign < 0 ? -w / 2 : 1.1, sign < 0 ? -1.1 : w / 2);
    }
    if (!level) lintel(room, 0, front, 2.2, 0.2);
    else wall(room, 0, front, 2.2, 0.2); // upper front isn't a balcony exit.

    // Stair hall / home wall has a genuine 1.8m open doorway on the landing.
    wall(room, divider, (back + 2.35) / 2, 0.18, 2.35 - back);
    if (front > 4.15) wall(room, divider, (4.15 + front) / 2, 0.18, front - 4.15);
    lintel(room, divider, 3.25, 0.18, 1.8);
    // Open door leaf folds against the jamb, never across the passage.
    piece(level, 'wall', 'wood', divider + 0.20, y, 1.925, 0.08, 2.45, 0.85, { solid: true });

    if (!level) {
      prop(room, 'mailbox-bank', 0.7, y + 0.7, back + 0.35, 2.5, 1.15, 0.38, 'trim');
      for (let row = 0; row < 3; row++) for (let col = 0; col < 6; col++)
        prop(room, 'mailbox-door', -0.3 + col * 0.4, y + 0.77 + row * 0.33, back + 0.56, 0.32, 0.26, 0.03, 'accent', false);
      prop(room, 'shared-bench-seat', 5.8, y + 0.35, 1.5, 0.65, 0.16, 2.4);
      prop(room, 'shared-bench-base', 5.8, y, 1.5, 0.4, 0.35, 2.2, 'trim');
      prop(room, 'concierge-desk', 4.4, y, -2, 2.2, 0.95, 0.8);
      prop(room, 'guestbook', 4.2, y + 0.95, -2, 0.5, 0.04, 0.35, 'linen', false);
      prop(room, 'storage-cabinet', 6, y, back + 0.55, 1.1, 1.9, 0.7, 'accent');
      room.zones.push({ kind: 'lobby', ...bounds(1.8, 0, 9, d - 0.5) });
    } else if (layout === 'dorm') {
      dormFlat(room);
      room.staff = level === 1
        ? { spawn: [x + 0.4, y, z + 5.45], yaw: Math.PI, role: 'manager', name: '최 실장 · Manager Choi', greeting: '통금은 열한 시예요.', placeId: id }
        : { spawn: [x - 0.4, y, z + 2.2], yaw: Math.PI / 2, role: 'resident', name: '연습생 · Trainee (another unit)', greeting: '안녕하세요~', placeId: id };
    } else {
      // Right wing: bedroom behind, bathroom in front, both with open doors.
      for (const [lo, hi] of [[back, -2.1], [-0.5, 0.5], [2.1, front]]) wall(room, 2.4, (lo + hi) / 2, 0.16, hi - lo);
      for (const v of [-1.3, 1.3]) {
        lintel(room, 2.4, v, 0.16, 1.6);
        piece(level, 'wall', 'wood', 2.6, y, v - 1.175, 0.08, 2.4, 0.75, { solid: true });
      }
      wall(room, (2.4 + w / 2) / 2, 0, w / 2 - 2.4, 0.16);
      const bedZ = back + 1.65;
      prop(room, 'bed-frame', 5.25, y, bedZ, 1.85, 0.35, 2.45);
      prop(room, 'mattress', 5.25, y + 0.35, bedZ, 1.8, 0.22, 2.35, 'linen');
      prop(room, 'duvet', 5.25, y + 0.57, bedZ + 0.3, 1.84, 0.13, 1.65, 'accent', false);
      prop(room, 'pillow', 5.25, y + 0.59, bedZ - 0.85, 1.25, 0.18, 0.45, 'linen', false);
      prop(room, 'headboard', 5.25, y, bedZ - 1.25, 2, 1.05, 0.13);
      prop(room, 'wardrobe', 6.3, y, -0.85, 0.9, 2.3, 1.3, 'wood');
      for (const v of [-1.15, -0.6]) prop(room, 'wardrobe-handle', 5.82, y + 1, v, 0.05, 0.25, 0.04, 'trim', false);
      prop(room, 'nightstand', 6.5, y, bedZ - 0.6, 0.6, 0.6, 0.6);
      prop(room, 'bedside-lamp-base', 6.5, y + 0.6, bedZ - 0.6, 0.22, 0.25, 0.22, 'trim', false);
      prop(room, 'bedside-lamp-shade', 6.5, y + 0.85, bedZ - 0.6, 0.4, 0.28, 0.4, 'linen', false);
      prop(room, 'kitchen-cabinets', -0.45, y, back + 0.55, 2.5, 0.9, 0.85, 'accent');
      prop(room, 'kitchen-worktop', -0.45, y + 0.9, back + 0.55, 2.6, 0.08, 0.95, 'stone');
      prop(room, 'sink-basin', -0.9, y + 0.98, back + 0.55, 0.65, 0.05, 0.5, 'trim', false);
      prop(room, 'tap', -0.9, y + 1.03, back + 0.25, 0.06, 0.3, 0.06, 'trim', false);
      for (const u of [0.1, 0.5]) prop(room, 'hob-burner', u, y + 0.98, back + 0.55, 0.28, 0.025, 0.32, 'dark', false);
      prop(room, 'fridge', 1.55, y, back + 0.55, 0.85, 1.9, 0.85, 'linen');
      prop(room, 'fridge-handle', 1.87, y + 0.9, back + 1, 0.05, 0.45, 0.06, 'trim', false);
      prop(room, 'sofa-base', -0.65, y, 0.35, 1.7, 0.42, 0.85, 'wood');
      prop(room, 'sofa-cushion', -0.65, y + 0.42, 0.4, 1.7, 0.18, 0.8, 'accent');
      prop(room, 'sofa-back', -0.65, y + 0.42, -0.04, 1.7, 0.65, 0.18, 'accent');
      prop(room, 'coffee-table', -0.6, y, 1.8, 0.9, 0.5, 0.65, 'wood');
      prop(room, 'teacup', -0.6, y + 0.5, 1.8, 0.12, 0.12, 0.12, 'linen', false);
      prop(room, 'bath-vanity', 3.65, y, front - 0.55, 1.35, 0.85, 0.75, 'accent');
      prop(room, 'bath-basin', 3.65, y + 0.85, front - 0.55, 1.1, 0.15, 0.65, 'linen');
      prop(room, 'bath-mirror', 3.65, y + 1.1, front - 0.18, 1.2, 1.2, 0.04, 'glass', false);
      prop(room, 'toilet-base', 6, y, 1.25, 0.55, 0.38, 0.8, 'linen');
      prop(room, 'toilet-seat', 6, y + 0.38, 1.35, 0.65, 0.1, 0.75, 'stone');
      prop(room, 'toilet-cistern', 6, y + 0.38, 0.8, 0.65, 0.65, 0.3, 'linen');
      prop(room, 'shower-tray', 5.9, y, front - 1, 1.4, 0.12, 1.4, 'linen');
      prop(room, 'shower-screen', 5.15, y + 0.12, front - 1, 0.06, 2.1, 1.4, 'glass');
      prop(room, 'shower-riser', 6.6, y + 0.6, front - 1, 0.05, 1.6, 0.05, 'trim');
      prop(room, 'shower-head', 6.4, y + 2.15, front - 1, 0.45, 0.06, 0.18, 'trim', false);
      prop(room, 'towel-storage', 6.4, y, 2.5, 0.65, 1.45, 0.65, 'wood');
      for (let i = 0; i < 3; i++) prop(room, 'folded-towel', 6.4, y + 1.45 + i * 0.07, 2.5, 0.5, 0.06, 0.4, 'linen', false);
      room.zones.push({ kind: 'bedroom', ...bounds((2.4 + w / 2) / 2, back / 2, w / 2 - 2.4, -back) },
        { kind: 'bathroom', ...bounds((2.4 + w / 2) / 2, front / 2, w / 2 - 2.4, front) },
        { kind: 'living-kitchen', ...bounds((divider + 2.4) / 2, 0, 2.4 - divider, d) });
      b.categoryPositions.push(point(4, y, bedZ, 'bedside'), point(4, y, 1.3, 'bathroom'), point(0.1, y, back + 1.6, 'kitchen'));
    }
    b.safePoints.push(point(0.8, y, 3.25, level ? 'home' : 'lobby'));
    // Keep the exposed rear edge of the stairwell guarded on upper floors.
    if (level) {
      piece(level, 'rail', 'trim', (left + right) / 2, y, rear - 0.035, right - left, 1.05, 0.07, { solid: true });
      piece(level, 'rail', 'trim', (laneA + laneB) / 2, y, start, laneB - laneA - 1.8, 1.05, 0.07, { solid: true });
    }
    if (level === floors - 1 && !rooftop) {
      // Cap roof belongs to top room. Lower rooms own ONLY the next slab.
      piece(level, 'slab', 'roof', 0, y + storeyHeight - 0.16, 0, w + 0.3, 0.24, d + 0.3, { overhead: true }).cutaway = 'roof';
      piece(level, 'roof-trim', 'trim', 0, y + storeyHeight + 0.08, front, w + 0.5, 0.12, 0.26);
    }
  }

  // One switchback per storey; a rooftop adds the top flat's flight to the roof.
  const flights = rooftop ? floors : floors - 1;
  for (let level = 0; level < flights; level++) {
    const y = baseY + level * storeyHeight;
    slab(level, (left + right) / 2, (rear + end) / 2, right - left, end - rear, y + rise, 'half-landing', level);
    for (const [u, a, dir, y0] of [[laneA, start, -1, y], [laneB, end, 1, y + rise]]) {
      support(u, (start + end) / 2, 1.8, run, y0, level, 'stair', dir * rise / run, z + a);
      const steps = 12;
      for (let i = 0; i < steps; i++) {
        const lo = y0 + rise * i / steps, top = y0 + rise * (i + 1) / steps;
        piece(level, 'step', 'stone', u, lo - 0.16, a + dir * (i + 0.5) * run / steps, 1.8, top - lo + 0.16, run / steps, { overhead: true });
        // Repeated nosings read as proper stairs, not an exposed ramp.
        piece(level, 'stair-nosing', 'trim', u, top - 0.025, a + dir * (i + 1) * run / steps, 1.8, 0.025, 0.035);
      }
      for (const side of [-1, 1]) {
        const railX = u + side * 0.94;
        for (let i = 0; i <= 4; i++) piece(level, 'rail', 'trim', railX, y0 + rise * i / 4, a + dir * run * i / 4, 0.07, 1.03, 0.07, { solid: true });
        piece(level, 'rail', 'wood', railX, y0 + rise / 2 + 0.98, (start + end) / 2, 0.085, 0.085, Math.hypot(run, rise), { solid: true, rotationX: -dir * Math.atan(rise / run) });
      }
    }
    piece(level, 'rail', 'trim', (laneA + laneB) / 2, y + rise, end, laneB - laneA - 1.8, 1.05, 0.07, { solid: true });
    // Protective rear landing balustrade, posts plus top rail.
    for (const u of [left + 0.05, laneA, laneB, right - 0.05])
      piece(level, 'rail', 'trim', u, y + rise, rear + 0.05, 0.07, 1, 0.07, { solid: true });
    piece(level, 'rail', 'wood', (left + right) / 2, y + rise + 1, rear + 0.05, right - left, 0.07, 0.07, { solid: true });
  }
  const roofY = baseY + floors * storeyHeight;
  if (rooftop) {
    // Roof terrace: the same four slabs around the continuing stairwell. It is
    // outdoors (zoneAt stops at roofY) but owned by the top flat's cutaway, so
    // it and its dressing hide with the upper structure from inside.
    const top = floors - 1;
    for (const p of [
      slab(floors, (right + w / 2 - 0.11) / 2, 0, w / 2 - 0.11 - right, d - 0.22, roofY),
      slab(floors, (-w / 2 + 0.11 + left) / 2, 0, left + w / 2 - 0.11, d - 0.22, roofY),
      slab(floors, (left + right) / 2, (back + 0.11 + rear) / 2, right - left, rear - back - 0.11, roofY),
      slab(floors, (left + right) / 2, (start + front - 0.11) / 2, right - left, front - 0.11 - start, roofY, 'landing'),
    ]) p.color = 'rooftop';
    const roofPiece = (role, color, u, y, v, ww, hh, dd, solid = true) => {
      const p = piece(top, role, color, u, y, v, ww, hh, dd, { solid });
      p.cutaway = 'roof';
      return p;
    };
    // Parapet continues the outer walls; coping caps it.
    const parapetH = 1.2; // above a standing jump's ~1.09m apex
    for (const [u, v, ww, dd] of [[0, back, w + 0.2, 0.2], [0, front, w + 0.2, 0.2], [-w / 2, 0, 0.2, d], [w / 2, 0, 0.2, d]]) {
      roofPiece('parapet', 'plaster', u, roofY - 0.16, v, ww, parapetH + 0.16, dd);
      roofPiece('roof-trim', 'trim', u, roofY + parapetH, v, ww + 0.12, 0.08, dd + 0.12, false);
    }
    // Guard every open edge of the stairwell except the arriving east flight.
    roofPiece('rail', 'trim', (left + right) / 2, roofY, rear - 0.035, right - left, 1.05, 0.07);
    roofPiece('rail', 'trim', left - 0.035, roofY, (rear + start) / 2, 0.07, 1.05, start - rear);
    roofPiece('rail', 'trim', right + 0.035, roofY, (rear + start) / 2, 0.07, 1.05, start - rear);
    roofPiece('rail', 'trim', (left + laneB - 0.9) / 2, roofY, start + 0.035, laneB - 0.9 - left, 1.05, 0.07);
    // Dressing: a wooden sitting platform (평상), a plastic table and stools,
    // styrofoam vegetable boxes, a drying rack, a water tank and string lights.
    const sit = (kind, u, v, ww, dd, hh) => {
      roofPiece(kind, 'wood', u, roofY, v, ww, hh, dd);
      support(u, v, ww, dd, roofY + hh, floors, 'furniture-top');
    };
    sit('rooftop-platform', 4.8, -3.8, 2.4, 1.8, 0.42);
    roofPiece('rooftop-platform-mat', 'linen', 4.8, roofY + 0.42, -3.8, 1.6, 0.02, 1.2, false);
    roofPiece('rooftop-table', 'plastic', 4.6, roofY, 1.2, 0.85, 0.72, 0.85);
    for (const [du, dv] of [[-0.85, 0], [0.85, 0], [0, -0.85], [0, 0.85]]) roofPiece('rooftop-stool', 'plastic', 4.6 + du, roofY, 1.2 + dv, 0.36, 0.42, 0.36);
    for (const u of [-1.2, -0.3, 0.6, 1.5]) {
      roofPiece('planter-box', 'white', u, roofY, back + 0.45, 0.75, 0.38, 0.42);
      roofPiece('planter-greens', 'green', u, roofY + 0.38, back + 0.45, 0.65, 0.22, 0.34, false);
    }
    for (const v of [-1.9, -0.1]) roofPiece('drying-rack-post', 'trim', 6.3, roofY, v, 0.06, 1.5, 0.06);
    for (const dy of [1.15, 1.45]) roofPiece('drying-rack-bar', 'trim', 6.3, roofY + dy, -1, 0.04, 0.04, 1.8, false);
    for (const [v, color] of [[-1.55, 'linen'], [-0.95, 'accent'], [-0.4, 'linen']]) roofPiece('drying-laundry', color, 6.3, roofY + 0.75, v, 0.03, 0.7, 0.42, false);
    roofPiece('water-tank', 'tank', 6.1, roofY, 4.9, 1.1, 1.3, 1.1);
    for (const v of [back + 0.35, front - 0.35]) {
      for (const u of [-1.4, 6.6]) roofPiece('light-pole', 'trim', u, roofY, v, 0.06, 2.4, 0.06);
      roofPiece('light-wire', 'dark', 2.6, roofY + 2.32, v, 8, 0.015, 0.015, false);
      for (let u = -1; u <= 6.2; u += 0.8) roofPiece('string-bulb', 'bulb', u, roofY + 2.18, v, 0.07, 0.1, 0.07, false);
    }
    b.safePoints.push(point(1, roofY, 3.6, 'rooftop'));
    b.categoryPositions.push(point(4.8, roofY + 0.42, -3.8, 'rooftop-platform'));
  }

  // Normal-input route, explicitly including both halves of every switchback
  // and upper-room visits. Descent reverses the physical path, not a floor API.
  walk(w / 2 + 2, baseY, front + 2.5, 'street-approach');
  walk(0, baseY, front + 1.2, 'entrance-approach'); walk(0, baseY, front - 0.7, 'lobby');
  walk(0, baseY, 3.25, 'lobby');
  if (agency) for (const [u, v, kind] of [[2, 1, 'lobby'], [2, -4.2, 'artist-wall'], [2, 1, 'lobby'], [-0.6, 1.3, 'floor-guide'], [0, 3.25, 'lobby']]) walk(u, baseY, v, kind);
  else {
    walk(3.6, baseY, 3.25, 'shared-lobby'); walk(3.6, baseY, 0.8, 'concierge-approach');
    walk(3.6, baseY, 3.25, 'shared-lobby'); walk(0, baseY, 3.25, 'lobby');
  }
  for (let level = 0; level < floors - 1; level++) {
    const y = baseY + level * storeyHeight;
    walk(laneA, y, 3.25, 'stair-entry'); walk(laneA, y, start, 'flight-start');
    walk(laneA, y + rise, end, 'flight-end'); walk(laneA, y + rise, -1, 'half-landing');
    walk(laneB, y + rise, -1, 'half-landing'); walk(laneB, y + rise, end, 'flight-start');
    walk(laneB, y + storeyHeight, start, 'flight-end'); walk(laneB, y + storeyHeight, 3.25, 'upper-landing');
    if (agency) {
      const Y = y + storeyHeight;
      for (const [u, v, kind] of level === 0
        ? [[-0.7, 3.25, 'corridor'], [-0.7, 1.1, 'corridor'], [2.5, 1.1, 'practice-a-door'], [3.5, -2, 'practice-a'], [2.5, 1.1, 'practice-a-door'],
          [-0.7, 1.1, 'corridor'], [-0.7, -3.85, 'corridor'], [-2.5, -3.85, 'practice-b-door'], [-4.3, -4.2, 'practice-b'], [-2.5, -3.85, 'practice-b-door'],
          [-0.7, -3.85, 'corridor'], [-0.7, 3.25, 'corridor']]
        : [[-0.7, 3.25, 'corridor'], [2, 3.25, 'lockers-door'], [2, 1.6, 'lockers'], [3.6, 1.2, 'locker'], [2, 1.6, 'lockers'], [2, 3.25, 'lockers-door'],
          [-0.7, 3.25, 'corridor'], [-0.7, -2.4, 'corridor'], [2.5, -2.4, 'lounge'], [-0.7, -2.4, 'corridor'], [-0.7, -3.85, 'corridor'],
          [-2.5, -3.85, 'vocal-door'], [-4.3, -5, 'vocal'], [-2.5, -3.85, 'vocal-door'], [-0.7, -3.85, 'corridor'], [-0.7, 3.25, 'corridor']]) walk(u, Y, v, kind);
      continue;
    }
    walk(1.55, y + storeyHeight, 3.25, 'home-entry');
    if (layout === 'dorm') {
      const Y = y + storeyHeight;
      for (const [u, v, kind] of [[3, 3.25, 'corridor'], [3, 3.8, 'corridor'], [4.6, 3.8, 'bathroom'], [3, 3.8, 'corridor'],
        [3, 0.95, 'corridor'], [5.4, 0.95, 'room-b'], [5.4, 0.6, 'bedside'], [5.4, 0.95, 'room-b'], [3, 0.95, 'corridor'],
        [3, -2.95, 'corridor'], [5.3, -2.95, 'room-a'], [3, -2.95, 'corridor'], [3, -0.3, 'corridor'],
        [0.6, -0.3, 'living'], [-0.4, 0.2, 'kitchen'], [0.6, -0.3, 'living'], [0.6, -2.5, 'room-c'], [0.6, -0.3, 'living'],
        [2, -0.3, 'living'], [2, 3.25, 'living'], [1.55, 3.25, 'home-entry']]) walk(u, Y, v, kind);
      continue;
    }
    walk(1.55, y + storeyHeight, -1.3, 'living');
    walk(0.1, y + storeyHeight, -1.3, 'kitchen-approach'); walk(0.1, y + storeyHeight, back + 1.6, 'kitchen');
    walk(0.1, y + storeyHeight, -1.3, 'kitchen-approach'); walk(1.55, y + storeyHeight, -1.3, 'living');
    walk(4, y + storeyHeight, -1.3, 'bedroom'); walk(4, y + storeyHeight, back + 1.65, 'bedside');
    walk(4, y + storeyHeight, -1.3, 'bedroom'); walk(1.55, y + storeyHeight, -1.3, 'living');
    walk(1.55, y + storeyHeight, 1.3, 'living'); walk(4, y + storeyHeight, 1.3, 'bathroom');
    walk(1.55, y + storeyHeight, 1.3, 'living'); walk(1.55, y + storeyHeight, 3.25, 'home-entry');
  }
  if (rooftop) {
    const y = baseY + (floors - 1) * storeyHeight;
    walk(laneA, y, 3.25, 'stair-entry'); walk(laneA, y, start, 'flight-start');
    walk(laneA, y + rise, end, 'flight-end'); walk(laneA, y + rise, -1, 'half-landing');
    walk(laneB, y + rise, -1, 'half-landing'); walk(laneB, y + rise, end, 'flight-start');
    walk(laneB, roofY, start, 'flight-end'); walk(laneB, roofY, 3.6, 'roof-landing');
    walk(1, roofY, 3.6, 'rooftop'); walk(1, roofY, -1, 'rooftop-view');
    walk(3.3, roofY, -1, 'rooftop-platform-side'); walk(1, roofY, -1, 'rooftop-view');
    walk(1, roofY, 3.6, 'rooftop'); walk(laneB, roofY, 3.6, 'roof-landing');
  }
  const ascent = b.route.slice();
  b.route.push(...ascent.slice(0, -1).reverse().map(p => ({ ...p, kind: `descent-${p.kind}` })));
  return b;
}
