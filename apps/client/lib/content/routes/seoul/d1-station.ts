import type { SceneModule } from '../../../relationship/types';

/**
 * Day 1 · 공항철도 (the station decision, 1:25pm). The agency is in Hongdae and only
 * the all-stop (일반) stops at 홍대입구; the express (직통) runs nonstop to Seoul
 * Station, so it is the trap. Each origin also has one shortcut that always gets
 * you there early and adds to the hidden `toll` (docs/seoul-day1.md).
 *
 * Arrival flags: d1_early / d1_ontime / d1_late. Beats that a path skips fall
 * through to their `next`, so the early path is checked first and the rescue
 * beats only play when no arrival flag is set yet.
 */
export const module: SceneModule = {
  scene: {
    id: 'seoul.d1.station',
    kind: 'story',
    title: { ko: '공항철도', en: 'The airport train' },
    characterId: 'tong',
    location: 'arex_station',
    slot: 'd1.s2',
    gate: { flags: ['d1_exit_done'], month: { from: 1, to: 1 } },
    summary:
      'Read the board (block crush 일반: the all-stop that stops at Hongdae) and you are early. Miss it and you are on the express to Seoul Station; ask a stranger the way back (sentence builder): on time, or the airport bus and late. Origin shortcuts: taxi on the family card, a sprint for the boarding train, or a fan who walks you there. Tong moment on the ride in, then rebuild 홍대입구.',
    seeds: ['d1_early / d1_ontime / d1_late', 'tally.toll (origin shortcuts)', 'pr_photo', 'd1_tight_calf', 'hangul:일반', 'hangul:홍대입구'],
    beats: [
      {
        id: 's_open',
        speaker: 'narration',
        lines: [{ value: { ko: '공항철도, 오후 1시 25분.', en: 'The airport railway concourse, 1:25pm. The departure board clicks over.' } }],
        next: 's_where',
      },
      {
        id: 's_where',
        speaker: 'tong',
        lines: [{ value: { ko: '회사는 홍대에 있어. 홍대입구에 서는 기차를 타야 돼.', en: 'The agency\'s in Hongdae. We need the train that stops at 홍대입구.', review: 'native' } }],
        choices: [
          {
            id: 's_read',
            intent: 'commit',
            say: { ko: '(전광판을 읽는다)', en: 'Read the board.' },
            outcomes: [{ speaker: 'tong', reaction: { ko: '좋아, 같이 보자.', en: 'Good. Let\'s read it together.' }, next: 's_board' }],
          },
          {
            id: 's_taxi',
            intent: 'defer',
            gate: { flags: ['origin_intl_kid'] },
            say: { ko: '(가족 카드로 택시를 탄다)', en: '[International-School Kid] Take a taxi on the family card.' },
            outcomes: [
              {
                speaker: 'narration',
                reaction: { ko: '택시 승강장.', en: 'The taxi rank is right outside. The card goes through without a beep.' },
                setFlags: ['d1_taxi', 'd1_early', 'toll_family_card'],
                tally: ['toll'],
                next: 's_taxi_where',
              },
            ],
          },
          {
            id: 's_run',
            intent: 'commit',
            gate: { flags: ['origin_athlete'] },
            say: { ko: '(지금 타는 기차로 뛴다)', en: '[Athlete] Run for the all-stop that\'s boarding now.' },
            outcomes: [
              {
                speaker: 'narration',
                reaction: {
                  ko: '두 층 아래.',
                  en: 'Two levels down, the all-stop is boarding. You take the escalator two steps at a time, suitcase on your shoulder, and make it with a second to spare.',
                },
                setFlags: ['d1_sprint', 'd1_early', 'd1_tight_calf'],
                tally: ['toll'],
                next: 's_splits',
              },
            ],
          },
          {
            id: 's_fan',
            intent: 'ask',
            gate: { flags: ['origin_creator'] },
            say: { ko: '(알아본 팬의 도움을 받는다)', en: '[Creator] A student at the ticket machines has recognised you. Let her help.' },
            outcomes: [
              {
                speaker: 'fan',
                reaction: { ko: '헐… 혹시 {name} 님 맞아요? Oh my god, I watch everything!', en: 'Whoa… are you {name}, by any chance? Oh my god, I watch everything!', review: 'native' },
                setFlags: ['d1_fan', 'd1_early'],
                next: 's_fan_walk',
              },
            ],
          },
        ],
        next: 's_board',
      },

      /* ── Language road ──────────────────────────── */
      {
        id: 's_board',
        speaker: 'narration',
        lines: [{ value: { ko: '직통 · 서울역 · 13:30   일반 · 서울역 · 13:32', en: 'Two rows. The English cycles in every twenty seconds. The first train leaves in five minutes.' } }],
        next: 's_board_read',
      },
      {
        id: 's_board_read',
        speaker: 'tong',
        lines: [
          {
            value: {
              ko: '일은 ㅇ, ㅣ, ㄹ. 일반이 홍대에 서.',
              en: '일: ㅇ, silent at the start of a block, then ㅣ, an "ee", with your ㄹ underneath. 일반 stops everywhere, Hongdae too. 직통 runs straight to Seoul Station and skips us. Rebuild the one we want.',
              review: 'native',
            },
          },
        ],
        exercise: {
          type: 'block_crush',
          objectiveId: 'ko-script-blocks-2part',
          targets: ['일반'],
          distractors: ['ㅈ', 'ㅌ'],
          framing: { ko: '홍대에 서는 기차를 맞춰 봐.', en: 'Rebuild the train that stops at Hongdae.' },
          onFail: 'continue',
        },
        effects: { setFlags: ['hangul:일반'], vocab: [{ ko: '일반', en: 'all-stop (regular) train', rom: 'ilban' }, { ko: '직통', en: 'express (nonstop) train', rom: 'jiktong' }] },
        next: 's_board_ok',
      },
      {
        id: 's_board_ok',
        speaker: 'narration',
        when: { flags: ['ex_s_board_read'] },
        lines: [{ value: { ko: '2번 승강장, 일반.', en: 'Platform 2, the all-stop. The doors close behind you.' } }],
        effects: { setFlags: ['d1_early'] },
        next: 's_pick',
      },
      // Only when the exercise was closed or unavailable: pick the row by its letters.
      {
        id: 's_pick',
        speaker: 'narration',
        when: { flags: ['ex_s_board_read_skipped'], notFlags: ['d1_early'] },
        lines: [{ value: { ko: '어느 기차?', en: 'Which train?' } }],
        choices: [
          {
            id: 's_pick_ilban',
            intent: 'commit',
            say: { ko: '일반 · 13:32', en: 'The 13:32.' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '2번 승강장.', en: 'Platform 2, the all-stop. The doors close behind you.' }, setFlags: ['d1_early'] }],
          },
          {
            id: 's_pick_jiktong',
            intent: 'commit',
            say: { ko: '직통 · 13:30', en: 'The 13:30.' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '1번 승강장.', en: 'Platform 1. It\'s moving before you sit down.' } }],
          },
        ],
        next: 's_express',
      },
      {
        id: 's_express',
        speaker: 'narration',
        cue: 'ride',
        when: { notFlags: ['d1_early'] },
        lines: [{ value: { ko: '직통. 서울역까지 논스톱.', en: 'You\'re on the express, nonstop to Seoul Station. Out of the window, the Hongdae platform goes by without stopping.' } }],
        tong: { ko: '직통 = 바로!', en: '직통 = direct. It doesn\'t stop until the end.', maxLevel: 3 },
        next: 's_seoul_station',
      },
      {
        id: 's_seoul_station',
        speaker: 'narration',
        when: { notFlags: ['d1_early'] },
        lines: [{ value: { ko: '서울역.', en: 'Seoul Station, 2:20. Two stops past Hongdae. A woman with a shopping trolley is waiting by the escalator.' } }],
        next: 's_ask',
      },
      {
        id: 's_ask',
        speaker: 'tong',
        when: { notFlags: ['d1_early'] },
        lines: [{ value: { ko: '물어보자. 실례합니다!', en: 'Ask her. 실례합니다 is "excuse me". You know 홍대.', review: 'native' } }],
        exercise: {
          type: 'sentence_builder',
          objectiveId: 'ko-phrase-directions',
          targets: ['실례합니다.', '홍대', '어떻게', '가요?'],
          distractors: ['버스'],
          framing: { ko: '홍대 가는 길을 물어봐.', en: 'Ask the way to Hongdae.' },
          onFail: 'continue',
        },
        next: 's_ask_ok',
      },
      {
        id: 's_ask_ok',
        speaker: 'stranger',
        when: { flags: ['ex_s_ask'], notFlags: ['d1_early'] },
        lines: [{ value: { ko: '홍대요? 공항철도 다시 타요. 두 정거장! 저기 내려가요.', en: 'Hongdae? Take the airport line back. Two stops! Down there.', review: 'native' } }],
        effects: { setFlags: ['d1_ontime'] },
        next: 's_ask_pick',
      },
      {
        id: 's_ask_pick',
        speaker: 'narration',
        when: { flags: ['ex_s_ask_skipped'], notFlags: ['d1_early', 'd1_ontime'] },
        lines: [{ value: { ko: '…', en: 'She looks up from her phone.' } }],
        choices: [
          {
            id: 's_ask_ko',
            intent: 'ask',
            say: { ko: '실례합니다. 홍대 어떻게 가요?', en: 'Excuse me. How do I get to Hongdae?', rom: 'sillyehamnida. hongdae eotteoke gayo?' },
            outcomes: [
              {
                speaker: 'stranger',
                reaction: { ko: '홍대요? 공항철도 다시 타요. 두 정거장! 저기 내려가요.', en: 'Hongdae? Take the airport line back. Two stops! Down there.', review: 'native' },
                setFlags: ['d1_ontime'],
              },
            ],
          },
          {
            id: 's_ask_en',
            intent: 'ask',
            say: { ko: 'Excuse me… Hongdae?', en: '(In English.)' },
            outcomes: [{ speaker: 'stranger', reaction: { ko: '아, 버스? 버스는 밖이에요!', en: 'Oh, the bus? Buses are outside!', review: 'native' }, setFlags: ['d1_late'] }],
          },
        ],
        next: 's_bus',
      },
      {
        id: 's_bus',
        speaker: 'stranger',
        when: { notFlags: ['d1_early', 'd1_ontime', 'd1_late'] },
        lines: [{ value: { ko: '버스요? 버스는 밖이에요!', en: 'The bus? Buses are outside!', note: 'The words came out in the wrong order; she heard 버스.', review: 'native' } }],
        effects: { setFlags: ['d1_late'] },
        next: 's_bus_ride',
      },
      {
        id: 's_bus_ride',
        speaker: 'narration',
        when: { flags: ['d1_late'] },
        lines: [{ value: { ko: '홍대행 버스.', en: 'The airport bus to Hongdae. Traffic on the bridge. The clock on the screen passes three.' } }],
        next: 's_ride',
      },
      {
        id: 's_ride',
        speaker: 'narration',
        cue: 'ride',
        when: { notFlags: ['d1_taxi', 'd1_late'] },
        lines: [{ value: { ko: '기차 안.', en: 'On the train. Fields, then the river, then the city.' } }],
        next: 's_prep',
      },

      /* ── Tong moment: the ride in ───────────────── */
      {
        id: 's_prep',
        speaker: 'tong',
        lines: [
          { when: { any: [{ flags: ['asked_formal'] }, { flags: ['asked_names'] }, { flags: ['asked_ending'] }] }, value: { ko: '또?', en: 'Anything else?' } },
          { value: { ko: '오늘 자기소개 해야 돼. 같이 볼래?', en: 'You\'ll have to introduce yourself today. Want to go over it?', review: 'native' } },
        ],
        choices: [
          {
            id: 's_q_formal',
            intent: 'ask',
            gate: { notFlags: ['asked_formal'] },
            say: { ko: '얼마나 격식 있게?', en: 'How formal should I be?' },
            outcomes: [
              {
                speaker: 'tong',
                reaction: {
                  ko: '첫날이니까 존댓말. 저는 {name}입니다.',
                  en: 'On a first day, with a manager and trainers in the room, go formal. That\'s the -습니다 endings: 저는 {name}입니다. Nobody gets told off for being too formal on day one.',
                  review: 'native',
                },
                setFlags: ['asked_formal'],
                next: 's_prep',
              },
            ],
          },
          {
            id: 's_q_names',
            intent: 'ask',
            gate: { notFlags: ['asked_names'] },
            say: { ko: '다른 연습생은 뭐라고 불러?', en: 'What do I call the other trainees?' },
            outcomes: [
              {
                speaker: 'tong',
                reaction: {
                  ko: '언니, 아니면 이름에 씨.',
                  en: 'Older girls are 언니 to you. Until you know someone\'s age, use their name with 씨 after it. Koreans sort this out fast. Someone will ask your age today.',
                  review: 'native',
                },
                setFlags: ['asked_names'],
                next: 's_prep',
              },
            ],
          },
          {
            id: 's_q_ending',
            intent: 'ask',
            gate: { notFlags: ['asked_ending'] },
            say: { ko: '끝은 어떻게 해?', en: 'How do I end it?' },
            outcomes: [
              {
                speaker: 'tong',
                reaction: { ko: '잘 부탁드립니다.', en: '잘 부탁드립니다. It\'s close to "please look after me". Everyone says it, and people notice if you don\'t.', review: 'native' },
                setFlags: ['asked_ending'],
                next: 's_prep',
              },
            ],
          },
          {
            id: 's_q_later',
            intent: 'leave',
            say: { ko: '나중에.', en: 'Later.' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '…', en: 'You watch the river go by.' } }],
          },
        ],
        next: 's_stop',
      },
      {
        id: 's_stop',
        speaker: 'narration',
        lines: [
          { when: { flags: ['d1_taxi'] }, value: { ko: '홍대입구역 · 5분', en: 'The driver\'s map: 홍대입구역, five minutes.' } },
          { when: { flags: ['d1_late'] }, value: { ko: '다음 정류장: 홍대입구역', en: 'The bus screen: next stop, 홍대입구역.' } },
          { value: { ko: '이번 역은 홍대입구역입니다.', en: 'The announcement: this stop is 홍대입구. The line map over the door.', review: 'native' } },
        ],
        next: 's_stop_read',
      },
      {
        id: 's_stop_read',
        speaker: 'tong',
        lines: [
          {
            value: {
              ko: '입구는 공항 문에서 봤지?',
              en: 'You know 입구 from the airport doors: entrance. 홍대입구 is "Hongik University entrance". Rebuild it, so you know it when you see it.',
              review: 'native',
            },
          },
        ],
        exercise: {
          type: 'block_crush',
          objectiveId: 'ko-script-blocks-2part',
          targets: ['홍대입구'],
          distractors: ['ㅈ'],
          framing: { ko: '내릴 역을 맞춰 봐.', en: 'Rebuild your stop.' },
          onFail: 'assist',
        },
        effects: { setFlags: ['hangul:홍대입구', 'read_sign_subway'], vocab: [{ ko: '홍대입구', en: 'Hongik Univ. (station)', rom: 'hongdae-ipgu' }] },
        next: 's_arrive',
      },
      {
        id: 's_arrive',
        speaker: 'narration',
        lines: [
          { when: { flags: ['d1_taxi'] }, value: { ko: '홍대, 오후 2시 30분.', en: 'Hongdae, 2:30pm. The driver pulls over on the main road.' } },
          { when: { flags: ['d1_late'] }, value: { ko: '홍대입구역, 오후 3시 12분.', en: 'Hongdae, 3:12pm. You run.' } },
          { when: { flags: ['d1_ontime'] }, value: { ko: '홍대입구역, 오후 2시 50분.', en: 'Hongdae, 2:50pm. Ten minutes.' } },
          { value: { ko: '홍대입구역, 오후 2시 25분.', en: 'Hongdae, 2:25pm. Early.' } },
        ],
        effects: { setFlags: ['d1_arrived_hongdae'] },
        end: true,
      },

      /* ── Shortcut road ──────────────────────────── */
      {
        id: 's_taxi_where',
        speaker: 'driver',
        lines: [{ value: { ko: '어디까지 가세요?', en: 'Where to?', note: 'You show him the address on your phone.', review: 'native' } }],
        next: 's_taxi_chat',
      },
      {
        id: 's_taxi_chat',
        speaker: 'driver',
        lines: [{ value: { ko: '한국어 할 줄 알아요? 학생이에요?', en: 'Do you speak Korean? Are you a student?', review: 'native' } }],
        choices: [
          {
            id: 's_taxi_yes',
            intent: 'defer',
            say: { ko: '네.', en: 'Yes.' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '…', en: 'You say 네 to everything. He happily talks for the whole ride.' } }],
          },
          {
            id: 's_taxi_little',
            intent: 'commit',
            say: { ko: 'Sorry… 조금.', en: 'Sorry… a little.' },
            outcomes: [{ speaker: 'driver', reaction: { ko: '괜찮아요. 천천히.', en: 'That\'s okay. Slowly.', note: 'He points out the river as you cross it.', review: 'native' } }],
          },
        ],
        next: 's_prep',
      },
      {
        id: 's_splits',
        speaker: 'narration',
        lines: [{ value: { ko: 'Splits?', en: 'Your old teammate, on KakaoTalk.' } }],
        next: 's_ride',
      },
      {
        id: 's_fan_walk',
        speaker: 'narration',
        lines: [{ value: { ko: '…', en: 'She walks you to the all-stop, talking the whole way, then stops at the doors.' } }],
        next: 's_fan_photo',
      },
      {
        id: 's_fan_photo',
        speaker: 'fan',
        lines: [{ value: { ko: '사진 같이 찍어도 돼요?', en: 'Can we take a photo together?', review: 'native' } }],
        choices: [
          {
            id: 's_fan_yes',
            intent: 'commit',
            say: { ko: '네, 좋아요.', en: 'Sure.' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '찰칵.', en: 'A selfie. She\'s posting it before the doors close.' }, setFlags: ['pr_photo'], tally: ['toll', 'toll'] }],
          },
          {
            id: 's_fan_no',
            intent: 'decline',
            say: { ko: '죄송해요, 지금은….', en: 'Sorry, not right now…' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '찰칵.', en: 'She takes a blurry one anyway, through the closing doors. She posts it.' }, setFlags: ['pr_photo'], tally: ['toll'] }],
          },
        ],
        next: 's_ride',
      },
    ],
  },
  presets: [
    { id: 'd1s_board', label: 'Reads 일반 on the board: early', state: { day: 1 }, world: { hour: 13, playerLevel: 1, inputTier: 1, flags: { d1_exit_done: true } }, path: ['s_read'] },
    { id: 'd1s_rescue', label: 'Misses the board; asks the way at Seoul Station: on time', state: { day: 1 }, world: { hour: 13, playerLevel: 0, inputTier: 1, flags: { d1_exit_done: true } }, path: ['s_read', 's_q_later'], exercises: { s_board_read: false } },
    { id: 'd1s_late', label: 'Misses the board and the question: the bus, late', state: { day: 1 }, world: { hour: 13, playerLevel: 0, inputTier: 1, flags: { d1_exit_done: true } }, path: ['s_read'], exercises: { s_board_read: false, s_ask: false } },
    { id: 'd1s_taxi', label: 'International-School Kid: taxi on the family card', state: { day: 1 }, world: { hour: 13, playerLevel: 0, inputTier: 1, flags: { d1_exit_done: true, origin_intl_kid: true } }, path: ['s_taxi', 's_taxi_little', 's_q_later'] },
    { id: 'd1s_run', label: 'Athlete: sprints for the all-stop', state: { day: 1 }, world: { hour: 13, playerLevel: 0, inputTier: 1, flags: { d1_exit_done: true, origin_athlete: true } }, path: ['s_run'] },
    { id: 'd1s_fan', label: 'Creator: the fan walks you there, selfie', state: { day: 1 }, world: { hour: 13, playerLevel: 0, inputTier: 1, flags: { d1_exit_done: true, origin_creator: true } }, path: ['s_fan', 's_fan_yes', 's_q_later'] },
  ],
};
