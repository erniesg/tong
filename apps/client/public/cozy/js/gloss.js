// Hover / tap lookups on Korean words: romanisation, meaning, sound, and the
// word's blocks with their letters. glossify() only ever touches text nodes.
import { romanize, syllables, jamoName } from './romanize.js';

const KO_RUN = /[가-힣ㄱ-ㆎ]+/g;
const HAS_KO = /[가-힣ㄱ-ㆎ]/;
const SKIP = '.kw, .gloss-pop, [data-no-gloss], kbd, script, style, textarea, input, select, option';
const PARTICLES = ['에서', '으로', '은', '는', '이', '가', '을', '를', '에', '도', '로', '와', '과', '의', '요'];
const bare = (s) => String(s ?? '').replace(/[^\p{L}\p{N}'-]+/gu, ' ').trim();

/**
 * Wrap every Korean word under `el` in <span class="kw" tabindex="0">. Punctuation
 * stays outside the span. Safe to call again. `rom` / `en` (a scene's own
 * gloss for the whole text) are pinned to the words when they line up one to one.
 */
export function glossify(el, { rom, en } = {}) {
  if (!el?.ownerDocument) return el;
  const doc = el.ownerDocument;
  const walker = doc.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */);
  const found = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (HAS_KO.test(n.nodeValue) && !n.parentElement?.closest(SKIP)) found.push(n);
  }
  for (const node of found) {
    const text = node.nodeValue;
    const frag = doc.createDocumentFragment();
    let at = 0;
    for (const m of text.matchAll(KO_RUN)) {
      if (m.index > at) frag.append(text.slice(at, m.index));
      const kw = doc.createElement('span');
      kw.className = 'kw';
      kw.tabIndex = 0;
      kw.textContent = m[0];
      frag.append(kw);
      at = m.index + m[0].length;
    }
    if (at < text.length) frag.append(text.slice(at));
    node.replaceWith(frag);
  }
  if (rom || en) {
    // Line the scene's romanisation up word by word; a token that mixes scripts
    // ("Mina입니다") keeps the computed one.
    const words = [...el.querySelectorAll('.kw')];
    const tokens = el.textContent.split(/\s+/).map(bare).filter(Boolean);
    const roms = bare(rom).split(/\s+/).filter(Boolean);
    if (tokens.length === roms.length) {
      let k = 0;
      tokens.forEach((t, i) => {
        const runs = t.match(KO_RUN) ?? [];
        if (runs.length === 1 && runs[0] === t && words[k]?.textContent === t) words[k].dataset.rom = roms[i];
        k += runs.length;
      });
    }
    if (en && words.length === 1) words[0].dataset.en = en;
  }
  return el;
}

/** exact, then without a trailing particle (저는 → 저). */
export function findEntry(lookup, word) {
  const hit = lookup(word);
  if (hit) return hit;
  for (const p of PARTICLES) {
    if (word.length > p.length && word.endsWith(p)) {
      const stem = lookup(word.slice(0, -p.length));
      if (stem) return stem;
    }
  }
  return null;
}

/** A lookup over the phrasebook Map (ko → { rom, en }); keys may carry punctuation ("안녕하세요!"). */
export function phraseLookup(getMap) {
  let seen = null;
  let size = -1;
  let index = new Map();
  return (word) => {
    const map = getMap();
    if (!map) return null;
    if (map !== seen || map.size !== size) {
      seen = map;
      size = map.size;
      index = new Map();
      for (const [ko, v] of map) {
        const key = bare(ko);
        if (key && !index.has(key)) index.set(key, v);
      }
    }
    return map.get(word) ?? index.get(word) ?? null;
  };
}

/** Keep `selectors` under `root` glossified as the UI re-renders. Returns a stop function. */
export function autoGloss(root, selectors, onChange) {
  const sel = selectors.join(', ');
  root.querySelectorAll(sel).forEach((el) => glossify(el));
  const mo = new MutationObserver((muts) => {
    const todo = new Set();
    for (const m of muts) {
      const at = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      const owner = at?.closest(sel);
      if (owner) todo.add(owner);
      for (const a of m.addedNodes) {
        if (a.nodeType !== 1) continue;
        if (a.matches(sel)) todo.add(a);
        a.querySelectorAll(sel).forEach((x) => todo.add(x));
      }
    }
    todo.forEach((el) => glossify(el));
    onChange?.();
  });
  mo.observe(root, { childList: true, subtree: true, characterData: true });
  return () => mo.disconnect();
}

/**
 * One popover for the whole game.
 *   speak(text, who)   plays Korean (audio.js)
 *   lookup(word)       → { rom, en } | null (see phraseLookup)
 *   hasVoice()         false → the 🔊 controls say so once instead of staying silent
 *   host               positioned element the popover lives in (default #game-shell)
 */
export function createGloss({ speak = () => {}, lookup = () => null, hasVoice = () => true, host } = {}) {
  const doc = document;
  const shell = host ?? doc.getElementById('game-shell') ?? doc.body;
  const fixed = shell === doc.body;
  let pop = null;
  let anchor = null;
  let word = '';
  let pinned = false;
  let hideT = 0;
  let noted = false;
  let pointer = 'mouse';

  const el = (tag, cls, text) => {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  function place(near, box) {
    const r = near.getBoundingClientRect();
    const s = fixed ? { left: 0, top: 0, width: innerWidth, height: innerHeight } : shell.getBoundingClientRect();
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    const left = Math.max(8, Math.min(r.left - s.left + r.width / 2 - w / 2, s.width - w - 8));
    let top = r.top - s.top - h - 8;
    if (top < 8) top = Math.min(r.bottom - s.top + 8, s.height - h - 8);
    box.style.left = `${Math.round(left)}px`;
    box.style.top = `${Math.round(Math.max(8, top))}px`;
  }

  function note(near) {
    const inPop = pop?.querySelector('.gp-note');
    if (inPop && pop.contains(near)) {
      inPop.hidden = false;
      place(anchor, pop);
      return;
    }
    const n = el('div', 'gloss-note', 'No Korean voice on this device');
    n.setAttribute('role', 'status');
    if (fixed) n.style.position = 'fixed';
    shell.appendChild(n);
    place(near, n);
    setTimeout(() => n.remove(), 2800);
  }

  /** Speak, or say once why nothing is heard. `near` is the control that asked. */
  function say(text, who, near) {
    if (!hasVoice()) {
      if (!noted && near) {
        noted = true;
        note(near);
      }
      return false;
    }
    speak(text, who);
    return true;
  }

  function close() {
    clearTimeout(hideT);
    anchor?.classList.remove('kw-on');
    pop?.remove();
    pop = null;
    anchor = null;
    pinned = false;
  }

  function show(kw, pin = false) {
    clearTimeout(hideT);
    if (anchor === kw && pop) {
      pinned ||= pin;
      return;
    }
    close();
    word = kw.textContent;
    const entry = findEntry(lookup, word);
    const blocks = syllables(word);
    const rom = kw.dataset.rom || entry?.rom || (blocks.length ? romanize(word) : [...word].map((j) => jamoName(j).slice(2)).join(' '));
    const en = kw.closest('[data-no-en]') ? '' : kw.dataset.en || entry?.en || '';
    pop = el('div', 'gloss-pop');
    pop.setAttribute('role', 'tooltip');
    if (fixed) pop.style.position = 'fixed';
    const head = el('div', 'gp-head');
    head.append(el('b', 'gp-word', word));
    const hear = el('button', 'gp-say', '🔊');
    hear.type = 'button';
    hear.setAttribute('aria-label', `Hear ${word}`);
    head.append(hear);
    pop.append(head, el('div', 'gp-rom', rom));
    if (en) pop.append(el('div', 'gp-en', en));
    if (blocks.length) {
      const row = el('div', 'gp-blocks');
      for (const b of blocks) {
        const btn = el('button', 'gp-block');
        btn.type = 'button';
        btn.dataset.block = b.block;
        btn.setAttribute('aria-label', `Hear ${b.block}, ${b.rom}`);
        const letters = el('span', 'gp-jamo');
        [[b.lead, 'lead'], [b.vowel], [b.tail, 'tail']].forEach(([j, pos]) => {
          if (!j) return;
          const one = el('span', '', j);
          one.title = jamoName(j, pos);
          letters.append(one);
        });
        btn.append(el('b', '', b.block), letters, el('span', 'gp-brom', b.rom));
        row.append(btn);
      }
      pop.append(row);
    }
    const none = el('div', 'gp-note', 'No Korean voice on this device');
    none.hidden = true;
    pop.append(none);
    shell.appendChild(pop);
    anchor = kw;
    pinned = pin;
    kw.classList.add('kw-on');
    place(kw, pop);
  }

  const later = () => {
    clearTimeout(hideT);
    if (!pinned) hideT = setTimeout(close, 240);
  };
  const kwOf = (t) => (t?.closest ? t.closest('.kw') : null);

  doc.addEventListener('pointerdown', (e) => {
    pointer = e.pointerType || 'mouse';
    if (pop && !pop.contains(e.target) && !kwOf(e.target)) close();
  }, true);
  doc.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const kw = kwOf(e.target);
    if (kw) {
      if (kw !== anchor) show(kw);
      else clearTimeout(hideT);
    } else if (pop?.contains(e.target)) clearTimeout(hideT);
  });
  doc.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse' || !pop) return;
    if (kwOf(e.target) === anchor || pop.contains(e.target)) later();
  });
  doc.addEventListener('focusin', (e) => {
    const kw = kwOf(e.target);
    if (kw) show(kw);
  });
  doc.addEventListener('focusout', (e) => {
    if (kwOf(e.target) && !pop?.contains(e.relatedTarget)) later();
  });
  doc.addEventListener('click', (e) => {
    if (pop?.contains(e.target)) {
      const block = e.target.closest('.gp-block');
      if (block) say(block.dataset.block, undefined, block);
      else if (e.target.closest('.gp-say')) say(word, undefined, e.target);
      return;
    }
    const kw = kwOf(e.target);
    if (!kw) {
      const hear = e.target.closest?.('[data-say]');
      if (!hear) return;
      e.stopPropagation();
      e.preventDefault();
      say(hear.dataset.say, hear.dataset.who, hear);
      return;
    }
    // Inside a control the control still does its job (hover already showed the
    // word). The exception is a touch on a word in a reply marked data-gloss-tap:
    // that looks the word up, and the rest of the button answers.
    const control = kw.closest('button, a, summary, [role="button"]');
    if (control && !(pointer !== 'mouse' && control.hasAttribute('data-gloss-tap'))) return;
    e.stopPropagation();
    e.preventDefault();
    show(kw, true);
    pinned = true;
    say(word, undefined, pop.querySelector('.gp-say'));
  }, true);
  doc.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pop) {
      close();
      e.stopPropagation();
      return;
    }
    const kw = kwOf(e.target);
    if (!kw || (e.key !== 'Enter' && e.key !== ' ') || !kw.matches(':focus-visible')) return;
    e.preventDefault();
    e.stopPropagation();
    show(kw, true);
    pinned = true;
    say(word, undefined, pop.querySelector('.gp-say'));
  }, true);
  doc.addEventListener('scroll', (e) => {
    if (pop && !pop.contains(e.target)) close();
  }, true);

  const settle = () => {
    if (anchor && !anchor.isConnected) close();
  };
  return {
    glossify,
    show,
    close,
    say,
    /** autoGloss that also drops the popover when its word is re-rendered away. */
    auto: (root, selectors) => autoGloss(root, selectors, settle),
    get open() { return !!pop; },
  };
}
