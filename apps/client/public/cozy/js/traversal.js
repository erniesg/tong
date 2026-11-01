// Deterministic, renderer-independent arcade traversal. Positions are feet on
// terrain; legacy XZ colliders remain solid at every jump height (not roofs).
// New solids use finite vertical body intervals, shared with save validation.
// Includes the player's beanie/pom-pom and a small animation margin.
export const PLAYER_CLEARANCE = 1.9;
export const MODES = Object.freeze({
  walk: { speed: 3.4, acceleration: 28, coast: 24, brake: 32, radius: 0.3 },
  skateboard: { speed: 7, acceleration: 4.2, coast: 0.85, brake: 14, radius: 0.46 },
  scooter: { speed: 8, acceleration: 5.5, coast: 1.1, brake: 18, radius: 0.62 },
  bicycle: { speed: 9, acceleration: 4, coast: 0.65, brake: 16, radius: 0.89 },
});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function overlaps(x, z, radius, box) {
  const dx = x - clamp(x, box.minX, box.maxX);
  const dz = z - clamp(z, box.minZ, box.maxZ);
  return dx * dx + dz * dz < radius * radius - 1e-9;
}
export function bodyOverlaps(x, feetY, z, radius, box) {
  const intersectsY = (!Number.isFinite(box.minY) || feetY + PLAYER_CLEARANCE > box.minY + 1e-6) &&
    (!Number.isFinite(box.maxY) || feetY < box.maxY - 1e-6);
  return intersectsY && overlaps(x, z, radius, box);
}
// Closed segment / AABB intersection for physical sight lines. Cutaway
// transparency must never permit talking through a wall.
export function segmentHitsBox(a, b, box) {
  let near = 0, far = 1;
  for (const [axis, low, high] of [['x', 'minX', 'maxX'], ['y', 'minY', 'maxY'], ['z', 'minZ', 'maxZ']]) {
    const min = Number.isFinite(box[low]) ? box[low] : -Infinity;
    const max = Number.isFinite(box[high]) ? box[high] : Infinity;
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-9) { if (a[axis] < min || a[axis] > max) return false; }
    else {
      const t0 = (min - a[axis]) / delta, t1 = (max - a[axis]) / delta;
      near = Math.max(near, Math.min(t0, t1)); far = Math.min(far, Math.max(t0, t1));
      if (near > far) return false;
    }
  }
  return near <= far;
}
export function createTraversal() {
  return { mode: 'walk', vx: 0, vz: 0, vy: 0, grounded: true, jumpQueued: false, blocked: false, distance: 0 };
}
export function stopTraversal(state) {
  state.vx = state.vz = 0;
  state.jumpQueued = false;
}
export function resetTraversal(state, mode = 'walk') {
  stopTraversal(state);
  state.mode = Object.hasOwn(MODES, mode) ? mode : 'walk';
  state.vy = 0;
  state.grounded = true;
}
export function queueJump(state) {
  if (state.grounded) state.jumpQueued = true;
}

// Bounded substeps prevent tunnelling through thin walls even with a long frame.
// Reject discontinuous terrain in BOTH directions: the Seoul stair slope is
// traversable, but a terrace side cannot become a teleport/elevator.
export function stepTraversal(state, position, input, environment, dt) {
  const { heightAt, colliders, bounds } = environment;
  const spec = MODES[state.mode] ?? MODES.walk;
  const radius = spec.radius;
  const count = Math.max(1, Math.ceil(Math.min(Math.max(dt, 0), 0.25) / (1 / 120)));
  const h = Math.min(Math.max(dt, 0), 0.25) / count;
  let ix = input.x || 0, iz = input.z || 0;
  const magnitude = Math.min(1, Math.hypot(ix, iz));
  const norm = Math.hypot(ix, iz) || 1;
  ix /= norm; iz /= norm;
  state.blocked = false;
  if (input.frozen) stopTraversal(state);
  if (state.jumpQueued) {
    if (state.grounded && !input.frozen) {
      state.vy = state.mode === 'walk' ? 6.1 : 4.2;
      state.grounded = false;
    }
    state.jumpQueued = false;
  }
  const canMove = (x, z, fromX, fromZ) => {
    if (x < bounds.minX + radius || x > bounds.maxX - radius || z < bounds.minZ + radius || z > bounds.maxZ - radius) return false;
    // Read the live feet Y for EVERY substep (including the second slide axis).
    const floor = heightAt(x, z, position.y), before = heightAt(fromX, fromZ, position.y);
    if (!Number.isFinite(floor) || !Number.isFinite(before)) return false;
    const limit = 0.025 + Math.hypot(x - fromX, z - fromZ) * 0.9;
    if (floor - before > limit) return false;
    if (before - floor > limit && !environment.allowDrop?.(fromX, fromZ, x, z, position.y)) return false;
    const feet = state.grounded && Math.abs(floor - position.y) <= limit ? floor : position.y;
    if (colliders.some((box) => bodyOverlaps(x, feet, z, radius, box))) return false;
    const ceiling = environment.ceilingAt?.(x, z, feet);
    return !Number.isFinite(ceiling) || feet + PLAYER_CLEARANCE <= ceiling + 1e-6;
  };
  for (let i = 0; i < count; i++) {
    if (!input.frozen) {
      const targetSpeed = spec.speed * (state.mode === 'walk' && input.run ? 1.7 : 1) * magnitude;
      if (input.brake || magnitude < 0.08) {
        const speed = Math.hypot(state.vx, state.vz);
        const next = Math.max(0, speed - (input.brake ? spec.brake : spec.coast) * h);
        const scale = speed ? next / speed : 0;
        state.vx *= scale; state.vz *= scale;
      } else {
        // A vector-limited acceleration also limits abrupt vehicle steering.
        const dx = ix * targetSpeed - state.vx, dz = iz * targetSpeed - state.vz;
        const scale = Math.min(1, spec.acceleration * h / (Math.hypot(dx, dz) || 1));
        state.vx += dx * scale; state.vz += dz * scale;
      }
      const dx = state.vx * h, dz = state.vz * h;
      const beforeX = position.x, beforeZ = position.z;
      if (canMove(position.x + dx, position.z + dz, position.x, position.z)) {
        position.x += dx; position.z += dz;
      } else {
        state.blocked = true;
        // Slide along a wall rather than pushing a penetrated player out.
        if (dx && canMove(position.x + dx, position.z, position.x, position.z)) position.x += dx;
        else state.vx = 0;
        if (dz && canMove(position.x, position.z + dz, position.x, position.z)) position.z += dz;
        else state.vz = 0;
      }
      state.distance += Math.hypot(position.x - beforeX, position.z - beforeZ);
    }
    let ground = heightAt(position.x, position.z, position.y);
    for (const box of colliders) {
      if (Number.isFinite(box.maxY) && box.maxY <= position.y + 1e-6 && box.maxY > ground && overlaps(position.x, position.z, radius, box)) ground = box.maxY;
    }
    // Continuous slopes follow support; an actual open edge starts a fall.
    if (state.grounded && position.y - ground > 0.025 + Math.hypot(state.vx, state.vz) * h * 0.9) state.grounded = false;
    const beforeY = position.y;
    if (state.grounded) position.y = ground;
    else {
      state.vy -= 17 * h;
      position.y += state.vy * h;
      if (position.y <= ground && state.vy <= 0) {
        position.y = ground;
        state.vy = 0;
        state.grounded = true;
      }
      // Swept vertical contacts with finite solids (furniture/staff/rails).
      // Unbounded legacy colliders remain horizontal-only, as before.
      for (const box of colliders) {
        if (!overlaps(position.x, position.z, radius, box)) continue;
        if (state.vy <= 0 && Number.isFinite(box.maxY) && beforeY >= box.maxY - 1e-6 && position.y < box.maxY) {
          position.y = box.maxY; state.vy = 0; state.grounded = true;
        } else if (state.vy > 0 && Number.isFinite(box.minY) && beforeY + PLAYER_CLEARANCE <= box.minY + 1e-6 && position.y + PLAYER_CLEARANCE > box.minY) {
          position.y = box.minY - PLAYER_CLEARANCE; state.vy = 0;
        }
      }
    }
    const ceiling = environment.ceilingAt?.(position.x, position.z, beforeY);
    if (Number.isFinite(ceiling) && position.y + PLAYER_CLEARANCE > ceiling) {
      position.y = Math.max(ground, ceiling - PLAYER_CLEARANCE);
      state.vy = Math.min(0, state.vy);
    }
  }
  return Math.hypot(state.vx, state.vz);
}
