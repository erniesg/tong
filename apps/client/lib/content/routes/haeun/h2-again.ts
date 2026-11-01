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
      '21:40, a few nights after you start (gated on H1, not a date). She drills you on eight counts in native numbers and says nothing but "다시." Keep going, call her mean (clean Korean earns respect), comfort her (backfires if she\'s raw), or leave early (looks like a loss; pays off much later).',
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
        lines: [{ value: { ko: '아, 카운트가 헷갈리세요? 하나, 둘, 셋, 넷.', en: 'Oh, are the counts confusing you? One, two, three, four.', note: 'Extra-polite -세요. Helpful on the surface.', review: 'native' } }],
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
        lines: [{ value: { ko: '잘하시네요. 한 번 더 해 볼까요? 이번엔 박자 맞춰서.', en: 'You\'re good at this. Shall we go again? On the beat this time.', note: 'You counted one to eight in native numbers, clean.', review: 'native' } }],
        effects: { deltas: { trust: 2 } },
        next: 'h2_count_sino',
      },
      {
        id: 'h2_count_sino',
        speaker: 'haeun',
        expr: 'smirk',
        when: { notFlags: ['ex_h2_count'], minTier: 1 },
        lines: [
          { when: { mood: ['raw'] }, value: { ko: '…그건 돈 셀 때 쓰는 거예요.', en: '…That\'s for counting money.', note: 'You counted 일, 이, 삼, 사. No smile tonight; she\'s too tired to perform it.', review: 'native' } },
          { value: { ko: '아~ 그건 돈 셀 때 쓰는 거예요.', en: 'Oh~ that\'s for counting money.', note: 'You counted 일, 이, 삼, 사. Her smile is perfect, and for once there might be something real under it.', review: 'native' } },
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
          { when: { flags: ['tong_seen_once'] }, value: { ko: '누구랑 세는 거예요? 신기하다~', en: 'Who are you counting with? How neat~', note: 'Tong counted in your ear and you mouthed along.', review: 'native' } },
          { value: { ko: '…', en: 'Tong counts in your ear. You mouth along. She watches your lips, not your feet.' } },
        ],
        effects: { setFlags: ['tong_seen_once'] },
        next: 'h2_slip',
      },
      {
        // The first crack in the wall: only when warmth runs ahead of stage.
        id: 'h2_slip',
        speaker: 'haeun',
        expr: 'cool',
        when: { leak: true },
        lines: [
          {
            value: {
              ko: '다시 해. …아, 다시 해 볼까요?',
              en: 'Do it again. …Oh, shall we go again?',
              note: 'It slips out flat, then the smile comes back a beat late.',
              review: 'native',
            },
          },
        ],
        next: 'h2_slip_tong',
      },
      {
        // Tong only states the observation; later scenes help the player connect the dots.
        id: 'h2_slip_tong',
        speaker: 'tong',
        when: { leak: true, notFlags: ['haeun_first_banmal'] },
        lines: [{ value: { ko: '방금 반말이었어.', en: 'That\'s the first time she\'s used 반말 with you.' } }],
        effects: { setFlags: ['haeun_first_banmal'] },
        next: 'h2_drill',
      },
      {
        id: 'h2_drill',
        speaker: 'haeun',
        expr: 'cool',
        lines: [
          { when: { mood: ['raw'] }, value: { ko: '한 번 더요. …한 번 더.', en: 'Once more. …Once more.', note: 'The smile is gone tonight. It isn\'t really about you.' } },
          { value: { ko: '한 번 더 해요~', en: 'Once more~', note: 'Twelve times, the same smile. That\'s the wall.' } },
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
                reaction: { ko: '제가요? 도와드리는 건데요. 데뷔하고 싶으시다면서요.', en: 'Me? I\'m helping you. You said you wanted to debut.', note: 'Still polite. Somehow you\'re the one who sounds rude.', review: 'native' },
                deltas: { tension: 6, warmth: 3 },
              },
              {
                speaker: 'haeun',
                expr: 'cool',
                reaction: { ko: '제가요? 도와드리는 건데요~', en: 'Me? I\'m helping you~', note: 'Somehow you\'re the one who sounds rude.' },
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
                reaction: { ko: '…아, 네. 죄송해요, 제가 뭘 잘못했나 봐요.', en: '…Oh, okay. Sorry, I must have done something wrong.', note: 'A polite apology, aimed like a slap. She keeps 존댓말.', review: 'native' },
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
                reaction: { ko: '…괜찮아요. 신경 써 주셔서 감사해요.', en: '…I\'m fine. Thank you for your concern.', note: 'The wall, back up in one second flat.', review: 'native' },
                deltas: { tension: 5, warmth: 1 },
                memory: { tag: 'comforted_early', note: 'Comforted her on the night she\'d been flagged weak.' },
              },
              {
                speaker: 'haeun',
                expr: 'cool',
                reaction: { ko: '저요? 전 괜찮아요~', en: 'Me? I\'m fine~', review: 'native' },
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
                reaction: { ko: '네~ 들어가세요.', en: 'Sure~ Get home safe.', note: 'In the mirror she watches the door until it shuts.' },
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
          { value: { ko: '수고하셨어요. 내일 또 해요~', en: 'Good work. Again tomorrow~' } },
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
