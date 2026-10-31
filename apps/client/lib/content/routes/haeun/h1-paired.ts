import type { SceneModule } from '../../../relationship/types';

/**
 * H1 · 짝 (Paired). No name test staged by her: the coach tells you to stand
 * next to 하은 and you have to find her from the water-bottle tags yourself.
 */
export const module: SceneModule = {
  scene: {
    id: 'haeun.h1',
    kind: 'story',
    title: { ko: '짝', en: 'Paired' },
    characterId: 'haeun',
    location: 'practice_studio',
    slot: 'm1.s1',
    gate: { flags: ['h0_done'], month: { from: 1, to: 1 } },
    summary:
      'Coach Park: "하은이 옆에 서." You find her by reading the water-bottle tags. Minji whispers that you took Sua\'s spot. Haeun, flat: "하은. 저랑 짝이래요." How you answer sets the first temperature: in stride, a register slip, asking about Sua straight out, or asking her to teach you.',
    seeds: ['memory asked_straight (re-read at the rooftop)', 'tong_seen_once (her "또 그거 써요?")', 'banmal_too_early'],
    beats: [
      {
        id: 'h1_open',
        speaker: 'narration',
        lines: [
          {
            value: {
              ko: '연습실. 오전 10시.',
              en: 'The studio, 10am. A mirror wall. A ranking sheet taped by the door. A row of water bottles on the floor, each with a name on masking tape.',
            },
          },
        ],
        next: 'h1_whisper',
      },
      {
        id: 'h1_whisper',
        speaker: 'minji',
        expr: 'smirk',
        lines: [{ value: { ko: '쟤가 수아 자리 들어온 애래.', en: 'That\'s the one who took Sua\'s spot.', review: 'native' } }],
        tong: { ko: '너 얘기야. 자리 = 자리, spot.', en: 'They\'re talking about you. 자리 (jari) = seat, spot.', maxLevel: 2 },
        effects: { learn: ['sua_name'], setFlags: ['heard_whisper'] },
        next: 'h1_whisper_echo',
      },
      {
        id: 'h1_whisper_echo',
        speaker: 'narration',
        lines: [
          { when: { flags: ['read_locker_label'] }, value: { ko: '수아.', en: 'Su-a. The name you read on your locker yesterday.' } },
          { when: { knows: ['sua_name'], memories: ['found_notebook'] }, value: { ko: '수아.', en: 'Su-a. The locker. Maybe the notebook in your bag.' } },
          { value: { ko: '수아.', en: 'Su-a. Whoever that is, you\'re standing where she used to.' } },
        ],
        next: 'h1_coach',
      },
      {
        id: 'h1_coach',
        speaker: 'coach_park',
        expr: 'neutral',
        lines: [{ value: { ko: '하은이 옆에 서.', en: 'Stand next to Ha-eun.' } }],
        tong: { ko: '하은이 누구지? 물병 봐!', en: 'Which one is 하은? Check the names on the water bottles.', maxLevel: 1 },
        exercise: {
          type: 'multiple_choice',
          objectiveId: 'ko-rel-read-names',
          targets: ['하은'],
          distractors: ['하늘', '은하', '민지'],
          framing: { ko: '하은 물병은 어느 거예요?', en: 'Which bottle says 하은?' },
          onFail: 'assist',
        },
        next: 'h1_tags_pass',
      },
      {
        id: 'h1_tags_pass',
        speaker: 'narration',
        when: { flags: ['ex_h1_coach'] },
        lines: [{ value: { ko: '…', en: 'You stand by the bottle that says 하은. The girl from the corridor. She glances at the bottle, then at you. You found her yourself; she noticed.' } }],
        effects: { setFlags: ['read_haeun'], deltas: { warmth: 2 } },
        next: 'h1_tags_misread',
      },
      {
        id: 'h1_tags_misread',
        speaker: 'yerin',
        expr: 'laugh',
        when: { notFlags: ['ex_h1_coach'], minTier: 1 },
        lines: [{ value: { ko: '저 하늘인데요?', en: 'Um, I\'m Ha-neul?', note: 'You stood by the wrong bottle. Coach Park points. The girl from the corridor doesn\'t laugh.', review: 'native' } }],
        effects: { setFlags: ['misread_name'], deltas: { tension: 3 } },
        next: 'h1_tags_tong',
      },
      {
        id: 'h1_tags_tong',
        speaker: 'tong',
        when: { notFlags: ['ex_h1_coach', 'misread_name'] },
        lines: [{ value: { ko: '저 물병! 하은.', en: '"하은", the one on the left.', note: 'You held up your phone to read the tags. Ha-eun watches your phone talk. She says nothing.' } }],
        effects: { setFlags: ['tong_seen_once'] },
        next: 'h1_meet',
      },
      {
        id: 'h1_meet',
        speaker: 'haeun',
        expr: 'cool',
        lines: [
          {
            when: { flags: ['misread_name'] },
            value: { ko: '하은. …저예요. 저랑 짝이래요.', en: 'Ha-eun. …That\'s me. Apparently I\'m paired with you.', review: 'native' },
          },
          { value: { ko: '하은. 저랑 짝이래요.', en: 'Ha-eun. Apparently I\'m paired with you.', review: 'native' } },
        ],
        tong: { ko: '짝 = 파트너!', en: '짝 (jjak) = partner, pair. -래요 = "apparently / they say."', maxLevel: 2 },
        choices: [
          {
            id: 'h1_stride',
            intent: 'commit',
            say: { ko: '잘 부탁해요.', en: 'Nice to work with you.', rom: 'jal butakaeyo' },
            outcomes: [
              {
                when: { flags: ['used_tong_last', 'tong_seen_once'] },
                speaker: 'haeun',
                expr: 'smirk',
                reaction: { ko: '…또 그거 써요?', en: '…Using that thing again?', review: 'native' },
                deltas: { tension: 3 },
                memory: { tag: 'tong_noticed', note: 'She noticed you speaking through Tong on day one.' },
              },
              {
                when: { flags: ['used_tong_last'] },
                speaker: 'haeun',
                expr: 'cool',
                reaction: { ko: '…네.', en: '…Sure.', note: 'Her eyes go to your phone, not to you.' },
                setFlags: ['tong_seen_once'],
              },
              {
                speaker: 'haeun',
                expr: 'cool',
                reaction: { ko: '…네.', en: '…Sure.' },
                deltas: { trust: 2 },
              },
            ],
          },
          {
            id: 'h1_banmal',
            intent: 'commit',
            minTier: 1,
            say: { ko: '그래, 잘 부탁해.', en: 'Cool, nice to work with you. (casual)', rom: 'geurae, jal butakae', note: '반말 to someone you just met.' },
            outcomes: [
              {
                speaker: 'haeun',
                expr: 'smirk',
                reaction: { ko: '…언제부터 반말이에요?', en: '…Since when are we on casual speech?', review: 'native' },
                deltas: { tension: 5 },
                memory: { tag: 'banmal_too_early', note: 'Used 반말 with her the moment you met.' },
                vocab: [{ ko: '반말', en: 'casual speech', rom: 'banmal' }],
              },
            ],
          },
          {
            id: 'h1_ask_sua',
            intent: 'ask',
            say: { ko: '수아가 누구예요?', en: 'Who\'s Sua?', rom: 'suaga nuguyeyo' },
            outcomes: [
              {
                speaker: 'haeun',
                expr: 'cool',
                reaction: { ko: '…몰라도 돼요.', en: '…You don\'t need to know.', note: 'She turns to the mirror. The room goes quiet for a second.', review: 'native' },
                deltas: { warmth: -5, tension: 3 },
                memory: { tag: 'asked_straight', note: 'Asked her about Sua to her face on day one while everyone else whispered.' },
              },
            ],
          },
          {
            id: 'h1_ask_teach',
            intent: 'ask',
            say: { ko: '한국어… 좀 가르쳐 줄 수 있어요?', en: 'Could you… teach me some Korean?', rom: 'hangugeo… jom gareuchyeo jul su isseoyo' },
            outcomes: [
              {
                when: { flags: ['read_haeun'] },
                speaker: 'haeun',
                expr: 'thinking',
                reaction: { ko: '…이름은 읽네요. 생각해 볼게요.', en: '…You can read names, at least. I\'ll think about it.', review: 'native' },
                deltas: { warmth: 4 },
              },
              {
                speaker: 'haeun',
                expr: 'smirk',
                reaction: { ko: '이름도 못 읽으면서요?', en: 'You can\'t even read my name.', review: 'native' },
                deltas: { tension: 4, warmth: -2 },
                memory: { tag: 'filed_as_weak', note: 'Asked her to teach you before you could read her name.' },
              },
            ],
          },
        ],
        next: 'h1_run',
      },
      {
        id: 'h1_run',
        speaker: 'coach_park',
        lines: [{ value: { ko: '음악 갈게요. 하나, 둘, 셋, 넷!', en: 'Music\'s coming. One, two, three, four!' } }],
        next: 'h1_run_after',
      },
      {
        id: 'h1_run_after',
        speaker: 'narration',
        lines: [
          { when: { mood: ['raw', 'low'] }, value: { ko: '…', en: 'You\'re half a count behind the whole time. She isn\'t, but she isn\'t smiling either. She drills the same eight counts alone while everyone drinks water.' } },
          { value: { ko: '…', en: 'You\'re half a count behind the whole time. She isn\'t. In the mirror, once, she watches your feet.' } },
        ],
        next: 'h1_end',
      },
      {
        id: 'h1_end',
        speaker: 'haeun',
        expr: 'cool',
        lines: [
          { when: { memories: ['asked_straight'] }, value: { ko: '내일 아홉 시.', en: 'Tomorrow, nine.', note: 'She doesn\'t look at you.' } },
          { when: { memories: ['filed_as_weak'] }, value: { ko: '내일 아홉 시. 늦으면 혼자 해요.', en: 'Tomorrow, nine. Late and you practise alone.', review: 'native' } },
          { value: { ko: '내일 아홉 시. 늦지 마요.', en: 'Tomorrow, nine. Don\'t be late.' } },
        ],
        effects: { stageTo: 'acquaintances', setFlags: ['h1_done'], vocab: [{ ko: '짝', en: 'partner, pair', rom: 'jjak' }] },
        end: true,
      },
    ],
  },
  presets: [
    {
      id: 'h1_tier0',
      label: 'Tier 0: Tong reads the tags, then Tong speaks again ("또 그거 써요?")',
      state: { day: 2, flags: { h0_done: true }, knows: { sua_name: true } },
      world: { playerLevel: 0, inputTier: 0, hour: 10, weather: 'clear' },
      path: ['h1_stride'],
      exercises: false,
    },
    {
      id: 'h1_tier1_teach',
      label: 'Tier 1: reads 하은 herself, asks her to teach',
      state: { day: 2, flags: { h0_done: true, read_locker_label: true }, knows: { sua_name: true } },
      world: { playerLevel: 1, inputTier: 1, hour: 10, weather: 'clear' },
      path: ['h1_ask_teach'],
    },
    {
      id: 'h1_tier1_sua',
      label: 'Tier 1, she\'s raw: misreads 하늘, asks about Sua straight out',
      state: { day: 2, flags: { h0_done: true }, knows: { sua_name: true }, mood: { valence: -2 } },
      world: { playerLevel: 1, inputTier: 1, hour: 10, weather: 'rain' },
      path: ['h1_ask_sua'],
      exercises: { h1_coach: false },
    },
    {
      id: 'h1_tier1_banmal',
      label: 'Tier 1: register trap, 반말 on day one',
      state: { day: 2, flags: { h0_done: true }, knows: { sua_name: true } },
      world: { playerLevel: 1, inputTier: 1, hour: 10, weather: 'clear' },
      path: ['h1_banmal'],
    },
  ],
};
