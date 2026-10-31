import type { SceneModule } from '../../../../relationship/types';

/**
 * A3 · 물 마시는 시간 — evening practice. Rival correction in the mirror, a bad
 * night alone with headphones, or (close) her second water handed over without
 * a look. The specific question only exists if your Korean can build it.
 */
export const module: SceneModule = {
  scene: {
    id: 'haeun.a3.water_break',
    kind: 'ambient',
    title: { ko: '물 마시는 시간', en: 'Water break' },
    characterId: 'haeun',
    location: 'practice_studio',
    gate: { hours: { from: 17, to: 23 }, stageAtLeast: 'acquaintances' },
    summary:
      'Evening in the studio. Rival: she fixes your arm angle. Bad night: she practises alone, and staying silently is the bid. Close: she hands you her second water. A tier-2 question about why she stopped mid-routine only appears if you can build it.',
    beats: [
      {
        id: 'scene',
        speaker: 'narrator',
        lines: [
          {
            when: { mood: ['raw', 'low'] },
            value: { ko: '…', en: '(Everyone\'s gone. She\'s alone with headphones in, running the same eight counts. Again. Again. She stops halfway and starts over.)' },
          },
          {
            when: { stageAtLeast: 'close' },
            value: { ko: '…', en: '(Water break. She drops down next to you against the mirror.)' },
          },
          { value: { ko: '…', en: '(Water break. In the mirror your arms are a beat behind hers. She notices.)' } },
        ],
        next: 'her',
      },
      {
        id: 'her',
        speaker: 'haeun',
        lines: [
          { when: { mood: ['raw', 'low'] }, value: { ko: '…', en: '(She sees you in the mirror. Doesn\'t stop.)' } },
          {
            when: { stageAtLeast: 'close' },
            value: { ko: '마셔. 두 개 샀어.', en: 'Drink. I bought two.', note: 'Holds out the second bottle without looking. Never says it was for you.' },
          },
          {
            value: { ko: '팔. 각도 틀렸어요. …여기.', en: 'Arm. Wrong angle. …Here.', note: 'She taps your elbow up two centimetres in the mirror.' },
          },
        ],
        choices: [
          {
            id: 'sit',
            intent: 'presence',
            say: { ko: '(벽에 기대 앉아서 기다린다)', en: '(Sit against the wall and wait.)' },
            outcomes: [
              {
                when: { mood: ['raw', 'low'], stageBelow: 'close' },
                reaction: { ko: '…안 가요?', en: '…You\'re not leaving?', note: 'Twenty minutes later. She sits down a metre away.' },
                expr: 'tired',
                deltas: { trust: 4, warmth: 1 },
                memory: { tag: 'stayed_on_bad_night', note: 'Stayed silently while she practised alone on a bad night.' },
              },
              {
                when: { mood: ['raw', 'low'] },
                reaction: { ko: '…아직 있었어?', en: '…You\'re still here?', note: 'She sits down right next to you.' },
                expr: 'tired',
                deltas: { trust: 4, warmth: 2 },
                memory: { tag: 'stayed_on_bad_night', note: 'Stayed silently while she practised alone on a bad night.' },
              },
              { reaction: { ko: '뭐 해요, 연습 안 해요?', en: 'What are you doing, not practising?' }, expr: 'cool', deltas: { tension: 1 } },
            ],
          },
          {
            id: 'again',
            intent: 'challenge',
            say: { ko: '다시 해 볼게요.', rom: 'dasi hae bolgeyo', en: 'I\'ll try it again.' },
            outcomes: [
              {
                when: { mood: ['raw', 'low'] },
                reaction: { ko: '…', en: '(She takes one earbud out and nods at the spot next to her. You run it side by side.)' },
                deltas: { warmth: 2, trust: 1 },
              },
              {
                when: { stageBelow: 'friends' },
                reaction: { ko: '다시. 하나, 둘, 셋, 넷.', en: 'Again. One, two, three, four.' },
                expr: 'smirk',
                deltas: { tension: 2, warmth: 1 },
                vocab: [{ ko: '하나, 둘, 셋, 넷', rom: 'hana, dul, set, net', en: 'one, two, three, four (native Korean counting)' }],
              },
              { reaction: { ko: '좋아. 이번엔 안 봐준다.', en: 'Good. Not going easy on you this time.' }, expr: 'smirk', deltas: { tension: 1, warmth: 2 } },
            ],
          },
          {
            id: 'thanks',
            intent: 'comfort',
            gate: { stageAtLeast: 'close', mood: ['ok', 'high'] },
            say: { ko: '고마워.', rom: 'gomawo', en: 'Thanks.' },
            outcomes: [{ reaction: { ko: '뭐가. 그냥 두 개 산 거야.', en: 'For what. I just bought two.' }, expr: 'blush', deltas: { warmth: 2 } }],
          },
          {
            id: 'specific',
            intent: 'ask',
            minTier: 2,
            say: { ko: '아까 왜 그 부분에서 멈췄어?', rom: 'akka wae geu bubuneseo meomchwosseo?', en: 'Why did you stop at that part earlier?' },
            exercise: {
              type: 'sentence_builder',
              objectiveId: 'ko-gram-past-tense',
              targets: ['아까', '왜', '그 부분에서', '멈췄어?'],
              distractors: ['멈춰요', '어디'],
              framing: { ko: '물어봐.', en: 'Ask why she stopped at that part earlier (past tense + 왜).' },
              onFail: 'assist',
            },
            outcomes: [
              {
                // Exercise failed (flag ex_her_specific false): the question comes out garbled.
                when: { notFlags: ['ex_her_specific'] },
                reaction: { ko: '…뭐라고? 됐어. 물이나 마셔.', en: '…What? Forget it. Just drink your water.' },
                expr: 'cool',
                deltas: { warmth: 1 },
              },
              {
                when: { mood: ['raw', 'low'] },
                reaction: { ko: '…발목. 아무한테도 말하지 마.', en: '…My ankle. Don\'t tell anyone.' },
                expr: 'sad',
                deltas: { trust: 4 },
                setFlags: ['knows_ankle'],
                memory: { tag: 'noticed_ankle', note: 'Noticed where she stopped; she told you about her ankle and asked you not to tell.' },
              },
              {
                when: { stageAtLeast: 'close' },
                reaction: { ko: '…그걸 봤어? 역시 너밖에 없다.', en: '…You saw that? Of course it\'s only you who would.', review: 'native' },
                expr: 'blush',
                deltas: { trust: 3, warmth: 1 },
              },
              { reaction: { ko: '…봤어요? 됐어요. 다시 해요.', en: '…You saw? Forget it. Again.' }, expr: 'cool', deltas: { tension: 2, warmth: 1 } },
            ],
          },
          {
            id: 'leave',
            intent: 'leave',
            say: { ko: '먼저 갈게요.', rom: 'meonjeo galgeyo', en: 'I\'ll head out first.' },
            outcomes: [
              { when: { mood: ['raw', 'low'] }, reaction: { ko: '…', en: '(She doesn\'t look up.)' }, deltas: { warmth: -2, trust: -1 } },
              { reaction: { ko: '…가요.', en: '…Go.' } },
            ],
          },
        ],
        end: true,
      },
    ],
  },
  presets: [
    {
      id: 'rival-correction',
      label: 'Acquaintances, ordinary evening. She corrects your arm; you go again on her count.',
      state: { stage: 'acquaintances', axes: { warmth: 25, tension: 40, trust: 20 }, mood: { valence: 0, energy: 0, causes: [] } },
      world: { hour: 19, inputTier: 1 },
      path: ['again'],
    },
    {
      id: 'bad-night-alone',
      label: 'Friends, bad night, she practises alone. Sitting silently is the bid.',
      state: { stage: 'friends', axes: { warmth: 50, tension: 30, trust: 42 }, mood: { valence: -1, energy: -2, causes: ['no_sleep', 'eval_flagged'] } },
      world: { hour: 22, inputTier: 1 },
      path: ['sit'],
    },
    {
      id: 'close-second-water',
      label: 'Close, ordinary night, tier 2 unlocked. She hands over her second water; you can ask the specific question.',
      state: { stage: 'close', flags: { rooftop_done: true }, axes: { warmth: 66, tension: 35, trust: 60 }, mood: { valence: 1, energy: 0, causes: [] } },
      world: { hour: 20, inputTier: 2 },
      path: ['specific'],
    },
  ],
};
