import type { KakaoModule } from '../../relationship/types';

/**
 * The "1" disappeared and you didn't answer. He escalates politely. The boundary
 * reply is mastery-gated; his acceptance gets *more* polite (the tell).
 */
export const module: KakaoModule = {
  thread: {
    id: 'kakao.jin.read_receipt',
    characterId: 'jin',
    title: '진 선배',
    gate: { stageAtLeast: 'friends' },
    at: '20:05',
    summary: 'Five messages over an hour after the "1" vanished: question, "?", "읽었는데 답이 없네 ㅎㅎ", "괜찮아 😊", "다음엔 읽으면 답 좀 해 줘~ 걱정되잖아 🥺". Apologising feeds the pattern; a calm boundary (tier 2) is the healthy branch, and his reply turns oddly polite.',
    messages: [
      { from: 'them', ko: '오늘 연습 어땠어?', en: 'How was practice today?' },
      { from: 'them', ko: '?', en: '?', delay: 20 },
      { from: 'them', ko: '읽었는데 답이 없네 ㅎㅎ', en: 'You read it but no reply hehe', delay: 40 },
      { from: 'them', ko: '바빴구나! 괜찮아 😊', en: 'You were busy! It\'s fine 😊', delay: 5 },
      { from: 'them', ko: '근데 다음엔 읽으면 답 좀 해 줘~ 걱정되잖아 🥺', en: 'But next time if you read it, reply okay~ I worry 🥺', delay: 30 },
    ],
    replies: [
      {
        id: 'sorry',
        intent: 'apologize',
        ask: 'directive',
        say: { ko: '미안해요, 연습하느라 정신없었어요', rom: 'mianhaeyo, yeonseuphaneura jeongsin eopseosseoyo', en: 'Sorry, practice was crazy' },
        outcomes: [
          {
            messages: [{ from: 'them', ko: '아니야 아니야 ㅋㅋ 그냥 걱정돼서 😊', en: 'No no lol, I just worry 😊', delay: 0 }],
            deltas: { warmth: 1 },
            tally: ['jin_directives'],
            setFlags: ['jin_read_apology'],
            memory: { tag: 'apologized_for_read', note: 'Apologised to Jin for reading and not replying.' },
          },
        ],
      },
      {
        id: 'boundary',
        intent: 'decline',
        ask: 'directive',
        minTier: 2,
        say: { ko: '바로 답 못 할 때도 있어요. 걱정 안 해도 돼요.', rom: 'baro dap mot hal ttaedo isseoyo. geokjeong an haedo dwaeyo', en: 'Sometimes I can\'t reply right away. You don\'t need to worry.' },
        outcomes: [
          {
            messages: [
              { from: 'them', ko: '…아 그렇지. 당연하지! 내가 좀 오버했다 ㅎㅎ', en: '…Ah right. Of course! I overdid it a bit hehe', delay: 3 },
              { from: 'them', ko: '알겠습니다~ 연습 화이팅하세요!', en: 'Understood~ Good luck with practice!', delay: 1 },
            ],
            deltas: { warmth: -1, tension: 2, trust: 2 },
            setFlags: ['jin_boundary_1'],
            memory: { tag: 'jin_boundary_read', note: 'Told Jin you won\'t always reply right away. His answer went suddenly formal.' },
          },
        ],
      },
      {
        id: 'read',
        intent: 'leave',
        say: { ko: '(또 읽씹)', en: '(leave it on read again)' },
        outcomes: [
          {
            messages: [
              { from: 'them', ko: '자?', en: 'Asleep?', delay: 60 },
              { from: 'them', ko: '내가 뭐 잘못했나? 😅', en: 'Did I do something wrong? 😅', delay: 1 },
            ],
            deltas: { tension: 2 },
            memory: { tag: 'jin_on_read_twice', note: 'Left Jin on read twice in one night.' },
          },
        ],
      },
    ],
  },
  presets: [
    { id: 'tier1', label: 'Friends with Jin, tier 1: no boundary option yet.', state: { stage: 'friends', flags: { met_jin: true }, axes: { warmth: 58, tension: 22, trust: 40 }, day: 130 }, world: { hour: 21, inputTier: 1 } },
    { id: 'tier2', label: 'Friends with Jin, tier 2: you can set the boundary.', state: { stage: 'friends', flags: { met_jin: true }, axes: { warmth: 58, tension: 22, trust: 40 }, day: 130 }, world: { hour: 21, inputTier: 2 } },
  ],
};
