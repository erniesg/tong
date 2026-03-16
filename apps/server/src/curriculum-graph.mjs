const GRAPH_NOW_MS = Date.parse('2026-03-08T09:00:00.000Z');

const SHARED_LOCATIONS = [
  { locationId: 'food_street', label: 'Food Street' },
  { locationId: 'cafe', label: 'Cafe' },
  { locationId: 'convenience_store', label: 'Convenience Store' },
  { locationId: 'subway_hub', label: 'Subway Hub' },
  { locationId: 'practice_studio', label: 'Practice Studio' },
];

const SEOUL_FOOD_STREET_LEVELS = [
  {
    level: 0,
    name: 'SCRIPT',
    description: 'Can I recognise the symbols?',
    estimatedSessionMinutes: 15,
    assessmentCriteria: {
      minAccuracy: 0.8,
      minItemsCompleted: 20,
      requiredObjectives: ['ko-script-consonants-basic', 'ko-script-vowels-basic'],
    },
    objectives: [
      {
        id: 'ko-script-consonants-basic',
        category: 'script',
        title: 'Learn 14 basic consonants',
        description: 'Recognize and name the 14 basic Korean consonants.',
        targetItems: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'],
        targetCount: 14,
        assessmentThreshold: 0.8,
        prerequisites: [],
        tags: ['hangul', 'consonants', 'jamo', 'script'],
      },
      {
        id: 'ko-script-vowels-basic',
        category: 'script',
        title: 'Learn 10 basic vowels',
        description: 'Recognize and name the 10 basic Korean vowels.',
        targetItems: ['ㅏ', 'ㅑ', 'ㅓ', 'ㅕ', 'ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ', 'ㅣ'],
        targetCount: 10,
        assessmentThreshold: 0.8,
        prerequisites: [],
        tags: ['hangul', 'vowels', 'jamo', 'script'],
      },
      {
        id: 'ko-script-blocks-2part',
        category: 'script',
        title: 'Read 2-part syllable blocks',
        description: 'Combine consonant and vowel into basic blocks like 가, 나, 다.',
        targetItems: ['가', '나', '다', '라', '마', '바', '사', '아', '자', '카', '타', '파', '하'],
        targetCount: 13,
        assessmentThreshold: 0.7,
        prerequisites: ['ko-script-consonants-basic', 'ko-script-vowels-basic'],
        tags: ['hangul', 'syllable-blocks', 'script'],
      },
      {
        id: 'ko-script-menu-reading',
        category: 'script',
        title: 'Read menu items',
        description: 'Read staple food names from the stall menu.',
        targetItems: ['오뎅', '떡볶이', '라면', '순대'],
        targetCount: 4,
        assessmentThreshold: 0.75,
        prerequisites: ['ko-script-blocks-2part'],
        tags: ['hangul', 'reading', 'food', 'menu'],
      },
    ],
  },
  {
    level: 1,
    name: 'PRONUNCIATION',
    description: 'Can I say them correctly?',
    estimatedSessionMinutes: 18,
    assessmentCriteria: {
      minAccuracy: 0.75,
      minItemsCompleted: 15,
      requiredObjectives: ['ko-pron-jamo-all'],
    },
    objectives: [
      {
        id: 'ko-pron-jamo-all',
        category: 'pronunciation',
        title: 'Pronounce all jamo correctly',
        description: 'Accurate pronunciation of all core consonants and vowels.',
        targetItems: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ', 'ㅏ', 'ㅑ', 'ㅓ', 'ㅕ', 'ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ', 'ㅣ'],
        targetCount: 24,
        assessmentThreshold: 0.8,
        prerequisites: ['ko-script-consonants-basic', 'ko-script-vowels-basic'],
        tags: ['pronunciation', 'jamo', 'audio'],
      },
      {
        id: 'ko-pron-batchim',
        category: 'pronunciation',
        title: 'Learn 받침 rules',
        description: 'Understand and apply final consonant pronunciation rules.',
        targetItems: ['ㄱ받침', 'ㄴ받침', 'ㄹ받침', 'ㅁ받침', 'ㅂ받침', 'ㅇ받침', 'ㄷ받침'],
        targetCount: 7,
        assessmentThreshold: 0.7,
        prerequisites: ['ko-pron-jamo-all'],
        tags: ['pronunciation', 'batchim', 'final-consonant'],
      },
      {
        id: 'ko-pron-food-words',
        category: 'pronunciation',
        title: 'Pronounce 20 food words',
        description: 'Correctly pronounce common Korean street-food words.',
        targetItems: ['떡볶이', '라면', '오뎅', '순대', '김밥', '어묵', '만두', '튀김', '꼬치', '호떡', '붕어빵', '떡꼬치', '소떡소떡', '핫도그', '군고구마', '비빔밥', '볶음밥', '잡채', '김치', '콜라'],
        targetCount: 20,
        assessmentThreshold: 0.75,
        prerequisites: ['ko-script-menu-reading'],
        tags: ['pronunciation', 'food', 'words'],
      },
    ],
  },
  {
    level: 2,
    name: 'VOCABULARY',
    description: 'Do I know what they mean?',
    estimatedSessionMinutes: 20,
    assessmentCriteria: {
      minAccuracy: 0.8,
      minItemsCompleted: 30,
      requiredObjectives: ['ko-vocab-food-items', 'ko-vocab-courtesy'],
    },
    objectives: [
      {
        id: 'ko-vocab-food-items',
        category: 'vocabulary',
        title: 'Learn 20 food items',
        description: 'Know the meaning and reading of 20 street-food items.',
        targetItems: ['떡볶이', '라면', '오뎅', '순대', '김밥', '어묵', '만두', '튀김', '꼬치', '호떡', '붕어빵', '비빔밥', '볶음밥', '김치', '콜라', '물', '주스', '소주', '맥주', '사이다'],
        targetCount: 20,
        assessmentThreshold: 0.8,
        prerequisites: ['ko-pron-food-words'],
        tags: ['vocabulary', 'food', 'nouns'],
      },
      {
        id: 'ko-vocab-taste-words',
        category: 'vocabulary',
        title: 'Learn taste and texture words',
        description: 'Describe flavors like spicy, sweet, and salty.',
        targetItems: ['맵다', '달다', '짜다', '맛있다', '맛없다', '시다', '쓰다', '뜨겁다', '차갑다', '맵지 않다'],
        targetCount: 10,
        assessmentThreshold: 0.8,
        prerequisites: ['ko-vocab-food-items'],
        tags: ['vocabulary', 'taste', 'adjectives'],
      },
      {
        id: 'ko-vocab-numbers',
        category: 'vocabulary',
        title: 'Learn numbers for ordering',
        description: 'Count 1-5 with native Korean numbers for ordering.',
        targetItems: ['하나', '둘', '셋', '넷', '다섯'],
        targetCount: 5,
        assessmentThreshold: 0.9,
        prerequisites: ['ko-vocab-food-items'],
        tags: ['vocabulary', 'numbers', 'ordering'],
      },
      {
        id: 'ko-vocab-basic-verbs',
        category: 'vocabulary',
        title: 'Learn basic food verbs',
        description: 'Key verbs for ordering, buying, and drinking.',
        targetItems: ['먹다', '주다', '마시다', '사다', '시키다'],
        targetCount: 5,
        assessmentThreshold: 0.8,
        prerequisites: ['ko-vocab-food-items'],
        tags: ['vocabulary', 'verbs', 'action'],
      },
      {
        id: 'ko-vocab-courtesy',
        category: 'vocabulary',
        title: 'Learn courtesy phrases',
        description: 'Essential polite phrases for ordering.',
        targetItems: ['주세요', '감사합니다', '잠시만요', '여기요', '얼마예요'],
        targetCount: 5,
        assessmentThreshold: 0.9,
        prerequisites: ['ko-vocab-food-items'],
        tags: ['vocabulary', 'courtesy', 'phrases', 'polite'],
      },
    ],
  },
  {
    level: 3,
    name: 'GRAMMAR',
    description: 'Can I build sentences?',
    estimatedSessionMinutes: 20,
    assessmentCriteria: {
      minAccuracy: 0.8,
      minItemsCompleted: 10,
      requiredObjectives: ['ko-gram-juseyo'],
    },
    objectives: [
      {
        id: 'ko-gram-juseyo',
        category: 'grammar',
        title: 'Master N + 주세요',
        description: 'Use noun + 주세요 to order food politely.',
        targetItems: ['N+주세요'],
        targetCount: 1,
        assessmentThreshold: 0.85,
        prerequisites: ['ko-vocab-courtesy', 'ko-vocab-food-items'],
        tags: ['grammar', 'ordering', 'polite', 'juseyo'],
      },
      {
        id: 'ko-gram-object-particle',
        category: 'grammar',
        title: 'Learn 을/를 object particle',
        description: 'Use the object marker correctly with food nouns.',
        targetItems: ['을/를'],
        targetCount: 1,
        assessmentThreshold: 0.8,
        prerequisites: ['ko-gram-juseyo'],
        tags: ['grammar', 'particles', 'object-marker'],
      },
      {
        id: 'ko-gram-counters',
        category: 'grammar',
        title: 'Use number + counter patterns',
        description: 'Order using 하나, 둘 and 개 counters.',
        targetItems: ['N+개', '하나/둘/셋+개'],
        targetCount: 2,
        assessmentThreshold: 0.8,
        prerequisites: ['ko-vocab-numbers', 'ko-gram-juseyo'],
        tags: ['grammar', 'counters', 'numbers', 'ordering'],
      },
    ],
  },
];

const SEOUL_FOOD_STREET_VOCAB = [
  { word: '오뎅', romanization: 'odeng', translation: 'fish cake', category: 'food_item', level: 0, sceneContext: 'written on the menu board in big letters', visualCue: 'bubbling pot of fish cake skewers on the counter' },
  { word: '떡볶이', romanization: 'tteokbokki', translation: 'spicy rice cakes', category: 'food_item', level: 0, sceneContext: 'top item on the handwritten menu', visualCue: 'bright red sauce with cylindrical rice cakes in a flat pan' },
  { word: '라면', romanization: 'ramyeon', translation: 'instant noodles', category: 'food_item', level: 0, sceneContext: 'written on the menu board', visualCue: 'stack of instant noodle packets behind the counter' },
  { word: '순대', romanization: 'sundae', translation: 'blood sausage', category: 'food_item', level: 0, sceneContext: 'on the menu board next to 떡볶이', visualCue: 'dark sausage slices on a plate with salt' },
  { word: '김밥', romanization: 'gimbap', translation: 'seaweed rice roll', category: 'food_item', level: 2, sceneContext: 'sliced rolls displayed in the glass case at the front', visualCue: 'colorful rice rolls ready to grab' },
  { word: '어묵', romanization: 'eomuk', translation: 'fish cake (formal)', category: 'food_item', level: 2, sceneContext: 'the ajusshi uses this word instead of 오뎅 sometimes', visualCue: 'flat sheets of fish cake folded on skewers' },
  { word: '만두', romanization: 'mandu', translation: 'dumplings', category: 'food_item', level: 2, sceneContext: 'steaming in a bamboo basket on the side', visualCue: 'steam rising from stacked dumplings' },
  { word: '튀김', romanization: 'twigim', translation: 'deep-fried snacks', category: 'food_item', level: 2, sceneContext: 'frying in oil', visualCue: 'golden fried snacks draining on paper' },
  { word: '꼬치', romanization: 'kkochi', translation: 'skewers', category: 'food_item', level: 2, sceneContext: 'a rack of skewers on the counter', visualCue: 'wooden skewers lined up in a row' },
  { word: '호떡', romanization: 'hotteok', translation: 'sweet pancake', category: 'food_item', level: 2, sceneContext: 'pressed flat on the griddle', visualCue: 'golden pancake with syrupy filling' },
  { word: '붕어빵', romanization: 'bungeoppang', translation: 'fish-shaped bread', category: 'food_item', level: 2, sceneContext: 'a neighboring cart sells these', visualCue: 'fish-shaped waffle mold and bread' },
  { word: '떡꼬치', romanization: 'tteok-kkochi', translation: 'rice-cake skewers', category: 'food_item', level: 2, sceneContext: 'a sweeter skewer option near the fryer', visualCue: 'glazed rice cakes on skewers' },
  { word: '소떡소떡', romanization: 'sotteok-sotteok', translation: 'sausage and rice-cake skewer', category: 'food_item', level: 2, sceneContext: 'popular with trainees after practice', visualCue: 'alternating sausage and rice-cake pieces' },
  { word: '핫도그', romanization: 'hatdogeu', translation: 'corn dog', category: 'food_item', level: 2, sceneContext: 'sold next to the sauce station', visualCue: 'sugary corn dog with ketchup stripes' },
  { word: '군고구마', romanization: 'gungoguma', translation: 'roasted sweet potato', category: 'food_item', level: 2, sceneContext: 'warming in foil beside the tent entrance', visualCue: 'split roasted sweet potato with steam' },
  { word: '비빔밥', romanization: 'bibimbap', translation: 'mixed rice', category: 'food_item', level: 2, sceneContext: 'you hear someone ask if the stall can make this', visualCue: 'bowl of rice with colorful toppings' },
  { word: '볶음밥', romanization: 'bokkeumbap', translation: 'fried rice', category: 'food_item', level: 2, sceneContext: 'made with leftover 떡볶이 sauce at the end', visualCue: 'rice sizzling on the hot plate' },
  { word: '잡채', romanization: 'japchae', translation: 'glass noodles', category: 'food_item', level: 2, sceneContext: 'a side tray near the register', visualCue: 'glossy glass noodles with vegetables' },
  { word: '김치', romanization: 'gimchi', translation: 'kimchi', category: 'food_item', level: 2, sceneContext: 'set out as a free side dish', visualCue: 'bright kimchi in a small stainless dish' },
  { word: '콜라', romanization: 'kolla', translation: 'cola', category: 'drink', level: 2, sceneContext: 'in the mini fridge under the counter', visualCue: 'cold cola bottles in a fridge' },
  { word: '물', romanization: 'mul', translation: 'water', category: 'drink', level: 2, sceneContext: 'you ask for this when the food is spicy', visualCue: 'paper cup of water on the counter' },
  { word: '주스', romanization: 'juseu', translation: 'juice', category: 'drink', level: 2, sceneContext: 'lined up beside the sodas', visualCue: 'small juice cartons by the register' },
  { word: '소주', romanization: 'soju', translation: 'soju', category: 'drink', level: 2, sceneContext: 'friends mention this after rehearsal', visualCue: 'green glass bottle catching neon light' },
  { word: '맥주', romanization: 'maekju', translation: 'beer', category: 'drink', level: 2, sceneContext: 'older trainees order this at the end of the night', visualCue: 'frosty beer glass beside a plate' },
  { word: '사이다', romanization: 'saida', translation: 'cider / sprite', category: 'drink', level: 2, sceneContext: 'a common choice when something is too spicy', visualCue: 'clear lemon-lime soda bottle' },
  { word: '맵다', romanization: 'maepda', translation: 'spicy', category: 'taste', level: 2, sceneContext: 'Tong asks about spice level', visualCue: 'red sauce steaming in the pan' },
  { word: '달다', romanization: 'dalda', translation: 'sweet', category: 'taste', level: 2, sceneContext: 'used to compare sauces and snacks', visualCue: 'syrup sheen on hotteok' },
  { word: '짜다', romanization: 'jjada', translation: 'salty', category: 'taste', level: 2, sceneContext: 'used when reacting to broth and sides', visualCue: 'salty dipping powder next to 순대' },
  { word: '맛있다', romanization: 'masitda', translation: 'delicious', category: 'taste', level: 2, sceneContext: 'what you say after the first bite', visualCue: 'smiling reaction after tasting food' },
  { word: '맛없다', romanization: 'maseopda', translation: 'not tasty', category: 'taste', level: 2, sceneContext: 'Tong warns when joking with stall owners', visualCue: 'hesitant face over a dish' },
  { word: '시다', romanization: 'sida', translation: 'sour', category: 'taste', level: 2, sceneContext: 'used when comparing drinks and sauces', visualCue: 'sharp expression after tasting' },
  { word: '쓰다', romanization: 'sseuda', translation: 'bitter', category: 'taste', level: 2, sceneContext: 'used when describing some drinks', visualCue: 'grimace after sipping' },
  { word: '뜨겁다', romanization: 'tteugeopda', translation: 'hot', category: 'taste', level: 2, sceneContext: 'Tong reminds you the soup is hot', visualCue: 'steam rising from a bowl' },
  { word: '차갑다', romanization: 'chagapda', translation: 'cold', category: 'taste', level: 2, sceneContext: 'used for fridge drinks', visualCue: 'cold condensation on a bottle' },
  { word: '맵지 않다', romanization: 'maepji anta', translation: 'not spicy', category: 'taste', level: 2, sceneContext: 'used when choosing mild options', visualCue: 'two sauces labeled spicy and mild' },
  { word: '하나', romanization: 'hana', translation: 'one', category: 'number', level: 2, sceneContext: 'counting skewers', visualCue: 'one skewer held up' },
  { word: '둘', romanization: 'dul', translation: 'two', category: 'number', level: 2, sceneContext: 'counting plates', visualCue: 'two trays on the counter' },
  { word: '셋', romanization: 'set', translation: 'three', category: 'number', level: 2, sceneContext: 'counting drinks', visualCue: 'three bottles grouped together' },
  { word: '넷', romanization: 'net', translation: 'four', category: 'number', level: 2, sceneContext: 'counting friends joining you', visualCue: 'four stools around a table' },
  { word: '다섯', romanization: 'daseot', translation: 'five', category: 'number', level: 2, sceneContext: 'counting takeout portions', visualCue: 'five wrapped portions' },
  { word: '먹다', romanization: 'meokda', translation: 'to eat', category: 'verb', level: 2, sceneContext: 'used when chatting about what to eat', visualCue: 'sharing food at the stall' },
  { word: '주다', romanization: 'juda', translation: 'to give', category: 'verb', level: 2, sceneContext: 'core to polite requests', visualCue: 'stall owner handing over a dish' },
  { word: '마시다', romanization: 'masida', translation: 'to drink', category: 'verb', level: 2, sceneContext: 'used for drinks and soup', visualCue: 'lifting a cup to drink' },
  { word: '사다', romanization: 'sada', translation: 'to buy', category: 'verb', level: 2, sceneContext: 'used when deciding what to pay for', visualCue: 'paying at the counter' },
  { word: '시키다', romanization: 'sikida', translation: 'to order', category: 'verb', level: 2, sceneContext: 'used in ordering decisions', visualCue: 'pointing at the menu to order' },
  { word: '주세요', romanization: 'juseyo', translation: 'please give me', category: 'courtesy', level: 2, sceneContext: 'the polite ordering staple', visualCue: 'Tong highlighting the phrase in the hint bubble' },
  { word: '감사합니다', romanization: 'gamsahamnida', translation: 'thank you', category: 'courtesy', level: 2, sceneContext: 'what you say when receiving your dish', visualCue: 'bowing slightly after payment' },
  { word: '잠시만요', romanization: 'jamsimanyo', translation: 'just a moment', category: 'courtesy', level: 2, sceneContext: 'used when you need more time to choose', visualCue: 'holding up a finger politely' },
  { word: '여기요', romanization: 'yeogiyo', translation: 'excuse me / over here', category: 'courtesy', level: 2, sceneContext: 'used to call the stall owner over', visualCue: 'waving lightly to get attention' },
  { word: '얼마예요', romanization: 'eolmayeyo', translation: 'how much is it?', category: 'courtesy', level: 2, sceneContext: 'used at checkout', visualCue: 'looking at the handwritten price board' },
];

const SEOUL_FOOD_STREET_GRAMMAR = [
  {
    id: 'ko-gram-juseyo',
    pattern: 'N+주세요',
    explanation: 'Add 주세요 after a noun to politely ask for something.',
    examples: [
      { target: '떡볶이 주세요', translation: 'Tteokbokki, please.' },
      { target: '물 주세요', translation: 'Water, please.' },
      { target: '라면 주세요', translation: 'Ramyeon, please.' },
    ],
    level: 3,
    locationId: 'food_street',
  },
  {
    id: 'ko-gram-object-particle',
    pattern: '을/를',
    explanation: 'Use 을 after consonant-ending nouns and 를 after vowel-ending nouns.',
    examples: [
      { target: '떡볶이를 먹다', translation: 'to eat tteokbokki' },
      { target: '라면을 먹다', translation: 'to eat ramyeon' },
      { target: '물을 마시다', translation: 'to drink water' },
    ],
    level: 3,
    locationId: 'food_street',
  },
  {
    id: 'ko-gram-counters',
    pattern: 'N+개',
    explanation: 'Use native Korean numbers with the counter 개 for general items.',
    examples: [
      { target: '떡볶이 두 개 주세요', translation: 'Two tteokbokki, please.' },
      { target: '만두 세 개 주세요', translation: 'Three dumplings, please.' },
    ],
    level: 3,
    locationId: 'food_street',
  },
  {
    id: 'ko-gram-counter-phrases',
    pattern: '하나/둘/셋+개',
    explanation: 'Common native Korean number phrases paired with the counter 개 for ordering.',
    examples: [
      { target: '한 개 주세요', translation: 'One, please.' },
      { target: '두 개 주세요', translation: 'Two, please.' },
      { target: '세 개 주세요', translation: 'Three, please.' },
    ],
    level: 3,
    locationId: 'food_street',
  },
];

const PERSONAS = [
  {
    personaId: 'kpop-video-prompter',
    userId: 'demo-user-1',
    displayName: 'K-pop Video Prompter',
    focusSummary: 'Beginner Korean and Japanese foundation with a Chinese video-prompting specialization and heavy K-pop exposure.',
    targetLanguages: ['ko', 'ja', 'zh'],
    proficiency: { ko: 'beginner', ja: 'beginner', zh: 'beginner' },
    goals: [
      { lang: 'zh', theme: 'video_prompting', objective: 'Learn Chinese camera, composition, and prompt-writing vocabulary.' },
      { lang: 'ko', theme: 'kpop', objective: 'Use K-pop-driven Korean terms as motivating side quests without skipping the core Seoul foundation.' },
      { lang: 'ja', theme: 'travel', objective: 'Build basic Japanese beginner confidence for future Tokyo routes.' },
    ],
    mediaPreferences: {
      youtube: ['aespa performance cams', 'IVE backstage edits', 'cinematic short-form editing tutorials'],
      spotify: ['aespa', 'IVE', 'NewJeans'],
    },
    topTerms: [
      { lemma: '무대', lang: 'ko', source: 'youtube', weight: 0.88 },
      { lemma: '안무', lang: 'ko', source: 'youtube', weight: 0.82 },
      { lemma: '컨셉', lang: 'ko', source: 'spotify', weight: 0.74 },
      { lemma: '镜头', lang: 'zh', source: 'youtube', weight: 0.78 },
      { lemma: '构图', lang: 'zh', source: 'youtube', weight: 0.73 },
    ],
    seedEvidence: [
      { nodeId: targetNodeId('ㄱ'), mode: 'learn', quality: 0.62 },
      { nodeId: targetNodeId('ㄴ'), mode: 'learn', quality: 0.67 },
      { nodeId: targetNodeId('ㅏ'), mode: 'learn', quality: 0.7 },
      { nodeId: targetNodeId('ㅓ'), mode: 'learn', quality: 0.58 },
      { nodeId: targetNodeId('떡볶이'), mode: 'learn', quality: 0.74 },
      { nodeId: targetNodeId('라면'), mode: 'learn', quality: 0.69 },
      { nodeId: targetNodeId('주세요'), mode: 'learn', quality: 0.79 },
      { nodeId: targetNodeId('N+주세요'), mode: 'learn', quality: 0.55 },
      { nodeId: targetNodeId('떡볶이'), mode: 'hangout', quality: 0.81 },
      { nodeId: targetNodeId('주세요'), mode: 'hangout', quality: 0.83 },
      { nodeId: targetNodeId('かきくけこ'), mode: 'learn', quality: 0.42, lang: 'ja', objectiveId: 'ja_stub_beginner' },
      { nodeId: overlayNodeId('zh', 'video_prompting', '镜头'), mode: 'media', quality: 0.72 },
      { nodeId: overlayNodeId('zh', 'video_prompting', '构图'), mode: 'media', quality: 0.68 },
    ],
  },
  {
    personaId: 'quiet-beginner',
    userId: 'demo-user-beginner',
    displayName: 'Quiet Beginner',
    focusSummary: 'Low-exposure learner who needs a clean foundation-first roadmap.',
    targetLanguages: ['ko', 'ja'],
    proficiency: { ko: 'beginner', ja: 'beginner', zh: 'none' },
    goals: [{ lang: 'ko', theme: 'foundation', objective: 'Build reading and menu-ordering confidence from zero.' }],
    mediaPreferences: {
      youtube: [],
      spotify: [],
    },
    topTerms: [],
    seedEvidence: [
      { nodeId: targetNodeId('ㄱ'), mode: 'learn', quality: 0.35 },
      { nodeId: targetNodeId('ㅏ'), mode: 'learn', quality: 0.4 },
    ],
  },
  {
    personaId: 'mixed-intermediate',
    userId: 'demo-user-mixed',
    displayName: 'Mixed Intermediate',
    focusSummary: 'Intermediate Korean learner with broad media exposure and a lighter Japanese side path.',
    targetLanguages: ['ko', 'ja', 'zh'],
    proficiency: { ko: 'intermediate', ja: 'beginner', zh: 'beginner' },
    goals: [
      { lang: 'ko', theme: 'food', objective: 'Convert learn-mode progress into strong Seoul hangout validation.' },
      { lang: 'ja', theme: 'daily', objective: 'Keep Japanese basics warm without overtaking Korean focus.' },
    ],
    mediaPreferences: {
      youtube: ['Korean food vlogs', 'dance practice clips'],
      spotify: ['AKMU', 'aespa'],
    },
    topTerms: [
      { lemma: '주문', lang: 'ko', source: 'youtube', weight: 0.92 },
      { lemma: '메뉴', lang: 'ko', source: 'youtube', weight: 0.85 },
      { lemma: '연습', lang: 'ko', source: 'spotify', weight: 0.79 },
    ],
    seedEvidence: [
      { nodeId: targetNodeId('떡볶이'), mode: 'learn', quality: 0.9 },
      { nodeId: targetNodeId('라면'), mode: 'learn', quality: 0.88 },
      { nodeId: targetNodeId('주세요'), mode: 'learn', quality: 0.91 },
      { nodeId: targetNodeId('N+주세요'), mode: 'hangout', quality: 0.87 },
      { nodeId: targetNodeId('을/를'), mode: 'learn', quality: 0.71 },
      { nodeId: targetNodeId('주문'), mode: 'media', quality: 0.83 },
    ],
  },
];

const runtimeEvidenceByPersona = new Map();

export const GRAPH_TOOL_DEFINITIONS = [
  {
    name: 'graph.dashboard.get',
    description: 'Fetch the mocked learner dashboard view for a persona, including roadmap, skill tree, overlay, and next actions.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      learnerId: 'string (optional) – stable public learner identifier; mock personas accept personaId as an alias',
      personaId: 'string (optional) – kpop-video-prompter|quiet-beginner|mixed-intermediate',
      userId: 'string (optional)',
      city: 'seoul|tokyo|shanghai (optional)',
      location: 'food_street|cafe|convenience_store|subway_hub|practice_studio (optional)',
    },
  },
  {
    name: 'graph.next_actions.get',
    description: 'Get the next recommended graph-driven actions for a persona.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      learnerId: 'string (optional)',
      personaId: 'string (optional)',
      userId: 'string (optional)',
      limit: 'number (optional, default 4)',
    },
  },
  {
    name: 'graph.lesson_bundle.get',
    description: 'Return the next lesson bundle derived from the graph evaluator.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      learnerId: 'string (optional)',
      personaId: 'string (optional)',
      userId: 'string (optional)',
      city: 'seoul|tokyo|shanghai (optional)',
      location: 'food_street|cafe|convenience_store|subway_hub|practice_studio (optional)',
    },
  },
  {
    name: 'graph.hangout_bundle.get',
    description: 'Return the next hangout validation bundle derived from the graph evaluator.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      learnerId: 'string (optional)',
      personaId: 'string (optional)',
      userId: 'string (optional)',
      city: 'seoul|tokyo|shanghai (optional)',
      location: 'food_street|cafe|convenience_store|subway_hub|practice_studio (optional)',
    },
  },
  {
    name: 'graph.evidence.record',
    description: 'Record mocked learner evidence events and return the updated dashboard metrics.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      learnerId: 'string (optional)',
      personaId: 'string (optional)',
      userId: 'string (optional)',
      event: 'object (optional) – single evidence event',
      events: 'array (optional) – evidence events [{ nodeId, mode, quality, occurredAtIso, source }]',
    },
  },
  {
    name: 'graph.pack.validate',
    description: 'Validate the canonical Seoul curriculum pack or a custom pack payload.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      pack: 'object (optional) – custom curriculum pack; defaults to the canonical Seoul pack',
    },
  },
  {
    name: 'graph.overlay.propose',
    description: 'Propose personalized overlay branches based on persona goals and mock media preferences.',
    method: 'POST',
    path: '/api/v1/tools/invoke',
    args: {
      learnerId: 'string (optional)',
      personaId: 'string (optional)',
      userId: 'string (optional)',
      lang: 'ko|ja|zh (optional)',
      theme: 'string (optional)',
      count: 'number (optional, default 4)',
    },
  },
];

function stableSlug(value) {
  const raw = String(value || '').trim().toLowerCase();
  const normalized = raw.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (normalized) return normalized;
  return [...raw].map((char) => char.codePointAt(0).toString(16)).join('-');
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function targetNodeId(target) {
  return `target:${stableSlug(target)}`;
}

function objectiveNodeId(objectiveId) {
  return `objective:${objectiveId}`;
}

function missionId(level) {
  return `mission:seoul-food-street:l${level}`;
}

function overlayNodeId(lang, theme, lemma) {
  return `overlay:${lang}:${stableSlug(theme)}:${stableSlug(lemma)}`;
}

function baseIso() {
  return new Date(GRAPH_NOW_MS).toISOString();
}

function isoDaysFrom(days, base = GRAPH_NOW_MS) {
  return new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function buildSeoulFoodStreetPack() {
  const vocabByWord = new Map(SEOUL_FOOD_STREET_VOCAB.map((item) => [item.word, item]));
  const grammarByPattern = new Map(SEOUL_FOOD_STREET_GRAMMAR.map((item) => [item.pattern, item]));
  const nodes = [];
  const nodeById = new Map();
  const edges = [];

  function ensureTargetNode(target, objectiveCategory) {
    const id = targetNodeId(target);
    if (nodeById.has(id)) return id;

    const vocab = vocabByWord.get(target);
    const grammar = grammarByPattern.get(target);
    let kind = 'skill';
    const metadata = {};

    if (vocab) {
      kind = 'vocab';
      Object.assign(metadata, vocab);
    } else if (grammar) {
      kind = target.includes('+') ? 'sentence_frame' : 'grammar_pattern';
      Object.assign(metadata, grammar);
    } else if (objectiveCategory === 'grammar') {
      kind = target.includes('+') ? 'sentence_frame' : 'grammar_pattern';
    } else if (objectiveCategory === 'script') {
      kind = 'script_item';
      metadata.translation = `Script item ${target}`;
    } else if (objectiveCategory === 'pronunciation') {
      kind = 'pronunciation_item';
      metadata.translation = `Pronunciation target ${target}`;
    }

    const node = {
      id,
      kind,
      label: target,
      lang: 'ko',
      version: '1.0.0',
      metadata,
    };
    nodeById.set(id, node);
    nodes.push(node);
    return id;
  }

  for (const level of SEOUL_FOOD_STREET_LEVELS) {
    for (const objective of level.objectives) {
      const objectiveId = objectiveNodeId(objective.id);
      const targetNodeIds = objective.targetItems.map((target) => ensureTargetNode(target, objective.category));
      const objectiveNode = {
        id: objectiveId,
        kind: 'objective',
        label: objective.title,
        lang: 'ko',
        version: '1.0.0',
        metadata: {
          ...objective,
          level: level.level,
          locationId: 'food_street',
          cityId: 'seoul',
          targetNodeIds,
        },
      };
      nodeById.set(objectiveId, objectiveNode);
      nodes.push(objectiveNode);
    }
  }

  for (const level of SEOUL_FOOD_STREET_LEVELS) {
    for (const objective of level.objectives) {
      for (const prereq of objective.prerequisites) {
        edges.push({
          id: `edge:${prereq}->${objective.id}`,
          type: 'requires',
          from: objectiveNodeId(prereq),
          to: objectiveNodeId(objective.id),
        });
      }
    }
  }

  edges.push({
    id: 'edge:food-items->juseyo-reinforce',
    type: 'reinforces',
    from: objectiveNodeId('ko-vocab-food-items'),
    to: objectiveNodeId('ko-gram-juseyo'),
  });
  edges.push({
    id: 'edge:courtesy->juseyo-reinforce',
    type: 'reinforces',
    from: objectiveNodeId('ko-vocab-courtesy'),
    to: objectiveNodeId('ko-gram-juseyo'),
  });

  return {
    packId: 'pack:seoul:food_street:v1',
    version: '1.0.0',
    cityId: 'seoul',
    locationId: 'food_street',
    lang: 'ko',
    title: 'Seoul Food Street Foundation Graph',
    generatedAtIso: baseIso(),
    contentContainers: {
      levels: SEOUL_FOOD_STREET_LEVELS.map((level) => ({
        level: level.level,
        name: level.name,
        description: level.description,
        estimatedSessionMinutes: level.estimatedSessionMinutes,
        objectiveIds: level.objectives.map((objective) => objective.id),
        assessmentCriteria: cloneJson(level.assessmentCriteria),
        mission: {
          missionId: missionId(level.level),
          title: `${level.name} Assessment`,
          requiredObjectiveIds: cloneJson(level.assessmentCriteria.requiredObjectives),
          reward: {
            xp: 18 + level.level * 8,
            sp: 6 + level.level * 2,
            rp: level.level === 0 ? 0 : 3 + level.level,
          },
        },
      })),
    },
    vocabularyTargets: cloneJson(SEOUL_FOOD_STREET_VOCAB),
    grammarTargets: cloneJson(SEOUL_FOOD_STREET_GRAMMAR),
    nodes: uniqueById(nodes),
    edges,
  };
}

const GOLD_PACK = buildSeoulFoodStreetPack();

function getPersona(personaId, userId) {
  if (personaId) {
    const byPersona = PERSONAS.find((item) => item.personaId === personaId);
    if (byPersona) return byPersona;
  }
  if (userId) {
    const byUser = PERSONAS.find((item) => item.userId === userId);
    if (byUser) return byUser;
  }
  return PERSONAS[0];
}

function getPersonaFromArgs(args = {}) {
  return getPersona(args.personaId || args.learnerId, args.userId);
}

function getRuntimeEvidence(persona) {
  if (!runtimeEvidenceByPersona.has(persona.personaId)) {
    runtimeEvidenceByPersona.set(persona.personaId, []);
  }
  return runtimeEvidenceByPersona.get(persona.personaId);
}

function materializeEvidence(persona) {
  const runtime = getRuntimeEvidence(persona);
  const seedEvents = persona.seedEvidence.map((event, index) => ({
    eventId: `seed:${persona.personaId}:${index + 1}`,
    personaId: persona.personaId,
    userId: persona.userId,
    source: event.mode === 'media' ? 'mock_media' : 'mock_curriculum',
    occurredAtIso: event.occurredAtIso || new Date(GRAPH_NOW_MS - (index + 1) * 4 * 60 * 60 * 1000).toISOString(),
    ...event,
  }));
  return [...seedEvents, ...runtime];
}

function normalizeEvidenceEvent(event, persona, indexBase = 0) {
  const nodeId = typeof event?.nodeId === 'string' ? event.nodeId : '';
  const mode =
    event?.mode === 'hangout' ||
    event?.mode === 'mission' ||
    event?.mode === 'media' ||
    event?.mode === 'review' ||
    event?.mode === 'exercise'
      ? event.mode
      : 'learn';
  return {
    eventId: typeof event?.eventId === 'string' ? event.eventId : `runtime:${persona.personaId}:${indexBase + 1}`,
    personaId: persona.personaId,
    userId: persona.userId,
    nodeId,
    objectiveId: typeof event?.objectiveId === 'string' ? event.objectiveId : null,
    mode,
    quality: clamp01(event?.quality),
    occurredAtIso:
      typeof event?.occurredAtIso === 'string'
        ? event.occurredAtIso
        : new Date(GRAPH_NOW_MS + indexBase * 15 * 60 * 1000).toISOString(),
    source: typeof event?.source === 'string' ? event.source : 'graph.evidence.record',
  };
}

function summarizeEvidence(events) {
  const summary = new Map();
  for (const event of events) {
    if (!event.nodeId) continue;
    const existing = summary.get(event.nodeId) || {
      totalQuality: 0,
      count: 0,
      lastEvidenceAt: null,
      modes: new Set(),
      hasHangout: false,
      hasMission: false,
      hasMedia: false,
    };
    existing.totalQuality += clamp01(event.quality);
    existing.count += 1;
    existing.lastEvidenceAt = !existing.lastEvidenceAt || event.occurredAtIso > existing.lastEvidenceAt
      ? event.occurredAtIso
      : existing.lastEvidenceAt;
    existing.modes.add(event.mode);
    existing.hasHangout = existing.hasHangout || event.mode === 'hangout';
    existing.hasMission = existing.hasMission || event.mode === 'mission';
    existing.hasMedia = existing.hasMedia || event.mode === 'media';
    summary.set(event.nodeId, existing);
  }
  return summary;
}

function buildObjectiveIndex(pack) {
  const objectives = [];
  const objectiveById = new Map();
  const nodeById = new Map(pack.nodes.map((node) => [node.id, node]));
  for (const node of pack.nodes) {
    if (node.kind !== 'objective') continue;
    const objective = {
      objectiveId: node.metadata.id,
      nodeId: node.id,
      level: node.metadata.level,
      category: node.metadata.category,
      title: node.label,
      description: node.metadata.description,
      targetNodeIds: node.metadata.targetNodeIds || [],
      prerequisites: node.metadata.prerequisites || [],
      assessmentThreshold: node.metadata.assessmentThreshold || 0.8,
      tags: node.metadata.tags || [],
    };
    objectives.push(objective);
    objectiveById.set(objective.objectiveId, objective);
  }

  const levelContainers = pack.contentContainers.levels.map((level) => ({
    ...level,
    objectiveNodes: level.objectiveIds
      .map((objectiveId) => objectiveById.get(objectiveId))
      .filter(Boolean)
      .map((objective) => ({
        ...objective,
        node: nodeById.get(objective.nodeId),
      })),
  }));

  return { objectives, objectiveById, nodeById, levelContainers };
}

function objectivePrerequisitesMet(objective, objectiveStateById) {
  return objective.prerequisites.every((prereqId) => {
    const state = objectiveStateById.get(prereqId);
    return state && (state.status === 'validated' || state.status === 'mastered');
  });
}

function deriveNodeState(node, summary, unlocked) {
  const record = summary.get(node.id);
  const nowIso = baseIso();
  if (!unlocked && !record) {
    return {
      nodeId: node.id,
      status: 'locked',
      mastery_score: 0,
      next_review_at: null,
      last_evidence_at: null,
      blockerCount: 1,
    };
  }
  if (!record) {
    return {
      nodeId: node.id,
      status: 'available',
      mastery_score: 0,
      next_review_at: nowIso,
      last_evidence_at: null,
      blockerCount: 0,
    };
  }

  const averageQuality = record.totalQuality / Math.max(record.count, 1);
  const hangoutBonus = record.hasHangout ? 0.14 : 0;
  const missionBonus = record.hasMission ? 0.18 : 0;
  const masteryScore = clamp01(averageQuality + hangoutBonus + missionBonus);
  let status = 'learning';
  if (masteryScore >= 0.86 && record.count >= 3) status = 'mastered';
  else if (masteryScore >= 0.72 && (record.hasHangout || record.count >= 3)) status = 'validated';
  else if (record.hasMedia && record.count === 1) status = 'available';
  else if (masteryScore < 0.4) status = 'learning';

  const lastEvidenceAt = record.lastEvidenceAt;
  const lastMs = lastEvidenceAt ? Date.parse(lastEvidenceAt) : GRAPH_NOW_MS;
  const intervalDays = status === 'mastered' ? 14 : status === 'validated' ? 6 : 2;
  const nextReviewAt = new Date(lastMs + intervalDays * 24 * 60 * 60 * 1000).toISOString();
  if (nextReviewAt <= nowIso && status !== 'locked') {
    status = 'due';
  }

  return {
    nodeId: node.id,
    status,
    mastery_score: Number(masteryScore.toFixed(2)),
    next_review_at: nextReviewAt,
    last_evidence_at: lastEvidenceAt,
    blockerCount: 0,
  };
}

function deriveEvaluation(pack, persona) {
  const evidence = materializeEvidence(persona);
  const summary = summarizeEvidence(evidence);
  const { objectives, objectiveById, nodeById, levelContainers } = buildObjectiveIndex(pack);
  const targetStates = new Map();
  const objectiveStateById = new Map();

  for (const objective of objectives.sort((a, b) => a.level - b.level)) {
    const prereqsMet = objectivePrerequisitesMet(objective, objectiveStateById);
    const targetNodeStates = objective.targetNodeIds.map((targetId) => {
      const targetNode = nodeById.get(targetId) || { id: targetId, kind: 'skill', label: targetId };
      const state = deriveNodeState(targetNode, summary, prereqsMet);
      targetStates.set(targetId, state);
      return state;
    });

    const validatedTargets = targetNodeStates.filter((state) => state.status === 'validated' || state.status === 'mastered').length;
    const dueTargets = targetNodeStates.filter((state) => state.status === 'due').length;
    const learningTargets = targetNodeStates.filter((state) => state.status === 'learning').length;
    const masteryAverage =
      targetNodeStates.reduce((sum, state) => sum + Number(state.mastery_score || 0), 0) /
      Math.max(targetNodeStates.length, 1);

    let status = prereqsMet ? 'available' : 'locked';
    if (validatedTargets / Math.max(targetNodeStates.length, 1) >= objective.assessmentThreshold && validatedTargets > 0) {
      status = masteryAverage >= 0.86 ? 'mastered' : 'validated';
    } else if (dueTargets > 0) {
      status = 'due';
    } else if (learningTargets > 0) {
      status = 'learning';
    }

    objectiveStateById.set(objective.objectiveId, {
      objectiveId: objective.objectiveId,
      nodeId: objective.nodeId,
      status,
      mastery_score: Number(masteryAverage.toFixed(2)),
      validatedTargetCount: validatedTargets,
      targetCount: targetNodeStates.length,
      prereqsMet,
      targetNodeStates,
      title: objective.title,
      description: objective.description,
      level: objective.level,
      category: objective.category,
      tags: objective.tags,
    });
  }

  const objectiveStates = [...objectiveStateById.values()];
  const validatedObjectiveCount = objectiveStates.filter((state) => state.status === 'validated' || state.status === 'mastered').length;
  const masteredObjectiveCount = objectiveStates.filter((state) => state.status === 'mastered').length;
  const dueNodeCount = [...targetStates.values()].filter((state) => state.status === 'due').length;
  const hangoutEvents = evidence.filter((event) => event.mode === 'hangout').length;
  const missionEvents = evidence.filter((event) => event.mode === 'mission').length;

  const progression = {
    xp: Math.round(
      [...targetStates.values()].reduce((sum, state) => sum + state.mastery_score * 10, 0) +
      validatedObjectiveCount * 8 +
      masteredObjectiveCount * 6,
    ),
    sp: validatedObjectiveCount * 2 + missionEvents * 6,
    rp: hangoutEvents * 4 + missionEvents * 3,
  };

  const levels = levelContainers.map((level) => {
    const objectivesForLevel = level.objectiveNodes.map((objective) => objectiveStateById.get(objective.objectiveId)).filter(Boolean);
    const validatedCount = objectivesForLevel.filter((state) => state.status === 'validated' || state.status === 'mastered').length;
    const missionStatus =
      level.mission.requiredObjectiveIds.every((objectiveId) => {
        const state = objectiveStateById.get(objectiveId);
        return state && (state.status === 'validated' || state.status === 'mastered');
      })
        ? 'ready'
        : validatedCount > 0
          ? 'tracking'
          : 'locked';

    return {
      level: level.level,
      name: level.name,
      description: level.description,
      estimatedSessionMinutes: level.estimatedSessionMinutes,
      mission: {
        ...level.mission,
        status: missionStatus,
      },
      objectives: objectivesForLevel.map((state) => ({
        objectiveId: state.objectiveId,
        title: state.title,
        description: state.description,
        status: state.status,
        mastery_score: state.mastery_score,
        validatedTargetCount: state.validatedTargetCount,
        targetCount: state.targetCount,
        blockers: state.prereqsMet ? [] : cloneJson(objectiveById.get(state.objectiveId)?.prerequisites || []),
        category: state.category,
      })),
    };
  });

  return {
    persona,
    evidence,
    progression,
    levels,
    objectiveStates,
    nodeStates: [...targetStates.values()],
    dueNodeCount,
    validatedObjectiveCount,
    masteredObjectiveCount,
  };
}

function buildOverlay(persona) {
  const focusCards = [];

  for (const goal of persona.goals) {
    if (goal.theme === 'video_prompting') {
      focusCards.push({
        overlayId: `overlay:${goal.lang}:video_prompting`,
        lang: goal.lang,
        theme: goal.theme,
        title: 'Chinese video prompting branch',
        description: 'Bridge nodes for camera angles, composition, and prompt phrasing.',
        nodes: [
          { nodeId: overlayNodeId('zh', 'video_prompting', '镜头'), label: '镜头', translation: 'camera shot', status: 'available' },
          { nodeId: overlayNodeId('zh', 'video_prompting', '构图'), label: '构图', translation: 'composition', status: 'available' },
          { nodeId: overlayNodeId('zh', 'video_prompting', '运镜'), label: '运镜', translation: 'camera movement', status: 'available' },
          { nodeId: overlayNodeId('zh', 'video_prompting', '提示词'), label: '提示词', translation: 'prompt phrase', status: 'available' },
        ],
        reason: goal.objective,
      });
    } else if (goal.theme === 'kpop') {
      focusCards.push({
        overlayId: `overlay:${goal.lang}:kpop`,
        lang: goal.lang,
        theme: goal.theme,
        title: 'K-pop motivation overlay',
        description: 'Korean side quests tied to performance, concepts, and practice-room language.',
        nodes: [
          { nodeId: overlayNodeId('ko', 'kpop', '무대'), label: '무대', translation: 'stage', status: 'available' },
          { nodeId: overlayNodeId('ko', 'kpop', '안무'), label: '안무', translation: 'choreography', status: 'available' },
          { nodeId: overlayNodeId('ko', 'kpop', '컨셉'), label: '컨셉', translation: 'concept', status: 'available' },
        ],
        reason: goal.objective,
      });
    } else if (goal.lang === 'ja') {
      focusCards.push({
        overlayId: `overlay:${goal.lang}:foundation`,
        lang: goal.lang,
        theme: goal.theme,
        title: 'Japanese warm-up branch',
        description: 'A light beginner track kept visible in the roadmap while Korean stays primary.',
        nodes: [
          { nodeId: overlayNodeId('ja', 'foundation', 'メニュー'), label: 'メニュー', translation: 'menu', status: 'locked' },
          { nodeId: overlayNodeId('ja', 'foundation', 'ください'), label: 'ください', translation: 'please give me', status: 'locked' },
        ],
        reason: goal.objective,
      });
    }
  }

  return {
    focusCards,
    summary: `Personalized overlay tracks ${focusCards.length} theme${focusCards.length === 1 ? '' : 's'}.`,
  };
}

function buildWorldRoadmap(persona, evaluation) {
  const cityFocus = new Map(persona.goals.map((goal) => [goal.lang, goal.theme]));
  const seoulLevelProgress = evaluation.levels.map((level) => ({
    level: level.level,
    label: level.name,
    status: level.objectives.every((objective) => objective.status === 'validated' || objective.status === 'mastered')
      ? 'validated'
      : level.objectives.some((objective) => objective.status !== 'locked')
        ? 'active'
        : 'locked',
  }));

  return [
    {
      cityId: 'seoul',
      label: 'Seoul',
      focus: cityFocus.get('ko') || 'foundation',
      proficiency: persona.proficiency.ko || 'beginner',
      locations: SHARED_LOCATIONS.map((location, index) => ({
        locationId: location.locationId,
        label: location.label,
        status: location.locationId === 'food_street'
          ? 'active'
          : index === 1
            ? 'preview'
            : 'locked',
        progress: location.locationId === 'food_street'
          ? `${evaluation.validatedObjectiveCount}/${evaluation.objectiveStates.length} objectives validated`
          : 'Planned for future authored packs',
      })),
      levels: seoulLevelProgress,
    },
    {
      cityId: 'tokyo',
      label: 'Tokyo',
      focus: cityFocus.get('ja') || 'foundation',
      proficiency: persona.proficiency.ja || 'beginner',
      locations: SHARED_LOCATIONS.map((location, index) => ({
        locationId: location.locationId,
        label: location.label,
        status: index === 0 ? 'preview' : 'locked',
        progress: index === 0 ? 'Beginner track scaffolded for future pack generation' : 'Locked',
      })),
      levels: [
        { level: 0, label: 'SCRIPT', status: 'available' },
        { level: 1, label: 'PRONUNCIATION', status: 'locked' },
      ],
    },
    {
      cityId: 'shanghai',
      label: 'Shanghai',
      focus: cityFocus.get('zh') || 'personalization',
      proficiency: persona.proficiency.zh || 'beginner',
      locations: SHARED_LOCATIONS.map((location, index) => ({
        locationId: location.locationId,
        label: location.label,
        status: location.locationId === 'practice_studio' ? 'preview' : index === 0 ? 'preview' : 'locked',
        progress: location.locationId === 'practice_studio'
          ? 'Personalized overlay ready for video prompting vocabulary'
          : 'Awaiting generated pack',
      })),
      levels: [
        { level: 0, label: 'FOUNDATION', status: 'available' },
        { level: 1, label: 'VIDEO PROMPTING OVERLAY', status: 'preview' },
      ],
    },
  ];
}

function getPrimaryNextObjective(evaluation) {
  return evaluation.objectiveStates.find((state) => state.status === 'available' || state.status === 'learning' || state.status === 'due') || evaluation.objectiveStates[0];
}

function buildNextActions(pack, persona, evaluation, overlay) {
  const actions = [];
  const nextObjective = getPrimaryNextObjective(evaluation);
  if (nextObjective) {
    actions.push({
      actionId: 'next-lesson',
      type: 'lesson',
      title: `Continue ${nextObjective.title}`,
      objectiveId: nextObjective.objectiveId,
      cityId: 'seoul',
      locationId: 'food_street',
      reason: nextObjective.status === 'due' ? 'Some target nodes are due for review.' : 'This is the next unlocked curriculum objective.',
      recommendedNodeIds: nextObjective.targetNodeStates.slice(0, 4).map((state) => state.nodeId),
    });
  }

  const hangoutObjective = evaluation.objectiveStates.find((state) => state.status === 'learning' && state.mastery_score >= 0.45) || nextObjective;
  if (hangoutObjective) {
    actions.push({
      actionId: 'next-hangout',
      type: 'hangout',
      title: `Validate ${hangoutObjective.title} in a hangout`,
      objectiveId: hangoutObjective.objectiveId,
      cityId: 'seoul',
      locationId: 'food_street',
      reason: 'This objective has enough foundation to test in-context.',
      recommendedNodeIds: hangoutObjective.targetNodeStates.slice(0, 3).map((state) => state.nodeId),
    });
  }

  for (const focus of overlay.focusCards.slice(0, 2)) {
    actions.push({
      actionId: `overlay:${focus.overlayId}`,
      type: 'overlay',
      title: focus.title,
      objectiveId: null,
      cityId: focus.lang === 'zh' ? 'shanghai' : focus.lang === 'ja' ? 'tokyo' : 'seoul',
      locationId: focus.lang === 'zh' ? 'practice_studio' : 'food_street',
      reason: focus.reason,
      recommendedNodeIds: focus.nodes.map((node) => node.nodeId),
    });
  }

  return actions;
}

function buildLessonBundle(pack, persona, evaluation) {
  const nextObjective = getPrimaryNextObjective(evaluation);
  if (!nextObjective) {
    return {
      bundleId: 'lesson:none',
      cityId: 'seoul',
      locationId: 'food_street',
      objectiveId: null,
      title: 'No lesson bundle available',
      targets: [],
      reason: 'All current objectives are validated.',
    };
  }

  return {
    bundleId: `lesson:${nextObjective.objectiveId}`,
    cityId: 'seoul',
    locationId: 'food_street',
    objectiveId: nextObjective.objectiveId,
    title: `${nextObjective.title} drill`,
    mode: 'learn',
    reason: nextObjective.status === 'due' ? 'Refresh due targets before the next hangout.' : 'This objective is the next unlocked lesson target.',
    targets: nextObjective.targetNodeStates.map((state) => ({
      nodeId: state.nodeId,
      label: pack.nodes.find((node) => node.id === state.nodeId)?.label || state.nodeId,
      status: state.status,
      mastery_score: state.mastery_score,
    })),
    explainIn: persona.proficiency.ko === 'beginner' ? 'en' : 'ko',
  };
}

function buildHangoutBundle(pack, evaluation) {
  const candidate = evaluation.objectiveStates.find((state) => state.status === 'learning' && state.mastery_score >= 0.45) || getPrimaryNextObjective(evaluation);
  if (!candidate) {
    return {
      bundleId: 'hangout:none',
      cityId: 'seoul',
      locationId: 'food_street',
      objectiveId: null,
      title: 'No hangout bundle available',
      mode: 'hangout',
      targets: [],
      reason: 'No objective is ready for contextual validation.',
    };
  }

  return {
    bundleId: `hangout:${candidate.objectiveId}`,
    cityId: 'seoul',
    locationId: 'food_street',
    objectiveId: candidate.objectiveId,
    title: `${candidate.title} validation`,
    mode: 'hangout',
    reason: 'This objective has enough readiness to validate in-scene.',
    targets: candidate.targetNodeStates.slice(0, 3).map((state) => ({
      nodeId: state.nodeId,
      label: pack.nodes.find((node) => node.id === state.nodeId)?.label || state.nodeId,
      status: state.status,
      mastery_score: state.mastery_score,
    })),
    suggestedPhrases: candidate.targetNodeStates.slice(0, 3).map((state) => pack.nodes.find((node) => node.id === state.nodeId)?.label).filter(Boolean),
  };
}

export function validatePack(pack = GOLD_PACK) {
  const errors = [];
  const nodes = Array.isArray(pack?.nodes) ? pack.nodes : [];
  const edges = Array.isArray(pack?.edges) ? pack.edges : [];
  const nodeIds = new Set();
  const objectiveIds = new Set();
  const vocabWords = new Set((pack?.vocabularyTargets || []).map((item) => item.word));
  const grammarPatterns = new Set((pack?.grammarTargets || []).map((item) => item.pattern));

  for (const node of nodes) {
    if (!node?.id) {
      errors.push({ code: 'node_missing_id', message: 'A node is missing an id.' });
      continue;
    }
    if (nodeIds.has(node.id)) {
      errors.push({ code: 'duplicate_node', message: `Duplicate node id ${node.id}.` });
    }
    nodeIds.add(node.id);
    if (node.kind === 'objective') {
      const objectiveId = node.metadata?.id;
      if (!objectiveId) {
        errors.push({ code: 'objective_missing_metadata', message: `Objective node ${node.id} is missing metadata.id.` });
      } else if (objectiveIds.has(objectiveId)) {
        errors.push({ code: 'duplicate_objective', message: `Duplicate objective id ${objectiveId}.` });
      } else {
        objectiveIds.add(objectiveId);
      }
      for (const targetId of node.metadata?.targetNodeIds || []) {
        if (!nodeIds.has(targetId) && !nodes.find((candidate) => candidate.id === targetId)) {
          errors.push({ code: 'missing_target_node', message: `Objective ${objectiveId} references missing target node ${targetId}.` });
        }
      }
    }
  }

  for (const edge of edges) {
    if (!['requires', 'reinforces', 'unlocks'].includes(edge.type)) {
      errors.push({ code: 'invalid_edge_type', message: `Edge ${edge.id} has unsupported type ${edge.type}.` });
    }
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      errors.push({ code: 'invalid_edge_reference', message: `Edge ${edge.id} points to a missing node.` });
    }
  }

  const adjacency = new Map();
  for (const edge of edges.filter((edge) => edge.type === 'requires' || edge.type === 'unlocks')) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from).push(edge.to);
  }

  const visiting = new Set();
  const visited = new Set();

  function visit(nodeId) {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    for (const next of adjacency.get(nodeId) || []) {
      if (visit(next)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  }

  for (const nodeId of adjacency.keys()) {
    if (visit(nodeId)) {
      errors.push({ code: 'cycle_detected', message: `Cycle detected in graph edges starting from ${nodeId}.` });
      break;
    }
  }

  for (const node of nodes.filter((item) => item.kind === 'objective')) {
    for (const targetId of node.metadata?.targetNodeIds || []) {
      const targetNode = nodes.find((candidate) => candidate.id === targetId);
      if (!targetNode) continue;
      if (
        (targetNode.kind === 'vocab' && !vocabWords.has(targetNode.label)) ||
        ((targetNode.kind === 'grammar_pattern' || targetNode.kind === 'sentence_frame') && !grammarPatterns.has(targetNode.label))
      ) {
        errors.push({
          code: 'unmapped_target_metadata',
          message: `Target ${targetNode.label} is missing matching vocabulary or grammar metadata.`,
        });
      }
    }
  }

  for (const level of pack?.contentContainers?.levels || []) {
    for (const objectiveId of level.objectiveIds || []) {
      if (!objectiveIds.has(objectiveId)) {
        errors.push({ code: 'level_objective_missing', message: `Level ${level.level} references missing objective ${objectiveId}.` });
      }
    }
    for (const requiredObjectiveId of level?.mission?.requiredObjectiveIds || []) {
      if (!objectiveIds.has(requiredObjectiveId)) {
        errors.push({
          code: 'mission_objective_missing',
          message: `Mission ${level?.mission?.missionId || level.level} references missing objective ${requiredObjectiveId}.`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errorCount: errors.length,
    errors,
    summary: errors.length === 0 ? 'Canonical Seoul graph pack passed validation.' : `${errors.length} validation error(s) detected.`,
  };
}

export function listGraphPersonas() {
  return PERSONAS.map((persona) => ({
    learnerId: persona.personaId,
    personaId: persona.personaId,
    userId: persona.userId,
    displayName: persona.displayName,
    focusSummary: persona.focusSummary,
    proficiency: cloneJson(persona.proficiency),
    goals: cloneJson(persona.goals),
  }));
}

export function getGraphDashboard(args = {}) {
  const persona = getPersonaFromArgs(args);
  const pack = GOLD_PACK;
  const evaluation = deriveEvaluation(pack, persona);
  const overlay = buildOverlay(persona);
  const nextActions = buildNextActions(pack, persona, evaluation, overlay).slice(0, Number(args.limit) || 4);
  const primaryBundle = buildLessonBundle(pack, persona, evaluation);
  const hangoutBundle = buildHangoutBundle(pack, evaluation);

  return {
    generatedAtIso: baseIso(),
    persona: {
      learnerId: persona.personaId,
      personaId: persona.personaId,
      userId: persona.userId,
      displayName: persona.displayName,
      focusSummary: persona.focusSummary,
      proficiency: cloneJson(persona.proficiency),
      goals: cloneJson(persona.goals),
      mediaPreferences: cloneJson(persona.mediaPreferences),
      topTerms: cloneJson(persona.topTerms),
    },
    progression: cloneJson(evaluation.progression),
    worldRoadmap: buildWorldRoadmap(persona, evaluation),
    locationSkillTree: {
      packId: pack.packId,
      cityId: pack.cityId,
      locationId: pack.locationId,
      title: pack.title,
      levels: cloneJson(evaluation.levels),
    },
    personalizedOverlay: overlay,
    nextActions,
    lessonBundle: primaryBundle,
    hangoutBundle,
    metrics: {
      validatedObjectives: evaluation.validatedObjectiveCount,
      masteredObjectives: evaluation.masteredObjectiveCount,
      dueNodeCount: evaluation.dueNodeCount,
      evidenceCount: evaluation.evidence.length,
    },
  };
}

function knownNodeIdsForPersona(persona) {
  const ids = new Set(GOLD_PACK.nodes.map((node) => node.id));
  const overlay = buildOverlay(persona);
  for (const card of overlay.focusCards) {
    for (const node of card.nodes) ids.add(node.nodeId);
  }
  return ids;
}

export function getGraphNextActions(args = {}) {
  const persona = getPersonaFromArgs(args);
  return {
    generatedAtIso: baseIso(),
    learnerId: persona.personaId,
    personaId: persona.personaId,
    actions: getGraphDashboard(args).nextActions,
  };
}

export function getGraphLessonBundle(args = {}) {
  const persona = getPersonaFromArgs(args);
  const evaluation = deriveEvaluation(GOLD_PACK, persona);
  return {
    learnerId: persona.personaId,
    ...buildLessonBundle(GOLD_PACK, persona, evaluation),
  };
}

export function getGraphHangoutBundle(args = {}) {
  const persona = getPersonaFromArgs(args);
  const evaluation = deriveEvaluation(GOLD_PACK, persona);
  return {
    learnerId: persona.personaId,
    ...buildHangoutBundle(GOLD_PACK, evaluation),
  };
}

export function recordGraphEvidence(args = {}) {
  const persona = getPersonaFromArgs(args);
  const runtimeEvidence = getRuntimeEvidence(persona);
  const knownNodeIds = knownNodeIdsForPersona(persona);
  const incoming = Array.isArray(args.events) ? args.events : args.event ? [args.event] : [];
  const normalized = incoming
    .map((event, index) => normalizeEvidenceEvent(event, persona, runtimeEvidence.length + index))
    .filter((event) => Boolean(event.nodeId) && knownNodeIds.has(event.nodeId));
  runtimeEvidence.push(...normalized);
  const dashboard = getGraphDashboard({ personaId: persona.personaId, userId: persona.userId });
  return {
    learnerId: persona.personaId,
    personaId: persona.personaId,
    recorded: normalized.length,
    events: normalized,
    progression: dashboard.progression,
    metrics: dashboard.metrics,
  };
}

export function proposeGraphOverlay(args = {}) {
  const persona = getPersonaFromArgs(args);
  const overlay = buildOverlay(persona);
  const filtered = overlay.focusCards
    .filter((card) => (args.lang ? card.lang === args.lang : true))
    .filter((card) => (args.theme ? card.theme === args.theme : true));
  const count = Number(args.count) || 4;
  return {
    generatedAtIso: baseIso(),
    learnerId: persona.personaId,
    personaId: persona.personaId,
    overlays: filtered.map((card) => ({
      ...card,
      nodes: card.nodes.slice(0, count),
    })),
  };
}

export function getGoldPack() {
  return cloneJson(GOLD_PACK);
}
