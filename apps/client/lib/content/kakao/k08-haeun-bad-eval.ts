import type { KakaoModule } from '../../relationship/types';

/**
 * After a bad eval, you text first. The thread starts empty: the opener is the bid.
 * An invitation (time together) lands; pity before close doesn't.
 */
export const module: KakaoModule = {
  thread: {
    id: 'kakao.haeun.bad_eval',
    characterId: 'haeun',
    title: '하은',
    gate: { stageAtLeast: 'acquaintances', mood: ['raw', 'low'] },
    at: '21:30',
    summary: 'She was flagged at the monthly eval. You decide whether and how to text first. "편의점 갈래?" is her love language; "괜찮아?" reads as pity until close.',
    messages: [],
    replies: [
      {
        id: 'okay',
        intent: 'comfort',
        say: { ko: '괜찮아?', rom: 'gwaenchana?', en: 'You okay?' },
        outcomes: [
          { when: { stageAtLeast: 'close' }, messages: [{ from: 'them', ko: '아니. 근데 고마워', en: 'no. but thanks', delay: 6 }], deltas: { trust: 2, warmth: 1 } },
          { messages: [{ from: 'them', ko: '뭐가요', en: 'about what', delay: 40 }], deltas: { tension: 1 } },
        ],
      },
      {
        id: 'store',
        intent: 'help',
        say: { ko: '편의점 갈래?', rom: 'pyeonuijeom gallae?', en: 'Wanna go to the convenience store?' },
        outcomes: [
          {
            messages: [{ from: 'them', ko: '…10분 뒤', en: '…10 min', delay: 3 }],
            deltas: { warmth: 2, trust: 2 },
            memory: { tag: 'invited_after_bad_eval', note: 'Texted her an invitation, not sympathy, the night she was flagged.' },
          },
        ],
      },
      {
        id: 'tease',
        intent: 'tease',
        say: { ko: '오늘 센터 위험하던데 ㅋ', rom: 'oneul senteo wiheomhadeonde k', en: 'Your center spot looked shaky today lol' },
        outcomes: [
          { when: { stageAtLeast: 'close' }, messages: [{ from: 'them', ko: '죽을래 ㅋ', en: 'want to die lol', delay: 2 }], deltas: { trust: 2, warmth: 1 } },
          { messages: [], deltas: { warmth: -2, tension: 2 }, memory: { tag: 'teased_too_early_text', note: 'Teased her by text the night she was flagged; she read it and never answered.' } },
        ],
      },
      { id: 'none', intent: 'leave', say: { ko: '(문자 안 보낸다)', en: '(Don\'t text.)' }, outcomes: [{ messages: [] }] },
    ],
  },
  presets: [
    { id: 'acq-raw', label: 'Acquaintances, she was flagged.', state: { stage: 'acquaintances', axes: { warmth: 30, tension: 35, trust: 25 }, mood: { valence: -2, energy: -1, causes: ['eval_flagged'] }, day: 56 }, world: { hour: 21 } },
    { id: 'close-raw', label: 'Close, she was flagged. Now teasing helps.', state: { stage: 'close', axes: { warmth: 68, tension: 35, trust: 60 }, mood: { valence: -2, energy: -1, causes: ['eval_flagged'] }, day: 196 }, world: { hour: 21 } },
  ],
};
