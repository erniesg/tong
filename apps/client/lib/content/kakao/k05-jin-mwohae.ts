import type { KakaoModule } from '../../relationship/types';

/** 뭐해? — the check-in. Asking about *him* is what he wants. */
export const module: KakaoModule = {
  thread: {
    id: 'kakao.jin.mwohae',
    characterId: 'jin',
    title: '진 선배',
    gate: { stageAtLeast: 'acquaintances' },
    at: '21:02',
    summary: 'Jin\'s first 뭐해? check-in after a shoot. Asking how he is lands best (being seen as himself). Ignoring it gets "?" twenty-five minutes later.',
    messages: [
      { from: 'them', ko: '뭐해? 👀', en: 'Whatcha doing? 👀' },
      { from: 'them', ko: '나 촬영 방금 끝났어 😮‍💨', en: 'Just wrapped a shoot 😮‍💨', delay: 1 },
    ],
    replies: [
      {
        id: 'practising',
        intent: 'commit',
        say: { ko: '연습 중이에요!', rom: 'yeonseup jungieyo!', en: 'Practising!' },
        outcomes: [{ messages: [{ from: 'them', ko: '역시 ㅋㅋ 열심히 하네 👏 끝나면 연락해!', en: 'Of course lol, so hardworking 👏 text me when you\'re done!', delay: 1 }], deltas: { warmth: 1 } }],
      },
      {
        id: 'how_was_it',
        intent: 'ask',
        say: { ko: '수고했어요! 오늘 촬영 어땠어요?', rom: 'sugohaesseoyo! oneul chwaryeong eottaesseoyo?', en: 'Good work! How was the shoot?' },
        outcomes: [
          {
            messages: [
              { from: 'them', ko: '와 그거 물어봐 준 사람 너밖에 없어 ㅠㅠ', en: 'Wow, you\'re the only one who asked ㅠㅠ', delay: 1 },
              { from: 'them', ko: '하루 종일 다른 사람으로 살았어 ㅋㅋ 이제야 나로 돌아옴', en: 'Spent all day being someone else lol. Only just back to being me', delay: 0 },
            ],
            deltas: { warmth: 3 },
          },
        ],
      },
      {
        id: 'read',
        intent: 'leave',
        say: { ko: '(읽씹)', en: '(leave it on read)' },
        outcomes: [
          {
            messages: [
              { from: 'them', ko: '바쁜가 보네 ㅎㅎ', en: 'Must be busy hehe', delay: 15 },
              { from: 'them', ko: '?', en: '?', delay: 25 },
            ],
            setFlags: ['left_jin_on_read'],
          },
        ],
      },
    ],
  },
  presets: [{ id: 'acq', label: 'Acquaintances, evening.', state: { stage: 'acquaintances', flags: { met_jin: true }, day: 30 }, world: { hour: 21 } }],
};
