import type { SceneModule } from '../../../../relationship/types';

/**
 * A1 · 편의점 라면 — the after-curfew ritual. Repeatable. Same chairs, same two
 * cups; what changes is the stage, her mood, and the weather.
 */
export const module: SceneModule = {
  scene: {
    id: 'haeun.a1.ramyeon',
    kind: 'ambient',
    title: { ko: '편의점 라면', en: 'Convenience-store ramyeon' },
    characterId: 'haeun',
    location: 'convenience_store',
    gate: { hours: { from: 0, to: 3 }, any: [{ flags: ['first_secret'] }, { stageAtLeast: 'friends' }] },
    summary:
      'After curfew at the plastic chairs outside the store. Opening varies by stage and rain; she mentions being tired (a bid). Tease on her bad day hurts early and helps at close; comfort too early reads as pity.',
    beats: [
      {
        id: 'open',
        speaker: 'haeun',
        expr: 'cool',
        lines: [
          {
            when: { stageAtLeast: 'close', weather: ['rain'] },
            value: {
              ko: '…',
              en: '(Rain drums on the awning. She slides the second cup toward you without looking up.)',
              note: 'No line. She never says she bought it for you.',
            },
          },
          {
            when: { stageAtLeast: 'friends' },
            value: { ko: '왔네. 라면 두 개 샀어. 하나는… 실수로.', en: 'You came. I bought two ramyeon. One was… a mistake.' },
          },
          {
            value: {
              ko: '…너 여기서 뭐 해요. 통금 지났잖아요.',
              en: '…What are you doing here. It\'s past curfew.',
              note: '반말 slip: 너 with 해요. She doesn\'t correct it.',
            },
          },
        ],
        tong: { ko: '통금 = curfew', en: '통금 (tonggeum) = curfew. Short for 통행금지.', maxLevel: 1 },
        next: 'tired',
      },
      {
        id: 'tired',
        speaker: 'haeun',
        lines: [
          { when: { stageAtLeast: 'close' }, value: { ko: '…나 오늘 좀 피곤해.', en: '…I\'m kind of tired today.' } },
          { when: { stageAtLeast: 'friends' }, value: { ko: '아, 피곤해 죽겠다.', en: 'Ugh, I\'m dead tired.' } },
          { value: { ko: '피곤해요. 그러니까 조용히 먹어요.', en: 'I\'m tired. So eat quietly.' } },
        ],
        choices: [
          {
            id: 'ask',
            intent: 'ask',
            say: { ko: '왜? 무슨 일 있었어?', rom: 'wae? museun il isseosseo?', en: 'Why? Did something happen?' },
            outcomes: [
              {
                when: { stageBelow: 'friends' },
                reaction: { ko: '…알아서 뭐 하게요.', en: '…What\'s it to you.' },
                expr: 'cool',
                deltas: { tension: 2, warmth: 1 },
              },
              {
                when: { mood: ['raw', 'low'] },
                reaction: {
                  ko: '박 코치님이 \'다시\'만 백 번. …진짜 백 번은 한 것 같아.',
                  en: 'Coach Park said "again" a hundred times. …Literally a hundred, I think.',
                },
                expr: 'tired',
                deltas: { trust: 3, warmth: 2 },
                memory: { tag: 'asked_why_tired', note: 'Asked why she was tired on a bad night; she told you about Coach Park.' },
              },
              {
                reaction: { ko: '그냥. 잠을 못 잤어.', en: 'Just. Didn\'t sleep.' },
                deltas: { warmth: 1, trust: 1 },
              },
            ],
          },
          {
            id: 'sit',
            intent: 'presence',
            say: { ko: '(그냥 같이 먹는다)', en: '(Let it go. Just eat with her.)' },
            outcomes: [
              {
                when: { stageAtLeast: 'close', mood: ['raw', 'low'] },
                reaction: { ko: '…', en: '(After a while she leans a little closer. Neither of you mentions it.)' },
                expr: 'tired',
                deltas: { trust: 3, warmth: 1 },
              },
              { reaction: { ko: '…', en: '(The fridge hums. She eats. It\'s fine.)' }, deltas: { warmth: 1 } },
            ],
          },
          {
            id: 'tease',
            intent: 'tease',
            say: { ko: '그래서 아까 센터 위험했구나?', rom: 'geuraeseo akka senteo wiheomhaetguna?', en: 'So that\'s why your center spot looked shaky today?' },
            outcomes: [
              {
                when: { mood: ['raw', 'low'], stageBelow: 'close' },
                reaction: { ko: '…너나 잘해.', en: '…Worry about yourself.', note: 'She leaves her ramyeon half-eaten and goes in.' },
                expr: 'angry',
                deltas: { warmth: -3, tension: 3 },
              },
              {
                when: { mood: ['raw', 'low'] },
                reaction: { ko: '…고마워. 아 아니, 시끄러워.', en: '…Thanks. I mean, shut up.', note: 'At close, treating her as normal on a bad day is the right call.' },
                expr: 'smirk',
                deltas: { trust: 3, warmth: 2 },
                memory: { tag: 'teased_on_bad_day', note: 'Teased her on a bad night instead of pitying her; she thanked you, then took it back.' },
              },
              {
                when: { stageBelow: 'friends' },
                reaction: { ko: '너나 잘해요. …잘해.', en: 'Worry about yourself. …Seriously.', note: '반말 slip on the repeat.' },
                expr: 'smirk',
                deltas: { tension: 2, warmth: 1 },
              },
              { reaction: { ko: 'ㅋ 죽을래?', en: 'Heh. Want to die?' }, expr: 'laugh', deltas: { warmth: 2 } },
            ],
          },
          {
            id: 'comfort',
            intent: 'comfort',
            say: { ko: '힘들었지. 괜찮아?', rom: 'himdeureotji. gwaenchana?', en: 'Rough day, huh. You okay?' },
            outcomes: [
              {
                when: { mood: ['raw', 'low'], stageBelow: 'close' },
                reaction: { ko: '동정하지 마요.', en: 'Don\'t pity me.' },
                expr: 'cool',
                deltas: { tension: 2, warmth: -1 },
                memory: { tag: 'comforted_too_early', note: 'Comforted her on a bad night before she trusted you; she called it pity.' },
              },
              {
                when: { mood: ['raw', 'low'] },
                reaction: { ko: '…응.', en: '…Yeah.' },
                expr: 'tired',
                deltas: { trust: 2, warmth: 2 },
              },
              {
                reaction: { ko: '뭐가? 나 괜찮은데.', en: 'What? I\'m fine.', note: 'Comfort she doesn\'t need feels like being handled.' },
                expr: 'cool',
                deltas: { tension: 1 },
              },
            ],
          },
        ],
        next: 'close',
      },
      {
        id: 'close',
        speaker: 'haeun',
        lines: [
          { when: { weather: ['rain'] }, value: { ko: '비 그칠 때까지만 있어.', en: 'Stay till the rain stops. Just till then.' } },
          { when: { stageAtLeast: 'friends' }, value: { ko: '…내일 늦지 마.', en: '…Don\'t be late tomorrow.' } },
          { value: { ko: '먼저 들어가요. 같이 들어가면 걸려요.', en: 'You go in first. If we go in together we\'ll get caught.' } },
        ],
        end: true,
      },
    ],
  },
  presets: [
    {
      id: 'rival-good-day',
      label: 'Acquaintances, first secret kept, she topped the eval. Tease lands as banter.',
      state: { stage: 'acquaintances', flags: { first_secret: true }, axes: { warmth: 28, tension: 35, trust: 25 }, mood: { valence: 2, energy: 1, causes: ['eval_top'] } },
      world: { hour: 1, weather: 'clear' },
      path: ['tease'],
    },
    {
      id: 'friend-ordinary',
      label: 'Friends, ordinary night. Asking why gets a short, real answer.',
      state: { stage: 'friends', flags: { first_secret: true }, axes: { warmth: 50, tension: 30, trust: 40 }, mood: { valence: 0, energy: -1, causes: ['no_sleep'] } },
      world: { hour: 1, weather: 'clear' },
      path: ['ask'],
    },
    {
      id: 'close-raw-rain',
      label: 'Close, raining, she was flagged at eval. She slides the cup over silently; teasing her is the right call now.',
      state: { stage: 'close', flags: { first_secret: true, rooftop_done: true }, axes: { warmth: 68, tension: 40, trust: 62 }, mood: { valence: -2, energy: -1, causes: ['eval_flagged'] } },
      world: { hour: 2, weather: 'rain' },
      path: ['tease'],
    },
  ],
};
