import type { SceneModule } from '../../../relationship/types';

/**
 * International-School Kid loop · 일요일 통화 (The Sunday call). Day 2 morning,
 * Mum texts to set a time; from the first Sunday after, the call plays on the
 * rooftop at 10: news, a request, a favour offered. Accepting the favour is
 * debt (toll). Spoken in your home language; one Korean ask from Mum.
 * Mirrors Ha-eun's Sunday call from Grandma, also on the rooftop.
 */
export const module: SceneModule = {
  scene: {
    id: 'seoul.loop.family_call',
    kind: 'ambient',
    title: { ko: '일요일 통화', en: 'The Sunday call' },
    characterId: 'tong',
    location: 'dorm_rooftop',
    gate: { flags: ['origin_intl_kid', 'family_call_set'] },
    summary:
      'Sunday, 10am, the rooftop. Mum and Dad on video. News from home; Dad asks to see the room; Mum offers a favour (top up the card, or call the agency). Take it (debt, toll +1) or say you\'re fine. Mum asks how to thank your manager properly: block crush 감사합니다. Someone else is on a call across the roof.',
    seeds: ['family_favour / declined_favour', 'tally family_call', 'hangul:감사합니다'],
    beats: [
      {
        id: 'fc_open',
        speaker: 'narration',
        lines: [
          { when: { flags: ['family_called'] }, value: { ko: '…', en: 'Sunday, ten. Mum and Dad, both too close to the camera again.' } },
          { value: { ko: '…', en: 'Sunday, ten, the rooftop. Mum and Dad on video, both too close to the camera.' } },
        ],
        next: 'fc_news',
      },
      {
        id: 'fc_news',
        speaker: 'narration',
        lines: [{ value: { ko: 'The dog sleeps on your bed now. Dad says it\'s temporary.', en: 'Mum.' } }],
        next: 'fc_room',
      },
      {
        id: 'fc_room',
        speaker: 'narration',
        lines: [{ value: { ko: 'Show us the room? Where do you sleep?', en: 'Dad.' } }],
        choices: [
          {
            id: 'fc_show',
            intent: 'commit',
            say: { ko: 'Okay, after. Bottom bunk.', en: 'Okay, after. Bottom bunk.' },
            outcomes: [{ speaker: 'narration', reaction: { ko: 'Bottom bunk! Like camp!', en: 'Dad, delighted.' } }],
          },
          {
            id: 'fc_rules',
            intent: 'deflect',
            say: { ko: 'They\'re strict about filming the dorm.', en: 'They\'re strict about filming the dorm.' },
            outcomes: [{ speaker: 'narration', reaction: { ko: 'Strict is good. Strict is good.', en: 'Dad, twice.' } }],
          },
        ],
        next: 'fc_favour',
      },
      {
        id: 'fc_favour',
        speaker: 'narration',
        lines: [{ value: { ko: 'Do you need anything? We can top up the card. Or Dad can call the agency, he knows someone.', en: 'Mum.' } }],
        choices: [
          {
            id: 'fc_take',
            intent: 'commit',
            say: { ko: 'Maybe top up the card. Thanks.', en: 'Maybe top up the card. Thanks.' },
            outcomes: [{ speaker: 'narration', reaction: { ko: 'Done!', en: 'Before you finish the sentence.' }, setFlags: ['family_favour'], tally: ['toll'] }],
          },
          {
            id: 'fc_fine',
            intent: 'decline',
            say: { ko: 'I\'m fine. Really.', en: 'I\'m fine. Really.' },
            outcomes: [{ speaker: 'narration', reaction: { ko: 'Okay. Okay. Just say.', en: 'Mum, not convinced.' }, setFlags: ['declined_favour'] }],
          },
        ],
        next: 'fc_korean',
      },
      {
        id: 'fc_korean',
        speaker: 'narration',
        lines: [{ value: { ko: 'How do you say thank you to your manager? Properly.', en: 'Mum. She wants to send a gift.' } }],
        exercise: {
          type: 'block_crush',
          objectiveId: 'ko-vocab-thanks-formal',
          targets: ['감사합니다'],
          framing: { ko: '감사합니다', en: 'Thank you (formal).' },
          onFail: 'continue',
        },
        effects: { setFlags: ['hangul:감사합니다'], vocab: [{ ko: '감사합니다', en: 'thank you (formal)', rom: 'gamsahamnida' }] },
        next: 'fc_end',
      },
      {
        id: 'fc_end',
        speaker: 'narration',
        lines: [{ value: { ko: '…', en: 'Across the roof, someone else is on a call too, quiet, in a dialect you don\'t know. You both keep your voices down.' } }],
        effects: { setFlags: ['family_called'], tally: ['family_call'] },
        end: true,
      },
    ],
  },
  presets: [
    { id: 'fc_first', label: 'First Sunday: take the favour', state: { day: 8 }, world: { hour: 10, playerLevel: 1, inputTier: 1, flags: { origin_intl_kid: true, family_call_set: true } }, path: ['fc_show', 'fc_take'] },
    { id: 'fc_decline', label: 'Say you\'re fine', state: { day: 8 }, world: { hour: 10, playerLevel: 1, inputTier: 1, flags: { origin_intl_kid: true, family_call_set: true } }, path: ['fc_rules', 'fc_fine'] },
    { id: 'fc_later', label: 'A later Sunday', state: { day: 15 }, world: { hour: 10, playerLevel: 1, inputTier: 1, flags: { origin_intl_kid: true, family_call_set: true, family_called: true } }, path: ['fc_show', 'fc_fine'] },
  ],
};
