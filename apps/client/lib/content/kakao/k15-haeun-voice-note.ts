import type { KakaoModule } from '../../relationship/types';

/** Late route: a seven-second voice note, deleted a minute later. */
export const module: KakaoModule = {
  thread: {
    id: 'kakao.haeun.voice_note',
    characterId: 'haeun',
    title: '하은',
    gate: { stageAtLeast: 'romantic_tension', month: { from: 9, to: 12 } },
    at: '01:37',
    summary: 'She sends a 0:07 voice note and deletes it before you can play it. "다시 보내 줘" → "싫어", then a promise to say it in person. Bluffing that you heard it makes her panic.',
    messages: [
      { from: 'them', ko: '(음성메시지 0:07)', en: '(Voice message, 0:07)' },
      { from: 'them', ko: '삭제된 메시지입니다.', en: 'This message was deleted.', deleted: true, delay: 1 },
      { from: 'them', ko: '잘못 보냄', en: 'sent by mistake', delay: 0 },
    ],
    replies: [
      {
        id: 'resend',
        intent: 'ask',
        say: { ko: '다시 보내 줘', rom: 'dasi bonae jwo', en: 'Send it again' },
        outcomes: [
          {
            messages: [
              { from: 'them', ko: '싫어', en: 'no', delay: 1 },
              { from: 'them', ko: '…내일 직접 말할게', en: '…I\'ll tell you in person tomorrow', delay: 3 },
            ],
            deltas: { warmth: 2, trust: 1 },
            setFlags: ['voice_note_promise'],
          },
        ],
      },
      {
        id: 'bluff',
        intent: 'tease',
        say: { ko: '이미 들었는데?', rom: 'imi deureonneunde?', en: 'Already heard it though?' },
        outcomes: [
          {
            messages: [
              { from: 'them', ko: '거짓말', en: 'liar', delay: 0 },
              { from: 'them', ko: '…뭘 들었는데', en: '…heard what', delay: 1 },
            ],
            deltas: { warmth: 2, tension: 2 },
          },
        ],
      },
      {
        id: 'night',
        intent: 'presence',
        say: { ko: 'ㅋㅋ 알았어. 잘 자', rom: 'kk arasseo. jal ja', en: 'lol okay. Good night' },
        outcomes: [{ messages: [{ from: 'them', ko: '…ㅇ 잘 자', en: '…k night', delay: 1 }], deltas: { warmth: 1 } }],
      },
    ],
  },
  presets: [
    {
      id: 'late',
      label: 'Romantic tension, month 10.',
      state: { stage: 'romantic_tension', flags: { spark: true, dropped_formal: true }, axes: { warmth: 80, tension: 40, trust: 70 }, day: 270 },
      world: { hour: 1 },
    },
  ],
};
