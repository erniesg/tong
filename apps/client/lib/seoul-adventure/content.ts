import type { Companion, Lesson, Location, Phrase } from './types.js';

const phrase = (ko: string, romanization: string, en: string): Phrase => ({ ko, romanization, en });

const lesson = (prompt: string, correct: Phrase, alternatives: Phrase[], explanation: string): Lesson => ({
  prompt,
  choices: [correct, ...alternatives],
  answer: 0,
  explanation,
});

export const COMPANIONS: Companion[] = [
  {
    id: 'haeun',
    name: 'Haeun',
    korean: '하은',
    description: 'A warm illustrator who notices the small rituals that make a neighborhood feel like home.',
    color: '#cf7654',
  },
  {
    id: 'jin',
    name: 'Jin',
    korean: '진',
    description: 'A patient music producer who likes late walks, good coffee, and unhurried conversation.',
    color: '#6f929e',
  },
];

const foodPhrase = phrase('안녕하세요, 이거 하나 주세요.', 'annyeonghaseyo, igeo hana juseyo.', 'Hello, one of these please.');
const cafePhrase = phrase('같이 커피 마실래요?', 'gachi keopi masillaeyo?', 'Would you like to have coffee together?');
const storePhrase = phrase('봉투 필요하세요?', 'bongtu piryohaseyo?', 'Do you need a bag?');
const subwayPhrase = phrase('시청역에 어떻게 가요?', 'sicheongyeoge eotteoke gayo?', 'How do I get to City Hall Station?');
const studioPhrase = phrase('같이 연습할까요?', 'gachi yeonseup halkkayo?', 'Shall we practise together?');

export const LOCATIONS: Location[] = [
  {
    id: 'food_street', name: 'Food Street', korean: '먹자골목', position: [-8, 3], color: '#cf7654',
    description: 'Steam rises from small stalls as neighbours decide what to share for dinner.',
    objective: 'Greet a vendor and order politely.', phrase: foodPhrase,
    lesson: lesson('A vendor asks what you would like. Choose a polite order.', foodPhrase, [cafePhrase, storePhrase], '하나 주세요 means “one, please”; 주세요 makes the order polite.'),
    hangout: {
      haeun: '하은: 이 포장마차, 같이 앉을래요? 오늘은 천천히 얘기하고 싶어요.',
      jin: '진: 냄새 좋다. 메뉴를 같이 고를까요? 당신이 좋아하는 걸 알고 싶어요.',
    },
    hangoutReply: lesson('Your companion suggests sharing a stall. Reply with an easy, welcoming invitation.', phrase('좋아요, 같이 먹어요.', 'joayo, gachi meogeoyo.', 'Sounds good, let’s eat together.'), [phrase('혼자 먹어요.', 'honja meogeoyo.', 'I eat alone.'), phrase('지금 바빠요.', 'jigeum bappayo.', 'I am busy now.')], '같이 먹어요 is a friendly, low-pressure way to accept a shared meal.'),
  },
  {
    id: 'cafe', name: 'Cafe', korean: '카페', position: [7, -4], color: '#789880',
    description: 'A sunny corner cafe with sketchbooks, playlists, and a window seat waiting.',
    objective: 'Invite someone for coffee with a gentle question.', phrase: cafePhrase,
    lesson: lesson('You want to invite a companion to the cafe. Choose the natural question.', cafePhrase, [foodPhrase, subwayPhrase], '같이 means together and -ㄹ래요? makes a soft “would you like to?” invitation.'),
    hangout: {
      haeun: '하은: 창가 자리가 비었네요. 당신이 고른 음악도 들어 보고 싶어요.',
      jin: '진: 커피가 나오기 전까지 오늘 하루를 서로 한 장면씩 말해 볼래요?',
    },
    hangoutReply: lesson('Your companion offers a quiet cafe moment. Choose a warm response.', phrase('좋아요, 같이 있어요.', 'joayo, gachi isseoyo.', 'Sounds good, let’s stay together.'), [phrase('커피 안 마셔요.', 'keopi an masyeoyo.', 'I do not drink coffee.'), phrase('나중에요.', 'najungeyo.', 'Later.')], '같이 있어요 means “let’s be here together” and keeps the invitation open and kind.'),
  },
  {
    id: 'convenience_store', name: 'Convenience Store', korean: '편의점', position: [-9, -10], color: '#c4a34e',
    description: 'A bright late-night stop for snacks, umbrellas, and tiny practical discoveries.',
    objective: 'Understand a common shop question.', phrase: storePhrase,
    lesson: lesson('At the register, the cashier asks about a bag. Pick the phrase you hear.', storePhrase, [foodPhrase, studioPhrase], '봉투 is a bag and 필요하세요? politely asks whether it is needed.'),
    hangout: {
      haeun: '하은: 비가 올 것 같아요. 우산이랑 따뜻한 음료를 같이 고를래요?',
      jin: '진: 밤 산책 전에 간식 하나씩 살까요? 당신의 단골 조합이 궁금해요.',
    },
    hangoutReply: lesson('Your companion suggests choosing supplies together. Pick a considerate reply.', phrase('네, 같이 골라요.', 'ne, gachi gollayo.', 'Yes, let’s choose together.'), [phrase('필요 없어요.', 'piryo eopseoyo.', 'I do not need it.'), phrase('모르겠어요.', 'moreugesseoyo.', 'I do not know.')], '같이 골라요 is a natural way to agree to choose something together.'),
  },
  {
    id: 'subway_hub', name: 'Subway Hub', korean: '지하철역', position: [8, 10], color: '#6f929e',
    description: 'Platforms braid the city together; every line leads to another small possibility.',
    objective: 'Ask for directions using a station name.', phrase: subwayPhrase,
    lesson: lesson('You need directions to City Hall Station. Choose the useful question.', subwayPhrase, [storePhrase, cafePhrase], '어떻게 가요? means “how do I go?” and works after a destination.'),
    hangout: {
      haeun: '하은: 다음 역에서 내려서 조금 걸을까요? 길을 같이 찾는 것도 재밌어요.',
      jin: '진: 막차까지 시간이 있어요. 한 정거장 더 가서 야경을 볼래요?',
    },
    hangoutReply: lesson('Your companion proposes a small detour. Choose an interested response.', phrase('좋아요, 같이 가요.', 'joayo, gachi gayo.', 'Sounds good, let’s go together.'), [phrase('길이 싫어요.', 'giri sireo yo.', 'I dislike roads.'), phrase('집에 가요.', 'jibe gayo.', 'I go home.')], '같이 가요 is a straightforward and friendly way to say yes to going together.'),
  },
  {
    id: 'practice_studio', name: 'Practice Studio', korean: '연습실', position: [5, -15], color: '#a18bb2',
    description: 'A calm room for language drills, dance counts, and cheering each other on.',
    objective: 'Suggest a shared practice routine.', phrase: studioPhrase,
    lesson: lesson('You want to suggest a practice session. Choose the collaborative phrase.', studioPhrase, [subwayPhrase, storePhrase], '같이 연습할까요? is an inclusive “shall we practise together?”'),
    hangout: {
      haeun: '하은: 오늘 배운 문장을 서로 한 번씩 말해 볼까요? 틀려도 괜찮아요.',
      jin: '진: 리듬에 맞춰 반복하면 기억에 남아요. 같이 천천히 해 봐요.',
    },
    hangoutReply: lesson('Your companion proposes a relaxed routine. Choose an encouraging reply.', phrase('네, 같이 해 봐요.', 'ne, gachi hae bwayo.', 'Yes, let’s try it together.'), [phrase('혼자 할게요.', 'honja halgeyo.', 'I will do it alone.'), phrase('어려워요.', 'eoryeowoyo.', 'It is difficult.')], '해 봐요 means “let’s give it a try,” which makes practice feel shared and low stakes.'),
  },
];

export const MISSION: Lesson = lesson(
  'At the end of the evening, choose the warm greeting that opens your next Seoul adventure.',
  phrase('안녕하세요, 같이 가요.', 'annyeonghaseyo, gachi gayo.', 'Hello, let’s go together.'),
  [phrase('봉투 필요하세요?', 'bongtu piryohaseyo?', 'Do you need a bag?'), phrase('시청역에 어떻게 가요?', 'sicheongyeoge eotteoke gayo?', 'How do I get to City Hall Station?')],
  'A greeting plus 같이 가요 carries the lesson forward with warmth and purpose.',
);
