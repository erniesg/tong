import type { SceneModule } from '../../../relationship/types';

/**
 * Day 1 · 오리엔테이션 (3pm). Everyone converges: the rules, the first monthly
 * eval, the self-introduction, each origin's expectation, and the agency still
 * talking about Su-a leaving (who left and when, never why or where: tbc T10).
 * Ends by sending you to your locker (H0). The formation drill is day 2.
 */
export const module: SceneModule = {
  scene: {
    id: 'seoul.d1.orientation',
    kind: 'story',
    title: { ko: '오리엔테이션', en: 'Orientation' },
    characterId: 'manager_choi',
    location: 'practice_studio',
    slot: 'd1.s4',
    gate: { flags: ['d1_arrival_seen'], month: { from: 1, to: 1 } },
    summary:
      'Manager Choi: phones after 9pm, no social media, no dating, curfew 11; the first monthly eval is at the end of this month. Self-introduction (sentence builder: formal blocks, casual decoys). Origin beat. Overheard: Su-a really left. Then: your locker.',
    seeds: ['intro_formal / intro_casual', 'hangul:입니다', 'heard_sua_left', 'orientation_done'],
    beats: [
      {
        id: 'o_rules',
        speaker: 'manager_choi',
        lines: [{ value: { ko: '휴대폰은 저녁 9시 이후에만. SNS 금지. 연애 금지. 통금은 11시.', en: 'Phones after 9pm only. No social media. No dating. Curfew is eleven.', review: 'native' } }],
        tong: { ko: '금지 = 안 돼!', en: '금지 (geumji) = banned. 통금 = curfew.', maxLevel: 3 },
        effects: { vocab: [{ ko: '금지', en: 'banned', rom: 'geumji' }] },
        next: 'o_eval',
      },
      {
        id: 'o_eval',
        speaker: 'manager_choi',
        lines: [{ value: { ko: '첫 월말평가는 이번 달 말이에요. 곡은 곧 알려 줄게요.', en: 'The first monthly eval is at the end of this month. You\'ll get the song soon.', review: 'native' } }],
        tong: { ko: '월말평가 = 달 끝 평가!', en: '월말평가 = end-of-month evaluation. You take it when you\'re ready; there\'s no countdown.', maxLevel: 3 },
        effects: { vocab: [{ ko: '월말평가', en: 'monthly evaluation', rom: 'wolmal pyeongga' }] },
        next: 'o_call',
      },
      {
        id: 'o_call',
        speaker: 'manager_choi',
        lines: [{ value: { ko: '자, 한 명씩 자기소개.', en: 'Right. Introduce yourselves, one at a time.', review: 'native' } }],
        next: 'o_intro',
      },
      {
        id: 'o_intro',
        speaker: 'tong',
        lines: [
          {
            value: {
              ko: '입니다는 존댓말이야.',
              en: 'Formal, like on the train. That ending, 입니다, is everywhere when people are being formal. 니 is ㄴ, an "n", with the ㅣ you know. 다 is ㄷ, a "d", with ㅏ, an "ah".',
              review: 'native',
            },
          },
        ],
        exercise: {
          type: 'sentence_builder',
          objectiveId: 'ko-gram-imnida',
          targets: ['안녕하세요.', '저는 {name}입니다.', '잘 부탁드립니다.'],
          distractors: ['나는 {name}이야.', '잘 부탁해.'],
          framing: { ko: '자기소개를 만들어 봐.', en: 'Build your introduction.' },
          onFail: 'continue',
        },
        effects: { setFlags: ['hangul:입니다'], vocab: [{ ko: '자기소개', en: 'self-introduction', rom: 'jagisogae' }] },
        next: 'o_intro_ok',
      },
      {
        id: 'o_intro_ok',
        speaker: 'narration',
        when: { flags: ['ex_o_intro'] },
        lines: [{ value: { ko: '짝짝짝.', en: 'The polite clap. Bo-ram nods once.' } }],
        effects: { setFlags: ['intro_formal'] },
        next: 'o_intro_pick',
      },
      // Only when the exercise was closed or unavailable.
      {
        id: 'o_intro_pick',
        speaker: 'narration',
        when: { flags: ['ex_o_intro_skipped'], notFlags: ['intro_formal'] },
        lines: [{ value: { ko: '…', en: 'Your turn. Everyone is looking at you.' } }],
        choices: [
          {
            id: 'o_say_formal',
            intent: 'commit',
            say: { ko: '안녕하세요. 저는 {name}입니다. 잘 부탁드립니다.', en: 'Hello. I\'m {name}. Please look after me.', rom: 'annyeonghaseyo. jeoneun {name}imnida. jal butakdeurimnida' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '짝짝짝.', en: 'The polite clap. Bo-ram nods once.' }, setFlags: ['intro_formal'] }],
          },
          {
            id: 'o_say_casual',
            intent: 'commit',
            say: { ko: '안녕! 나는 {name}이야. 잘 부탁해.', en: 'Hi! I\'m {name}. Look after me.', rom: 'annyeong! naneun {name}iya. jal butakae' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '…', en: 'The room goes quiet. Yun-seo smiles.' }, setFlags: ['intro_casual'] }],
          },
        ],
        next: 'o_intro_mixed',
      },
      {
        id: 'o_intro_mixed',
        speaker: 'narration',
        when: { notFlags: ['intro_formal', 'intro_casual'] },
        lines: [{ value: { ko: '…', en: 'Half formal, half casual. The room goes quiet. Yun-seo smiles.' } }],
        effects: { setFlags: ['intro_casual'] },
        next: 'o_parents',
      },

      /* ── Each origin's expectation ───────────── */
      {
        id: 'o_parents',
        speaker: 'manager_choi',
        when: { flags: ['origin_intl_kid'] },
        lines: [{ value: { ko: '아, 그리고 {name} 씨 부모님께서 연락 주셨어요. 잘 부탁한다고.', en: 'Oh, and {name}\'s parents got in touch. They asked us to take good care of you.', note: 'The room goes quiet. Yun-seo tilts her head.', review: 'native' } }],
        next: 'o_photo',
      },
      {
        id: 'o_photo',
        speaker: 'manager_choi',
        when: { flags: ['origin_creator', 'pr_photo'] },
        lines: [{ value: { ko: '공항 사진 봤어요. 오늘부터 그런 거 없어요.', en: 'I saw the airport photo. From today, none of that.', review: 'native' } }],
        next: 'o_subscribers',
      },
      {
        id: 'o_subscribers',
        speaker: 'manager_choi',
        when: { flags: ['origin_creator'], notFlags: ['pr_photo'] },
        lines: [{ value: { ko: '구독자 많다면서요? 여기선 0명이에요.', en: 'I hear you\'ve got a lot of subscribers. In here, you\'ve got zero.', review: 'native' } }],
        next: 'o_front_row',
      },
      {
        id: 'o_front_row',
        speaker: 'coach_park',
        when: { flags: ['origin_athlete'] },
        lines: [{ value: { ko: '운동했어요? 체력은 좋겠네. 내일 앞줄.', en: 'You played sport? Stamina should be good, then. Front row, tomorrow.', note: 'He sizes you up from the door.', review: 'native' } }],
        next: 'o_overheard',
      },

      /* ── Ambient: Su-a left ───────────────────── */
      {
        id: 'o_overheard',
        speaker: 'minji',
        lines: [{ value: { ko: '수아 진짜 나갔대. 짐도 다 뺐대.', en: 'Su-a really left. She cleared out all her stuff.', note: 'Behind you, while the forms go round.', review: 'native' } }],
        effects: { setFlags: ['heard_sua_left'] },
        next: 'o_overheard_yerin',
      },
      {
        id: 'o_overheard_yerin',
        speaker: 'yerin',
        lines: [{ value: { ko: '그치? 평가 전에….', en: 'Right? Right before the eval…', review: 'native' } }],
        next: 'o_overheard_boram',
      },
      {
        id: 'o_overheard_boram',
        speaker: 'boram',
        lines: [{ value: { ko: '됐고. 연습해.', en: 'Enough. Practise.', review: 'native' } }],
        next: 'o_locker',
      },
      {
        id: 'o_locker',
        speaker: 'manager_choi',
        lines: [{ value: { ko: '사물함은 연습실 뒤쪽이에요. 가 봐요.', en: 'Your locker\'s at the back of the studio. Go and have a look.', review: 'native' } }],
        tong: { ko: '사물함 = 락커!', en: '사물함 (samulham) = locker.', maxLevel: 3 },
        effects: { setFlags: ['orientation_done'], vocab: [{ ko: '사물함', en: 'locker', rom: 'samulham' }] },
        end: true,
      },
    ],
  },
  presets: [
    { id: 'd1o_formal', label: 'Formal introduction, no origin', state: { day: 1 }, world: { hour: 15, playerLevel: 1, inputTier: 1, flags: { d1_arrival_seen: true } } },
    { id: 'd1o_mixed_intl', label: 'International-School Kid; mixes in casual blocks', state: { day: 1 }, world: { hour: 15, playerLevel: 0, inputTier: 1, flags: { d1_arrival_seen: true, origin_intl_kid: true } }, exercises: { o_intro: false } },
    { id: 'd1o_creator', label: 'Creator with the airport photo out', state: { day: 1 }, world: { hour: 15, playerLevel: 1, inputTier: 1, flags: { d1_arrival_seen: true, origin_creator: true, pr_photo: true } } },
    { id: 'd1o_athlete', label: 'Athlete: front row tomorrow', state: { day: 1 }, world: { hour: 15, playerLevel: 1, inputTier: 1, flags: { d1_arrival_seen: true, origin_athlete: true } } },
  ],
};
