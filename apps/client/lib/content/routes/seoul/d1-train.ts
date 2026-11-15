import type { SceneModule } from '../../../relationship/types';

/**
 * Day 1 · 공항철도 (the airport train, 4:20pm; docs/seoul-first-day.md). The game
 * opens seated on a full car a minute from Hongdae. Tong appears, the grandmother
 * beside you offers a tangerine (your first Korean to a person), Manager Choi
 * texts the 5pm deadline, the message from your old life lands, the stop is called.
 * The first two blocks, 아 and 이, come out of her 아이고.
 */
export const module: SceneModule = {
  scene: {
    id: 'seoul.d1.train',
    kind: 'story',
    title: { ko: '공항철도', en: 'The airport train' },
    characterId: 'tong',
    location: 'arex_train',
    slot: 'd1.s1',
    gate: { month: { from: 1, to: 1 } },
    summary:
      'Seated on the airport train, 4:20pm. Tong appears (only you can see it). The grandmother beside you: who are you talking to? Have a tangerine. Build 아, then pick 이 by ear (her 아이고). Manager Choi: the company by five. A message by origin. The stop is called: Hongdae.',
    seeds: ['d1_started', 'tong_backstory_asked (Tong: "Long story. Another time.")', 'hangul:아', 'hangul:이', 'took_gyul', 'd1_arrived_hongdae'],
    beats: [
      {
        id: 't_open',
        speaker: 'narration',
        cue: 'ride',
        lines: [{ value: { ko: '공항철도, 오후 4시 20분.', en: 'The airport train into Seoul, 4:20pm. Your suitcase is wedged between your knees. One wheel already wobbles.' } }],
        effects: { setFlags: ['d1_started'] },
        next: 't_tong',
      },
      {
        id: 't_tong',
        speaker: 'tong',
        lines: [{ value: { ko: '안녕. 여기, 위에. 나는 통이야.', en: 'Hi. Up here. I\'m Tong.', review: 'native' } }],
        next: 't_tong_seen',
      },
      {
        id: 't_tong_seen',
        speaker: 'tong',
        lines: [{ value: { ko: '다른 사람들 눈엔 내가 안 보여. 그러니까 손 흔들지 마.', en: 'Nobody else can see me, so maybe don\'t wave back.', review: 'native' } }],
        choices: [
          {
            id: 't_what',
            intent: 'ask',
            say: { ko: '넌 뭐야?', en: 'What are you?', rom: 'neon mwoya?' },
            outcomes: [{ speaker: 'tong', reaction: { ko: '주로 네 한국어 도우미. 막히면 내가 있어.', en: 'Your Korean help, mostly. When you\'re stuck, I\'m here.', review: 'native' } }],
          },
          {
            id: 't_why',
            intent: 'ask',
            say: { ko: '왜 나한테만 보여?', en: 'Why can only I see you?', rom: 'wae nahanteman boyeo?' },
            outcomes: [{ speaker: 'tong', reaction: { ko: '얘기가 길어. 다음에.', en: 'Long story. Another time.', review: 'native' }, setFlags: ['tong_backstory_asked'] }],
          },
          {
            id: 't_go',
            intent: 'commit',
            say: { ko: '알았어.', en: 'Okay.', rom: 'arasseo' },
            outcomes: [{ speaker: 'tong', reaction: { ko: '좋아.', en: 'Good.' } }],
          },
        ],
        next: 't_halmoni',
      },

      /* ── The grandmother: first Korean to a person ── */
      {
        id: 't_halmoni',
        speaker: 'halmoni',
        cue: 'stage:halmoni',
        lines: [{ value: { ko: '학생, 누구랑 얘기해?', en: 'Who are you talking to, dear?', note: 'The grandmother beside you. A bag of tangerines on her lap.', review: 'native' } }],
        choices: [
          {
            id: 't_hello',
            intent: 'commit',
            say: { ko: '안녕하세요.', en: 'Hello.', rom: 'annyeonghaseyo' },
            outcomes: [{ speaker: 'halmoni', reaction: { ko: '아이고, 한국말 하네!', en: 'Aigo, you speak Korean!', review: 'native' }, vocab: [{ ko: '안녕하세요', en: 'hello', rom: 'annyeonghaseyo' }] }],
          },
          {
            id: 't_smile',
            intent: 'presence',
            say: { ko: '(웃는다)', en: 'Just smile.' },
            outcomes: [{ speaker: 'halmoni', reaction: { ko: '아이고, 수줍기는.', en: 'Aigo, a shy one.', review: 'native' } }],
          },
          {
            id: 't_english',
            intent: 'ask',
            say: { ko: 'Sorry, no Korean…', en: 'Sorry, no Korean…' },
            outcomes: [{ speaker: 'halmoni', reaction: { ko: '아이고, 외국 사람이네.', en: 'Aigo. From abroad.', review: 'native' } }],
          },
        ],
        next: 't_gyul',
      },
      {
        id: 't_gyul',
        speaker: 'halmoni',
        lines: [{ value: { ko: '귤 먹어. 하나 먹어.', en: 'Have a tangerine. Go on, one.', note: 'She is already holding it out.', review: 'native' } }],
        tong: { ko: '귤 = 감귤!', en: '귤 (gyul) = tangerine. 하나 (hana) = one.', maxLevel: 3 },
        choices: [
          {
            id: 't_thanks',
            intent: 'commit',
            say: { ko: '감사합니다.', en: 'Thank you.', rom: 'gamsahamnida' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '…', en: 'She puts two in your hand.' }, setFlags: ['took_gyul'], vocab: [{ ko: '감사합니다', en: 'thank you', rom: 'gamsahamnida' }] }],
          },
          {
            id: 't_fine',
            intent: 'decline',
            say: { ko: '괜찮아요.', en: 'I\'m fine, thank you.', rom: 'gwaenchanayo' },
            outcomes: [{ speaker: 'halmoni', reaction: { ko: '아이고, 먹어, 먹어.', en: 'Aigo, eat, eat.', note: 'She puts two in your hand anyway.', review: 'native' }, setFlags: ['took_gyul'], vocab: [{ ko: '괜찮아요', en: 'I\'m fine; it\'s okay', rom: 'gwaenchanayo' }] }],
          },
        ],
        next: 't_aigo',
      },

      /* ── Tong moment: 아 and 이 ───────────────────── */
      {
        id: 't_aigo',
        speaker: 'tong',
        lines: [
          {
            value: {
              ko: '아이고. 오늘 계속 듣게 될 거야.',
              en: '아이고. You\'ll hear that all day. Korean letters stack into blocks, one block a syllable. Her first one is 아: ㅇ, silent at the front, and ㅏ, "a". Build it.',
              review: 'native',
            },
          },
        ],
        exercise: {
          type: 'hangul_compose',
          objectiveId: 'ko-script-blocks-2part',
          targets: ['아'],
          distractors: ['ㅣ', 'ㄱ'],
          framing: { ko: '아를 만들어 봐.', en: 'Build 아.' },
          onFail: 'assist',
        },
        effects: { setFlags: ['hangul:아'] },
        next: 't_i',
      },
      {
        id: 't_i',
        speaker: 'tong',
        lines: [{ value: { ko: '다음은 이.', en: 'Her second block is 이: the same silent ㅇ, with ㅣ, "i". Listen. Which one is it?', review: 'native' } }],
        exercise: {
          type: 'hangul_listen',
          objectiveId: 'ko-script-blocks-2part',
          targets: ['이'],
          distractors: ['아'],
          framing: { ko: '들리는 걸 골라 봐.', en: 'Tap the one you hear.' },
          onFail: 'assist',
        },
        effects: { setFlags: ['hangul:이'] },
        next: 't_buzz',
      },

      /* ── The deadline and your old life ───────────── */
      {
        id: 't_buzz',
        speaker: 'narration',
        cue: 'phone_buzz',
        lines: [{ value: { ko: '휴대폰이 울린다.', en: 'Your phone buzzes. KakaoTalk, from the agency.' } }],
        next: 't_choi',
      },
      {
        id: 't_choi',
        speaker: 'manager_choi',
        lines: [{ value: { ko: '오늘 오후 5시까지 회사로 오세요. 늦지 마세요!', en: 'Come to the company by 5pm today. Don\'t be late!', note: 'KakaoTalk.', review: 'native' } }],
        tong: { ko: '5시 = 다섯 시!', en: '5시 (daseot si) = five o\'clock. 회사 = the company. 늦지 마세요 = don\'t be late.', maxLevel: 3 },
        effects: { vocab: [{ ko: '회사', en: 'company', rom: 'hoesa' }] },
        next: 't_mum',
      },
      // The message from your old life (docs/seoul-origins.md). Written in the sender's language.
      {
        id: 't_mum',
        speaker: 'narration',
        when: { flags: ['origin_intl_kid'] },
        lines: [{ value: { ko: 'Landed? There are taxis right outside the station. Use the card, don\'t drag your bags up a hill. Have fun!!', en: 'Mum, on KakaoTalk.' } }],
        next: 't_teammate',
      },
      {
        id: 't_teammate',
        speaker: 'narration',
        when: { flags: ['origin_athlete'] },
        lines: [{ value: { ko: 'Seoul huh. Don\'t get soft.', en: 'Your old teammate, on KakaoTalk.' } }],
        next: 't_notifs',
      },
      {
        id: 't_notifs',
        speaker: 'narration',
        when: { flags: ['origin_creator'] },
        cue: 'stage:student',
        lines: [{ value: { ko: 'wait are you in KOREA?? · landing vlog when', en: 'Notifications, lots of them. The student across the aisle looks at her phone, then at you, then at her phone.' } }],
        next: 't_stop',
      },

      /* ── The stop ─────────────────────────────────── */
      {
        id: 't_stop',
        speaker: 'narration',
        cue: 'stage:stop',
        lines: [{ value: { ko: '이번 역은 홍대입구, 홍대입구역입니다.', en: 'The announcement. The sign over the door changes.', review: 'native' } }],
        tong: { ko: '여기서 내려!', en: '홍대입구 (hongdae-ipgu) = Hongdae. 이번 역 = this stop. That\'s us.', maxLevel: 6 },
        effects: { vocab: [{ ko: '홍대입구', en: 'Hongik Univ. (station)', rom: 'hongdae-ipgu' }] },
        next: 't_bye',
      },
      {
        id: 't_bye',
        speaker: 'halmoni',
        lines: [{ value: { ko: '여기서 내려? 잘 가, 학생.', en: 'This is you? Off you go, dear.', review: 'native' } }],
        choices: [
          {
            id: 't_bye_thanks',
            intent: 'commit',
            say: { ko: '감사합니다!', en: 'Thank you!', rom: 'gamsahamnida' },
            outcomes: [{ speaker: 'halmoni', reaction: { ko: '그래, 그래.', en: 'Yes, yes.' } }],
          },
          {
            id: 't_bye_formal',
            intent: 'commit',
            say: { ko: '안녕히 계세요.', en: 'Goodbye. (to someone staying)', rom: 'annyeonghi gyeseyo' },
            outcomes: [{ speaker: 'halmoni', reaction: { ko: '아이고, 잘하네!', en: 'Aigo, listen to you!', review: 'native' }, vocab: [{ ko: '안녕히 계세요', en: 'goodbye (to someone staying)', rom: 'annyeonghi gyeseyo' }] }],
          },
        ],
        next: 't_arrive',
      },
      {
        id: 't_arrive',
        speaker: 'narration',
        lines: [{ value: { ko: '홍대입구역, 오후 4시 25분.', en: 'Hongdae, 4:25pm. The doors open on noise.' } }],
        effects: { setFlags: ['d1_arrived_hongdae'] },
        end: true,
      },
    ],
  },
  presets: [
    { id: 'd1t_none', label: 'No origin: hello, thank you, the stop', state: { day: 1 }, world: { hour: 16, playerLevel: 0, inputTier: 1 }, path: ['t_go', 't_hello', 't_thanks', 't_bye_thanks'] },
    { id: 'd1t_intl', label: 'International-School Kid: Mum says take a taxi; no Korean yet', state: { day: 1 }, world: { hour: 16, playerLevel: 0, inputTier: 1, flags: { origin_intl_kid: true } }, path: ['t_why', 't_english', 't_fine', 't_bye_formal'], exercises: false },
    { id: 'd1t_creator', label: 'Creator: the student across the aisle', state: { day: 1 }, world: { hour: 16, playerLevel: 1, inputTier: 1, flags: { origin_creator: true } }, path: ['t_what', 't_smile', 't_thanks', 't_bye_thanks'] },
  ],
};
