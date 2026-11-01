import type { CharacterCanon } from '../../relationship/canon-types';

/**
 * The girls' trainee cohort at Onsae (female player's route) and the dorm
 * rooms they live in. Owner decisions 2026-11-01: separate buildings by gender;
 * you share Haeun's dorm but not her room at first (docs/seoul-evals-tbc.md T17).
 * Roles are agreed; arcs beyond them are not canon yet. Korean examples are
 * placeholders until native review (#395).
 */

export const DOHEE_CANON: CharacterCanon = {
  id: 'dohee',
  name: { ko: '도희', en: 'Do-hee' },
  age: 18,
  hometown: 'Mapo, Seoul',
  role: 'Onsae trainee. Fan favourite on a survival show last year; the debut group was scrapped after a show and company scandal, and Onsae signed her. Haeun\'s rival: popularity against skill.',
  family: 'Seoul family who come to every showcase. Lives at the dorm because the agency requires it.',
  timeline: [
    { when: 'last year', event: 'Finishes in the debut line on a survival show. The group is scrapped before it debuts.', knownBy: ['public'] },
    { when: 'this winter', event: 'Signs with Onsae. Moves into the dorm, into Haeun\'s room.', knownBy: ['trainees', 'manager_choi'] },
  ],
  people: [
    { id: 'haeun', name: { ko: '하은', en: 'Ha-eun' }, relation: 'roommate and rival', note: 'Polite to each other; neither gives an inch.' },
  ],
  ownedPlaces: [],
  facts: [
    { id: 'dohee_survival', fact: 'She was on a survival show and still has fans who know her face.', knownBy: ['public', 'trainees'] },
  ],
  secrets: [],
  model: {
    publicLayer: 'Bright, easy, good on camera. Remembers fans\' names.',
    privateLayer: 'Tired of being liked for a show that ended. Knows Haeun is the better dancer.',
    attachment: 'Secure with fans, guarded with peers.',
    gives: ['introductions', 'tips on cameras and fans'],
    needs: ['to be rated on her work, not her fame'],
    want: 'Debut this time, for real.',
    need: 'To find out if she is good without the audience.',
    wound: 'A debut taken away by other people\'s mistakes.',
    fear: 'That the show was the best she will ever be.',
    conflictStyle: 'Smiles and competes harder.',
    humor: 'Self-aware, quick.',
    values: ['being seen', 'loyalty to fans', 'winning fairly'],
    triggers: ['being called "the survival girl"', 'Haeun\'s praise from Coach Park'],
    volatility: 0.4,
    moodTells: ['checks her reflection more', 'laughs too fast'],
  },
  speech: {
    rules: ['Friendly 해요체 with you; 반말 with the trainees she has known since winter.', 'Talks like someone used to cameras: tidy sentences, a bright finish.'],
    tics: ['대박', '진짜요?'],
    texting: ['emoji, exclamation marks, fast replies'],
    underPressure: 'Gets brighter and louder.',
    neverSays: ['anything bad about her old show-mates'],
  },
  schedule: [
    { slot: '07:00–09:00', where: 'dorm' },
    { slot: '10:00–22:00', where: 'practice_studio' },
    { slot: '23:00', where: 'dorm', note: 'Curfew.' },
  ],
  mustNot: ['No romance and no scandal arc yet (owner: maybe later, not built).'],
};

export const DAON_CANON: CharacterCanon = {
  id: 'daon',
  name: { ko: '다온', en: 'Da-on' },
  age: 15,
  hometown: 'Gwangju',
  role: 'The youngest trainee. Still in middle school: classes in the morning, the studio after. Idolises Haeun.',
  family: 'Parents in Gwangju. Calls her mum most nights.',
  timeline: [
    { when: 'last spring', event: 'Cast at an open audition. Moves into the dorm.', knownBy: ['trainees'] },
    { when: 'm1 d1', event: 'You become her roommate. She has been asking for an 언니 in her room.', knownBy: ['trainees', 'manager_choi'] },
  ],
  people: [
    { id: 'haeun', name: { ko: '하은', en: 'Ha-eun' }, relation: 'idol', note: 'Copies her warm-up. Would love to room with her.' },
    { id: 'boram', name: { ko: '보람', en: 'Bo-ram' }, relation: 'roommate', note: 'Boram wakes her for school.' },
  ],
  ownedPlaces: [],
  facts: [
    { id: 'daon_school', fact: 'She goes to middle school in the morning.', knownBy: ['trainees'] },
  ],
  secrets: [],
  model: {
    publicLayer: 'Loud, cheerful, the baby of the dorm.',
    privateLayer: 'Homesick at night; afraid she is only kept because she is young.',
    attachment: 'Anxious: wants to be liked by everyone, now.',
    gives: ['snacks', 'gossip she half understands', 'calling you 언니'],
    needs: ['being taken seriously'],
    want: 'Haeun to notice her.',
    need: 'To stop measuring herself against Haeun.',
    wound: 'Being treated as a kid.',
    fear: 'Being sent home.',
    conflictStyle: 'Sulks, then forgives fast.',
    humor: 'Silly, loud.',
    values: ['fairness', 'friends'],
    triggers: ['being left out', 'anyone closer to Haeun than her'],
    volatility: 0.6,
    moodTells: ['quiet at dinner', 'top bunk curtain closed'],
  },
  speech: {
    rules: [
      'Calls you 언니 from the first minute and uses 존댓말 with every older trainee.',
      'Teaches 호칭 by using it: 언니, 실장님, 코치님.',
      'Teen slang and abbreviations; ends questions with 요? even when excited.',
    ],
    tics: ['헐', '언니!'],
    texting: ['ㅋㅋㅋ, stickers, voice notes'],
    underPressure: 'Talks faster and apologises.',
    neverSays: ['반말 to an older trainee'],
  },
  schedule: [
    { slot: '07:00–08:00', where: 'dorm' },
    { slot: '08:00–14:00', where: 'school' },
    { slot: '15:00–21:00', where: 'practice_studio' },
    { slot: '22:00', where: 'dorm' },
  ],
  mustNot: ['Never out after curfew (she is 15).', 'No romance involving her.'],
};

export const BORAM_CANON: CharacterCanon = {
  id: 'boram',
  name: { ko: '보람', en: 'Bo-ram' },
  age: 22,
  hometown: 'Daegu',
  role: 'The oldest trainee, seven years in. Strong dancer who is slipping. Looks after the dorm. Knew Sua well.',
  family: 'Family in Daegu who have stopped asking when she debuts.',
  timeline: [
    { when: 'age 15', event: 'Joins Onsae.', knownBy: ['trainees', 'coach_park'] },
    { when: 'eval 6 (August)', event: 'Cut from the debut line. Stays on as assistant choreographer and moves out; the agency merges rooms, so Sua\'s bed must be filled.', knownBy: ['everyone'] },
    { when: 'two weeks before you arrive', event: 'Helps Sua carry her bags out. Says nothing to anyone.', knownBy: ['boram', 'sua'] },
  ],
  people: [
    { id: 'sua', name: { ko: '수아', en: 'Su-a' }, relation: 'friend', note: 'Knew she was leaving. Not ready to talk about it.' },
    { id: 'daon', name: { ko: '다온', en: 'Da-on' }, relation: 'roommate', note: 'Wakes her for school.' },
  ],
  ownedPlaces: [],
  facts: [
    { id: 'boram_years', fact: 'She has trained at Onsae for seven years.', knownBy: ['trainees'] },
  ],
  secrets: [
    { id: 'boram_saw_sua_leave', fact: 'She helped Sua carry her bags out the night she left.', knownBy: ['boram', 'sua'], revealWhen: 'tbc (T10): not before the owner decides how Sua is found.', revealedIn: [] },
  ],
  model: {
    publicLayer: 'Calm, practical, the one who knows where the spare key is.',
    privateLayer: 'Knows her time is running out. Already half a teacher.',
    attachment: 'Secure.',
    gives: ['rules nobody wrote down', 'covering for the young ones'],
    needs: ['someone to say her years counted'],
    want: 'One more chance at debut.',
    need: 'To find a life in the industry that isn\'t debut.',
    wound: 'Watching younger trainees pass her.',
    fear: 'Leaving with nothing to show for seven years.',
    conflictStyle: 'Quiet word in private.',
    humor: 'Dry, older-sister.',
    values: ['looking after people', 'craft'],
    triggers: ['the young ones being treated unfairly'],
    volatility: 0.2,
    moodTells: ['stretches alone in the kitchen at night'],
  },
  speech: {
    rules: ['반말 to younger trainees from day one, the way a senior does; warm, not rude.', 'Explains dorm rules in short, practical lines.'],
    tics: ['됐고', '자, 자'],
    texting: ['short, practical, no emoji'],
    underPressure: 'Gets quieter and busier.',
    neverSays: ['anything about Sua before T10 is decided'],
  },
  schedule: [
    { slot: '06:30–09:00', where: 'dorm', note: 'Up first; wakes Daon.' },
    { slot: '10:00–21:00', where: 'practice_studio' },
    { slot: '22:30', where: 'dorm' },
  ],
  mustNot: ['Do not reveal anything about Sua (T10).', 'She is cut at eval 6 (owner, 2026-11-01): expected, unpreventable; she stays on as assistant choreographer and moves out of the dorm.'],
};

export const YUNSEO_CANON: CharacterCanon = {
  id: 'yunseo',
  name: { ko: '윤서', en: 'Yun-seo' },
  age: 19,
  hometown: 'Seocho, Seoul',
  role: 'The rich kid. Flawless honorifics; extra-polite -세요 as a put-down. Golden Bell (eval 5) rival.',
  family: 'Wealthy Seoul family; private tutors since primary school.',
  timeline: [
    { when: 'last year', event: 'Joins Onsae after years of private lessons.', knownBy: ['trainees'] },
  ],
  people: [
    { id: 'minji', name: { ko: '민지', en: 'Minji' }, relation: 'roommate', note: 'Tolerates the gossip; listens to all of it.' },
  ],
  ownedPlaces: [],
  facts: [
    { id: 'yunseo_tutors', fact: 'She had private tutors for everything, including Korean writing.', knownBy: ['trainees'] },
  ],
  secrets: [],
  model: {
    publicLayer: 'Composed, impeccable, never late.',
    privateLayer: 'Has never been allowed to be bad at anything.',
    attachment: 'Avoidant.',
    gives: ['corrections nobody asked for'],
    needs: ['to be beaten fairly and survive it'],
    want: 'To win the Golden Bell.',
    need: 'To make a mistake in public and be fine.',
    wound: 'Love that came with grades.',
    fear: 'Being ordinary.',
    conflictStyle: 'Politeness as a blade.',
    humor: 'Rare, sharp.',
    values: ['correctness', 'manners'],
    triggers: ['sloppy Korean', 'being called lucky'],
    volatility: 0.3,
    moodTells: ['even more polite', 'corrects someone\'s spelling'],
  },
  speech: {
    rules: ['Textbook 하십시오체 and -세요 to people she looks down on; the politeness is the insult.', 'Never uses slang.'],
    tics: ['그러세요?', '아, 그렇게 쓰시는구나.'],
    texting: ['full sentences, full stops'],
    underPressure: 'Formal to the point of absurd.',
    neverSays: ['ㅋㅋ', 'slang'],
  },
  schedule: [
    { slot: '07:00–09:00', where: 'dorm' },
    { slot: '10:00–21:00', where: 'practice_studio' },
    { slot: '23:00', where: 'dorm' },
  ],
  mustNot: ['Money is not her storyline on Haeun\'s route; that is the International-School Kid origin (docs/seoul-origins.md).'],
};

/**
 * The other foreign trainee. One is picked per save from those whose
 * nationality differs from the player's; the rest live on the dorm's other
 * floor, in other Onsae units. Nationality values match the cozy creator
 * (eval1.js PROFILE_OPTIONS.nationality, Korean names).
 */
export const FOREIGN_TRAINEES: { id: string; nationality: string; name: { ko: string; en: string }; age: number; hometown: string; note: string }[] = [
  { id: 'xiaoyu', nationality: '중국', name: { ko: '샤오위', en: 'Xiaoyu' }, age: 18, hometown: 'Chengdu', note: 'A year ahead of you in Korean. Watches Chinese dramas at night with one earbud.' },
  { id: 'haruna', nationality: '일본', name: { ko: '하루나', en: 'Haruna' }, age: 19, hometown: 'Osaka', note: 'Neat, quiet, very good at Korean listening, shy speaking it.' },
  { id: 'mint', nationality: '태국', name: { ko: '민트', en: 'Mint' }, age: 18, hometown: 'Bangkok', note: 'Everyone\'s favourite; teaches the dorm Thai snacks.' },
  { id: 'linh', nationality: '베트남', name: { ko: '린', en: 'Linh' }, age: 17, hometown: 'Hanoi', note: 'Studies Korean grammar from a worn textbook every night.' },
  { id: 'ayu', nationality: '인도네시아', name: { ko: '아유', en: 'Ayu' }, age: 18, hometown: 'Jakarta', note: 'Big laugh; the dorm\'s best cook.' },
  { id: 'bea', nationality: '필리핀', name: { ko: '비아', en: 'Bea' }, age: 19, hometown: 'Quezon City', note: 'Strong vocalist; sings while she cleans.' },
];

/** Deterministic: same seed and nationality, same trainee. */
export function pickForeignTrainee(seed: number, playerNationality: string | null) {
  const pool = FOREIGN_TRAINEES.filter((t) => t.nationality !== playerNationality);
  return pool[(seed >>> 0) % pool.length];
}

/**
 * Rooms on your floor of the girls' dorm. Room A is Haeun's, with Sua's bed
 * kept empty; you start in room B. At the reshuffle after a cut (T17) you can
 * ask Haeun for Sua's bed.
 */
export const DORM_ROOMS = [
  { id: 'room_a', beds: ['haeun', 'dohee', 'sua_empty'], note: 'Bunk (Haeun below, Dohee above) and Sua\'s single bed, stripped. Haeun keeps it empty with polite excuses.' },
  { id: 'room_b', beds: ['player', 'daon', 'boram'], note: 'Bunk (you below, Daon above) and Boram\'s single by the window.' },
  { id: 'room_c', beds: ['minji', 'yerin', 'yunseo', 'foreign_trainee'], note: 'Two bunks.' },
];
