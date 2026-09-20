'use client';

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useUILang } from '@/lib/i18n/UILangContext';
import { getCachedTranslation, requestTranslations, onTranslationsReady } from '@/lib/i18n/translation-cache';
import { HIRAGANA, KATAKANA } from '@/lib/content/scripts/kana';

/* ── Target language type ──────────────────────────────────── */
export type TargetLang = 'ko' | 'zh' | 'ja';

type DictionaryEntry = {
  romanization: string;
  translation: string;
};

type KoreanHanjaReading = {
  hangul: string;
  romanization: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

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
  // Shanghai H1 onboarding
  '方': 'fāng', '案': 'àn', '法': 'fǎ', '节': 'jié', '目': 'mù',
  '自': 'zì', '己': 'jǐ', '需': 'xū', '配': 'pèi', '合': 'hé',
  '演': 'yǎn', '愿': 'yuàn', '假': 'jiǎ', '话': 'huà', '接': 'jiē', '重': 'zhòng',
  '瞿': 'Qú', '响': 'xiǎng', '次': 'cì',
  '付': 'fù', '款': 'kuǎn', '证': 'zhèng',
  '犟': 'jiàng', '事': 'shì',
};

/**
 * Dictionary lookup for known words.
 */
const DICTIONARY: Record<string, DictionaryEntry> = {
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
  '韓國': { romanization: 'han-guk', translation: 'Korea' },
  '韓國語': { romanization: 'han-gug-eo', translation: 'Korean language' },
  '韓文': { romanization: 'han-mun', translation: 'Korean script / Korean writing' },
  '漢字': { romanization: 'han-ja', translation: 'hanja / Chinese characters' },
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

  // City names & locations (Japanese)
  '東京': { romanization: 'tō-kyō', translation: 'Tokyo' },
  '駅': { romanization: 'eki', translation: 'station' },
  '居酒屋': { romanization: 'i-za-ka-ya', translation: 'izakaya (Japanese pub)' },
  'コンビニ': { romanization: 'kon-bi-ni', translation: 'convenience store' },
  '茶屋': { romanization: 'cha-ya', translation: 'tea house' },
  'ラーメン屋': { romanization: 'rā-men-ya', translation: 'ramen shop' },
  'ラーメン': { romanization: 'rā-men', translation: 'ramen' },

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
  '小': { romanization: 'xiǎo', translation: 'small' },
  '笼': { romanization: 'lóng', translation: 'steamer basket' },
  '包': { romanization: 'bāo', translation: 'wrapped bun / bun' },
  '店': { romanization: 'diàn', translation: 'shop' },
  '地铁': { romanization: 'dì-tiě', translation: 'subway / metro' },
  '烧烤': { romanization: 'shāo-kǎo', translation: 'BBQ / grill' },
  '方案': { romanization: 'fāng-àn', translation: 'proposal / plan' },
  '看过了': { romanization: 'kàn guò le', translation: 'have looked it over already' },
  '吃过了': { romanization: 'chī guò le', translation: 'already ate' },
  '听过了': { romanization: 'tīng guò le', translation: 'already heard it' },
  '想法': { romanization: 'xiǎng-fǎ', translation: 'thoughts / take' },
  '节目': { romanization: 'jié-mù', translation: 'show / program' },
  '每个': { romanization: 'měi ge', translation: 'every' },
  '自己': { romanization: 'zì jǐ', translation: 'self' },
  '不一样': { romanization: 'bù yí yàng', translation: 'different' },
  '一样': { romanization: 'yí yàng', translation: 'same' },
  '不装': { romanization: 'bù zhuāng', translation: 'does not put on an act' },
  '装不下去': { romanization: 'zhuāng bu xià qù', translation: 'cannot keep pretending' },
  '演不下去': { romanization: 'yǎn bu xià qù', translation: 'cannot keep performing' },
  '说不下去': { romanization: 'shuō bu xià qù', translation: 'cannot keep saying it' },
  '吃不下去': { romanization: 'chī bu xià qù', translation: 'cannot keep eating' },
  '不会': { romanization: 'bù huì', translation: 'cannot' },
  '不愿意': { romanization: 'bù yuàn yì', translation: 'will not / is unwilling' },
  '说假话': { romanization: 'shuō jiǎ huà', translation: 'tell lies' },
  '不会说假话': { romanization: 'bù huì shuō jiǎ huà', translation: 'cannot lie' },
  '不愿意说假话': { romanization: 'bù yuàn yì shuō jiǎ huà', translation: 'will not lie' },
  '你接吧': { romanization: 'nǐ jiē ba', translation: 'answer it' },
  '不重要': { romanization: 'bù zhòng yào', translation: 'not important' },
  '我知道了': { romanization: 'wǒ zhī dào le', translation: 'I know / got it' },
  '小瞿': { romanization: 'xiǎo Qú', translation: 'Little Qu; familiar address' },
  '瞿先生': { romanization: 'Qú xiān sheng', translation: 'Mr. Qu' },
  '瞿家': { romanization: 'Qú jiā', translation: 'the Qu family' },
  '小儿子': { romanization: 'xiǎo ér zi', translation: 'younger son' },
  '犟': { romanization: 'jiàng', translation: 'stubborn in a hard, proud way' },
  '本事': { romanization: 'běn shi', translation: 'real ability' },
  '证明': { romanization: 'zhèng míng', translation: 'prove' },
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

const KOREAN_HANJA_MAP: Record<string, KoreanHanjaReading> = {
  '一': { hangul: '일', romanization: 'il' },
  '二': { hangul: '이', romanization: 'i' },
  '三': { hangul: '삼', romanization: 'sam' },
  '中': { hangul: '중', romanization: 'jung' },
  '先': { hangul: '선', romanization: 'seon' },
  '前': { hangul: '전', romanization: 'jeon' },
  '國': { hangul: '국', romanization: 'guk' },
  '地': { hangul: '지', romanization: 'ji' },
  '堂': { hangul: '당', romanization: 'dang' },
  '字': { hangul: '자', romanization: 'ja' },
  '學': { hangul: '학', romanization: 'hak' },
  '店': { hangul: '점', romanization: 'jeom' },
  '後': { hangul: '후', romanization: 'hu' },
  '文': { hangul: '문', romanization: 'mun' },
  '日': { hangul: '일', romanization: 'il' },
  '時': { hangul: '시', romanization: 'si' },
  '月': { hangul: '월', romanization: 'wol' },
  '東': { hangul: '동', romanization: 'dong' },
  '漢': { hangul: '한', romanization: 'han' },
  '火': { hangul: '화', romanization: 'hwa' },
  '生': { hangul: '생', romanization: 'saeng' },
  '西': { hangul: '서', romanization: 'seo' },
  '語': { hangul: '어', romanization: 'eo' },
  '道': { hangul: '도', romanization: 'do' },
  '食': { hangul: '식', romanization: 'sik' },
  '韓': { hangul: '한', romanization: 'han' },
};

/* ── Kana → romaji map ────────────────────────────────────── */

const KANA_ROMAJI: Record<string, string> = {};
for (const k of HIRAGANA) KANA_ROMAJI[k.kana] = k.romaji;
for (const k of KATAKANA) KANA_ROMAJI[k.kana] = k.romaji;
// Long vowel mark (katakana)
KANA_ROMAJI['ー'] = '-';
// Small kana
KANA_ROMAJI['っ'] = '(pause)';
KANA_ROMAJI['ッ'] = '(pause)';

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
      // Korean: Hangul syllables + Jamo + Hanja/CJK ideographs.
      return isHangulSyllable(code) || isHangulJamo(code) || isCJKIdeograph(code);
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

function segmentChineseRun(run: string): { text: string; isTarget: boolean }[] {
  const segments: { text: string; isTarget: boolean }[] = [];
  let index = 0;
  while (index < run.length) {
    let matched = '';
    const maxLen = Math.min(6, run.length - index);
    for (let len = maxLen; len > 1; len -= 1) {
      const candidate = run.slice(index, index + len);
      if (DICTIONARY[candidate]) {
        matched = candidate;
        break;
      }
    }
    if (matched) {
      segments.push({ text: matched, isTarget: true });
      index += matched.length;
    } else {
      segments.push({ text: run[index], isTarget: true });
      index += 1;
    }
  }
  return segments;
}

function segmentText(text: string, targetLang: TargetLang): { text: string; isTarget: boolean }[] {
  if (!text) return [];
  const segments: { text: string; isTarget: boolean }[] = [];

  if (targetLang === 'zh') {
    let index = 0;
    while (index < text.length) {
      const char = text[index];
      if (isTargetChar(char, targetLang)) {
        let end = index + 1;
        while (end < text.length && isTargetChar(text[end], targetLang)) end += 1;
        segments.push(...segmentChineseRun(text.slice(index, end)));
        index = end;
        continue;
      }

      let end = index + 1;
      while (end < text.length && !isTargetChar(text[end], targetLang)) end += 1;
      segments.push({ text: text.slice(index, end), isTarget: false });
      index = end;
    }
    return segments;
  }

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

function normalizeKoreanSpeechText(text: string): string {
  return [...text].map((char) => KOREAN_HANJA_MAP[char]?.hangul ?? char).join('');
}

function pickStableVoice(targetLang: TargetLang): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const prefixes = {
    ko: ['ko-KR', 'ko'],
    ja: ['ja-JP', 'ja'],
    zh: ['zh-CN', 'zh-TW', 'zh'],
  }[targetLang];

  const sorted = [...voices].sort((a, b) => `${a.lang}-${a.name}`.localeCompare(`${b.lang}-${b.name}`));
  for (const prefix of prefixes) {
    const match = sorted.find((voice) => voice.lang.toLowerCase().startsWith(prefix.toLowerCase()));
    if (match) return match;
  }
  return sorted[0] ?? null;
}

function playTargetAudio(text: string, targetLang: TargetLang): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const speechText = targetLang === 'ko' ? normalizeKoreanSpeechText(text) : text;
  const utter = new SpeechSynthesisUtterance(speechText);
  const fallbackLang = {
    ko: 'ko-KR',
    ja: 'ja-JP',
    zh: 'zh-CN',
  }[targetLang];
  utter.lang = fallbackLang;
  const voice = pickStableVoice(targetLang);
  if (voice) {
    utter.voice = voice;
    utter.lang = voice.lang;
  }
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
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

function romanizeKoreanToken(word: string): string | null {
  const parts: string[] = [];

  for (const char of [...word]) {
    if (JAMO_DICT[char]) {
      parts.push(JAMO_DICT[char].romanization);
      continue;
    }

    const syllableRomanization = romanizeSyllable(char);
    if (syllableRomanization) {
      parts.push(syllableRomanization);
      continue;
    }

    const hanjaReading = KOREAN_HANJA_MAP[char];
    if (hanjaReading) {
      parts.push(hanjaReading.romanization);
      continue;
    }

    return null;
  }

  return parts.length > 0 ? parts.join('-') : null;
}

function lookupWord(word: string): DictionaryEntry | null {
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

  if (targetLang === 'ja') {
    // Japanese: kana → romaji, kanji → pinyin map fallback (many kanji share readings)
    const parts = chars.map((ch) => {
      if (KANA_ROMAJI[ch]) return KANA_ROMAJI[ch];
      if (PINYIN_MAP[ch]) return PINYIN_MAP[ch]; // kanji often share Chinese readings as hint
      return ch;
    });
    const romanized = parts.join('');
    if (parts.some((p, i) => p !== chars[i])) {
      return { romanization: romanized, translation: resolveTranslation(word) };
    }
    return null;
  }

  // Korean: use syllable decomposition
  const romanized = romanizeKoreanToken(word);
  if (romanized && romanized !== word) {
    return { romanization: romanized, translation: resolveTranslation(word) };
  }
  return null;
}

/* ── Component ─────────────────────────────────────────────── */

interface KoreanTextProps {
  text: string;
  targetLang?: TargetLang;
  interactive?: boolean;
  /** Called when a word is tapped (in addition to showing tooltip). */
  onWordTap?: () => void;
}

export function KoreanText({ text, targetLang = 'ko', interactive = true, onWordTap }: KoreanTextProps) {
  const explainLang = useUILang();
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<{ x: number; y: number; bottom: number } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number; placement: 'above' | 'below' } | null>(null);
  const [tooltipInfo, setTooltipInfo] = useState<{ romanization: string; translation?: string } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const tooltipRef = useRef<HTMLDivElement>(null);
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
    if (!interactive) return;
    const info = getTooltipInfo(word.trim(), targetLang, explainLang);
    if (!info) return;
    const rect = target.getBoundingClientRect();
    setTooltipPos(null);
    setActiveWord(word);
    setTooltipInfo(info);
    setTooltipAnchor({ x: rect.left + rect.width / 2, y: rect.top, bottom: rect.bottom });
  }, [interactive, targetLang, explainLang]);

  const hideTooltip = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setActiveWord(null);
      setTooltipPos(null);
      setTooltipAnchor(null);
    }, 150);
  }, []);

  const handleMouseEnter = useCallback((word: string, e: React.MouseEvent) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    showTooltip(word, e.currentTarget as HTMLElement);
  }, [showTooltip]);

  const handleTap = useCallback((word: string, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Don't bubble to parent (e.g. dismiss Tong whisper)
    if (activeWord === word) { setActiveWord(null); return; }
    showTooltip(word, e.currentTarget as HTMLElement);
    playTargetAudio(word, targetLang);
    onWordTap?.();
  }, [activeWord, showTooltip, onWordTap, targetLang]);

  useLayoutEffect(() => {
    if (!mounted || !activeWord || !tooltipInfo || !tooltipAnchor) return;
    const tooltip = tooltipRef.current;
    if (!tooltip) return;

    const frame = document.querySelector('.game-frame');
    const frameRect = frame instanceof HTMLElement
      ? frame.getBoundingClientRect()
      : { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight };
    const margin = 8;
    const rect = tooltip.getBoundingClientRect();
    const availableLeft = Math.max(frameRect.left, 0) + margin;
    const availableRight = Math.min(frameRect.right, window.innerWidth) - margin;
    const availableTop = Math.max(frameRect.top, 0) + margin;
    const availableBottom = Math.min(frameRect.bottom, window.innerHeight) - margin;
    const availableWidth = Math.max(80, availableRight - availableLeft);
    const width = Math.min(rect.width || 160, availableWidth, 260);
    const height = rect.height || 76;
    const centeredLeft = tooltipAnchor.x - width / 2;
    const left = clamp(centeredLeft, availableLeft, Math.max(availableLeft, availableRight - width));
    const aboveTop = tooltipAnchor.y - height - margin;
    const belowTop = tooltipAnchor.bottom + margin;
    const placement = aboveTop >= availableTop ? 'above' : 'below';
    const rawTop = placement === 'above' ? aboveTop : belowTop;
    const top = clamp(rawTop, availableTop, Math.max(availableTop, availableBottom - height));
    setTooltipPos({ left, top, placement });
  }, [activeWord, mounted, tooltipAnchor, tooltipInfo]);

  const tooltipVisible = activeWord && tooltipInfo && tooltipAnchor;

  return (
    <>
      <span className="relative inline">
        {segments.map((seg, i) => {
          if (!seg.isTarget) {
            return <span key={i}>{seg.text}</span>;
          }
          if (!interactive) {
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
            ref={tooltipRef}
            className="korean-tooltip fade-in pointer-events-auto"
            onMouseEnter={() => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); }}
            onMouseLeave={hideTooltip}
            style={{
              position: 'fixed',
              left: `${tooltipPos?.left ?? tooltipAnchor.x}px`,
              top: `${tooltipPos?.top ?? tooltipAnchor.bottom + 8}px`,
              transform: 'none',
              zIndex: 99999,
              maxWidth: 'min(260px, calc(100vw - 16px))',
              maxHeight: 'calc(100vh - 16px)',
              overflowY: 'auto',
              opacity: tooltipPos ? 1 : 0,
            }}
          >
            {/* Arrow on top when flipped below */}
            {(tooltipPos?.placement ?? 'below') === 'below' && (
              <div className="flex justify-center">
                <div className="w-2 h-2 rotate-45 bg-[#16213e] border-l border-t border-[var(--color-accent-gold)]/40 -mb-1" style={{ zIndex: 1 }} />
              </div>
            )}
            <div className="rounded-lg bg-[#16213e] border border-[var(--color-accent-gold)]/40 px-3 py-2 shadow-lg text-left min-w-[140px]">
              <p className="font-medium text-[length:var(--game-text-base)] text-[var(--color-accent-gold)] m-0">{activeWord}</p>
              {tooltipInfo.romanization && (
                <p className="text-[length:var(--game-text-sm)] text-[var(--color-text-muted)] m-0">{tooltipInfo.romanization}</p>
              )}
              {tooltipInfo.translation && (
                <p className="text-[length:var(--game-text-sm)] text-[var(--color-text)] mt-0.5 m-0">{tooltipInfo.translation}</p>
              )}
            </div>
            {/* Arrow on bottom when above (default) */}
            {(tooltipPos?.placement ?? 'below') === 'above' && (
              <div className="flex justify-center">
                <div className="w-2 h-2 rotate-45 bg-[#16213e] border-r border-b border-[var(--color-accent-gold)]/40 -mt-1" />
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
