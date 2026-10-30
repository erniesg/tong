// Deterministic, renderer-independent arcade traversal. Positions are feet on
// terrain; legacy XZ colliders remain solid at every jump height (not roofs).
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
    if (colliders.some((box) => overlaps(x, z, radius, box))) return false;
    const floor = heightAt(x, z), before = heightAt(fromX, fromZ);
    if (!Number.isFinite(floor) || !Number.isFinite(before)) return false;
    return Math.abs(floor - before) <= 0.025 + Math.hypot(x - fromX, z - fromZ) * 0.9;
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
    const ground = heightAt(position.x, position.z);
    if (state.grounded) position.y = ground;
    else {
      state.vy -= 17 * h;
      position.y += state.vy * h;
      if (position.y <= ground && state.vy <= 0) {
        position.y = ground;
        state.vy = 0;
        state.grounded = true;
      }
    }
    const ceiling = environment.ceilingAt?.(position.x, position.z);
    if (Number.isFinite(ceiling) && position.y + PLAYER_CLEARANCE > ceiling) {
      position.y = Math.max(ground, ceiling - PLAYER_CLEARANCE);
      state.vy = Math.min(0, state.vy);
    }
  }
  return Math.hypot(state.vx, state.vz);
}
