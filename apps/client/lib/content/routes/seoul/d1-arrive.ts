import type { SceneModule } from '../../../relationship/types';

/**
 * Day 1 · 2층 복도 (Onsae's second-floor corridor), for players who met Jin at
 * the tent first (docs/seoul-first-day.md). On time, practice lets out past you
 * in twos and Ha-eun is one glance; late, Bo-ram covers for you. Coming straight
 * up from the station plays haeun.d1.room_b instead.
 */
export const module: SceneModule = {
  scene: {
    id: 'seoul.d1.arrive',
    kind: 'story',
    title: { ko: '온새', en: 'Onsae' },
    characterId: 'haeun',
    location: 'practice_studio',
    slot: 'd1.s3',
    gate: { flags: ['d1_arrived_hongdae'], notFlags: ['d1_early', 'd1_arrival_seen'], month: { from: 1, to: 1 } },
    summary:
      'On time (4:58): Room A lets out into the corridor. Minji asks Yerin "쟤가 새로 온 애야?" out loud, Yun-seo\'s over-polite 고생 많으셨죠, Da-on waves; a girl comes out of Room B alone, glances once. Late (5:20): Manager Choi in the corridor; Bo-ram says she gave you the wrong directions.',
    seeds: ['minji_talked_back', 'boram_ally', 'd1_arrival_seen'],
    beats: [
      /* ── On time ─────────────────────────────── */
      {
        id: 'r_ontime',
        speaker: 'narration',
        cue: 'stage:cohort_out',
        when: { flags: ['d1_ontime'] },
        lines: [{ value: { ko: '2층, 오후 4시 58분.', en: 'Second floor, 4:58. The door marked A bangs open and practice lets out past you, towels round necks.' } }],
        next: 'r_minji',
      },
      {
        id: 'r_minji',
        speaker: 'minji',
        when: { flags: ['d1_ontime'] },
        lines: [
          { when: { flags: ['pr_photo'] }, value: { ko: '아, 아까 그 사진 걔네.', en: 'Oh, it\'s the one from that photo.', note: 'To Yerin, on their way past. Not quietly.', review: 'native' } },
          { value: { ko: '쟤가 새로 온 애야?', en: 'Is that the new one?', note: 'To Yerin, on their way past. Not quietly.', review: 'native' } },
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
        lines: [{ value: { ko: '멀리서 오느라 고생 많으셨죠.', en: 'It must have been hard, coming all this way.', note: 'With a smile. She holds the door for you.', review: 'native' } }],
        next: 'r_room',
      },
      {
        id: 'r_room',
        speaker: 'narration',
        when: { flags: ['d1_ontime'] },
        lines: [{ value: { ko: '…', en: 'The youngest gives you a small wave from behind a water bottle. Out of Room B a girl comes alone, headphones on. She glances at you once and goes past.' } }],
        choices: [
          {
            id: 'r_room_hi',
            intent: 'commit',
            say: { ko: '안녕하세요. 잘 부탁드려요.', en: 'Hi. Looking forward to working with you all.', rom: 'annyeonghaseyo. jal butakdeuryeoyo' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '…', en: 'A few nods. The youngest nods twice.' } }],
          },
          {
            id: 'r_room_back',
            intent: 'challenge',
            say: { ko: '네, 제가 새로 온 애예요.', en: 'Yep, I\'m the new one.', rom: 'ne, jega saero on aeyeyo' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '…', en: 'Minji\'s eyebrows go up. The youngest tries not to laugh.' }, setFlags: ['minji_talked_back'] }],
          },
          {
            id: 'r_room_quiet',
            intent: 'presence',
            say: { ko: '(말없이 비켜선다)', en: 'Say nothing and step aside.' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '…', en: 'They flow round you and your suitcase.' } }],
          },
        ],
        next: 'r_late',
      },

      /* ── Late ────────────────────────────────── */
      {
        id: 'r_late',
        speaker: 'narration',
        cue: 'stage:late',
        when: { flags: ['d1_late'] },
        lines: [{ value: { ko: '2층, 오후 5시 20분.', en: 'Second floor, 5:20. Room A\'s door is shut. Manager Choi is in the corridor with a clipboard.' } }],
        next: 'r_late_choi',
      },
      {
        id: 'r_late_choi',
        speaker: 'manager_choi',
        when: { flags: ['d1_late'] },
        lines: [{ value: { ko: '5시 20분. 첫날부터?', en: '5:20. On your first day?', review: 'native' } }],
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
        lines: [{ value: { ko: '…들어가요.', en: '…Go in.', note: 'She looks at both of you first.' } }],
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
        cue: 'stage:orientation',
        lines: [
          { when: { flags: ['d1_late'] }, value: { ko: '…', en: 'You walk in halfway through the rules. Manager Choi doesn\'t stop.' } },
          { value: { ko: '오후 5시.', en: 'Five o\'clock. Manager Choi comes up the stairs with a clipboard and claps once. Everyone files back into Room A.' } },
        ],
        effects: { setFlags: ['d1_arrival_seen'] },
        end: true,
      },
    ],
  },
  presets: [
    { id: 'd1r_ontime', label: 'On time: the cohort; talk back to Minji', state: { day: 1 }, world: { hour: 17, playerLevel: 1, inputTier: 1, flags: { d1_arrived_hongdae: true, d1_ontime: true, pr_photo: true } }, path: ['r_room_back'] },
    { id: 'd1r_late', label: 'Late: Bo-ram covers', state: { day: 1 }, world: { hour: 17, playerLevel: 0, inputTier: 1, flags: { d1_arrived_hongdae: true, d1_late: true } }, path: ['r_late_why'] },
  ],
};
