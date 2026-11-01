// Dialogue box engine: typewriter, choices, portraits, expressions.
import { setExpr } from './characters.js';

const TONG_IMG = { cheerful: 'cheerful', thinking: 'thinking', excited: 'excited', proud: 'proud', surprised: 'surprised', love: 'love', amazed: 'amazed' };
const TONG_FACE = { cheerful: 'happy', thinking: 'neutral', excited: 'laugh', proud: 'smile', surprised: 'surprised', love: 'blush', amazed: 'surprised' };

export const SPEAKERS = {
  haeun: { label: '하은 Ha-eun', img: 'img/haeun-portrait.jpg' },
  jin: { label: '진 Jin', img: 'img/jin-portrait.jpg', cls: 'blue' },
  ajusshi: { label: '아저씨 Ajusshi', emoji: '👨‍🍳', cls: 'green' },
  barista: { label: '바리스타 Barista', emoji: '☕', cls: 'pink' },
  cashier: { label: '직원 Clerk', emoji: '🏪', cls: 'green' },
  tong: { label: '통 Tong', tong: true, cls: 'gold' },
  narration: { label: '…', none: true, cls: 'purple' },
};

const val = (v) => (typeof v === 'function' ? v() : v);

export function createDialogue(ctx) {
  const $ = (id) => document.getElementById(id);
  const ui = {
    box: $('dialogue'),
    portrait: $('portrait'),
    speaker: $('speaker'),
    ko: $('line-ko'),
    en: $('line-en'),
    hint: $('hint'),
    choices: $('choices'),
    next: $('next'),
  };
  const d = { active: false, id: null, node: null, choices: [], full: '', shown: 0, acc: 0, typing: false, locked: false };

  const fill = (s) =>
    (s ?? '')
      .replaceAll('{name}', ctx.S.name)
      .replaceAll('{food}', ctx.S.food?.ko ?? '')
      .replaceAll('{foodEn}', ctx.S.food?.en ?? '');

  function start(id) {
    d.active = true;
    ui.box.classList.remove('hidden');
    ctx.onStart?.();
    go(id);
  }

  function end() {
    const n = d.node;
    d.active = false;
    d.node = null;
    d.id = null;
    ui.box.classList.add('hidden');
    for (const c of Object.values(ctx.chars)) if (c?.baseExpr) setExpr(c, c.baseExpr);
    ctx.onEnd?.();
    n?.after?.();
  }

  function go(id) {
    const n = ctx.nodes[id];
    if (!n) return end();
    d.id = id;
    d.node = n;
    d.locked = false;
    n.enter?.();
    // Beat ids let the shared store award each scripted beat once.
    if (n.aff) ctx.addAff('haeun', n.aff, `aff:${id}`);

    const sp = SPEAKERS[n.who];
    ui.speaker.textContent = sp.label;
    ui.speaker.className = `speaker ${sp.cls ?? ''}`;
    ui.portrait.className = `portrait ${sp.none ? 'none' : ''}`;
    ui.portrait.textContent = sp.emoji ?? '';
    if (sp.img) ui.portrait.style.backgroundImage = `url(${sp.img})`;
    else if (sp.tong) ui.portrait.style.backgroundImage = `url(img/tong-${TONG_IMG[n.expr] ?? 'cheerful'}.png)`;
    else ui.portrait.style.backgroundImage = '';
    ui.portrait.classList.toggle('contain', !!sp.tong);

    const c = ctx.chars[n.who];
    if (n.who === 'tong' && c) {
      c.expr = TONG_FACE[n.expr] ?? 'happy';
      c.exprT = 3;
      c.talkT = 1.4;
    } else if (c) {
      if (n.expr) setExpr(c, n.expr);
      c.talkT = Math.min(2.4, 0.5 + fill(val(n.ko)).length * 0.06);
    }
    if (n.playerExpr) setExpr(ctx.chars.player, n.playerExpr, 4);

    d.full = fill(val(n.ko));
    d.shown = 0;
    d.acc = 0;
    d.typing = true;
    ui.ko.textContent = '';
    ui.en.textContent = fill(val(n.en));
    const hint = val(n.hint);
    ui.hint.classList.toggle('hidden', !hint);
    ui.hint.innerHTML = hint ?? '';
    ui.choices.innerHTML = '';
    ui.next.classList.add('hidden');
    d.choices = val(n.choices) ?? [];
    ctx.speak(d.full, n.who);
  }

  function finishTyping() {
    d.typing = false;
    d.shown = d.full.length;
    ui.ko.textContent = d.full;
    if (d.node?.exercise) runExercise(d.node);
    else if (d.choices.length) renderChoices();
    else ui.next.classList.remove('hidden');
  }

  // Exercise nodes hand over to a shared Tong exercise once the line is shown,
  // then continue with next(result) (a CozyExerciseResult).
  function runExercise(n) {
    if (d.locked) return;
    d.locked = true;
    setTimeout(async () => {
      if (d.node !== n) return;
      const result = await ctx.exercise(val(n.exercise));
      if (d.node === n) go(n.next(result));
    }, 600);
  }

  function renderChoices() {
    ui.choices.innerHTML = '';
    d.choices.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'choice';
      b.innerHTML = '<span class="num"></span><span class="txt"><span class="ko"></span><small class="sub"></small></span>';
      b.querySelector('.num').textContent = i + 1;
      b.querySelector('.ko').textContent = c.ko;
      const sub = b.querySelector('.sub');
      if (c.rom) sub.append(c.rom);
      if (c.en && !c.hideEn) {
        const en = document.createElement('span');
        en.className = 'en';
        en.textContent = c.rom ? ` · ${c.en}` : c.en;
        sub.append(en);
      }
      b.onclick = () => choose(i);
      ui.choices.appendChild(b);
    });
  }

  function choose(i) {
    if (!d.active || d.typing || d.locked) return;
    const c = d.choices[i];
    if (!c) return;
    d.locked = true;
    ui.choices.querySelectorAll('button').forEach((b, k) => (b.style.opacity = k === i ? '1' : '0.35'));
    ctx.bubble(ctx.chars.player, c.ko);
    ctx.chars.player.talkT = 1;
    ctx.speak(c.ko, 'player');
    if (c.rom && !c.wrong) ctx.learn(c.ko, c.rom, c.en);
    if (c.set) Object.assign(ctx.S, c.set);
    c.do?.();
    if (c.aff) ctx.addAff('haeun', c.aff, `aff:${d.id}#${i}`);
    if (c.jin) ctx.addAff('jin', c.jin, `aff:${d.id}#${i}`);
    setTimeout(() => go(val(c.next)), 750);
  }

  function advance() {
    if (!d.active || d.locked) return;
    if (d.typing) return finishTyping();
    if (d.choices.length) return;
    if (d.node.end) return end();
    go(val(d.node.next));
  }

  function update(dt) {
    if (!d.active || !d.typing) return;
    d.acc += dt * 28;
    const target = Math.min(d.full.length, Math.floor(d.acc));
    if (target > d.shown) {
      if (Math.floor(target / 2) !== Math.floor(d.shown / 2)) ctx.sfx.blip();
      d.shown = target;
      ui.ko.textContent = d.full.slice(0, d.shown);
    }
    if (d.shown >= d.full.length) finishTyping();
  }

  ui.ko.addEventListener('click', () => ctx.speak(d.full, d.node?.who));
  ui.box.addEventListener('click', (e) => {
    if (e.target.closest('.choice') || e.target === ui.ko) return;
    advance();
  });

  return { state: d, start, go, end, advance, choose, finishTyping, update };
}
