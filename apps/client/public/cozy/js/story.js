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

/**
 * A = actions/state from main.js:
 *   S, sitPlayer, serveFood, spicyFx, startExit, flipHair(who), learn, done(questId),
 *   hangout(locationId), exercise(request) → Promise<CozyExerciseResult>,
 *   toast, sfx, polaroid, startQuiz, quizChoices, lookAtTower
 * Nodes with `exercise: () => CozyExerciseRequest` open a shared Tong exercise
 * after their line and continue with `next(result)`.
 */
export function buildNodes(A) {
  const S = A.S;
  const afterGreet = () => (S.pettedCat ? 'cat' : 'sit');

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
    greet: {
      who: 'haeun',
      expr: 'cool',
      ko: () => (S.metHaeunStudio ? '…또 너야? 연습실에서 봤잖아.' : '…아, 새로운 trainee? 한국어 할 줄 알아?'),
      en: () => (S.metHaeunStudio ? '…You again? I saw you at the studio.' : '…Oh. The new trainee? Can you even speak Korean?'),
      choices: () =>
        S.metHaeunStudio
          ? [
              { ko: '배고파서 왔어요!', rom: 'baegopaseo wasseoyo', en: 'I came because I’m hungry!', aff: 1, next: 'greet_yes' },
              { ko: '하은 씨 보러 왔어요.', rom: 'haeun ssi boreo wasseoyo', en: 'I came to see you, Ha-eun.', aff: 1, next: 'greet_flirt' },
            ]
          : [
              { ko: '네, 조금요!', rom: 'ne, jogeumyo', en: 'Yes, a little!', aff: 1, next: 'greet_yes' },
              { ko: '안녕하세요, 하은 씨!', rom: 'annyeonghaseyo, haeun ssi', en: 'Hello, Ha-eun!', aff: 1, next: 'greet_name' },
              { ko: 'Uh… English?', en: '(panic)', next: 'greet_en' },
            ],
    },
    greet_yes: { who: 'haeun', expr: 'smirk', ko: '흥. 발음은… 나쁘지 않네.', en: 'Hmph. Your pronunciation is… not bad.', next: afterGreet },
    greet_flirt: { who: 'haeun', expr: 'blush', ko: '뭐, 뭐래… 밥이나 먹어.', en: 'W-what are you saying… just eat.', enter: () => A.flipHair('haeun'), next: afterGreet },
    greet_name: { who: 'haeun', expr: 'smirk', ko: '내 이름 어떻게 알아? …뭐, 내가 좀 유명하지.', en: 'How do you know my name? …Well, I am kind of famous.', enter: () => A.flipHair('haeun'), next: afterGreet },
    greet_en: { who: 'haeun', expr: 'cool', ko: '여기선 한국어로 시켜야 돼. 연습 더 해.', en: 'Here you order in Korean. Practice more.', next: afterGreet },
    cat: { who: 'haeun', expr: 'smile', ko: '…아까 떡이 쓰다듬었지? 걔 아무한테나 안 가는데.', en: '…You petted Tteok earlier, right? She doesn’t go to just anyone.', aff: 1, next: 'sit' },
    sit: { who: 'haeun', expr: 'cool', ko: '앉아. 서 있으면 아저씨가 싫어하셔.', en: 'Sit. Ajusshi hates it when people hover.', enter: () => A.sitPlayer(), next: 'order_nudge' },
    order_nudge: { who: 'haeun', expr: 'smirk', ko: '배고프지? 아저씨한테 직접 시켜 봐.', en: 'You’re hungry, right? Order from Ajusshi yourself.', hint: 'Pattern: <b>[food] + 주세요</b> = “[food], please.”', next: 'order_build' },
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
      next: () => (S.mistakes === 0 ? 'order_praise' : 'spice_q'),
    },
    order_praise: { who: 'haeun', expr: 'surprised', ko: '오, “주세요” 제대로 하네?', en: 'Oh, you actually got “주세요” right?', aff: 1, next: 'spice_q' },
    spice_q: {
      who: 'ajusshi',
      expr: 'smile',
      ko: '맵게 해 줄까요?',
      en: 'Want it spicy?',
      hint: () => (S.jinTip ? '💡 Jin said Ha-eun <i>loves</i> spicy food…' : null),
      choices: [
        { ko: '네, 맵게 해 주세요!', rom: 'ne, maepge hae juseyo', en: 'Yes, make it spicy!', next: 'spicy_dare', set: { spicy: true } },
        { ko: '안 맵게 해 주세요…', rom: 'an maepge hae juseyo', en: 'Not spicy, please…', next: 'mild' },
      ],
    },
    spicy_dare: { who: 'haeun', expr: 'surprised', ko: '오? 나처럼 제일 맵게? …대박.', en: 'Oh? Spiciest, like me? …Whoa.', aff: 1, enter: () => A.serveFood(), next: 'spicy_hit' },
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
    water: { who: 'haeun', expr: 'laugh', ko: 'ㅋㅋㅋ 미쳤어. 자, 내 물 마셔.', en: 'LOL you’re crazy. Here, drink my water.', aff: 1, enter: () => A.spicyFx(false), next: 'talk' },
    tough: { who: 'haeun', expr: 'surprised', ko: '…진짜? 눈물 나는데? …인정.', en: '…Really? You’re literally crying. …Respect.', aff: 1, enter: () => setTimeout(() => A.spicyFx(false), 1800), next: 'talk' },
    mild: { who: 'haeun', expr: 'smirk', ko: '…겁쟁이.', en: '…Scaredy-cat.', enter: () => A.serveFood(), next: 'mild_taste' },
    mild_taste: {
      who: 'haeun',
      expr: 'neutral',
      ko: '맛있어?',
      en: 'Is it good?',
      choices: [
        { ko: '네, 맛있어요!', rom: 'ne, masisseoyo', en: 'Yes, it’s delicious!', aff: 1, next: 'mild_good' },
        { ko: '조금 짜요.', rom: 'jogeum jjayo', en: 'A little salty.', next: 'mild_salty' },
      ],
    },
    mild_good: { who: 'haeun', expr: 'smile', ko: '그치? 여기가 홍대 최고야.', en: 'Right? Best stall in Hongdae.', next: 'talk' },
    mild_salty: { who: 'ajusshi', expr: 'surprised', ko: '뭐라고요?!', en: 'What was that?!', next: 'mild_salty2' },
    mild_salty2: { who: 'haeun', expr: 'laugh', ko: 'ㅋㅋ 아저씨 앞에서 그런 말 하지 마.', en: 'LOL don’t say that in front of Ajusshi.', next: 'talk' },
    talk: {
      who: 'haeun',
      expr: 'sad',
      ko: '…솔직히, 오늘 연습 진짜 힘들었어.',
      en: '…Honestly, practice was really rough today.',
      choices: [
        { ko: '하은 씨 진짜 잘해요.', rom: 'haeun ssi jinjja jalhaeyo', en: 'You’re really good, Ha-eun.', aff: 1, next: 'fluster' },
        { ko: '내일 같이 연습해요!', rom: 'naeil gachi yeonseupaeyo', en: 'Let’s practice together tomorrow!', aff: 1, next: 'together' },
        { ko: '…떡볶이 더 먹어요.', rom: 'tteokbokki deo meogeoyo', en: '…Have more tteokbokki.', next: 'more_food' },
      ],
    },
    fluster: {
      who: 'haeun',
      expr: 'blush',
      ko: '뭐, 뭐래… 갑자기.',
      en: 'W-what are you on about… all of a sudden.',
      hint: '<b>뭐래</b> = “what are you on about”. Her go-to when she’s flustered.',
      enter: () => A.flipHair('haeun'),
      next: 'bill',
    },
    together: { who: 'haeun', expr: 'blush', ko: '…같이? 내가 왜? …알았어. 내일 7시.', en: '…Together? Why would I? …Fine. Tomorrow, 7.', next: 'bill' },
    more_food: { who: 'haeun', expr: 'smile', ko: '…응. 고마워.', en: '…Yeah. Thanks.', next: 'bill' },
    bill: {
      who: 'ajusshi',
      expr: 'happy',
      ko: '다 해서 만 이천 원이에요~',
      en: 'That’s 12,000 won altogether~',
      choices: [
        { ko: '제가 낼게요!', rom: 'jega naelgeyo', en: 'I’ll pay!', aff: 1, next: 'pay' },
        { ko: '반반 해요.', rom: 'banban haeyo', en: 'Let’s split it.', next: 'split' },
      ],
    },
    pay: { who: 'haeun', expr: 'blush', ko: '…다음엔 내가 사. 진짜야.', en: '…Next time it’s on me. I mean it.', next: 'bye' },
    split: { who: 'haeun', expr: 'smile', ko: '좋아. 공평하게.', en: 'Good. Fair’s fair.', next: 'bye' },
    bye: { who: 'haeun', expr: 'smirk', ko: '흥, {name}… 조금은 인정해줄게.', en: 'Hmph, {name}… I’ll give you a little credit.', end: true, after: () => A.startExit() },

    /* ── 연습실 (day) ─────────────────────────── */
    studio_hi: {
      who: 'haeun',
      expr: 'surprised',
      ko: '…뭐야. 구경하러 왔어?',
      en: '…What. You came to watch?',
      choices: [
        { ko: '와, 춤 진짜 잘 춰요!', rom: 'wa, chum jinjja jal chwoyo', en: 'Wow, you dance really well!', aff: 1, next: 'studio_compliment' },
        { ko: '같이 연습해도 돼요?', rom: 'gachi yeonseupaedo dwaeyo', en: 'Can I practise with you?', aff: 1, next: 'studio_together' },
        { ko: '안녕히 계세요!', rom: 'annyeonghi gyeseyo', en: 'Goodbye! (to someone staying)', next: 'studio_bye' },
      ],
    },
    studio_compliment: { who: 'haeun', expr: 'blush', ko: '…다, 당연하지. 데뷔할 거니까.', en: '…O-of course. I’m going to debut.', enter: () => A.flipHair('haeun'), next: 'studio_tip' },
    studio_together: { who: 'haeun', expr: 'smirk', ko: '…저 구석에서 해. 방해하지 마.', en: '…Use that corner. Don’t get in my way.', next: 'studio_tip' },
    studio_tip: {
      who: 'haeun',
      expr: 'cool',
      ko: '배고프면… 밤에 포장마차 와. 특별히 알려 주는 거야.',
      en: 'If you get hungry… come to the pojangmacha tonight. I’m only telling you because I’m nice.',
      hint: 'The 포장마차 opens at 19:00. Use the clock ⏩, or sit on a lookout bench to let time pass.',
      enter: () => {
        S.metHaeunStudio = true;
        A.done('haeunDay');
        A.hangout('practice_studio');
      },
      end: true,
    },
    studio_bye: { who: 'haeun', expr: 'cool', ko: '…응. 가.', en: '…Yeah. Go.', hint: '<b>안녕히 계세요</b> = bye (you leave, they stay) · <b>안녕히 가세요</b> = bye (they leave)', end: true },
    studio_after: { who: 'haeun', expr: 'blush', ko: '어제… 고마웠어. 진짜야. …연습이나 해!', en: 'About yesterday… thanks. I mean it. …Now go practise!', enter: () => A.flipHair('haeun'), end: true },

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
    jin_hi: {
      who: 'jin',
      expr: 'happy',
      ko: '어, 왔어? 여기 앉아.',
      en: 'Oh, you made it? Have a seat.',
      choices: [
        { ko: '선배님, 안녕하세요!', rom: 'seonbaenim, annyeonghaseyo', en: 'Hello, sunbae!', jin: 1, next: 'jin_sunbae' },
        { ko: '오늘 촬영 어땠어요?', rom: 'oneul chwaryeong eottaesseoyo', en: 'How was filming today?', jin: 1, next: 'jin_practice' },
      ],
    },
    jin_sunbae: {
      who: 'jin',
      expr: 'laugh',
      ko: '“님”은 빼도 돼. 편하게 해.',
      en: 'You can drop the “님”. Relax.',
      hint: '<b>선배</b> (seonbae) = someone senior at school or work. <b>님</b> adds extra respect.',
      enter: () => A.learn('선배', 'seonbae', 'senior (at school/work)'),
      next: 'jin_haeun',
    },
    jin_practice: { who: 'jin', expr: 'sad', ko: '길었어. 하루 종일 다른 사람으로 살았거든.', en: 'Long. I spent all day being someone else.', hint: '<b>촬영</b> (chwaryeong) = filming, a shoot.', enter: () => A.learn('촬영', 'chwaryeong', 'filming / a shoot'), next: 'jin_haeun' },
    jin_haeun: {
      who: 'jin',
      expr: 'smile',
      ko: '아, 하은이 봤어? 밤에 포장마차 자주 가. 매운 거 엄청 좋아해.',
      en: 'Oh, have you met Ha-eun? She’s at the pojangmacha most nights. Loves spicy food.',
      hint: '💡 Tip unlocked: Ha-eun loves spicy food.',
      enter: () => {
        S.jinTip = true;
        A.done('jin');
      },
      next: 'jin_bye',
    },
    jin_bye: { who: 'jin', expr: 'happy', ko: '연습 열심히 해. 화이팅!', en: 'Practise hard. Fighting!', enter: () => A.learn('화이팅', 'hwaiting', 'you can do it! (cheer)'), end: true },
    jin_again: { who: 'jin', expr: 'smile', ko: '커피 맛있지? 여기 내 단골이야.', en: 'Good coffee, right? This is my regular spot.', hint: '<b>단골</b> (dangol) = a regular (customer or spot).', enter: () => A.learn('단골', 'dangol', 'a regular (spot/customer)'), end: true },
    jin_night: {
      who: 'jin',
      expr: 'smile',
      ko: '한강 진짜 예쁘지? …여기선 아무도 날 못 알아봐. 그게 좋아.',
      en: 'The Han River’s beautiful, right? …Nobody recognises me out here. I like that.',
      choices: [
        { ko: '여기선 그냥 진이에요.', rom: 'yeogiseon geunyang jinieyo', en: 'Out here you’re just Jin.', jin: 1, next: 'jin_night_thanks' },
        { ko: '같이 사진 찍어요!', rom: 'gachi sajin jjigeoyo', en: 'Let’s take a photo together!', jin: 1, next: 'jin_photo' },
      ],
    },
    jin_night_thanks: { who: 'jin', expr: 'happy', ko: '…고마워. 그 말 좋다.', en: '…Thanks. I like hearing that.', enter: () => A.done('jinNight'), end: true },
    jin_photo: {
      who: 'jin',
      expr: 'laugh',
      ko: '우리끼리만 보는 거면… 좋아. 하나, 둘, 셋— 김치!',
      en: 'If it stays just between us… okay. One, two, three— kimchi!',
      hint: 'Koreans say <b>김치~</b> instead of “cheese” for photos.',
      enter: () => {
        A.done('jinNight');
        setTimeout(() => A.polaroid('jin'), 900);
      },
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
  const night = hour >= 19 || hour < 3;
  if (!S.quests.cafe && hour >= 8 && hour < 22) return { ko: '카페 봄에서 커피 한 잔 어때?', en: 'How about a coffee at Café Bom? It’s on the right side of the plaza.', expr: 'cheerful' };
  if (!S.quests.haeunDay && hour >= 9 && hour < 18.5) return { ko: '연습실에서 음악 소리가 들려!', en: 'I can hear music from the practice studio up the stairs…', expr: 'excited' };
  if (!S.quests.store) return { ko: '편의점은 24시간이야!', en: 'The convenience store is open 24 hours — try buying something.', expr: 'cheerful' };
  if (!S.quests.haeun && night) return { ko: '포장마차 문 열었어!', en: 'The pojangmacha is open now. Someone familiar might be there…', expr: 'love' };
  if (!S.quests.haeun) return { ko: '포장마차는 밤에 열어.', en: 'The pojangmacha opens at 7 PM. Sit on a lookout bench to watch the sunset.', expr: 'thinking' };
  if (!S.quests.jinNight && night) return { ko: '진 선배가 한강에 있대.', en: 'Jin is at the river lookout tonight.', expr: 'cheerful' };
  if (S.words.size < 10) return { ko: '반짝이는 단어를 찾아봐!', en: `Find the glowing words around the neighbourhood (${S.words.size}/10).`, expr: 'thinking' };
  return { ko: '오늘 정말 잘했어!', en: 'You did amazing today. Try the word quiz in the studio!', expr: 'proud' };
}
