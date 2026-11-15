import type { SceneModule } from '../../../relationship/types';

/**
 * Day 1 · 연습실 B (Ha-eun first; docs/seoul-first-day.md). You came straight up
 * from the station, so practice hasn't let out: Coach Park is counting Room A
 * through something fast, and one trainee is alone in Room B with the turn she
 * keeps missing. She is still behind the wall (canon/haeun.ts speech rules):
 * flawless 존댓말, never your name, never a question about you. Her name stays
 * for H1. The contrast is the hook: the last thing you hear is her in 반말 with
 * someone else.
 */
export const module: SceneModule = {
  scene: {
    id: 'haeun.d1.room_b',
    kind: 'story',
    title: { ko: '연습실 B', en: 'Practice Room B' },
    characterId: 'haeun',
    location: 'practice_studio',
    slot: 'd1.s3',
    gate: { flags: ['d1_arrived_hongdae', 'd1_early'], notFlags: ['d1_arrival_seen'], month: { from: 1, to: 1 } },
    summary:
      'Early, 4:35. Coach Park\'s count through Room A\'s door. Room B ajar: a girl alone, no music, missing the turn on seven. "…누구세요?" Perfectly polite; she never asks your name. Watch, wait outside, or count her in (다섯, 여섯, 일곱, 여덟): on your count she lands it. Origins: the Creator can ask to film (no) or just raise the phone; the International-School Kid offers a drink; a 붕어빵 can be offered. Practice lets out; Da-on calls her and she answers in 반말, laughing. Then the wall again: "가시죠."',
    seeds: ['met_haeun_d1', 'gave_haeun_space', 'watched_haeun_d1', 'counted_haeun_in', 'filmed_haeun_d1', 'asked_to_film_d1', 'offered_haeun_drink', 'offered_bungeoppang', 'asked_haeun_name_d1', 'd1_arrival_seen'],
    beats: [
      {
        id: 'hb_open',
        speaker: 'narration',
        cue: 'stage:early',
        lines: [{ value: { ko: '2층, 오후 4시 35분.', en: 'Second floor, 4:35. Behind the door marked A, a man is counting a room through something fast.' } }],
        next: 'hb_count',
      },
      {
        id: 'hb_count',
        speaker: 'coach_park',
        lines: [{ value: { ko: '다섯, 여섯, 일곱, 여덟! 다시!', en: 'Five, six, seven, eight! Again!', note: 'Through the door.', review: 'native' } }],
        tong: { ko: '다섯 여섯 일곱 여덟!', en: '다섯 (daseot) 5 · 여섯 (yeoseot) 6 · 일곱 (ilgop) 7 · 여덟 (yeodeol) 8. 다시 = again.', maxLevel: 6 },
        effects: { vocab: [{ ko: '다섯, 여섯, 일곱, 여덟', en: 'five, six, seven, eight', rom: 'daseot, yeoseot, ilgop, yeodeol' }, { ko: '다시', en: 'again', rom: 'dasi' }] },
        next: 'hb_b',
      },
      {
        id: 'hb_b',
        speaker: 'narration',
        cue: 'stage:haeun_drill',
        lines: [
          {
            value: {
              ko: '연습실 B.',
              en: 'Room B\'s door is open a hand. One girl, no music, running eight counts under her breath. She misses the turn on seven. Starts again. Misses it. On the third try she sees you in the mirror.',
            },
          },
        ],
        next: 'hb_who',
      },
      {
        id: 'hb_who',
        speaker: 'haeun_unnamed',
        expr: 'cool',
        cue: 'stage:haeun_stop',
        lines: [{ value: { ko: '…누구세요?', en: '…Who are you?', review: 'native' } }],
        choices: [
          {
            id: 'hb_hi',
            intent: 'commit',
            say: { ko: '안녕하세요. 오늘부터 연습생이에요.', en: 'Hello. I\'m a trainee, from today.', rom: 'annyeonghaseyo. oneulbuteo yeonseupsaengieyo' },
            outcomes: [{ speaker: 'haeun_unnamed', expr: 'cool', reaction: { ko: '아… 네.', en: 'Oh… right.' }, vocab: [{ ko: '연습생', en: 'trainee', rom: 'yeonseupsaeng' }] }],
          },
          {
            id: 'hb_formal',
            intent: 'commit',
            say: { ko: '처음 뵙겠습니다.', en: 'Pleased to meet you. (very formal)', rom: 'cheoeum boepgetseumnida' },
            outcomes: [{ speaker: 'haeun_unnamed', expr: 'cool', reaction: { ko: '네.', en: 'Right.', note: 'A perfect, polite nod.' } }],
          },
          {
            id: 'hb_english',
            intent: 'ask',
            say: { ko: 'Sorry, um, English?', en: 'Sorry, um, English?' },
            outcomes: [{ speaker: 'haeun_unnamed', expr: 'cool', reaction: { ko: '…Hi.', en: '…Hi.' }, deltas: { tension: 3 } }],
          },
        ],
        next: 'hb_new',
      },
      {
        id: 'hb_new',
        speaker: 'haeun_unnamed',
        expr: 'smile',
        lines: [
          {
            value: {
              ko: '아, 새로 오신 분. 실장님은 5시에 오세요. 여기서 기다리셔도 돼요.',
              en: 'Ah, the new person. The manager comes at five. You\'re welcome to wait here.',
              note: 'A perfect smile. She hasn\'t asked your name.',
              review: 'native',
            },
          },
        ],
        tong: { ko: '전부 존댓말.', en: 'She kept every word of that 존댓말, polite speech.', maxLevel: 6 },
        effects: { vocab: [{ ko: '존댓말', en: 'polite speech', rom: 'jondaenmal' }] },
        next: 'hb_drill',
      },

      /* ── The turn on seven ───────────────────────── */
      {
        id: 'hb_drill',
        speaker: 'narration',
        cue: 'stage:haeun_drill',
        lines: [{ value: { ko: '다섯, 여섯—', en: 'She goes back to the mirror. Five, six. The turn on seven goes again.' } }],
        choices: [
          {
            id: 'hb_count_offer',
            intent: 'help',
            say: { ko: '세 드릴까요?', en: 'Shall I count for you?', rom: 'se deurilkkayo?' },
            outcomes: [{ speaker: 'haeun_unnamed', expr: 'cool', reaction: { ko: '…네?', en: '…Sorry?', note: 'She doesn\'t say no.' }, next: 'hb_count_in' }],
          },
          {
            id: 'hb_watch',
            intent: 'presence',
            say: { ko: '(벽에 기대앉아 본다)', en: 'Sit against the wall and watch.' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '…', en: 'The fourth time, she lands it. She doesn\'t look at you. She knows you saw.' }, setFlags: ['watched_haeun_d1'] }],
          },
          {
            id: 'hb_step_out',
            intent: 'presence',
            say: { ko: '(복도에서 기다린다)', en: 'Step out and wait in the corridor.' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '…', en: 'Through the door: start, stop. Start, stop. Then, once, all eight.' }, deltas: { trust: 2 }, setFlags: ['gave_haeun_space'], next: 'hb_let_out' }],
          },
          {
            id: 'hb_ask_film',
            intent: 'ask',
            gate: { flags: ['origin_creator'] },
            say: { ko: '찍어도 돼요?', en: '[Creator] "Can I film this?"', rom: 'jjigeodo dwaeyo?' },
            outcomes: [{ speaker: 'haeun_unnamed', expr: 'smile', reaction: { ko: '…아니요.', en: '…No.', note: 'Still smiling. She waits until the phone is back in your pocket.', review: 'native' }, deltas: { trust: 1 }, setFlags: ['asked_to_film_d1'] }],
          },
          {
            id: 'hb_film',
            intent: 'commit',
            gate: { flags: ['origin_creator'] },
            say: { ko: '(휴대폰을 든다)', en: '[Creator] Raise your phone.' },
            outcomes: [{ speaker: 'haeun_unnamed', expr: 'cool', reaction: { ko: '…', en: 'She sees the phone in the mirror and stops. She waits until you put it down.' }, deltas: { trust: -4 }, setFlags: ['filmed_haeun_d1'] }],
          },
          {
            id: 'hb_drink',
            intent: 'help',
            gate: { flags: ['origin_intl_kid'] },
            say: { ko: '음료수 사 올까요?', en: '[International-School Kid] "Shall I get you a drink?"', rom: 'eumnyosu sa olkkayo?' },
            outcomes: [{ speaker: 'haeun_unnamed', expr: 'smile', reaction: { ko: '괜찮아요.', en: 'I\'m fine.', note: 'Smiling. There is a full water bottle by her foot.', review: 'native' }, deltas: { tension: 1 }, setFlags: ['offered_haeun_drink'] }],
          },
        ],
        next: 'hb_water',
      },
      {
        id: 'hb_count_in',
        speaker: 'tong',
        lines: [{ value: { ko: '아까 들었잖아. 다섯부터.', en: 'You heard it through the door. From five.', review: 'native' } }],
        exercise: {
          type: 'say_it',
          objectiveId: 'ko-vocab-numbers-native',
          targets: ['다섯', '여섯', '일곱', '여덟'],
          distractors: ['하나'],
          framing: { ko: '박자를 세 줘.', en: 'Count her in: five, six, seven, eight.' },
          onFail: 'assist',
        },
        next: 'hb_count_ok',
      },
      {
        id: 'hb_count_ok',
        speaker: 'narration',
        when: { flags: ['ex_hb_count_in'] },
        lines: [
          { when: { flags: ['origin_athlete'] }, value: { ko: '…여덟.', en: 'You count like someone who has been counted at. She goes on your eight, and this time the turn lands.' } },
          { value: { ko: '…여덟.', en: 'She goes on your eight. This time the turn lands.' } },
        ],
        effects: { deltas: { trust: 2 }, setFlags: ['counted_haeun_in'], memory: { tag: 'counted_haeun_in', note: 'On day one you counted her in and she landed the turn on seven.' } },
        next: 'hb_count_thanks',
      },
      {
        id: 'hb_count_thanks',
        speaker: 'haeun_unnamed',
        expr: 'neutral',
        when: { flags: ['ex_hb_count_in'] },
        lines: [{ value: { ko: '…감사합니다.', en: '…Thank you.', note: 'To the mirror.' } }],
        next: 'hb_count_miss',
      },
      {
        id: 'hb_count_miss',
        speaker: 'haeun_unnamed',
        expr: 'smile',
        when: { notFlags: ['ex_hb_count_in'] },
        lines: [{ value: { ko: '여섯 다음은 일곱이에요.', en: 'After six comes seven.', note: 'No smile for a second. Then the smile.', review: 'native' } }],
        effects: { deltas: { tension: 2 } },
        next: 'hb_water',
      },

      /* ── Water ───────────────────────────────────── */
      {
        id: 'hb_water',
        speaker: 'narration',
        lines: [{ value: { ko: '…', en: 'She stops for water. The label on the bottle faces away from you.' } }],
        choices: [
          {
            id: 'hb_name',
            intent: 'ask',
            say: { ko: '이름이 뭐예요?', en: 'What\'s your name?', rom: 'ireumi mwoyeyo?' },
            outcomes: [{ speaker: 'haeun_unnamed', expr: 'smile', reaction: { ko: '곧 다 만나실 거예요.', en: 'You\'ll meet everyone soon.', note: 'The smile. It isn\'t an answer.', review: 'native' }, setFlags: ['asked_haeun_name_d1'] }],
          },
          {
            id: 'hb_bread',
            intent: 'help',
            gate: { flags: ['has_bungeoppang'] },
            say: { ko: '하나 드세요.', en: 'Hold out the bungeoppang: "Have one."', rom: 'hana deuseyo' },
            outcomes: [{ speaker: 'haeun_unnamed', expr: 'cool', reaction: { ko: '…괜찮아요.', en: '…I\'m fine.', note: 'Her eyes go to the bag and come back.', review: 'native' }, setFlags: ['offered_bungeoppang'] }],
          },
          {
            id: 'hb_quiet',
            intent: 'presence',
            say: { ko: '(가만히 있는다)', en: 'Say nothing.' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '…', en: 'She drinks. Neither of you fills the quiet. She seems to prefer it.' }, deltas: { trust: 1 } }],
          },
        ],
        next: 'hb_let_out',
      },

      /* ── Practice lets out: the other voice ──────── */
      {
        id: 'hb_let_out',
        speaker: 'narration',
        cue: 'stage:cohort_out',
        lines: [{ value: { ko: '쾅.', en: 'Room A bangs open. The corridor fills with voices and wet towels.' } }],
        next: 'hb_daon',
      },
      {
        id: 'hb_daon',
        speaker: 'daon',
        expr: 'laugh',
        lines: [{ value: { ko: '언니! 실장님 오셨어요!', en: 'Eonni! The manager\'s here!', note: 'A head round the door, then gone.', review: 'native' } }],
        next: 'hb_banmal',
      },
      {
        id: 'hb_banmal',
        speaker: 'haeun_unnamed',
        expr: 'laugh',
        lines: [{ value: { ko: '어, 갈게!', en: 'Yeah, coming!', note: 'Two words, no endings, and a laugh you haven\'t heard yet.', review: 'native' } }],
        tong: { ko: '방금은 반말.', en: 'That was 반말, casual speech. With you it was 존댓말 the whole time.', maxLevel: 6 },
        effects: { vocab: [{ ko: '반말', en: 'casual speech', rom: 'banmal' }] },
        next: 'hb_end',
      },
      {
        id: 'hb_end',
        speaker: 'haeun_unnamed',
        expr: 'smile',
        cue: 'stage:orientation',
        lines: [{ value: { ko: '가시죠.', en: 'Shall we.', note: 'The wall is back up before she reaches the door.', review: 'native' } }],
        effects: { setFlags: ['met_haeun_d1', 'd1_arrival_seen'] },
        end: true,
      },
    ],
  },
  presets: [
    { id: 'hb_count', label: 'Counts her in; she lands the turn', state: { day: 1 }, world: { hour: 16, playerLevel: 0, inputTier: 1, flags: { d1_arrived_hongdae: true, d1_early: true } }, path: ['hb_hi', 'hb_count_offer', 'hb_quiet'] },
    { id: 'hb_count_miss', label: 'Counts wrong; "after six comes seven"; asks her name', state: { day: 1 }, world: { hour: 16, playerLevel: 0, inputTier: 1, flags: { d1_arrived_hongdae: true, d1_early: true } }, path: ['hb_english', 'hb_count_offer', 'hb_name'], exercises: false },
    { id: 'hb_space', label: 'Steps out and gives her the room', state: { day: 1 }, world: { hour: 16, playerLevel: 1, inputTier: 1, flags: { d1_arrived_hongdae: true, d1_early: true } }, path: ['hb_formal', 'hb_step_out'] },
    { id: 'hb_creator_film', label: 'Creator: raises the phone; offers the 붕어빵', state: { day: 1 }, world: { hour: 16, playerLevel: 1, inputTier: 1, flags: { d1_arrived_hongdae: true, d1_early: true, origin_creator: true, has_bungeoppang: true } }, path: ['hb_hi', 'hb_film', 'hb_bread'] },
    { id: 'hb_intl', label: 'International-School Kid: offers a drink', state: { day: 1 }, world: { hour: 16, playerLevel: 0, inputTier: 1, flags: { d1_arrived_hongdae: true, d1_early: true, origin_intl_kid: true } }, path: ['hb_hi', 'hb_drink', 'hb_quiet'] },
  ],
};
