// Dialogue scripts for every place in the neighbourhood.
// Ha-eun / Jin voices follow apps/client/lib/content/characters.ts.
import { shuffle, pick } from './util.js';

export const FOODS = [
  { ko: '떡볶이', rom: 'tteokbokki', en: 'spicy rice cakes' },
  { ko: '오뎅', rom: 'odeng', en: 'fish cake skewers' },
  { ko: '순대', rom: 'sundae', en: 'Korean blood sausage' },
  { ko: '라면', rom: 'ramyeon', en: 'instant noodles' },
  { ko: '김밥', rom: 'gimbap', en: 'seaweed rice roll' },
];

export const WORDS = [
  ...FOODS.map((f, i) => ({ ...f, at: [[3.2, 10.5], [-3.6, 13], [-0.4, 7.2], [4.4, 3.2], [2.8, -5]][i] })),
  { ko: '커피', rom: 'keopi', en: 'coffee', at: [8.4, -14] },
  { ko: '우유', rom: 'uyu', en: 'milk', at: [-8.4, -17] },
  { ko: '지하철', rom: 'jihacheol', en: 'subway', at: [-4, -16.8] },
  { ko: '은행나무', rom: 'eunhaengnamu', en: 'ginkgo tree', at: [1.2, -34] },
  { ko: '한강', rom: 'hangang', en: 'the Han River', at: [7.5, -43] },
];

// label: the core word on the product label, rebuilt in the clerk's block-crush.
const STORE_ITEMS = [
  { ko: '삼각김밥', rom: 'samgak-gimbap', en: 'triangle gimbap', price: 1200, priceKo: '천이백', label: { ko: '김밥', en: 'gimbap (rice roll)' } },
  { ko: '바나나우유', rom: 'banana-uyu', en: 'banana milk', price: 1700, priceKo: '천칠백', label: { ko: '우유', en: 'milk' } },
  { ko: '컵라면', rom: 'keop-ramyeon', en: 'cup noodles', price: 1500, priceKo: '천오백', label: { ko: '라면', en: 'ramyeon (noodles)' } },
];

const CAFE_ITEMS = [
  { ko: '아이스 아메리카노', rom: 'aiseu amerikano', en: 'an iced americano', price: '4,500', priceKo: '사천오백' },
  { ko: '따뜻한 라테', rom: 'ttatteutan rate', en: 'a hot latte', price: '5,000', priceKo: '오천' },
  { ko: '딸기 케이크', rom: 'ttalgi keikeu', en: 'strawberry cake', price: '6,500', priceKo: '육천오백' },
];

const won = (n) => n.toLocaleString('en-US');

// Tong's intro lines: the English is /game's tong-intro (app/game/page.tsx); one set per new game.
// Korean is drafted and needs native review (#395).
const INTRO_SETS = [
  [
    ['사람을 잇는 게 내 일이야. 나는 통!', 'They call me Tong. I connect people. It’s what I do.'],
    ['단어를 배우고, 분위기를 읽고, 관계를 쌓아.', 'Learn the words. Read the room. Build the bonds.'],
    ['세 도시가 네 인생을 바꿀 거야.', 'Three cities are about to change your life.'],
  ],
  [
    ['나는 통. 기다리고 있었어.', 'I’m Tong. I’ve been waiting for you.'],
    ['서울, 도쿄, 상하이. 다 너한테 필요한 게 있어.', 'Seoul, Tokyo, Shanghai: each one has something you need.'],
    ['말을 배우고 믿음을 얻으면, 문이 열려.', 'Speak their language, earn their trust, and doors will open.'],
  ],
  [
    ['나는 통. 네 비밀 무기라고 생각해.', 'The name’s Tong. Think of me as your edge.'],
    ['이 업계는 인맥 없인 아무도 못 떠.', 'Nobody makes it in this industry without the right connections.'],
    ['다행히 난 모두를 알아. 시작하자!', 'Lucky for you, I know everyone. Let’s get started.'],
  ],
  [
    ['나는 통. 네가 아는 스타들, 다 여기서 시작했어.', 'I’m Tong. Every star you’ve heard of? They started exactly where you are.'],
    ['세 도시. 세 언어. 기회는 한 번.', 'Three cities. Three languages. One shot to make it.'],
    ['정신 바짝 차리고 나만 따라와.', 'Stay sharp and follow my lead.'],
  ],
];
const INTRO = INTRO_SETS[Math.floor(Math.random() * INTRO_SETS.length)];

/**
 * A = actions/state from main.js:
 *   S, sitPlayer, serveFood, spicyFx, startExit, flipHair(who), learn, done(questId),
 *   hangout(locationId), exercise(request) → Promise<CozyExerciseResult>,
 *   toast, sfx, polaroid, startQuiz, quizChoices, lookAtTower,
 *   practice(mode) → Promise<CozyPracticeResult> (Tong's Learn / Review)
 * Nodes with `exercise: () => CozyExerciseRequest` open a shared Tong exercise
 * after their line and continue with `next(result)`.
 */
export function buildNodes(A) {
  const S = A.S;

  const orderChoices = () => {
    const known = FOODS.filter((w) => S.words.has(w.ko) || w.ko === '떡볶이' || w.ko === '오뎅');
    const right = shuffle(known).slice(0, 2);
    const f = pick(known);
    return shuffle([
      ...right.map((w) => ({ ko: `${w.ko} 주세요`, rom: `${w.rom} juseyo`, en: `${w.en}, please`, next: 'order_right', hideEn: true, do: () => (S.food = w) })),
      { ko: `${f.ko} 감사합니다`, rom: `${f.rom} gamsahamnida`, en: '', next: 'order_wrong_phrase', hideEn: true, wrong: true },
      { ko: `주세요 ${f.ko}`, rom: `juseyo ${f.rom}`, en: '', next: 'order_wrong_order', hideEn: true, wrong: true },
    ]);
  };

  let tip = null; // Tong's hint, read when the menu opens
  let practiced = null; // the last Learn / Review result (CozyPracticeResult)
  const practiceNext = (r) => {
    practiced = r;
    if (r.outcome === 'unavailable') return 'tong_practice_off';
    return r.exercises ? 'tong_practice_done' : 'tong_practice_later';
  };

  const N = {
    /* ── 포장마차 (night) ─────────────────────── */
    ajusshi_hello: { who: 'ajusshi', expr: 'happy', ko: '어서 와요~ 추운데 저기 앉아요!', en: 'Welcome~ It’s chilly, go grab a seat!', end: true },
    ajusshi_later: { who: 'ajusshi', expr: 'happy', ko: '또 와요~ 다음엔 친구랑 같이!', en: 'Come again~ Bring your friend next time!', end: true },
    tent_closed: {
      who: 'narration',
      ko: '영업시간 19:00 ~ 03:00',
      en: 'Business hours 7 PM – 3 AM. The tent is zipped shut for now.',
      hint: '<b>영업시간</b> (yeong-eop-sigan) = business hours. Come back after dark, or sit on the lookout bench to pass time.',
      enter: () => A.learn('영업시간', 'yeongeop-sigan', 'business hours'),
      end: true,
    },
    // In Tong, ordering is a shared sentence-builder; opened on its own, the choice menu below.
    order_build: {
      who: 'ajusshi',
      expr: 'smile',
      enter: () => (S.suggest = pick(FOODS.filter((w) => S.words.has(w.ko) || w.ko === '떡볶이' || w.ko === '오뎅'))),
      ko: () => `뭐 줄까요? 오늘은 ${S.suggest.ko} 맛있어요!`,
      en: () => `What’ll it be? Today’s pick: ${S.suggest.en}!`,
      exercise: () => ({
        exerciseType: 'sentence_builder',
        targetItems: [S.suggest.ko, '주세요'],
        distractors: ['감사합니다', pick(FOODS.filter((w) => w.ko !== S.suggest.ko)).ko],
        objectiveId: 'ko-gram-juseyo',
        framing: { speakerId: 'ajusshi', ko: `${S.suggest.ko} 주문해 봐요!`, en: `Order the ${S.suggest.en}: put the words in order.` },
        meaning: `${S.suggest.en}, please.`,
        cityId: 'seoul',
        locationId: 'food_street',
        characterId: 'ajusshi',
      }),
      next: (r) => {
        if (r.outcome !== 'completed') return 'order';
        S.food = S.suggest;
        if (r.correct) return 'order_right';
        S.mistakes++;
        return 'order_assist';
      },
    },
    order_assist: { who: 'ajusshi', expr: 'laugh', ko: '괜찮아요~ 음식 먼저, 그다음 “주세요”!', en: 'No worries~ Food first, then “주세요”!', hint: () => `<b>${S.food.ko} 주세요</b> = ${S.food.en}, please.`, next: 'order_right' },
    order: { who: 'ajusshi', expr: 'smile', ko: '뭐 줄까요?', en: 'What’ll it be?', choices: orderChoices, hint: 'Pick the polite order: <b>[food] 주세요</b>' },
    order_wrong_phrase: { who: 'ajusshi', expr: 'laugh', ko: '하하, 감사는 먹고 나서! “주세요”라고 해 봐요.', en: 'Haha, thanks comes after eating! Try “주세요”.', enter: () => S.mistakes++, next: 'order' },
    order_wrong_order: { who: 'ajusshi', expr: 'laugh', ko: '거꾸로네~ 음식 먼저, 그다음 “주세요”!', en: 'Backwards~ Food first, then “주세요”!', enter: () => S.mistakes++, next: 'order' },
    order_right: {
      who: 'ajusshi',
      expr: 'happy',
      ko: '{food} 하나요~ 금방 나와요!',
      en: 'One {foodEn}~ coming right up!',
      enter: () => A.learn('주세요', 'juseyo', 'please (give me)'),
      next: 'spice_q',
    },
    spice_q: {
      who: 'ajusshi',
      expr: 'smile',
      ko: '맵게 해 줄까요?',
      en: 'Want it spicy?',
      choices: [
        { ko: '네, 맵게 해 주세요!', rom: 'ne, maepge hae juseyo', en: 'Yes, make it spicy!', next: 'spicy_dare', set: { spicy: true } },
        { ko: '안 맵게 해 주세요…', rom: 'an maepge hae juseyo', en: 'Not spicy, please…', next: 'mild' },
      ],
    },
    spicy_dare: { who: 'ajusshi', expr: 'surprised', ko: '오? 제일 맵게? 용감하네~', en: 'Oh? The spiciest? Brave~', enter: () => A.serveFood(), next: 'spicy_hit' },
    spicy_hit: {
      who: 'narration',
      ko: '…맵다!!! 혀에 불이 났다.',
      en: '…SPICY!!! Your tongue is on fire.',
      playerExpr: 'spicy',
      enter: () => A.spicyFx(true),
      choices: [
        { ko: '물 주세요!!', rom: 'mul juseyo', en: 'Water, please!!', next: 'water' },
        { ko: '…맛있어요!', rom: 'masisseoyo', en: '…It’s delicious!', next: 'tough' },
      ],
    },
    water: { who: 'ajusshi', expr: 'laugh', ko: '하하, 여기 물! 천천히 먹어요.', en: 'Haha, here’s water! Eat slowly.', enter: () => A.spicyFx(false), next: 'bill' },
    tough: { who: 'ajusshi', expr: 'surprised', ko: '…울면서 맛있대. 인정!', en: '…Crying and still saying it’s good. Respect!', enter: () => setTimeout(() => A.spicyFx(false), 1800), next: 'bill' },
    mild: { who: 'ajusshi', expr: 'smile', ko: '네~ 안 맵게!', en: 'Sure~ not spicy!', enter: () => A.serveFood(), next: 'mild_taste' },
    mild_taste: {
      who: 'ajusshi',
      expr: 'smile',
      ko: '맛있어?',
      en: 'Is it good?',
      choices: [
        { ko: '네, 맛있어요!', rom: 'ne, masisseoyo', en: 'Yes, it’s delicious!', aff: 1, next: 'mild_good' },
        { ko: '조금 짜요.', rom: 'jogeum jjayo', en: 'A little salty.', next: 'mild_salty' },
      ],
    },
    mild_good: { who: 'ajusshi', expr: 'happy', ko: '그쵸? 홍대 최고예요~', en: 'Right? Best in Hongdae~', next: 'bill' },
    mild_salty: { who: 'ajusshi', expr: 'surprised', ko: '뭐라고요?! …물 더 줄게요.', en: 'What was that?! …I’ll bring more water.', next: 'bill' },
    bill: {
      who: 'ajusshi',
      expr: 'happy',
      ko: () => `${S.food?.ko ?? '떡볶이'} 사천 원이에요~`,
      en: () => `${S.food?.en ?? 'Tteokbokki'}: 4,000 won~`,
      hint: '<b>사천</b> = 4,000 · <b>원</b> = won',
      enter: () => A.sfx.coin(),
      end: true,
      after: () => A.standUp(),
    },

    /* ── 연습실 (day) ─────────────────────────── */
    // Ha-eun's scenes are authored in lib/content/routes/haeun and played by scene-player.js.
    haeun_busy: { who: 'haeun', expr: 'smile', ko: '아, 지금 연습 중이라서요~ 나중에 얘기해요.', en: 'Oh, I’m in the middle of practice~ Let’s talk later.', end: true },
    haeun_tomorrow: { who: 'haeun', expr: 'smile', ko: '수고하셨어요~ 내일 봐요.', en: 'Good work~ See you tomorrow.', end: true },
    haeun_idle: {
      who: 'haeun',
      expr: 'smirk',
      ko: () => (S.story?.flags?.dropped_formal ? '뭐. 연습이나 해.' : '아, 네~ 수고하세요.'),
      en: () => (S.story?.flags?.dropped_formal ? 'What. Go practise.' : 'Oh, sure~ Keep it up.'),
      end: true,
    },
    locker_again: {
      who: 'narration',
      ko: () => (S.story?.flags?.notebook_kept ? '사물함. 노트는 가방에 있다.' : '사물함. 서랍이 잘 안 닫힌다.'),
      en: () => (S.story?.flags?.notebook_kept ? 'Your locker. The notebook is in your bag.' : 'Your locker. The drawer still sticks.'),
      end: true,
    },

    /* ── 카페 봄 ───────────────────────────────── */
    barista_hi: {
      who: 'barista',
      expr: 'happy',
      ko: '어서 오세요! 주문하시겠어요?',
      en: 'Welcome! Ready to order?',
      choices: CAFE_ITEMS.map((it) => ({ ko: `${it.ko} 주세요`, rom: `${it.rom} juseyo`, en: `${it.en}, please`, next: 'barista_here', do: () => (S.drink = it) })),
    },
    barista_here: {
      who: 'barista',
      expr: 'smile',
      ko: '드시고 가세요?',
      en: 'For here?',
      choices: [
        { ko: '네, 먹고 갈게요.', rom: 'ne, meokgo galgeyo', en: 'Yes, for here.', next: 'barista_pay' },
        { ko: '포장해 주세요.', rom: 'pojanghae juseyo', en: 'To go, please.', next: 'barista_pojang' },
      ],
    },
    barista_pojang: {
      who: 'barista',
      expr: 'smile',
      ko: '네, 포장이요~',
      en: 'Sure, to go~',
      hint: '<b>포장</b> = wrap / takeout. Same 포장 as <b>포장마차</b> — literally a “covered wagon”!',
      enter: () => A.learn('포장', 'pojang', 'takeout / wrapping'),
      next: 'barista_pay',
    },
    barista_pay: {
      who: 'barista',
      expr: 'happy',
      ko: () => `${S.drink?.priceKo ?? '사천오백'} 원입니다. 감사합니다!`,
      en: () => `${S.drink?.price ?? '4,500'} won. Thank you!`,
      enter: () => {
        A.sfx.coin();
        A.learn(S.drink.ko, S.drink.rom, S.drink.en.replace(/^an? /, ''));
        A.done('cafe');
        A.hangout('cafe');
      },
      end: true,
      after: () => A.jinWave(),
    },
    // Jin's café and river scenes are authored in lib/content/routes/jin/ambient and played by scene-player.js.
    jin_cafe_idle: {
      who: 'jin',
      expr: 'smile',
      ko: () => (S.story?.flags?.jin_banmal_accepted ? '대본 읽는 중이야. 내일 또 와.' : '대본 읽는 중이에요. 내일 또 와요.'),
      en: 'Reading my script. Come by again tomorrow.',
      end: true,
    },
    jin_river_idle: {
      who: 'jin',
      expr: 'smile',
      ko: () => (S.story?.flags?.jin_banmal_accepted ? '오늘은 그냥 물 보고 싶어.' : '오늘은 그냥 물 보고 싶어요.'),
      en: 'Tonight I just want to look at the water.',
      end: true,
    },

    /* ── 편의점 ─────────────────────────────────── */
    cashier_hi: {
      who: 'cashier',
      expr: 'smile',
      ko: '어서 오세요~',
      en: 'Welcome~',
      choices: STORE_ITEMS.map((it) => ({ ko: `${it.ko} 주세요`, rom: `${it.rom} juseyo`, en: `${it.en}, please`, next: 'cashier_label', do: () => (S.item = it) })),
    },
    // The clerk's smudged label: a shared block-crush on the product word (skipped when opened on its own).
    cashier_label: {
      who: 'cashier',
      expr: 'surprised',
      ko: () => `${S.item.ko}요? 어, 가격표가 지워졌네…`,
      en: 'Oh, the price label is smudged…',
      exercise: () => ({
        exerciseType: 'block_crush',
        targetItems: [S.item.label.ko],
        objectiveId: 'ko-script-blocks-2part',
        framing: { speakerId: 'cashier', ko: '이름 좀 맞춰 줄래요? 가격 찾아 드릴게요.', en: `Rebuild “${S.item.label.ko}” (${S.item.label.en}) on the label so the clerk can find the price.` },
        meaning: S.item.label.en,
        cityId: 'seoul',
        locationId: 'convenience_store',
        characterId: 'cashier',
      }),
      next: (r) => (r.outcome !== 'completed' ? 'cashier_price' : r.correct ? 'cashier_label_ok' : 'cashier_label_close'),
    },
    cashier_label_ok: { who: 'cashier', expr: 'happy', ko: () => `${S.item.label.ko}! 찾았다~ 고마워요.`, en: () => `${S.item.label.en}! Found it~ thanks.`, next: 'cashier_price' },
    cashier_label_close: { who: 'cashier', expr: 'smile', ko: '괜찮아요, 찾았어요~', en: 'No worries, I found it~', hint: () => `<b>${S.item.label.ko}</b> = ${S.item.label.en}`, next: 'cashier_price' },
    cashier_price: {
      who: 'cashier',
      expr: 'smile',
      ko: () => `${S.item.priceKo} 원이에요.`,
      en: 'How much do you hand over?',
      hint: '<b>천</b> = 1,000 · <b>백</b> = 100 · so <b>천오백</b> = 1,500',
      choices: () =>
        shuffle([
          { ko: `${won(S.item.price)}원 내기`, en: '', hideEn: true, next: 'cashier_bag', do: () => A.sfx.coin() },
          { ko: `${won(S.item.price * 10)}원 내기`, en: '', hideEn: true, next: 'cashier_wrong', wrong: true },
          { ko: `${won(S.item.price / 10)}원 내기`, en: '', hideEn: true, next: 'cashier_wrong', wrong: true },
        ]),
    },
    cashier_wrong: { who: 'cashier', expr: 'laugh', ko: () => `하하, ${S.item.priceKo} 원이요~`, en: () => `Haha, ${won(S.item.price)} won~`, next: 'cashier_price' },
    cashier_bag: {
      who: 'cashier',
      expr: 'smile',
      ko: '봉투 필요하세요?',
      en: 'Do you need a bag?',
      choices: [
        { ko: '아니요, 괜찮아요.', rom: 'aniyo, gwaenchanayo', en: 'No, I’m fine.', next: 'cashier_bye' },
        { ko: '네, 주세요.', rom: 'ne, juseyo', en: 'Yes, please.', next: 'cashier_bag_cost' },
      ],
    },
    cashier_bag_cost: { who: 'cashier', expr: 'smile', ko: '봉투는 백 원이에요~', en: 'Bags are 100 won~', hint: 'Korean shops charge a little for plastic bags.', next: 'cashier_bye' },
    cashier_bye: {
      who: 'cashier',
      expr: 'happy',
      ko: '감사합니다~ 안녕히 가세요!',
      en: 'Thank you~ Goodbye!',
      hint: '<b>안녕히 가세요</b> = bye to someone leaving · <b>안녕히 계세요</b> = bye to someone staying',
      enter: () => {
        A.learn(S.item.ko, S.item.rom, S.item.en);
        A.learn('얼마예요', 'eolmayeyo', 'how much is it?');
        A.done('store');
        A.hangout('convenience_store');
      },
      end: true,
    },

    /* ── New game: Tong introduces itself (same lines as /game's tong-intro) ── */
    tong_intro_1: { who: 'tong', expr: 'cheerful', ko: () => INTRO[0][0], en: () => INTRO[0][1], next: 'tong_intro_2' },
    tong_intro_2: { who: 'tong', expr: 'excited', ko: () => INTRO[1][0], en: () => INTRO[1][1], next: 'tong_intro_3' },
    tong_intro_3: { who: 'tong', expr: 'proud', ko: () => INTRO[2][0], en: () => INTRO[2][1], next: 'tong_intro_seoul' },
    tong_intro_seoul: {
      who: 'tong',
      expr: 'love',
      ko: '서울에 온 걸 환영해, {name}!',
      en: 'Welcome to Seoul, {name}! Your agency is up the stairs. Let’s find your locker first. Tap me (or press H) whenever you need me.',
      hint: '<b>환영해</b> = welcome · Tong lives in your phone. The more you do yourself, the more people here notice.',
      end: true,
      after: () => A.tongTalk(),
    },

    /* ── Tap Tong: a hint, then Learn / Review ─────────── */
    tong_menu: {
      who: 'tong',
      enter: () => (tip = tongHint(S, S.hour)),
      expr: () => tip.expr,
      ko: () => tip.ko,
      en: () => tip.en,
      choices: [
        { ko: '배우기', en: 'Learn', next: 'tong_learn' },
        { ko: '복습하기', en: 'Review', next: 'tong_review' },
        { ko: '괜찮아', en: 'Not now', next: 'tong_bye' },
      ],
    },
    tong_learn: { who: 'tong', expr: 'excited', ko: '같이 배우자!', en: 'Let’s learn!', task: () => A.practice('learn'), next: (r) => practiceNext(r) },
    tong_review: { who: 'tong', expr: 'thinking', ko: '복습하자!', en: 'Let’s go over your words.', task: () => A.practice('review'), next: (r) => practiceNext(r) },
    tong_practice_done: {
      who: 'tong',
      expr: () => (practiced.correct === practiced.exercises ? 'proud' : 'cheerful'),
      ko: () => (practiced.correct === practiced.exercises ? '완벽해!' : '잘했어!'),
      en: () => `${practiced.correct}/${practiced.exercises} · +${practiced.xpAwarded} XP`,
      end: true,
    },
    tong_practice_later: { who: 'tong', expr: 'cheerful', ko: '언제든 불러!', en: 'Tap me anytime.', end: true },
    tong_practice_off: { who: 'tong', expr: 'thinking', ko: '앱에서 열어 줘!', en: 'Open this in the Tong app to practise.', end: true },
    tong_bye: { who: 'tong', expr: 'cheerful', ko: '언제든 불러!', en: 'Tap me anytime.', end: true },

    /* ── Readable signs: a jumbled sign is rebuilt to learn the place ── */
    sign_build: {
      who: 'tong',
      expr: 'excited',
      ko: '간판이 뒤죽박죽이야!',
      en: 'The sign’s letters are jumbled. Rebuild it to find out what this place is.',
      exercise: () => ({
        exerciseType: 'block_crush',
        targetItems: [A.sign.word],
        objectiveId: 'ko-script-blocks-2part',
        framing: { speakerId: 'tong', ko: '간판을 맞춰 봐!', en: `Rebuild the sign. It means “${A.sign.en}”.` },
        meaning: A.sign.en,
        cityId: 'seoul',
        locationId: A.sign.locationId,
      }),
      next: (r) => {
        if (r.outcome === 'dismissed') return A.laterSign(), 'sign_later';
        A.readSign();
        return r.outcome === 'completed' && !r.correct ? 'sign_close' : 'sign_read';
      },
    },
    sign_read: { who: 'tong', expr: 'proud', ko: () => `${A.sign.name}!`, en: () => A.sign.note, hint: () => `<b>${A.sign.word}</b> (${A.sign.rom}) = ${A.sign.en}`, end: true },
    sign_close: { who: 'tong', expr: 'cheerful', ko: () => `거의! ${A.sign.name}.`, en: () => A.sign.note, hint: () => `<b>${A.sign.word}</b> (${A.sign.rom}) = ${A.sign.en}`, end: true },
    sign_later: { who: 'tong', expr: 'thinking', ko: '다음에 읽자.', en: 'We can read it next time you pass.', end: true },

    /* ── Misc ─────────────────────────────────── */
    telescope: {
      who: 'narration',
      ko: '남산타워가 보인다!',
      en: 'You can see Namsan (N Seoul) Tower to the east, on this side of the Han River!',
      hint: 'At night the tower’s ring lights cycle through colours.',
      enter: () => {
        A.lookAtTower(true);
        A.learn('남산타워', 'namsan-tawo', 'N Seoul Tower');
      },
      end: true,
      after: () => A.lookAtTower(false),
    },
    quiz: {
      who: 'tong',
      expr: 'thinking',
      ko: () => A.quiz.q.prompt,
      en: () => `Question ${A.quiz.n + 1} of 3 — what does it mean?`,
      choices: () => A.quizChoices(),
    },
    quiz_right: { who: 'tong', expr: 'excited', ko: '정답! 대박~', en: 'Correct! Amazing~', next: () => (A.quiz.n >= 3 ? 'quiz_done' : 'quiz') },
    quiz_wrong: { who: 'tong', expr: 'surprised', ko: () => `아쉬워! 정답은 “${A.quiz.q.answer}”.`, en: 'So close! Keep going.', next: () => (A.quiz.n >= 3 ? 'quiz_done' : 'quiz') },
    quiz_done: {
      who: 'tong',
      expr: 'proud',
      ko: () => `${A.quiz.score}/3! 잘했어!`,
      en: () => (A.quiz.score === 3 ? 'Perfect score! You’re a natural.' : 'Nice work — words stick better every time you review.'),
      enter: () => A.done('quiz'),
      end: true,
    },
    tong_quiz_empty: { who: 'tong', expr: 'thinking', ko: '단어를 더 모아 와!', en: 'Collect a few more glowing words first, then come back for a quiz!', end: true },
  };
  return N;
}

/** Contextual hint from Tong (H key). */
export function tongHint(S, hour) {
  const f = S.story?.flags ?? {};
  const night = hour >= 19 || hour < 3;
  if (!f.h0_done) return { ko: '연습실에 네 사물함이 있어!', en: 'Your locker is in the agency’s practice studio, up the stairs. Start there.', expr: 'excited' };
  if (!f.dorm_arrived) return { ko: '숙소로 가자!', en: 'Manager Choi is waiting at the dorm: Yeonnam Apartments, northwest of the railway park. First floor. Your bed is there.', expr: 'excited' };
  if ((S.day ?? 1) < 2) return { ko: '오늘은 푹 자!', en: 'Long day. Your bed is the bottom bunk in Da-on\'s room. Studio at 10 tomorrow: Coach Park said don\'t be late.', expr: 'cheerful' };
  if (!f.h1_done && hour >= 5 && hour < 9) return { ko: '열 시까지 연습실!', en: 'Studio at 10: Coach Park is pairing you with someone today.', expr: 'cheerful' };
  if (!f.h1_done && hour >= 9 && hour < 19) return { ko: '하은이 연습실에 있어!', en: 'Coach Park paired you with someone. She’s in the studio. Read the water-bottle name tags to find her.', expr: 'excited' };
  if (!f.j0_done && night) return { ko: '포장마차 문 열었어!', en: 'The pojangmacha is open. Go order something yourself: [food] + 주세요.', expr: 'love' };
  if (!S.quests.cafe && hour >= 8 && hour < 22) return { ko: '카페 봄에서 커피 한 잔 어때?', en: 'How about a coffee at Café Bom? It’s on the right side of the plaza.', expr: 'cheerful' };
  if (!S.quests.store) return { ko: '편의점은 24시간이야!', en: 'The convenience store is open 24 hours. Try buying something.', expr: 'cheerful' };
  if (!f.h1_done) return { ko: '하은은 낮에 연습실에 있어.', en: 'Ha-eun practises in the studio from 9 to 7. Sit on a lookout bench to pass time.', expr: 'thinking' };
  if (!f.j0_done) return { ko: '포장마차는 밤에 열어.', en: 'The pojangmacha opens at 7 PM. Sit on a lookout bench to watch the sunset.', expr: 'thinking' };
  if (f.h1_done && !f.h2_done && hour >= 21 && hour < 23.5) return { ko: '연습실 불이 아직 켜져 있어…', en: 'The studio lights are still on. Ha-eun is drilling late.', expr: 'thinking' };
  if (!S.quests.jinNight && night && f.met_jin) return { ko: '진이 한강에 있대.', en: 'Jin is at the river lookout tonight.', expr: 'cheerful' };
  if (S.words.size < 10) return { ko: '반짝이는 단어를 찾아봐!', en: `Find the glowing words around the neighbourhood (${S.words.size}/10).`, expr: 'thinking' };
  return { ko: '오늘 정말 잘했어!', en: 'You did amazing today. Try the word quiz in the studio!', expr: 'proud' };
}
