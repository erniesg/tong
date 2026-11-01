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
      'Coach Park: "하은이 옆에 서." You find her by reading the water-bottle tags. Minji whispers that you took Sua\'s spot. Haeun, impeccably polite with a perfect smile: "안녕하세요, 하은이에요. 저랑 짝이래요. 잘 부탁해요." Textbook, and she never asks your name. How you answer sets the first temperature: in stride, a register slip, asking about Sua straight out, or asking her to teach you.',
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
            value: { ko: '아, 하은이에요. 저랑 짝이래요. 잘 부탁해요.', en: 'Oh, I\'m Ha-eun. Apparently we\'re partners. Nice to work with you.', note: 'A perfect smile. She says it to the space just beside your face.', review: 'native' },
          },
          { value: { ko: '안녕하세요, 하은이에요. 저랑 짝이래요. 잘 부탁해요.', en: 'Hi, I\'m Ha-eun. Apparently we\'re partners. Nice to work with you.', note: 'A perfect smile. Textbook.', review: 'native' } },
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
                reaction: { ko: '아, 또 앱이에요? 편하겠다~', en: 'Oh, the app again? That must be handy~', note: 'Still smiling.', review: 'native' },
                deltas: { tension: 3 },
                memory: { tag: 'tong_noticed', note: 'She noticed you speaking through Tong on day one.' },
              },
              {
                when: { flags: ['used_tong_last'] },
                speaker: 'haeun',
                expr: 'cool',
                reaction: { ko: '네~', en: 'Sure~', note: 'Her eyes go to your phone, not to you.' },
                setFlags: ['tong_seen_once'],
              },
              {
                speaker: 'haeun',
                expr: 'cool',
                reaction: { ko: '네~ 잘 부탁해요.', en: 'Sure~ Nice to work with you.', note: 'Then she turns back to the mirror.' },
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
                reaction: { ko: '아… 네. 잘 부탁해요.', en: 'Oh… sure. Nice to work with you.', note: 'She answers in 존댓말 anyway. The smile doesn\'t move at all.', review: 'native' },
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
                reaction: { ko: '아, 그냥 예전에 있던 친구예요. …음악 시작한대요.', en: 'Oh, just a friend who used to be here. …Music\'s starting.', note: 'Smooth. The subject is closed before you notice she closed it.', review: 'native' },
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
                reaction: { ko: '와, 이름도 읽으시네요. 그럼요, 다음에 시간 될 때요~', en: 'Wow, you can read names. Of course, sometime when we\'re free~', note: '"다음에". Next time never has a date.', review: 'native' },
                deltas: { warmth: 4 },
              },
              {
                speaker: 'haeun',
                expr: 'smirk',
                reaction: { ko: '아~ 그럼요. 다음에 밥 한번 먹어요.', en: 'Oh~ of course. Let\'s grab a meal sometime.', note: 'Everyone says that. Nobody means it.', review: 'native' },
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
          { when: { memories: ['asked_straight'] }, value: { ko: '수고하셨어요~ 내일 봐요.', en: 'Good work today~ See you tomorrow.', note: 'Same smile. She doesn\'t look at you.' } },
          { when: { memories: ['filed_as_weak'] }, value: { ko: '수고하셨어요. 내일은 아홉 시부터래요~', en: 'Good work. Tomorrow starts at nine, apparently~', note: 'Helpful. Pointed.', review: 'native' } },
          { value: { ko: '수고하셨어요~ 내일 봐요.', en: 'Good work today~ See you tomorrow.' } },
        ],
        effects: { stageTo: 'acquaintances', setFlags: ['h1_done'], vocab: [{ ko: '짝', en: 'partner, pair', rom: 'jjak' }] },
        // Tong states the observation only; the contrast scene, 눈치, and her first 반말 do the rest.
        tong: { ko: '처음부터 끝까지 존댓말.', en: 'She kept it all 존댓말.', maxLevel: 4 },
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
