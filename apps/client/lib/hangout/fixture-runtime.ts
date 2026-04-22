import { getLocation } from '../content/locations';
import type {
  AyiLine,
  Beat,
  CliffhangerSpec,
  CreditGate,
  ExerciseHook,
  POVVariant,
  ResolutionSpec,
  SceneFixture,
  TongBeat,
  WebtoonPanel,
} from './fixture-types';

type NpcSpeakerId = 'dingman' | 'shoucheng' | 'fangayi';
export type CreditGateDecision = 'spend' | 'skip';

const CLIFFHANGER_VOCAB_BY_FIXTURE: Record<string, Record<string, { zh: string; py: string; en: string }>> = {
  'shanghai/h1-negotiation': {
    小儿子: { zh: '小儿子', py: 'xiao erzi', en: 'younger son' },
    犟: { zh: '犟', py: 'jiang', en: 'stubborn in a proud, hard way' },
    本事: { zh: '本事', py: 'benshi', en: 'real capability' },
  },
};

type BaseHangoutEvent<TToolName extends string, TArgs extends Record<string, unknown>> = {
  toolCallId: string;
  toolName: TToolName;
  args: TArgs;
  pauses?: boolean;
};

export type NpcSpeakEvent = BaseHangoutEvent<
  'npc_speak',
  {
    characterId: NpcSpeakerId;
    text: string;
    translation: string | null;
    expression: string | null;
    affinityDelta: number | null;
    clarity: 'full' | 'fragment' | null;
  }
>;

export type TongWhisperEvent = BaseHangoutEvent<
  'tong_whisper',
  {
    message: string;
    translation: string | null;
    vocab: TongBeat['vocab'] | null;
    free: boolean;
  }
>;

export type ShowExerciseEvent = BaseHangoutEvent<
  'show_exercise',
  {
    exerciseType: string;
    objectiveId: string;
    exerciseData: null;
    context: string | null;
    hintItems: string[] | null;
    hintCount: number | null;
    hintSubType: null;
    target: string;
    radicalBreakdown: string | null;
  }
>;

export type ShowWebtoonEvent = BaseHangoutEvent<
  'show_webtoon',
  {
    panels: WebtoonPanel[];
    autoAdvance: boolean;
  }
>;

export type SetAtmosphereEvent = BaseHangoutEvent<
  'set_atmosphere',
  {
    description: string;
  }
>;

export type SetBackdropEvent = BaseHangoutEvent<
  'set_backdrop',
  {
    backdropUrl: string;
    transition: 'fade' | 'cut';
    ambientDescription: string | null;
    pov: string | null;
    offscreenVoice: string | null;
  }
>;

export type CreditGateEvent = BaseHangoutEvent<
  'credit_gate',
  {
    cost: number;
    spendPayload: CreditGate['spendPayload'];
    skipPayload: CreditGate['skipPayload'];
  }
>;

export type EndSceneEvent = BaseHangoutEvent<
  'end_scene',
  {
    summary: string;
    xpEarned: number;
    affinityChanges: ResolutionSpec['affinityChanges'];
    calibratedLevel: number | null;
    masteryUpdates: ResolutionSpec['masteryUpdates'];
    stateUpdates: Record<string, unknown> | null;
    nextHook: string | null;
  }
>;

export type HangoutEvent =
  | NpcSpeakEvent
  | TongWhisperEvent
  | ShowExerciseEvent
  | ShowWebtoonEvent
  | SetAtmosphereEvent
  | SetBackdropEvent
  | CreditGateEvent
  | EndSceneEvent;

export type FixtureRuntimeContext = {
  seed?: number;
  povOverride?: string;
  creditGateController?: FixtureCreditGateController;
};

type SelectedPov = {
  key: string | null;
  value: POVVariant | null;
};

const NPC_CHARACTER_BY_SPEAKER: Record<'dingman' | 'shoucheng' | 'ayi', NpcSpeakerId> = {
  dingman: 'dingman',
  shoucheng: 'shoucheng',
  ayi: 'fangayi',
};

export class FixtureCreditGateController {
  private queuedDecisions: CreditGateDecision[] = [];

  private pendingResolve: ((decision: CreditGateDecision) => void) | null = null;

  resolve(decision: CreditGateDecision): void {
    if (this.pendingResolve) {
      const resolve = this.pendingResolve;
      this.pendingResolve = null;
      resolve(decision);
      return;
    }

    this.queuedDecisions.push(decision);
  }

  waitForResolution(): Promise<CreditGateDecision> {
    const queued = this.queuedDecisions.shift();
    if (queued) {
      return Promise.resolve(queued);
    }

    return new Promise<CreditGateDecision>((resolve) => {
      this.pendingResolve = resolve;
    });
  }
}

export function runFixture(
  fixture: SceneFixture,
  context: FixtureRuntimeContext = {},
): AsyncIterable<HangoutEvent> {
  const random = createRandom(context.seed);
  const selectedPov = pickPovVariant(fixture, context.povOverride, random);
  const selectedPairGroups = choosePairGroups(fixture.beats, random);
  const creditGateController = context.creditGateController ?? new FixtureCreditGateController();

  return (async function* generateEvents(): AsyncGenerator<HangoutEvent> {
    let eventIndex = 0;
    let creditGateDecision: CreditGateDecision | null = null;
    const nextEventId = () => makeToolCallId(fixture.id, ++eventIndex);

    const location = resolveFixtureLocation(fixture.location);
    if (selectedPov.value) {
      yield {
        toolCallId: nextEventId(),
        toolName: 'set_backdrop',
        args: {
          backdropUrl: location?.backgroundImageUrl ?? '',
          transition: 'cut',
          ambientDescription: selectedPov.value.seatDescription,
          pov: selectedPov.key,
          offscreenVoice: selectedPov.value.offscreenVoice ?? null,
        },
      };
    }

    if (fixture.entryNarration) {
      yield buildTongWhisperEvent(nextEventId(), {
        text: fixture.entryNarration,
        free: true,
      });
    }

    for (const beat of fixture.beats) {
      if (!shouldEmitBeatForPairSelection(beat, selectedPairGroups)) {
        continue;
      }

      if (beat.tongBeat?.trigger === 'before') {
        yield buildTongWhisperEvent(nextEventId(), beat.tongBeat);
      }

      const beatEvent = buildBeatEvent(nextEventId(), beat);
      if (beatEvent) {
        yield beatEvent;
      }

      if (beat.tongBeat?.trigger === 'after') {
        yield buildTongWhisperEvent(nextEventId(), beat.tongBeat);
      }

      if (beat.exerciseHook) {
        yield buildExerciseEvent(nextEventId(), beat.exerciseHook, beat.followUp ?? beat.intent);
      }
    }

    if (fixture.cliffhanger) {
      yield buildCliffhangerEvent(nextEventId(), fixture.cliffhanger);

      if (fixture.cliffhanger.tongBeat) {
        yield buildTongWhisperEvent(nextEventId(), fixture.cliffhanger.tongBeat);
      }

      if (fixture.cliffhanger.creditGate) {
        yield {
          toolCallId: nextEventId(),
          toolName: 'credit_gate',
          args: {
            cost: fixture.cliffhanger.creditGate.cost,
            spendPayload: fixture.cliffhanger.creditGate.spendPayload,
            skipPayload: fixture.cliffhanger.creditGate.skipPayload,
          },
          pauses: true,
        };

        const decision = await creditGateController.waitForResolution();
        creditGateDecision = decision;
        yield* emitCreditGateFollowUp(
          nextEventId,
          fixture.id,
          fixture.cliffhanger.creditGate,
          decision,
        );
      }
    }

    yield buildEndSceneEvent(nextEventId(), fixture, selectedPov.key, creditGateDecision);
  })();
}

export function buildFixtureResolutionEvents(
  fixture: SceneFixture,
  decision: CreditGateDecision,
  selectedPov: string | null = null,
): HangoutEvent[] {
  const creditGate = fixture.cliffhanger?.creditGate;
  const events: HangoutEvent[] = [];
  let eventIndex = 0;
  const nextEventId = () => makeToolCallId(`${fixture.id}-resolution-${decision}`, ++eventIndex);

  if (creditGate) {
    if (decision === 'spend') {
      for (const line of creditGate.spendPayload.additionalLines ?? []) {
        events.push(buildAyiLineEvent(nextEventId(), line));
      }

      if (creditGate.spendPayload.tongExplanation) {
        events.push(buildTongWhisperEvent(nextEventId(), {
          text: creditGate.spendPayload.tongExplanation,
          free: true,
          vocab: buildUnlockedVocabEntries(fixture.id, creditGate.spendPayload.vocabUnlocks),
        }));
      }
    } else if (creditGate.skipPayload.tongFallback) {
      events.push(buildTongWhisperEvent(nextEventId(), {
        text: creditGate.skipPayload.tongFallback,
        free: true,
      }));
    }
  }

  events.push(buildEndSceneEvent(nextEventId(), fixture, selectedPov, decision));
  return events;
}

function buildBeatEvent(toolCallId: string, beat: Beat): HangoutEvent | null {
  if (beat.speaker === 'ambient') {
    const description = pickBeatText(beat);
    if (!description) {
      return null;
    }

    return {
      toolCallId,
      toolName: 'set_atmosphere',
      args: { description },
    };
  }

  if (beat.speaker === 'webtoon') {
    return null;
  }

  const text = pickBeatText(beat);
  if (!text) {
    return null;
  }

  return {
    toolCallId,
    toolName: 'npc_speak',
    args: {
      characterId: NPC_CHARACTER_BY_SPEAKER[beat.speaker],
      text,
      translation: beat.translation ?? null,
      expression: beat.expression ?? null,
      affinityDelta: null,
      clarity: beat.clarity ?? null,
    },
    pauses: true,
  };
}

function buildTongWhisperEvent(
  toolCallId: string,
  tongBeat: Pick<TongBeat, 'text' | 'free' | 'vocab'>,
): TongWhisperEvent {
  return {
    toolCallId,
    toolName: 'tong_whisper',
    args: {
      message: tongBeat.text,
      translation: null,
      vocab: tongBeat.vocab ?? null,
      free: tongBeat.free,
    },
    pauses: true,
  };
}

function buildExerciseEvent(
  toolCallId: string,
  exerciseHook: ExerciseHook,
  context: string,
): ShowExerciseEvent {
  return {
    toolCallId,
    toolName: 'show_exercise',
    args: {
      exerciseType: exerciseHook.type,
      objectiveId: exerciseHook.target,
      exerciseData: null,
      context,
      hintItems: [exerciseHook.target],
      hintCount: 1,
      hintSubType: null,
      target: exerciseHook.target,
      radicalBreakdown: exerciseHook.radicalBreakdown ?? null,
    },
    pauses: true,
  };
}

function buildCliffhangerEvent(
  toolCallId: string,
  cliffhanger: CliffhangerSpec,
): ShowWebtoonEvent {
  return {
    toolCallId,
    toolName: 'show_webtoon',
    args: {
      panels: cliffhanger.webtoon.panels,
      autoAdvance: cliffhanger.webtoon.autoAdvance ?? false,
    },
    pauses: true,
  };
}

async function* emitCreditGateFollowUp(
  nextEventId: () => string,
  fixtureId: string,
  creditGate: CreditGate,
  decision: CreditGateDecision,
): AsyncGenerator<HangoutEvent> {
  if (decision === 'spend') {
    for (const line of creditGate.spendPayload.additionalLines ?? []) {
      yield buildAyiLineEvent(nextEventId(), line);
    }

    if (creditGate.spendPayload.tongExplanation) {
      yield buildTongWhisperEvent(nextEventId(), {
        text: creditGate.spendPayload.tongExplanation,
        free: true,
        vocab: buildUnlockedVocabEntries(fixtureId, creditGate.spendPayload.vocabUnlocks),
      });
    }

    return;
  }

  if (creditGate.skipPayload.tongFallback) {
    yield buildTongWhisperEvent(nextEventId(), {
      text: creditGate.skipPayload.tongFallback,
      free: true,
    });
  }
}

function buildAyiLineEvent(
  toolCallId: string,
  line: AyiLine,
): NpcSpeakEvent {
  return {
    toolCallId,
    toolName: 'npc_speak',
    args: {
      characterId: 'fangayi',
      text: line.zh,
      translation: line.en ?? null,
      expression: line.expression ?? null,
      affinityDelta: null,
      clarity: line.clarity ?? 'full',
    },
    pauses: true,
  };
}

function buildEndSceneEvent(
  toolCallId: string,
  fixture: SceneFixture,
  selectedPov: string | null,
  decision: CreditGateDecision | null = null,
): EndSceneEvent {
  return {
    toolCallId,
    toolName: 'end_scene',
    args: buildEndSceneArgs(fixture, selectedPov, decision),
  };
}

function buildEndSceneArgs(
  fixture: SceneFixture,
  selectedPov: string | null,
  decision: CreditGateDecision | null,
): EndSceneEvent['args'] {
  const stateUpdates = {
    ...(fixture.resolution.stateUpdates ?? {}),
    ...(selectedPov ? { hangoutSeat: selectedPov } : {}),
  };

  if (fixture.id === 'shanghai/h1-negotiation') {
    const spent = decision === 'spend';
    return {
      summary: spent
        ? 'You tracked the Shanghai H1 negotiation through the family reveal and left with Tong’s read on what the room was really testing.'
        : 'You followed the Shanghai H1 negotiation to the reveal hook and left the family history partially unresolved for later.',
      xpEarned: spent ? 50 : 40,
      affinityChanges: fixture.resolution.affinityChanges,
      calibratedLevel: 0,
      masteryUpdates: fixture.resolution.masteryUpdates,
      stateUpdates: Object.keys(stateUpdates).length > 0 ? stateUpdates : null,
      nextHook: fixture.resolution.nextHook ?? null,
    };
  }

  return {
    summary: `Completed fixture ${fixture.id}`,
    xpEarned: 0,
    affinityChanges: fixture.resolution.affinityChanges,
    calibratedLevel: null,
    masteryUpdates: fixture.resolution.masteryUpdates,
    stateUpdates: Object.keys(stateUpdates).length > 0 ? stateUpdates : null,
    nextHook: fixture.resolution.nextHook ?? null,
  };
}

function buildUnlockedVocabEntries(
  fixtureId: string,
  vocabUnlocks: string[] | undefined,
): TongBeat['vocab'] {
  const fixtureMap = CLIFFHANGER_VOCAB_BY_FIXTURE[fixtureId] ?? {};
  const entries = (vocabUnlocks ?? []).map((item) => fixtureMap[item] ?? { zh: item, py: '', en: '' });
  return entries.length > 0 ? entries : undefined;
}

function pickBeatText(beat: Beat): string | null {
  return beat.lockedLines?.[0]
    ?? beat.variantExamples?.[0]
    ?? beat.followUp
    ?? beat.translation
    ?? beat.intent
    ?? null;
}

function resolveFixtureLocation(locationKey: string) {
  const [cityId, locationId] = locationKey.split(':');
  if (!cityId || !locationId) {
    return null;
  }

  return getLocation(cityId, locationId);
}

function pickPovVariant(
  fixture: SceneFixture,
  povOverride: string | undefined,
  random: () => number,
): SelectedPov {
  const entries = Object.entries(fixture.povVariants ?? {}).sort(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) {
    return { key: null, value: null };
  }

  if (povOverride) {
    const overridden = entries.find(([key]) => key === povOverride);
    if (overridden) {
      return { key: overridden[0], value: overridden[1] };
    }
  }

  const selected = entries[Math.floor(random() * entries.length)] ?? entries[0];
  return { key: selected[0], value: selected[1] };
}

function choosePairGroups(
  beats: Beat[],
  random: () => number,
): Map<string, string> {
  const optionsByFamily = new Map<string, Set<string>>();

  for (const beat of beats) {
    if (!beat.pairGroup) {
      continue;
    }

    const family = getPairGroupFamily(beat.pairGroup);
    const options = optionsByFamily.get(family) ?? new Set<string>();
    options.add(beat.pairGroup);
    optionsByFamily.set(family, options);
  }

  const selected = new Map<string, string>();
  for (const [family, options] of optionsByFamily.entries()) {
    const orderedOptions = [...options].sort();
    const choice = orderedOptions.length <= 1
      ? orderedOptions[0]
      : orderedOptions[Math.floor(random() * orderedOptions.length)] ?? orderedOptions[0];
    selected.set(family, choice);
  }

  return selected;
}

function shouldEmitBeatForPairSelection(
  beat: Beat,
  selectedPairGroups: Map<string, string>,
): boolean {
  if (!beat.pairGroup) {
    return true;
  }

  return selectedPairGroups.get(getPairGroupFamily(beat.pairGroup)) === beat.pairGroup;
}

function getPairGroupFamily(pairGroup: string): string {
  const lastDashIndex = pairGroup.lastIndexOf('-');
  return lastDashIndex === -1 ? pairGroup : pairGroup.slice(0, lastDashIndex);
}

function createRandom(seed: number | undefined): () => number {
  if (seed == null) {
    return () => Math.random();
  }

  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function makeToolCallId(fixtureId: string, eventIndex: number): string {
  const safeFixtureId = fixtureId.replace(/[^a-zA-Z0-9_-]+/g, '-');
  return `fixture-${safeFixtureId}-${eventIndex}`;
}
