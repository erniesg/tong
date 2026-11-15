// Tong's small games (docs/seoul-first-day.md): the cozy runtime plays these itself,
// over the world, instead of sending every exercise to the Tong host. Five kinds, so
// the same game never comes twice in a row:
//   hangul_compose  build a block from its letters            targets: blocks
//   hangul_listen   hear a word, pick its card                targets[0] spoken; distractors: other cards
//   hangul_missing  a label with one letter scraped off       targets: [word, letter]
//   hangul_match    match blocks to their sounds              targets: 'block:sound'
//   say_it          put the pieces of a line in order         targets in order; distractors don't belong
// A wrong answer never fails anything: after two misses Tong shows the answer and the
// scene goes on (correct: false).

const LEAD = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const VOWEL = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const TAIL = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const LEAD_ROM = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const VOWEL_ROM = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
const TAIL_ROM = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'];
/** Vowels written under the first letter; the rest sit to its right. */
const UNDER = 'ㅗㅛㅜㅠㅡ';
/** What a letter sounds like, for the label under a tile. */
const SOUND = {
  ㄱ: 'g', ㄴ: 'n', ㄷ: 'd', ㄹ: 'r / l', ㅁ: 'm', ㅂ: 'b', ㅅ: 's', ㅇ: 'silent', ㅈ: 'j', ㅊ: 'ch', ㅋ: 'k', ㅌ: 't', ㅍ: 'p', ㅎ: 'h',
  ㅏ: 'a', ㅑ: 'ya', ㅓ: 'eo', ㅕ: 'yeo', ㅗ: 'o', ㅛ: 'yo', ㅜ: 'u', ㅠ: 'yu', ㅡ: 'eu', ㅣ: 'i', ㅐ: 'ae', ㅔ: 'e',
};
/** A syllable the voice can say for a single letter. */
const SAY = { ㄱ: '그', ㄴ: '느', ㄷ: '드', ㄹ: '르', ㅁ: '므', ㅂ: '브', ㅅ: '스', ㅇ: '응', ㅈ: '즈', ㅊ: '츠', ㅋ: '크', ㅌ: '트', ㅍ: '프', ㅎ: '흐' };

export const PLAY_TYPES = ['hangul_compose', 'hangul_listen', 'hangul_missing', 'hangul_match', 'say_it'];
export const isTongPlay = (type) => PLAY_TYPES.includes(type);

/** { lead, vowel, tail, rom } for one Hangul block, or null for anything else. */
export function decompose(block) {
  const code = (block ?? '').charCodeAt(0) - 0xac00;
  if (!(code >= 0 && code <= 11171)) return null;
  const l = Math.floor(code / 588), v = Math.floor((code % 588) / 28), t = code % 28;
  return { block, lead: LEAD[l], vowel: VOWEL[v], tail: TAIL[t], rom: LEAD_ROM[l] + VOWEL_ROM[v] + TAIL_ROM[t] };
}
/** Block-by-block sound of a word, joined with hyphens ('수아' → 'su-a'). */
export const blockRom = (word) => [...word].map((ch) => decompose(ch)?.rom ?? ch).join('-');
const sayFor = (letter) => SAY[letter] ?? (decompose(letter) ? letter : VOWEL.includes(letter) ? String.fromCharCode(0xac00 + 11 * 588 + VOWEL.indexOf(letter) * 28) : letter);

/** The slots a request needs filling: [{ block, slots: [{ letter, role, given }] }]. Exported for tests. */
export function slotsFor(type, targets) {
  const [word, gap] = targets;
  const blocks = type === 'hangul_missing' ? [...word] : targets.flatMap((t) => [...t]);
  let gapLeft = type === 'hangul_missing';
  return blocks.map((block) => {
    const d = decompose(block);
    if (!d) return { block, slots: [] };
    const slots = [['lead', d.lead], ['vowel', d.vowel], ...(d.tail ? [['tail', d.tail]] : [])].map(([role, letter]) => {
      let given = type === 'hangul_missing';
      if (gapLeft && letter === gap) { given = false; gapLeft = false; }
      return { letter, role, given };
    });
    return { block, slots, under: UNDER.includes(d.vowel), rom: d.rom };
  });
}
/** Parse 'block:sound' pairs. Exported for tests. */
export const pairsFor = (targets) => targets.map((t) => { const i = t.indexOf(':'); return { block: t.slice(0, i), sound: t.slice(i + 1) }; });

function shuffle(list, rnd = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** Shuffled, but never left in the answer's own order. */
function scramble(list) {
  if (list.length < 2) return [...list];
  for (let i = 0; i < 8; i++) { const s = shuffle(list); if (s.some((x, k) => x !== list[k])) return s; }
  return [...list].reverse();
}

const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

/**
 * ctx: { root, speak(text), canHear(), sfx: { chime, thump, blip }, onOpen(), onClose() }
 * run(req) → Promise<{ outcome: 'completed' | 'dismissed', correct: boolean | null, exerciseType }>
 */
export function createTongPlay(ctx) {
  let open = null;

  function run(req) {
    if (open) open.finish('dismissed', null);
    return new Promise((resolve) => {
      const el = h('div', 'play');
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      const card = h('div', 'play-card');
      const head = h('div', 'play-head');
      const tong = h('img', 'play-tong');
      tong.src = 'img/tong-thinking.png';
      tong.alt = 'Tong';
      const title = h('div', 'play-title');
      title.append(h('b', null, req.framing?.en ?? ''), h('span', null, req.framing?.ko ?? ''));
      const close = h('button', 'chip play-close', '✕');
      close.setAttribute('aria-label', 'Skip this');
      head.append(tong, title, close);
      const body = h('div', 'play-body');
      const foot = h('div', 'play-foot');
      const note = h('div', 'play-note');
      note.setAttribute('role', 'status');
      note.setAttribute('aria-live', 'polite');
      const next = h('button', 'btn-primary play-next hidden', '계속 · Continue');
      foot.append(note, next);
      card.append(head, body, foot);
      el.append(card);
      ctx.root.append(el);
      ctx.onOpen?.();

      const state = { misses: 0, assisted: false, done: false };
      const finish = (outcome, correct) => {
        if (open !== api) return;
        open = null;
        el.remove();
        ctx.onClose?.();
        resolve({ outcome, correct, exerciseType: req.exerciseType });
      };
      const api = { finish };
      open = api;
      close.onclick = () => finish('dismissed', null);
      next.onclick = () => finish('completed', !state.assisted);
      const say = (t) => ctx.speak?.(t);
      const win = (text) => {
        state.done = true;
        tong.src = `img/tong-${state.assisted ? 'cheerful' : 'proud'}.png`;
        note.textContent = text;
        note.classList.toggle('good', !state.assisted);
        next.classList.remove('hidden');
        next.focus();
        if (!state.assisted) ctx.sfx?.chime?.();
      };
      /** A miss: shake, count; the second one lets Tong show the answer. Returns true when it's time to assist. */
      const miss = (node, hint) => {
        state.misses++;
        ctx.sfx?.thump?.();
        node?.classList.remove('shake');
        void node?.offsetWidth;
        node?.classList.add('shake');
        note.classList.remove('good');
        note.textContent = hint;
        if (state.misses >= 2) state.assisted = true;
        return state.assisted;
      };
      const game = { hangul_compose: compose, hangul_missing: compose, hangul_listen: listen, hangul_match: match, say_it: sayIt }[req.exerciseType];
      game({ req, body, note, say, win, miss, state });
    });
  }

  /* ── Build a block (also: the missing piece) ───────── */
  function compose({ req, body, note, say, win, miss, state }) {
    const blocks = slotsFor(req.exerciseType, req.targetItems);
    const word = req.exerciseType === 'hangul_missing' ? req.targetItems[0] : req.targetItems.join('');
    const row = h('div', 'play-blocks');
    const slotEls = [];
    for (const b of blocks) {
      const frame = h('div', `play-block${b.under ? ' under' : ''}${b.slots.length > 2 ? ' tailed' : ''}`);
      for (const s of b.slots) {
        const cell = h('div', `play-slot ${s.role}${s.given ? ' given' : ''}`, s.given ? s.letter : '');
        frame.append(cell);
        if (!s.given) slotEls.push({ ...s, cell, frame, block: b });
      }
      const cap = h('div', 'play-cap', '');
      const wrap = h('div', 'play-blockwrap');
      wrap.append(frame, cap);
      b.cap = cap;
      b.frame = frame;
      if (b.slots.length && b.slots.every((x) => x.given)) cap.textContent = b.rom;
      row.append(wrap);
    }
    const tray = h('div', 'play-tray');
    const letters = scramble([...slotEls.map((s) => s.letter), ...(req.distractors ?? [])]);
    const place = (s, tile) => {
      s.cell.textContent = s.letter;
      s.cell.classList.add('filled');
      s.filled = true;
      tile?.classList.add('used');
      if (slotEls.filter((x) => x.block === s.block).every((x) => x.filled)) {
        s.block.cap.textContent = s.block.rom;
        s.block.frame.classList.add('whole');
      }
      if (slotEls.every((x) => x.filled)) {
        setTimeout(() => say(word), 250);
        win(`${word} · ${blockRom(word)}`);
      }
    };
    const tiles = letters.map((letter) => {
      const tile = h('button', 'play-tile');
      tile.append(h('b', null, letter), h('small', null, SOUND[letter] ?? ''));
      tile.onclick = () => {
        if (state.done || tile.classList.contains('used')) return;
        say(sayFor(letter));
        const s = slotEls.find((x) => !x.filled && x.letter === letter);
        if (s) return place(s, tile);
        const want = slotEls.find((x) => !x.filled);
        if (miss(tile, `Not that one. Listen for ${SOUND[want.letter] === 'silent' ? 'the silent one' : `"${SOUND[want.letter] ?? want.letter}"`}.`)) {
          for (const x of slotEls.filter((x) => !x.filled)) place(x, tiles.find((t) => !t.classList.contains('used') && t.firstChild.textContent === x.letter));
        }
      };
      tray.append(tile);
      return tile;
    });
    body.append(row, tray);
    note.textContent = 'Tap a letter to hear it.';
  }

  /* ── Hear it, pick it ──────────────────────────────── */
  function listen({ req, body, note, say, win, miss, state }) {
    const target = req.targetItems[0];
    const hear = h('button', 'play-hear', '🔊');
    hear.setAttribute('aria-label', 'Hear it again');
    const prompt = h('div', 'play-prompt');
    const canHear = ctx.canHear?.() ?? true;
    prompt.append(hear, h('span', null, canHear ? 'Listen' : `"${blockRom(target)}"`));
    hear.onclick = () => say(target);
    const cards = h('div', 'play-cards');
    for (const word of scramble([target, ...(req.distractors ?? [])])) {
      const card = h('button', 'play-cardopt');
      card.append(h('b', null, word), h('small', null, ''));
      card.onclick = () => {
        if (state.done) return;
        const reveal = () => {
          for (const c of cards.children) c.lastChild.textContent = blockRom(c.firstChild.textContent);
          [...cards.children].find((c) => c.firstChild.textContent === target).classList.add('right');
          win(`${target} · ${blockRom(target)}`);
        };
        if (word === target) return reveal();
        card.classList.add('wrong');
        card.lastChild.textContent = blockRom(word);
        say(target);
        if (miss(card, `That one says "${blockRom(word)}". Listen again.`)) reveal();
      };
      cards.append(card);
    }
    body.append(prompt, cards);
    note.textContent = canHear ? 'Tap 🔊 to hear it again.' : 'No Korean voice on this device: match the sound in quotes.';
    setTimeout(() => say(target), 500);
  }

  /* ── Blocks to sounds ──────────────────────────────── */
  function match({ req, body, note, say, win, miss, state }) {
    const pairs = pairsFor(req.targetItems);
    const left = h('div', 'play-col'), right = h('div', 'play-col');
    let pick = null, solved = 0;
    const solve = (a, b) => {
      for (const n of [a, b]) { n.classList.remove('picked'); n.classList.add('right'); n.disabled = true; }
      if (++solved === pairs.length) win(pairs.map((p) => `${p.block} ${p.sound}`).join(' · '));
    };
    const tap = (node, side, key) => {
      if (state.done) return;
      if (side === 'block') say(key);
      if (!pick || pick.side === side) {
        pick?.node.classList.remove('picked');
        pick = { node, side, key };
        node.classList.add('picked');
        return;
      }
      const block = side === 'block' ? key : pick.key, sound = side === 'sound' ? key : pick.key;
      const other = pick.node;
      pick = null;
      if (pairs.some((p) => p.block === block && p.sound === sound)) return solve(node, other);
      other.classList.remove('picked');
      if (miss(node, 'Not a pair. Tap a block to hear it.')) {
        for (const p of pairs) {
          const a = [...left.children].find((n) => n.dataset.key === p.block), b = [...right.children].find((n) => n.dataset.key === p.sound);
          if (!a.disabled) solve(a, b);
        }
      }
    };
    for (const p of pairs) {
      const b = h('button', 'play-pair block', p.block);
      b.dataset.key = p.block;
      b.onclick = () => tap(b, 'block', p.block);
      left.append(b);
    }
    for (const p of scramble(pairs)) {
      const s = h('button', 'play-pair sound', p.sound);
      s.dataset.key = p.sound;
      s.onclick = () => tap(s, 'sound', p.sound);
      right.append(s);
    }
    const cols = h('div', 'play-cols');
    cols.append(left, right);
    body.append(cols);
    note.textContent = 'Tap a block, then its sound.';
  }

  /* ── Put the line in order ─────────────────────────── */
  function sayIt({ req, body, note, say, win, miss, state }) {
    const answer = req.targetItems;
    const line = h('div', 'play-line');
    const tray = h('div', 'play-tray chips');
    const go = h('button', 'btn-primary play-say', '말하기 · Say it');
    go.disabled = true;
    const placed = [];
    const sync = () => {
      line.replaceChildren(...placed.map((p) => p.out));
      line.classList.toggle('empty', !placed.length);
      go.disabled = placed.length < answer.length;
    };
    const chips = scramble([...answer, ...(req.distractors ?? [])]).map((text) => {
      const chip = h('button', 'play-chip', text);
      const out = h('button', 'play-chip out', text);
      const entry = { text, chip, out };
      chip.onclick = () => {
        if (state.done || chip.classList.contains('used')) return;
        say(text);
        chip.classList.add('used');
        placed.push(entry);
        sync();
      };
      out.onclick = () => {
        if (state.done) return;
        chip.classList.remove('used');
        placed.splice(placed.indexOf(entry), 1);
        sync();
      };
      tray.append(chip);
      return entry;
    });
    const finish = () => {
      const full = answer.join(' ');
      setTimeout(() => say(full), 200);
      win(full);
    };
    go.onclick = () => {
      if (state.done) return;
      if (placed.length === answer.length && placed.every((p, i) => p.text === answer[i])) return finish();
      const extra = placed.find((p) => !answer.includes(p.text));
      if (miss(line, extra ? `${extra.text} doesn't belong in this one.` : 'Close. Try another order.')) {
        placed.length = 0;
        for (const c of chips) c.chip.classList.remove('used');
        for (const text of answer) {
          const c = chips.find((x) => x.text === text && !x.chip.classList.contains('used'));
          c.chip.classList.add('used');
          placed.push(c);
        }
        sync();
        finish();
      }
    };
    sync();
    body.append(line, tray, go);
    note.textContent = 'Tap the pieces in order. Tap one in the line to take it back.';
  }

  return { run, get active() { return !!open; }, dismiss: () => open?.finish('dismissed', null) };
}
