import type { SceneModule } from '../../../relationship/types';

/**
 * Day 1 · 인천공항 (Incheon arrivals, 1:05pm). Tong appears, Manager Choi texts
 * the 3pm deadline, and the origin's second message lands (docs/seoul-day1.md).
 */
export const module: SceneModule = {
  scene: {
    id: 'seoul.d1.airport',
    kind: 'story',
    title: { ko: '도착', en: 'Arrivals' },
    characterId: 'tong',
    location: 'incheon_arrivals',
    slot: 'd1.s1',
    gate: { month: { from: 1, to: 1 } },
    summary:
      'Incheon arrivals, 1:05pm. Tong appears (only you can see it). Manager Choi: come to the company by 3pm. A second message by origin. Tong: find the way out.',
    seeds: ['d1_started', 'tong_backstory_asked (Tong: "Long story. Another time.")'],
    beats: [
      {
        id: 'a_open',
        speaker: 'narration',
        lines: [{ value: { ko: '인천공항, 오후 1시 5분.', en: 'Incheon Airport, 1:05pm. Arrivals. Your suitcase comes round on the belt; one wheel already wobbles.' } }],
        effects: { setFlags: ['d1_started'] },
        next: 'a_tong',
      },
      {
        id: 'a_tong',
        speaker: 'tong',
        lines: [{ value: { ko: '안녕. 여기, 위에. 나는 통이야.', en: 'Hi. Up here. I\'m Tong.', review: 'native' } }],
        next: 'a_tong_seen',
      },
      {
        id: 'a_tong_seen',
        speaker: 'tong',
        lines: [{ value: { ko: '다른 사람들 눈엔 내가 안 보여. 그러니까 손 흔들지 마.', en: 'Nobody else can see me, so maybe don\'t wave back.', review: 'native' } }],
        choices: [
          {
            id: 'a_what',
            intent: 'ask',
            say: { ko: '넌 뭐야?', en: 'What are you?', rom: 'neon mwoya?' },
            outcomes: [{ speaker: 'tong', reaction: { ko: '주로 네 한국어 도우미. 막히면 내가 있어.', en: 'Your Korean help, mostly. When you\'re stuck, I\'m here.', review: 'native' } }],
          },
          {
            id: 'a_why',
            intent: 'ask',
            say: { ko: '왜 나한테만 보여?', en: 'Why can only I see you?', rom: 'wae nahanteman boyeo?' },
            outcomes: [{ speaker: 'tong', reaction: { ko: '얘기가 길어. 다음에.', en: 'Long story. Another time.', review: 'native' }, setFlags: ['tong_backstory_asked'] }],
          },
          {
            id: 'a_go',
            intent: 'commit',
            say: { ko: '알았어. 가자.', en: 'Okay. Let\'s go.', rom: 'arasseo. gaja' },
            outcomes: [{ speaker: 'tong', reaction: { ko: '가자!', en: 'Let\'s go.' } }],
          },
        ],
        next: 'a_buzz',
      },
      {
        id: 'a_buzz',
        speaker: 'narration',
        lines: [{ value: { ko: '휴대폰이 울린다.', en: 'Your phone buzzes. KakaoTalk, from the agency.' } }],
        next: 'a_choi',
      },
      {
        id: 'a_choi',
        speaker: 'manager_choi',
        lines: [{ value: { ko: '오늘 오후 3시까지 회사로 오세요. 늦지 마세요!', en: 'Come to the company by 3pm today. Don\'t be late!', note: 'KakaoTalk.', review: 'native' } }],
        tong: { ko: '3시 = 세 시!', en: '3시 (se si) = three o\'clock. 회사 = the company. 늦지 마세요 = don\'t be late.', maxLevel: 3 },
        effects: { vocab: [{ ko: '회사', en: 'company', rom: 'hoesa' }] },
        next: 'a_mum',
      },
      // The origin's second message (docs/seoul-origins.md). Written in the sender's language.
      {
        id: 'a_mum',
        speaker: 'narration',
        when: { flags: ['origin_intl_kid'] },
        lines: [{ value: { ko: 'Landed? Take a taxi on the card, don\'t drag your bags on the train. Have fun!!', en: 'Mum, on KakaoTalk.' } }],
        next: 'a_teammate',
      },
      {
        id: 'a_teammate',
        speaker: 'narration',
        when: { flags: ['origin_athlete'] },
        lines: [{ value: { ko: 'Seoul huh. Don\'t get soft.', en: 'Your old teammate, on KakaoTalk.' } }],
        next: 'a_notifs',
      },
      {
        id: 'a_notifs',
        speaker: 'narration',
        when: { flags: ['origin_creator'] },
        lines: [{ value: { ko: 'wait are you in KOREA?? · landing vlog when', en: 'Notifications. Lots of them.' } }],
        next: 'a_way_out',
      },
      {
        id: 'a_way_out',
        speaker: 'tong',
        lines: [{ value: { ko: '출구부터 찾자. 표지판 따라가.', en: 'First, the way out. Follow the signs to the doors.', review: 'native' } }],
        end: true,
      },
    ],
  },
  presets: [
    { id: 'd1a_none', label: 'No origin: Tong, the 3pm text, the way out', state: { day: 1 }, world: { hour: 13, playerLevel: 0, inputTier: 1 }, path: ['a_go'] },
    { id: 'd1a_intl', label: 'International-School Kid: Mum says take a taxi', state: { day: 1 }, world: { hour: 13, playerLevel: 0, inputTier: 1, flags: { origin_intl_kid: true } }, path: ['a_why'] },
    { id: 'd1a_creator', label: 'Creator: notifications', state: { day: 1 }, world: { hour: 13, playerLevel: 1, inputTier: 1, flags: { origin_creator: true } }, path: ['a_what'] },
  ],
};
