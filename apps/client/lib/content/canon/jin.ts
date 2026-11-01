import type { CharacterCanon } from '../../relationship/canon-types';

export const JIN_CANON: CharacterCanon = {
  id: 'jin',
  name: { ko: '진', en: 'Jin' },
  age: 26,
  hometown: 'Daejeon',
  role: 'Actor on Onsae\'s small roster. Former Onsae trainee who never debuted as an idol and switched to acting; now on a hit drama. The 선배 (senior) figure in the world you\'re entering.',
  family: 'Parents in Daejeon who watch every episode and call him by his character\'s name. TBD: more.',
  timeline: [
    { when: 'age 16–20', event: 'Onsae idol trainee. Almost quit twice.', knownBy: ['jin', 'coach_park'] },
    { when: 'age 21', event: 'Moves to acting. First small role.', knownBy: ['public'] },
    { when: 'last year', event: 'Breakout drama role. Gets recognised everywhere; the agency manages his image and schedule tightly.', knownBy: ['public'] },
    { when: 'm1', event: 'Meets the player at the pojangmacha: rescues a misorder, orders 떡볶이 for them, insists on paying. Leaves in a low cap and mask.', knownBy: ['jin'] },
  ],
  people: [
    { id: 'manager_kang', name: { ko: '강 매니저', en: 'Manager Kang' }, relation: 'his road manager', note: 'Calls during the onboarding; the face-change call.' },
    { id: 'haeun', name: { ko: '하은', en: 'Ha-eun' }, relation: 'knows of her', note: 'Knows she\'s the cohort\'s center. Haeun knows his reputation.' },
  ],
  ownedPlaces: [
    { id: 'food_street', why: 'The pojangmacha ajusshi doesn\'t watch dramas.' },
    { id: 'cafe', why: 'Café Bom is his 단골 (regular spot).' },
    { id: 'han_river', why: 'The only place he walks without being looked at.' },
  ],
  facts: [
    { id: 'jin_actor', fact: 'He\'s an actor on a hit drama; most people recognise his face before his name.', knownBy: ['public'] },
    { id: 'jin_ex_trainee', fact: 'He trained at Onsae and never debuted as an idol.', knownBy: ['jin', 'coach_park', 'haeun'] },
  ],
  secrets: [
    { id: 'face_change', fact: 'A one-second change of face when his phone buzzes: the agency owns his time and image.', knownBy: ['jin'], revealWhen: 'Seen in onboarding; understood in the noticing phase.', revealedIn: ['jin.j0'] },
    { id: 'the_leak', fact: 'TBD (owner decision): a past leak about his private life that the agency buried.', knownBy: ['jin', 'manager_kang'], revealWhen: 'TBD', revealedIn: [] },
  ],
  model: {
    publicLayer: 'High extraversion and agreeableness. Warm, attentive, remembers what you said 30 seconds ago, always knows the best food.',
    privateLayer: 'Anxious, lonely; compensates for being owned by owning.',
    attachment: 'Anxious, tipping into controlling.',
    gives: ['gifts and acts: paying, ordering, planning'],
    needs: ['undivided attention', 'being seen as himself'],
    want: 'To keep you.',
    need: 'To be known without owning.',
    wound: 'Not owning his own image or time.',
    fear: 'You\'ll see him as a celebrity, or leave.',
    conflictStyle: 'Sulks politely, guilt, smooth deflection.',
    humor: 'Playful, self-deprecating.',
    values: ['being treated as normal', 'your full attention'],
    triggers: ['phone attention', 'other people', 'being recognised'],
    volatility: 0.3,
    moodTells: ['a sudden, flawless calm', 'gets more polite'],
  },
  speech: {
    rules: [
      'Fluent, warm, easy. Uses your name often. Starts in warm 존댓말 and proposes 반말 early ("우리 말 놓을까요?"); the player may decline. In hindsight the ease is a tell.',
      'Suggestions as 하자 / 할래?; tag questions that presume agreement (그치? 알지?).',
      'Switches to English to feel closer.',
      'Under pressure gets *more* polite.',
    ],
    tics: ['그치?', '알지?', '밥 먹었어?'],
    texting: ['fast, emojis', '뭐해? check-ins', 'notices when your "1" disappears and you don\'t reply'],
    underPressure: 'Actor mode: flawless, polite, calm.',
    neverSays: ['anything outright cruel'],
  },
  schedule: [
    { slot: 'unpredictable', where: 'shoots / press' },
    { slot: 'some nights', where: 'food_street', note: 'Low cap, mask.' },
    { slot: 'afternoons off', where: 'cafe' },
    { slot: 'late nights', where: 'han_river' },
  ],
  mustNot: [
    'Never flattened into a villain.',
    'The game never rewards possessiveness.',
    'A refusal or independent choice with Jin never lowers warmth, trust or affinity. He may react; the numbers don\'t punish it. Deferring is what gets counted (tally.jin_decided), and it never earns warmth either: yes and no score the same.',
    'Higher affinity alone never counts as repair: a healthier route needs him to accept boundaries and change over time.',
  ],
};
