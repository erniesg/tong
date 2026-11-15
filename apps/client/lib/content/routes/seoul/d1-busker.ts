import type { SceneModule } from '../../../relationship/types';

/** Day 1 · 버스킹 (the busker in the plaza). He counts himself in: 하나, 둘, 셋, 넷. */
export const module: SceneModule = {
  scene: {
    id: 'seoul.d1.busker',
    kind: 'story',
    title: { ko: '버스킹', en: 'The busker' },
    characterId: 'tong',
    location: 'subway_hub',
    slot: 'd1.s2c',
    gate: { flags: ['d1_arrived_hongdae'], notFlags: ['orientation_done'], month: { from: 1, to: 1 } },
    summary: 'A boy with a guitar and six listeners. One more song? Stay (he counts in 하나, 둘, 셋, 넷; it costs time) or clap and go.',
    seeds: ['d1_busker', 'tally.d1_stops'],
    beats: [
      {
        id: 'b_open',
        speaker: 'narration',
        lines: [{ value: { ko: '버스킹.', en: 'A boy with a guitar and a small amp. Six people in a half-circle. He finishes a chorus and looks up.' } }],
        next: 'b_more',
      },
      {
        id: 'b_more',
        speaker: 'busker',
        lines: [{ value: { ko: '감사합니다! 한 곡 더 할까요?', en: 'Thank you! One more song?', review: 'native' } }],
        tong: { ko: '한 곡 더 = 노래 하나 더!', en: '한 곡 더 (han gok deo) = one more song.', maxLevel: 3 },
        choices: [
          {
            id: 'b_yes',
            intent: 'commit',
            say: { ko: '네!', en: 'Yes!', rom: 'ne' },
            outcomes: [
              {
                speaker: 'busker',
                reaction: { ko: '좋아요. 하나, 둘, 셋, 넷—', en: 'All right. One, two, three, four—', note: 'He counts himself in. You stay for the whole song.', review: 'native' },
                setFlags: ['d1_busker', 'd1_busker_song'],
                tally: ['d1_stops'],
                vocab: [{ ko: '하나, 둘, 셋, 넷', en: 'one, two, three, four', rom: 'hana, dul, set, net' }],
              },
            ],
          },
          {
            id: 'b_clap',
            intent: 'leave',
            say: { ko: '(박수 치고 간다)', en: 'Clap, and keep walking.' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '짝짝짝.', en: 'He grins and bows at you over the guitar.' }, setFlags: ['d1_busker'] }],
          },
        ],
        end: true,
      },
    ],
  },
  presets: [
    { id: 'd1b_stay', label: 'Stays for the song', state: { day: 1 }, world: { hour: 16, playerLevel: 0, inputTier: 1, flags: { d1_arrived_hongdae: true } }, path: ['b_yes'] },
    { id: 'd1b_go', label: 'Claps and goes', state: { day: 1 }, world: { hour: 16, playerLevel: 0, inputTier: 1, flags: { d1_arrived_hongdae: true } }, path: ['b_clap'] },
  ],
};
