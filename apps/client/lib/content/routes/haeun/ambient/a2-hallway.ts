import type { SceneModule } from '../../../../relationship/types';

/**
 * A2 · 복도 — passing in the agency corridor after a lesson. Two beats. A bid you
 * turn toward or away from; what she shows depends on how the lesson went.
 */
export const module: SceneModule = {
  scene: {
    id: 'haeun.a2.hallway',
    kind: 'ambient',
    title: { ko: '복도에서', en: 'In the corridor' },
    characterId: 'haeun',
    location: 'agency_lockers',
    gate: { hours: { from: 10, to: 18 }, stageAtLeast: 'acquaintances' },
    summary:
      'A brief pass in the corridor. Just flagged by Coach Park: she wants space, and a wordless act of service lands. Topped the ranking: she pretends not to care. Ordinary day with warmth ahead of stage: her 반말 slips and you can catch it.',
    beats: [
      {
        id: 'scene',
        speaker: 'narrator',
        lines: [
          {
            when: { mood: ['raw'] },
            value: {
              ko: '하은이, 다시. 오늘 왜 이래?',
              en: '(Coach Park\'s voice through the door: "Ha-eun, again. What\'s wrong with you today?" She comes out, jaw tight, and nearly walks into you.)',
            },
          },
          {
            when: { mood: ['high'] },
            value: { ko: '1위 하은', en: '(The new ranking sheet is up. 1st: Ha-eun. She\'s very carefully not looking at it.)' },
          },
          { value: { ko: '…', en: '(She\'s sitting against the corridor wall, retying her shoes.)' } },
        ],
        next: 'meet',
      },
      {
        id: 'meet',
        speaker: 'haeun',
        lines: [
          { when: { mood: ['raw'], stageAtLeast: 'close' }, value: { ko: '…지금 말 시키지 마.', en: '…Don\'t talk to me right now.' } },
          { when: { mood: ['raw'] }, value: { ko: '…비켜요.', en: '…Move.' } },
          { when: { mood: ['high'] }, value: { ko: '뭘 봐요. 1등 처음 봐요?', en: 'What are you looking at. Never seen first place before?' } },
          {
            when: { leak: true, stageBelow: 'friends' },
            value: { ko: '아, 너 왔어? …왔어요. 아 몰라.', en: 'Oh, you\'re here? …You\'re here. Whatever.', note: '반말 slipped out; she caught it and gave up.' },
          },
          { value: { ko: '…수업 끝났어요?', en: '…Lesson over?' } },
        ],
        tong: { ko: '반말 / 존댓말', en: 'Listen to the ending: 왔어 vs 왔어요. Casual vs polite.', maxLevel: 2 },
        choices: [
          {
            id: 'water',
            intent: 'help',
            say: { ko: '(들고 있던 물을 건넨다)', en: '(Hand her the water you were carrying.)' },
            outcomes: [
              {
                when: { mood: ['raw'] },
                reaction: { ko: '…', en: '(She takes it without looking at you, and drinks half of it in one go.)' },
                expr: 'tired',
                deltas: { trust: 2, warmth: 1 },
              },
              { reaction: { ko: '…고마워요.', en: '…Thanks.' }, deltas: { warmth: 1 } },
            ],
          },
          {
            id: 'congrats',
            intent: 'comfort',
            gate: { mood: ['high'] },
            say: { ko: '1등 축하해요!', rom: 'ildeung chukahaeyo!', en: 'Congrats on first place!' },
            outcomes: [
              {
                when: { stageBelow: 'friends' },
                reaction: { ko: '…당연하죠.', en: '…Obviously.' },
                expr: 'blush',
                deltas: { warmth: 2, tension: 1 },
              },
              { reaction: { ko: '다음 달에도 1등 할 거야. 너는 2등 해.', en: 'I\'m taking first next month too. You take second.' }, expr: 'smirk', deltas: { warmth: 2 } },
            ],
          },
          {
            id: 'catch_slip',
            intent: 'tease',
            gate: { leak: true, stageBelow: 'friends' },
            say: { ko: '방금 반말했죠?', rom: 'banggeum banmalhaetjyo?', en: 'You just used 반말, didn\'t you?' },
            outcomes: [
              {
                reaction: { ko: '…안 했어요. 했나. 됐어.', en: '…I didn\'t. Did I. Forget it.' },
                expr: 'blush',
                deltas: { warmth: 2, tension: 1 },
                setFlags: ['caught_banmal_slip'],
                memory: { tag: 'caught_her_slip', note: 'Caught her first 반말 slip in the corridor; she didn\'t take it back.' },
              },
            ],
          },
          {
            id: 'walk_on',
            intent: 'leave',
            say: { ko: '(고개만 끄덕이고 지나간다)', en: '(Nod and keep walking.)' },
            outcomes: [
              { when: { mood: ['raw'] }, reaction: { ko: '…', en: '(Behind you, a locker door slams.)' }, deltas: { trust: -1 } },
              { when: { mood: ['high'] }, reaction: { ko: '…', en: '(She glances at the ranking sheet, then at your back.)' }, deltas: { tension: 1 } },
              { reaction: { ko: '…', en: '(She goes back to her shoes.)' } },
            ],
          },
        ],
        end: true,
      },
    ],
  },
  presets: [
    {
      id: 'flagged-raw',
      label: 'Friends, she was just flagged by Coach Park. She wants space; handing her water is the right move.',
      state: { stage: 'friends', axes: { warmth: 50, tension: 30, trust: 40 }, mood: { valence: -2, energy: 0, causes: ['eval_flagged'] } },
      world: { hour: 15 },
      path: ['water'],
    },
    {
      id: 'topped-ranking',
      label: 'Acquaintances, she topped the ranking. Congratulating her gets "…obviously."',
      state: { stage: 'acquaintances', axes: { warmth: 30, tension: 40, trust: 25 }, mood: { valence: 2, energy: 1, causes: ['eval_top'] } },
      world: { hour: 16 },
      path: ['congrats'],
    },
    {
      id: 'banmal-leak',
      label: 'Acquaintances, ordinary day, warmth ahead of stage. Her 반말 slips and you can catch it.',
      state: { stage: 'acquaintances', axes: { warmth: 45, tension: 25, trust: 30 }, mood: { valence: 0, energy: 0, causes: [] } },
      world: { hour: 13 },
      path: ['catch_slip'],
    },
  ],
};
