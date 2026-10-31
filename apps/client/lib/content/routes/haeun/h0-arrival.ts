import type { SceneModule } from '../../../relationship/types';

/**
 * H0 · 첫날 (Arrival). Tong onboards you; the locker plants Sua's name and the
 * notebook without anyone explaining either. Haeun is only a glimpse.
 */
export const module: SceneModule = {
  scene: {
    id: 'haeun.h0',
    kind: 'story',
    title: { ko: '첫날', en: 'Day one' },
    characterId: 'haeun',
    location: 'agency_lockers',
    slot: 'm1.s0',
    gate: { month: { from: 1, to: 1 } },
    summary:
      'You arrive at Onsae. Tong introduces itself. Your locker has a half-scraped name label (수아) and a notebook jammed behind the drawer. Keep it, hand it in, or leave it. A girl slams her locker without looking at you. Coach Park: studio, 10am.',
    seeds: ['knows.sua_name (from the label)', 'notebook_kept / notebook_handed_in / notebook_left', 'first glimpse of Haeun'],
    beats: [
      {
        id: 'h0_open',
        speaker: 'narration',
        lines: [
          { when: { weather: ['rain'] }, value: { ko: '홍대, 3월. 비.', en: 'Hongdae, March. Rain on the glass doors of Onsae Entertainment. Your suitcase is soaked.' } },
          { value: { ko: '홍대, 3월.', en: 'Hongdae, March. The glass doors of Onsae Entertainment. Your suitcase wheel is already broken.' } },
        ],
        tong: {
          ko: '안녕! 나는 통이야.',
          en: 'Hi! I\'m Tong. I live in your phone. Tap me any time and I\'ll help, but the more you do yourself, the more people here will notice.',
          maxLevel: 1,
        },
        next: 'h0_tong_blocks',
      },
      {
        id: 'h0_tong_blocks',
        speaker: 'tong',
        when: { minLevel: 0 },
        lines: [
          { when: { minLevel: 2 }, value: { ko: '한글은 이미 좀 읽네? 좋아.', en: 'You already read some Hangul? Good. I\'ll stay quiet unless you need me.' } },
          {
            value: {
              ko: '한글은 블록이야.',
              en: 'Korean is written in blocks. Each block is one syllable: a consonant, a vowel, sometimes one more underneath. You\'ll be reading signs by tonight.',
            },
          },
        ],
        next: 'h0_choi',
      },
      {
        id: 'h0_choi',
        speaker: 'manager_choi',
        expr: 'neutral',
        lines: [
          {
            value: {
              ko: '외국인 연습생이죠? 이쪽이에요. 사물함은 여기 써요.',
              en: 'You\'re the foreign trainee? This way. Use this locker.',
              review: 'native',
            },
          },
        ],
        tong: { ko: '사물함 = 락커!', en: '사물함 (samulham) = locker.', maxLevel: 2 },
        effects: { vocab: [{ ko: '사물함', en: 'locker', rom: 'samulham' }] },
        next: 'h0_label',
      },
      {
        id: 'h0_label',
        speaker: 'narration',
        lines: [
          {
            value: {
              ko: 'ㅅ…아',
              en: 'An old name label on the locker door, half scraped off. Masking tape and marker. Someone peeled it and gave up.',
            },
          },
        ],
        exercise: {
          type: 'block_crush',
          objectiveId: 'ko-script-blocks-2part',
          targets: ['수아'],
          distractors: ['ㅇ', 'ㅗ'],
          framing: { ko: '이름을 맞춰 봐.', en: 'Rebuild the name on the scraped label.' },
          onFail: 'assist',
        },
        next: 'h0_label_pass',
      },
      {
        id: 'h0_label_pass',
        speaker: 'narration',
        when: { flags: ['ex_h0_label'] },
        lines: [{ value: { ko: '수아.', en: 'Su-a. Someone\'s name. Not yours. This was someone\'s locker last week.' } }],
        effects: {
          learn: ['sua_name'],
          setFlags: ['read_locker_label'],
          memory: { tag: 'read_sua_label', note: 'Read "수아" on your locker label yourself on day one.' },
        },
        next: 'h0_label_assist',
      },
      {
        id: 'h0_label_assist',
        speaker: 'tong',
        when: { notFlags: ['ex_h0_label'] },
        lines: [
          { when: { minTier: 1 }, value: { ko: '거의! ㅅ이야. 수아.', en: 'Almost! That\'s ㅅ (s), not ㅇ. 수아, Su-a. A name. Someone had this locker before you.' } },
          { value: { ko: '수아. 이름이야.', en: '"수아", Su-a. Probably whoever had this locker before you.' } },
        ],
        effects: { learn: ['sua_name'] },
        next: 'h0_drawer',
      },
      {
        id: 'h0_drawer',
        speaker: 'narration',
        lines: [
          {
            value: {
              ko: '서랍이 안 닫힌다.',
              en: 'The drawer won\'t close. Something is jammed behind it: a practice notebook, soft at the corners. Pages of handwriting you can\'t read yet. Counts, arrows, a doodle of a girl with stars around her.',
            },
          },
        ],
        choices: [
          {
            id: 'h0_keep',
            intent: 'commit',
            say: { ko: '(가방에 넣는다)', en: 'Put it in your bag. You\'ll figure out whose it is.' },
            outcomes: [
              {
                speaker: 'narration',
                reaction: { ko: '…', en: 'It\'s heavier than it looks.' },
                setFlags: ['notebook_kept'],
                memory: { tag: 'found_notebook', note: 'Found a notebook behind the locker drawer and kept it.' },
              },
            ],
          },
          {
            id: 'h0_hand_in',
            intent: 'defer',
            say: { ko: '이거… 여기 있었어요.', en: 'Hand it to Manager Choi: "This… was in here."', rom: 'igeo… yeogi isseosseoyo' },
            outcomes: [
              {
                speaker: 'manager_choi',
                expr: 'thinking',
                reaction: { ko: '아… 제가 가져갈게요.', en: 'Ah… I\'ll take that.', note: 'She looks at the cover a second too long, then pockets it.', review: 'native' },
                setFlags: ['notebook_handed_in'],
                memory: { tag: 'handed_in_notebook', note: 'Handed the notebook to Manager Choi on day one.' },
              },
            ],
          },
          {
            id: 'h0_leave',
            intent: 'leave',
            say: { ko: '(다시 넣어 둔다)', en: 'Push it back where it was. Not yours.' },
            outcomes: [
              {
                speaker: 'narration',
                reaction: { ko: '…', en: 'The drawer still won\'t close properly.' },
                setFlags: ['notebook_left'],
              },
            ],
          },
        ],
        next: 'h0_glimpse',
      },
      {
        id: 'h0_glimpse',
        speaker: 'narration',
        lines: [
          {
            value: {
              ko: '쾅.',
              en: 'Bang. At the far end of the corridor a girl shuts her locker, headphones in, and walks past without looking at you.',
            },
          },
        ],
        effects: { setFlags: ['glimpsed_haeun'] },
        next: 'h0_coach',
      },
      {
        id: 'h0_coach',
        speaker: 'coach_park',
        expr: 'neutral',
        lines: [
          {
            value: {
              ko: '새로 온 연습생? 내일 아침 열 시, 연습실. 늦지 마요.',
              en: 'The new trainee? Tomorrow, 10am, the studio. Don\'t be late.',
              review: 'native',
            },
          },
        ],
        tong: { ko: '연습실 = 연습 + 실(방)!', en: '연습실 = 연습 (practice) + 실 (room). Practice room. You\'ll live there now.', maxLevel: 2 },
        effects: { setFlags: ['h0_done'], vocab: [{ ko: '연습실', en: 'practice room', rom: 'yeonseupsil' }] },
        end: true,
      },
    ],
  },
  presets: [
    {
      id: 'h0_tier0',
      label: 'Fresh start, no Hangul (tier 0): Tong reads the label, keeps the notebook',
      state: { day: 1 },
      world: { playerLevel: 0, inputTier: 0, hour: 15, weather: 'rain' },
      path: ['h0_keep'],
      exercises: false,
    },
    {
      id: 'h0_tier1',
      label: 'Learned the blocks (tier 1): reads 수아 herself, keeps the notebook',
      state: { day: 1 },
      world: { playerLevel: 1, inputTier: 1, hour: 15, weather: 'clear' },
      path: ['h0_keep'],
    },
    {
      id: 'h0_tier2_handin',
      label: 'Placement-tested (tier 2): Tong stays quiet, hands the notebook in',
      state: { day: 1 },
      world: { playerLevel: 3, inputTier: 2, hour: 15, weather: 'clear' },
      path: ['h0_hand_in'],
    },
  ],
};
