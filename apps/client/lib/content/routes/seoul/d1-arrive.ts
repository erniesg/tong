import type { SceneModule } from '../../../relationship/types';

/**
 * Day 1 · 도착 at Onsae. Each arrival time shows one thing the others don't:
 * early, Haeun alone (still behind the wall: her real introduction is H1);
 * on time, the cohort; late, Bo-ram covers for you.
 */
export const module: SceneModule = {
  scene: {
    id: 'seoul.d1.arrive',
    kind: 'story',
    title: { ko: '온새', en: 'Onsae' },
    characterId: 'haeun',
    location: 'practice_studio',
    slot: 'd1.s3',
    gate: { flags: ['d1_arrived_hongdae'], month: { from: 1, to: 1 } },
    summary:
      'Early (2:25): Haeun alone, drilling a turn; "…누구세요?", "실장님 3시에 오세요.", music back on. Step out (trust) or stay and watch; the Creator can raise the phone (trust down). On time (2:58): the cohort. Minji asks Yerin "쟤가 새로 온 애야?" out loud, Yun-seo\'s over-polite 고생 많으셨죠, Da-on waves. Late (3:20): Manager Choi in the corridor; Bo-ram says she gave you the wrong directions.',
    seeds: ['gave_haeun_space', 'filmed_haeun_d1', 'minji_talked_back', 'boram_ally', 'd1_arrival_seen'],
    beats: [
      /* ── Early ───────────────────────────────── */
      {
        id: 'r_early',
        speaker: 'narration',
        when: { flags: ['d1_early'] },
        lines: [
          {
            value: {
              ko: '연습실 B, 오후 2시 25분.',
              en: 'Practice Room B, 2:25. A girl runs the same eight counts, misses the turn on seven, restarts. On the third try she sees you in the mirror and stops the music.',
            },
          },
        ],
        next: 'r_early_who',
      },
      {
        id: 'r_early_who',
        speaker: 'haeun_unnamed',
        expr: 'cool',
        when: { flags: ['d1_early'] },
        lines: [{ value: { ko: '…누구세요?', en: '…Who are you?', review: 'native' } }],
        choices: [
          {
            id: 'r_hi',
            intent: 'commit',
            say: { ko: '안녕하세요. 오늘부터 들어온 연습생이에요.', en: 'Hi. I\'m the trainee starting today.', rom: 'annyeonghaseyo. oneulbuteo deureoon yeonseupsaengieyo' },
            outcomes: [{ speaker: 'haeun_unnamed', expr: 'cool', reaction: { ko: '아… 네.', en: 'Oh… right.' } }],
          },
          {
            id: 'r_formal',
            intent: 'commit',
            say: { ko: '처음 뵙겠습니다.', en: 'Pleased to meet you. (very formal)', rom: 'cheoeum boepgetseumnida' },
            outcomes: [{ speaker: 'haeun_unnamed', expr: 'cool', reaction: { ko: '네.', en: 'Right.', note: 'A perfect, polite nod.' } }],
          },
          {
            id: 'r_english',
            intent: 'ask',
            say: { ko: 'Sorry, um, English?', en: 'Sorry, um, English?' },
            outcomes: [{ speaker: 'haeun_unnamed', expr: 'cool', reaction: { ko: '…Hi.', en: '…Hi.' }, deltas: { tension: 3 } }],
          },
        ],
        next: 'r_early_three',
      },
      {
        id: 'r_early_three',
        speaker: 'haeun_unnamed',
        expr: 'neutral',
        when: { flags: ['d1_early'] },
        lines: [{ value: { ko: '실장님 3시에 오세요.', en: 'The manager\'s coming at three.', note: 'She turns the music back on and runs the eight counts again.', review: 'native' } }],
        choices: [
          {
            id: 'r_step_out',
            intent: 'presence',
            say: { ko: '(복도에서 기다린다)', en: 'Step out and wait in the corridor.' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '…', en: 'Through the door, the music starts and stops, starts and stops.' }, deltas: { trust: 2 }, setFlags: ['gave_haeun_space'] }],
          },
          {
            id: 'r_watch',
            intent: 'presence',
            say: { ko: '(벽 옆에 앉아서 본다)', en: 'Sit by the wall and watch.' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '…', en: 'She lands the turn this time. She doesn\'t look at you.' }, setFlags: ['watched_haeun_d1'] }],
          },
          {
            id: 'r_film',
            intent: 'commit',
            gate: { flags: ['origin_creator'] },
            say: { ko: '(휴대폰을 든다)', en: '[Creator] Raise your phone.' },
            outcomes: [{ speaker: 'haeun_unnamed', expr: 'cool', reaction: { ko: '…', en: 'She sees the phone in the mirror and stops. She waits until you put it down.' }, deltas: { trust: -4 }, setFlags: ['filmed_haeun_d1'] }],
          },
        ],
        next: 'r_ontime',
      },

      /* ── On time ─────────────────────────────── */
      {
        id: 'r_ontime',
        speaker: 'narration',
        when: { flags: ['d1_ontime'] },
        lines: [{ value: { ko: '오후 2시 58분.', en: '2:58. The practice room is full. Trainees sit stretching on the floor.' } }],
        next: 'r_minji',
      },
      {
        id: 'r_minji',
        speaker: 'minji',
        when: { flags: ['d1_ontime'] },
        lines: [
          { when: { flags: ['pr_photo'] }, value: { ko: '아, 공항 사진 걔네.', en: 'Oh, it\'s the one from the airport photo.', note: 'To Yerin. Not quietly.', review: 'native' } },
          { value: { ko: '쟤가 새로 온 애야?', en: 'Is that the new one?', note: 'To Yerin. Not quietly.', review: 'native' } },
        ],
        next: 'r_yerin',
      },
      {
        id: 'r_yerin',
        speaker: 'yerin',
        when: { flags: ['d1_ontime'] },
        lines: [{ value: { ko: '그치?', en: 'Right?' } }],
        next: 'r_yunseo',
      },
      {
        id: 'r_yunseo',
        speaker: 'yunseo',
        when: { flags: ['d1_ontime'] },
        lines: [{ value: { ko: '멀리서 오느라 고생 많으셨죠.', en: 'It must have been hard, coming all this way.', note: 'With a smile.', review: 'native' } }],
        next: 'r_room',
      },
      {
        id: 'r_room',
        speaker: 'narration',
        when: { flags: ['d1_ontime'] },
        lines: [{ value: { ko: '…', en: 'Da-on gives you a small wave. A girl by the mirror glances once and goes back to stretching.' } }],
        choices: [
          {
            id: 'r_room_hi',
            intent: 'commit',
            say: { ko: '안녕하세요. 잘 부탁드려요.', en: 'Hi. Looking forward to working with you all.', rom: 'annyeonghaseyo. jal butakdeuryeoyo' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '…', en: 'A few nods. Da-on nods twice.' } }],
          },
          {
            id: 'r_room_back',
            intent: 'challenge',
            say: { ko: '네, 제가 새로 온 애예요.', en: 'Yep, I\'m the new one.', rom: 'ne, jega saero on aeyeyo' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '…', en: 'Minji\'s eyebrows go up. Da-on tries not to laugh.' }, setFlags: ['minji_talked_back'] }],
          },
          {
            id: 'r_room_quiet',
            intent: 'presence',
            say: { ko: '(말없이 앉는다)', en: 'Say nothing and sit down.' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '…', en: 'You find a spot by the wall.' } }],
          },
        ],
        next: 'r_late',
      },

      /* ── Late ────────────────────────────────── */
      {
        id: 'r_late',
        speaker: 'narration',
        when: { flags: ['d1_late'] },
        lines: [{ value: { ko: '오후 3시 20분.', en: '3:20. The door is shut, music playing. Manager Choi is in the corridor.' } }],
        next: 'r_late_choi',
      },
      {
        id: 'r_late_choi',
        speaker: 'manager_choi',
        when: { flags: ['d1_late'] },
        lines: [{ value: { ko: '3시 20분. 첫날부터?', en: '3:20. On your first day?', review: 'native' } }],
        next: 'r_late_boram',
      },
      {
        id: 'r_late_boram',
        speaker: 'boram',
        when: { flags: ['d1_late'] },
        lines: [{ value: { ko: '실장님, 제가 길을 잘못 알려줬어요.', en: 'Manager Choi, I gave the new one the wrong directions.', note: 'She slipped out of the room. She never gave you any directions.', review: 'native' } }],
        next: 'r_late_in',
      },
      {
        id: 'r_late_in',
        speaker: 'manager_choi',
        when: { flags: ['d1_late'] },
        lines: [{ value: { ko: '…들어가.', en: '…Go in.', note: 'She looks at both of you first.' } }],
        next: 'r_late_hall',
      },
      {
        id: 'r_late_hall',
        speaker: 'boram',
        when: { flags: ['d1_late'] },
        lines: [{ value: { ko: '첫날엔 다 그래.', en: 'Day one\'s always like that.', review: 'native' } }],
        choices: [
          {
            id: 'r_late_thanks',
            intent: 'commit',
            say: { ko: '고마워요.', en: 'Thanks.', rom: 'gomawoyo' },
            outcomes: [{ speaker: 'boram', reaction: { ko: '됐고. 들어가.', en: 'Never mind that. In you go.' }, setFlags: ['boram_ally'] }],
          },
          {
            id: 'r_late_why',
            intent: 'ask',
            say: { ko: '왜 도와줬어요?', en: 'Why did you help me?', rom: 'wae dowajwosseoyo?' },
            outcomes: [{ speaker: 'boram', reaction: { ko: '그냥.', en: 'Just because.' }, setFlags: ['boram_ally'] }],
          },
        ],
        next: 'r_three',
      },
      {
        id: 'r_three',
        speaker: 'narration',
        lines: [
          { when: { flags: ['d1_late'] }, value: { ko: '…', en: 'You walk in halfway through the rules. Manager Choi doesn\'t stop.' } },
          { value: { ko: '오후 3시.', en: 'Three o\'clock. Manager Choi comes in with a clipboard and claps once.' } },
        ],
        effects: { setFlags: ['d1_arrival_seen'] },
        end: true,
      },
    ],
  },
  presets: [
    { id: 'd1r_early_space', label: 'Early: Haeun alone; step out', state: { day: 1 }, world: { hour: 14, playerLevel: 1, inputTier: 1, flags: { d1_arrived_hongdae: true, d1_early: true } }, path: ['r_hi', 'r_step_out'] },
    { id: 'd1r_early_film', label: 'Early, Creator: raise the phone', state: { day: 1 }, world: { hour: 14, playerLevel: 1, inputTier: 1, flags: { d1_arrived_hongdae: true, d1_early: true, origin_creator: true } }, path: ['r_english', 'r_film'] },
    { id: 'd1r_ontime', label: 'On time: the cohort; talk back to Minji', state: { day: 1 }, world: { hour: 15, playerLevel: 1, inputTier: 1, flags: { d1_arrived_hongdae: true, d1_ontime: true, pr_photo: true } }, path: ['r_room_back'] },
    { id: 'd1r_late', label: 'Late: Bo-ram covers', state: { day: 1 }, world: { hour: 15, playerLevel: 0, inputTier: 1, flags: { d1_arrived_hongdae: true, d1_late: true } }, path: ['r_late_why'] },
  ],
};
