import type { SceneModule } from '../../../relationship/types';

/** Day 1 · 로비 (Onsae's lobby). Nobody at the desk, the artist wall, the floor guide. */
export const module: SceneModule = {
  scene: {
    id: 'seoul.d1.lobby',
    kind: 'story',
    title: { ko: '온새', en: 'Onsae' },
    characterId: 'tong',
    location: 'agency_lobby',
    slot: 'd1.s3a',
    gate: { flags: ['d1_arrived_hongdae'], notFlags: ['orientation_done'], month: { from: 1, to: 1 } },
    summary: 'Onsae\'s lobby: smaller than the name, nobody at the desk, bass through the ceiling. The artist wall: the biggest frame is the drama poster (진). The floor guide: practice rooms on 2층.',
    seeds: ['d1_lobby_seen', 'saw_jin_poster'],
    beats: [
      {
        id: 'l_open',
        speaker: 'narration',
        lines: [{ value: { ko: '온새 엔터테인먼트.', en: 'Onsae Entertainment. Smaller than the name. Nobody at the desk. Bass comes down through the ceiling.' } }],
        next: 'l_wall',
      },
      {
        id: 'l_wall',
        speaker: 'narration',
        lines: [
          { when: { flags: ['met_jin'] }, value: { ko: '소속 아티스트', en: 'Framed on the wall, the people Onsae looks after. The biggest frame is a drama poster. The man from the tent, without the cap.' } },
          { when: { flags: ['saw_jin_poster'] }, value: { ko: '소속 아티스트', en: 'Framed on the wall, the people Onsae looks after. The biggest frame is the poster from the station. He is one of theirs.' } },
          { value: { ko: '소속 아티스트', en: 'Framed on the wall, the people Onsae looks after. The biggest frame is a drama poster: one face, one name, 진.' } },
        ],
        tong: { ko: '소속 = 여기 사람!', en: '소속 아티스트 = the artists signed here. 진 = Jin.', maxLevel: 6 },
        effects: { setFlags: ['saw_jin_poster'] },
        next: 'l_guide',
      },
      {
        id: 'l_guide',
        speaker: 'tong',
        lines: [{ value: { ko: '연습실은 2층이야. 계단은 저 문.', en: 'The floor guide: practice rooms on 2층, the second floor. The stairs are through that door.', review: 'native' } }],
        effects: { setFlags: ['d1_lobby_seen'], vocab: [{ ko: '층', en: 'floor (of a building)', rom: 'cheung' }] },
        end: true,
      },
    ],
  },
  presets: [
    { id: 'd1l_first', label: 'Straight from the station', state: { day: 1 }, world: { hour: 16, playerLevel: 0, inputTier: 1, flags: { d1_arrived_hongdae: true } } },
    { id: 'd1l_jin', label: 'After the tent: the face on the wall', state: { day: 1 }, world: { hour: 17, playerLevel: 0, inputTier: 1, flags: { d1_arrived_hongdae: true, met_jin: true } } },
  ],
};
