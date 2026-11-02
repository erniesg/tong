import type { SceneModule } from '../../../relationship/types';

/**
 * Athlete loop · 새벽 (Dawn). Mondays at 05:30 your body wakes on training
 * time. Run (alone, or with someone once you know names) or sleep on (dawn_rest, cleared by main.js once read). The
 * run is the formation grid with Tong calling: following instructions under
 * rhythm. Training while tired strains you (toll; main.js).
 */
export const module: SceneModule = {
  scene: {
    id: 'seoul.loop.dawn',
    kind: 'ambient',
    title: { ko: '새벽', en: 'Dawn' },
    characterId: 'tong',
    location: 'han_river',
    gate: { flags: ['origin_athlete'] },
    summary:
      '05:30, Monday. Everyone else is asleep. Run alone, wake a teammate (Ha-eun, Minji or Yerin, once paired), or sleep until seven. The run: Tong calls moves on the river path (formation grid, moves only). Team trust by who you train with; strain if overdone.',
    seeds: ['dawn_rest', 'tally team_haeun / team_minji / team_yerin', 'tally dawn'],
    beats: [
      {
        id: 'dw_open',
        speaker: 'narration',
        lines: [
          { when: { flags: ['dawn_seen'] }, value: { ko: '오전 5시 30분.', en: '05:30. Your body\'s alarm, again.' } },
          { value: { ko: '오전 5시 30분.', en: '05:30. Your eyes open on their own. Everyone else is asleep.' } },
        ],
        next: 'dw_tong',
      },
      {
        id: 'dw_tong',
        speaker: 'tong',
        lines: [
          { when: { flags: ['d1_tight_calf'], notFlags: ['dawn_seen'] }, value: { ko: '종아리는 괜찮아?', en: 'How\'s the calf?', note: 'Tong floats over the bunk, upside down.', review: 'native' } },
          { value: { ko: '몸이 아직 선수 시간이네.', en: 'Your body\'s still on athlete time.', review: 'native' } },
        ],
        choices: [
          {
            id: 'dw_alone',
            intent: 'commit',
            say: { ko: '뛰러 가자.', en: 'Let\'s go for a run.', rom: 'ttwireo gaja' },
            outcomes: [{ speaker: 'tong', reaction: { ko: '가자!', en: 'Let\'s go.' } }],
          },
          {
            id: 'dw_haeun',
            intent: 'ask',
            gate: { flags: ['h1_done'] },
            say: { ko: '하은 씨, 같이 뛸래요?', en: 'Ha-eun, want to run together?', rom: 'haeun ssi, gachi ttwillaeyo?' },
            outcomes: [{ speaker: 'narration', reaction: { ko: '…', en: 'She\'s already lacing her shoes.' }, tally: ['team_haeun'] }],
          },
          {
            id: 'dw_minji',
            intent: 'ask',
            gate: { flags: ['h1_done'] },
            say: { ko: '민지 씨, 같이 뛸래요?', en: 'Min-ji, want to run together?', rom: 'minji ssi, gachi ttwillaeyo?' },
            outcomes: [{ speaker: 'minji', reaction: { ko: '지금 몇 신데….', en: 'What time is it even….', note: 'She comes anyway.', review: 'native' }, tally: ['team_minji'] }],
          },
          {
            id: 'dw_yerin',
            intent: 'ask',
            gate: { flags: ['h1_done'] },
            say: { ko: '예린 씨, 같이 뛸래요?', en: 'Ye-rin, want to run together?', rom: 'yerin ssi, gachi ttwillaeyo?' },
            outcomes: [{ speaker: 'yerin', reaction: { ko: '응! 잠깐만!', en: 'Yes! One second!', review: 'native' }, tally: ['team_yerin'] }],
          },
          {
            id: 'dw_rest',
            intent: 'leave',
            say: { ko: '더 잘래.', en: 'I\'ll sleep a bit more.', rom: 'deo jallae' },
            outcomes: [{ speaker: 'tong', reaction: { ko: '그래. 일곱 시에 깨울게.', en: 'Okay. I\'ll wake you at seven.', review: 'native' }, setFlags: ['dawn_rest', 'dawn_seen'], next: 'dw_rested' }],
          },
        ],
        next: 'dw_run',
      },
      {
        id: 'dw_run',
        speaker: 'tong',
        lines: [{ value: { ko: '강변길. 내가 부를게.', en: 'The river path. I\'ll call it.', review: 'native' } }],
        exercise: {
          type: 'formation_grid',
          objectiveId: 'ko-vocab-directions',
          targets: ['move'],
          framing: { ko: '부르는 대로 뛰어!', en: 'Run where I call!' },
          onFail: 'continue',
        },
        next: 'dw_done',
      },
      {
        id: 'dw_done',
        speaker: 'narration',
        lines: [
          { when: { flags: ['ex_dw_run'] }, value: { ko: '…', en: 'Sweat, the river going pink. You\'re back before the dorm wakes up.' } },
          { value: { ko: '…', en: 'Your legs are heavier than you remember. You\'re back before the dorm wakes up.' } },
        ],
        effects: { setFlags: ['dawn_seen'], tally: ['dawn'] },
        end: true,
      },
      {
        id: 'dw_rested',
        speaker: 'narration',
        lines: [{ value: { ko: '…', en: 'You pull the blanket back up.' } }],
        end: true,
      },
    ],
  },
  presets: [
    { id: 'dw_first', label: 'First dawn, day 2 (alone or rest)', state: { day: 2 }, world: { hour: 5.5, playerLevel: 1, inputTier: 1, flags: { origin_athlete: true } }, path: ['dw_alone'] },
    { id: 'dw_partner', label: 'A later Monday: train with Ha-eun', state: { day: 9 }, world: { hour: 5.5, playerLevel: 1, inputTier: 1, flags: { origin_athlete: true, h1_done: true, dawn_seen: true } }, path: ['dw_haeun'] },
    { id: 'dw_rest', label: 'Sleep until seven', state: { day: 2 }, world: { hour: 5.5, playerLevel: 1, inputTier: 1, flags: { origin_athlete: true, d1_tight_calf: true } }, path: ['dw_rest'] },
  ],
};
