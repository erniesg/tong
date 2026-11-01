import type { Bid, CharacterNeeds } from '../../../relationship/engine';

/** Haeun feels acts of service and quality time; words only late; gifts barely. */
export const HAEUN_NEEDS: CharacterNeeds = {
  feels: { acts: 1, time: 0.9, words: 0.4, gift: 0.3, touch: 0.2 },
};

/**
 * Ambient bids between hangouts. Deterministic (engine.resolveBid): need match ×
 * mood × specificity × diminishing returns. The runtime records memories such
 * as 'saw_banana_milk' and 'let_her_win' when the triggering moment happens.
 */
export const HAEUN_BIDS: Bid[] = [
  {
    id: 'banana_milk_locker',
    label: { ko: '사물함에 바나나우유', en: 'Leave a banana milk on her locker before an eval' },
    expresses: ['acts'],
    specificTo: ['saw_banana_milk'],
    base: { warmth: 3, trust: 1 },
    reaction: { ko: '…누가 놨어요, 이거.', en: '…Who left this.', note: 'She drinks it anyway.', review: 'native' },
    specificReaction: { ko: '…어떻게 알았어?', en: '…How did you know?', note: 'Slips into 반말 without noticing.', review: 'native' },
  },
  {
    id: 'save_her_spot',
    label: { ko: '연습실 자리 맡아 두기', en: 'Save her spot by the mirror' },
    expresses: ['acts'],
    gate: { stageAtLeast: 'acquaintances' },
    base: { warmth: 2, trust: 2 },
    reaction: { ko: '…거기 내 자리 아닌데요.', en: '…That\'s not my spot.', note: 'She takes it.', review: 'native' },
  },
  {
    id: 'learn_her_part',
    label: { ko: '하은 파트 외우기', en: 'Learn her part of the choreo so you can run it with her' },
    expresses: ['acts', 'time'],
    gate: { stageAtLeast: 'acquaintances', minLevel: 1 },
    base: { trust: 3, tension: 2 },
    reaction: { ko: '…왜 내 파트를 외워요?', en: '…Why did you learn my part?', note: 'Then she runs it with you twice.', review: 'native' },
  },
  {
    id: 'quiet_sit',
    label: { ko: '말없이 옆에 앉기', en: 'Sit next to her on the plastic chairs and say nothing' },
    expresses: ['time'],
    gate: { stageAtLeast: 'friends' },
    base: { trust: 3, warmth: 1 },
    reaction: { ko: '…', en: 'She doesn\'t move away.' },
  },
  {
    id: 'text_after_bad_eval',
    label: { ko: '평가 끝나고 문자', en: 'Text her after a bad eval' },
    expresses: ['words'],
    gate: { stageAtLeast: 'acquaintances', mood: ['raw', 'low'] },
    base: { warmth: 2 },
    backfire: {
      when: { stageBelow: 'friends' },
      deltas: { tension: 3 },
      reaction: { ko: '괜찮아요. 신경 쓰지 마요.', en: 'I\'m fine. Don\'t worry about it.', note: 'Read immediately. Answered an hour later.', review: 'native' },
    },
    reaction: { ko: 'ㅇ', en: 'k', note: 'One letter. From her, that\'s a lot.' },
  },
  {
    id: 'expensive_gift',
    label: { ko: '비싼 선물', en: 'Buy her something expensive' },
    expresses: ['gift'],
    base: { warmth: 1 },
    backfire: {
      when: {},
      deltas: { tension: 5, trust: -2 },
      reaction: { ko: '…이거 얼마예요? 못 받아요.', en: '…How much was this? I can\'t take it.', note: 'She sends money home. Now she owes you, and she hates owing.', review: 'native' },
    },
    reaction: { ko: '…', en: '' },
  },
  {
    id: 'let_her_win',
    label: { ko: '일부러 져 주기', en: 'Lose to her on purpose in a rivalry minigame' },
    expresses: ['acts'],
    gate: { stageAtLeast: 'acquaintances' },
    base: { warmth: 2 },
    backfire: {
      when: { any: [{ min: { trust: 40 } }, { memories: ['let_her_win'] }] },
      deltas: { tension: 6, trust: -4 },
      reaction: { ko: '…일부러 졌어요? 나 무시해요?', en: '…You lost on purpose? Are you looking down on me?', review: 'native' },
    },
    reaction: { ko: '흥. 당연하지.', en: 'Hmph. Obviously.', note: 'She hasn\'t noticed. Yet.' },
  },
  {
    id: 'jeju_thing',
    label: { ko: '제주 감귤 초콜릿', en: 'Bring her Jeju tangerine chocolate from the airport shop' },
    expresses: ['gift', 'acts'],
    gate: { knows: ['from_jeju'] },
    specificTo: ['knows_jeju_talk', 'heard_grandma_call'],
    base: { warmth: 4, trust: 2 },
    reaction: { ko: '…이거 관광객이 사는 거잖아.', en: '…Only tourists buy these.', note: 'She keeps the box.', review: 'native' },
    specificReaction: { ko: '…할망이 이거 좋아하는데.', en: '…Grandma loves these.', note: 'Quiet. She doesn\'t eat them; she saves them.', review: 'native' },
  },
];
