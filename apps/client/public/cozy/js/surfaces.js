// Pure XZ road union. Later descriptors win at overlaps (including their caps).
// Polygons are convex, counter-clockwise in XZ; triangulation reverses them
// for +Y fronts. No renderer, depth offsets, masks or material state required.
// Limits fail explicitly instead of silently dropping paint on complex input.
const MAX_FOOTPRINTS = 2048;
const MAX_FRAGMENTS = 32768;
const MAX_CLIPS = 1000000;
const MAX_TRIANGLES = 262144;
const MAX_EDGE_CHECKS = 4000000;
// Numerical cleanup only, in world metres / square metres; never a Y offset.
const EPS = 1e-10;
const cross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
const area2 = (p) => p.slice(2).reduce((s, v, i) => s + cross(p[0], p[i + 1], v), 0);
const bounds = (p) => ({
  minX: Math.min(...p.map(v => v[0])), maxX: Math.max(...p.map(v => v[0])),
  minZ: Math.min(...p.map(v => v[1])), maxZ: Math.max(...p.map(v => v[1])),
});
const disjoint = (a, b) => a.maxX <= b.minX || b.maxX <= a.minX || a.maxZ <= b.minZ || b.maxZ <= a.minZ;

function clean(polygon) {
  const p = [];
  for (const v of polygon) {
    const last = p.at(-1);
    if (!last || Math.hypot(v[0] - last[0], v[1] - last[1]) > EPS) p.push(v);
  }
  if (p.length > 1 && Math.hypot(p[0][0] - p.at(-1)[0], p[0][1] - p.at(-1)[1]) <= EPS) p.pop();
  return p.length >= 3 && area2(p) > EPS ? p : [];
}

// Split by an oriented line, sharing the very same computed intersections.
// The inside of a CCW clip polygon is to the left of each edge. Emitting each
// outside piece, then continuing ONLY with the inside, keeps pieces disjoint.
function split(p, a, b) {
  const inside = [], outside = [];
  for (let i = 0; i < p.length; i++) {
    const v = p[i], w = p[(i + 1) % p.length];
    const dv = cross(a, b, v), dw = cross(a, b, w);
    if (dv >= 0) inside.push(v);
    if (dv <= 0) outside.push(v);
    if ((dv < 0 && dw > 0) || (dv > 0 && dw < 0)) {
      const t = dv / (dv - dw);
      const hit = [v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1])];
      inside.push(hit); outside.push(hit);
    }
  }
  return [clean(inside), clean(outside)];
}

function subtract(polygon, clip) {
  if (disjoint(bounds(polygon), clip.bounds)) return [polygon];
  const pieces = [];
  let rest = polygon;
  for (let i = 0; i < clip.polygon.length && rest.length; i++) {
    const [inside, outside] = split(rest, clip.polygon[i], clip.polygon[(i + 1) % clip.polygon.length]);
    if (outside.length) pieces.push(outside);
    rest = inside;
  }
  return pieces;
}

function footprints(roads) {
  const result = [];
  const push = (polygon, color) => {
    if (polygon.flat().some(v => !Number.isFinite(v))) throw new RangeError('Road footprint is not finite');
    polygon = clean(polygon);
    if (!polygon.length) return;
    if (result.length >= MAX_FOOTPRINTS) throw new RangeError('Road footprint limit exceeded');
    result.push({ color, polygon, bounds: bounds(polygon) });
  };
  // Reverse road order establishes later-road precedence without repainting.
  for (let r = roads.length - 1; r >= 0; r--) {
    const { points, width, color } = roads[r];
    if (!Array.isArray(points) || !Number.isFinite(width) || points.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))) {
      throw new TypeError('Roads need finite [x,z] points and a finite width');
    }
    if (width <= 0) continue;
    const h = width / 2;
    for (let i = 1; i < points.length; i++) {
      const [ax, az] = points[i - 1], [bx, bz] = points[i];
      const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz);
      if (length <= EPS) continue; // A repeated point still receives its square cap.
      const nx = -dz / length * h, nz = dx / length * h;
      push([[ax - nx, az - nz], [bx - nx, bz - nz], [bx + nx, bz + nz], [ax + nx, az + nz]], color);
    }
    for (const [x, z] of points) push([[x - h, z - h], [x + h, z - h], [x + h, z + h], [x - h, z + h]], color);
  }
  return result;
}

/** Preserve segment rectangles + axis-aligned square pads, not a stroked path.
 * @returns {{color: string, polygon: number[][]}[]} disjoint convex fragments
 */
export function partitionRoads(roads) {
  const occupied = [], output = [];
  let clips = 0;
  for (const footprint of footprints(roads)) {
    let fragments = [footprint.polygon];
    for (const prior of occupied) {
      if (disjoint(footprint.bounds, prior.bounds)) continue;
      const next = [];
      for (const p of fragments) {
        if (++clips > MAX_CLIPS) throw new RangeError('Road clipping work limit exceeded');
        next.push(...subtract(p, prior));
        if (next.length + output.length > MAX_FRAGMENTS) throw new RangeError('Road fragment limit exceeded');
      }
      fragments = next;
      if (!fragments.length) break;
    }
    if (output.length + fragments.length > MAX_FRAGMENTS) throw new RangeError('Road fragment limit exceeded');
    for (const polygon of fragments) output.push({ color: footprint.color, polygon });
    // Subtract original convex footprints, not a growing fragmented union.
    occupied.push(footprint);
  }
  return output;
}

// Insert shared boundary vertices before Float32 conversion. Otherwise a long
// triangle edge can round differently from the two shorter edges meeting it
// at a T-junction, creating tiny overlapping wedges in an otherwise exact union.
function conformEdges(fragments) {
  const vertices = fragments.flatMap(f => f.polygon);
  let checks = 0;
  return fragments.map(({ color, polygon }) => ({ color, polygon: polygon.flatMap((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    const inserts = new Map();
    for (const v of vertices) {
      if (++checks > MAX_EDGE_CHECKS) throw new RangeError('Road edge conformance work limit exceeded');
      const t = ((v[0] - a[0]) * dx + (v[1] - a[1]) * dz) / (length * length);
      if (t <= EPS / length || t >= 1 - EPS / length || Math.abs(cross(a, b, v)) > EPS * length) continue;
      // Equal Float32 vertices need only one representative along this edge.
      inserts.set(`${Math.fround(v[0])},${Math.fround(v[1])}`, { t, v });
    }
    return [a, ...[...inserts.values()].sort((u, v) => u.t - v.t).map(p => p.v)];
  }) }));
}

/** Non-indexed BufferGeometry attributes, at ONE coherent surface elevation.
 * Grouped by color (at most one runtime mesh per surviving color). UVs use the
 * existing box worldUV convention: u=x/2, v=-z/2, shared across every road.
 */
export function roadSurfaceData(roads, y = 0.025) {
  if (!Number.isFinite(y) || !Number.isFinite(Math.fround(y))) throw new RangeError('Road Y must fit Float32');
  const groups = new Map();
  let triangles = 0;
  for (const { color, polygon } of conformEdges(partitionRoads(roads))) {
    if (!groups.has(color)) groups.set(color, { color, positions: [], normals: [], uv: [] });
    const data = groups.get(color);
    const center = [0, 1].map(axis => polygon.reduce((s, p) => s + p[axis], 0) / polygon.length);
    // A center fan retains every subdivided boundary edge (a corner fan would
    // skip collinear vertices on its first/last edges, reintroducing T-junctions).
    for (let i = 0; i < polygon.length; i++) {
      const tri = [center, polygon[(i + 1) % polygon.length], polygon[i]].map(p => p.map(Math.fround));
      if (tri.flat().some(v => !Number.isFinite(v))) throw new RangeError('Road coordinates must fit Float32');
      // Collinear fan edges / sub-Float32 slivers carry no useful face.
      if (-cross(...tri) <= EPS) continue;
      if (++triangles > MAX_TRIANGLES) throw new RangeError('Road triangle limit exceeded');
      for (const [x, z] of tri) {
        data.positions.push(x, y, z);
        data.normals.push(0, 1, 0);
        data.uv.push(x / 2, -z / 2);
      }
    }
  }
  return [...groups.values()].filter(d => d.positions.length).map(d => ({
    color: d.color, positions: new Float32Array(d.positions), normals: new Float32Array(d.normals), uv: new Float32Array(d.uv),
  }));
}
