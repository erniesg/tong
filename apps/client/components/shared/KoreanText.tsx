'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useUILang } from '@/lib/i18n/UILangContext';
import { getCachedTranslation, requestTranslations, onTranslationsReady } from '@/lib/i18n/translation-cache';

/* ── Target language type ──────────────────────────────────── */
export type TargetLang = 'ko' | 'zh' | 'ja';

/* ── Pinyin map for common Chinese characters ──────────────── */
const PINYIN_MAP: Record<string, string> = {
  '我': 'wǒ', '你': 'nǐ', '他': 'tā', '她': 'tā', '它': 'tā',
  '是': 'shì', '的': 'de', '了': 'le', '在': 'zài', '有': 'yǒu',
  '不': 'bù', '人': 'rén', '这': 'zhè', '那': 'nà', '来': 'lái',
  '去': 'qù', '到': 'dào', '说': 'shuō', '看': 'kàn', '吃': 'chī',
  '喝': 'hē', '做': 'zuò', '想': 'xiǎng', '要': 'yào', '会': 'huì',
  '能': 'néng', '可': 'kě', '以': 'yǐ', '和': 'hé', '也': 'yě',
  '都': 'dōu', '就': 'jiù', '还': 'hái', '很': 'hěn', '太': 'tài',
  '好': 'hǎo', '大': 'dà', '小': 'xiǎo', '多': 'duō', '少': 'shǎo',
  '什': 'shén', '么': 'me', '谁': 'shéi', '哪': 'nǎ', '里': 'lǐ',
  '哪里': 'nǎlǐ', '怎': 'zěn', '为': 'wèi',
  '一': 'yī', '二': 'èr', '三': 'sān', '四': 'sì', '五': 'wǔ',
  '六': 'liù', '七': 'qī', '八': 'bā', '九': 'jiǔ', '十': 'shí',
  '百': 'bǎi', '千': 'qiān', '万': 'wàn',
  '上': 'shàng', '下': 'xià', '中': 'zhōng', '前': 'qián', '后': 'hòu',
  '左': 'zuǒ', '右': 'yòu', '东': 'dōng', '西': 'xī', '南': 'nán', '北': 'běi',
  '天': 'tiān', '地': 'dì', '水': 'shuǐ', '火': 'huǒ', '山': 'shān',
  '日': 'rì', '月': 'yuè', '年': 'nián', '时': 'shí', '点': 'diǎn',
  '钟': 'zhōng', '分': 'fēn', '今': 'jīn', '明': 'míng', '昨': 'zuó',
  '吗': 'ma', '呢': 'ne', '啊': 'a', '哦': 'ó', '嗯': 'ǹg',
  '没': 'méi', '对': 'duì', '错': 'cuò', '知': 'zhī', '道': 'dào',
  '叫': 'jiào', '名': 'míng', '字': 'zì', '家': 'jiā', '学': 'xué',
  '生': 'shēng', '老': 'lǎo', '师': 'shī', '朋': 'péng', '友': 'yǒu',
  '先': 'xiān', '再': 'zài', '见': 'jiàn',
  '请': 'qǐng', '问': 'wèn', '给': 'gěi', '把': 'bǎ', '让': 'ràng',
  '从': 'cóng', '跟': 'gēn', '比': 'bǐ', '被': 'bèi',
  '开': 'kāi', '关': 'guān', '买': 'mǎi', '卖': 'mài', '走': 'zǒu',
  '跑': 'pǎo', '坐': 'zuò', '站': 'zhàn', '等': 'děng', '用': 'yòng',
  '找': 'zhǎo', '回': 'huí', '住': 'zhù', '听': 'tīng', '写': 'xiě',
  '读': 'dú', '打': 'dǎ', '玩': 'wán', '睡': 'shuì', '觉': 'jiào',
  '穿': 'chuān', '带': 'dài', '放': 'fàng', '拿': 'ná', '送': 'sòng',
  '高': 'gāo', '低': 'dī', '长': 'cháng', '短': 'duǎn', '快': 'kuài',
  '慢': 'màn', '新': 'xīn', '旧': 'jiù', '冷': 'lěng', '热': 'rè',
  '贵': 'guì', '便': 'pián', '宜': 'yi', '近': 'jìn', '远': 'yuǎn',
  '早': 'zǎo', '晚': 'wǎn', '饿': 'è', '累': 'lèi', '忙': 'máng',
  '红': 'hóng', '白': 'bái', '黑': 'hēi', '蓝': 'lán', '绿': 'lǜ',
  '黄': 'huáng',
  // Food & drink
  '饭': 'fàn', '菜': 'cài', '肉': 'ròu', '鱼': 'yú', '鸡': 'jī',
  '蛋': 'dàn', '面': 'miàn', '包': 'bāo', '米': 'mǐ', '汤': 'tāng',
  '茶': 'chá', '酒': 'jiǔ', '奶': 'nǎi', '糖': 'táng', '盐': 'yán',
  '油': 'yóu', '醋': 'cù', '辣': 'là', '甜': 'tián', '酸': 'suān',
  '苦': 'kǔ', '咸': 'xián', '冰': 'bīng', '杯': 'bēi',
  // Transport / places
  '车': 'chē', '路': 'lù', '铁': 'tiě', '口': 'kǒu', '换': 'huàn',
  '乘': 'chéng', '票': 'piào', '出': 'chū', '入': 'rù', '门': 'mén',
  '店': 'diàn', '号': 'hào', '街': 'jiē', '市': 'shì', '城': 'chéng',
  '海': 'hǎi', '河': 'hé', '桥': 'qiáo',
  // Common phrases chars
  '谢': 'xiè', '欢': 'huān', '迎': 'yíng', '客': 'kè', '气': 'qì',
  '意': 'yì', '思': 'sī', '喜': 'xǐ', '怕': 'pà', '爱': 'ài',
  '帅': 'shuài', '美': 'měi', '漂': 'piào', '亮': 'liàng',
  '真': 'zhēn', '最': 'zuì', '刚': 'gāng', '已': 'yǐ',
  '经': 'jīng', '正': 'zhèng', '别': 'bié',
  // Shanghai-specific
  '笼': 'lóng', '烧': 'shāo', '烤': 'kǎo', '串': 'chuàn', '摊': 'tān',
  '珍': 'zhēn', '珠': 'zhū', '龙': 'lóng', '虾': 'xiā', '饺': 'jiǎo',
  '姜': 'jiāng', '袋': 'dài', '子': 'zi', '扫': 'sǎo', '码': 'mǎ',
  '泉': 'quán', '矿': 'kuàng', '叶': 'yè', '团': 'tuán',
  '羊': 'yáng', '啤': 'pí', '钱': 'qián', '碗': 'wǎn',
  '利': 'lì', '便利': 'biànlì',
  // Conversation / feelings
  '行': 'xíng', '可以': 'kěyǐ', '当': 'dāng', '然': 'rán',
  '如': 'rú', '果': 'guǒ', '因': 'yīn', '所': 'suǒ',
  '但': 'dàn', '而': 'ér', '或': 'huò', '者': 'zhě',
  '过': 'guò', '完': 'wán', '起': 'qǐ', '得': 'de',
  '着': 'zhe', '像': 'xiàng', '样': 'yàng', '种': 'zhǒng',
  '边': 'biān', '头': 'tóu', '身': 'shēn', '体': 'tǐ',
  '手': 'shǒu', '脚': 'jiǎo', '眼': 'yǎn', '耳': 'ěr', '嘴': 'zuǐ',
  '脸': 'liǎn', '心': 'xīn',
  '练': 'liàn', '习': 'xí',
};

/**
 * Dictionary lookup for known words.
 */
const DICTIONARY: Record<string, { romanization: string; translation: string }> = {
  // Greetings & basics
  '포장마차': { romanization: 'po-jang-ma-cha', translation: 'street food tent' },
  '안녕하세요': { romanization: 'an-nyeong-ha-se-yo', translation: 'hello (formal)' },
  '안녕': { romanization: 'an-nyeong', translation: 'hi / bye' },
  '네': { romanization: 'ne', translation: 'yes' },
  '아니요': { romanization: 'a-ni-yo', translation: 'no' },
  '감사합니다': { romanization: 'gam-sa-ham-ni-da', translation: 'thank you (formal)' },
  '고마워': { romanization: 'go-ma-wo', translation: 'thanks (casual)' },
  '미안해': { romanization: 'mi-an-hae', translation: 'sorry (casual)' },
  '괜찮아': { romanization: 'gwaen-cha-na', translation: "it's okay" },

  // Common expressions
  '준비됐어': { romanization: 'jun-bi-dwaess-eo', translation: "I'm ready" },
  '잘했어': { romanization: 'jal-haess-eo', translation: 'good job!' },
  '대박': { romanization: 'dae-bak', translation: 'amazing / wow' },
  '화이팅': { romanization: 'hwa-i-ting', translation: 'fighting! (encouragement)' },
  '진짜': { romanization: 'jin-jja', translation: 'really / for real' },
  '어서 오세요': { romanization: 'eo-seo o-se-yo', translation: 'welcome (come in)' },

  // Food & ordering
  '떡볶이': { romanization: 'tteok-bokk-i', translation: 'spicy rice cakes' },
  '김밥': { romanization: 'gim-bap', translation: 'seaweed rice roll' },
  '라면': { romanization: 'ra-myeon', translation: 'ramen noodles' },
  '순대': { romanization: 'sun-dae', translation: 'blood sausage' },
  '오뎅': { romanization: 'o-deng', translation: 'fish cake skewer' },
  '튀김': { romanization: 'twi-gim', translation: 'fried snacks' },
  '소주': { romanization: 'so-ju', translation: 'soju (rice liquor)' },
  '막걸리': { romanization: 'mak-geol-li', translation: 'rice wine' },
  '밥': { romanization: 'bap', translation: 'rice / meal' },
  '주세요': { romanization: 'ju-se-yo', translation: 'please give me' },
  '맛있다': { romanization: 'mas-it-da', translation: 'delicious' },
  '맛있어': { romanization: 'mas-iss-eo', translation: "it's delicious" },
  '맵다': { romanization: 'maep-da', translation: 'spicy' },
  '매워': { romanization: 'mae-wo', translation: "it's spicy" },
  '물': { romanization: 'mul', translation: 'water' },
  '메뉴': { romanization: 'me-nyu', translation: 'menu' },
  '먹었어': { romanization: 'meog-eoss-eo', translation: 'ate / have eaten' },
  '어묵': { romanization: 'eo-muk', translation: 'fish cake' },
  '호떡': { romanization: 'ho-tteok', translation: 'sweet pancake' },
  '볶음밥': { romanization: 'bokk-eum-bap', translation: 'fried rice' },
  '국물': { romanization: 'guk-mul', translation: 'broth / soup' },
  '닭갈비': { romanization: 'dak-gal-bi', translation: 'spicy chicken stir-fry' },
  '비빔밥': { romanization: 'bi-bim-bap', translation: 'mixed rice bowl' },
  '만두': { romanization: 'man-du', translation: 'dumpling' },
  '치킨': { romanization: 'chi-kin', translation: 'fried chicken' },
  '맥주': { romanization: 'maek-ju', translation: 'beer' },

  // People & relationships
  '선배': { romanization: 'seon-bae', translation: 'senior' },
  '후배': { romanization: 'hu-bae', translation: 'junior' },
  '친구': { romanization: 'chin-gu', translation: 'friend' },
  '언니': { romanization: 'eon-ni', translation: 'older sister (f→f)' },
  '오빠': { romanization: 'op-pa', translation: 'older brother (f→m)' },
  '아저씨': { romanization: 'a-jeo-ssi', translation: 'mister / uncle' },
  '아줌마': { romanization: 'a-jum-ma', translation: "ma'am / auntie" },
  '연습생': { romanization: 'yeon-seup-ssaeng', translation: 'trainee' },

  // Common verbs
  '좋아': { romanization: 'jo-a', translation: 'good / I like it' },
  '싫어': { romanization: 'sir-eo', translation: "I don't like it" },
  '몰라': { romanization: 'mol-la', translation: "I don't know" },
  '할 수 있어': { romanization: 'hal su iss-eo', translation: 'I can do it' },
  '천천히': { romanization: 'cheon-cheon-hi', translation: 'slowly' },
  '같이': { romanization: 'ga-chi', translation: 'together' },
  '여기': { romanization: 'yeo-gi', translation: 'here' },
  '이거': { romanization: 'i-geo', translation: 'this' },
  '뭐': { romanization: 'mwo', translation: 'what' },

  // Scene-specific
  '홍대': { romanization: 'hong-dae', translation: 'Hongdae (neighborhood)' },
  '한국어': { romanization: 'han-gug-eo', translation: 'Korean language' },
  '한국': { romanization: 'han-guk', translation: 'Korea' },
  '연습': { romanization: 'yeon-seup', translation: 'practice' },
  '시작': { romanization: 'si-jak', translation: 'start / beginning' },
  '잘 먹겠습니다': { romanization: 'jal meok-gess-eum-ni-da', translation: "I'll eat well (before eating)" },

  // Reactions
  'ㅋㅋ': { romanization: 'kk', translation: 'haha (laughter)' },
  'ㅎㅎ': { romanization: 'hh', translation: 'hehe (soft laugh)' },

  // Useful phrases
  '가자': { romanization: 'ga-ja', translation: "let's go" },
  '먹자': { romanization: 'meok-ja', translation: "let's eat" },

  // City map locations (Seoul)
  '먹자골목': { romanization: 'meok-ja gol-mok', translation: 'Food Street' },
  '카페': { romanization: 'ka-pe', translation: 'Cafe' },
  '편의점': { romanization: 'pyeon-ui-jeom', translation: 'Convenience Store' },
  '지하철': { romanization: 'ji-ha-cheol', translation: 'Subway' },
  '치맥': { romanization: 'chi-maek', translation: 'Chicken + Beer place' },
  '지하철역': { romanization: 'ji-ha-cheol-yeok', translation: 'Subway Station' },
  '연습실': { romanization: 'yeon-seup-ssil', translation: 'Practice Studio' },
  '서울': { romanization: 'seo-ul', translation: 'Seoul' },

  // City names (Japanese)
  '東京': { romanization: 'tō-kyō', translation: 'Tokyo' },

  // Chinese words with pinyin
  '地铁站': { romanization: 'dì-tiě zhàn', translation: 'Metro station' },
  '烧烤摊': { romanization: 'shāo-kǎo tān', translation: 'BBQ grill stall' },
  '便利店': { romanization: 'biàn-lì diàn', translation: 'Convenience store' },
  '奶茶店': { romanization: 'nǎi-chá diàn', translation: 'Milk tea shop' },
  '小笼包店': { romanization: 'xiǎo-lóng bāo diàn', translation: 'Dumpling shop' },
  '上海': { romanization: 'shàng-hǎi', translation: 'Shanghai' },
  '你好': { romanization: 'nǐ hǎo', translation: 'hello' },
  '谢谢': { romanization: 'xiè-xie', translation: 'thank you' },
  '好吃': { romanization: 'hǎo chī', translation: 'delicious' },
  '多少钱': { romanization: 'duō-shǎo qián', translation: 'how much?' },
  '奶茶': { romanization: 'nǎi-chá', translation: 'milk tea' },
  '小笼包': { romanization: 'xiǎo-lóng bāo', translation: 'soup dumplings' },
  '地铁': { romanization: 'dì-tiě', translation: 'subway / metro' },
  '烧烤': { romanization: 'shāo-kǎo', translation: 'BBQ / grill' },
  '我是谁': { romanization: 'wǒ shì shéi', translation: 'who am I' },
  '在哪': { romanization: 'zài nǎ', translation: 'where' },
  '这里': { romanization: 'zhè-lǐ', translation: 'here' },
  '弘大': { romanization: 'hóng-dà', translation: 'Hongdae' },
  '附近': { romanization: 'fù-jìn', translation: 'nearby' },
  '路边': { romanization: 'lù-biān', translation: 'roadside' },
  '帐篷': { romanization: 'zhàng-péng', translation: 'tent' },
  '小吃': { romanization: 'xiǎo-chī', translation: 'snacks / street food' },
  '练完': { romanization: 'liàn-wán', translation: 'finished practice' },
  '刚练完': { romanization: 'gāng liàn-wán', translation: 'just finished practice' },
};


const JAMO_DICT: Record<string, { romanization: string; name: string }> = {
  'ㄱ': { romanization: 'g/k', name: 'giyeok' },
  'ㄴ': { romanization: 'n', name: 'nieun' },
  'ㄷ': { romanization: 'd/t', name: 'digeut' },
  'ㄹ': { romanization: 'r/l', name: 'rieul' },
  'ㅁ': { romanization: 'm', name: 'mieum' },
  'ㅂ': { romanization: 'b/p', name: 'bieup' },
  'ㅅ': { romanization: 's', name: 'siot' },
  'ㅇ': { romanization: 'ng/silent', name: 'ieung' },
  'ㅈ': { romanization: 'j', name: 'jieut' },
  'ㅊ': { romanization: 'ch', name: 'chieut' },
  'ㅋ': { romanization: 'k', name: 'kieuk' },
  'ㅌ': { romanization: 't', name: 'tieut' },
  'ㅍ': { romanization: 'p', name: 'pieup' },
  'ㅎ': { romanization: 'h', name: 'hieut' },
  'ㅏ': { romanization: 'a', name: 'a' },
  'ㅓ': { romanization: 'eo', name: 'eo' },
  'ㅗ': { romanization: 'o', name: 'o' },
  'ㅜ': { romanization: 'u', name: 'u' },
  'ㅡ': { romanization: 'eu', name: 'eu' },
  'ㅣ': { romanization: 'i', name: 'i' },
  'ㅐ': { romanization: 'ae', name: 'ae' },
  'ㅔ': { romanization: 'e', name: 'e' },
};

/* ── Character classification ──────────────────────────────── */

function isHangulSyllable(code: number): boolean {
  return code >= 0xac00 && code <= 0xd7a3;
}

function isHangulJamo(code: number): boolean {
  return (code >= 0x3131 && code <= 0x3163) || (code >= 0x1100 && code <= 0x11ff);
}

function isCJKIdeograph(code: number): boolean {
  return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf);
}

function isJapaneseKana(code: number): boolean {
  return (code >= 0x3040 && code <= 0x309f) || (code >= 0x30a0 && code <= 0x30ff);
}

/** Check if a character belongs to the target language's script. */
function isTargetChar(char: string, targetLang: TargetLang): boolean {
  const code = char.charCodeAt(0);
  switch (targetLang) {
    case 'ko':
      // Korean: Hangul syllables + Jamo only. NOT CJK ideographs.
      return isHangulSyllable(code) || isHangulJamo(code);
    case 'zh':
      // Chinese: CJK ideographs only.
      return isCJKIdeograph(code);
    case 'ja':
      // Japanese: Kana + CJK ideographs (kanji).
      return isJapaneseKana(code) || isCJKIdeograph(code);
    default:
      return false;
  }
}

/* ── Text segmentation ─────────────────────────────────────── */

function segmentText(text: string, targetLang: TargetLang): { text: string; isTarget: boolean }[] {
  if (!text) return [];
  const segments: { text: string; isTarget: boolean }[] = [];
  let current = '';
  let currentIsTarget = false;

  for (const char of text) {
    const charIsTarget = isTargetChar(char, targetLang);
    if (current.length === 0) {
      current = char;
      currentIsTarget = charIsTarget;
    } else if (charIsTarget === currentIsTarget) {
      current += char;
    } else {
      segments.push({ text: current, isTarget: currentIsTarget });
      current = char;
      currentIsTarget = charIsTarget;
    }
  }
  if (current) {
    segments.push({ text: current, isTarget: currentIsTarget });
  }
  return segments;
}

/* ── Romanization ──────────────────────────────────────────── */

function romanizeSyllable(char: string): string | null {
  const code = char.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;
  const INITIALS = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
  const MEDIALS = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
  const FINALS = ['', 'g', 'kk', 'gs', 'n', 'nj', 'nh', 'd', 'l', 'lg', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'b', 'bs', 's', 'ss', 'ng', 'j', 'ch', 'k', 't', 'p', 'h'];
  const offset = code - 0xac00;
  const initial = Math.floor(offset / (21 * 28));
  const medial = Math.floor((offset % (21 * 28)) / 28);
  const final = offset % 28;
  return `${INITIALS[initial]}${MEDIALS[medial]}${FINALS[final]}`;
}

function lookupWord(word: string): { romanization: string; translation: string } | null {
  if (DICTIONARY[word]) return DICTIONARY[word];
  const particles = ['을', '를', '이', '가', '는', '은', '에', '서', '도', '의', '와', '과', '로'];
  for (const p of particles) {
    if (word.endsWith(p) && word.length > p.length) {
      const stem = word.slice(0, -p.length);
      if (DICTIONARY[stem]) return DICTIONARY[stem];
    }
  }
  if (word.length === 1 && JAMO_DICT[word]) {
    const j = JAMO_DICT[word];
    return { romanization: j.romanization, translation: j.name };
  }
  return null;
}

function getTooltipInfo(word: string, targetLang: TargetLang, explainLang: string): { romanization: string; translation?: string } | null {
  const dictResult = lookupWord(word);

  // Resolve translation: check dynamic cache first, then static dictionary (English only)
  const resolveTranslation = (w: string, englishFallback?: string): string | undefined => {
    // Dynamic cache (AI-translated into user's preferred language)
    const cached = getCachedTranslation(w, targetLang, explainLang);
    if (cached) return cached;
    // If user wants English, use the static dictionary translation
    if (explainLang === 'en' && englishFallback) return englishFallback;
    // No translation yet — it'll arrive async from the cache
    return undefined;
  };

  if (dictResult) {
    return {
      romanization: dictResult.romanization,
      translation: resolveTranslation(word, dictResult.translation),
    };
  }

  const chars = [...word];

  if (targetLang === 'zh') {
    // Chinese: use pinyin map for each character
    const pinyinParts = chars.map((ch) => PINYIN_MAP[ch] ?? ch);
    const romanized = pinyinParts.join(' ');
    if (pinyinParts.some((p, i) => p !== chars[i])) {
      return { romanization: romanized, translation: resolveTranslation(word) };
    }
    return null;
  }

  // Korean: use syllable decomposition
  const romanized = chars.map((ch) => {
    if (JAMO_DICT[ch]) return JAMO_DICT[ch].romanization;
    return romanizeSyllable(ch) ?? ch;
  }).join('-');
  if (romanized && romanized !== word) {
    return { romanization: romanized, translation: resolveTranslation(word) };
  }
  return null;
}

/* ── Component ─────────────────────────────────────────────── */

interface KoreanTextProps {
  text: string;
  targetLang?: TargetLang;
}

export function KoreanText({ text, targetLang = 'ko' }: KoreanTextProps) {
  const explainLang = useUILang();
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [tooltipInfo, setTooltipInfo] = useState<{ romanization: string; translation?: string } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [mounted, setMounted] = useState(false);
  const [, setTranslationTick] = useState(0);

  useEffect(() => { setMounted(true); }, []);

  // Pre-fetch translations for all target-language words when text renders
  const segments = segmentText(text, targetLang);
  useEffect(() => {
    if (explainLang === 'en' || explainLang === targetLang) return; // English uses static dict, same-lang needs no translation
    const targetWords = segments.filter((s) => s.isTarget).map((s) => s.text.trim()).filter(Boolean);
    if (targetWords.length > 0) {
      requestTranslations(targetWords, targetLang, explainLang);
    }
  }, [text, targetLang, explainLang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-render when async translations arrive
  useEffect(() => {
    return onTranslationsReady(() => setTranslationTick((n) => n + 1));
  }, []);

  const showTooltip = useCallback((word: string, target: HTMLElement) => {
    const info = getTooltipInfo(word.trim(), targetLang, explainLang);
    if (!info) return;
    const rect = target.getBoundingClientRect();
    setActiveWord(word);
    setTooltipInfo(info);
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
  }, [targetLang, explainLang]);

  const hideTooltip = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => { setActiveWord(null); }, 150);
  }, []);

  const handleMouseEnter = useCallback((word: string, e: React.MouseEvent) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    showTooltip(word, e.currentTarget as HTMLElement);
  }, [showTooltip]);

  const handleTap = useCallback((word: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (activeWord === word) { setActiveWord(null); return; }
    showTooltip(word, e.currentTarget as HTMLElement);
  }, [activeWord, showTooltip]);

  const tooltipVisible = activeWord && tooltipInfo && tooltipPos;

  return (
    <>
      <span className="relative inline">
        {segments.map((seg, i) => {
          if (!seg.isTarget) {
            return <span key={i}>{seg.text}</span>;
          }
          return (
            <span
              key={i}
              onClick={(e) => handleTap(seg.text.trim(), e)}
              onMouseEnter={(e) => handleMouseEnter(seg.text.trim(), e)}
              onMouseLeave={hideTooltip}
              data-korean
              className="text-ko cursor-pointer border-b border-dotted border-[var(--color-accent-gold)]/40 hover:border-[var(--color-accent-gold)] active:border-[var(--color-accent-gold)]"
            >
              {seg.text}
            </span>
          );
        })}
      </span>

      {mounted && tooltipVisible && createPortal(
        <div
          className="korean-tooltip fade-in pointer-events-auto"
          onMouseEnter={() => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); }}
          onMouseLeave={hideTooltip}
          style={{
            position: 'fixed',
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y - 8}px`,
            transform: 'translate(-50%, -100%)',
            zIndex: 99999,
          }}
        >
          <div className="rounded-lg bg-[#16213e] border border-[var(--color-accent-gold)]/40 px-3 py-2 shadow-lg text-left min-w-[140px]">
            <p className="text-sm font-medium text-[var(--color-accent-gold)] m-0">{activeWord}</p>
            {tooltipInfo.romanization && (
              <p className="text-xs text-[var(--color-text-muted)] m-0">{tooltipInfo.romanization}</p>
            )}
            {tooltipInfo.translation && (
              <p className="text-xs text-[var(--color-text)] mt-0.5 m-0">{tooltipInfo.translation}</p>
            )}
          </div>
          <div className="flex justify-center">
            <div className="w-2 h-2 rotate-45 bg-[#16213e] border-r border-b border-[var(--color-accent-gold)]/40 -mt-1" />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
