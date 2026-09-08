import type { Companion, Lesson, Location, Phrase } from './types';

const phrase = (ko: string, romanization: string, en: string): Phrase => ({ ko, romanization, en });
const lesson = (prompt: string, choices: Phrase[], answer: number, explanation: string): Lesson => ({ prompt, choices, answer, explanation });

export const COMPANIONS: Companion[] = [
  { id: 'haeun', name: 'Ha-eun', korean: '하은', color: '#cf7654', description: 'A fiercely competitive dance trainee from Busan: proud, exacting, and secretly caring when practice gets hard.' },
  { id: 'jin', name: 'Jin', korean: '진', color: '#6f929e', description: 'A warm senior trainee preparing to debut, known for patient advice, snacks, and calm encouragement after rehearsal.' },
];

const food = phrase('안녕하세요, 이거 하나 주세요.', 'annyeonghaseyo, igeo hana juseyo.', 'Hello, one of these please.');
const cafe = phrase('같이 커피 마실래요?', 'gachi keopi masillaeyo?', 'Would you like to have coffee together?');
const store = phrase('봉투 필요하세요?', 'bongtu piryohaseyo?', 'Do you need a bag?');
const subway = phrase('시청역에 어떻게 가요?', 'sicheongyeoge eotteoke gayo?', 'How do I get to City Hall Station?');
const studio = phrase('같이 연습할까요?', 'gachi yeonseup halkkayo?', 'Shall we practise together?');
const greeting = phrase('안녕하세요, 같이 가요.', 'annyeonghaseyo, gachi gayo.', 'Hello, let’s go together.');

export const LOCATIONS: Location[] = [
  {
    id: 'food_street', name: 'Food Street', korean: '먹자골목', position: [-8, 3], color: '#cf7654',
    description: 'Steam rises from small stalls after a long day at the company.', objective: 'Greet a vendor and order politely.', phrase: food,
    lesson: lesson('A vendor asks what you would like. Choose a polite order.', [cafe, food, store], 1, '하나 주세요 means “one, please”; 주세요 makes the order polite.'),
    hangout: { haeun: '하은: 떡볶이는 내가 제일 매운 걸로 고를게. 넌 주문해 봐.', jin: '진: 연습 끝났으니까 간식 먹자. 너가 주문하면 내가 들고 갈게.' },
    hangoutTranslation: { haeun: 'I’ll choose the spiciest tteokbokki. You try placing the order.', jin: 'Practice is over, so let’s get a snack. If you order, I’ll carry it.' },
    hangoutReply: lesson('Order one shared snack for the two of you.', [cafe, food, store], 1, '안녕하세요 opens politely; 이거 하나 주세요 asks for one item with clear, useful courtesy.'),
  },
  {
    id: 'cafe', name: 'Cafe', korean: '카페', position: [7, -4], color: '#789880',
    description: 'A quiet corner cafe near the practice rooms, good for resting voices between rehearsals.', objective: 'Invite someone for coffee with a gentle question.', phrase: cafe,
    lesson: lesson('You want to invite a companion to the cafe. Choose the natural question.', [food, cafe, subway], 1, '같이 means together and -ㄹ래요? makes a soft “would you like to?” invitation.'),
    hangout: { haeun: '하은: 오늘 안무 연습 길었네. 카페에서 잠깐 쉴래?', jin: '진: 보컬 연습 전에 목 좀 쉬어야겠다. 같이 커피 마실래요?' },
    hangoutTranslation: { haeun: 'Choreography practice ran long today. Want to rest at a cafe for a bit?', jin: 'I should rest my voice before vocal practice. Would you like to have coffee together?' },
    hangoutReply: lesson('Invite your companion to sit down together before the next rehearsal.', [food, cafe, subway], 1, '같이 커피 마실래요? is a gentle invitation you can use with a friend or fellow trainee.'),
  },
  {
    id: 'convenience_store', name: 'Convenience Store', korean: '편의점', position: [-9, -10], color: '#c4a34e',
    description: 'A bright late-night stop for water, snacks, and the little things trainees forget.', objective: 'Understand a common shop question.', phrase: store,
    lesson: lesson('At the register, the cashier asks about a bag. Pick the phrase you hear.', [food, studio, store], 2, '봉투 is a bag and 필요하세요? politely asks whether it is needed.'),
    hangout: { haeun: '하은: 연습실에 가져갈 물이 많아. 봉투도 필요한지 물어봐 줘.', jin: '진: 후배들 간식도 사자. 계산할 때 봉투 얘기 나오면 알려 줘.' },
    hangoutTranslation: { haeun: 'We have a lot of water to bring to the studio. Ask whether we need a bag too.', jin: 'Let’s buy snacks for the juniors too. Tell me if the cashier asks about a bag.' },
    hangoutReply: lesson('Repeat the cashier’s bag question so your companion can answer it.', [food, studio, store], 2, '봉투 필요하세요? is the exact practical question you are likely to hear at a Korean checkout.'),
  },
  {
    id: 'subway_hub', name: 'Subway Hub', korean: '지하철역', position: [8, 10], color: '#6f929e',
    description: 'The late train ties rehearsal rooms, food streets, and the rest of Seoul together.', objective: 'Ask for directions using a station name.', phrase: subway,
    lesson: lesson('You need directions to City Hall Station. Choose the useful question.', [subway, store, cafe], 0, '어떻게 가요? means “how do I go?” and works after a destination.'),
    hangout: { haeun: '하은: 버스킹 보러 가려면 시청역 쪽으로 가야 해. 역무원에게 물어볼래?', jin: '진: 연습 끝나고 선배를 만나기로 했어. 시청역 가는 길을 같이 찾아보자.' },
    hangoutTranslation: { haeun: 'To see the busking show, we need to go toward City Hall Station. Want to ask the attendant?', jin: 'I’m meeting a senior after practice. Let’s work out how to get to City Hall Station together.' },
    hangoutReply: lesson('Ask the station attendant for the City Hall Station route.', [subway, store, cafe], 0, 'Put the destination before 어떻게 가요? to ask clearly and politely for directions.'),
  },
  {
    id: 'practice_studio', name: 'Practice Studio', korean: '연습실', position: [5, -15], color: '#a18bb2',
    description: 'A calm room for dance counts, vocal drills, and encouraging each other through one more take.', objective: 'Suggest a shared practice routine.', phrase: studio,
    lesson: lesson('You want to suggest a practice session. Choose the collaborative phrase.', [food, studio, subway], 1, '같이 연습할까요? is an inclusive “shall we practise together?”'),
    hangout: { haeun: '하은: 이 안무, 한 번 더 맞춰 볼까? 네 카운트가 궁금해.', jin: '진: 데뷔 준비가 바쁘지만 같이 연습하면 더 빨리 늘 거야.' },
    hangoutTranslation: { haeun: 'Shall we run this choreography one more time? I want to hear your count.', jin: 'Debut prep is busy, but if we practise together, you’ll improve faster.' },
    hangoutReply: lesson('Suggest that you practise the next section together.', [food, studio, subway], 1, '같이 연습할까요? makes practice feel collaborative and gives both people an easy choice.'),
  },
];

export const MISSION: Lesson = lesson(
  'At the end of the evening, choose the greeting that warmly starts your next Seoul adventure.',
  [subway, greeting, store],
  1,
  '안녕하세요 greets your companion politely, and 같이 가요 turns that greeting into a shared next step.',
);
