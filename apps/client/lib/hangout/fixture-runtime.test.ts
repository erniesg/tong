import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FixtureCreditGateController,
  runFixture,
  type HangoutEvent,
} from './fixture-runtime';
import type { SceneFixture } from './fixture-types';

function buildFixture(overrides: Partial<SceneFixture> = {}): SceneFixture {
  return {
    id: 'shanghai/h1-negotiation',
    location: 'shanghai:dumpling_shop',
    entryNarration: 'Two people. One is eating, one is not.',
    povVariants: {
      dingman: {
        seatDescription: 'You face 丁漫 while 守成 sits behind your shoulder.',
      },
      shoucheng: {
        seatDescription: 'You face 守成 while 丁漫 eats just beyond your right.',
      },
    },
    seatingRandomized: true,
    beats: [
      {
        id: 'b1a',
        speaker: 'shoucheng',
        intent: 'opening ask',
        lockedLines: ['方案你看过了。'],
      },
      {
        id: 'b1b',
        speaker: 'dingman',
        intent: 'brief reply',
        lockedLines: ['看了。'],
      },
      {
        id: 'b1c',
        speaker: 'shoucheng',
        intent: 'follow-up',
        lockedLines: ['想法？'],
      },
    ],
    resolution: {
      masteryUpdates: [{ id: 'zh-vocab-fangan', item: '方案', firstContact: true }],
      affinityChanges: [{ characterId: 'fangayi', delta: 3 }],
    },
    ...overrides,
  };
}

async function collectEvents(iterable: AsyncIterable<HangoutEvent>): Promise<HangoutEvent[]> {
  const events: HangoutEvent[] = [];
  for await (const event of iterable) {
    events.push(event);
  }
  return events;
}

test('fixture with 3 beats emits 3 npc_speak events in order', async () => {
  const events = await collectEvents(runFixture(buildFixture(), { povOverride: 'dingman' }));
  const npcLines = events
    .filter((event): event is Extract<HangoutEvent, { toolName: 'npc_speak' }> => event.toolName === 'npc_speak')
    .map((event) => event.args.text);

  assert.deepEqual(npcLines, ['方案你看过了。', '看了。', '想法？']);
});

test('beat with tongBeat trigger=after emits npc_speak then tong_whisper', async () => {
  const fixture = buildFixture({
    beats: [
      {
        id: 'b1',
        speaker: 'shoucheng',
        intent: 'opening ask',
        lockedLines: ['方案你看过了。'],
        tongBeat: {
          trigger: 'after',
          text: '方案 means proposal here.',
          free: true,
        },
      },
    ],
  });

  const events = await collectEvents(runFixture(fixture, { povOverride: 'dingman' }));
  const toolNames = events.slice(0, 3).map((event) => event.toolName);

  assert.deepEqual(toolNames, ['set_backdrop', 'tong_whisper', 'npc_speak']);
  assert.equal(events[3]?.toolName, 'tong_whisper');
});

test('beat with exerciseHook emits npc_speak then tong_whisper then show_exercise', async () => {
  const fixture = buildFixture({
    beats: [
      {
        id: 'b1',
        speaker: 'shoucheng',
        intent: 'teaching beat',
        lockedLines: ['方案你看过了。'],
        tongBeat: {
          trigger: 'after',
          text: '方案 is the word you want here.',
          free: true,
        },
        exerciseHook: {
          type: 'matching',
          target: '方案',
        },
      },
    ],
  });

  const events = await collectEvents(runFixture(fixture, { povOverride: 'dingman' }));
  const sequence = events.map((event) => event.toolName);

  assert.deepEqual(sequence.slice(2, 5), ['npc_speak', 'tong_whisper', 'show_exercise']);
});

test('seed=42 twice produces identical output', async () => {
  const fixture = buildFixture({
    beats: [
      {
        id: 'pair-a-1',
        speaker: 'shoucheng',
        intent: 'pair A setup',
        lockedLines: ['这个节目需要一个不装的人。'],
        pairGroup: 'negotiation-A',
      },
      {
        id: 'pair-b-1',
        speaker: 'shoucheng',
        intent: 'pair B setup',
        lockedLines: ['这个节目需要一个不会说假话的人。'],
        pairGroup: 'negotiation-B',
      },
      {
        id: 'pair-a-2',
        speaker: 'dingman',
        intent: 'pair A reply',
        lockedLines: ['...你觉得我不装？'],
        pairGroup: 'negotiation-A',
      },
      {
        id: 'pair-b-2',
        speaker: 'dingman',
        intent: 'pair B reply',
        lockedLines: ['...你觉得我不会说假话？'],
        pairGroup: 'negotiation-B',
      },
    ],
  });

  const firstRun = await collectEvents(runFixture(fixture, { seed: 42 }));
  const secondRun = await collectEvents(runFixture(fixture, { seed: 42 }));

  assert.deepEqual(firstRun, secondRun);
});

test('pairGroup selection never mixes across pairs', async () => {
  const fixture = buildFixture({
    beats: [
      {
        id: 'pair-a-1',
        speaker: 'shoucheng',
        intent: 'pair A setup',
        lockedLines: ['A1'],
        pairGroup: 'scene-A',
      },
      {
        id: 'pair-b-1',
        speaker: 'shoucheng',
        intent: 'pair B setup',
        lockedLines: ['B1'],
        pairGroup: 'scene-B',
      },
      {
        id: 'pair-a-2',
        speaker: 'dingman',
        intent: 'pair A reply',
        lockedLines: ['A2'],
        pairGroup: 'scene-A',
      },
      {
        id: 'pair-b-2',
        speaker: 'dingman',
        intent: 'pair B reply',
        lockedLines: ['B2'],
        pairGroup: 'scene-B',
      },
    ],
  });

  const events = await collectEvents(runFixture(fixture, { seed: 42 }));
  const lines = events
    .filter((event): event is Extract<HangoutEvent, { toolName: 'npc_speak' }> => event.toolName === 'npc_speak')
    .map((event) => event.args.text);

  const onlyA = lines.includes('A1') && lines.includes('A2') && !lines.includes('B1') && !lines.includes('B2');
  const onlyB = lines.includes('B1') && lines.includes('B2') && !lines.includes('A1') && !lines.includes('A2');

  assert.equal(onlyA || onlyB, true);
});

test('cliffhanger webtoon emits show_webtoon with all panels', async () => {
  const controller = new FixtureCreditGateController();
  controller.resolve('skip');

  const fixture = buildFixture({
    cliffhanger: {
      webtoon: {
        panels: [
          {
            id: 'p1',
            imageUrl: '/assets/webtoon/shanghai/h1/p1.png',
            widthType: 'full-width',
            heightClass: 'tall',
            aspectRatio: '2:3',
            shotType: 'wide-establishing',
            gapBefore: { px: 120, color: '#f4f0e8' },
            transition: 'cut',
          },
          {
            id: 'p2',
            imageUrl: '/assets/webtoon/shanghai/h1/p2.png',
            widthType: 'full-width',
            heightClass: 'standard',
            aspectRatio: '1:1',
            shotType: 'medium-ots',
            gapBefore: { px: 120, color: '#f4f0e8' },
            transition: 'cut',
          },
          {
            id: 'p3',
            imageUrl: '/assets/webtoon/shanghai/h1/p3.png',
            widthType: 'full-bleed',
            heightClass: 'tall',
            aspectRatio: '4:7',
            shotType: 'extreme-closeup',
            gapBefore: { px: 300, color: '#000000' },
            isThumbStop: true,
            bubble: {
              zh: '瞿家的小儿子……',
              py: 'Qú jiā de xiǎo érzi...',
              en: 'The Qu family’s younger son...',
              speaker: 'ayi',
              position: 'center-bottom',
            },
            transition: 'darken',
          },
        ],
      },
      creditGate: {
        cost: 10,
        spendPayload: {},
        skipPayload: {},
      },
    },
  });

  const events = await collectEvents(runFixture(fixture, {
    povOverride: 'dingman',
    creditGateController: controller,
  }));
  const webtoonEvent = events.find((event): event is Extract<HangoutEvent, { toolName: 'show_webtoon' }> => event.toolName === 'show_webtoon');

  assert.ok(webtoonEvent);
  assert.equal(webtoonEvent.args.panels.length, 3);
});

test('credit gate pauses until an external resolution arrives', async () => {
  const controller = new FixtureCreditGateController();
  const fixture = buildFixture({
    cliffhanger: {
      webtoon: {
        panels: [
          {
            id: 'p1',
            imageUrl: '/assets/webtoon/shanghai/h1/p1.png',
            widthType: 'full-width',
            heightClass: 'tall',
            aspectRatio: '2:3',
            shotType: 'wide-establishing',
            gapBefore: { px: 120, color: '#f4f0e8' },
            transition: 'cut',
          },
        ],
      },
      creditGate: {
        cost: 10,
        spendPayload: {
          additionalLines: [
            {
              zh: '跟他爸一个脾气。',
              en: 'He has the same temper as his father.',
            },
          ],
        },
        skipPayload: {
          tongFallback: 'She knows his family.',
        },
      },
    },
  });

  const iterator = runFixture(fixture, {
    povOverride: 'dingman',
    creditGateController: controller,
  })[Symbol.asyncIterator]();

  let current = await iterator.next();
  while (!current.done && current.value.toolName !== 'credit_gate') {
    current = await iterator.next();
  }

  assert.equal(current.done, false);
  assert.equal(current.value?.toolName, 'credit_gate');

  let resumed = false;
  const pendingNext = iterator.next().then((value) => {
    resumed = true;
    return value;
  });

  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(resumed, false);

  controller.resolve('skip');

  const followUp = await pendingNext;
  assert.equal(followUp.value?.toolName, 'tong_whisper');

  const finalEvent = await iterator.next();
  assert.equal(finalEvent.value?.toolName, 'end_scene');
});
