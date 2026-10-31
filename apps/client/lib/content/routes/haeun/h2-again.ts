import type { SceneModule } from '../../../relationship/types';

/**
 * H2 · 다시. (Again.) Late drills before the placement eval. Counting in native
 * numbers; her first 반말 slip if warmth has run ahead of stage.
 */
export const module: SceneModule = {
  scene: {
    id: 'haeun.h2',
    kind: 'story',
    title: { ko: '다시.', en: 'Again.' },
    characterId: 'haeun',
    location: 'practice_studio',
    slot: 'm1.s2',
    gate: { flags: ['h1_done'], month: { from: 1, to: 1 } },
    summary:
      '21:40, three days before the placement eval. She drills you on eight counts in native numbers and says nothing but "다시." Keep going, call her mean (clean Korean earns respect), comfort her (backfires if she\'s raw), or leave early (looks like a loss; pays off much later).',
    seeds: ['memory left_early (re-read when cried_in_studio is revealed, close+)', 'memory comforted_early (re-read as pity in a later fight)', 'first 반말 slip'],
    beats: [
      {
        id: 'h2_open',
        speaker: 'narration',
        lines: [
          {
            when: { mood: ['raw', 'low'] },
            value: {
              ko: '오후 9시 40분.',
              en: '21:40. Everyone else has gone. On the ranking sheet by the door, Coach Park has circled one line in red: 하은 — 보컬 약함 (vocals: weak).',
            },
          },
          { value: { ko: '오후 9시 40분.', en: '21:40. Everyone else has gone. She\'s running the bridge alone, perfectly, again.' } },
        ],
        next: 'h2_count',
      },
      {
        id: 'h2_count',
        speaker: 'haeun',
        expr: 'cool',
        lines: [{ value: { ko: '카운트 몰라요? 하나, 둘, 셋, 넷.', en: 'You don\'t know the counts? One, two, three, four.', review: 'native' } }],
        tong: {
          ko: '춤 카운트는 하나, 둘, 셋…',
          en: 'Dance counts use native Korean numbers: 하나 둘 셋 넷 다섯 여섯 일곱 여덟. Not 일 이 삼 사, those are for money and dates.',
          maxLevel: 2,
        },
        exercise: {
          type: 'pronunciation_select',
          objectiveId: 'ko-vocab-numbers',
          targets: ['하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟'],
          distractors: ['일', '이', '삼', '사'],
          framing: { ko: '카운트 따라 해 봐요.', en: 'Count the eight with her.' },
          onFail: 'retry',
        },
        next: 'h2_count_pass',
      },
      {
        id: 'h2_count_pass',
        speaker: 'haeun',
        expr: 'cool',
        when: { flags: ['ex_h2_count'] },
        lines: [{ value: { ko: '…다시. 이번엔 박자 맞춰서.', en: '…Again. On the beat this time.', note: 'You counted one to eight in native numbers, clean.', review: 'native' } }],
        effects: { deltas: { trust: 2 } },
        next: 'h2_count_sino',
      },
      {
        id: 'h2_count_sino',
        speaker: 'haeun',
        expr: 'smirk',
        when: { notFlags: ['ex_h2_count'], minTier: 1 },
        lines: [
          { when: { mood: ['raw'] }, value: { ko: '…그건 돈 셀 때요.', en: '…That\'s for counting money.', note: 'You counted 일, 이, 삼, 사. No smile; she\'s too tired to find it funny.', review: 'native' } },
          { value: { ko: '그건 돈 셀 때요.', en: 'That\'s for counting money.', note: 'You counted 일, 이, 삼, 사. The corner of her mouth moves. Almost.', review: 'native' } },
        ],
        effects: { setFlags: ['h2_counted_sino'], memory: { tag: 'counted_money', note: 'Counted the choreo in Sino numbers; she said that\'s for money.' } },
        next: 'h2_count_tong',
      },
      {
        id: 'h2_count_tong',
        speaker: 'haeun',
        expr: 'smirk',
        when: { notFlags: ['ex_h2_count', 'h2_counted_sino'] },
        lines: [
          { when: { flags: ['tong_seen_once'] }, value: { ko: '폰이 춤춰요?', en: 'Is your phone doing the dance?', note: 'Tong counted out loud for you.', review: 'native' } },
          { value: { ko: '…', en: 'Tong counts out loud for you. She lets the phone count. She doesn\'t count with it.' } },
        ],
        effects: { setFlags: ['tong_seen_once'] },
        next: 'h2_drill',
      },
      {
        id: 'h2_drill',
        speaker: 'haeun',
        expr: 'cool',
        lines: [
          {
            when: { leak: true },
            value: {
              ko: '다시 해. …하세요. 아 몰라, 다시.',
              en: 'Do it again. …Please do it again. Ugh, whatever. Again.',
              note: 'Her first 반말 slip. She hears it, corrects it, gives up correcting it.',
              review: 'native',
            },
          },
          { when: { mood: ['raw'] }, value: { ko: '다시. …다시.', en: 'Again. …Again.', note: 'Sharper every time. It isn\'t really about you.' } },
          { value: { ko: '다시.', en: 'Again.' } },
        ],
        choices: [
          {
            id: 'h2_keep',
            intent: 'commit',
            say: { ko: '…네. 다시요.', en: '…Okay. Again.', rom: 'ne. dasiyo' },
            outcomes: [
              {
                when: { mood: ['raw', 'low'] },
                speaker: 'narration',
                reaction: { ko: '…', en: 'On the fourth run she counts slower, for you, without saying so.' },
                deltas: { trust: 7, warmth: 2 },
                memory: { tag: 'she_slowed_count', note: 'On her bad night she slowed the count down for you.' },
              },
              {
                speaker: 'narration',
                reaction: { ko: '…', en: 'Eleven more times. She doesn\'t say good. She doesn\'t say stop.' },
                deltas: { trust: 5 },
              },
            ],
          },
          {
            id: 'h2_mean',
            intent: 'challenge',
            minTier: 1,
            say: { ko: '왜 이렇게 못되게 굴어요?', en: 'Why are you being so mean?', rom: 'wae ireoke motdoege gureoyo' },
            outcomes: [
              {
                when: { flags: ['ex_h2_count'] },
                speaker: 'haeun',
                expr: 'smirk',
                reaction: { ko: '못되게? 데뷔하고 싶다면서요.', en: 'Mean? You said you wanted to debut.', review: 'native' },
                deltas: { tension: 6, warmth: 3 },
              },
              {
                speaker: 'haeun',
                expr: 'cool',
                reaction: { ko: '카운트부터 해요.', en: 'Learn the counts first.' },
                deltas: { tension: 6 },
              },
            ],
          },
          {
            id: 'h2_mean_banmal',
            intent: 'challenge',
            minTier: 2,
            say: { ko: '왜 이렇게 못되게 굴어?', en: 'Why are you being so mean? (casual)', rom: 'wae ireoke motdoege gureo' },
            exercise: {
              type: 'sentence_builder',
              objectiveId: 'ko-rel-register-banmal',
              targets: ['왜', '이렇게', '못되게', '굴어?'],
              distractors: ['굴어요?', '먹어?'],
              framing: { ko: '반말로 말해 봐요.', en: 'Say it back to her in 반말.' },
              onFail: 'continue',
            },
            outcomes: [
              {
                when: { notFlags: ['ex_h2_drill_h2_mean_banmal'] },
                speaker: 'haeun',
                expr: 'cool',
                reaction: { ko: '…뭐라고요?', en: '…What did you just say?', note: 'The sentence came out in the wrong order. The moment\'s gone.', review: 'native' },
                deltas: { tension: 2 },
              },
              {
                when: { leak: true },
                speaker: 'haeun',
                expr: 'surprised',
                reaction: { ko: '…너도 반말하네.', en: '…So you\'re on 반말 too.', note: 'She almost laughs. Almost.', review: 'native' },
                deltas: { warmth: 5, tension: 3 },
                memory: { tag: 'matched_banmal', note: 'When she slipped into 반말, you answered in 반말.' },
              },
              {
                speaker: 'haeun',
                expr: 'cool',
                reaction: { ko: '반말?', en: 'Casual speech? With me?', review: 'native' },
                deltas: { tension: 8 },
                memory: { tag: 'banmal_too_early', note: 'Used 반말 with her before she ever did.' },
              },
            ],
          },
          {
            id: 'h2_comfort',
            intent: 'comfort',
            say: { ko: '괜찮아요? 힘들어 보여요.', en: 'Are you okay? You look exhausted.', rom: 'gwaenchanayo? himdeureo boyeoyo' },
            outcomes: [
              {
                when: { mood: ['raw', 'low'] },
                speaker: 'haeun',
                expr: 'angry',
                reaction: { ko: '동정하지 마요.', en: 'Don\'t pity me.', review: 'native' },
                deltas: { tension: 5, warmth: 1 },
                memory: { tag: 'comforted_early', note: 'Comforted her on the night she\'d been flagged weak.' },
              },
              {
                speaker: 'haeun',
                expr: 'cool',
                reaction: { ko: '…안 힘든데요.', en: '…I\'m not.', review: 'native' },
                deltas: { tension: 2 },
              },
            ],
          },
          {
            id: 'h2_quit',
            intent: 'leave',
            say: { ko: '오늘은 여기까지 할게요.', en: 'I\'ll stop here for today.', rom: 'oneureun yeogikkaji halgeyo' },
            outcomes: [
              {
                speaker: 'haeun',
                expr: 'cool',
                reaction: { ko: '…가요.', en: '…Go, then.', note: 'In the mirror she watches the door until it shuts.' },
                deltas: { warmth: -2 },
                setFlags: ['h2_left_early'],
                memory: { tag: 'left_early', note: 'Left her alone in the studio three nights before the placement eval.' },
              },
            ],
          },
        ],
        next: 'h2_end',
      },
      {
        id: 'h2_end',
        speaker: 'haeun',
        expr: 'cool',
        lines: [
          {
            when: { flags: ['h2_left_early'] },
            value: { ko: '…', en: 'Behind the door the music starts again. Then it stops, mid-bar, and doesn\'t start again.' },
          },
          { when: { flags: ['ex_h2_count'], min: { trust: 20 } }, value: { ko: '…나쁘지 않네요.', en: '…Not bad.', note: 'Rare. Remember it.', review: 'native' } },
          { value: { ko: '내일 또 해요.', en: 'Again tomorrow.' } },
        ],
        effects: { setFlags: ['h2_done'], vocab: [{ ko: '다시', en: 'again', rom: 'dasi' }] },
        end: true,
      },
    ],
  },
  presets: [
    {
      id: 'h2_tier0_fine',
      label: 'Tier 0, she\'s fine: Tong counts, you keep going',
      state: { day: 4, stage: 'acquaintances', flags: { h1_done: true }, axes: { warmth: 14, tension: 12, trust: 12 } },
      world: { playerLevel: 0, inputTier: 0, hour: 21, weather: 'clear' },
      path: ['h2_keep'],
      exercises: false,
    },
    {
      id: 'h2_tier1_raw',
      label: 'Tier 1, she was flagged weak (raw): clean count, then you comfort her (backfires)',
      state: { day: 4, stage: 'acquaintances', flags: { h1_done: true }, axes: { warmth: 18, tension: 15, trust: 14 }, mood: { valence: -2, energy: -1 } },
      world: { playerLevel: 1, inputTier: 1, hour: 21, weather: 'rain' },
      path: ['h2_comfort'],
    },
    {
      id: 'h2_tier2_leak',
      label: 'Tier 2, warmth ahead of stage (leak): her first 반말 slip, you answer in 반말',
      state: { day: 4, stage: 'acquaintances', flags: { h1_done: true }, axes: { warmth: 42, tension: 20, trust: 22 }, mood: { valence: -1 } },
      world: { playerLevel: 3, inputTier: 2, hour: 21, weather: 'clear' },
      path: ['h2_mean_banmal'],
    },
    {
      id: 'h2_tier1_quit',
      label: 'Tier 1: you leave early (looks like a loss)',
      state: { day: 4, stage: 'acquaintances', flags: { h1_done: true }, axes: { warmth: 16, tension: 12, trust: 12 }, mood: { valence: -2 } },
      world: { playerLevel: 1, inputTier: 1, hour: 21, weather: 'clear' },
      path: ['h2_quit'],
      exercises: { h2_count: false },
    },
  ],
};
