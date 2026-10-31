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
  if (!inside(building.bounds, x, z) || y < -0.05 || y >= building.floors * building.storeyHeight) return null;
  const level = Math.floor((y + 0.025) / building.storeyHeight);
  return building.levels[Math.min(level, building.floors - 1)] ?? null;
}

/** Small authored switchback home, front +Z. All dimensions in metres. */
export function createApartmentPlan({ id, city, x, z, w = 14, d = 12, floors = 3, storeyHeight = 3.4, style = city }) {
  if (!id || !city || ![x, z, w, d, storeyHeight].every(Number.isFinite) || w < 14 || d < 10 || !Number.isInteger(floors) || floors < 2 || storeyHeight < 3.2 || storeyHeight > 3.5)
    throw new RangeError('Apartment needs id/city, finite origin, w>=14, d>=10, >=2 floors, and 3.2–3.5m storeys');
  const b = { id, city, x, z, w, d, floors, storeyHeight, style,
    bounds: { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: -0.16, maxY: floors * storeyHeight + 0.2 },
    entry: [x, 0, z + d / 2], levels: [], supports: [], ceilings: [], solids: [], pieces: [], route: [], safePoints: [], categoryPositions: [] };
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
    p.cutaway = level === 0 && y === 0 ? 'base' : kind === 'half-landing' ? 'content' : 'roof';
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

  for (let level = 0; level < floors; level++) {
    const y = level * storeyHeight;
    const room = { id: `${id}-level-${level}`, city, category: 'home', buildingId: id, level, floorY: y,
      bounds: { ...b.bounds, minY: y - 0.025, maxY: y + storeyHeight - 0.026 },
      center: [x + 0.6, y, z + 2.8], door: level ? [x + divider, y, z + 3.25] : [x, y, z + front], furniture: [],
      staff: { spawn: [x + (level ? 0.65 : 3.6), y, z + (level ? 1.1 : -0.4)], yaw: 0,
        role: level ? 'resident' : 'concierge', name: level ? `${city === 'tokyo' ? 'Haru' : city === 'shanghai' ? 'Lin' : 'Min'} ${level}` : 'House keeper',
        greeting: level ? 'Welcome home. Shall we find the kitchen and bedroom?' : 'Welcome! The stairs lead to the homes upstairs.', placeId: id },
      zones: [] };
    b.levels.push(room);
    if (!level) slab(0, 0, 0, w - 0.22, d - 0.22, 0);
    else {
      // Four slab rectangles around ONE actual stairwell hole. No collider
      // spans it; the back and front strips connect the landing to the flat.
      slab(level, (right + w / 2 - 0.11) / 2, 0, w / 2 - 0.11 - right, d - 0.22, y);
      slab(level, (-w / 2 + 0.11 + left) / 2, 0, left + w / 2 - 0.11, d - 0.22, y);
      slab(level, (left + right) / 2, (back + 0.11 + rear) / 2, right - left, rear - back - 0.11, y);
      slab(level, (left + right) / 2, (start + front - 0.11) / 2, right - left, front - 0.11 - start, y, 'landing');
    }
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
    if (level === floors - 1) {
      // Cap roof belongs to top room. Lower rooms own ONLY the next slab.
      piece(level, 'slab', 'roof', 0, y + storeyHeight - 0.16, 0, w + 0.3, 0.24, d + 0.3, { overhead: true }).cutaway = 'roof';
      piece(level, 'roof-trim', 'trim', 0, y + storeyHeight + 0.08, front, w + 0.5, 0.12, 0.26);
    }
  }

  for (let level = 0; level < floors - 1; level++) {
    const y = level * storeyHeight;
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
  // Normal-input route, explicitly including both halves of every switchback
  // and upper-room visits. Descent reverses the physical path, not a floor API.
  walk(w / 2 + 2, 0, front + 2.5, 'street-approach');
  walk(0, 0, front + 1.2, 'entrance-approach'); walk(0, 0, front - 0.7, 'lobby');
  walk(0, 0, 3.25, 'lobby');
  walk(3.6, 0, 3.25, 'shared-lobby'); walk(3.6, 0, 0.8, 'concierge-approach');
  walk(3.6, 0, 3.25, 'shared-lobby'); walk(0, 0, 3.25, 'lobby');
  for (let level = 0; level < floors - 1; level++) {
    const y = level * storeyHeight;
    walk(laneA, y, 3.25, 'stair-entry'); walk(laneA, y, start, 'flight-start');
    walk(laneA, y + rise, end, 'flight-end'); walk(laneA, y + rise, -1, 'half-landing');
    walk(laneB, y + rise, -1, 'half-landing'); walk(laneB, y + rise, end, 'flight-start');
    walk(laneB, y + storeyHeight, start, 'flight-end'); walk(laneB, y + storeyHeight, 3.25, 'upper-landing');
    walk(1.55, y + storeyHeight, 3.25, 'home-entry'); walk(1.55, y + storeyHeight, -1.3, 'living');
    walk(0.1, y + storeyHeight, -1.3, 'kitchen-approach'); walk(0.1, y + storeyHeight, back + 1.6, 'kitchen');
    walk(0.1, y + storeyHeight, -1.3, 'kitchen-approach'); walk(1.55, y + storeyHeight, -1.3, 'living');
    walk(4, y + storeyHeight, -1.3, 'bedroom'); walk(4, y + storeyHeight, back + 1.65, 'bedside');
    walk(4, y + storeyHeight, -1.3, 'bedroom'); walk(1.55, y + storeyHeight, -1.3, 'living');
    walk(1.55, y + storeyHeight, 1.3, 'living'); walk(4, y + storeyHeight, 1.3, 'bathroom');
    walk(1.55, y + storeyHeight, 1.3, 'living'); walk(1.55, y + storeyHeight, 3.25, 'home-entry');
  }
  const ascent = b.route.slice();
  b.route.push(...ascent.slice(0, -1).reverse().map(p => ({ ...p, kind: `descent-${p.kind}` })));
  return b;
}
