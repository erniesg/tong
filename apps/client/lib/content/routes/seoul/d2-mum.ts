import type { SceneModule } from '../../../relationship/types';

/** Day 2 · 엄마 (Mum). International-School Kid: Mum sets the Sunday call (seoul.loop.family_call). */
export const module: SceneModule = {
  scene: {
    id: 'seoul.d2.mum_text',
    kind: 'story',
    title: { ko: '엄마', en: 'Mum' },
    characterId: 'tong',
    location: 'dorm',
    slot: 'd2.s1',
    gate: { flags: ['origin_intl_kid'], month: { from: 1, to: 1 } },
    summary: 'Day 2, morning. Mum on KakaoTalk: a video call on Sundays at 10, Dad wants to see the dorm. Agree (sets the weekly call) or put her off (she asks again next week).',
    seeds: ['family_call_set'],
    beats: [
      {
        id: 'mt_text',
        speaker: 'narration',
        lines: [{ value: { ko: 'Sundays at 10 your time? Dad wants to see your room. Video please!!', en: 'Mum, on KakaoTalk.' } }],
        choices: [
          {
            id: 'mt_yes',
            intent: 'commit',
            say: { ko: 'Sundays at 10. Okay.', en: 'Sundays at 10. Okay.' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '❤️❤️❤️', en: 'Three hearts. Then a photo of the dog.' }, setFlags: ['family_call_set'] }],
          },
          {
            id: 'mt_later',
            intent: 'defer',
            say: { ko: 'Phones are only after 9 here. I\'ll let you know.', en: 'Phones are only after 9 here. I\'ll let you know.' },
            outcomes: [{ speaker: 'narration', reaction: { ko: 'OK!! Sunday 10 then 😘', en: 'Mum, deciding anyway.' }, setFlags: ['family_call_set'] }],
          },
        ],
        end: true,
      },
    ],
  },
  presets: [{ id: 'mt_day2', label: 'Day 2 morning', state: { day: 2 }, world: { hour: 7.5, playerLevel: 0, inputTier: 1, flags: { origin_intl_kid: true } }, path: ['mt_yes'] }],
};
