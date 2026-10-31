// Character creator: a stable turntable preview plus one focused category of
// choices at a time. Discrete options cycle (‹ / ›) with a dropdown for direct
// choice, colours stay as swatches, and continuous values use sliders.
import * as THREE from 'three';
import { G } from './util.js';
import { makePlayer, animate, setExpr, repaintFace, LOOK_OPTIONS, LOOK_PRESETS, LOOK_RANGES, normalizeLook, isIndexedLook } from './characters.js';

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;

// Choosing how you present changes real Korean you will hear and use.
const GENDER_NOTE = {
  m: '<b>As a guy</b>, you call an older guy friend <b>형</b> (hyeong) and an older girl <b>누나</b> (nuna).',
  f: '<b>As a girl</b>, you call an older guy friend <b>오빠</b> (oppa) and an older girl <b>언니</b> (eonni).',
};

/** Every editable field: swatch (colour palette), cycle (named options) or range (slider). */
const FIELDS = {
  skin: { label: '피부 · Skin', kind: 'swatch' },
  eyes: { label: '눈동자 · Eye colour', kind: 'swatch' },
  lids: { label: '쌍꺼풀 · Eyelids', names: { double: 'Double', single: 'Single', hooded: 'Hooded' } },
  nose: { label: '코 · Nose', names: { dot: 'Dot', button: 'Button', line: 'Line', soft: 'Soft' } },
  mouth: { label: '입 · Mouth', names: { classic: 'Classic', small: 'Small', wide: 'Wide', cat: 'Cat ω', full: 'Full' } },
  marks: { label: '점 · Marks', names: { none: 'None', freckles: 'Freckles', mole: 'Beauty mark', both: 'Both' } },
  glasses: { label: '안경 · Glasses', names: { false: 'None', true: 'Round' } },
  brows: { label: '눈썹 모양 · Brow shape', names: { soft: 'Soft arch', straight: 'Straight', arched: 'High arch', natural: 'Full natural', tapered: 'Tapered' } },
  browThick: { label: '눈썹 굵기 · Brow thickness', kind: 'range', ends: ['Fine', 'Full'] },
  browLen: { label: '눈썹 길이 · Brow length', kind: 'range', ends: ['Short', 'Long'] },
  lashLen: { label: '속눈썹 길이 · Lash length', kind: 'range', ends: ['None', 'Long'] },
  lashThick: { label: '속눈썹 굵기 · Lash weight', kind: 'range', ends: ['Fine', 'Bold'] },
  hairStyle: { label: '머리 · Hairstyle', names: { short: 'Short', wavy: 'Wavy', long: 'Long', bun: 'Bun', bob: 'Bob', ponytail: 'Ponytail', curtain: 'Curtain', buzz: 'Buzz cut', pigtails: 'Pigtails' } },
  hair: { label: '머리색 · Hair colour', kind: 'swatch' },
  hat: { label: '모자 · Hat', names: { beanie: 'Beanie', cap: 'Cap', none: 'None' } },
  topStyle: { label: '상의 · Top', names: { hoodie: 'Hoodie', tee: 'T-shirt', knit: 'Knit', jacket: 'Jacket' } },
  hood: { label: '후드 · Hood', names: { down: 'Down', up: 'Up' }, when: (look) => look.topStyle === 'hoodie' },
  top: { label: '상의 색 · Top colour', kind: 'swatch' },
  bottom: { label: '하의 · Bottoms', names: { jeans: 'Jeans', slacks: 'Slacks', shorts: 'Shorts', skirt: 'Skirt' } },
  bottomColor: { label: '하의 색 · Bottoms colour', kind: 'swatch' },
  shoes: { label: '신발 · Shoes', kind: 'swatch' },
};

/** One focused category at a time; each frames the part of the body it edits. */
const CATEGORIES = [
  { id: 'basics', label: '기본', en: 'Basics', frame: 'body', fields: ['skin'] },
  { id: 'face', label: '얼굴', en: 'Face', frame: 'face', fields: ['eyes', 'lids', 'nose', 'mouth', 'marks', 'glasses'] },
  { id: 'brows', label: '눈썹', en: 'Brows & lashes', frame: 'face', fields: ['brows', 'browThick', 'browLen', 'lashLen', 'lashThick'] },
  { id: 'hair', label: '머리', en: 'Hair', frame: 'head', fields: ['hairStyle', 'hair', 'hat'] },
  { id: 'outfit', label: '옷', en: 'Outfit', frame: 'body', fields: ['topStyle', 'hood', 'top', 'bottom', 'bottomColor', 'shoes'] },
];

// Fields that only change the painted face: repaint instead of rebuilding the body.
const FACE_ONLY = new Set(['browThick', 'browLen', 'lashLen', 'lashThick']);

const reducedMotion = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function createCreator() {
  const root = $('creator');
  const canvas = $('creator-canvas');
  const rows = $('creator-rows');
  const tabs = $('creator-tabs');
  const panel = $('creator-panel');
  const spinBtn = $('creator-spin');
  let look = normalizeLook(LOOK_PRESETS.m);
  let onDone = null, onBack = null;
  let renderer = null, scene, camera, model = null, raf = 0, last = 0, spin = 0.5, dragX = null;
  let category = 'basics';
  let needsBuild = false;
  // Framing: whole body for outfits, head and shoulders for hair, a close-up for the face.
  const FRAMES = {
    body: { y: 0.92, half: 1.08, width: 0.62 },
    head: { y: 1.18, half: 0.62, width: 0.62 },
    face: { y: 1.28, half: 0.42, width: 0.5 },
  };
  let framing = 'body';
  let frozen = null; // fixed turn angle for inspection/screenshots; null = normal turntable
  // Rotation: `playing` is the player's choice; `holdFront` turns to face the camera while editing the face.
  let playing = !reducedMotion();
  let holdFront = false;
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
    canvas.addEventListener('pointerdown', (e) => {
      dragX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (dragX === null) return;
      const dx = e.clientX - dragX;
      if (Math.abs(dx) > 0) manualTurn(dx * 0.012);
      dragX = e.clientX;
    });
    const release = () => (dragX = null);
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        manualTurn(e.key === 'ArrowLeft' ? -0.3 : 0.3);
      }
    });
  }

  /** Any manual turn (drag, keys, buttons) stops the turntable until the player resumes it. */
  function manualTurn(delta) {
    spin += delta;
    playing = false;
    holdFront = false;
    syncSpin();
  }

  function syncSpin() {
    const rotating = playing && !holdFront;
    spinBtn.setAttribute('aria-pressed', String(rotating));
    spinBtn.querySelector('.creator-spin-icon').textContent = rotating ? '⏸' : '▶';
    spinBtn.querySelector('.creator-spin-text').textContent = rotating ? 'Pause' : 'Rotate';
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
    if (needsBuild) {
      needsBuild = false;
      rebuildModel(false);
    }
    if (dragX === null && playing && !holdFront) spin += dt * 0.35;
    if (holdFront && dragX === null) spin += (Math.round(spin / TAU) * TAU - spin) * Math.min(1, dt * 4);
    if (frozen !== null) spin = frozen;
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

  /* ── Category tabs ──────────────────────────────── */

  function renderTabs() {
    tabs.replaceChildren();
    for (const cat of CATEGORIES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.id = `creator-tab-${cat.id}`;
      b.className = 'creator-tab';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', 'creator-panel');
      b.innerHTML = `<span lang="ko">${cat.label}</span><small>${cat.en}</small>`;
      b.onclick = () => selectCategory(cat.id);
      b.onkeydown = (e) => {
        const i = CATEGORIES.indexOf(cat);
        const step = { ArrowRight: 1, ArrowLeft: -1, Home: -i, End: CATEGORIES.length - 1 - i }[e.key];
        if (step === undefined) return;
        e.preventDefault();
        const next = CATEGORIES[(i + step + CATEGORIES.length) % CATEGORIES.length];
        selectCategory(next.id);
        $(`creator-tab-${next.id}`).focus();
      };
      tabs.append(b);
    }
  }

  function selectCategory(id) {
    category = id;
    const cat = CATEGORIES.find((c) => c.id === id);
    for (const b of tabs.children) {
      const on = b.id === `creator-tab-${id}`;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on) b.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }
    panel.setAttribute('aria-labelledby', `creator-tab-${id}`);
    root.dataset.category = id;
    $('creator-basics').classList.toggle('hidden', id !== 'basics');
    setFraming(cat.frame);
    // Show open eyes while editing the face, so brows and lashes are judged at rest.
    if (cat.frame === 'face' && model) setExpr(model, model.baseExpr, 0);
    renderRows();
    panel.scrollTop = 0;
  }

  /* ── Rows for the active category ───────────────── */

  const optionValue = (key, i) => (isIndexedLook(key) ? i : LOOK_OPTIONS[key][i]);
  const optionIndex = (key) => (isIndexedLook(key) ? look[key] : LOOK_OPTIONS[key].indexOf(look[key]));

  function renderRows() {
    rows.replaceChildren();
    const cat = CATEGORIES.find((c) => c.id === category);
    for (const key of cat.fields) {
      const field = FIELDS[key];
      if (field.when && !field.when(look)) continue;
      const wrap = document.createElement('div');
      wrap.className = `creator-row creator-row-${field.kind ?? 'cycle'}`;
      wrap.dataset.key = key;
      if (field.kind === 'swatch') wrap.append(...swatchRow(key, field));
      else if (field.kind === 'range') wrap.append(...rangeRow(key, field));
      else wrap.append(...cycleRow(key, field));
      rows.append(wrap);
    }
    syncRows();
  }

  function swatchRow(key, field) {
    const label = document.createElement('span');
    label.className = 'creator-label';
    label.id = `creator-l-${key}`;
    label.textContent = field.label;
    const opts = document.createElement('div');
    opts.className = 'creator-options';
    opts.setAttribute('role', 'radiogroup');
    opts.setAttribute('aria-labelledby', label.id);
    const values = LOOK_OPTIONS[key];
    values.forEach((v, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'creator-swatch';
      b.setAttribute('role', 'radio');
      b.style.background = v;
      b.setAttribute('aria-label', `${field.label.split(' · ').pop()} ${i + 1} of ${values.length}`);
      b.onclick = () => update({ [key]: i });
      b.onkeydown = (e) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        const n = (i + step + values.length) % values.length;
        update({ [key]: n });
        opts.children[n].focus();
      };
      opts.append(b);
    });
    return [label, opts];
  }

  function cycleRow(key, field) {
    const values = LOOK_OPTIONS[key];
    const name = field.label.split(' · ').pop().toLowerCase();
    const label = document.createElement('label');
    label.className = 'creator-label';
    label.htmlFor = `creator-s-${key}`;
    label.textContent = field.label;
    const box = document.createElement('div');
    box.className = 'creator-cycle';
    const step = (d) => {
      const n = (optionIndex(key) + d + values.length) % values.length;
      update({ [key]: optionValue(key, n) });
    };
    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'creator-step';
    prev.textContent = '‹';
    prev.setAttribute('aria-label', `Previous ${name}`);
    prev.onclick = () => step(-1);
    const select = document.createElement('select');
    select.id = `creator-s-${key}`;
    select.className = 'creator-select';
    values.forEach((v, i) => select.add(new Option(field.names[String(v)], String(i))));
    select.onchange = () => update({ [key]: optionValue(key, Number(select.value)) });
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'creator-step';
    next.textContent = '›';
    next.setAttribute('aria-label', `Next ${name}`);
    next.onclick = () => step(1);
    const count = document.createElement('span');
    count.className = 'creator-count';
    count.setAttribute('aria-hidden', 'true');
    box.append(prev, select, next, count);
    return [label, box];
  }

  function rangeRow(key, field) {
    const [lo, hi] = LOOK_RANGES[key];
    const label = document.createElement('label');
    label.className = 'creator-label';
    label.htmlFor = `creator-r-${key}`;
    label.textContent = field.label;
    const box = document.createElement('div');
    box.className = 'creator-range';
    const input = document.createElement('input');
    input.type = 'range';
    input.id = `creator-r-${key}`;
    input.min = String(lo);
    input.max = String(hi);
    input.step = '0.05';
    input.oninput = () => update({ [key]: Number(input.value) });
    const [a, b] = field.ends;
    const min = document.createElement('span');
    min.textContent = a;
    min.setAttribute('aria-hidden', 'true');
    const max = document.createElement('span');
    max.textContent = b;
    max.setAttribute('aria-hidden', 'true');
    box.append(min, input, max);
    return [label, box];
  }

  /** Reflect the current look in the rendered controls without rebuilding them (keeps focus). */
  function syncRows() {
    for (const wrap of rows.children) {
      const key = wrap.dataset.key;
      const field = FIELDS[key];
      if (field.kind === 'swatch') {
        [...wrap.querySelectorAll('.creator-swatch')].forEach((b, i) => {
          const on = look[key] === i;
          b.setAttribute('aria-checked', String(on));
          b.tabIndex = on ? 0 : -1;
        });
      } else if (field.kind === 'range') {
        const input = wrap.querySelector('input');
        input.value = String(look[key]);
        const [lo, hi] = LOOK_RANGES[key];
        input.setAttribute('aria-valuetext', `${Math.round(((look[key] - lo) / (hi - lo)) * 100)}% (${field.ends[0]} to ${field.ends[1]})`);
      } else {
        const i = optionIndex(key);
        wrap.querySelector('select').value = String(i);
        wrap.querySelector('.creator-count').textContent = `${i + 1} / ${LOOK_OPTIONS[key].length}`;
      }
    }
    for (const b of root.querySelectorAll('[data-gender]')) b.setAttribute('aria-checked', String(b.dataset.gender === look.gender));
    $('look-note').innerHTML = GENDER_NOTE[look.gender];
  }

  function update(patch, wave = false) {
    const prev = look;
    look = normalizeLook({ ...look, ...patch });
    const keys = Object.keys(patch);
    // Rows whose visibility depends on the look (the hood) need a re-render.
    const visibilityChanged = Object.values(FIELDS).some((f) => f.when && f.when(prev) !== f.when(look));
    if (visibilityChanged) {
      const focused = document.activeElement?.id;
      renderRows();
      if (focused) $(focused)?.focus(); // keep keyboard focus on the control just used
    } else syncRows();
    if (model && !wave && keys.every((k) => FACE_ONLY.has(k))) repaintFace(model, look);
    else if (wave) rebuildModel(true);
    else needsBuild = true;
  }

  for (const b of root.querySelectorAll('[data-gender]')) {
    // Switching presentation applies that preset; individual tweaks stay editable after.
    b.onclick = () => look.gender !== b.dataset.gender && update({ ...LOOK_PRESETS[b.dataset.gender] }, true);
  }
  $('creator-zoom').onclick = () => setFraming(framing === 'face' ? 'body' : 'face');
  function setFraming(f) {
    framing = f;
    holdFront = f === 'face';
    $('creator-zoom').textContent = f === 'face' ? '↕ Full body' : '🔍 Face';
    syncSpin();
  }
  spinBtn.onclick = () => {
    const rotating = playing && !holdFront;
    playing = !rotating;
    holdFront = false;
    syncSpin();
  };
  $('creator-turn-left').onclick = () => manualTurn(-Math.PI / 4);
  $('creator-turn-right').onclick = () => manualTurn(Math.PI / 4);
  $('creator-shuffle').onclick = () => {
    const patch = {};
    for (const [k, values] of Object.entries(LOOK_OPTIONS)) {
      const i = Math.floor(Math.random() * values.length);
      patch[k] = isIndexedLook(k) ? i : values[i];
    }
    for (const [k, [lo, hi]] of Object.entries(LOOK_RANGES)) patch[k] = lo + Math.random() * (hi - lo);
    update(patch, true);
  };
  $('creator-back').onclick = () => { close(); onBack?.(); };
  $('creator-start').onclick = () => { close(); onDone?.(look); };
  renderTabs();

  function close() {
    root.classList.add('hidden');
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    resizeObserver?.disconnect();
  }

  let resizeObserver = null;

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
      playing = !reducedMotion();
      spin = 0.5;
      selectCategory('basics');
      rebuildModel(true);
      resize();
      window.addEventListener('resize', resize);
      // The preview's box changes with the layout (keyboard, rotation), not only the window.
      if (globalThis.ResizeObserver) {
        resizeObserver ??= new ResizeObserver(() => resize());
        resizeObserver.observe(canvas);
      }
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
      // Don't pop the on-screen keyboard on touch devices; focus the first tab instead.
      const coarse = globalThis.matchMedia?.('(pointer: coarse)').matches;
      (mode === 'new' && !coarse ? $('name') : $('creator-tab-basics'))?.focus();
    },
    get look() { return look; },
    get model() { return model; },
    get category() { return category; },
    /** Current turntable angle (radians) and whether it is auto-rotating. */
    get spin() { return spin; },
    get rotating() { return playing && !holdFront && dragX === null; },
    set frozen(angle) { frozen = Number.isFinite(angle) ? angle : null; },
    setFraming,
    selectCategory,
    /** Jump the camera (and a face category's frontal hold) to its target; for tests and screenshots. */
    settle() {
      Object.assign(view, FRAMES[framing]);
      if (holdFront) spin = Math.round(spin / TAU) * TAU;
    },
  };
}
