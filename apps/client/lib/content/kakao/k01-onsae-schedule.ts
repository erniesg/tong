import type { KakaoModule } from '../../relationship/types';

/** Group chat notice: pure reading practice. A one-word ack or nothing. */
export const module: KakaoModule = {
  thread: {
    id: 'kakao.onsae.schedule',
    characterId: 'onsae_group',
    title: '온새 연습생 단톡',
    gate: { month: { from: 1, to: 12 } },
    at: '21:00',
    summary: 'Manager Choi posts tomorrow\'s schedule in the trainee group chat. Read it; reply 넵 or nothing. Teaches 체중 측정, 통금, 엄수.',
    messages: [
      { from: 'them', ko: '최 실장: [공지] 내일 일정입니다.', en: 'Manager Choi: [Notice] Tomorrow\'s schedule.' },
      {
        from: 'them',
        ko: '07:30 체중 측정\n10:00 보컬\n14:00 댄스 (박 코치님)\n19:00 한국어 수업\n23:00 통금 엄수',
        en: '07:30 weigh-in\n10:00 vocals\n14:00 dance (Coach Park)\n19:00 Korean class\n23:00 curfew, strictly observed',
      },
      { from: 'them', ko: '민지: 넵!', en: 'Minji: Yes sir!', delay: 1 },
      { from: 'them', ko: '예린: 넵~', en: 'Yerin: Yep~', delay: 0 },
    ],
    replies: [
      {
        id: 'ack',
        intent: 'commit',
        say: { ko: '넵!', rom: 'nep!', en: 'Yes! (casual-polite ack)' },
        outcomes: [
          {
            messages: [],
            vocab: [
              { ko: '체중 측정', rom: 'chejung cheukjeong', en: 'weigh-in' },
              { ko: '통금 엄수', rom: 'tonggeum eomsu', en: 'curfew strictly observed' },
            ],
          },
        ],
      },
      {
        id: 'formal',
        intent: 'commit',
        say: { ko: '알겠습니다!', rom: 'algetseumnida!', en: 'Understood! (formal)' },
        outcomes: [{ messages: [{ from: 'them', ko: '민지: ㅋㅋ 군대야?', en: 'Minji: lol is this the army?', delay: 1 }] }],
      },
      { id: 'read', intent: 'leave', say: { ko: '(읽씹)', en: '(leave it on read)' }, outcomes: [{ messages: [] }] },
    ],
  },
  presets: [{ id: 'm1', label: 'Month 1, first week.', state: { stage: 'strangers', day: 3 }, world: { hour: 21 } }],
};
