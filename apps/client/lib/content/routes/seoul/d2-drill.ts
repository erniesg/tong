import type { SceneModule } from '../../../relationship/types';

/**
 * Day 2 · 대형 (Formation). Straight after H1: everyone reaches for water and
 * Coach Park isn't done. The first formation drill (the grid eval 1's dance
 * round remixes). Then: practice every day, the board has the rehearsal.
 */
export const module: SceneModule = {
  scene: {
    id: 'seoul.d2.drill',
    kind: 'story',
    title: { ko: '대형', en: 'Formation' },
    characterId: 'coach_park',
    location: 'practice_studio',
    slot: 'd2.s2',
    gate: { flags: ['h1_done'], month: { from: 1, to: 1 } },
    summary:
      'After H1. Coach Park: not done yet, formation. Tong gives the four directions and 칸. The formation grid (moves and poses, tier 1, ungraded). Coach Park reacts in one line; the Athlete is sent to the front row. Practice is every day now: the schedule board has the rehearsal.',
    seeds: ['drill_clean / drill_rough', 'd2_drill_done'],
    beats: [
      {
        id: 'dr_open',
        speaker: 'narration',
        lines: [{ value: { ko: '…', en: 'Everyone reaches for their water. Coach Park claps twice.' } }],
        next: 'dr_call',
      },
      {
        id: 'dr_call',
        speaker: 'coach_park',
        lines: [{ value: { ko: '아직 안 끝났어. 대형!', en: 'We\'re not done. Formation!', review: 'native' } }],
        tong: { ko: '대형 = 서는 자리!', en: '대형 (daehyeong) = formation: where everyone stands.', maxLevel: 3 },
        effects: { vocab: [{ ko: '대형', en: 'formation', rom: 'daehyeong' }] },
        next: 'dr_dirs',
      },
      {
        id: 'dr_dirs',
        speaker: 'tong',
        lines: [
          {
            value: {
              ko: '앞, 뒤, 왼쪽, 오른쪽. 한 칸, 두 칸.',
              en: '앞 is the mirror, 뒤 is behind you. 왼쪽, 오른쪽: left, right. 칸 is one square: 한 칸, 두 칸.',
              review: 'native',
            },
          },
        ],
        next: 'dr_grid',
      },
      {
        id: 'dr_grid',
        speaker: 'coach_park',
        lines: [{ value: { ko: '내가 부르면 움직여.', en: 'When I call it, move.', review: 'native' } }],
        exercise: {
          type: 'formation_grid',
          objectiveId: 'ko-vocab-directions',
          targets: ['move', 'pose'],
          framing: { ko: '내가 부르면 움직여.', en: 'Move on the call.' },
          onFail: 'continue',
        },
        next: 'dr_clean',
      },
      {
        id: 'dr_clean',
        speaker: 'coach_park',
        when: { flags: ['ex_dr_grid'] },
        lines: [{ value: { ko: '그래. 그거야.', en: 'Yes. That\'s it.', note: 'He doesn\'t say it twice.', review: 'native' } }],
        effects: { setFlags: ['drill_clean'] },
        next: 'dr_rough',
      },
      {
        id: 'dr_rough',
        speaker: 'coach_park',
        when: { notFlags: ['drill_clean'] },
        lines: [{ value: { ko: '다시. 내일도.', en: 'Again. Tomorrow too.', review: 'native' } }],
        effects: { setFlags: ['drill_rough'] },
        next: 'dr_front',
      },
      {
        id: 'dr_front',
        speaker: 'coach_park',
        when: { flags: ['origin_athlete'] },
        lines: [{ value: { ko: '{name}, 앞줄. 어제 말했지.', en: '{name}, front row. I told you yesterday.', review: 'native' } }],
        tong: { ko: '앞줄 = 맨 앞!', en: '앞줄 = the front row. 앞 again.', maxLevel: 3 },
        next: 'dr_mirror',
      },
      {
        id: 'dr_mirror',
        speaker: 'narration',
        lines: [
          { when: { flags: ['drill_clean'] }, value: { ko: '…', en: 'In the mirror, Ha-eun looks at your feet. Then away.' } },
          { value: { ko: '…', en: 'In the mirror, Ha-eun is already back on her spot.' } },
        ],
        next: 'dr_end',
      },
      {
        id: 'dr_end',
        speaker: 'coach_park',
        lines: [{ value: { ko: '내일부터 매일 연습. 스케줄표 봐.', en: 'Practice every day from tomorrow. Check the schedule board.', review: 'native' } }],
        tong: { ko: '스케줄표 = 일정!', en: 'The 스케줄표 by the door has the rehearsal: the same grid, any day.', maxLevel: 3 },
        effects: { setFlags: ['d2_drill_done'], vocab: [{ ko: '연습', en: 'practice', rom: 'yeonseup' }] },
        end: true,
      },
    ],
  },
  presets: [
    { id: 'd2d_clean', label: 'Clean drill', state: { day: 2 }, world: { hour: 11, playerLevel: 1, inputTier: 1, flags: { h1_done: true } } },
    { id: 'd2d_rough', label: 'Rough drill', state: { day: 2 }, world: { hour: 11, playerLevel: 0, inputTier: 1, flags: { h1_done: true } }, exercises: { dr_grid: false } },
    { id: 'd2d_athlete', label: 'Athlete: front row', state: { day: 2 }, world: { hour: 11, playerLevel: 1, inputTier: 1, flags: { h1_done: true, origin_athlete: true } } },
  ],
};
