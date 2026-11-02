// Plays authored relationship scenes (lib/content/routes, built into ./relationship/)
// in the cozy dialogue box. The shared engine picks lines, choices and outcomes, so
// the 3D world and the Relationship Lab play the same scenes the same way.
import { SCENES } from './relationship/scenes.js';
import {
  applyEffects,
  availableChoices,
  fillName,
  initialState,
  legacyAffinity,
  matches,
  moodFor,
  pick,
  resolveChoice,
  tongFor,
} from './relationship/engine.js';

const VOLATILITY = { haeun: 0.55, jin: 0.3 };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * ctx:
 *   S             cozy state; keeps S.rel (RelState per character) and S.story ({ flags, tally })
 *   nodes, dlg    the dialogue node table and runner
 *   speakers      speaker ids the dialogue box can show; unknown ones fall back to narration
 *   exercise(req) → Promise<CozyExerciseResult>
 *   learn(ko, rom, en)
 *   cue(cue, scene)               stage directions: 'sit' | 'serve' | 'phone_buzz' | 'stand' | 'leave'
 *   changed(characterId, { before, after, deltas, beatId, stageChanged })
 *   done(scene, state)            the scene reached its end
 */
export function createScenePlayer(ctx) {
  const { S } = ctx;
  S.rel ??= {};
  S.story ??= { flags: {}, tally: {} };
  let run = null;

  const rel = (id) => (S.rel[id] ??= initialState(id));
  const fill = (s) => fillName(s ?? '', S.name);
  const who = (id) => (ctx.speakers[id] ? id : 'narration');

  function world() {
    return {
      hour: Math.floor(S.hour),
      weather: 'clear',
      playerLevel: Math.min(6, Math.floor(S.phrases.size / 15)),
      inputTier: S.inputTier ?? 1,
      seed: S.seed,
      flags: S.story.flags,
      tally: S.story.tally,
    };
  }

  /** Can this scene start right now (gate passes, not already played)? */
  function available(id) {
    const scene = SCENES[id];
    if (!scene) return false;
    const s = rel(scene.characterId);
    if (scene.kind === 'story' && S.story.flags[`played:${id}`]) return false;
    if (scene.kind === 'ambient' && S.story.flags[`played:${id}:d${S.day}`]) return false;
    return matches(scene.gate, { ...s, day: S.day }, world());
  }

  function apply(effects, beatId) {
    const id = run.scene.characterId;
    const before = run.s;
    const a = applyEffects(before, effects, run.w);
    run.s = a.state;
    run.w = a.world;
    commit();
    for (const v of effects.vocab ?? []) ctx.learn(v.ko, v.rom, v.en);
    ctx.changed(id, { before, after: run.s, deltas: effects.deltas ?? {}, beatId, stageChanged: a.stageChanged });
  }

  // Relationship state and save-wide flags persist after every step.
  function commit() {
    S.rel[run.scene.characterId] = run.s;
    S.story.flags = run.w.flags ?? {};
    S.story.tally = run.w.tally ?? {};
  }

  /** First beat from `id` whose condition holds, registering its node. */
  function resolve(id) {
    for (let guard = 0; id && guard < 50; guard++) {
      const beat = run.byId.get(id);
      if (!beat) break;
      if (!beat.when || matches(beat.when, run.s, run.w)) return beatNode(beat);
      id = beat.next;
    }
    run.done = true;
    return null;
  }

  const key = (beat, part = '') => `${run.scene.id}:${beat.id}${part}`;
  const after = () => run?.done && finish();

  function hintFor(beat, line) {
    const tong = tongFor(beat, run.w, run.scene.characterId);
    const parts = [];
    if (tong) parts.push(`<b>통</b> ${esc(fill(tong.en))}`);
    if (line?.note) parts.push(`<i>${esc(fill(line.note))}</i>`);
    return parts.join('<br>') || null;
  }

  function choicesFor(beat) {
    return availableChoices(beat, run.s, run.w).map((c) => ({
      ko: fill(S.inputTier === 0 ? c.say.en : c.say.ko),
      rom: c.say.rom ? fill(c.say.rom) : undefined,
      en: fill(c.say.en),
      next: () => choose(beat, c),
    }));
  }

  function beatNode(beat) {
    const id = key(beat);
    const line = () => run.line ?? { ko: '', en: '' };
    const choices = beat.choices?.length ? () => choicesFor(beat) : undefined;
    const base = {
      who: who(beat.speaker),
      expr: beat.expr,
      ko: () => fill(line().ko),
      en: () => fill(line().en),
      hint: () => hintFor(beat, line()),
      after,
    };
    const onward = () => (beat.end ? finishNow() : resolve(beat.next));
    ctx.nodes[id] = {
      ...base,
      enter: () => {
        run.line = pick(beat.lines, run.s, run.w);
        if (beat.end && !choices && !beat.exercise) run.done = true;
        if (beat.cue) ctx.cue(beat.cue, run.scene);
        if (beat.effects) apply(beat.effects, id);
      },
      ...(beat.exercise
        ? {
            exercise: () => request(beat.exercise),
            next: (r) => {
              // Closed or unavailable (no Tong host) is not a wrong answer: scenes can branch on _skipped.
              const skipped = r.outcome !== 'completed';
              run.s = { ...run.s, flags: { ...run.s.flags, [`ex_${beat.id}`]: !skipped && !!r.correct, [`ex_${beat.id}_skipped`]: skipped } };
              commit();
              return choices ? key(beat, '#choices') : onward();
            },
          }
        : choices
          ? { choices }
          : { next: onward, end: !!beat.end }),
    };
    if (beat.exercise && choices) ctx.nodes[key(beat, '#choices')] = { ...base, choices };
    return id;
  }

  function choose(beat, c) {
    const r = resolveChoice(c, run.s, run.w, S.inputTier ?? 1);
    const before = run.s;
    run.s = r.state;
    run.w = r.world;
    commit();
    const beatId = `${run.scene.id}:${beat.id}#${c.id}`;
    ctx.changed(run.scene.characterId, { before, after: run.s, deltas: r.outcome.deltas ?? {}, beatId, stageChanged: r.stageChanged });
    for (const v of r.outcome.vocab ?? []) ctx.learn(v.ko, v.rom, v.en);
    const o = r.outcome;
    const nextId = o.next ?? beat.next;
    const id = `${run.scene.id}:~${beat.id}#${c.id}`;
    ctx.nodes[id] = {
      who: who(o.speaker ?? beat.speaker),
      expr: o.expr,
      ko: fill(o.reaction.ko),
      en: fill(o.reaction.en),
      hint: o.reaction.note ? `<i>${esc(fill(o.reaction.note))}</i>` : null,
      after,
      ...(beat.end && !o.next ? { end: true, enter: () => (run.done = true) } : { next: () => resolve(nextId) }),
    };
    return id;
  }

  function request(hook) {
    return {
      exerciseType: hook.type,
      targetItems: hook.targets.map(fill),
      ...(hook.distractors ? { distractors: hook.distractors.map(fill) } : {}),
      objectiveId: hook.objectiveId,
      framing: { speakerId: run.scene.characterId, ko: fill(hook.framing.ko), en: fill(hook.framing.en) },
      cityId: 'seoul',
      locationId: run.scene.location,
      characterId: run.scene.characterId,
    };
  }

  function finishNow() {
    run.done = true;
    return null;
  }

  function finish() {
    const r = run;
    run = null;
    const played = r.scene.kind === 'story' ? `played:${r.scene.id}` : `played:${r.scene.id}:d${S.day}`;
    S.story.flags = { ...S.story.flags, [played]: true };
    ctx.done(r.scene, r.s);
  }

  /** Start a scene in the dialogue box. Returns false when its gate doesn't pass. */
  function play(id) {
    if (!available(id)) return false;
    const scene = SCENES[id];
    const s = rel(scene.characterId);
    const mood = moodFor(scene.characterId, S.day, S.seed, { scheduled: [], lastHangout: 0, volatility: VOLATILITY[scene.characterId] ?? 0.3 });
    run = { scene, byId: new Map(scene.beats.map((b) => [b.id, b])), s: { ...s, day: S.day, mood }, w: world(), line: null, done: false };
    const first = resolve(scene.beats[0].id);
    if (!first) {
      run = null;
      return false;
    }
    ctx.dlg.start(first);
    return true;
  }

  return {
    play,
    available,
    get running() {
      return run?.scene.id ?? null;
    },
    flag: (f) => !!S.story.flags[f],
    tally: (k) => S.story.tally[k] ?? 0,
    stage: (id) => rel(id).stage,
    affinity: (id) => legacyAffinity(rel(id)),
  };
}
