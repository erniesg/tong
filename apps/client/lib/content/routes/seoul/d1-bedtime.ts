import type { SceneModule } from '../../../relationship/types';

/**
 * Day 1 · 첫날 밤 (bedtime). Tong offers to go over the day; only questions about
 * things you actually saw appear. The Hangul recap follows in the runtime
 * (it lists the letters this save actually met).
 */
export const module: SceneModule = {
  scene: {
    id: 'seoul.d1.bedtime',
    kind: 'story',
    title: { ko: '첫날 밤', en: 'First night' },
    characterId: 'tong',
    location: 'dorm',
    slot: 'd1.s5',
    gate: { flags: ['dorm_arrived'], month: { from: 1, to: 1 } },
    summary: 'In your bunk. Tong: anything from today? Bo-ram\'s 반말, Yun-seo\'s 고생 많으셨죠 (on-time arrival only), why everyone says 언니. Then sleep.',
    seeds: ['tong_explained_honorific_si'],
    beats: [
      {
        id: 'b_open',
        speaker: 'tong',
        lines: [
          { when: { any: [{ flags: ['asked_boram'] }, { flags: ['asked_yunseo'] }, { flags: ['asked_eonni'] }] }, value: { ko: '또?', en: 'Anything else?' } },
          { value: { ko: '오늘 거 다시 볼래?', en: 'Anything from today you want to go over?', review: 'native' } },
        ],
        choices: [
          {
            id: 'b_boram',
            intent: 'ask',
            gate: { notFlags: ['asked_boram'] },
            say: { ko: '보람 언니는 왜 반말해?', en: 'Why does Bo-ram talk to me casually?' },
            outcomes: [
              {
                speaker: 'tong',
                reaction: {
                  ko: '언니니까. 말 편하게 해, 할 때까지 기다려.',
                  en: 'That\'s 반말, casual speech. She\'s the oldest, so she can drop the formal endings with you. You can\'t drop them back until she tells you 말 편하게 해, "talk comfortably". Switching first would be presumptuous.',
                  review: 'native',
                },
                setFlags: ['asked_boram'],
                next: 'b_open',
              },
            ],
          },
          {
            id: 'b_yunseo',
            intent: 'ask',
            gate: { flags: ['d1_ontime'], notFlags: ['asked_yunseo'] },
            say: { ko: '윤서가 정확히 뭐라고 했어?', en: 'What did Yun-seo say to me, exactly?' },
            outcomes: [
              {
                speaker: 'tong',
                reaction: {
                  ko: '시가 들어갔어.',
                  en: '고생 is hardship. 많으셨죠 is "you had a lot of it, didn\'t you", and the 시 in there is an honorific, the one you use for people above you. Between trainees around the same age, people usually leave it out. She put it in.',
                  review: 'native',
                },
                setFlags: ['asked_yunseo', 'tong_explained_honorific_si'],
                next: 'b_open',
              },
            ],
          },
          {
            id: 'b_eonni',
            intent: 'ask',
            gate: { notFlags: ['asked_eonni'] },
            say: { ko: '왜 다 언니라고 불러?', en: 'Why does everyone call each other 언니?' },
            outcomes: [
              {
                speaker: 'tong',
                reaction: {
                  ko: '언니, 누나, 오빠, 형.',
                  en: 'Girls call older girls 언니, family or not. Boys would say 누나. To an older guy it\'s 오빠 from a girl, 형 from a guy. Get it right and people relax.',
                  review: 'native',
                },
                setFlags: ['asked_eonni'],
                next: 'b_open',
              },
            ],
          },
          {
            id: 'b_sleep',
            intent: 'leave',
            say: { ko: '잘래.', en: 'Sleep.' },
            outcomes: [{ speaker: 'tong', reaction: { ko: '잘 자.', en: 'Night.' } }],
          },
        ],
        next: 'b_end',
      },
      {
        id: 'b_end',
        speaker: 'tong',
        lines: [{ value: { ko: '자는 동안 기력이 차. 자정 전에 자면 내일 꽉 차.', en: 'Energy refills while you sleep. Before midnight and you start tomorrow full.', review: 'native' } }],
        end: true,
      },
    ],
  },
  presets: [
    { id: 'd1b_ontime', label: 'On-time arrival: all three questions', state: { day: 1 }, world: { hour: 22, playerLevel: 1, inputTier: 1, flags: { dorm_arrived: true, d1_ontime: true } } },
    { id: 'd1b_late', label: 'Late arrival: straight to sleep', state: { day: 1 }, world: { hour: 23, playerLevel: 0, inputTier: 1, flags: { dorm_arrived: true, d1_late: true } }, path: ['b_sleep'] },
  ],
};
