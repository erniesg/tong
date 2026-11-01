import type { SceneModule } from '../../../relationship/types';

/**
 * J0 · 포장마차 (Jin's onboarding). Warm, easy, a little too easy. Refusing him
 * never costs warmth or trust (canon/jin.ts mustNot); deferring is what gets
 * Generosity (he pays) is fine to accept; a directive (he plans for you) counts in
 * tally.jin_directives when you go along. Yes is rewarding now; no costs a little
 * warmth now and builds trust; how you say no matters.
 */
export const module: SceneModule = {
  scene: {
    id: 'jin.j0',
    kind: 'story',
    title: { ko: '포장마차', en: 'The pojangmacha' },
    characterId: 'jin',
    location: 'food_street',
    slot: 'm1.j0',
    gate: { hours: { from: 19, to: 3 } },
    summary:
      'Night tent. You fumble the order; a man in a low cap rescues it and orders 떡볶이 for you (or adjusts your correct order). He gives his name freely, proposes 반말, asks a lot of questions. His phone buzzes: one second, a different face. He insists on paying. He leaves in a cap and mask. That was easy. Too easy?',
    seeds: ['saw_face_change', 'tally.jin_directives (going along with his plans)', 'jin_adjusted_order even when you got it right', 'jin_banmal_declined'],
    beats: [
      {
        id: 'j0_open',
        speaker: 'narration',
        cue: 'sit',
        lines: [
          { when: { weather: ['rain', 'cold'] }, value: { ko: '포장마차. 김이 난다.', en: 'The pojangmacha. Steam, plastic sheeting, rain drumming on the tarp. One stool left, next to a man in a low black cap.' } },
          { value: { ko: '포장마차. 김이 난다.', en: 'The pojangmacha. Steam, orange light, the smell of gochujang. One stool left, next to a man in a low black cap.' } },
        ],
        tong: { ko: '[음식] + 주세요!', en: 'Order with [food] + 주세요 (juseyo), "please give me".', maxLevel: 1 },
        next: 'j0_order',
      },
      {
        id: 'j0_order',
        speaker: 'ajusshi',
        expr: 'smile',
        lines: [{ value: { ko: '뭐 줄까요?', en: 'What\'ll it be?' } }],
        exercise: {
          type: 'sentence_builder',
          objectiveId: 'ko-gram-juseyo',
          targets: ['떡볶이', '주세요'],
          distractors: ['감사합니다', '순대'],
          framing: { ko: '주문해 봐요.', en: 'Order the tteokbokki: put the words in order.' },
          onFail: 'assist',
        },
        next: 'j0_order_pass',
      },
      {
        id: 'j0_order_pass',
        speaker: 'jin',
        expr: 'smile',
        when: { flags: ['ex_j0_order'] },
        lines: [
          {
            value: {
              ko: '오, 발음 좋은데요? 근데 여기 엄청 매워요. 아저씨, 덜 맵게요!',
              en: 'Oh, nice pronunciation! But it\'s really spicy here. Ajusshi, make it less spicy!',
              note: 'You ordered it right: 떡볶이 주세요. He changed it anyway, smiling, without asking.',
              review: 'native',
            },
          },
        ],
        effects: { setFlags: ['ordered_self', 'jin_adjusted_order'], deltas: { warmth: 2 } },
        next: 'j0_confused',
      },
      {
        id: 'j0_confused',
        speaker: 'ajusshi',
        expr: 'surprised',
        when: { notFlags: ['ex_j0_order'] },
        lines: [
          { when: { minTier: 1 }, value: { ko: '네? 하하, 감사는 먹고 나서!', en: 'Huh? Haha, thanks comes after eating!', note: 'The words came out jumbled.' } },
          { value: { ko: '네? 폰이 말하네?', en: 'Huh? The phone\'s talking?', note: 'You pointed at the menu and let Tong say it.' } },
        ],
        next: 'j0_rescue',
      },
      {
        id: 'j0_rescue',
        speaker: 'jin',
        expr: 'smile',
        when: { notFlags: ['ex_j0_order'] },
        lines: [
          {
            value: {
              ko: '아저씨, 여기 떡볶이 하나요. 덜 맵게. …처음이죠? 괜찮아요, 다들 그래요.',
              en: 'Ajusshi, one tteokbokki here. Less spicy. …First time? It\'s fine, everyone does that.',
              note: 'He orders for you before you can try again. He didn\'t ask what you wanted.',
              review: 'native',
            },
          },
        ],
        effects: { setFlags: ['jin_ordered_for_you'] },
        next: 'j0_name',
      },
      {
        id: 'j0_name',
        speaker: 'jin',
        expr: 'smile',
        cue: 'serve',
        lines: [{ value: { ko: '저는 진이에요. 그냥 진.', en: 'I\'m Jin. Just Jin.', note: 'He offers it freely, like it costs nothing.' } }],
        tong: { ko: '어디서 본 얼굴 같은데…?', en: 'Huh. He looks… familiar? Never mind.', maxLevel: 1 },
        choices: [
          {
            id: 'j0_intro',
            intent: 'commit',
            say: { ko: '저는 {name}이에요. 반가워요.', en: 'I\'m {name}. Nice to meet you.', rom: 'jeoneun {name}ieyo. bangawoyo' },
            outcomes: [{ speaker: 'jin', expr: 'smile', reaction: { ko: '{name}. 좋은 이름이다.', en: '{name}. Nice name.' }, deltas: { warmth: 3 } }],
          },
          {
            id: 'j0_familiar',
            intent: 'ask',
            say: { ko: '혹시… 어디서 본 것 같은데요.', en: 'Have I… seen you somewhere?', rom: 'hoksi… eodiseo bon geot gateundeyo' },
            outcomes: [
              {
                speaker: 'jin',
                expr: 'laugh',
                reaction: { ko: '그런 말 많이 들어요. 흔한 얼굴이라.', en: 'I get that a lot. Common face.', note: 'Smooth. Too smooth. He tugs the cap a little lower.', review: 'native' },
                setFlags: ['nearly_recognised_jin'],
                memory: { tag: 'said_familiar', note: 'Told Jin he looked familiar the night you met.' },
              },
            ],
          },
        ],
        next: 'j0_banmal',
      },
      {
        id: 'j0_banmal',
        speaker: 'jin',
        expr: 'smile',
        lines: [{ value: { ko: '우리 말 놓을까요? 나이 별로 차이 안 날 것 같은데.', en: 'Shall we drop the formal speech? I bet we\'re not that far apart in age.', review: 'native' } }],
        tong: { ko: '말 놓다 = 반말 하기!', en: '말 놓다 = to switch to casual speech (반말). People usually check age first. He didn\'t.', maxLevel: 3 },
        choices: [
          {
            id: 'j0_banmal_yes',
            // an offer between equals, not him deciding for you
            intent: 'commit',
            say: { ko: '좋아요! …아, 좋아.', en: 'Sure! …I mean, sure. (switching)', rom: 'joayo! …a, joa' },
            outcomes: [
              {
                speaker: 'jin',
                expr: 'smile',
                reaction: { ko: '그치? 훨씬 편하다.', en: 'Right? So much easier.' },
                deltas: { warmth: 2 },
                setFlags: ['jin_banmal_accepted'],
              },
            ],
          },
          {
            id: 'j0_banmal_later',
            intent: 'decline',
            minTier: 1,
            say: { ko: '아직은… 존댓말이 편해요.', en: 'For now… I\'m more comfortable with polite speech.', rom: 'ajigeun… jondaenmari pyeonhaeyo' },
            outcomes: [
              {
                speaker: 'jin',
                expr: 'smile',
                reaction: { ko: '아, 그럼요. 천천히 해요.', en: 'Oh, of course. Take your time.', note: 'A flicker, then the smile again. The numbers don\'t move; he noticed.' },
                setFlags: ['jin_banmal_declined'],
                memory: { tag: 'declined_jin_banmal', note: 'Kept 존댓말 with Jin when he offered 반말 the first night.' },
              },
            ],
          },
        ],
        next: 'j0_talk',
      },
      {
        id: 'j0_talk',
        speaker: 'jin',
        expr: 'smile',
        lines: [
          {
            when: { flags: ['jin_banmal_accepted'] },
            value: {
              ko: '{name}, 한국 온 지 얼마나 됐어? 일주일? 진짜? 그럼 내가 맛집 다 알려 줄게. 다음엔 순대 먹자, 그치?',
              en: '{name}, how long have you been in Korea? A week? Really? Then I\'ll show you all the good places. Sundae next time, right?',
              review: 'native',
            },
          },
          {
            value: {
              ko: '{name} 씨, 한국 온 지 얼마나 됐어요? 일주일? 그럼 제가 맛집 다 알려 줄게요. 다음엔 순대 먹어요, 그쵸?',
              en: '{name}, how long have you been in Korea? A week? Then I\'ll show you all the good places. Sundae next time, yeah?',
              review: 'native',
            },
          },
        ],
        choices: [
          {
            id: 'j0_plan_yes',
            intent: 'defer',
            ask: 'directive',
            say: { ko: '좋아요!', en: 'Sounds good!', rom: 'joayo' },
            outcomes: [
              {
                speaker: 'jin',
                expr: 'smile',
                reaction: { ko: '약속이다.', en: 'It\'s a promise.', note: 'You didn\'t pick a day. He already has one in mind.' },
                deltas: { warmth: 2 },
                setFlags: ['jin_plan_accepted'],
                tally: ['jin_directives'],
              },
            ],
          },
          {
            id: 'j0_plan_maybe',
            intent: 'decline',
            ask: 'directive',
            say: { ko: '생각해 볼게요.', en: 'I\'ll think about it.', rom: 'saenggakae bolgeyo' },
            outcomes: [
              {
                speaker: 'jin',
                expr: 'laugh',
                reaction: { ko: 'ㅋㅋ 다음에! 알았어요.', en: 'Haha, next time then! Got it.', note: 'Charming. He\'ll ask again.' },
                deltas: { warmth: -1, trust: 1 },
                setFlags: ['jin_plan_declined'],
              },
            ],
          },
          {
            id: 'j0_plan_mine',
            intent: 'decline',
            ask: 'directive',
            minTier: 1,
            say: { ko: '좋아요. 근데 날짜는 제가 정할게요.', en: 'Sure. But I\'ll pick the day.', rom: 'joayo. geunde naljjaneun jega jeonghalgeyo' },
            outcomes: [
              {
                speaker: 'jin',
                expr: 'surprised',
                reaction: { ko: '…오. 그래요, 그럼 연락 기다릴게요.', en: '…Oh. Okay, I\'ll wait for your call then.', note: 'Kind and clear. It throws him for a second, and he likes you a little more for it.', review: 'native' },
                deltas: { warmth: 1, trust: 2 },
                setFlags: ['jin_plan_counter'],
                memory: { tag: 'picked_the_day', note: 'Said yes to Jin\'s plan but kept the choice of day.' },
              },
            ],
          },
          {
            id: 'j0_plan_no',
            intent: 'decline',
            ask: 'directive',
            say: { ko: '아니요, 괜찮아요.', en: 'No, I\'m good.', rom: 'aniyo, gwaenchanayo' },
            outcomes: [
              {
                speaker: 'jin',
                expr: 'smile',
                reaction: { ko: '아… 네. 알겠어요.', en: 'Ah… sure. Got it.', note: 'Flat. The smile stays on a beat too long.' },
                deltas: { warmth: -3, tension: 2, trust: 1 },
                setFlags: ['jin_plan_refused'],
              },
            ],
          },
        ],
        next: 'j0_phone',
      },
      {
        id: 'j0_phone',
        speaker: 'narration',
        cue: 'phone_buzz',
        lines: [
          {
            value: {
              ko: '진동.',
              en: 'His phone buzzes face-down on the table. For one second his face is someone else\'s: flat, careful, owned. Then he smiles again. "…미안, 일이에요." (Sorry, it\'s work.)',
            },
          },
        ],
        effects: { setFlags: ['saw_face_change'], memory: { tag: 'saw_face_change', note: 'Saw Jin\'s face change when his phone buzzed.' } },
        next: 'j0_bill',
      },
      {
        id: 'j0_bill',
        speaker: 'ajusshi',
        expr: 'smile',
        lines: [{ value: { ko: '다 해서 만 이천 원이에요~', en: 'That\'s 12,000 won altogether~', note: 'Jin\'s card is already out.' } }],
        choices: [
          {
            id: 'j0_let_pay',
            intent: 'defer',
            ask: 'generosity',
            say: { ko: '…잘 먹겠습니다.', en: 'Let him: "…Thanks for the meal."', rom: 'jal meokgetseumnida' },
            outcomes: [
              {
                speaker: 'jin',
                expr: 'smile',
                reaction: { ko: '당연하지. 내가 불렀잖아.', en: 'Of course. I invited you.', note: 'He didn\'t. You sat down next to him.', review: 'native' },
                deltas: { warmth: 2 },
                setFlags: ['jin_paid'],
              },
            ],
          },
          {
            id: 'j0_split',
            intent: 'decline',
            ask: 'generosity',
            say: { ko: '반반 해요.', en: 'Let\'s split it.', rom: 'banban haeyo' },
            outcomes: [
              {
                speaker: 'jin',
                expr: 'smile',
                reaction: { ko: '에이, 다음에 네가 사. 그치?', en: 'Nah, you get the next one. Right?', note: 'He pays anyway, and now there\'s a next one.', review: 'native' },
                deltas: { warmth: 1 },
                setFlags: ['jin_paid', 'jin_next_plan'],
              },
            ],
          },
          {
            id: 'j0_pay_self',
            intent: 'decline',
            ask: 'generosity',
            minTier: 1,
            say: { ko: '제가 낼게요. 진짜로요.', en: 'I\'ll pay. I mean it.', rom: 'jega naelgeyo. jinjjaroyo' },
            outcomes: [
              {
                speaker: 'jin',
                expr: 'surprised',
                reaction: { ko: '…그래요, 그럼. 고마워요.', en: '…Okay then. Thank you.', note: 'A flicker. He puts the card away slowly.' },
                setFlags: ['paid_myself'],
                memory: { tag: 'paid_myself', note: 'Paid for yourself the night you met Jin, over his card.' },
              },
            ],
          },
        ],
        next: 'j0_bye',
      },
      {
        id: 'j0_bye',
        speaker: 'jin',
        expr: 'smile',
        lines: [
          { when: { flags: ['jin_banmal_accepted'] }, value: { ko: '또 보자, {name}.', en: 'See you, {name}.' } },
          { value: { ko: '또 봐요, {name} 씨.', en: 'See you around, {name}.' } },
        ],
        next: 'j0_after',
      },
      {
        id: 'j0_after',
        speaker: 'narration',
        cue: 'leave',
        lines: [
          {
            value: {
              ko: '…',
              en: 'He pulls the cap low and a black mask up before he steps out from under the tarp. That was easy. Maybe too easy. What are you missing?',
            },
          },
        ],
        effects: { setFlags: ['j0_done', 'met_jin'] },
        end: true,
      },
    ],
  },
  presets: [
    {
      id: 'j0_tier0',
      label: 'Tier 0: Tong orders, Jin rescues, you go along with everything',
      state: { day: 2 },
      world: { playerLevel: 0, inputTier: 0, hour: 22, weather: 'rain' },
      path: ['j0_intro', 'j0_banmal_yes', 'j0_plan_yes', 'j0_let_pay'],
      exercises: false,
    },
    {
      id: 'j0_tier1_right',
      label: 'Tier 1: orders right (he adjusts it anyway), splits the bill',
      state: { day: 2 },
      world: { playerLevel: 1, inputTier: 1, hour: 22, weather: 'clear' },
      path: ['j0_familiar', 'j0_banmal_yes', 'j0_plan_maybe', 'j0_split'],
    },
    {
      id: 'j0_tier1_boundaries',
      label: 'Tier 1: jumbled order (Jin rescues), declines 반말 and the plan, pays for yourself',
      state: { day: 2 },
      world: { playerLevel: 1, inputTier: 1, hour: 22, weather: 'cold' },
      path: ['j0_intro', 'j0_banmal_later', 'j0_plan_maybe', 'j0_pay_self'],
      exercises: { j0_order: false },
    },
  ],
};
