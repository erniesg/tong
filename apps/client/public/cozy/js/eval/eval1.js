// Eval 1 (March · TOPIK 1) content and seeded item builders.
// Sources: docs/seoul-evals.md → "Eval 1", docs/seoul-songs.md → Song 1 좋아요.
// Every Korean line here still needs native review (#395). Lines not given by the design
// docs are functional placeholders and carry review: 'native'.
import { pickForeignTrainee } from '../cohort-data.js';

import { rng, hashSeed, shuffled } from './runner.js';
import { makeCalls } from './dance.js';

export const EVAL1 = {
  month: 1,
  title: { ko: '입소 평가', en: 'Entry eval' },
  rounds: [
    { id: 'vocal', ko: '보컬', en: 'Vocal', skill: 'listening', maxTier: 3, slot: 'morning' },
    { id: 'dance', ko: '댄스', en: 'Dance', skill: 'listening', maxTier: 2, slot: 'morning' },
    { id: 'judges', ko: '심사', en: 'Judges', skill: 'writing', maxTier: 2, slot: 'morning' },
    { id: 'field', ko: '현장 미션', en: 'Field quest', skill: 'speaking', maxTier: 2, slot: 'afternoon' },
  ],
};

/* ── Song 1 · 좋아요 ─────────────────────────────── */

/** Line ids double as keys for the song's future timing map (start/end ms per line). */
export const SONG1 = {
  id: 'song1', title: '좋아요', bpm: 100,
  lines: {
    c1: { ko: '오늘은 날씨가 좋아요', en: 'The weather is nice today.' },
    c2: { ko: '친구하고 공원에 가요', en: 'I go to the park with a friend.' },
    c3: { ko: '김밥 두 줄, 물 두 개', en: 'Two rolls of gimbap, two waters.' },
    b1: { ko: '내일은 비가 와요?', en: 'Will it rain tomorrow?' },
    b2: { ko: '괜찮아요, 우산이 있어요', en: 'It\'s okay, I have an umbrella.' },
  },
};

const DICTATION = [
  {
    line: 'c1', objective: 'ko-vocab-weather',
    meanings: ['The weather is nice today.', 'It will rain tomorrow.', 'I go to the park with a friend.', 'The wind is cold today.'],
    blocks: ['오늘은', '날씨가', '좋아요'], distractors: ['날씨는', '좋아해요'],
  },
  {
    line: 'c2', objective: 'ko-gram-hago',
    meanings: ['I go to the park with a friend.', 'My friend comes to the park.', 'The weather is nice today.', 'I eat gimbap with a friend.'],
    blocks: ['친구하고', '공원에', '가요'], distractors: ['공원에서', '와요'],
  },
];

const COMPREHENSION = [
  { id: 'who', line: 'c2', q: '누구하고 공원에 가요?', qEn: 'Who do they go to the park with?', answer: '친구', options: ['친구', '가족', '선생님', '혼자'], objective: 'ko-gram-hago' },
  { id: 'rolls', line: 'c3', q: '김밥 몇 줄 있어요?', qEn: 'How many rolls of gimbap are there?', answer: '두 줄', options: ['한 줄', '두 줄', '세 줄', '두 개'], objective: 'ko-gram-counters' },
  { id: 'weather', line: 'b1', q: '내일 날씨는 어때요?', qEn: 'What is tomorrow\'s weather like?', answer: '비가 와요', options: ['비가 와요', '날씨가 좋아요', '눈이 와요', '바람이 좋아요'], objective: 'ko-vocab-weather' },
  { id: 'umbrella', line: 'b2', q: '우산이 있어요?', qEn: 'Do they have an umbrella?', answer: '네, 있어요', options: ['네, 있어요', '아니요, 없어요', '네, 좋아요'], objective: 'ko-gram-isseoyo' },
];

const opt = (ko, en) => ({ id: ko, ko, ...(en ? { en } : {}) });
const blockSet = (rand, words, distractors) => shuffled([...words, ...distractors], rand).map((text, i) => ({ id: `b${i}`, text }));

export function vocalItems(seed, tier = 1) {
  const rand = rng(hashSeed(seed, 'vocal', tier));
  const items = DICTATION.map((d, i) => {
    const line = SONG1.lines[d.line];
    const base = { id: `vocal-dict-${i + 1}`, objective: d.objective, audio: { song: SONG1.id, line: d.line, text: line.ko }, hint: line.en };
    if (tier === 1) {
      return { ...base, skill: 'listening', type: 'choice', prompt: { ko: line.ko, en: 'What does this line mean?', showText: true },
        options: shuffled(d.meanings, rand).map((m) => ({ id: m, ko: m })), answer: [line.en], hint: `${d.blocks.join(' · ')}` };
    }
    if (tier === 2) {
      return { ...base, skill: 'writing', type: 'blocks', prompt: { ko: '들은 가사를 만들어요.', en: 'Build the line you hear.', showText: false },
        blocks: blockSet(rand, d.blocks, d.distractors), answer: [d.blocks] };
    }
    return { ...base, skill: 'writing', type: 'type', prompt: { ko: '들은 가사를 써요.', en: 'Type the line you hear.', showText: false }, answer: [line.ko] };
  });
  for (const c of COMPREHENSION) {
    const line = SONG1.lines[c.line];
    items.push({
      id: `vocal-q-${c.id}`, skill: 'listening', objective: c.objective, type: 'choice',
      audio: { song: SONG1.id, line: c.line, text: line.ko },
      context: { ko: line.ko, showText: tier === 1 },
      prompt: { ko: c.q, en: c.qEn, showText: true },
      options: shuffled(c.options, rand).map((o) => opt(o)), answer: [c.answer], hint: `${line.ko} · ${line.en}`,
    });
  }
  return items;
}

/* ── Dance ───────────────────────────────────────── */

export function danceItems(seed, tier = 1, n = 8) {
  return makeCalls(hashSeed(seed, 'dance-round', tier), n).map((c) => ({
    ...c, type: 'dance', audio: { text: c.ko.replace(/!$/, '') }, prompt: { ko: c.ko, en: c.en, showText: tier === 1 }, hint: c.en,
  }));
}

/* ── Judges: profile form + interview ────────────── */

/** Profile choices for the trainee card (ungraded setup until the creator collects these). */
export const PROFILE_OPTIONS = {
  nationality: [
    ['싱가포르', 'Singapore'], ['말레이시아', 'Malaysia'], ['인도네시아', 'Indonesia'], ['필리핀', 'Philippines'], ['베트남', 'Vietnam'],
    ['태국', 'Thailand'], ['중국', 'China'], ['일본', 'Japan'], ['인도', 'India'], ['미국', 'USA'], ['캐나다', 'Canada'],
    ['영국', 'UK'], ['프랑스', 'France'], ['독일', 'Germany'], ['호주', 'Australia'], ['브라질', 'Brazil'], ['멕시코', 'Mexico'],
  ],
  hobby: [['노래', 'singing'], ['춤', 'dancing'], ['요리', 'cooking'], ['사진', 'photography'], ['운동', 'sport'], ['게임', 'games'], ['영화', 'films'], ['그림', 'drawing']],
  family: [2, 3, 4, 5, 6],
};
/** 주말에 보통 ___ — what you do, from the hobby. */
const HOBBY_DO = { 노래: '노래해요', 춤: '춤춰요', 요리: '요리해요', 사진: '사진을 찍어요', 운동: '운동해요', 게임: '게임을 해요', 영화: '영화를 봐요', 그림: '그림을 그려요' };
const NATIVE = { 2: '두', 3: '세', 4: '네', 5: '다섯', 6: '여섯' };
const SINO = { 2: '이', 3: '삼', 4: '사', 5: '오', 6: '육' };

/** Age is fixed by the game (TODO owner: confirm 18, same as Haeun and Sua); the year follows from it. */
export const PLAYER_AGE = 18;
export const GAME_START_YEAR = 2026; // TODO owner: the in-game year of the March you arrive
export const birthYear = () => GAME_START_YEAR - PLAYER_AGE;

/** Nationality and birthday come from the creator; hobby, skill and family from the arrival registration. */
export function defaultProfile(name = '연습생', who = {}) {
  return {
    name,
    nationality: who.nationality || '싱가포르',
    birth: { y: birthYear(), m: who.birthday?.m || 5, d: who.birthday?.d || 3 },
    hobby: '노래', specialty: '춤', family: 4,
  };
}

export const birthKo = (b) => `${b.y}년 ${b.m}월 ${b.d}일`;
const syllables = (s) => [...s.replace(/\s/g, '')];
const HANGUL = /^[\p{Script=Hangul}\s]+$/u;

export const FORM_FIELDS = [
  { id: 'name', ko: '이름', en: 'Name' },
  { id: 'nationality', ko: '국적', en: 'Nationality' },
  { id: 'birth', ko: '생년월일', en: 'Date of birth' },
  { id: 'hobby', ko: '취미', en: 'Hobby' },
  { id: 'specialty', ko: '특기', en: 'Special skill' },
];

export function profileValue(profile, field) {
  return field === 'birth' ? birthKo(profile.birth) : String(profile[field]);
}

export function judgesItems(seed, tier = 1, profile) {
  const rand = rng(hashSeed(seed, 'judges', tier));
  const values = Object.fromEntries(FORM_FIELDS.map((f) => [f.id, profileValue(profile, f.id)]));
  const spare = ['라', '스', '리', '마', '도'];
  const items = FORM_FIELDS.map((f) => {
    const value = values[f.id];
    const base = { id: `judges-form-${f.id}`, skill: 'writing', objective: 'ko-func-self-intro', field: f.id, formLabel: f.ko, hint: `${f.ko} = ${f.en}` };
    const buildable = f.id === 'birth' || HANGUL.test(value);
    if (tier >= 2 && buildable) {
      const words = f.id === 'birth' ? [`${profile.birth.y}년`, `${profile.birth.m}월`, `${profile.birth.d}일`] : syllables(value);
      const distractors = f.id === 'birth' ? [`${profile.birth.d}월`, `${profile.birth.m}일`] : [spare.find((s) => !words.includes(s))];
      return { ...base, type: 'blocks', prompt: { ko: `${f.ko}: 블록으로 써요.`, en: `Fill in ${f.ko} with blocks.`, showText: true }, blocks: blockSet(rand, words, distractors), answer: [words] };
    }
    const others = shuffled(FORM_FIELDS.filter((g) => g.id !== f.id && values[g.id] !== value), rand).slice(0, 3).map((g) => values[g.id]);
    return { ...base, type: 'choice', prompt: { ko: `${f.ko}에 뭘 써요?`, en: `What goes in ${f.ko}?`, showText: true }, options: shuffled([value, ...others], rand).map((v) => opt(v)), answer: [value] };
  });

  const n = profile.family;
  const doing = HOBBY_DO[profile.hobby] ?? '쉬어요';
  const wrongN = n === 4 ? 3 : 4;
  const interview = [
    {
      id: 'family', q: '가족이 몇 명이에요?', qEn: 'How many people are in your family?', objective: 'ko-gram-counters',
      right: [`가족이 ${NATIVE[n]} 명이에요.`], wrong: [`가족이 ${SINO[n]} 명이에요.`, `가족이 ${NATIVE[n]} 개예요.`, '주말에 보통 쉬어요.'],
      blocks: ['가족이', NATIVE[n], '명이에요'], distractors: [SINO[n], '개예요'],
      hint: `Native numbers count people: ${NATIVE[n]} 명 (${n})`,
    },
    {
      id: 'weekend', q: '주말에 보통 뭐 해요?', qEn: 'What do you usually do at the weekend?', objective: 'ko-gram-ayo-eoyo',
      right: [`주말에 보통 ${doing}.`], wrong: [`가족이 ${NATIVE[wrongN]} 명이에요.`, '주말이에요.', '날씨가 좋아요.'],
      blocks: ['주말에', '보통', doing], distractors: ['주말이', '명이에요'],
      hint: `주말에 = at the weekend · 보통 = usually · ${doing}`,
    },
    {
      id: 'weather', q: '한국 날씨는 어때요?', qEn: 'What is the weather like in Korea?', objective: 'ko-vocab-weather',
      right: ['지금은 조금 추워요.', '날씨가 좋아요.'], wrong: ['한국 사람이에요.', `주말에 보통 ${doing}.`],
      blocks: ['지금은', '조금', '추워요'], distractors: ['사람이에요', '추워해요'],
      hint: '추워요 = it\'s cold · 좋아요 = it\'s nice',
    },
  ];
  for (const q of interview) {
    const base = { id: `judges-q-${q.id}`, skill: 'speaking', objective: q.objective, audio: { text: q.q }, prompt: { ko: q.q, en: q.qEn, showText: true }, hint: q.hint, speech: { slots: q.blocks } };
    if (tier >= 2) items.push({ ...base, type: 'blocks', blocks: blockSet(rand, q.blocks, q.distractors), answer: [q.blocks] });
    else items.push({ ...base, type: 'choice', options: shuffled([...q.right, ...q.wrong], rand).map((o) => opt(o)), answer: q.right });
  }
  return items;
}

/* ── Field quest: team lunch run at the 분식집 ───── */

export const LUNCH = {
  place: 'seoul-market', // 동네 분식 골목 · 모퉁이 분식
  // review: 'native' — placeholder group chat.
  chat: [
    { who: '하은', ko: '김밥이요.', en: 'Gimbap.' },
    { who: '민지', ko: '저도 김밥!', en: 'Gimbap for me too!' },
    { who: '예린', ko: '떡볶이요~', en: 'Tteokbokki~' },
    { who: '다온', ko: '라면이요!', en: 'Ramyeon!' },
    { who: 'me', ko: '저는 라면!', en: 'Ramyeon for me!' },
  ],
  segments: [
    {
      id: 'gimbap', food: '김밥', num: '두', counter: '줄', en: 'two rolls of gimbap', objective: 'ko-gram-counters',
      wrong: [{ ko: '김밥 한 줄', fault: 'amount' }, { ko: '김밥 두 개', fault: 'counter' }],
      distractors: ['이', '개'],
      reactions: {
        amount: { who: '민지', ko: '제 김밥은요?', en: 'Where\'s my gimbap?', arrives: 'one roll of gimbap' },
        counter: { who: '민지', ko: '김밥이… 두 조각?', en: 'Gimbap… two slices?', arrives: 'two slices of gimbap' },
      },
    },
    {
      id: 'tteokbokki', food: '떡볶이', num: '일', counter: '인분', en: 'one portion of tteokbokki', objective: 'ko-num-sino-inbun',
      wrong: [{ ko: '떡볶이 이 인분', fault: 'amount' }, { ko: '떡볶이 한 줄', fault: 'counter' }],
      distractors: ['한', '줄'],
      reactions: {
        amount: { who: '예린', ko: '이거 다 제 거예요?', en: 'Is all of this mine?', arrives: 'two portions of tteokbokki' },
        counter: { who: '예린', ko: '제 떡볶이는요?', en: 'Where\'s my tteokbokki?', arrives: 'a roll of gimbap instead of tteokbokki' },
      },
    },
    {
      id: 'ramyeon', food: '라면', num: '두', counter: '개', en: 'two ramyeon', objective: 'ko-gram-counters',
      wrong: [{ ko: '라면 한 개', fault: 'amount' }, { ko: '라면 두 줄', fault: 'counter' }],
      distractors: ['이', '줄'],
      reactions: {
        amount: { who: '다온', ko: '언니, 제 라면은요?', en: 'Eonni, where\'s my ramyeon?', arrives: 'one ramyeon' },
        counter: { who: '다온', ko: '라면이 김밥이 됐어요…', en: 'The ramyeon turned into gimbap…', arrives: 'two rolls of gimbap instead of ramyeon' },
      },
    },
  ],
  order: '김밥 두 줄하고 떡볶이 일 인분, 라면 두 개 주세요',
  orderEn: 'Two rolls of gimbap and one portion of tteokbokki, and two ramyeon, please.',
  price: 20000,
  priceKo: '이만 원이에요.',
  wallet: [50000, 10000, 10000, 5000, 5000, 1000, 1000, 1000, 1000, 1000],
  // review: 'native' — the shop owner's lines.
  owner: { who: '사장님', greet: { ko: '뭐 드릴까요?', en: 'What can I get you?' } },
  // review: 'native'
  change: { ko: '거스름돈 여기요.', en: 'Here\'s your change.' },
};

export const segmentText = (s) => `${s.food} ${s.num} ${s.counter}`;

export function fieldItems(seed, tier = 1) {
  const rand = rng(hashSeed(seed, 'field', tier));
  const items = LUNCH.segments.map((s) => {
    const right = segmentText(s);
    const base = { id: `field-${s.id}`, skill: 'speaking', objective: s.objective, segment: s.id, prompt: { ko: LUNCH.owner.greet.ko, en: `Order the ${s.food} for the team.`, showText: true }, hint: `${right} = ${s.en}` };
    if (tier >= 2) return { ...base, type: 'blocks', blocks: blockSet(rand, [s.food, s.num, s.counter], s.distractors), answer: [[s.food, s.num, s.counter]] };
    return { ...base, type: 'choice', options: shuffled([right, ...s.wrong.map((w) => w.ko)], rand).map((o) => opt(o)), answer: [right] };
  });
  items.push({
    id: 'field-pay', skill: 'listening', objective: 'ko-num-sino-man', type: 'wallet', audio: { text: LUNCH.priceKo },
    prompt: { ko: LUNCH.priceKo, en: 'Pay for the order.', showText: tier === 1 }, wallet: [...LUNCH.wallet], answer: [LUNCH.price], hint: '이만 = 20,000',
    change: LUNCH.change,
  });
  return items;
}

/** What reaches the studio: for each wrongly ordered segment, the fault and a teammate's reaction. */
export function lunchOutcome(responses) {
  const out = [];
  for (const s of LUNCH.segments) {
    const r = responses[`field-${s.id}`];
    if (!r || r.correct) continue;
    const fault = faultOf(s, r.answer);
    out.push({ segment: s.id, fault, ...s.reactions[fault] });
  }
  return out;
}

/** Wrong number → wrong amount; wrong counter (or anything else) → the wrong food. */
export function faultOf(segment, answer) {
  const text = Array.isArray(answer) ? answer.join(' ') : String(answer ?? '');
  const w = segment.wrong.find((x) => x.ko === text);
  if (w) return w.fault;
  return text.includes(segment.counter) ? 'amount' : 'counter';
}

export function itemsFor(round, seed, tier, profile) {
  if (round === 'vocal') return vocalItems(seed, tier);
  if (round === 'dance') return danceItems(seed, tier);
  if (round === 'judges') return judgesItems(seed, tier, profile);
  if (round === 'field') return fieldItems(seed, tier);
  return [];
}

/* ── Results night ───────────────────────────────── */

/** The girls' cohort (canon/cohort.ts). Bases follow the roles; curves past eval 1 are #416. */
export const ROSTER = [
  { id: 'haeun', name: '하은', base: 86, spread: 5 },
  { id: 'dohee', name: '도희', base: 78, spread: 6 }, // camera-ready, strong all round
  { id: 'boram', name: '보람', base: 74, spread: 9 }, // strong dancer, slipping
  { id: 'minji', name: '민지', base: 72, spread: 8 },
  { id: 'yunseo', name: '윤서', base: 71, spread: 6 }, // strongest on the written side
  { id: 'yerin', name: '예린', base: 69, spread: 8 }, // quietly the best vocalist
  { id: 'daon', name: '다온', base: 61, spread: 10 }, // the youngest
];

/** The roster for one save: the cohort plus the foreign trainee picked for it. */
export function rosterFor(seed, nationality) {
  const t = pickForeignTrainee(seed, nationality);
  return [...ROSTER, { id: t.id, name: t.name.ko, base: 65, spread: 9 }];
}

// review: 'native' — functional placeholder lines for results night.
export const RESULT_LINES = {
  probation: { who: '박 코치', ko: '다음 달은 보충 연습이에요.', en: 'Extra practice for you next month.' },
  pass: { who: '박 코치', ko: '수고했어요. 다음 달에 봐요.', en: 'Good work. See you next month.' },
};

/* ── Checking answers ────────────────────────────── */

const norm = (s) => String(s ?? '').replace(/[\s.,!?~·]/g, '');

/** Is a response right? choice: option id; blocks: ordered texts; type: string; wallet: total. */
export function check(item, answer) {
  if (item.type === 'choice') return item.answer.includes(answer);
  if (item.type === 'blocks') return item.answer.some((a) => norm(a.join('')) === norm((answer ?? []).join('')) && a.length === (answer ?? []).length);
  if (item.type === 'type') return item.answer.some((a) => norm(a) === norm(answer));
  // Overpaying is fine: the owner gives change. Only short of the price is wrong.
  if (item.type === 'wallet') return Number(answer) >= item.answer[0];
  return false;
}
