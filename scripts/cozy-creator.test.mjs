// CPU geometry/schema tests for the character creator's look and chibi parts.
// NOT renderer, canvas appearance or creator-layout proof (see the Playwright shots).
// No install: supply an existing Three r170 module + its BufferGeometryUtils source.
// COZY_THREE_MODULE=... COZY_THREE_UTILS=... node --experimental-vm-modules --test scripts/cozy-creator.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';

const sourceRoot = resolve('apps/client/public/cozy/js');
let cached;
async function harness() {
  if (cached) return cached;
  assert.ok(process.env.COZY_THREE_MODULE && process.env.COZY_THREE_UTILS,
    'Set COZY_THREE_MODULE and COZY_THREE_UTILS to existing Three r170 sources (no dependency installation).');
  // Real factories/meshes with a no-op canvas painter: this does not test pixels.
  const gradient = () => ({ addColorStop() {} });
  const canvas = () => {
    const context = new Proxy({
      createLinearGradient: gradient, createRadialGradient: gradient,
      getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    }, { get: (target, key) => target[key] ?? (() => {}), set: () => true });
    return { width: 0, height: 0, getContext: () => context };
  };
  const context = vm.createContext({ console, document: { createElement: canvas },
    Path2D: class { constructor() { return new Proxy({}, { get: () => () => {} }); } } });
  const modules = new Map();
  async function load(path) {
    path = resolve(path);
    if (modules.has(path)) return modules.get(path);
    const module = new vm.SourceTextModule(await readFile(path, 'utf8'), { context, identifier: path });
    modules.set(path, module);
    await module.link((specifier, referencing) => load(specifier === 'three' ? process.env.COZY_THREE_MODULE :
      specifier === 'three/addons/utils/BufferGeometryUtils.js' ? process.env.COZY_THREE_UTILS : resolve(dirname(referencing.identifier), specifier)));
    return module;
  }
  const chars = await load(resolve(sourceRoot, 'characters.js'));
  await chars.evaluate();
  const THREE = (await load(process.env.COZY_THREE_MODULE)).namespace;
  const util = (await load(resolve(sourceRoot, 'util.js'))).namespace;
  util.G.scene = new THREE.Scene();
  cached = { ...chars.namespace, THREE, G: util.G };
  return cached;
}

const meshes = (obj, pred = () => true) => {
  const out = [];
  obj.traverse((o) => o.isMesh && pred(o) && out.push(o));
  return out;
};
const visible = (o) => {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
};

test('normalizeLook keeps old saves loading and fills new fields from the preset', async () => {
  const h = await harness();
  // A save from the first creator build: boolean hat, retired brow shapes, no new fields.
  const old = h.normalizeLook({ gender: 'f', hat: true, brows: 'thick', hairStyle: 'wavy', skin: 3 });
  assert.equal(old.hat, 'beanie');
  assert.equal(old.brows, 'natural');
  assert.equal(old.browThick, 1.4, 'retired "thick" brows map to a full natural brow');
  assert.equal(old.hairStyle, 'wavy');
  assert.equal(old.skin, 3);
  assert.equal(old.hood, 'down');
  for (const k of ['browLen', 'lashLen', 'lashThick']) assert.equal(old[k], h.LOOK_PRESETS.f[k]);
  const thin = h.normalizeLook({ gender: 'm', brows: 'thin', hat: false, browThick: 1.2 });
  assert.equal(thin.brows, 'tapered');
  assert.equal(thin.browThick, 1.2, 'an explicit thickness wins over the migration default');
  assert.equal(thin.hat, 'none');
  // Every field of every preset is valid as-is.
  for (const g of ['m', 'f']) assert.deepEqual(h.normalizeLook(h.LOOK_PRESETS[g]), h.LOOK_PRESETS[g]);
  // Garbage falls back; continuous values are clamped and rounded.
  const bad = h.normalizeLook({ gender: 'x', hairStyle: 'mohawk', hood: 'sideways', browThick: 9, lashLen: -2, lashThick: 'big', browLen: 1.03333 });
  assert.equal(bad.gender, 'm');
  assert.equal(bad.hairStyle, h.LOOK_PRESETS.m.hairStyle);
  assert.equal(bad.hood, 'down');
  assert.equal(bad.browThick, h.LOOK_RANGES.browThick[1]);
  assert.equal(bad.lashLen, 0);
  assert.equal(bad.lashThick, h.LOOK_PRESETS.m.lashThick);
  assert.equal(bad.browLen, 1.03);
  assert.equal(h.normalizeLook(null).gender, 'm');
});

test('presets keep a zero-lash option for every presentation', async () => {
  const h = await harness();
  assert.equal(h.LOOK_RANGES.lashLen[0], 0);
  for (const g of ['m', 'f']) assert.equal(h.normalizeLook({ ...h.LOOK_PRESETS[g], lashLen: 0 }).lashLen, 0);
  assert.ok(h.LOOK_OPTIONS.hairStyle.length >= 9, 'more hairstyles');
  assert.ok(h.LOOK_OPTIONS.brows.length >= 5, 'several natural brow shapes');
});

test('ink outlines follow their mesh after later transforms (no wheel-like shoe outline)', async () => {
  const h = await harness();
  for (const gender of ['m', 'f']) {
    const c = h.makePlayer({ gender });
    c.root.updateMatrixWorld(true);
    for (const o of meshes(c.root, (m) => m.userData.isOutline)) {
      const owner = o.parent;
      assert.ok(owner.isMesh, 'outline is parented to the mesh it outlines');
      const a = new h.THREE.Box3().setFromObject(owner, true);
      const b = new h.THREE.Box3().setFromObject(o, true);
      const grow = Math.max(0.03, a.getSize(new h.THREE.Vector3()).length() * 0.08);
      assert.ok(a.expandByScalar(grow).containsBox(b), `outline stays wrapped around ${owner.geometry.type}`);
    }
    // Shoes: sole on the floor, outline never pokes below it.
    for (const leg of c.legs) {
      const box = new h.THREE.Box3().setFromObject(leg, true);
      assert.ok(box.min.y > -0.02 && box.min.y < 0.02, `foot rests on the floor (${box.min.y.toFixed(3)})`);
    }
    h.G.scene.remove(c.root);
  }
});

test('every hairstyle fits under a raised hood and the hats without poking through', async () => {
  const h = await harness();
  const v = new h.THREE.Vector3();
  const inv = new h.THREE.Matrix4();
  for (const hairStyle of h.LOOK_OPTIONS.hairStyle) {
    for (const [hood, hat] of [['up', 'none'], ['up', 'cap'], ['up', 'beanie'], ['down', 'beanie'], ['down', 'cap'], ['down', 'none']]) {
      const c = h.makePlayer({ gender: 'f', hairStyle, topStyle: 'hoodie', hood, hat });
      c.root.updateMatrixWorld(true);
      inv.copy(c.head.matrixWorld).invert();
      const crown = c.hair.userData.crown;
      assert.ok(crown && crown.r > 0.3, `${hairStyle} records its crown`);
      const hair = meshes(c.hair, (m) => !m.userData.isOutline && visible(m));
      assert.ok(hair.some((m) => m.userData.crownPart), `${hairStyle}/${hood}/${hat}: crown cap stays visible`);
      const shellR = hood === 'up' ? crown.r + 0.06 : hat === 'beanie' ? crown.r + 0.026 : hat === 'cap' ? crown.r + 0.02 : Infinity;
      const center = new h.THREE.Vector3(0, crown.y, crown.z - (hood === 'up' ? 0.01 : 0));
      // Hats only enclose what is above their rim; hair below the rim may show (it isn't poking through).
      const rim = { beanie: crown.y + 0.03 + shellR * Math.cos(Math.PI * 0.42), cap: crown.y + 0.04 + shellR * Math.cos(Math.PI * 0.42) }[hat];
      const minY = hood === 'up' ? -Infinity : rim ?? Infinity;
      let worst = 0;
      for (const m of hair) {
        if (m.userData.keep || m.parent.userData.keep || m.parent.userData.tail || m.parent.parent?.userData?.tail) continue;
        const pos = m.geometry.attributes.position;
        for (let i = 0; i < pos.count; i += 3) {
          v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).applyMatrix4(inv);
          if (v.y > minY) worst = Math.max(worst, v.distanceTo(center) - shellR);
        }
      }
      assert.ok(worst < 0.02, `${hairStyle} hood=${hood} hat=${hat}: hair pokes ${worst.toFixed(3)} m through`);
      if (hood === 'up') {
        // Headwear under a raised hood stays inside the shell (a cap brim may poke out of the face opening).
        for (const m of meshes(c.head, (x) => !x.userData.isOutline && visible(x) && x.parent === c.head && x.geometry.type !== 'CylinderGeometry' && x.renderOrder < 2)) {
          const pos = m.geometry.attributes.position;
          for (let i = 0; i < pos.count; i += 2) {
            v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).applyMatrix4(inv);
            if (v.y > crown.y) assert.ok(v.distanceTo(center) < crown.r + 0.06 + 0.012, `${hairStyle} ${hat} under hood: ${m.geometry.type} pokes out`);
          }
        }
        const shell = meshes(c.head, (m) => m.parent.userData.hood === 'up' && !m.userData.isOutline);
        assert.ok(shell.length >= 2, 'raised hood has a shell and a rim');
      }
      h.G.scene.remove(c.root);
    }
  }
});

test('lowered hood sits on the back, outside the head and under long hair', async () => {
  const h = await harness();
  const c = h.makePlayer({ gender: 'f', hairStyle: 'long', topStyle: 'hoodie', hood: 'down' });
  c.root.updateMatrixWorld(true);
  const cowl = meshes(c.body, (m) => m.userData.hood === 'down');
  assert.equal(cowl.length, 1);
  const box = new h.THREE.Box3().setFromObject(cowl[0], true);
  assert.ok(box.max.z < 0.2 && box.min.z < -0.25, 'cowl lies behind the neck');
  assert.ok(box.max.y < 1.2 && box.min.y > 0.8, 'cowl rests on the shoulders, below the head');
  // Tees, knits and jackets have no hood at all.
  const tee = h.makePlayer({ gender: 'f', topStyle: 'tee', hood: 'up' });
  assert.equal(meshes(tee.root, (m) => m.userData.hood || m.parent?.userData.hood).length, 0);
});

test('repaintFace updates brow and lash features without rebuilding the body', async () => {
  const h = await harness();
  const c = h.makePlayer({ gender: 'm' });
  const body = c.body;
  h.repaintFace(c, { ...h.LOOK_PRESETS.m, browThick: 1.6, lashLen: 0.8, lashThick: 1.4, browLen: 1.2 });
  assert.equal(c.body, body);
  assert.equal(c.face.f.browThick, 1.6);
  assert.equal(c.face.f.lashLen, 0.8);
  assert.equal(c.face.f.lashThick, 1.4);
  assert.equal(c.face.f.browLen, 1.2);
  assert.equal(c.face.key, '', 'face texture redraws on the next frame');
  assert.equal(c.face.browKey, null, 'brow layer redraws on the next frame');
  h.animate(c, 0.016, 0, 0); // paints without throwing
});
