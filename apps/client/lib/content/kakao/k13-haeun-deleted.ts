import type { KakaoModule } from '../../relationship/types';

/** 삭제된 메시지입니다. You'll never know what it said, unless you ask her much later. */
export const module: KakaoModule = {
  thread: {
    id: 'kakao.haeun.deleted',
    characterId: 'haeun',
    title: '하은',
    gate: { stageAtLeast: 'romantic_tension' },
    at: '02:14',
    summary: 'A deleted message, then "아무것도 아님", then "자". Asking is remembered (payoff later); matching her ("나도 아무것도 아님") gets real laughter; "잘 자" gets "…너도".',
    messages: [
      { from: 'them', ko: '삭제된 메시지입니다.', en: 'This message was deleted.', deleted: true },
      { from: 'them', ko: '아무것도 아님', en: 'it\'s nothing', delay: 1 },
      { from: 'them', ko: '자', en: 'go to sleep', delay: 0 },
    ],
    replies: [
      {
        id: 'ask',
        intent: 'ask',
        say: { ko: '뭐 보냈었어?', rom: 'mwo bonaesseosseo?', en: 'What did you send?' },
        outcomes: [
          {
            messages: [{ from: 'them', ko: '아무것도 아니라니까', en: 'I said it\'s nothing', delay: 1 }],
            deltas: { warmth: 1, tension: 1 },
            memory: { tag: 'asked_deleted_msg', note: 'Asked what the deleted 2am message said. She wouldn\'t say. Yet.' },
          },
        ],
      },
      {
        id: 'match',
        intent: 'tease',
        say: { ko: '나도 아무것도 아님', rom: 'nado amugeotdo anim', en: 'me neither, nothing' },
        outcomes: [{ messages: [{ from: 'them', ko: 'ㅋㅋㅋㅋ 뭐래', en: 'lololol what are you on about', delay: 1 }], deltas: { warmth: 3 } }],
      },
      {
        id: 'night',
        intent: 'comfort',
        say: { ko: '잘 자', rom: 'jal ja', en: 'Good night' },
        outcomes: [{ messages: [{ from: 'them', ko: '…너도', en: '…you too', delay: 2 }], deltas: { warmth: 2, trust: 1 } }],
      },
    ],
  },
  presets: [
    {
      id: 'tension',
      label: 'Romantic tension, 2am.',
      state: { stage: 'romantic_tension', flags: { spark: true, dropped_formal: true }, axes: { warmth: 75, tension: 45, trust: 65 }, day: 280 },
      world: { hour: 2 },
    },
  ],
};
