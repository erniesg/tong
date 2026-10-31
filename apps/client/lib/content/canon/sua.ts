import type { CharacterCanon } from '../../relationship/canon-types';

/** Sua is offstage for most of the route; her canon keeps the mystery consistent. */
export const SUA_CANON: CharacterCanon = {
  id: 'sua',
  name: { ko: '수아', en: 'Su-a' },
  age: 18,
  hometown: 'Jeju-si, Jeju',
  role: 'Former Onsae trainee. Now works at a café in Yeonnam-dong.',
  family: 'Family business in Jeju-si hit hard two years ago; Haeun quietly helped.',
  timeline: [
    { when: 'age 15', event: 'Comes up from Jeju with Haeun.', knownBy: ['haeun', 'sua'] },
    { when: 'year 2', event: 'Evals slip; the agency signals a cut is coming.', knownBy: ['sua', 'coach_park'] },
    { when: 'year 2', event: 'Realises Haeun\'s evals are suffering because Haeun keeps carrying her.', knownBy: ['sua'] },
    { when: 'two weeks before you arrive', event: 'Leaves before she can be cut. Writes the explanation on the last page of her practice notebook, jams it behind her locker drawer for Haeun, then sends several messages.', knownBy: ['sua'] },
    { when: 'after leaving', event: 'Gets a job at a Yeonnam café. Keeps track of Onsae; knows who took her spot.', knownBy: ['sua'] },
  ],
  people: [{ id: 'haeun', name: { ko: '하은', en: 'Ha-eun' }, relation: 'best friend', note: 'Sua\'s message thread is on 안읽씹.' }],
  ownedPlaces: [{ id: 'yeonnam_cafe', why: 'Where she works now.' }],
  facts: [
    {
      id: 'sua_messages',
      fact: 'Sua\'s messages, in order: "하은아" / "미안해" / "내 사물함 서랍 뒤에 노트 있어. 너한테 쓴 거야." / "직접 말 못 해서 미안." / "잘 지내." The chat list previews only the last one.',
      knownBy: ['sua'],
    },
    {
      id: 'notebook',
      fact: 'Practice notebook: choreo counts, schedules, a doodle of Haeun labelled "센터!!", her copy of their 인생네컷 strip tucked inside, and a last page written to Haeun, partly in Jeju.',
      knownBy: ['sua'],
    },
    { id: 'photo_strip', fact: '인생네컷 prints two strips. Haeun\'s copy is in her locker door; Sua\'s is inside the notebook.', knownBy: ['haeun', 'sua'] },
  ],
  secrets: [
    {
      id: 'why_sua_left',
      fact: 'Half saving face (leaving before being cut), half setting Haeun free (Haeun\'s evals were suffering because of her). She couldn\'t say either: Haeun would have refused to let her go.',
      knownBy: ['sua'],
      revealWhen: 'Notebook last page (H9), readable with enough Korean plus jeju_word for the Jeju line.',
      revealedIn: ['haeun.h9', 'haeun.h10'],
    },
  ],
  model: {
    publicLayer: 'Bright, easygoing.',
    privateLayer: 'Proud, guilty, conflict-avoidant.',
    attachment: 'Anxious-avoidant: leaves rather than be left.',
    gives: ['notes, doodles, small written things'],
    needs: ['to be forgiven without having to ask'],
    want: 'Haeun to debut.',
    need: 'To say it out loud.',
    wound: 'Being the one carried.',
    fear: 'That Haeun hates her.',
    conflictStyle: 'Avoids, then writes it down.',
    humor: 'Silly, doodles.',
    values: ['loyalty'],
    triggers: ['being pitied'],
    volatility: 0.4,
    moodTells: [],
  },
  speech: {
    rules: ['Softer than Haeun. Jeju comes out more easily with her.'],
    tics: ['하은아'],
    texting: ['Several short messages in a row.'],
    underPressure: 'Apologises, then leaves.',
    neverSays: [],
  },
  schedule: [{ slot: 'afternoons', where: 'yeonnam_cafe' }],
  mustNot: ['Never on screen before Act 3 except in photos.', 'Never written as a villain.'],
};
