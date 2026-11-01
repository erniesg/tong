import type { SceneModule } from '../../../relationship/types';

/**
 * H0 · 숙소 (the dorm, evening of day one). Manager Choi offers you the free bed
 * in Haeun's room; Haeun, perfectly polite, steers you to the youngest's room
 * instead. Sua's bed stays empty (canon/world.ts rules; tbc T17).
 */
export const module: SceneModule = {
  scene: {
    id: 'haeun.h0.dorm',
    kind: 'story',
    title: { ko: '숙소', en: 'The dorm' },
    characterId: 'haeun',
    location: 'dorm',
    slot: 'm1.s0b',
    gate: { month: { from: 1, to: 1 }, flags: ['h0_done'] },
    summary:
      'Manager Choi shows you the girls\' dorm and offers the free bed in Haeun\'s room. Haeun, smiling, says Da-on has been asking for an 언니 in her room. You room with Da-on (15) and Bo-ram (22). Sua\'s bed stays empty.',
    seeds: ['dorm_arrived', 'offered_suas_bed', 'memory: haeun_sent_you_to_daon'],
    beats: [
      {
        id: 'd0_open',
        speaker: 'narration',
        lines: [
          {
            value: {
              ko: '연남동. 숙소.',
              en: 'Yeonnam-dong, evening. The dorm door opens on a mountain of shoes. A whiteboard by the door: a schedule, a chore rota, eight names and a gap where one was wiped off.',
            },
          },
        ],
        tong: { ko: '숙소 = 기숙사, 연습생 집!', en: '숙소 (suk-so) = lodgings. For trainees: the dorm.', maxLevel: 2 },
        effects: { vocab: [{ ko: '숙소', en: 'dorm, lodgings', rom: 'sukso' }] },
        next: 'd0_choi_rules',
      },
      {
        id: 'd0_choi_rules',
        speaker: 'manager_choi',
        expr: 'neutral',
        lines: [
          {
            value: {
              ko: '신발은 여기 벗어요. 통금은 열한 시. 열한 시에 제가 방마다 확인해요.',
              en: 'Shoes off here. Curfew is eleven. At eleven I check every room.',
              review: 'native',
            },
          },
        ],
        tong: { ko: '통금 = 통행금지, curfew!', en: '통금 (tong-geum) = curfew. 열한 시 = eleven o\'clock.', maxLevel: 2 },
        effects: { vocab: [{ ko: '통금', en: 'curfew', rom: 'tonggeum' }] },
        next: 'd0_room_a',
      },
      {
        id: 'd0_room_a',
        speaker: 'manager_choi',
        expr: 'neutral',
        lines: [
          {
            value: {
              ko: '이 방에 침대 하나 비었어요. 여기 쓰면 되겠다.',
              en: 'There\'s a free bed in this room. You can take this one.',
              note: 'A single bed by the window, stripped to the mattress. A strip of tape on the frame where a name label was.',
              review: 'native',
            },
          },
        ],
        effects: { setFlags: ['offered_suas_bed'] },
        next: 'd0_haeun',
      },
      {
        id: 'd0_haeun',
        speaker: 'haeun',
        expr: 'cool',
        lines: [
          {
            value: {
              ko: '아, 실장님. 다온이 방에도 자리 있지 않아요? 다온이가 언니 오면 좋겠다고 계속 그랬는데.',
              en: 'Oh, Manager Choi. Isn\'t there a bed in Da-on\'s room too? Da-on keeps saying she wants an 언니 in her room.',
              note: 'From the bottom bunk, headphones round her neck, a perfect smile. She says it to Manager Choi, not to you.',
              review: 'native',
            },
          },
        ],
        tong: { ko: '언니 = 여자가 부르는 언니!', en: '언니 (eonni) = what a girl calls an older girl. Da-on will call you that.', maxLevel: 2 },
        choices: [
          {
            id: 'd0_accept',
            intent: 'defer',
            say: { ko: '네, 좋아요.', en: 'Sure, that\'s fine.', rom: 'ne, joayo' },
            outcomes: [
              {
                speaker: 'haeun',
                expr: 'cool',
                reaction: { ko: '네~', en: 'Great~', note: 'The headphones go back on.' },
                memory: { tag: 'haeun_sent_you_to_daon', note: 'On day one Haeun politely sent you to Da-on\'s room; you went.' },
              },
            ],
          },
          {
            id: 'd0_push',
            intent: 'challenge',
            minTier: 1,
            say: { ko: '저는 여기도 괜찮아요.', en: 'I\'m fine here too.', rom: 'jeoneun yeogido gwaenchanayo' },
            outcomes: [
              {
                speaker: 'haeun',
                expr: 'smirk',
                reaction: {
                  ko: '다온이 방이 더 넓어요. 창문도 있고요.',
                  en: 'Da-on\'s room is bigger. It has a window, too.',
                  note: 'This room has a window. Manager Choi is already walking.',
                  review: 'native',
                },
                deltas: { tension: 3 },
                memory: { tag: 'haeun_sent_you_to_daon', note: 'On day one you said you were fine in her room; she sent you to Da-on\'s anyway.' },
              },
            ],
          },
          {
            id: 'd0_look',
            intent: 'presence',
            say: { ko: '(빈 침대를 본다)', en: 'Look at the empty bed a moment longer.' },
            outcomes: [
              {
                speaker: 'narration',
                reaction: { ko: '…', en: 'Nobody has put anything on it. Not a bag, not a towel. In a dorm this full, that takes effort.' },
                memory: { tag: 'noticed_empty_bed', note: 'Noticed nobody uses the empty bed in Haeun\'s room.' },
              },
            ],
          },
        ],
        next: 'd0_daon',
      },
      {
        id: 'd0_daon',
        speaker: 'daon',
        expr: 'laugh',
        lines: [
          {
            value: {
              ko: '언니! 저 다온이에요! 위에 침대는 제 거예요. 언니는 아래 써요!',
              en: 'Eonni! I\'m Da-on! The top bunk is mine. You get the bottom!',
              note: 'She has a school uniform on a hanger and a poster of a girl group above her pillow.',
              review: 'native',
            },
          },
        ],
        next: 'd0_boram',
      },
      {
        id: 'd0_boram',
        speaker: 'boram',
        expr: 'neutral',
        lines: [
          {
            value: {
              ko: '난 보람. 화장실은 하나야. 아침엔 줄 서. 다온이 학교 가니까 다온이 먼저.',
              en: 'I\'m Bo-ram. One bathroom. In the morning you queue. Da-on has school, so she goes first.',
              note: 'From the single bed by the window, folding laundry.',
              review: 'native',
            },
          },
        ],
        tong: { ko: '반말이야!', en: 'Bo-ram uses 반말 with you straight away. She\'s the oldest, so that\'s normal here.', maxLevel: 2 },
        next: 'd0_bed',
      },
      {
        id: 'd0_bed',
        speaker: 'narration',
        lines: [
          {
            value: {
              ko: '네 침대.',
              en: 'Your bed: the bottom bunk. Da-on\'s feet swing over the edge above you. Down the hall, a door clicks shut.',
            },
          },
        ],
        tong: { ko: '자면 다음 날이야.', en: 'This is your bed. Sleep here to end the day.', maxLevel: 6 },
        effects: { setFlags: ['dorm_arrived'] },
        end: true,
      },
    ],
  },
  presets: [
    {
      id: 'd0_tier0',
      label: 'Tier 0: goes where Haeun suggests',
      state: { day: 1, flags: { h0_done: true } },
      world: { playerLevel: 0, inputTier: 0, hour: 20, weather: 'clear' },
      path: ['d0_accept'],
    },
    {
      id: 'd0_tier1_push',
      label: 'Tier 1: says she is fine in Haeun\'s room; Haeun deflects',
      state: { day: 1, flags: { h0_done: true } },
      world: { playerLevel: 1, inputTier: 1, hour: 20, weather: 'clear' },
      path: ['d0_push'],
    },
    {
      id: 'd0_look',
      label: 'Looks at the empty bed',
      state: { day: 1, flags: { h0_done: true } },
      world: { playerLevel: 1, inputTier: 1, hour: 20, weather: 'clear' },
      path: ['d0_look'],
    },
  ],
};
