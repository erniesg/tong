import type { SceneModule } from '../../../relationship/types';

/** Day 1 · 붕어빵 (the cart at the foot of the stairs). 하나 주세요, and something to carry up. */
export const module: SceneModule = {
  scene: {
    id: 'seoul.d1.cart',
    kind: 'story',
    title: { ko: '붕어빵', en: 'The bungeoppang cart' },
    characterId: 'tong',
    location: 'food_street',
    slot: 'd1.s2b',
    gate: { flags: ['d1_arrived_hongdae'], notFlags: ['orientation_done'], month: { from: 1, to: 1 } },
    summary: 'The 붕어빵 cart. Ask for one (하나 주세요); she gives you two. You can offer the second to someone upstairs.',
    seeds: ['has_bungeoppang', 'd1_cart'],
    beats: [
      {
        id: 'c_open',
        speaker: 'seller',
        lines: [{ value: { ko: '어서 와요! 붕어빵 따끈따끈해요.', en: 'Come, come! Bungeoppang, nice and hot.', note: 'Fish-shaped, red bean inside, in a paper bag.', review: 'native' } }],
        tong: { ko: '하나 주세요!', en: '하나 (hana) = one, like her tangerine. 주세요 (juseyo) = please give me.', maxLevel: 6 },
        choices: [
          {
            id: 'c_one',
            intent: 'commit',
            say: { ko: '하나 주세요.', en: 'One, please.', rom: 'hana juseyo' },
            outcomes: [{ speaker: 'seller', reaction: { ko: '하나? 아이고, 하나 더 줄게.', en: 'One? Aigo, have another.', note: 'Two in the bag.', review: 'native' }, vocab: [{ ko: '하나 주세요', en: 'one, please', rom: 'hana juseyo' }] }],
          },
          {
            id: 'c_point',
            intent: 'presence',
            say: { ko: '(가리킨다)', en: 'Point at them.' },
            outcomes: [{ speaker: 'seller', reaction: { ko: '하나? 둘? …둘!', en: 'One? Two? …Two!', note: 'She holds up fingers and decides for you.', review: 'native' } }],
          },
        ],
        next: 'c_thanks',
      },
      {
        id: 'c_thanks',
        speaker: 'seller',
        lines: [{ value: { ko: '뜨거워요. 조심해요!', en: 'It\'s hot. Careful!', review: 'native' } }],
        choices: [
          {
            id: 'c_gamsa',
            intent: 'commit',
            say: { ko: '감사합니다!', en: 'Thank you!', rom: 'gamsahamnida' },
            outcomes: [{ speaker: 'seller', reaction: { ko: '맛있게 먹어요!', en: 'Enjoy!' } }],
          },
          {
            id: 'c_nod',
            intent: 'presence',
            say: { ko: '(꾸벅)', en: 'Nod.' },
            outcomes: [{ speaker: 'seller', reaction: { ko: '맛있게 먹어요!', en: 'Enjoy!' } }],
          },
        ],
        next: 'c_end',
      },
      {
        id: 'c_end',
        speaker: 'narration',
        lines: [{ value: { ko: '따뜻하다.', en: 'Warm through the paper. You eat one on the spot. One left.' } }],
        effects: { setFlags: ['has_bungeoppang', 'd1_cart'] },
        end: true,
      },
    ],
  },
  presets: [
    { id: 'd1c_one', label: 'Asks for one in Korean', state: { day: 1 }, world: { hour: 16, playerLevel: 0, inputTier: 1, flags: { d1_arrived_hongdae: true } }, path: ['c_one', 'c_gamsa'] },
    { id: 'd1c_point', label: 'Points', state: { day: 1 }, world: { hour: 16, playerLevel: 0, inputTier: 1, flags: { d1_arrived_hongdae: true } }, path: ['c_point', 'c_nod'] },
  ],
};
