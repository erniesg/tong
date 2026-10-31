import type { KakaoModule } from '../../relationship/types';

/** "뭐 먹을래?" — then he decides before you answer. Tag question presumes agreement. */
export const module: KakaoModule = {
  thread: {
    id: 'kakao.jin.dinner',
    characterId: 'jin',
    title: '진 선배',
    gate: { stageAtLeast: 'friends' },
    at: '18:20',
    summary: 'Jin asks what you want for dinner, then decides himself and says he\'ll pick you up at 7. Deferring feels great and is logged; saying you have practice gets a second try; naming what you want gets overridden with "그치?".',
    messages: [
      { from: 'them', ko: '오늘 저녁 뭐 먹을래?', en: 'What do you want for dinner tonight?' },
      { from: 'them', ko: '아 아니다 내가 정할게 ㅋㅋ', en: 'Ah no wait, I\'ll pick lol', delay: 0 },
      { from: 'them', ko: '삼겹살 콜? 7시에 데리러 갈게 🚗', en: 'Samgyeopsal? I\'ll pick you up at 7 🚗', delay: 0 },
    ],
    replies: [
      {
        id: 'sure',
        intent: 'defer',
        say: { ko: '좋아요!', rom: 'joayo!', en: 'Sounds good!' },
        outcomes: [
          {
            messages: [{ from: 'them', ko: '역시 말이 통한다니까 😆', en: 'See, we just get each other 😆', delay: 0 }],
            deltas: { warmth: 2 },
            setFlags: ['jin_decided_2'],
            memory: { tag: 'let_jin_decide', note: 'Let Jin decide dinner and the pickup without being asked.' },
          },
        ],
      },
      {
        id: 'practice',
        intent: 'decline',
        say: { ko: '오늘은 연습 있어서 안 돼요', rom: 'oneureun yeonseup isseoseo an dwaeyo', en: 'I can\'t tonight, I have practice' },
        outcomes: [
          {
            messages: [
              { from: 'them', ko: '아 그래? ㅠㅠ', en: 'Oh really? ㅠㅠ', delay: 1 },
              { from: 'them', ko: '그럼 연습 끝나고 9시는? 잠깐만 보자 🙏', en: 'Then 9, after practice? Just for a bit 🙏', delay: 1 },
            ],
            deltas: { tension: 1 },
            setFlags: ['jin_second_try'],
          },
        ],
      },
      {
        id: 'my_pick',
        intent: 'challenge',
        say: { ko: '저는 떡볶이 먹고 싶은데요?', rom: 'jeoneun tteokbokki meokgo sipeundeyo?', en: 'I kind of want tteokbokki though?' },
        outcomes: [
          {
            messages: [{ from: 'them', ko: 'ㅋㅋ 떡볶이는 저번에 먹었잖아~ 삼겹살 먹자, 그치?', en: 'lol we had tteokbokki last time~ let\'s do samgyeopsal, yeah?', delay: 1 }],
            deltas: { tension: 1 },
            memory: { tag: 'jin_overrode_choice', note: 'Said what you wanted; Jin overrode it with "그치?".' },
          },
        ],
      },
    ],
  },
  presets: [{ id: 'friend', label: 'Friends with Jin, early evening.', state: { stage: 'friends', flags: { met_jin: true }, axes: { warmth: 55, tension: 20, trust: 40 }, day: 120 }, world: { hour: 18 } }],
};
