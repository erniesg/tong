import type { KakaoModule } from '../../relationship/types';

/**
 * 말 놓을까? by text, near midnight. She raises it, badly. Friend-stage
 * milestone: sets dropped_formal (no stage change; the register is the change).
 */
export const module: KakaoModule = {
  thread: {
    id: 'kakao.haeun.mal_nokka',
    characterId: 'haeun',
    title: '하은',
    gate: { stage: ['friends'], notFlags: ['dropped_formal'] },
    at: '23:58',
    summary: 'She asks how old you are, gives up, and asks to drop formal speech. Saying yes in 반말 seals it; answering politely is funny; "갑자기?" makes her retreat, then commit; leaving it on read is remembered.',
    messages: [
      { from: 'them', ko: '근데 몇 살이에요', en: 'So how old are you' },
      { from: 'them', ko: '아 됐다 그냥', en: 'ugh never mind', delay: 1 },
      { from: 'them', ko: '말 놓을래요?', en: 'Want to drop the formal speech?', delay: 1 },
    ],
    replies: [
      {
        id: 'yes',
        intent: 'commit',
        say: { ko: '좋아!', rom: 'joa!', en: 'Sure! (already in 반말)' },
        outcomes: [
          {
            messages: [{ from: 'them', ko: 'ㅇㅇ 그럼 이제 반말한다', en: 'k, 반말 from now on then', delay: 1 }],
            deltas: { warmth: 3 },
            setFlags: ['dropped_formal'],
            memory: { tag: 'dropped_formal', note: 'Dropped formal speech by text, a minute before midnight.' },
          },
        ],
      },
      {
        id: 'polite_yes',
        intent: 'commit',
        say: { ko: '편하게 해요 ㅋㅋ', rom: 'pyeonhage haeyo kk', en: 'Go ahead, be casual lol (still polite)' },
        outcomes: [
          {
            messages: [{ from: 'them', ko: '…지금 그거 존댓말이잖아', en: '…that was 존댓말 just now', delay: 1 }],
            deltas: { warmth: 2, tension: 1 },
            setFlags: ['dropped_formal'],
            memory: { tag: 'dropped_formal', note: 'Agreed to drop formal speech, politely; she called it out.' },
          },
        ],
      },
      {
        id: 'suddenly',
        intent: 'ask',
        say: { ko: '갑자기?', rom: 'gapjagi?', en: 'All of a sudden?' },
        outcomes: [
          {
            messages: [
              { from: 'them', ko: '됐어요. 잊어요', en: 'Forget it. Never mind', delay: 1 },
              { from: 'them', ko: '…아니 그냥 놓자', en: '…no. let\'s just drop it', delay: 5 },
            ],
            deltas: { warmth: 1, tension: 1 },
            setFlags: ['dropped_formal'],
          },
        ],
      },
      {
        id: 'read',
        intent: 'leave',
        say: { ko: '(읽씹)', en: '(leave it on read)' },
        outcomes: [
          {
            messages: [],
            deltas: { warmth: -3, trust: -1 },
            memory: { tag: 'mal_nokka_on_read', note: 'Left her 말 놓을래요? on read. She never asked again; you will have to.' },
          },
        ],
      },
    ],
  },
  presets: [{ id: 'friend', label: 'Friends, still 존댓말.', state: { stage: 'friends', axes: { warmth: 52, tension: 30, trust: 40 }, day: 110 }, world: { hour: 23 } }],
};
