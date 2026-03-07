/**
 * Multi-language translations for vocabulary items.
 * Used by exercise generators to show options/labels in the user's explainIn language.
 */
import type { UILang } from './ui-strings';

/** word → { en, zh, ja, ko } */
const VOCAB_TRANSLATIONS: Record<string, Record<UILang, string>> = {
  // ── Food items ──
  '오뎅':     { en: 'fish cake', zh: '鱼糕', ja: 'おでん', ko: '오뎅' },
  '떡볶이':   { en: 'spicy rice cakes', zh: '辣炒年糕', ja: 'トッポッキ', ko: '떡볶이' },
  '라면':     { en: 'instant noodles', zh: '拉面', ja: 'ラーメン', ko: '라면' },
  '순대':     { en: 'blood sausage', zh: '血肠', ja: 'スンデ', ko: '순대' },
  '김밥':     { en: 'seaweed rice roll', zh: '紫菜饭卷', ja: 'キンパ', ko: '김밥' },
  '어묵':     { en: 'fish cake (formal)', zh: '鱼饼', ja: 'さつま揚げ', ko: '어묵' },
  '만두':     { en: 'dumplings', zh: '饺子', ja: 'マンドゥ', ko: '만두' },
  '튀김':     { en: 'deep-fried snacks', zh: '炸物', ja: '天ぷら', ko: '튀김' },
  '꼬치':     { en: 'skewers', zh: '串', ja: '串焼き', ko: '꼬치' },
  '호떡':     { en: 'sweet pancake', zh: '糖饼', ja: 'ホットク', ko: '호떡' },
  '붕어빵':   { en: 'fish-shaped bread', zh: '鲫鱼饼', ja: 'たい焼き', ko: '붕어빵' },
  '비빔밥':   { en: 'mixed rice', zh: '拌饭', ja: 'ビビンバ', ko: '비빔밥' },
  '볶음밥':   { en: 'fried rice', zh: '炒饭', ja: 'チャーハン', ko: '볶음밥' },
  '김치':     { en: 'kimchi', zh: '泡菜', ja: 'キムチ', ko: '김치' },
  '떡꼬치':   { en: 'rice cake skewer', zh: '年糕串', ja: 'トッコチ', ko: '떡꼬치' },
  '소떡소떡': { en: 'sausage rice cake skewer', zh: '香肠年糕串', ja: 'ソトクソトク', ko: '소떡소떡' },
  '핫도그':   { en: 'corn dog', zh: '热狗', ja: 'ホットドッグ', ko: '핫도그' },
  '군고구마': { en: 'roasted sweet potato', zh: '烤红薯', ja: '焼き芋', ko: '군고구마' },
  '잡채':     { en: 'glass noodles', zh: '杂菜', ja: 'チャプチェ', ko: '잡채' },
  '컵밥':     { en: 'cup rice', zh: '杯饭', ja: 'カップご飯', ko: '컵밥' },

  // ── Drinks ──
  '물':       { en: 'water', zh: '水', ja: '水', ko: '물' },
  '콜라':     { en: 'cola', zh: '可乐', ja: 'コーラ', ko: '콜라' },
  '주스':     { en: 'juice', zh: '果汁', ja: 'ジュース', ko: '주스' },
  '소주':     { en: 'soju', zh: '烧酒', ja: '焼酎', ko: '소주' },
  '맥주':     { en: 'beer', zh: '啤酒', ja: 'ビール', ko: '맥주' },
  '사이다':   { en: 'cider/sprite', zh: '雪碧', ja: 'サイダー', ko: '사이다' },

  // ── Taste words ──
  '맵다':     { en: 'spicy', zh: '辣', ja: '辛い', ko: '맵다' },
  '달다':     { en: 'sweet', zh: '甜', ja: '甘い', ko: '달다' },
  '짜다':     { en: 'salty', zh: '咸', ja: 'しょっぱい', ko: '짜다' },
  '맛있다':   { en: 'delicious', zh: '好吃', ja: 'おいしい', ko: '맛있다' },
  '맛없다':   { en: 'not tasty', zh: '不好吃', ja: 'まずい', ko: '맛없다' },
  '시다':     { en: 'sour', zh: '酸', ja: '酸っぱい', ko: '시다' },
  '쓰다':     { en: 'bitter', zh: '苦', ja: '苦い', ko: '쓰다' },
  '뜨겁다':   { en: 'hot', zh: '烫', ja: '熱い', ko: '뜨겁다' },
  '차갑다':   { en: 'cold', zh: '凉', ja: '冷たい', ko: '차갑다' },
  '맵지 않다': { en: 'not spicy', zh: '不辣', ja: '辛くない', ko: '맵지 않다' },

  // ── Numbers ──
  '하나':     { en: 'one', zh: '一', ja: '一つ', ko: '하나' },
  '둘':       { en: 'two', zh: '二', ja: '二つ', ko: '둘' },
  '셋':       { en: 'three', zh: '三', ja: '三つ', ko: '셋' },
  '넷':       { en: 'four', zh: '四', ja: '四つ', ko: '넷' },
  '다섯':     { en: 'five', zh: '五', ja: '五つ', ko: '다섯' },

  // ── Verbs ──
  '먹다':     { en: 'to eat', zh: '吃', ja: '食べる', ko: '먹다' },
  '주다':     { en: 'to give', zh: '给', ja: 'あげる', ko: '주다' },
  '마시다':   { en: 'to drink', zh: '喝', ja: '飲む', ko: '마시다' },
  '사다':     { en: 'to buy', zh: '买', ja: '買う', ko: '사다' },
  '시키다':   { en: 'to order', zh: '点(菜)', ja: '注文する', ko: '시키다' },

  // ── Courtesy phrases ──
  '주세요':       { en: 'please (give me)', zh: '请给我', ja: 'ください', ko: '주세요' },
  '감사합니다':   { en: 'thank you', zh: '谢谢', ja: 'ありがとうございます', ko: '감사합니다' },
  '잠시만요':     { en: 'just a moment', zh: '请稍等', ja: 'ちょっと待ってください', ko: '잠시만요' },
  '여기요':       { en: 'excuse me (here)', zh: '这里', ja: 'すみません', ko: '여기요' },
  '얼마예요':     { en: 'how much?', zh: '多少钱？', ja: 'いくらですか？', ko: '얼마예요' },
  '안녕하세요':   { en: 'hello', zh: '你好', ja: 'こんにちは', ko: '안녕하세요' },
  '죄송합니다':   { en: 'sorry', zh: '对不起', ja: 'すみません', ko: '죄송합니다' },
  '네':           { en: 'yes', zh: '是', ja: 'はい', ko: '네' },

  // ── Jamo consonant descriptions ──
  'ㄱ': { en: 'g/k', zh: '像"哥"的声母', ja: '「が」の子音', ko: 'ㄱ' },
  'ㄴ': { en: 'n', zh: '像"呢"的声母', ja: '「な」の子音', ko: 'ㄴ' },
  'ㄷ': { en: 'd/t', zh: '像"的"的声母', ja: '「だ」の子音', ko: 'ㄷ' },
  'ㄹ': { en: 'r/l', zh: '像"了"的声母', ja: '「ら」の子音', ko: 'ㄹ' },
  'ㅁ': { en: 'm', zh: '像"么"的声母', ja: '「ま」の子音', ko: 'ㅁ' },
  'ㅂ': { en: 'b/p', zh: '像"八"的声母', ja: '「ば」の子音', ko: 'ㅂ' },
  'ㅅ': { en: 's', zh: '像"四"的声母', ja: '「さ」の子音', ko: 'ㅅ' },
  'ㅇ': { en: 'ng (silent)', zh: '像"嗯"的鼻音', ja: '「ん」の音', ko: 'ㅇ' },
  'ㅈ': { en: 'j', zh: '像"吉"的声母', ja: '「じゃ」の子音', ko: 'ㅈ' },
  'ㅊ': { en: 'ch', zh: '像"吃"的声母', ja: '「ちゃ」の子音', ko: 'ㅊ' },
  'ㅋ': { en: 'k', zh: '像"可"的声母', ja: '「か」の子音', ko: 'ㅋ' },
  'ㅌ': { en: 't', zh: '像"他"的声母', ja: '「た」の子音', ko: 'ㅌ' },
  'ㅍ': { en: 'p', zh: '像"怕"的声母', ja: '「ぱ」の子音', ko: 'ㅍ' },
  'ㅎ': { en: 'h', zh: '像"哈"的声母', ja: '「は」の子音', ko: 'ㅎ' },

  // ── Jamo vowel descriptions ──
  'ㅏ': { en: 'a', zh: '像"啊"', ja: '「あ」の音', ko: 'ㅏ' },
  'ㅑ': { en: 'ya', zh: '像"呀"', ja: '「や」の音', ko: 'ㅑ' },
  'ㅓ': { en: 'eo', zh: '像"哦"', ja: '「お」に近い音', ko: 'ㅓ' },
  'ㅕ': { en: 'yeo', zh: '像"哟"', ja: '「よ」に近い音', ko: 'ㅕ' },
  'ㅗ': { en: 'o', zh: '像"喔"', ja: '「お」の音', ko: 'ㅗ' },
  'ㅛ': { en: 'yo', zh: '像"哟"', ja: '「よ」の音', ko: 'ㅛ' },
  'ㅜ': { en: 'u', zh: '像"乌"', ja: '「う」の音', ko: 'ㅜ' },
  'ㅠ': { en: 'yu', zh: '像"鱼"', ja: '「ゆ」の音', ko: 'ㅠ' },
  'ㅡ': { en: 'eu', zh: '扁嘴"呃"', ja: '口を横に引く「う」', ko: 'ㅡ' },
  'ㅣ': { en: 'i', zh: '像"衣"', ja: '「い」の音', ko: 'ㅣ' },
};

/**
 * Get the localized translation of a Korean word.
 * Falls back: requested lang → en → original word.
 */
export function getVocabTranslation(word: string, lang: UILang = 'en'): string {
  const entry = VOCAB_TRANSLATIONS[word];
  if (!entry) return word;
  return entry[lang] ?? entry.en ?? word;
}
