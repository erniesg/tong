// DOM for the Seoul day loop (day.js): the 기력 meter in the HUD clock, the
// bed (nap or sleep with a short recap of the day), and the morning board.
// Overlays use the shared `.overlay` class, so while one is open the game's
// modalOpen() is true and the clock stands still.
import { CONDITIONS, DAY_CONFIG } from './day.js';

const pad = (n) => String(n).padStart(2, '0');
const hhmm = (h) => `${pad(Math.floor(((h % 24) + 24) % 24))}:${pad(Math.floor((h % 1) * 60))}`;
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * `host` is the game shell; `clockText` the HUD clock's text block; `fade`
 * the full-screen fade element; `toast(html)` the game's toast. Morning board
 * sections (today's schedule, Tong's three suggestions #385) can be added
 * later with addMorningSection(fn → { title, items } | null).
 */
export function createDayUI({ host, clockText, fade, toast, onClose = () => {} }) {
  /* HUD meter: face · 기력 · bar · number, plus a quiet "after curfew" line. */
  const meter = el('div', 'vigor', '<span class="vigor-face" aria-hidden="true"></span><span class="vigor-label">기력</span><span class="vigor-bar"><i></i></span><b class="vigor-num"></b>');
  meter.setAttribute('role', 'meter');
  meter.setAttribute('aria-valuemin', '0');
  meter.setAttribute('aria-valuemax', String(DAY_CONFIG.max));
  const curfew = el('span', 'vigor-curfew', '🌙 통금 후');
  curfew.title = 'After curfew (23:00)';
  meter.appendChild(curfew);
  clockText?.appendChild(meter);
  const face = meter.querySelector('.vigor-face');
  const fill = meter.querySelector('.vigor-bar i');
  const num = meter.querySelector('.vigor-num');
  let last = '';

  function update(v) {
    const key = `${v.id}:${v.energy}:${v.afterCurfew}`;
    if (key === last) return;
    last = key;
    face.textContent = v.face;
    face.title = `${v.ko} · ${v.en}`;
    fill.style.width = `${(v.energy / v.max) * 100}%`;
    meter.classList.toggle('low', v.energy < DAY_CONFIG.lowEnergy);
    num.textContent = String(v.energy);
    meter.setAttribute('aria-valuenow', String(v.energy));
    meter.setAttribute('aria-label', `기력 ${v.energy} of ${v.max}, ${v.en}`);
    meter.classList.toggle('after-curfew', v.afterCurfew);
    clockText?.closest('.clock')?.classList.toggle('after-curfew', v.afterCurfew);
  }

  /* One overlay for the bed and one for the morning board. */
  const bedOverlay = el('div', 'overlay hidden day-overlay');
  bedOverlay.id = 'bed-overlay';
  bedOverlay.setAttribute('role', 'dialog');
  bedOverlay.setAttribute('aria-modal', 'true');
  const morningOverlay = el('div', 'overlay hidden day-overlay');
  morningOverlay.id = 'morning-board';
  morningOverlay.setAttribute('role', 'dialog');
  morningOverlay.setAttribute('aria-modal', 'true');
  host.appendChild(bedOverlay);
  host.appendChild(morningOverlay);
  const morningSections = [];

  const close = (o) => { o.classList.add('hidden'); o.replaceChildren(); onClose(); };

  /** Nap before 20:00. Resolves 'nap' or 'cancel'. */
  function napPrompt({ hour }) {
    return new Promise((resolve) => {
      const card = el('div', 'card day-card', `<div class="day-kicker">침대 · Bed</div><h2>낮잠 · Nap</h2><p class="day-line">${hhmm(hour)} → ${hhmm(hour + DAY_CONFIG.restore.napHours)} · +${DAY_CONFIG.restore.nap} 기력</p>`);
      const row = el('div', 'day-buttons');
      const yes = el('button', 'btn-primary', '낮잠 자기 · Nap');
      const no = el('button', 'btn-secondary', '아직 · Not yet');
      yes.onclick = () => { close(bedOverlay); resolve('nap'); };
      no.onclick = () => { close(bedOverlay); resolve('cancel'); };
      row.append(yes, no);
      card.appendChild(row);
      bedOverlay.replaceChildren(card);
      bedOverlay.classList.remove('hidden');
      yes.focus();
    });
  }

  /** Bedtime: a short recap of the day (diary stub, #385). Resolves 'sleep' or 'cancel'. */
  function recap({ hour, words, nightOut, condition }) {
    return new Promise((resolve) => {
      const c = CONDITIONS[condition];
      const shown = words.slice(-8);
      const card = el('div', 'card day-card');
      card.innerHTML = `<div class="day-kicker">오늘 · Today</div><h2>잘 자요 · Good night</h2>
        <div class="day-section">새 단어 · New words: ${words.length}</div>
        <p class="day-words">${shown.map(esc).join(' · ') || '—'}</p>
        ${nightOut ? '<p class="day-line">🌙 통금 후 외출 · Out after curfew</p>' : ''}
        <p class="day-line">${hhmm(hour)} · 내일 · Tomorrow ${c.face} ${c.ko}</p>
        <div class="day-diary" data-hook="diary"></div>`;
      const row = el('div', 'day-buttons');
      const yes = el('button', 'btn-primary', '자기 · Sleep');
      const no = el('button', 'btn-secondary', '아직 · Not yet');
      yes.onclick = () => {
        yes.disabled = no.disabled = true;
        fade?.classList.add('on');
        setTimeout(() => { close(bedOverlay); resolve('sleep'); }, 450);
      };
      no.onclick = () => { close(bedOverlay); resolve('cancel'); };
      row.append(yes, no);
      card.appendChild(row);
      bedOverlay.replaceChildren(card);
      bedOverlay.classList.remove('hidden');
      yes.focus();
    });
  }

  /** The morning board: condition face, 기력, and any added sections. */
  function morning(detail) {
    return new Promise((resolve) => {
      const c = CONDITIONS[detail.id];
      const card = el('div', 'card day-card morning-card');
      const extra = morningSections.map((fn) => fn(detail)).filter(Boolean)
        .map((s) => `<div class="day-section">${esc(s.title)}</div><ul class="day-list">${s.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`).join('');
      card.innerHTML = `<div class="day-kicker">좋은 아침 · Good morning</div>
        <div class="morning-face" aria-hidden="true">${c.face}</div>
        <h2>${c.ko} · ${c.en}</h2>
        ${detail.reason === 'allNighter' ? '<p class="day-line">밤을 새웠어요 · You stayed up all night</p>' : ''}
        <div class="vigor big"><span class="vigor-label">기력</span><span class="vigor-bar"><i style="width:${detail.energy}%"></i></span><b class="vigor-num">${detail.energy}</b></div>
        ${extra}`;
      const row = el('div', 'day-buttons');
      const go = el('button', 'btn-primary', '시작 · Start the day');
      go.onclick = () => { close(morningOverlay); resolve(); };
      row.appendChild(go);
      card.appendChild(row);
      morningOverlay.replaceChildren(card);
      morningOverlay.classList.remove('hidden');
      setTimeout(() => fade?.classList.remove('on'), 120);
      go.focus();
    });
  }

  return {
    update,
    recap,
    morning,
    napPrompt,
    toast,
    addMorningSection: (fn) => morningSections.push(fn),
    get open() { return !bedOverlay.classList.contains('hidden') || !morningOverlay.classList.contains('hidden'); },
  };
}

