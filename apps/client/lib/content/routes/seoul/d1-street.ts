import type { SceneModule } from '../../../relationship/types';

/**
 * Day 1 · 홍대 (out of the station, 4:25pm; docs/seoul-first-day.md). Two places are
 * lit from here: Onsae up the stairs, where one trainee is still alone in Room B
 * (Ha-eun first), and the tent on the food street, with one stool left (Jin first).
 * Whoever you don't meet now, you meet later. The Creator's fan catches up here.
 */
export const module: SceneModule = {
  scene: {
    id: 'seoul.d1.street',
    kind: 'story',
    title: { ko: '홍대', en: 'Hongdae' },
    characterId: 'tong',
    location: 'subway_hub',
    slot: 'd1.s2',
    gate: { flags: ['d1_arrived_hongdae'], month: { from: 1, to: 1 } },
    summary:
      'Up into Sunday-afternoon Hongdae. Tong: Onsae is up the stone stairs; you have until five. Your stomach: the tent on the food street is already steaming. Go straight up (Ha-eun, alone in Room B) or eat first (Jin, on the next stool). Creator: the student from the train catches up; the photo.',
    seeds: ['d1_street_seen', 'pr_photo', 'd1_fan', 'tally.toll'],
    beats: [
      {
        id: 's_open',
        speaker: 'narration',
        lines: [{ value: { ko: '홍대.', en: 'Up the escalator into Sunday afternoon. A guitar somewhere, something frying, a hundred signs.' } }],
        next: 's_fan',
      },
      {
        id: 's_fan',
        speaker: 'fan',
        when: { flags: ['origin_creator'] },
        lines: [{ value: { ko: '헐… 혹시 {name} 님 맞아요? Oh my god, I watch everything!', en: 'Whoa… are you {name}, by any chance? Oh my god, I watch everything!', note: 'The student from the train. She ran to catch you up.', review: 'native' } }],
        next: 's_fan_photo',
      },
      {
        id: 's_fan_photo',
        speaker: 'fan',
        when: { flags: ['origin_creator'] },
        lines: [{ value: { ko: '사진 같이 찍어도 돼요?', en: 'Can we take a photo together?', review: 'native' } }],
        choices: [
          {
            id: 's_fan_yes',
            intent: 'commit',
            say: { ko: '네, 좋아요.', en: 'Sure.', rom: 'ne, joayo' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '찰칵.', en: 'A selfie. She has posted it before she has finished thanking you.' }, setFlags: ['pr_photo', 'd1_fan'], tally: ['toll', 'toll'] }],
          },
          {
            id: 's_fan_no',
            intent: 'decline',
            say: { ko: '죄송해요, 지금은….', en: 'Sorry, not right now…', rom: 'joesonghaeyo, jigeumeun' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '찰칵.', en: 'She takes a blurry one of your back anyway. She posts it.' }, setFlags: ['pr_photo'], tally: ['toll'] }],
          },
        ],
        next: 's_where',
      },
      {
        id: 's_where',
        speaker: 'tong',
        lines: [{ value: { ko: '회사는 저 돌계단 위야. 5시까지.', en: 'Onsae is up those stone stairs, on the terrace. You have until five.', review: 'native' } }],
        next: 's_hungry',
      },
      {
        id: 's_hungry',
        speaker: 'narration',
        lines: [{ value: { ko: '꼬르륵.', en: 'Your stomach. You last ate over an ocean. Down the food street an orange tent is already steaming.' } }],
        tong: { ko: '걷는 건 공짜. 멈추면 시간이 가.', en: 'Walking is free. Stopping for things takes time.', maxLevel: 6 },
        effects: { setFlags: ['d1_street_seen'] },
        end: true,
      },
    ],
  },
  presets: [
    { id: 'd1s_plain', label: 'No origin: the stairs or the tent', state: { day: 1 }, world: { hour: 16, playerLevel: 0, inputTier: 1, flags: { d1_arrived_hongdae: true } } },
    { id: 'd1s_creator_yes', label: 'Creator: says yes to the photo', state: { day: 1 }, world: { hour: 16, playerLevel: 1, inputTier: 1, flags: { d1_arrived_hongdae: true, origin_creator: true } }, path: ['s_fan_yes'] },
    { id: 'd1s_creator_no', label: 'Creator: says no; she posts one anyway', state: { day: 1 }, world: { hour: 16, playerLevel: 1, inputTier: 1, flags: { d1_arrived_hongdae: true, origin_creator: true } }, path: ['s_fan_no'] },
  ],
};
