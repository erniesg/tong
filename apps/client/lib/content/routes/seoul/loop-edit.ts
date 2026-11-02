import type { SceneModule } from '../../../relationship/types';

/**
 * Creator loop · 편집 (The edit). Monday nights, phone under the blanket
 * (phones are allowed after 9). Cut the week's clips, caption them in Korean,
 * decide where they go. The first time is the month-1 choice about the
 * posting ban: keep a private archive, or post on a secret account.
 * Sending footage to someone specific opens later (Ha-eun, then her mum).
 */
export const module: SceneModule = {
  scene: {
    id: 'seoul.loop.edit',
    kind: 'ambient',
    title: { ko: '편집', en: 'The edit' },
    characterId: 'tong',
    location: 'dorm',
    gate: { flags: ['origin_creator'] },
    summary:
      'Monday night, in your bunk. Pick the clip, caption it (block crush: 도착 the first week, letters you already have), then where it goes: the private archive (safe; builds the library) or a secret account (reach; exposure, toll +1). Or not tonight.',
    seeds: ['edit_archive / secret_account', 'tally footage', 'hangul:도착'],
    beats: [
      {
        id: 'ed_open',
        speaker: 'narration',
        lines: [
          { when: { flags: ['edited_once'] }, value: { ko: '…', en: 'Phone under the blanket. This week\'s clips.' } },
          { value: { ko: '…', en: 'Phone under the blanket. Yesterday\'s clips: the baggage belt, the train window, the 홍대입구 sign.' } },
        ],
        next: 'ed_tong',
      },
      {
        id: 'ed_tong',
        speaker: 'tong',
        lines: [{ value: { ko: '편집할 거야?', en: 'Editing?', review: 'native' } }],
        choices: [
          {
            id: 'ed_cut',
            intent: 'commit',
            say: { ko: '응, 자르자.', en: 'Yeah. Let\'s cut.', rom: 'eung, jareuja' },
            outcomes: [{ speaker: 'tong', reaction: { ko: '자막도 달자.', en: 'Captions too. In Korean.', review: 'native' } }],
          },
          {
            id: 'ed_not',
            intent: 'leave',
            say: { ko: '오늘은 안 할래.', en: 'Not tonight.', rom: 'oneureun an hallae' },
            outcomes: [{ speaker: 'tong', reaction: { ko: '그래. 자.', en: 'Okay. Sleep.' }, next: 'ed_skipped' }],
          },
        ],
        next: 'ed_caption',
      },
      {
        id: 'ed_caption',
        speaker: 'tong',
        lines: [
          {
            when: { notFlags: ['edited_once'] },
            value: { ko: '도착. 다 아는 글자야.', en: 'Caption: 도착, "arrived". You know every letter in it: ㄷ ㅗ from 홍대, ㅊ ㄱ from 출구, ㅏ from 일반.', review: 'native' },
          },
          { value: { ko: '자막 달자.', en: 'Caption it.' } },
        ],
        exercise: {
          type: 'block_crush',
          objectiveId: 'ko-hangul-reuse',
          targets: ['도착'],
          framing: { ko: '자막: 도착', en: 'Caption: 도착, arrived.' },
          onFail: 'continue',
        },
        effects: { setFlags: ['hangul:도착'], vocab: [{ ko: '도착', en: 'arrival, arrived', rom: 'dochak' }] },
        next: 'ed_where',
      },
      {
        id: 'ed_where',
        speaker: 'tong',
        lines: [
          { when: { flags: ['secret_account'] }, value: { ko: '이번에도 올려?', en: 'Posting this one too?', review: 'native' } },
          { value: { ko: '어디에 둘 거야? SNS 금지야.', en: 'Where does it go? Social media is banned, remember.', review: 'native' } },
        ],
        choices: [
          {
            id: 'ed_archive',
            intent: 'commit',
            say: { ko: '나만 볼 거야.', en: 'Just for me.', rom: 'naman bol geoya' },
            outcomes: [{ speaker: 'tong', reaction: { ko: '보관함에 저장.', en: 'Saved to the archive.', review: 'native' }, setFlags: ['edit_archive', 'edited_once'], tally: ['footage'] }],
          },
          {
            id: 'ed_post',
            intent: 'commit',
            say: { ko: '비밀 계정에 올리자.', en: 'Post it on a secret account.', rom: 'bimil gyejeonge ollija' },
            outcomes: [
              { when: { flags: ['pr_photo'] }, speaker: 'narration', reaction: { ko: '…', en: 'Three comments in a minute. One links the fan\'s airport photo.' }, setFlags: ['secret_account', 'edited_once'], tally: ['footage', 'toll'] },
              { speaker: 'narration', reaction: { ko: '…', en: 'Posted. A like, then another, from strangers.' }, setFlags: ['secret_account', 'edited_once'], tally: ['footage', 'toll'] },
            ],
          },
        ],
        end: true,
      },
      {
        id: 'ed_skipped',
        speaker: 'narration',
        lines: [{ value: { ko: '…', en: 'You put the phone face down.' } }],
        end: true,
      },
    ],
  },
  presets: [
    { id: 'ed_first', label: 'First edit, archive', state: { day: 2 }, world: { hour: 22, playerLevel: 1, inputTier: 1, flags: { origin_creator: true } }, path: ['ed_cut', 'ed_archive'] },
    { id: 'ed_post_photo', label: 'Post, with the airport photo out', state: { day: 2 }, world: { hour: 22, playerLevel: 1, inputTier: 1, flags: { origin_creator: true, pr_photo: true } }, path: ['ed_cut', 'ed_post'] },
    { id: 'ed_not', label: 'Not tonight', state: { day: 9 }, world: { hour: 22, playerLevel: 1, inputTier: 1, flags: { origin_creator: true, edited_once: true } }, path: ['ed_not'] },
  ],
};
