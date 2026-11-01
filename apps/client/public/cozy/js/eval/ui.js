// Eval overlay: renders cards, items and the formation grid. All scoring lives in runner.js;
// this file only collects answers and timings. The overlay uses the shared `.overlay` class,
// so the world (and the clock) pauses while it is open.

import { judgeTiming, WINDOWS } from './runner.js';
import { GRID, START, POSES, BEAT_MS, BEATS_PER_CALL, applyInput, matches } from './dance.js';
import { check } from './eval1.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const won = (n) => `${n.toLocaleString('en-US')}원`;

/**
 * @param {object} o
 * @param {HTMLElement} o.root   where the overlay is mounted (#game-shell)
 * @param {object} o.audio       line audio (voice.js): play(req) → Promise, available()
 * @param {object} [o.speech]    future ASR adapter: listen({ slots }) → Promise<{ text, confidence }>. None yet.
 * @param {object} [o.sfx]       optional { blip, coin, heart } sounds
 */
export function createEvalUI({ root, audio, speech = null, sfx = {}, debug = false }) {
  // debug: expose the expected answer on the card for the browser harness (never on by default).
  const reveal = (v) => { if (debug) card.dataset.answer = JSON.stringify(v); else delete card.dataset.answer; };
  const overlay = el('div', 'overlay hidden eval-overlay');
  overlay.id = 'seoul-eval';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  const card = el('div', 'card eval-card');
  card.tabIndex = -1;
  overlay.append(card);
  root.append(overlay);

  const open = () => overlay.classList.remove('hidden');
  const close = () => { audio.stop?.(); overlay.classList.add('hidden'); card.replaceChildren(); };
  const isOpen = () => !overlay.classList.contains('hidden');

  function header({ eyebrow, title, sub, tag }) {
    const h = el('div', 'eval-head');
    if (eyebrow) h.append(el('span', 'eyebrow', eyebrow));
    if (title) h.append(el('h2', 'eval-title', title));
    if (sub) h.append(el('p', 'eval-sub', sub));
    if (tag) card.dataset.screen = tag;
    return h;
  }

  /**
   * A simple card. body: string | Node | Node[]. actions: [{ label, value, primary, id }].
   * Resolves with the chosen action's value.
   */
  function show({ eyebrow, title, sub, body, actions = [{ label: '계속 · Continue', value: true, primary: true }], tag, wide }) {
    open();
    card.replaceChildren();
    reveal(null);
    delete card.dataset.item;
    card.classList.toggle('wide', !!wide);
    card.append(header({ eyebrow, title, sub, tag }));
    if (body != null) {
      const b = el('div', 'eval-body');
      if (typeof body === 'string') b.innerHTML = body;
      else b.append(...[].concat(body));
      card.append(b);
    }
    return new Promise((resolve) => {
      const row = el('div', 'eval-actions');
      for (const a of actions) {
        const btn = el('button', a.primary ? 'btn-primary' : 'btn-secondary', a.label);
        if (a.id) btn.dataset.action = a.id;
        btn.onclick = () => resolve(a.value);
        row.append(btn);
      }
      card.append(row);
      card.querySelector('.eval-actions button')?.focus({ preventScroll: true });
    });
  }

  function listenButton(req, label = '🔊 듣기') {
    const b = el('button', 'btn-secondary eval-listen', label);
    b.onclick = () => audio.play(req);
    return b;
  }

  /** Hint button: reveals Tong's hint and caps the item at half marks. */
  function hintRow(item, state) {
    const row = el('div', 'eval-hint-row');
    const btn = el('button', 'btn-secondary eval-hint-btn', '💡 통 힌트 · Tong hint (½)');
    const text = el('div', 'hint hidden');
    btn.onclick = () => {
      state.hint = true;
      text.textContent = item.hint ?? '';
      text.classList.remove('hidden');
      btn.disabled = true;
    };
    row.append(btn, text);
    return row;
  }

  async function feedback(ok, right) {
    const f = el('div', `eval-feedback ${ok ? 'ok' : 'no'}`, ok ? '✓ 맞아요' : `✗ ${right ?? ''}`);
    card.append(f);
    ok ? sfx.coin?.() : sfx.blip?.();
    await wait(ok ? 650 : 1300);
  }

  /**
   * One non-rhythm item. Resolves with { answer, correct, hint }.
   * ctx: { eyebrow, title, index, total, audioOnly, noVoice }
   */
  async function runItem(item, ctx = {}) {
    open();
    card.replaceChildren();
    card.classList.remove('wide');
    card.dataset.item = item.id;
    reveal(item.answer[0]);
    card.append(header({ eyebrow: `${ctx.eyebrow ?? ''} · ${ctx.index + 1}/${ctx.total}`, title: ctx.title, tag: `item-${item.type}` }));
    const state = { hint: false };
    const body = el('div', 'eval-body');
    card.append(body);
    const voiceOk = audio.available?.() ?? false;

    if (item.context) {
      const ctxRow = el('div', 'eval-context');
      if (item.context.showText || !voiceOk) ctxRow.append(el('div', 'eval-lyric', `♪ ${item.context.ko}`));
      ctxRow.append(listenButton(item.audio));
      body.append(ctxRow);
    } else if (item.audio) {
      body.append(listenButton(item.audio));
    }
    const p = item.prompt ?? {};
    if (item.formLabel) body.append(el('div', 'eval-form-label', item.formLabel));
    const heard = item.audio?.text;
    // Tier 2+ prompts are instructions ("build the line you hear"); the heard line itself stays hidden.
    if (p.showText || (p.ko && p.ko !== heard)) body.append(el('div', 'eval-prompt-ko', p.ko));
    if (!p.showText && !voiceOk && heard) {
      body.append(el('div', 'eval-lyric', heard), el('div', 'eval-note', '(No Korean voice on this device: the line is shown.)'));
    }
    if (p.en) body.append(el('div', 'eval-prompt-en', p.en));
    if (item.audio && !item.context) setTimeout(() => audio.play(item.audio), 250);
    else if (item.context) setTimeout(() => audio.play(item.audio), 250);

    const answer = await new Promise((resolve) => {
      if (item.type === 'choice') {
        const list = el('div', 'choices eval-choices');
        item.options.forEach((o, i) => {
          const b = el('button', 'choice');
          b.dataset.option = o.id;
          b.append(el('span', 'num', String(i + 1)), el('span', 'txt', o.ko));
          b.onclick = () => {
            list.querySelectorAll('button').forEach((x) => { x.disabled = true; x.style.opacity = x === b ? '1' : '0.4'; });
            resolve(o.id);
          };
          list.append(b);
        });
        body.append(list);
      } else if (item.type === 'blocks') {
        const built = [];
        const tray = el('div', 'eval-tray');
        const pool = el('div', 'eval-pool');
        const go = el('button', 'btn-primary eval-check', '확인 · Check');
        go.disabled = true;
        const render = () => {
          tray.replaceChildren(...built.map((blk, i) => {
            const b = el('button', 'eval-block placed', blk.text);
            b.onclick = () => { built.splice(i, 1); render(); };
            return b;
          }));
          if (!built.length) tray.append(el('span', 'eval-tray-empty', '블록을 눌러요 · Tap the blocks'));
          pool.querySelectorAll('button').forEach((b) => { b.disabled = built.some((x) => x.id === b.dataset.block); });
          go.disabled = !built.length;
        };
        for (const blk of item.blocks) {
          const b = el('button', 'eval-block', blk.text);
          b.dataset.block = blk.id;
          b.onclick = () => { built.push(blk); render(); };
          pool.append(b);
        }
        go.onclick = () => { go.disabled = true; resolve(built.map((b) => b.text)); };
        body.append(tray, pool);
        if (speech && item.speech) body.append(el('div', 'eval-note', '🎤 Speech answers: coming with the ASR spike.'));
        body.append(go);
        render();
      } else if (item.type === 'type') {
        const input = el('input', 'name-input eval-input');
        input.lang = 'ko';
        input.autocomplete = 'off';
        const go = el('button', 'btn-primary eval-check', '확인 · Check');
        go.onclick = () => resolve(input.value);
        input.addEventListener('keydown', (e) => e.key === 'Enter' && go.click());
        body.append(input, go);
        setTimeout(() => input.focus(), 50);
      } else if (item.type === 'wallet') {
        let total = 0;
        const sum = el('div', 'eval-total', won(0));
        const bills = el('div', 'eval-wallet');
        item.wallet.forEach((v, i) => {
          const b = el('button', `eval-bill b${v}`, won(v));
          b.dataset.bill = String(i);
          b.dataset.value = String(v);
          b.setAttribute('aria-pressed', 'false');
          b.onclick = () => {
            const on = b.getAttribute('aria-pressed') !== 'true';
            b.setAttribute('aria-pressed', String(on));
            total += on ? v : -v;
            sum.textContent = won(total);
            go.disabled = total === 0;
            sfx.coin?.();
          };
          bills.append(b);
        });
        const go = el('button', 'btn-primary eval-check', '내기 · Pay');
        go.disabled = true;
        go.onclick = () => { go.disabled = true; resolve(total); };
        body.append(bills, sum, go);
      }
      card.append(hintRow(item, state));
    });

    audio.stop?.();
    const correct = check(item, answer);
    const right = item.type === 'blocks' ? item.answer[0].join(' ') : item.type === 'wallet' ? won(item.answer[0]) : item.answer[0];
    await feedback(correct, right);
    return { answer, correct, hint: state.hint };
  }

  /* ── Formation grid ────────────────────────────── */

  /**
   * Run a sequence of calls on the beat. Resolves with per-call { answer, correct, timing, hint }.
   * opts: { tier, title, eyebrow, windowScale, coach }
   */
  async function runDance(calls, opts = {}) {
    open();
    card.replaceChildren();
    card.classList.add('wide');
    card.dataset.item = 'dance';
    card.append(header({ eyebrow: opts.eyebrow, title: opts.title, sub: opts.sub, tag: 'dance' }));
    const voiceOk = audio.available?.() ?? false;
    const showText = opts.tier === 1 || !voiceOk;

    const stage = el('div', 'dance-stage');
    const callBox = el('div', 'dance-call');
    const callKo = el('div', 'dance-call-ko', '');
    const callEn = el('div', 'dance-call-en', '');
    callBox.append(callKo, callEn);
    const beats = el('div', 'dance-beats');
    for (let i = 1; i < BEATS_PER_CALL; i++) beats.append(el('span', i === BEATS_PER_CALL - 1 ? 'beat hit' : 'beat'));
    const judge = el('div', 'dance-judge', '');
    const grid = el('div', 'dance-grid');
    grid.style.setProperty('--cols', GRID.cols);
    const front = el('div', 'dance-front', '앞 · 거울 (front, mirror)');
    const back = el('div', 'dance-back', '뒤 (back)');
    const left = el('div', 'dance-side left', '왼쪽');
    const right = el('div', 'dance-side right', '오른쪽');
    const cells = [];
    for (let y = 0; y < GRID.rows; y++) {
      for (let x = 0; x < GRID.cols; x++) {
        const c = el('button', 'dance-cell');
        c.dataset.cell = `${x},${y}`;
        c.setAttribute('aria-label', `cell ${x + 1}, row ${y + 1}`);
        c.onclick = () => input({ cell: [x, y] });
        cells.push(c);
        grid.append(c);
      }
    }
    const gridWrap = el('div', 'dance-grid-wrap');
    gridWrap.append(front, left, grid, right, back);
    const poses = el('div', 'dance-poses');
    for (const [id, p] of Object.entries(POSES)) {
      const b = el('button', 'btn-secondary dance-pose', `${p.icon} ${p.button}`);
      b.dataset.pose = id;
      b.onclick = () => input({ pose: id });
      poses.append(b);
    }
    const hintBtn = el('button', 'btn-secondary eval-hint-btn', '💡 통 힌트 · Tong hint (½)');
    stage.append(callBox, beats, judge, gridWrap, poses, hintBtn);
    if (opts.tier >= 2 && !voiceOk) callBox.append(el('div', 'eval-note', '(No Korean voice on this device: calls are shown.)'));
    card.append(stage);

    let state = { ...START };
    let active = null; // the call being judged
    const draw = () => {
      for (const c of cells) {
        const [x, y] = c.dataset.cell.split(',').map(Number);
        const me = x === state.x && y === state.y;
        c.classList.toggle('me', me);
        c.textContent = me ? (state.pose === 'sit' ? '🧎' : state.pose === 'right_hand' ? '🙋' : state.pose === 'left_hand' ? '🙋‍♀️' : '🧍') : '';
      }
      poses.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.pose === state.pose));
    };
    function input(i) {
      if (!active) return;
      const next = applyInput(state, i);
      active.lastInput = performance.now();
      state = next;
      draw();
    }
    hintBtn.onclick = () => {
      if (!active) return;
      active.hint = true;
      callEn.textContent = active.call.en;
      callKo.textContent = active.call.ko;
    };
    draw();
    await wait(500);

    const results = [];
    for (const [n, call] of calls.entries()) {
      state = { ...call.from };
      if (card.contains(document.activeElement)) document.activeElement.blur(); // no stale focus ring on last call's cell
      draw();
      active = { call, lastInput: null, hint: false };
      card.dataset.call = String(n);
      reveal(call.target);
      callKo.textContent = showText ? call.ko : '🔊 …';
      callEn.textContent = showText && opts.showEn ? call.en : '';
      judge.textContent = '';
      judge.className = 'dance-judge';
      audio.play(call.audio);
      const t0 = performance.now();
      const hitAt = t0 + (BEATS_PER_CALL - 1) * BEAT_MS;
      const ends = hitAt + WINDOWS.goodMs;
      if (debug) card.dataset.hitAt = String(hitAt); // page clock (performance.now)
      // Beat clock: light one dot per beat; flag the hit window for players (and the harness).
      await new Promise((resolve) => {
        const tick = () => {
          const now = performance.now();
          const beat = Math.floor((now - t0) / BEAT_MS);
          beats.querySelectorAll('.beat').forEach((b, i) => b.classList.toggle('lit', i < beat));
          // The flash holds from just before the beat to the end of the window, so slow frames can't skip it.
          const near = now >= hitAt - WINDOWS.perfectMs * (opts.windowScale ?? 1);
          if (near !== (stage.dataset.phase === 'hit')) stage.dataset.phase = near ? 'hit' : 'count';
          if (now >= ends) return resolve();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      const correct = matches(state, call.target);
      const timing = correct ? judgeTiming(active.lastInput == null ? null : active.lastInput - hitAt, { windowScale: opts.windowScale ?? 1 }) : 'miss';
      results.push({ answer: { ...state }, correct, timing, hint: active.hint });
      judge.textContent = { perfect: 'Perfect!', good: 'Good', miss: correct ? 'Miss' : `Miss · ${call.ko}` }[timing];
      judge.className = `dance-judge ${timing}`;
      if (!showText) callKo.textContent = call.ko; // reveal after the beat
      active = null;
      stage.dataset.phase = 'rest';
      timing === 'miss' ? sfx.blip?.() : sfx.coin?.();
      await wait(timing === 'miss' ? 1100 : 650);
    }
    return results;
  }

  return { overlay, card, open, close, isOpen, show, runItem, runDance, el };
}
