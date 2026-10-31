import type { KakaoModule } from '../../relationship/types';

/** The dry acquaintance answer. She replies 14 minutes later with one number. */
export const module: KakaoModule = {
  thread: {
    id: 'kakao.haeun.oo',
    characterId: 'haeun',
    title: '하은',
    gate: { stage: ['acquaintances'] },
    at: '22:40',
    summary: 'You asked what time practice is. She answers with "10시" fourteen minutes later. Thank her and get "ㅇㅇ"; tease the slow reply and she bites.',
    messages: [
      { from: 'me', ko: '내일 연습 몇 시예요?', en: 'What time is practice tomorrow?' },
      { from: 'them', ko: '10시', en: '10.', delay: 14 },
    ],
    replies: [
      {
        id: 'thanks',
        intent: 'commit',
        say: { ko: '고마워요!', rom: 'gomawoyo!', en: 'Thanks!' },
        outcomes: [{ messages: [{ from: 'them', ko: 'ㅇㅇ', en: 'yup' }], deltas: { warmth: 1 } }],
      },
      {
        id: 'tease',
        intent: 'tease',
        say: { ko: '답장 빠르네요 ㅋㅋ', rom: 'dapjang ppareuneyo kk', en: 'Wow, fast reply lol' },
        outcomes: [
          {
            messages: [
              { from: 'them', ko: '바빴어요', en: 'I was busy.', delay: 2 },
              { from: 'them', ko: '늦지 마요', en: 'Don\'t be late.', delay: 0 },
            ],
            deltas: { tension: 1, warmth: 1 },
          },
        ],
      },
      { id: 'read', intent: 'leave', say: { ko: '(읽씹)', en: '(leave it on read)' }, outcomes: [{ messages: [] }] },
    ],
  },
  presets: [{ id: 'acq', label: 'Acquaintances, month 1.', state: { stage: 'acquaintances', day: 20 }, world: { hour: 22 } }],
};
