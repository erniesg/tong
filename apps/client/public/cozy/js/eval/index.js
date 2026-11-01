// Seoul evals in the cozy world: the studio schedule board, the confirm prompt,
// eval day (four rounds), results night and 리허설 with Coach Park.
// main.js only wires this in (save/load of S.chapter, one interactable list, one build call).

import * as THREE from 'three';
import { TERRACE_Y } from '../world.js';
import {
  normalizeChapter, isUnlocked, missingBeats, canStart, confirmEval, evalDayDue, beginEvalDay,
  recordRound, restartRound, finishEval, recordRehearsal, CONFIRM_LINE,
} from './chapter.js';
import { hashSeed, scoreRound, suggestTier, gradeEval, rankBoard, weakObjectives, updateMastery, tierMultiplier } from './runner.js';
import { EVAL1, itemsFor, danceItems, lunchOutcome, LUNCH, ROSTER, RESULT_LINES, PROFILE_OPTIONS, defaultProfile } from './eval1.js';
import { createEvalUI } from './ui.js';
import { createTtsAudio } from './voice.js';
import { getDayLoop } from '../day.js';

const BOARD = { x: -7.3, z: -43.2 }; // studio back wall, right of the word-quiz whiteboard
const MONTH_KO = { 1: '3월', 2: '4월', 3: '5월' };
const ROUND_NOTE = {
  vocal: 'Song 1 「좋아요」: dictation and questions.',
  dance: 'Follow the call on the beat.',
  judges: 'Trainee profile, then three questions.',
  field: 'Team lunch run at the 분식집.',
};

/**
 * ctx: { S, save(), toast(html, ms), isBusy(): bool, goTo(placeId), setHour(h), isMuted(), sfx }
 */
export function createSeoulEval(ctx) {
  const { S } = ctx;
  const chapter = () => (S.chapter = S.chapter && S.chapter.v ? S.chapter : normalizeChapter(S.chapter));
  const setChapter = (c) => { S.chapter = c; ctx.save(); refreshBoard(); };
  const flags = () => S.story?.flags ?? {};
  const debug = typeof location !== 'undefined' && (/[?&]evaldebug\b/.test(location.search) || safeGet('tong-eval-debug') === '1');
  let ui = null;
  let running = false;
  let boardTex = null;

  function getUI() {
    if (ui) return ui;
    if (typeof document !== 'undefined' && !document.querySelector('link[data-eval-css]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = new URL('./eval.css', import.meta.url).href;
      link.dataset.evalCss = '';
      document.head.append(link);
    }
    const audio = createTtsAudio({ isMuted: () => !!ctx.isMuted?.() });
    ui = createEvalUI({ root: document.getElementById('game-shell') ?? document.body, audio, sfx: ctx.sfx ?? {}, debug });
    return ui;
  }

  /* ── The schedule board ──────────────────────────── */

  function boardLines() {
    const c = chapter();
    const month = MONTH_KO[c.month] ?? `${c.month}월`;
    if (c.status === 'eve') return [month, '평가: 내일', 'Eval: tomorrow'];
    if (c.status === 'eval') return [month, '평가 중', 'Eval day'];
    if (c.month > EVAL1.month && c.results[EVAL1.month]) return [month, `1차 평가 ${c.results[EVAL1.month].band}`, 'Results posted'];
    return [month, isUnlocked(c, flags()) ? '평가 열림' : '연습', isUnlocked(c, flags()) ? 'Eval open' : 'Practice'];
  }

  function paintBoard() {
    if (!boardTex) return;
    const cv = boardTex.image;
    const g = cv.getContext('2d');
    g.fillStyle = '#20314f';
    g.fillRect(0, 0, cv.width, cv.height);
    g.strokeStyle = '#ffd23f';
    g.lineWidth = 10;
    g.strokeRect(8, 8, cv.width - 16, cv.height - 16);
    g.textAlign = 'center';
    g.fillStyle = '#fff';
    g.font = '64px Jua, sans-serif';
    g.fillText('스케줄표', cv.width / 2, 92);
    const [m, ko, en] = boardLines();
    g.font = '52px Jua, sans-serif';
    g.fillStyle = '#ffd23f';
    g.fillText(`${m} · ${ko}`, cv.width / 2, 190);
    g.font = '34px "Gowun Dodum", sans-serif';
    g.fillStyle = '#cfe0ff';
    g.fillText(en, cv.width / 2, 250);
    boardTex.needsUpdate = true;
  }
  const refreshBoard = () => paintBoard();

  /** Adds the board mesh to the Seoul city group (called once from boot). */
  function build(group) {
    if (typeof document === 'undefined') return;
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 300;
    boardTex = new THREE.CanvasTexture(cv);
    boardTex.colorSpace = THREE.SRGBColorSpace;
    paintBoard();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.76), new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.5, emissive: 0xffffff, emissiveMap: boardTex, emissiveIntensity: 0.25 }));
    mesh.position.set(BOARD.x, TERRACE_Y + 1.6, -43.96);
    mesh.name = 'seoul-eval-board';
    group.add(mesh);
  }

  async function openBoard() {
    if (running) return;
    const u = getUI();
    const c = chapter();
    const unlocked = isUnlocked(c, flags());
    const actions = [];
    let body;
    if (c.month > EVAL1.month) {
      body = `<p>이번 달 평가는 아직 없어요.</p><p class="eval-muted">Eval ${c.month} isn't built yet.</p>`;
    } else if (c.status === 'eve') {
      body = '<p><b>평가는 내일이에요.</b></p><p class="eval-muted">Eval day is tomorrow. Go to bed when you are ready.</p>';
      actions.push({ label: '🛏️ 자러 가기 · Sleep until morning', value: 'sleep', primary: true, id: 'sleep' });
    } else if (canStart(c, flags())) {
      body = '<p><b>1차 평가: 입소 평가</b></p><p class="eval-muted">Eval 1 is open. Vocal, dance, judges, then a field quest.</p>';
      actions.push({ label: '평가 시작 · Start the eval', value: 'start', primary: true, id: 'start' });
    } else if (!unlocked) {
      body = `<p>아직이에요. 연습 먼저!</p><p class="eval-muted">Not yet. This month's practice comes first (${missingBeats(c, flags()).length} left).</p>`;
    }
    actions.push({ label: '💃 리허설 · Rehearsal', value: 'rehearse', id: 'rehearse' });
    if (debug && c.status === 'open' && !unlocked && c.month <= EVAL1.month) actions.push({ label: '🛠 Force unlock (debug)', value: 'force', id: 'force' });
    actions.push({ label: '닫기 · Close', value: 'close', id: 'close' });
    const choice = await u.show({ eyebrow: '연습실 · Practice studio', title: `스케줄표 · ${MONTH_KO[c.month] ?? ''}`, body, actions, tag: 'board' });
    if (choice === 'force') { forceUnlock(); return openBoard(); }
    if (choice === 'start') return askConfirm();
    if (choice === 'sleep') { u.close(); return sleepUntilMorning(); }
    if (choice === 'rehearse') return rehearse();
    u.close();
  }

  async function askConfirm() {
    const u = getUI();
    const yes = await u.show({
      eyebrow: '1차 평가 · Eval 1', title: CONFIRM_LINE.ko, sub: CONFIRM_LINE.en,
      body: '<p class="eval-muted">Confirming makes tomorrow eval day. You play it once and the score counts.</p>',
      actions: [{ label: '네, 준비됐어요 · Confirm', value: true, primary: true, id: 'confirm' }, { label: '아직이요 · Not yet', value: false, id: 'cancel' }],
      tag: 'confirm',
    });
    u.close();
    if (!yes) return false;
    setChapter(confirmEval(chapter(), flags(), S.day));
    ctx.toast?.('<b>내일은 평가 날</b><span>Eval day is tomorrow.</span>', 2800);
    return true;
  }

  /** Eval eve: go to bed through the day loop (#410) so bedtime sets eval-day condition. */
  async function sleepUntilMorning() {
    const day = getDayLoop();
    if (day) return day.sleepUntilMorning({});
    S.day += 1; // no day loop (tests, other cities): plain advance
    S.hour = 8;
    ctx.save();
  }

  /** Tired players get a tighter Perfect window (condition from last night's bedtime). */
  const windowScale = () => getDayLoop()?.getCondition?.().timingWindowScale ?? 1;

  function forceUnlock() {
    setChapter({ ...chapter(), forced: true });
  }

  /* ── Eval day ────────────────────────────────────── */

  // Eval day starts the next time the world is free on the morning of evalDay (any sleep path).
  const poll = typeof setInterval !== 'undefined' ? setInterval(() => {
    if (running || !S.started || S.city !== 'seoul' || ctx.isBusy?.()) return;
    const c = chapter();
    if (evalDayDue(c, S.day, S.hour) || c.status === 'eval') runEvalDay();
  }, 500) : null;

  async function profileSetup() {
    const c = chapter();
    if (c.profile) return c.profile;
    const u = getUI();
    const base = { ...defaultProfile(S.name), name: S.name };
    const form = u.el('div', 'eval-profile');
    const sel = (label, key, opts) => {
      const l = u.el('label', 'field', label);
      const s = u.el('select');
      s.dataset.profile = key;
      for (const [v, t] of opts) s.add(new Option(t, String(v)));
      s.value = String(key.includes('.') ? base.birth[key.split('.')[1]] : base[key]);
      l.append(s);
      form.append(l);
      return s;
    };
    const hobbies = PROFILE_OPTIONS.hobby.map(([k, e]) => [k, `${k} · ${e}`]);
    const fields = {
      nationality: sel('Nationality', 'nationality', PROFILE_OPTIONS.nationality.map(([k, e]) => [k, `${k} · ${e}`])),
      y: sel('Birth year', 'birth.y', [2005, 2006, 2007, 2008, 2009].map((y) => [y, y])),
      m: sel('Month', 'birth.m', Array.from({ length: 12 }, (_, i) => [i + 1, i + 1])),
      d: sel('Day', 'birth.d', Array.from({ length: 28 }, (_, i) => [i + 1, i + 1])),
      hobby: sel('Hobby', 'hobby', hobbies),
      specialty: sel('Special skill', 'specialty', hobbies),
      family: sel('Family (people, incl. you)', 'family', PROFILE_OPTIONS.family.map((n) => [n, n])),
    };
    await u.show({
      eyebrow: '심사 · Judges', title: '연습생 카드 · Trainee card', sub: 'Agency paperwork. Ungraded: the judges will ask about this.',
      body: form, actions: [{ label: '저장 · Save', value: true, primary: true, id: 'profile-save' }], tag: 'profile',
    });
    const profile = {
      name: S.name, nationality: fields.nationality.value,
      birth: { y: Number(fields.y.value), m: Number(fields.m.value), d: Number(fields.d.value) },
      hobby: fields.hobby.value, specialty: fields.specialty.value === fields.hobby.value ? (fields.hobby.value === '춤' ? '노래' : '춤') : fields.specialty.value,
      family: Number(fields.family.value),
    };
    setChapter({ ...chapter(), profile });
    return profile;
  }

  async function chooseTier(round, suggested) {
    const u = getUI();
    const tiers = [1, 2, 3].filter((t) => t <= round.maxTier);
    const label = { 1: '1단계 · Tier 1 · with help', 2: '2단계 · Tier 2 · build it', 3: '3단계 · Tier 3 · type it' };
    const actions = tiers.map((t) => {
      const m = tierMultiplier(t, suggested);
      return { label: `${label[t]}${t === suggested ? ' (추천 · suggested)' : ` ×${m}`}`, value: t, primary: t === suggested, id: `tier-${t}` };
    });
    return u.show({ eyebrow: `${EVAL1.title.ko} · ${round.en}`, title: `${round.ko} · ${round.en}`, sub: ROUND_NOTE[round.id], actions, tag: `tier-${round.id}` });
  }

  const compact = (it, r) => ({ itemId: it.id, skill: it.skill, objective: it.objective, correct: !!r.correct, ...(r.timing ? { timing: r.timing } : {}), ...(r.hint ? { hint: true } : {}), answer: r.answer });

  async function playRound(round, { seed, rehearsal = false, tier } = {}) {
    const u = getUI();
    const c = chapter();
    const suggested = suggestTier(c.mastery, round.skill, Math.min(2, round.maxTier));
    tier ??= await chooseTier(round, suggested);
    const profile = round.id === 'judges' ? await profileSetup() : null;
    const items = itemsFor(round.id, seed, tier, profile ?? c.profile ?? defaultProfile(S.name));
    const records = [];
    const responses = {};
    const eyebrow = rehearsal ? '리허설 · Rehearsal' : `${EVAL1.title.ko} · ${round.en}`;
    if (round.id === 'field') {
      await u.show({ eyebrow, title: '단톡방 · Group chat', sub: 'Lunch order for five. Read it, then order at the counter.', body: chatNode(u), tag: 'chat' });
    }
    if (round.id === 'dance') {
      const results = await u.runDance(items, { tier, eyebrow, title: '박 코치 · Coach Park', sub: rehearsal ? '리허설: ungraded.' : 'Move on the last beat.', showEn: false, windowScale: windowScale() });
      items.forEach((it, i) => records.push(compact(it, results[i])));
    } else {
      for (const [i, it] of items.entries()) {
        const r = await u.runItem(it, { eyebrow, title: `${round.ko} · ${round.en}`, index: i, total: items.length });
        responses[it.id] = r;
        records.push(compact(it, r));
      }
    }
    const summary = scoreRound(records, { tier, suggested });
    if (round.id === 'field') await lunchScene(u, responses);
    return { ...summary, items: summary.items.map((r) => ({ ...r, score: Math.round(r.score * 100) / 100 })) };
  }

  function chatNode(u) {
    const box = u.el('div', 'eval-chat');
    for (const m of LUNCH.chat) {
      const row = u.el('div', `eval-msg${m.who === 'me' ? ' me' : ''}`);
      if (m.who !== 'me') row.append(u.el('b', null, m.who));
      row.append(u.el('span', null, m.ko));
      box.append(row);
    }
    return box;
  }

  async function lunchScene(u, responses) {
    const out = lunchOutcome(responses);
    const body = u.el('div', 'eval-lunch');
    if (!out.length) body.append(u.el('p', null, '주문 성공! Everything arrives as ordered.'));
    for (const o of out) {
      const row = u.el('div', 'eval-react');
      row.append(u.el('span', 'eval-muted', `Arrives: ${o.arrives}`), u.el('div', null, `${o.who}: ${o.ko}`), u.el('small', 'eval-muted', o.en));
      body.append(row);
    }
    await u.show({ eyebrow: '현장 미션 · Field quest', title: '연습실 도착 · Back at the studio', body, tag: 'lunch' });
  }

  async function roundCard(round, summary) {
    const u = getUI();
    const right = summary.items.filter((r) => r.correct).length;
    await u.show({
      eyebrow: `${EVAL1.title.ko} · ${round.en}`, title: `${round.ko} ${summary.score}`,
      body: `<p>${right}/${summary.items.length} correct · tier ${summary.tier}${summary.multiplier !== 1 ? ` ×${summary.multiplier}` : ''}</p>`,
      tag: `done-${round.id}`,
    });
  }

  async function runEvalDay() {
    if (running) return;
    running = true;
    try {
      const u = getUI();
      let c = chapter();
      if (c.status === 'eve') {
        c = beginEvalDay(c, hashSeed(S.seed, 'eval', c.month));
        setChapter(c);
        S.hour = Math.max(S.hour, 8);
        await u.show({
          eyebrow: '평가 날 · Eval day', title: `${EVAL1.title.ko} · ${EVAL1.title.en}`,
          body: `<ol class="eval-plan">${EVAL1.rounds.map((r) => `<li>${r.ko} · ${r.en}</li>`).join('')}</ol><p class="eval-muted">Played once. The score counts.</p>`,
          actions: [{ label: '시작 · Begin', value: true, primary: true, id: 'begin' }], tag: 'eval-intro',
        });
      }
      while (chapter().status === 'eval' && chapter().run.round < EVAL1.rounds.length) {
        // Each start bumps the attempt and saves, so a closed tab restarts this round with fresh items.
        setChapter(restartRound(chapter()));
        const run = chapter().run;
        const round = EVAL1.rounds[run.round];
        if (round.slot === 'afternoon') {
          S.hour = Math.max(S.hour, 13);
          await ctx.goTo?.(LUNCH.place);
        }
        const summary = await playRound(round, { seed: hashSeed(run.seed, round.id, run.attempt) });
        setChapter(recordRound(chapter(), round.id, summary));
        await roundCard(round, summary);
      }
      if (chapter().status === 'eval') await resultsNight();
    } finally {
      running = false;
      ui?.close();
    }
  }

  function computeResults(c) {
    const rounds = EVAL1.rounds.map((r) => c.run.rounds[r.id]).filter(Boolean);
    const scores = Object.fromEntries(EVAL1.rounds.map((r) => [r.id, c.run.rounds[r.id]?.score ?? 0]));
    const { grade, band, probation } = gradeEval(scores);
    const items = rounds.flatMap((r) => r.items);
    const board = rankBoard({ seed: c.run.seed, month: c.month, player: { name: S.name, grade }, roster: ROSTER });
    const rank = board.find((r) => r.id === 'player').rank;
    return {
      result: { grade, band, probation, scores, rank, of: board.length, board, tiers: Object.fromEntries(rounds.map((r, i) => [EVAL1.rounds[i].id, r.tier])) },
      weak: weakObjectives(items),
      mastery: updateMastery(c.mastery, rounds, { gain: 0.5 }),
    };
  }

  async function resultsNight() {
    const u = getUI();
    S.hour = Math.max(S.hour, 21);
    await ctx.goTo?.('studio');
    const c = chapter();
    const out = computeResults(c);
    const { result } = out;
    setChapter(finishEval(c, out));
    const body = u.el('div', 'eval-results');
    const big = u.el('div', `eval-grade band-${result.band}`);
    big.append(u.el('span', 'eval-band', result.band), u.el('span', 'eval-score', `${result.grade}`));
    const rounds = u.el('table', 'eval-rounds');
    for (const r of EVAL1.rounds) {
      const tr = u.el('tr');
      tr.append(u.el('td', null, `${r.ko} · ${r.en}`), u.el('td', null, `${result.scores[r.id]}`));
      rounds.append(tr);
    }
    const board = u.el('ol', 'eval-board');
    for (const row of result.board) {
      const li = u.el('li', row.npc ? '' : 'me');
      li.append(u.el('span', 'eval-rank', `${row.rank}`), u.el('span', 'eval-name', row.npc ? row.name : `${row.name} (나)`), u.el('span', 'eval-rg', `${row.band} ${row.grade}`));
      board.append(li);
    }
    const line = result.probation ? RESULT_LINES.probation : RESULT_LINES.pass;
    const say = u.el('div', `eval-line${result.probation ? ' probation' : ''}`);
    say.append(u.el('b', null, `${line.who}: `), u.el('span', null, line.ko), u.el('small', 'eval-muted', ` ${line.en}`));
    body.append(big, rounds, u.el('h3', null, '순위 · Ranking'), board, say);
    if (out.weak.length) body.append(u.el('p', 'eval-muted', `Next month's practice: ${out.weak.length} weak point${out.weak.length > 1 ? 's' : ''}.`));
    await u.show({ eyebrow: '결과 발표 · Results night', title: `${result.rank}위 / ${result.of}`, body, wide: true, tag: 'results', actions: [{ label: '닫기 · Close', value: true, primary: true, id: 'results-close' }] });
    ctx.toast?.('<b>4월 · April</b><span>A new month begins.</span>', 3000);
  }

  /* ── 리허설: ungraded practice with Coach Park ───── */

  async function rehearse() {
    if (running) return;
    running = true;
    try {
      const u = getUI();
      const c = chapter();
      const round = EVAL1.rounds.find((r) => r.id === 'dance');
      const seed = hashSeed(S.seed, 'rehearsal', c.rehearsals);
      const suggested = suggestTier(c.mastery, round.skill, 2);
      const tier = await chooseTier(round, suggested);
      const items = danceItems(seed, tier, 6);
      getDayLoop()?.spend?.('dance');
      const results = await u.runDance(items, { tier, eyebrow: '리허설 · Rehearsal', title: '박 코치 · Coach Park', sub: '다시. Ungraded.', windowScale: windowScale() });
      const records = items.map((it, i) => compact(it, results[i]));
      const summary = scoreRound(records, { tier, suggested });
      setChapter(recordRehearsal(chapter(), updateMastery(chapter().mastery, [summary], { gain: 0.25 })));
      await u.show({ eyebrow: '리허설 · Rehearsal', title: `${summary.items.filter((r) => r.correct).length}/${items.length}`, body: '<p class="eval-muted">Practice only. Grades and rank are unchanged.</p>', tag: 'rehearsal-done' });
    } finally {
      running = false;
      ui?.close();
    }
  }

  const interactables = [{
    label: '📋 스케줄표 · Schedule board',
    pos: () => new THREE.Vector3(BOARD.x, TERRACE_Y, BOARD.z),
    r: 1.6,
    on: () => true,
    act: openBoard,
  }];

  return {
    interactables, build, openBoard, rehearse, forceUnlock, sleepUntilMorning, runEvalDay,
    confirm: () => { if (!canStart(chapter(), flags())) return false; setChapter(confirmEval(chapter(), flags(), S.day)); return true; },
    get chapter() { return chapter(); },
    get running() { return running; },
    stop: () => poll && clearInterval(poll),
  };
}

function safeGet(k) {
  try { return localStorage.getItem(k); } catch { return null; }
}
