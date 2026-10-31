// Character creator: live turntable preview plus presentation/look choices.
import * as THREE from 'three';
import { G } from './util.js';
import { makePlayer, animate, setExpr, LOOK_OPTIONS, LOOK_PRESETS, normalizeLook, isIndexedLook } from './characters.js';

const $ = (id) => document.getElementById(id);

// Choosing how you present changes real Korean you will hear and use.
const GENDER_NOTE = {
  m: '<b>As a guy</b>, you call an older guy friend <b>형</b> (hyeong) and an older girl <b>누나</b> (nuna).',
  f: '<b>As a girl</b>, you call an older guy friend <b>오빠</b> (oppa) and an older girl <b>언니</b> (eonni).',
};

const ROWS = [
  { section: '얼굴 · Face' },
  { key: 'skin', label: '피부 · Skin', swatch: true },
  { key: 'eyes', label: '눈 · Eyes', swatch: true },
  { key: 'lids', label: '쌍꺼풀 · Eyelids', names: { double: 'Double', single: 'Single', hooded: 'Hooded' } },
  { key: 'brows', label: '눈썹 · Brows', names: { soft: 'Soft', straight: 'Straight', arched: 'Arched', thick: 'Thick', thin: 'Thin' } },
  { key: 'nose', label: '코 · Nose', names: { dot: 'Dot', button: 'Button', line: 'Line', soft: 'Soft' } },
  { key: 'mouth', label: '입 · Mouth', names: { classic: 'Classic', small: 'Small', wide: 'Wide', cat: 'Cat ω', full: 'Full' } },
  { key: 'marks', label: '점 · Marks', names: { none: 'None', freckles: 'Freckles', mole: 'Beauty mark', both: 'Both' } },
  { key: 'hairStyle', label: '머리 · Hair', names: { short: 'Short', wavy: 'Wavy', long: 'Long', bun: 'Bun' } },
  { key: 'hair', label: '머리색 · Hair colour', swatch: true },
  { key: 'glasses', label: '안경 · Glasses', names: { false: 'None', true: 'Round' } },
  { section: '옷 · Outfit' },
  { key: 'topStyle', label: '상의 · Top', names: { hoodie: 'Hoodie', tee: 'T-shirt', knit: 'Knit', jacket: 'Jacket' } },
  { key: 'top', label: '상의 색 · Top colour', swatch: true },
  { key: 'bottom', label: '하의 · Bottoms', names: { jeans: 'Jeans', slacks: 'Slacks', shorts: 'Shorts', skirt: 'Skirt' } },
  { key: 'bottomColor', label: '하의 색 · Bottoms colour', swatch: true },
  { key: 'shoes', label: '신발 · Shoes', swatch: true },
  { key: 'hat', label: '모자 · Hat', names: { beanie: 'Beanie', cap: 'Cap', none: 'None' } },
];

export function createCreator() {
  const root = $('creator');
  const canvas = $('creator-canvas');
  const form = $('creator-rows');
  let look = normalizeLook(LOOK_PRESETS.m);
  let onDone = null, onBack = null;
  let renderer = null, scene, camera, model = null, raf = 0, last = 0, spin = 0.5, dragX = null;
  // Framing: whole body for outfits, a close-up while editing the face.
  const FRAMES = { body: { y: 0.92, half: 1.08, width: 0.62 }, face: { y: 1.3, half: 0.34, width: 0.4 } };
  let framing = 'body';
  const view = { ...FRAMES.body };

  function ensureRenderer() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(28, 1, 0.1, 30);
    scene.add(new THREE.HemisphereLight(0xfff4e6, 0x8a7a90, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(2, 4, 3);
    scene.add(key);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.62, 40), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12 }));
    disc.rotation.x = -Math.PI / 2;
    scene.add(disc);
    canvas.addEventListener('pointerdown', (e) => { dragX = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => {
      if (dragX === null) return;
      spin += (e.clientX - dragX) * 0.012;
      dragX = e.clientX;
    });
    const release = () => (dragX = null);
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
  }

  function rebuildModel(wave) {
    if (model) scene.remove(model.root);
    model = makePlayer(look);
    G.scene.remove(model.root); // makeChibi adds to the world scene; the preview owns this one
    scene.add(model.root);
    if (wave) {
      model.wave = 1.2;
      setExpr(model, 'happy', 1.4);
    }
  }

  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (dragX === null) spin += dt * (framing === 'face' ? 0 : 0.35);
    if (framing === 'face') spin += (Math.round(spin / (Math.PI * 2)) * Math.PI * 2 - spin) * Math.min(1, dt * 4);
    model.root.rotation.y = spin;
    const target = FRAMES[framing];
    for (const k of ['y', 'half', 'width']) view[k] += (target[k] - view[k]) * Math.min(1, dt * 5);
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(view.half / t, view.width / (t * camera.aspect));
    camera.position.set(0, view.y + 0.08, dist);
    camera.lookAt(0, view.y, 0);
    animate(model, dt, now / 1000, 0);
    renderer.render(scene, camera);
  }

  function renderRows() {
    form.replaceChildren();
    let section = 'face';
    for (const row of ROWS) {
      if (row.section) {
        section = row.section.includes('Outfit') ? 'body' : 'face';
        const h = document.createElement('h3');
        h.className = 'creator-section';
        h.textContent = row.section;
        form.append(h);
        continue;
      }
      const values = LOOK_OPTIONS[row.key];
      const wrap = document.createElement('div');
      wrap.className = 'creator-row';
      wrap.setAttribute('role', 'radiogroup');
      wrap.setAttribute('aria-label', row.label);
      const label = document.createElement('span');
      label.className = 'creator-label';
      label.textContent = row.label;
      const opts = document.createElement('div');
      opts.className = 'creator-options';
      values.forEach((v, i) => {
        const value = row.swatch ? i : v;
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(look[row.key] === value));
        if (row.swatch) {
          b.className = 'creator-swatch';
          b.style.background = v;
          b.setAttribute('aria-label', `${row.label} ${i + 1}`);
        } else {
          b.className = 'creator-choice';
          b.textContent = row.names[String(v)];
        }
        const rowFrame = row.key === 'skin' || row.key === 'hairStyle' ? 'body' : section;
        b.onclick = () => {
          setFraming(rowFrame);
          update({ [row.key]: value });
        };
        opts.append(b);
      });
      wrap.append(label, opts);
      form.append(wrap);
    }
    for (const b of root.querySelectorAll('[data-gender]')) b.setAttribute('aria-checked', String(b.dataset.gender === look.gender));
    $('look-note').innerHTML = GENDER_NOTE[look.gender];
  }

  function update(patch, wave = false) {
    look = normalizeLook({ ...look, ...patch });
    renderRows();
    rebuildModel(wave);
  }

  for (const b of root.querySelectorAll('[data-gender]')) {
    // Switching presentation applies that preset; individual tweaks stay editable after.
    b.onclick = () => look.gender !== b.dataset.gender && update({ ...LOOK_PRESETS[b.dataset.gender] }, true);
  }
  $('creator-zoom').onclick = () => setFraming(framing === 'face' ? 'body' : 'face');
  function setFraming(f) {
    framing = f;
    $('creator-zoom').textContent = f === 'face' ? '↕ Full body' : '🔍 Face';
  }
  $('creator-shuffle').onclick = () => {
    const patch = {};
    for (const [k, values] of Object.entries(LOOK_OPTIONS)) {
      const i = Math.floor(Math.random() * values.length);
      patch[k] = isIndexedLook(k) ? i : values[i];
    }
    setFraming('body');
    update(patch, true);
  };
  $('creator-back').onclick = () => { close(); onBack?.(); };
  $('creator-start').onclick = () => { close(); onDone?.(look); };

  function close() {
    root.classList.add('hidden');
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
  }

  return {
    /** mode 'new' shows the name field and Back; 'edit' restyles an ongoing game. */
    open({ look: initial, mode = 'new', done, back }) {
      ensureRenderer();
      look = normalizeLook(initial ?? LOOK_PRESETS.m);
      onDone = done;
      onBack = back;
      root.dataset.mode = mode;
      $('creator-start').textContent = mode === 'new' ? '시작 · Start' : '완성 · Done';
      $('creator-back').textContent = mode === 'new' ? '← Back' : 'Cancel';
      root.classList.remove('hidden');
      setFraming('body');
      renderRows();
      rebuildModel(true);
      resize();
      window.addEventListener('resize', resize);
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
      (mode === 'new' ? $('name') : root.querySelector('[aria-checked="true"]'))?.focus();
    },
    get look() { return look; },
    get model() { return model; },
  };
}
