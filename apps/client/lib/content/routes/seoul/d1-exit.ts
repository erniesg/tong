import type { SceneModule } from '../../../relationship/types';

/** Day 1 · 출구 (the arrivals doors). Two signs, 입구 and 출구; rebuild the way out. */
export const module: SceneModule = {
  scene: {
    id: 'seoul.d1.exit',
    kind: 'story',
    title: { ko: '출구', en: 'The way out' },
    characterId: 'tong',
    location: 'incheon_arrivals',
    slot: 'd1.s1b',
    gate: { flags: ['d1_started'], month: { from: 1, to: 1 } },
    summary: 'Two doors, 입구 and 출구. Tong explains blocks with 구, then 출 (ㅊ ㅜ ㄹ). Block crush 출구; a miss gets Tong pointing at ㅊ. The doors open.',
    seeds: ['hangul:출구', 'd1_exit_done'],
    beats: [
      {
        id: 'e_signs',
        speaker: 'narration',
        lines: [{ value: { ko: '입구 · 출구', en: 'Two sets of glass doors, two signs.' } }],
        next: 'e_blocks',
      },
      {
        id: 'e_blocks',
        speaker: 'tong',
        lines: [
          {
            value: {
              ko: '한글은 블록이야. 한 블록이 한 음절.',
              en: 'Korean letters stack into blocks. Each block is one syllable. The second block on both signs is the same: 구. That\'s ㄱ, a "g", on top of ㅜ, an "oo". 구, "goo".',
              review: 'native',
            },
          },
        ],
        next: 'e_out',
      },
      {
        id: 'e_out',
        speaker: 'tong',
        lines: [
          {
            value: {
              ko: '출은 ㅊ, ㅜ, ㄹ. 나가는 거야.',
              en: 'The first blocks are different. 출 is ㅊ, a "ch", then ㅜ again, with ㄹ, an "l", underneath. "Chul". It means out. You want out.',
              review: 'native',
            },
          },
        ],
        exercise: {
          type: 'block_crush',
          objectiveId: 'ko-script-blocks-2part',
          targets: ['출구'],
          distractors: ['ㅂ', 'ㅣ'],
          framing: { ko: '나가는 문을 맞춰 봐.', en: 'Rebuild the way out.' },
          onFail: 'assist',
        },
        effects: { setFlags: ['hangul:출구'] },
        next: 'e_pass',
      },
      {
        id: 'e_pass',
        speaker: 'narration',
        when: { flags: ['ex_e_out'] },
        lines: [{ value: { ko: '출구.', en: '출구. Exit. The doors slide open.' } }],
        next: 'e_assist',
      },
      {
        id: 'e_assist',
        speaker: 'tong',
        when: { notFlags: ['ex_e_out'] },
        lines: [{ value: { ko: 'ㅊ로 시작하는 쪽! 출구.', en: 'The one that starts with ㅊ. 출구, exit.', review: 'native' } }],
        next: 'e_train',
      },
      {
        id: 'e_train',
        speaker: 'tong',
        lines: [{ value: { ko: '공항철도는 이쪽이야.', en: 'The airport train is this way. Find the departure board.', review: 'native' } }],
        effects: { setFlags: ['d1_exit_done'], vocab: [{ ko: '출구', en: 'exit', rom: 'chulgu' }, { ko: '입구', en: 'entrance', rom: 'ipgu' }] },
        end: true,
      },
    ],
  },
  presets: [
    { id: 'd1e_read', label: 'Reads 출구 herself', state: { day: 1 }, world: { hour: 13, playerLevel: 0, inputTier: 1, flags: { d1_started: true } } },
    { id: 'd1e_assist', label: 'Misses; Tong points at ㅊ', state: { day: 1 }, world: { hour: 13, playerLevel: 0, inputTier: 1, flags: { d1_started: true } }, exercises: { e_out: false } },
  ],
};
