import type { KakaoModule } from '../../relationship/types';

/** "어디야? 데리러 갈게." He's already in the car. How he takes no depends on past boundaries. */
export const module: KakaoModule = {
  thread: {
    id: 'kakao.jin.pickup',
    characterId: 'jin',
    title: '진 선배',
    gate: { stageAtLeast: 'close' },
    at: '22:40',
    summary: 'Jin is already driving to pick you up. Saying you\'ll go alone: he pushes ("위험해", "그치?") unless you set a boundary before, in which case he accepts — politely, too politely. Asking how he knew where you were: he passed the store.',
    messages: [
      { from: 'them', ko: '어디야?', en: 'Where are you?' },
      { from: 'them', ko: '데리러 갈게. 위치 보내 줘 📍', en: 'I\'ll come get you. Send your location 📍', delay: 0 },
      { from: 'them', ko: '벌써 차 탔어 ㅋㅋ', en: 'Already in the car lol', delay: 1 },
    ],
    replies: [
      {
        id: 'alone',
        intent: 'decline',
        ask: 'directive',
        say: { ko: '괜찮아요, 혼자 갈 수 있어요', rom: 'gwaenchanayo, honja gal su isseoyo', en: 'It\'s okay, I can get back on my own' },
        outcomes: [
          {
            when: { flags: ['jin_boundary_1'] },
            messages: [{ from: 'them', ko: '…그래요. 도착하면 문자 줘요.', en: '…Alright. Text me when you get in.', delay: 2 }],
            deltas: { trust: 1, tension: 1 },
            setFlags: ['jin_boundary_2'],
          },
          {
            messages: [
              { from: 'them', ko: '에이~ 늦었잖아. 위험해 😟', en: 'Aw come on~ it\'s late. It\'s not safe 😟', delay: 1 },
              { from: 'them', ko: '거의 다 왔어. 그냥 기다려, 그치?', en: 'Almost there. Just wait, yeah?', delay: 1 },
            ],
            deltas: { warmth: -1, tension: 2, trust: 1 },
            memory: { tag: 'jin_came_anyway', note: 'Said you\'d go home alone; Jin kept driving.' },
          },
        ],
      },
      {
        id: 'thanks',
        intent: 'defer',
        ask: 'directive',
        say: { ko: '고마워요!', rom: 'gomawoyo!', en: 'Thank you!' },
        outcomes: [
          {
            messages: [{ from: 'them', ko: '당연하지 😊 5분!', en: 'Of course 😊 5 min!', delay: 0 }],
            deltas: { warmth: 2 },
            tally: ['jin_directives'],
            setFlags: ['jin_ride_home'],
            memory: { tag: 'let_jin_pick_up', note: 'Let Jin pick you up without sending a location; he already knew roughly where.' },
          },
        ],
      },
      {
        id: 'how_know',
        intent: 'ask',
        say: { ko: '근데 제가 밖에 있는 거 어떻게 알았어요?', rom: 'geunde jega bakke inneun geo eotteoke arasseoyo?', en: 'Wait, how did you know I was out?' },
        outcomes: [
          {
            messages: [{ from: 'them', ko: '아까 편의점 앞 지나가다 봤어 ㅋㅋ 손 흔들었는데 못 봤지?', en: 'Drove past the convenience store earlier lol. I waved, you didn\'t see?', delay: 1 }],
            deltas: { tension: 2 },
            setFlags: ['jin_noticed_location'],
          },
        ],
      },
    ],
  },
  presets: [
    { id: 'no-boundary', label: 'Close with Jin, no boundary set before.', state: { stage: 'close', flags: { met_jin: true }, axes: { warmth: 70, tension: 25, trust: 50 }, day: 220 }, world: { hour: 22 }, path: ['alone'] },
    { id: 'after-boundary', label: 'Close with Jin, you set the read-receipt boundary earlier.', state: { stage: 'close', flags: { met_jin: true, jin_boundary_1: true }, axes: { warmth: 65, tension: 35, trust: 55 }, day: 220 }, world: { hour: 22 }, path: ['alone'] },
  ],
};
