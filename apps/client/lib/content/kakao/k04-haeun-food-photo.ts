import type { KakaoModule } from '../../relationship/types';

/** A photo, no caption. That's an invitation, in Haeun. */
export const module: KakaoModule = {
  thread: {
    id: 'kakao.haeun.food_photo',
    characterId: 'haeun',
    title: '하은',
    gate: { stageAtLeast: 'friends', hours: { from: 0, to: 2 } },
    at: '00:47',
    summary: 'She sends a photo of two cups of ramyeon outside the store. No caption. "나도 갈래" gets "ㅇ 빨리"; leaving it on read gets "다 불었어" in the morning.',
    messages: [{ from: 'them', ko: '(사진)', en: '(Photo: two cups of ramyeon on the plastic table outside the store. No caption.)', photo: 'haeun-two-ramyeon' }],
    replies: [
      {
        id: 'coming',
        intent: 'commit',
        say: { ko: '나도 갈래', rom: 'nado gallae', en: 'I\'m coming too' },
        outcomes: [{ messages: [{ from: 'them', ko: 'ㅇ 빨리', en: 'k hurry' }], deltas: { warmth: 2 } }],
      },
      {
        id: 'looks_good',
        intent: 'presence',
        say: { ko: '맛있겠다', rom: 'masitgetda', en: 'Looks good' },
        outcomes: [{ messages: [{ from: 'them', ko: 'ㅋ', en: 'heh' }], deltas: { warmth: 1 } }],
      },
      {
        id: 'curfew',
        intent: 'tease',
        say: { ko: '통금 지났는데?', rom: 'tonggeum jinanneunde?', en: 'Isn\'t it past curfew?' },
        outcomes: [
          { when: { min: { tension: 35 } }, messages: [{ from: 'them', ko: '너나 잘해', en: 'worry about yourself' }], deltas: { tension: 1, warmth: 1 } },
          { messages: [{ from: 'them', ko: '그래서 안 와?', en: 'so you\'re not coming?' }], deltas: { warmth: 1 } },
        ],
      },
      {
        id: 'read',
        intent: 'leave',
        say: { ko: '(읽씹)', en: '(leave it on read)' },
        outcomes: [{ messages: [{ from: 'them', ko: '다 불었어', en: 'they went soggy', delay: 420 }], deltas: { warmth: -1 } }],
      },
    ],
  },
  presets: [{ id: 'friend', label: 'Friends, after curfew.', state: { stage: 'friends', axes: { warmth: 50, tension: 30, trust: 40 }, day: 100 }, world: { hour: 0 } }],
};
