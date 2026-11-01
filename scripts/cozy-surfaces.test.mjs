import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { partitionRoads, roadSurfaceData } from '../apps/client/public/cozy/js/surfaces.js';

const road = (points, width = 2, color = 'stone') => ({ points, width, color });
const side = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
const signedArea = p => p.slice(2).reduce((s, v, i) => s + side(p[0], p[i + 1], v) / 2, 0);
const area = p => p.length < 3 ? 0 : Math.abs(signedArea(p));
const near = (a, b, eps = 1e-7) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b} (tolerance ${eps})`);
const bounds = p => [Math.min(...p.map(v => v[0])), Math.max(...p.map(v => v[0])), Math.min(...p.map(v => v[1])), Math.max(...p.map(v => v[1]))];
const apart = (a, b) => a[1] <= b[0] || b[1] <= a[0] || a[3] <= b[2] || b[3] <= a[2];

// Independent intersection oracle (Sutherland-Hodgman); only used in tests.
function intersection(subject, clip) {
  let result = subject;
  for (let i = 0; i < clip.length && result.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length], input = result;
    result = [];
    for (let j = 0; j < input.length; j++) {
      const current = input[j], previous = input[(j + input.length - 1) % input.length];
      const dc = side(a, b, current), dp = side(a, b, previous);
      if ((dc >= 0) !== (dp >= 0)) {
        const t = dp / (dp - dc);
        result.push([previous[0] + t * (current[0] - previous[0]), previous[1] + t * (current[1] - previous[1])]);
      }
      if (dc >= 0) result.push(current);
    }
  }
  return result;
}

// Reconstruct the OLD Tokyo box footprint by rotating its local width/length,
// independently of the implementation's perpendicular-vector construction.
function originalFootprints(roads) {
  return roads.flatMap(({ points, width, color }, priority) => {
    if (width <= 0) return [];
    const polys = points.slice(1).flatMap(([bx, bz], i) => {
      const [ax, az] = points[i], length = Math.hypot(bx - ax, bz - az);
      if (!length) return [];
      const angle = Math.atan2(bx - ax, bz - az), c = Math.cos(angle), s = Math.sin(angle);
      return [[[-width / 2, -length / 2], [width / 2, -length / 2], [width / 2, length / 2], [-width / 2, length / 2]]
        .map(([x, z]) => [(ax + bx) / 2 + c * x + s * z, (az + bz) / 2 - s * x + c * z])];
    });
    for (const [x, z] of points) polys.push([[x - width / 2, z - width / 2], [x + width / 2, z - width / 2], [x + width / 2, z + width / 2], [x - width / 2, z + width / 2]]);
    return polys.map(polygon => ({ polygon, color, priority }));
  });
}

// Independent union/priority area oracle: split X at every edge crossing and
// integrate the vertical interval union. Its length is linear in each slab.
// This checks area without relying on the production subtraction algorithm.
function referenceAreas(footprints) {
  const edges = footprints.flatMap(f => f.polygon.map((a, i) => [a, f.polygon[(i + 1) % f.polygon.length]]));
  const xs = edges.flatMap(([a]) => [a[0]]);
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const [a, b] = edges[i], [c, d] = edges[j];
    const dx = b[0] - a[0], dz = b[1] - a[1], ex = d[0] - c[0], ez = d[1] - c[1];
    const det = dx * ez - dz * ex;
    if (Math.abs(det) < 1e-12) continue;
    const t = ((c[0] - a[0]) * ez - (c[1] - a[1]) * ex) / det;
    const u = ((c[0] - a[0]) * dz - (c[1] - a[1]) * dx) / det;
    if (t > 0 && t < 1 && u > 0 && u < 1) xs.push(a[0] + t * dx);
  }
  xs.sort((a, b) => a - b);
  const totals = new Map();
  for (let i = 1; i < xs.length; i++) {
    const width = xs[i] - xs[i - 1];
    if (width <= 1e-10) continue;
    const x = (xs[i] + xs[i - 1]) / 2;
    const spans = footprints.flatMap(f => {
      const zs = f.polygon.flatMap((a, j) => {
        const b = f.polygon[(j + 1) % f.polygon.length];
        if (x <= Math.min(a[0], b[0]) || x >= Math.max(a[0], b[0])) return [];
        return [a[1] + (x - a[0]) / (b[0] - a[0]) * (b[1] - a[1])];
      });
      return zs.length < 2 ? [] : [{ ...f, lo: Math.min(...zs), hi: Math.max(...zs) }];
    });
    const zs = spans.flatMap(s => [s.lo, s.hi]).sort((a, b) => a - b);
    for (let j = 1; j < zs.length; j++) {
      const z = (zs[j] + zs[j - 1]) / 2;
      const winner = spans.filter(s => z > s.lo && z < s.hi).sort((a, b) => b.priority - a.priority)[0];
      if (winner) totals.set(winner.color, (totals.get(winner.color) || 0) + width * (zs[j] - zs[j - 1]));
    }
  }
  return totals;
}

function noOverlap(polygons, tolerance = 1e-7) {
  const boxes = polygons.map(bounds);
  let maxOverlap = 0;
  for (let i = 0; i < polygons.length; i++) for (let j = i + 1; j < polygons.length; j++) {
    if (apart(boxes[i], boxes[j])) continue;
    const overlap = area(intersection(polygons[i], polygons[j]));
    maxOverlap = Math.max(maxOverlap, overlap);
    assert.ok(overlap <= tolerance, `interior overlap ${overlap} between ${i} and ${j}`);
  }
  return maxOverlap;
}

function verify(roads) {
  const snapshot = JSON.stringify(roads), output = partitionRoads(roads);
  assert.deepEqual(output, partitionRoads(roads), 'deterministic partition');
  assert.equal(JSON.stringify(roads), snapshot, 'input is not mutated');
  const footprints = originalFootprints(roads), expected = referenceAreas(footprints), actual = new Map();
  for (const { polygon, color } of output) {
    assert.ok(polygon.length >= 3 && polygon.flat().every(Number.isFinite));
    assert.ok(signedArea(polygon) > 0, 'CCW XZ polygon');
    for (let i = 0; i < polygon.length; i++) assert.ok(side(polygon[i], polygon[(i + 1) % polygon.length], polygon[(i + 2) % polygon.length]) >= -1e-8, 'convex polygon');
    actual.set(color, (actual.get(color) || 0) + area(polygon));
    const owners = footprints.filter(f => f.color === color && Math.abs(area(intersection(polygon, f.polygon)) - area(polygon)) < 1e-7);
    assert.ok(owners.length, 'each fragment stays in an original same-color footprint');
    const priority = Math.max(...owners.map(f => f.priority));
    for (const f of footprints) if (f.priority > priority && f.color !== color) near(area(intersection(polygon, f.polygon)), 0);
  }
  for (const color of new Set([...expected.keys(), ...actual.keys()])) near(actual.get(color) || 0, expected.get(color) || 0, 1e-6);
  const maxPolygonOverlap = noOverlap(output.map(o => o.polygon));
  const mesh = roadSurfaceData(roads);
  assert.deepEqual(mesh, roadSurfaceData(roads), 'deterministic typed buffers');
  assert.equal(new Set(mesh.map(m => m.color)).size, mesh.length, 'one mesh per color');
  const triangles = [];
  for (const { positions, normals, uv } of mesh) {
    assert.ok(positions instanceof Float32Array && normals instanceof Float32Array && uv instanceof Float32Array);
    assert.equal(positions.length % 9, 0);
    assert.equal(positions.length, normals.length);
    assert.equal(positions.length / 3 * 2, uv.length);
    assert.ok([...positions, ...normals, ...uv].every(Number.isFinite));
    for (let i = 0; i < positions.length; i += 3) {
      near(positions[i + 1], 0.025, 1e-8);
      assert.deepEqual([...normals.slice(i, i + 3)], [0, 1, 0]);
      assert.equal(uv[i / 3 * 2], Math.fround(positions[i] / 2));
      assert.equal(uv[i / 3 * 2 + 1], Math.fround(-positions[i + 2] / 2));
    }
    for (let i = 0; i < positions.length; i += 9) {
      const tri = [0, 3, 6].map(j => [positions[i + j], positions[i + j + 2]]);
      assert.ok(signedArea(tri) < 0, 'triangle front points +Y');
      triangles.push(tri.reverse());
    }
  }
  const maxFloatOverlap = noOverlap(triangles, 1e-8); // Shared edges must conform even AFTER Float32 rounding.
  const totalArea = [...expected.values()].reduce((s, a) => s + a, 0);
  near(triangles.reduce((s, p) => s + area(p), 0), totalArea, 0.005);
  return { footprints: footprints.length, fragments: output.length, meshes: mesh.length, triangles: triangles.length, area: totalArea, maxPolygonOverlap, maxFloatOverlap };
}

test('single rectangle retains square caps, including singleton/zero-length input', () => {
  const r = road([[0, 0], [10, 0]]);
  verify([r]);
  near(partitionRoads([r]).reduce((s, f) => s + area(f.polygon), 0), 24);
  verify([road([[3, 4]])]);
  const repeated = road([[3, 4], [3, 4], [3, 4]]);
  near(partitionRoads([repeated]).reduce((s, f) => s + area(f.polygon), 0), 4);
  verify([repeated]);
});

test('duplicates and reversed segments do not multiply paint', () => {
  const r = road([[0, 0], [10, 0]]);
  const roads = [r, r, road([[10, 0], [0, 0]], 2, 'last')];
  verify(roads);
  assert.ok(partitionRoads(roads).every(f => f.color === 'last'));
});

test('crossing roads preserve union area and later-road color priority', () => {
  const roads = [road([[-5, 0], [5, 0]], 2, 'red'), road([[0, -5], [0, 5]], 2, 'blue')];
  verify(roads);
  const output = partitionRoads(roads);
  near(output.filter(f => f.color === 'red').reduce((s, f) => s + area(f.polygon), 0), 20);
  near(output.filter(f => f.color === 'blue').reduce((s, f) => s + area(f.polygon), 0), 24);
  verify(roads.toReversed());
});

test('multiple roads share corners, caps and a central bend without interior overlap', () => {
  verify([
    road([[0, 0], [8, 0], [8, 8]], 4, 'wide'),
    road([[8, 0], [8, -8]], 2, 'narrow'),
    road([[0, 8], [8, 8], [16, 8]], 3, 'top'),
    road([[8, 8], [8, 0]], 2, 'return'),
  ]);
});

test('diagonals preserve oriented rectangles AND axis-aligned square bend pads', () => {
  verify([
    road([[350, -18], [353, -9], [350, 3], [360, 13]], 4, 'alley'),
    road([[346, 8], [361, -16]], 3, 'cross'),
    road([[353, -9], [366, -9]], 2, 'axis'),
  ]);
  const output = partitionRoads([road([[0, 0], [10, 10]], 2)]);
  const original = originalFootprints([road([[0, 0], [10, 10]], 2)]);
  // Pure endpoint square corners are outside the rotated segment rectangle.
  assert.ok(referenceAreas(original).get('stone') > Math.sqrt(200) * 2 + 4);
  assert.ok(output.some(f => f.polygon.some(([x, z]) => x === -1 && z === 1)));
});

test('empty and zero/negative-width roads are harmless; malformed finite geometry fails explicitly', () => {
  assert.deepEqual(partitionRoads([]), []);
  assert.deepEqual(roadSurfaceData([road([]), road([[0, 0]], 0), road([[0, 0]], -1)]), []);
  for (const r of [road([[NaN, 0]]), road([[Infinity, 0]]), road([[0, 0]], Infinity), road([[0]])]) assert.throws(() => partitionRoads([r]), TypeError);
  assert.throws(() => roadSurfaceData([], Infinity), RangeError);
  const tiny = road([[1, 1], [1 + 1e-12, 1]], 1e-12);
  assert.deepEqual(roadSurfaceData([tiny]), []);
});

test('custom elevation, negative coordinates and coincident color boundaries remain deterministic', () => {
  const roads = [road([[-10, -20], [-3, -20]], 4, 'a'), road([[-3, -20], [4, -20]], 4, 'b')];
  verify(roads);
  const data = roadSurfaceData(roads, 0.5);
  for (const group of data) for (let i = 1; i < group.positions.length; i += 3) assert.equal(group.positions[i], 0.5);
});

test('fragment, work and mesh allocation are bounded (excess input fails, not partial output)', () => {
  assert.throws(() => partitionRoads([road(Array.from({ length: 2049 }, () => [0, 0]))]), /footprint limit/);
  const grid = [];
  for (let i = -4; i <= 4; i++) {
    grid.push(road([[-12, i * 2], [12, i * 2]], 0.75, 'horizontal'));
    grid.push(road([[i * 2, -12], [i * 2, 12]], 0.75, 'vertical'));
  }
  const metrics = verify(grid);
  assert.ok(metrics.fragments < 2000 && metrics.meshes === 2 && metrics.triangles < 6000);
});

test('actual Tokyo descriptors have preserved area, priority, finite +Y buffers and disjoint interiors', t => {
  const source = readFileSync(new URL('../apps/client/public/cozy/js/cities/tokyo.js', import.meta.url), 'utf8');
  // Read the real pure descriptor prelude, without importing Three, canvas or
  // city build/geometry. Still works once the coordinator removes surface().
  const prelude = source.match(/const CX =[\s\S]*?(?=const place =)/)?.[0];
  assert.ok(prelude, 'Tokyo descriptor prelude exists');
  const roads = JSON.parse(vm.runInNewContext(`${prelude}\nJSON.stringify(roads)`, Object.create(null), { timeout: 1000 }));
  assert.ok(roads.length >= 14, 'includes the original network (coordinator may add approach roads)');
  const metrics = verify(roads);
  assert.ok(metrics.meshes <= 6 && metrics.fragments < 1000 && metrics.triangles < 3000);
  t.diagnostic(JSON.stringify(metrics));
});
