import type { SceneModule } from '../../../relationship/types';

/** Day 1 · 광고판 (the drama poster on the station wall). A face before a name. */
export const module: SceneModule = {
  scene: {
    id: 'seoul.d1.poster',
    kind: 'story',
    title: { ko: '광고판', en: 'The poster' },
    characterId: 'tong',
    location: 'subway_hub',
    slot: 'd1.s2d',
    gate: { flags: ['d1_arrived_hongdae'], month: { from: 1, to: 1 } },
    summary: 'A drama poster the size of a bus on the station wall: 〈밤의 끝에서〉, one face, one name, 진. If you have already sat next to him at the tent, you know the jaw under the cap.',
    seeds: ['saw_jin_poster'],
    beats: [
      {
        id: 'p_open',
        speaker: 'narration',
        lines: [
          { when: { flags: ['met_jin'] }, value: { ko: '〈밤의 끝에서〉 · 토·일 밤 9시', en: 'A drama poster the size of a bus. One face. Take away the cap and the steam and it is the man from the tent.' } },
          { value: { ko: '〈밤의 끝에서〉 · 토·일 밤 9시', en: 'A drama poster the size of a bus. One face. People walk past without looking; they have seen it everywhere.' } },
        ],
        next: 'p_name',
      },
      {
        id: 'p_name',
        speaker: 'tong',
        lines: [
          { when: { flags: ['met_jin'] }, value: { ko: '진. …그냥 진, 이라고 했지.', en: '진. Jin. "Just Jin," he said.', review: 'native' } },
          { value: { ko: '진. 배우야.', en: '진. Jin, an actor. 밤의 끝에서: "At the Edge of Night". Weekends at nine.', review: 'native' } },
        ],
        effects: { setFlags: ['saw_jin_poster'], vocab: [{ ko: '배우', en: 'actor', rom: 'baeu' }] },
        end: true,
      },
    ],
  },
  presets: [
    { id: 'd1p_first', label: 'Sees the poster before meeting him', state: { day: 1 }, world: { hour: 16, playerLevel: 0, inputTier: 1, flags: { d1_arrived_hongdae: true } } },
    { id: 'd1p_after', label: 'Sees it after the tent', state: { day: 1 }, world: { hour: 17, playerLevel: 0, inputTier: 1, flags: { d1_arrived_hongdae: true, met_jin: true } } },
  ],
};
