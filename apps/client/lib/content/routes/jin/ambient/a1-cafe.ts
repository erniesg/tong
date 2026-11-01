import type { SceneModule } from '../../../../relationship/types';

/**
 * JA1 · 카페 봄 — Jin's afternoon off at his regular table. Register follows
 * what you agreed at the pojangmacha. The first visit plants Tong-as-rival:
 * "you don't need the translator with me" is a directive, and agreeing mutes
 * Tong in every Jin scene (flag tong_off_with_jin).
 */
export const module: SceneModule = {
  scene: {
    id: 'jin.a1.cafe',
    kind: 'ambient',
    title: { ko: '카페 봄', en: 'Café Bom' },
    characterId: 'jin',
    location: 'cafe',
    gate: { hours: { from: 8, to: 17 }, flags: ['met_jin'] },
    summary:
      'Jin at his regular table, cap on, script open. Register follows J0 (반말 only if you accepted). First visit: he asks you to put Tong away ("나랑 있을 땐 번역기 필요 없잖아") — agree (counted directive, Tong goes quiet around him), keep Tong kindly, or shut him down. He talks about the shoot (more honest on a low day), passes on that Ha-eun loves spicy food if you\'re paired, and calls the café his 단골.',
    seeds: ['tong_off_with_jin (Tong-as-rival)', 'tip_haeun_spicy', 'being someone else all day (the wound)'],
    beats: [
      {
        id: 'ja1_open',
        speaker: 'jin',
        expr: 'smile',
        lines: [
          { when: { flags: ['jin_banmal_accepted'] }, value: { ko: '어, 왔어? 여기 앉아.', en: 'Oh, you made it? Sit here.' } },
          { value: { ko: '어, 왔어요? 여기 앉아요.', en: 'Oh, you made it? Have a seat.', note: 'He moves his script off the other chair before you can say no.' } },
        ],
        next: 'ja1_rival',
      },
      {
        id: 'ja1_rival',
        speaker: 'jin',
        expr: 'smile',
        when: { notFlags: ['jin_tong_asked'] },
        lines: [
          {
            when: { flags: ['jin_banmal_accepted'] },
            value: { ko: '그 앱 계속 켜 놔? 나랑 있을 땐 번역기 필요 없잖아. 내가 다 알려 줄게.', en: 'You keep that app on? You don\'t need a translator with me. I\'ll teach you everything.', review: 'native' },
          },
          {
            value: { ko: '그 앱 계속 켜 놔요? 저랑 있을 땐 번역기 필요 없잖아요. 제가 다 알려 줄게요.', en: 'You keep that app on? You don\'t need a translator with me. I\'ll teach you everything.', review: 'native' },
          },
        ],
        tong: { ko: '…나 말하는 거야?', en: '…Is he talking about me?', maxLevel: 6 },
        choices: [
          {
            id: 'ja1_tong_off',
            intent: 'defer',
            ask: 'directive',
            say: { ko: '…그래요. 꺼 둘게요.', en: '…Okay. I\'ll switch it off.', rom: 'geuraeyo. kkeo dulgeyo' },
            outcomes: [
              {
                when: { flags: ['jin_banmal_accepted'] },
                speaker: 'jin',
                expr: 'smile',
                reaction: { ko: '잘했어. 모르는 거 있으면 나한테 물어봐.', en: 'Good. Anything you don\'t know, ask me.', note: 'Tong goes quiet whenever he\'s around now. It was easier. That\'s the point.' },
                deltas: { warmth: 3 },
                setFlags: ['jin_tong_asked', 'tong_off_with_jin'],
                tally: ['jin_directives'],
              },
              {
                speaker: 'jin',
                expr: 'smile',
                reaction: { ko: '잘했어요. 모르는 거 있으면 저한테 물어봐요.', en: 'Good. Anything you don\'t know, ask me.', note: 'Tong goes quiet whenever he\'s around now. It was easier. That\'s the point.', review: 'native' },
                deltas: { warmth: 3 },
                setFlags: ['jin_tong_asked', 'tong_off_with_jin'],
                tally: ['jin_directives'],
              },
            ],
          },
          {
            id: 'ja1_tong_kind',
            intent: 'decline',
            ask: 'directive',
            minTier: 1,
            say: { ko: '통은 제 선생님이에요. 진 씨도 같이 알려 주세요.', en: 'Tong\'s my teacher. You can teach me too.', rom: 'tong-eun je seonsaengnimieyo. jin ssido gachi allyeo juseyo' },
            outcomes: [
              {
                speaker: 'jin',
                expr: 'laugh',
                reaction: { ko: '하하, 선생님이 둘이네. 좋아요.', en: 'Haha, two teachers, then. Fine.', note: 'He means it, mostly. He glances at your phone once more before he lets it go.' },
                deltas: { warmth: -1, trust: 2 },
                setFlags: ['jin_tong_asked', 'kept_tong_kindly'],
              },
            ],
          },
          {
            id: 'ja1_tong_cold',
            intent: 'decline',
            ask: 'directive',
            say: { ko: '제가 알아서 할게요.', en: 'I\'ll handle it myself.', rom: 'jega araseo halgeyo' },
            outcomes: [
              {
                speaker: 'jin',
                expr: 'smile',
                reaction: { ko: '…네, 그럼요. 당연하죠.', en: '…Sure, of course. Naturally.', note: 'Suddenly very polite. That\'s his tell.' },
                deltas: { warmth: -3, tension: 2, trust: 1 },
                setFlags: ['jin_tong_asked', 'kept_tong_coldly'],
              },
            ],
          },
        ],
        next: 'ja1_shoot',
      },
      {
        id: 'ja1_shoot',
        speaker: 'jin',
        expr: 'neutral',
        lines: [
          {
            when: { mood: ['raw', 'low'], flags: ['jin_banmal_accepted'] },
            value: { ko: '어제 촬영… 길었어. 하루 종일 다른 사람으로 살았거든.', en: 'Yesterday\'s shoot… was long. I spent all day being someone else.', note: 'He doesn\'t smile for once. Then he does.' },
          },
          {
            when: { mood: ['raw', 'low'] },
            value: { ko: '어제 촬영… 길었어요. 하루 종일 다른 사람으로 살았거든요.', en: 'Yesterday\'s shoot… was long. I spent all day being someone else.', note: 'He doesn\'t smile for once. Then he does.', review: 'native' },
          },
          {
            when: { flags: ['jin_banmal_accepted'] },
            value: { ko: '어제 촬영 대박이었어. 감독님이 원 테이크로 끝냈어, ㅋㅋ.', en: 'Yesterday\'s shoot was great. The director got it in one take, lol.' },
          },
          { value: { ko: '어제 촬영 잘 끝났어요. 감독님이 한 번에 오케이 했어요.', en: 'Yesterday\'s shoot went well. The director okayed it in one take.' } },
        ],
        tong: { ko: '촬영 = 영화나 드라마 찍기', en: '촬영 (chwaryeong) = filming, a shoot.', maxLevel: 3 },
        effects: { vocab: [{ ko: '촬영', en: 'filming / a shoot', rom: 'chwaryeong' }] },
        next: 'ja1_haeun',
      },
      {
        id: 'ja1_haeun',
        speaker: 'jin',
        expr: 'smile',
        when: { flags: ['h1_done'], notFlags: ['tip_haeun_spicy'] },
        lines: [
          { when: { flags: ['jin_banmal_accepted'] }, value: { ko: '하은이랑 짝이라며? 걔 연습실에서 안 나와. 매운 거 엄청 좋아하고.', en: 'I hear you\'re paired with Ha-eun? She never leaves the studio. Loves spicy food, too.' } },
          { value: { ko: '하은 씨랑 짝이라면서요? 연습실에서 안 나와요, 그 친구. 매운 거 엄청 좋아하고요.', en: 'I hear you\'re paired with Ha-eun? She never leaves the studio. Loves spicy food, too.', review: 'native' } },
        ],
        effects: { setFlags: ['tip_haeun_spicy'] },
        next: 'ja1_bye',
      },
      {
        id: 'ja1_bye',
        speaker: 'jin',
        expr: 'smile',
        lines: [
          { when: { flags: ['jin_banmal_accepted'] }, value: { ko: '여기 내 단골이야. 언제든 와.', en: 'This is my regular spot. Come by any time.' } },
          { value: { ko: '여기 제 단골이에요. 언제든 와요.', en: 'This is my regular spot. Come by any time.' } },
        ],
        tong: { ko: '단골 = 자주 가는 곳', en: '단골 (dangol) = a regular (spot or customer).', maxLevel: 3 },
        effects: { vocab: [{ ko: '단골', en: 'a regular (spot/customer)', rom: 'dangol' }] },
        end: true,
      },
    ],
  },
  presets: [
    {
      id: 'ja1_banmal_first',
      label: 'First visit, 반말 accepted at J0: switch Tong off for him',
      state: { stage: 'acquaintances', flags: { met_jin: true, jin_banmal_accepted: true, h1_done: true }, day: 3 },
      world: { hour: 14 },
      path: ['ja1_tong_off'],
    },
    {
      id: 'ja1_polite_kind',
      label: 'First visit, kept 존댓말: keep Tong, kindly',
      state: { stage: 'acquaintances', flags: { met_jin: true, jin_banmal_declined: true }, day: 3 },
      world: { hour: 11 },
      path: ['ja1_tong_kind'],
    },
    {
      id: 'ja1_low_repeat',
      label: 'A later visit on a low day: the shoot line drops the act',
      state: { stage: 'friends', flags: { met_jin: true, jin_tong_asked: true, tip_haeun_spicy: true }, mood: { energy: -1, valence: -1, causes: ['no_sleep'] }, day: 40 },
      world: { hour: 16 },
    },
  ],
};
