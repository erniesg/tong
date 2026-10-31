import type { KakaoModule } from '../../relationship/types';

/**
 * You left a 바나나우유 on her locker before the eval. Specific if you knew it's
 * her pre-eval habit (canon fact banana_milk, a habit from Sua: bittersweet).
 */
export const module: KakaoModule = {
  thread: {
    id: 'kakao.haeun.banana_milk',
    characterId: 'haeun',
    title: '하은',
    gate: { stageAtLeast: 'acquaintances', flags: ['left_banana_milk'] },
    at: '07:52',
    summary: 'Photo of the banana milk on her locker: "이거 너지". Owning it lands; if you knew it\'s her pre-eval habit it lands hard ("…어떻게 알았어").',
    messages: [
      { from: 'them', ko: '(사진)', en: '(Photo: a 바나나우유 on top of her locker.)', photo: 'haeun-locker-banana-milk' },
      { from: 'them', ko: '이거 너지', en: 'This was you, right', delay: 0 },
    ],
    replies: [
      {
        id: 'yes',
        intent: 'commit',
        say: { ko: '네. 오늘 평가잖아요', rom: 'ne. oneul pyeonggajanayo', en: 'Yeah. It\'s eval day.' },
        outcomes: [
          {
            when: { knows: ['banana_milk'] },
            messages: [
              { from: 'them', ko: '…어떻게 알았어', en: '…how did you know', delay: 4 },
              { from: 'them', ko: '고마워', en: 'thanks', delay: 1 },
            ],
            deltas: { warmth: 3, trust: 1 },
            memory: { tag: 'banana_milk_specific', note: 'Left banana milk before an eval knowing it was her ritual.' },
          },
          { messages: [{ from: 'them', ko: 'ㅇ 고마워', en: 'k thanks', delay: 2 }], deltas: { warmth: 2 } },
        ],
      },
      {
        id: 'deny',
        intent: 'tease',
        say: { ko: '아닌데?', rom: 'aninde?', en: 'Wasn\'t me?' },
        outcomes: [{ messages: [{ from: 'them', ko: 'ㅋ 거짓말', en: 'heh liar', delay: 1 }], deltas: { warmth: 1, tension: 1 } }],
      },
      { id: 'read', intent: 'leave', say: { ko: '(읽씹)', en: '(leave it on read)' }, outcomes: [{ messages: [] }] },
    ],
  },
  presets: [
    { id: 'generic', label: 'Acquaintances, you didn\'t know the habit.', state: { stage: 'acquaintances', flags: { left_banana_milk: true }, day: 56 }, world: { hour: 7 } },
    { id: 'specific', label: 'Friends, you knew it\'s her pre-eval ritual.', state: { stage: 'friends', flags: { left_banana_milk: true }, knows: { banana_milk: true }, day: 112 }, world: { hour: 7 } },
  ],
};
