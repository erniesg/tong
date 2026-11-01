import type { SceneModule } from '../../../../relationship/types';

/**
 * JA2 · 한강 — Jin with the cap off, the one place nobody recognises him.
 * Plants the Act 3 leak (the photo you take here is the one that leaks) and
 * the "Seen" payoff (his real name, asked for long before he can give it).
 */
export const module: SceneModule = {
  scene: {
    id: 'jin.a2.river',
    kind: 'ambient',
    title: { ko: '한강', en: 'The river' },
    characterId: 'jin',
    location: 'han_river',
    gate: { hours: { from: 18, to: 23 }, flags: ['met_jin'] },
    summary:
      'Night at the lookout, cap off. "Nobody recognises me out here." Tell him he\'s just Jin here, take a photo together ("only if it stays between us" — this is the photo that leaks in Act 3), or, at tier 2, ask his real name: he deflects, and the question is remembered for the Seen ending. A low night: he says less and asks you to stay a bit.',
    seeds: ['river_photo (the leaked photo, Act 3)', 'asked_real_name (Seen ending)', 'just_jin'],
    beats: [
      {
        id: 'ja2_open',
        speaker: 'narration',
        lines: [
          { when: { mood: ['raw', 'low'] }, value: { ko: '…', en: '(The lookout. Jin is on the bench with his cap in his hands, not looking at the water.)' } },
          { value: { ko: '…', en: '(The lookout. Jin has his cap off. Out here he looks younger.)' } },
        ],
        next: 'ja2_jin',
      },
      {
        id: 'ja2_jin',
        speaker: 'jin',
        expr: 'smile',
        lines: [
          {
            when: { mood: ['raw', 'low'], flags: ['jin_banmal_accepted'] },
            value: { ko: '…잠깐만 같이 있어 줄래? 말 안 해도 돼.', en: '…Stay a minute? You don\'t have to talk.' },
          },
          {
            when: { mood: ['raw', 'low'] },
            value: { ko: '…잠깐만 같이 있어 줄래요? 말 안 해도 돼요.', en: '…Stay a minute? You don\'t have to talk.', review: 'native' },
          },
          {
            when: { flags: ['jin_banmal_accepted'] },
            value: { ko: '한강 진짜 예쁘지? …여기선 아무도 날 못 알아봐. 그게 좋아.', en: 'The Han River\'s beautiful, right? …Nobody recognises me out here. I like that.' },
          },
          { value: { ko: '한강 진짜 예쁘죠? …여기선 아무도 저를 못 알아봐요. 그게 좋아요.', en: 'The Han River\'s beautiful, right? …Nobody recognises me out here. I like that.' } },
        ],
        choices: [
          {
            id: 'ja2_just_jin',
            intent: 'comfort',
            say: { ko: '여기선 그냥 진이에요.', en: 'Out here you\'re just Jin.', rom: 'yeogiseon geunyang jinieyo' },
            outcomes: [
              {
                when: { mood: ['raw', 'low'] },
                reaction: { ko: '…고마워요. 그 말 좋다.', en: '…Thank you. I like hearing that.', note: 'He leans back. For a while neither of you says anything, and it\'s fine.' },
                expr: 'smile',
                deltas: { warmth: 4, trust: 2 },
                memory: { tag: 'just_jin', note: 'Told Jin "out here you\'re just Jin" on a bad night.' },
              },
              {
                reaction: { ko: '…고마워. 그 말 좋다.', en: '…Thanks. I like hearing that.' },
                expr: 'smile',
                deltas: { warmth: 3 },
                memory: { tag: 'just_jin', note: 'Told Jin "out here you\'re just Jin".' },
              },
            ],
          },
          {
            id: 'ja2_photo',
            intent: 'ask',
            say: { ko: '같이 사진 찍어요!', en: 'Let\'s take a photo together!', rom: 'gachi sajin jjigeoyo' },
            outcomes: [
              {
                when: { flags: ['jin_banmal_accepted'] },
                reaction: { ko: '우리끼리만 보는 거면… 좋아. 하나, 둘, 셋, 김치!', en: 'If it stays just between us… okay. One, two, three, kimchi!', note: 'He angles the phone so the bridge lights are behind you both. He sends it to himself.' },
                expr: 'laugh',
                deltas: { warmth: 2 },
                setFlags: ['river_photo'],
                memory: { tag: 'river_photo', note: 'Took a photo with Jin at the river; he kept a copy. Only the two of you knew that angle.' },
              },
              {
                reaction: { ko: '우리끼리만 보는 거면… 좋아요. 하나, 둘, 셋, 김치!', en: 'If it stays just between us… okay. One, two, three, kimchi!', note: 'He angles the phone so the bridge lights are behind you both. He sends it to himself.', review: 'native' },
                expr: 'laugh',
                deltas: { warmth: 2 },
                setFlags: ['river_photo'],
                memory: { tag: 'river_photo', note: 'Took a photo with Jin at the river; he kept a copy. Only the two of you knew that angle.' },
              },
            ],
          },
          {
            id: 'ja2_real_name',
            intent: 'ask',
            minTier: 2,
            gate: { notFlags: ['asked_real_name'] },
            say: { ko: '진 씨 진짜 이름은 뭐예요?', en: 'What\'s your real name, Jin?', rom: 'jin ssi jinjja ireumeun mwoyeyo' },
            outcomes: [
              {
                reaction: { ko: '…진이 진짜 이름이에요. 거의.', en: '…Jin is my real name. Almost.', note: 'He laughs it off. Nobody has asked him that in years.' },
                expr: 'surprised',
                deltas: { trust: 3, tension: 1 },
                setFlags: ['asked_real_name'],
                memory: { tag: 'asked_real_name', note: 'Asked Jin his real name at the river. He said "almost".' },
              },
            ],
          },
        ],
        next: 'ja2_end',
      },
      {
        id: 'ja2_end',
        speaker: 'narration',
        cue: 'photo',
        when: { flags: ['river_photo'] },
        lines: [{ value: { ko: '찰칵.', en: '(Click. The two of you against the bridge lights.)' } }],
        next: 'ja2_bye',
      },
      {
        id: 'ja2_bye',
        speaker: 'jin',
        expr: 'smile',
        lines: [
          { when: { flags: ['jin_banmal_accepted'] }, value: { ko: '조심히 들어가. 도착하면 문자해.', en: 'Get home safe. Text me when you\'re in.' } },
          { value: { ko: '조심히 들어가요. 도착하면 문자 줘요.', en: 'Get home safe. Text me when you\'re in.' } },
        ],
        end: true,
      },
    ],
  },
  presets: [
    {
      id: 'ja2_banmal_photo',
      label: '반말 with Jin, a good night: take the photo',
      state: { stage: 'acquaintances', flags: { met_jin: true, jin_banmal_accepted: true }, day: 5 },
      world: { hour: 21 },
      path: ['ja2_photo'],
    },
    {
      id: 'ja2_low_just_jin',
      label: 'A low night: "out here you\'re just Jin"',
      state: { stage: 'friends', flags: { met_jin: true }, mood: { energy: -1, valence: -2, causes: ['senior_snapped'] }, day: 50 },
      world: { hour: 22 },
      path: ['ja2_just_jin'],
    },
    {
      id: 'ja2_tier2_name',
      label: 'Tier 2, polite: ask his real name',
      state: { stage: 'friends', flags: { met_jin: true }, day: 60 },
      world: { hour: 20, inputTier: 2 },
      path: ['ja2_real_name'],
    },
  ],
};
