import type { KakaoModule } from '../../relationship/types';

/** Jin texts the same night he paid at the pojangmacha. Fast, warm, emoji. */
export const module: KakaoModule = {
  thread: {
    id: 'kakao.jin.first',
    characterId: 'jin',
    title: '진 선배',
    gate: { flags: ['met_jin'], stage: ['strangers', 'acquaintances'] },
    at: '23:10',
    summary: 'First text from Jin after onboarding. Offering to pay next time gets a charming no: "선배가 사는 거야. 알지?" — the first time he decides for you, logged.',
    messages: [
      { from: 'them', ko: '오늘 떡볶이 맛있었지? 😆', en: 'The tteokbokki was good tonight, right? 😆' },
      { from: 'them', ko: '아 나 진이야! 포장마차 ㅋㅋ', en: 'Oh it\'s Jin! From the pojangmacha lol', delay: 0 },
      { from: 'them', ko: '번호 저장해 둬 📱', en: 'Save my number 📱', delay: 0 },
    ],
    replies: [
      {
        id: 'thanks',
        intent: 'commit',
        say: { ko: '네! 잘 먹었어요. 감사합니다!', rom: 'ne! jal meogeosseoyo. gamsahamnida!', en: 'Yes! Thanks for the meal!' },
        outcomes: [
          {
            messages: [{ from: 'them', ko: '에이 감사는 무슨 ㅋㅋ 다음엔 더 맛있는 데 가자 👍', en: 'Aw, no need to thank me lol. Next time let\'s go somewhere even better 👍', delay: 1 }],
            deltas: { warmth: 2 },
          },
        ],
      },
      {
        id: 'my_turn',
        intent: 'decline',
        say: { ko: '다음엔 제가 살게요!', rom: 'daeumen jega salgeyo!', en: 'Next time it\'s on me!' },
        outcomes: [
          {
            messages: [{ from: 'them', ko: 'ㅋㅋ 안 돼~ 선배가 사는 거야. 알지? 😉', en: 'lol nope~ the senior pays. You know that, right? 😉', delay: 1 }],
            deltas: { warmth: 2, tension: 1 },
            setFlags: ['jin_overrode_you'],
            memory: { tag: 'jin_insisted_pay', note: 'Offered to pay next time; Jin said the senior pays, "알지?"' },
          },
        ],
      },
      {
        id: 'read',
        intent: 'leave',
        say: { ko: '(읽씹)', en: '(leave it on read)' },
        outcomes: [{ messages: [{ from: 'them', ko: '자나 보다 ㅎㅎ 잘 자~ 🌙', en: 'Must be asleep hehe. Night~ 🌙', delay: 40 }] }],
      },
    ],
  },
  presets: [{ id: 'after-j0', label: 'Night of the pojangmacha onboarding.', state: { stage: 'strangers', flags: { met_jin: true }, day: 2 }, world: { hour: 23 } }],
};
