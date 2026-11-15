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
    summary: 'Onsae\'s lobby, two beats: nobody at the desk, bass through the ceiling, the biggest frame on the artist wall is the drama poster (진; the man from the tent if you ate first). The floor guide: 2층, and 이 by ear.',
    seeds: ['d1_lobby_seen', 'saw_jin_poster', 'hangul:이'],
    beats: [
      {
        id: 'l_open',
        speaker: 'narration',
        lines: [
          { when: { flags: ['jin_knows_onsae'] }, value: { ko: '온새 엔터테인먼트.', en: 'Onsae Entertainment. Nobody at the desk, bass through the ceiling. The biggest frame on the artist wall is a drama poster: the man from the tent, without the cap. "…온새," he said.' } },
          { when: { flags: ['met_jin'] }, value: { ko: '온새 엔터테인먼트.', en: 'Onsae Entertainment. Nobody at the desk, bass through the ceiling. The biggest frame on the artist wall is a drama poster: the man from the tent, without the cap.' } },
          { when: { flags: ['saw_jin_poster'] }, value: { ko: '온새 엔터테인먼트.', en: 'Onsae Entertainment. Nobody at the desk, bass through the ceiling. The biggest frame on the artist wall is the poster from the station. He is one of theirs.' } },
          { value: { ko: '온새 엔터테인먼트.', en: 'Onsae Entertainment. Nobody at the desk, bass through the ceiling. The biggest frame on the artist wall is a drama poster: one face, one name, 진.' } },
        ],
        effects: { setFlags: ['saw_jin_poster'] },
        next: 'l_guide',
      },
      {
        id: 'l_guide',
        speaker: 'tong',
        lines: [{ value: { ko: '연습실은 2층. 이층.', en: 'Practice rooms: 2층. Two is 이: the silent ㅇ you built, with ㅣ, "i". Which one is 이?', review: 'native' } }],
        exercise: {
          type: 'hangul_listen',
          objectiveId: 'ko-script-blocks-2part',
          targets: ['이'],
          distractors: ['아'],
          framing: { ko: '이를 골라 봐.', en: 'Tap the one you hear.' },
          onFail: 'assist',
        },
        effects: { setFlags: ['hangul:이', 'd1_lobby_seen'], vocab: [{ ko: '2층', en: 'second floor', rom: 'i-cheung' }] },
        end: true,
      },
    ],
  },
  presets: [
    { id: 'd1l_first', label: 'Straight from the station', state: { day: 1 }, world: { hour: 16, playerLevel: 0, inputTier: 1, flags: { d1_arrived_hongdae: true } } },
    { id: 'd1l_jin', label: 'After the tent: the face on the wall', state: { day: 1 }, world: { hour: 17, playerLevel: 0, inputTier: 1, flags: { d1_arrived_hongdae: true, met_jin: true } } },
  ],
};
