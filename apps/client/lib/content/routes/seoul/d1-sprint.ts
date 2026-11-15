import type { SceneModule } from '../../../relationship/types';

/** Day 1 · 계단 (Athlete). The stone stairs, two at a time, suitcase on your shoulder. */
export const module: SceneModule = {
  scene: {
    id: 'seoul.d1.sprint',
    kind: 'story',
    title: { ko: '계단', en: 'The stairs' },
    characterId: 'tong',
    location: 'subway_hub',
    slot: 'd1.s2f',
    gate: { flags: ['d1_arrived_hongdae', 'origin_athlete'], notFlags: ['orientation_done'], month: { from: 1, to: 1 } },
    summary: 'Athlete: take the terrace stairs at a run with the suitcase on your shoulder. Never late. A calf pulls tight; your old teammate texts "Splits?". Toll +1.',
    seeds: ['d1_sprint', 'd1_tight_calf', 'd1_shortcut', 'tally.toll'],
    beats: [
      {
        id: 'r_go',
        speaker: 'narration',
        lines: [{ value: { ko: '하나, 둘.', en: 'Suitcase on your shoulder, two steps at a time. At the top you aren\'t breathing hard. Your left calf has an opinion.' } }],
        effects: { setFlags: ['d1_sprint', 'd1_tight_calf', 'd1_shortcut'], tally: ['toll'] },
        next: 'r_splits',
      },
      {
        id: 'r_splits',
        speaker: 'narration',
        lines: [{ value: { ko: 'Splits?', en: 'Your old teammate, on KakaoTalk.' } }],
        end: true,
      },
    ],
  },
  presets: [{ id: 'd1r_run', label: 'Runs the stairs', state: { day: 1 }, world: { hour: 16, playerLevel: 0, inputTier: 1, flags: { d1_arrived_hongdae: true, origin_athlete: true } } }],
};
