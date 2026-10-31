import type { KakaoModule } from '../../relationship/types';

/**
 * Manager Choi DMs after someone was seen near the store after curfew. Covering
 * for Haeun is a Choi-thread flag (covered_for_haeun) that Haeun's scenes can read
 * once cross-character flags exist (see report / plan).
 */
export const module: KakaoModule = {
  thread: {
    id: 'kakao.choi.curfew',
    characterId: 'manager_choi',
    title: '최 실장님',
    gate: { month: { from: 2, to: 12 } },
    at: '09:12',
    summary: 'Manager Choi asks what time you got in last night. Lie, own it alone, or deflect. Owning it alone is cover for Haeun at a small cost to your standing.',
    messages: [
      { from: 'them', ko: '어제 몇 시에 들어왔어요?', en: 'What time did you get in last night?' },
      { from: 'them', ko: '편의점 근처에서 연습생 봤다는 얘기가 있어서요.', en: 'Someone said they saw a trainee near the convenience store.', delay: 0 },
    ],
    replies: [
      {
        id: 'lie',
        intent: 'deflect',
        say: { ko: '11시 전에 들어왔어요.', rom: 'yeolhansi jeone deureowasseoyo', en: 'I was in before 11.' },
        outcomes: [{ messages: [{ from: 'them', ko: '네. 알겠어요.', en: 'Okay. Noted.', delay: 3 }], setFlags: ['lied_to_choi'], deltas: { trust: -1 } }],
      },
      {
        id: 'own_it',
        intent: 'apologize',
        say: { ko: '죄송합니다. 혼자 나갔다 왔어요.', rom: 'joesonghamnida. honja nagatda wasseoyo', en: 'I\'m sorry. I went out by myself.' },
        outcomes: [
          {
            messages: [
              { from: 'them', ko: '혼자요?', en: 'By yourself?', delay: 2 },
              { from: 'them', ko: '…다음엔 경고 들어가요.', en: '…Next time it\'s a formal warning.', delay: 1 },
            ],
            setFlags: ['covered_for_haeun'],
            deltas: { tension: 1 },
          },
        ],
      },
      {
        id: 'mistake',
        intent: 'deflect',
        minTier: 2,
        say: { ko: '물 사러 잠깐 나갔었어요. 바로 들어왔어요.', rom: 'mul sareo jamkkan nagasseosseoyo. baro deureowasseoyo', en: 'I just popped out to buy water. Came straight back.' },
        outcomes: [{ messages: [{ from: 'them', ko: '물은 숙소에도 있어요 ^^', en: 'There\'s water in the dorm too ^^', delay: 2 }], deltas: { trust: 1 } }],
      },
    ],
  },
  presets: [{ id: 'm2', label: 'Month 2, the morning after the first sneak-out.', state: { stage: 'acquaintances', flags: { first_secret: true }, day: 40 }, world: { hour: 9, inputTier: 2 } }],
};
