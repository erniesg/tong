import type { KakaoModule } from '../../relationship/types';

/** "나와." One word at 1am: the first time she chooses to break the rules with you. */
export const module: KakaoModule = {
  thread: {
    id: 'kakao.haeun.nawa',
    characterId: 'haeun',
    title: '하은',
    gate: { stageAtLeast: 'friends', hours: { from: 0, to: 2 } },
    at: '01:03',
    summary: 'She texts "나와." Go; leave her on read (she acts like she didn\'t care); or ask "왜?" — she says "됐어", then texts again ten minutes later.',
    messages: [{ from: 'them', ko: '나와.', en: 'Come out.' }],
    replies: [
      {
        id: 'go',
        intent: 'commit',
        say: { ko: '갈게', rom: 'galge', en: 'Coming' },
        outcomes: [{ messages: [{ from: 'them', ko: 'ㅇ', en: 'k' }], deltas: { warmth: 3 }, setFlags: ['nawa_went'] }],
      },
      {
        id: 'why',
        intent: 'ask',
        say: { ko: '왜?', rom: 'wae?', en: 'Why?' },
        outcomes: [
          {
            messages: [
              { from: 'them', ko: '됐어.', en: 'Forget it.', delay: 1 },
              { from: 'them', ko: '…라면. 두 개 샀어.', en: '…Ramyeon. I bought two.', delay: 10 },
            ],
            deltas: { warmth: 1, tension: 1 },
          },
        ],
      },
      {
        id: 'read',
        intent: 'leave',
        say: { ko: '(읽씹)', en: '(leave it on read)' },
        outcomes: [
          {
            messages: [{ from: 'them', ko: 'ㅋ 자나 보네. 아무것도 아님', en: 'heh guess you\'re asleep. it was nothing', delay: 20 }],
            deltas: { warmth: -3 },
            memory: { tag: 'left_nawa_on_read', note: 'Left her first "나와." on read. She said it was nothing.' },
          },
        ],
      },
    ],
  },
  presets: [{ id: 'friend', label: 'Friends, 1am.', state: { stage: 'friends', flags: { first_secret: true }, axes: { warmth: 45, tension: 35, trust: 40 }, day: 95 }, world: { hour: 1 } }],
};
