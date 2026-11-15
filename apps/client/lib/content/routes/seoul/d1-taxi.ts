import type { SceneModule } from '../../../relationship/types';

/** Day 1 · 택시 (International-School Kid). Mum said use the card. It is two streets. */
export const module: SceneModule = {
  scene: {
    id: 'seoul.d1.taxi',
    kind: 'story',
    title: { ko: '택시', en: 'The taxi' },
    characterId: 'tong',
    location: 'subway_hub',
    slot: 'd1.s2e',
    gate: { flags: ['d1_arrived_hongdae', 'origin_intl_kid'], notFlags: ['orientation_done'], month: { from: 1, to: 1 } },
    summary: 'International-School Kid: the taxi at the rank, on the family card. The driver looks at the address, at the stairs fifty metres away, at you. Small talk round the block. Dropped at the door; never late. Toll +1.',
    seeds: ['d1_taxi', 'toll_family_card', 'd1_shortcut', 'tally.toll'],
    beats: [
      {
        id: 'x_where',
        speaker: 'driver',
        lines: [{ value: { ko: '어디까지 가세요?', en: 'Where to?', note: 'You show him the address. He looks at it, at the stairs fifty metres away, then at you.', review: 'native' } }],
        next: 'x_chat',
      },
      {
        id: 'x_chat',
        speaker: 'driver',
        lines: [{ value: { ko: '…타세요. 한국어 할 줄 알아요? 학생이에요?', en: '…Get in. Do you speak Korean? Are you a student?', review: 'native' } }],
        choices: [
          {
            id: 'x_yes',
            intent: 'defer',
            say: { ko: '네.', en: 'Yes.', rom: 'ne' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '…', en: 'You say 네 to everything. He talks happily all the way round the block.' } }],
          },
          {
            id: 'x_little',
            intent: 'commit',
            say: { ko: '조금요.', en: 'A little.', rom: 'jogeumyo' },
            outcomes: [{ speaker: 'driver', reaction: { ko: '괜찮아요. 천천히.', en: 'That\'s fine. Slowly.', note: 'He points out the river between two buildings.', review: 'native' }, vocab: [{ ko: '조금', en: 'a little', rom: 'jogeum' }] }],
          },
        ],
        next: 'x_door',
      },
      {
        id: 'x_door',
        speaker: 'narration',
        lines: [{ value: { ko: '삑.', en: 'He lets you out at the door on the top road. The family card goes through without a sound. Somewhere, your mother gets a notification.' } }],
        effects: { setFlags: ['d1_taxi', 'toll_family_card', 'd1_shortcut'], tally: ['toll'] },
        end: true,
      },
    ],
  },
  presets: [
    { id: 'd1x_little', label: 'Says "a little"', state: { day: 1 }, world: { hour: 16, playerLevel: 0, inputTier: 1, flags: { d1_arrived_hongdae: true, origin_intl_kid: true } }, path: ['x_little'] },
  ],
};
