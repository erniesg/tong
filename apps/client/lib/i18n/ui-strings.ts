/**
 * Localized UI strings for exercise components and game chrome.
 * The AI generates exercise prompts/content in the user's language,
 * but hardcoded button labels and feedback text need this map.
 */
export type UILang = 'en' | 'ko' | 'ja' | 'zh';

const STRINGS: Record<string, Record<UILang, string>> = {
  // Exercise type labels (for result cards)
  'ex_matching': { en: 'Matching', ko: '매칭', ja: 'マッチング', zh: '配对' },
  'ex_multiple_choice': { en: 'Multiple Choice', ko: '객관식', ja: '選択問題', zh: '选择题' },
  'ex_drag_drop': { en: 'Drag & Drop', ko: '드래그 앤 드롭', ja: 'ドラッグ＆ドロップ', zh: '拖放' },
  'ex_sentence_builder': { en: 'Sentence Builder', ko: '문장 만들기', ja: '文章組み立て', zh: '造句' },
  'ex_fill_blank': { en: 'Fill in the Blank', ko: '빈칸 채우기', ja: '穴埋め', zh: '填空' },
  'ex_pronunciation_select': { en: 'Pronunciation', ko: '발음', ja: '発音', zh: '发音' },
  'ex_pattern_recognition': { en: 'Pattern', ko: '패턴', ja: 'パターン', zh: '规律' },
  'ex_stroke_tracing': { en: 'Tracing', ko: '따라 쓰기', ja: 'なぞり書き', zh: '描写' },
  'ex_error_correction': { en: 'Error Fix', ko: '오류 수정', ja: '誤り修正', zh: '纠错' },
  'ex_free_input': { en: 'Free Input', ko: '자유 입력', ja: '自由入力', zh: '自由输入' },
  'you_chose': { en: 'You chose', ko: '선택:', ja: '選択:', zh: '你选了' },

  // Buttons
  check: { en: 'Check', ko: '확인', ja: '確認', zh: '检查' },
  clear: { en: 'Clear', ko: '지우기', ja: 'クリア', zh: '清除' },
  done: { en: 'Done', ko: '완료', ja: '完了', zh: '完成' },

  // Feedback
  correct: { en: 'Correct!', ko: '정답!', ja: '正解!', zh: '正确！' },
  'all_correct': { en: 'All correct!', ko: '전부 정답!', ja: '全問正解!', zh: '全部正确！' },
  'perfect_match': { en: 'Perfect — all matched!', ko: '완벽! 전부 맞았어!', ja: '完璧！全て一致!', zh: '完美——全部配对成功！' },

  // Answer reveals
  'answer_is': { en: 'The answer is', ko: '정답은', ja: '正解は', zh: '正确答案是' },
  'correct_pronunciation': { en: 'The correct pronunciation is', ko: '올바른 발음은', ja: '正しい発音は', zh: '正确的读音是' },
  'correct_order': { en: 'Correct order:', ko: '올바른 순서:', ja: '正しい順序:', zh: '正确顺序：' },
  'error_was': { en: 'The error was', ko: '오류는', ja: '間違いは', zh: '错误是' },
  'correct_word': { en: 'correct:', ko: '정답:', ja: '正解:', zh: '正确：' },
  'expected': { en: 'Expected:', ko: '예상 정답:', ja: '期待される回答:', zh: '预期答案：' },
  'some_wrong': { en: 'Some are in the wrong place — review and try again!', ko: '일부가 틀렸어요 — 다시 시도해보세요!', ja: 'いくつか違う場所にあります — もう一度!', zh: '有些放错位置了——再试试！' },
  'n_of_total_correct': { en: 'correct', ko: '정답', ja: '正解', zh: '正确' },

  // Hints / placeholders
  'tap_to_play': { en: 'Tap to play', ko: '눌러서 재생', ja: 'タップして再生', zh: '点击播放' },
  'tap_tiles': { en: 'Tap tiles to build your sentence', ko: '타일을 눌러서 문장을 만드세요', ja: 'タイルをタップして文を作ろう', zh: '点击方块拼句子' },
  'pick_word': { en: 'pick a word ↑', ko: '단어 선택 ↑', ja: '単語を選ぶ ↑', zh: '选一个词 ↑' },
  'tap_to_place': { en: 'tap to place', ko: '눌러서 배치', ja: 'タップして配置', zh: '点击放置' },
  'replace_with': { en: 'Replace with:', ko: '교체:', ja: '置換:', zh: '替换为：' },
  'type_answer': { en: 'Type your answer...', ko: '답을 입력하세요...', ja: '回答を入力...', zh: '输入答案...' },
  'stroke_done': { en: 'Great practice! Drawing helps your muscle memory.', ko: '잘했어요! 쓰기 연습은 기억에 도움이 돼요.', ja: '素晴らしい練習！書くことで体が覚えます。', zh: '练得好！书写有助于肌肉记忆。' },
  'stroke_try_again': { en: 'Try tracing closer to the character shape.', ko: '글자 모양에 더 가깝게 따라 써 보세요.', ja: '文字の形にもっと近づけてなぞってみよう。', zh: '试着更贴近字形描写。' },
  'stroke_score': { en: 'Accuracy', ko: '정확도', ja: '精度', zh: '准确度' },
  'stroke_examples': { en: 'Words using this character:', ko: '이 글자가 쓰이는 단어:', ja: 'この文字を使う単語:', zh: '使用这个字的词：' },
  'your_pick': { en: 'Your pick', ko: '선택', ja: '選択', zh: '你的选择' },
  'or': { en: 'or', ko: '또는', ja: 'または', zh: '或' },

  // Scene Complete
  'scene_complete': { en: 'Scene Complete!', ko: '장면 완료!', ja: 'シーン完了!', zh: '场景完成！' },
  'xp_earned': { en: 'XP earned', ko: 'XP 획득', ja: 'XP 獲得', zh: '获得 XP' },
  'free': { en: 'Free', ko: '무료', ja: '無料', zh: '免费' },

  // LocationSheet
  'hangout': { en: 'Hangout', ko: '행아웃', ja: 'ハングアウト', zh: '闲逛' },
  'hangout_desc': { en: 'Practice conversation with locals', ko: '현지인과 대화 연습', ja: '地元の人と会話練習', zh: '和当地人练习对话' },
  'learn': { en: 'Learn', ko: '학습', ja: '学習', zh: '学习' },
  'learn_desc': { en: 'Study vocabulary & grammar', ko: '어휘와 문법 공부', ja: '語彙と文法の勉強', zh: '学习词汇和语法' },
  'mission': { en: 'Mission', ko: '미션', ja: 'ミッション', zh: '任务' },
  'mission_clear': { en: 'Clear this location!', ko: '이 장소를 클리어하세요!', ja: 'このスポットをクリア!', zh: '通关这个地点！' },
  'mission_hangouts_needed': { en: 'more hangout(s) to unlock', ko: '번 더 행아웃하면 해금', ja: '回ハングアウトで解放', zh: '次闲逛后解锁' },
  'mission_mastery': { en: 'Demonstrate mastery to unlock', ko: '마스터하여 해금하세요', ja: 'マスターして解放', zh: '展示掌握程度以解锁' },
  'need_sp': { en: 'Need', ko: '필요', ja: '必要', zh: '需要' },
  'you_have': { en: 'you have', ko: '보유', ja: '所持', zh: '你有' },
  'coming_soon': { en: 'This city is coming soon!', ko: '이 도시는 곧 공개됩니다!', ja: 'この都市はもうすぐ!', zh: '这个城市即将开放！' },

  // Exercise prompt & result
  'tap_to_start_exercise': { en: 'Tap to start exercise', ko: '눌러서 연습 시작', ja: 'タップして練習開始', zh: '点击开始练习' },
  'got_it_right': { en: 'Got it right!', ko: '맞았어!', ja: '正解だった！', zh: '答对了！' },
  'missed_that': { en: 'Missed that one.', ko: '틀렸어...', ja: '間違えた…', zh: '答错了…' },

  // Session picker
  'learn_korean': { en: 'Learn Korean', ko: '한국어 배우기', ja: '韓国語を学ぶ', zh: '学韩语' },
  'learn_japanese': { en: 'Learn Japanese', ko: '일본어 배우기', ja: '日本語を学ぶ', zh: '学日语' },
  'learn_chinese': { en: 'Learn Chinese', ko: '중국어 배우기', ja: '中国語を学ぶ', zh: '学中文' },
  'practice_with_tong': { en: 'Practice with Tong, your learning companion', ko: '통과 함께 연습하세요', ja: 'トンと一緒に練習しよう', zh: '和小通一起练习吧' },
  'start_new_session': { en: 'Start new session', ko: '새 세션 시작', ja: '新しいセッションを開始', zh: '开始新课程' },
  'past_sessions': { en: 'Past sessions', ko: '이전 세션', ja: '過去のセッション', zh: '历史课程' },

  // Session summary
  'session_complete': { en: 'Session complete!', ko: '수업 완료!', ja: 'セッション完了！', zh: '课程完成！' },
  'accuracy': { en: 'Accuracy', ko: '정확도', ja: '正答率', zh: '正确率' },
  'exercises_label': { en: 'Exercises', ko: '연습', ja: '練習', zh: '练习' },
  'correct_count': { en: 'Correct', ko: '정답', ja: '正解', zh: '正确' },
  'level_up': { en: 'Level up!', ko: '레벨 업!', ja: 'レベルアップ！', zh: '升级！' },

  // Review mode
  'reviewing_session': { en: 'Reviewing past session', ko: '이전 수업 보기', ja: '過去のセッションを確認中', zh: '查看历史课程' },
  'back': { en: 'Back', ko: '뒤로', ja: '戻る', zh: '返回' },
  'review_session': { en: 'Review', ko: '복습', ja: '復習', zh: '回顾' },
  'new_session': { en: 'New session', ko: '새 수업', ja: '新しいセッション', zh: '新课程' },

  // Location names
  'loc_food_street': { en: 'Food Street', ko: '먹자골목', ja: 'フードストリート', zh: '小吃街' },
  'loc_cafe': { en: 'Cafe', ko: '카페', ja: 'カフェ', zh: '咖啡馆' },
  'loc_convenience_store': { en: 'Convenience Store', ko: '편의점', ja: 'コンビニ', zh: '便利店' },
  'loc_subway_hub': { en: 'Subway Hub', ko: '지하철역', ja: '地下鉄駅', zh: '地铁站' },
  'loc_practice_studio': { en: 'Practice Studio', ko: '연습실', ja: '練習スタジオ', zh: '练习室' },
  'loc_metro_station': { en: 'Metro Station', ko: '지하철역', ja: 'メトロ駅', zh: '地铁站' },
  'loc_bbq_stall': { en: 'BBQ Stall', ko: 'BBQ 포장마차', ja: 'BBQ屋台', zh: '烧烤摊' },
  'loc_milk_tea_shop': { en: 'Milk Tea Shop', ko: '밀크티 가게', ja: 'ミルクティー屋', zh: '奶茶店' },
  'loc_dumpling_shop': { en: 'Dumpling Shop', ko: '만두 가게', ja: '餃子屋', zh: '饺子馆' },

  // City map
  'explain_in': { en: 'Explain in:', ko: '설명 언어:', ja: '説明言語:', zh: '说明语言：' },

  // Exercise prompts (generated exercises)
  'match_char_roman': { en: 'Match each character to its romanization', ko: '각 글자를 로마자에 맞추세요', ja: '各文字をローマ字と合わせよう', zh: '将字符匹配到罗马音' },
  'match_symbol_sound': { en: 'Match each symbol to its sound', ko: '각 기호를 소리에 맞추세요', ja: '各記号を音と合わせよう', zh: '将符号匹配到发音' },
  'match_words_meaning': { en: 'Match the words to their meanings', ko: '단어를 뜻에 맞추세요', ja: '単語を意味と合わせよう', zh: '将词语匹配到含义' },
  'which_sound': { en: 'Which symbol makes the "{0}" sound?', ko: '"{0}" 소리를 내는 기호는?', ja: '「{0}」の音を出す記号は？', zh: '哪个符号发"{0}"的音？' },
  'what_sound': { en: 'What sound does "{0}" make?', ko: '"{0}"은(는) 무슨 소리?', ja: '「{0}」はどんな音？', zh: '"{0}"发什么音？' },
  'what_means': { en: 'What does "{0}" mean?', ko: '"{0}"의 뜻은?', ja: '「{0}」の意味は？', zh: '"{0}"是什么意思？' },
  'stroke_prompt': { en: 'Trace the character: {0}', ko: '글자를 따라 쓰세요: {0}', ja: '文字をなぞろう: {0}', zh: '描写这个字: {0}' },
  'stroke_explain': { en: 'Practice writing {0} to build muscle memory.', ko: '{0} 쓰기를 연습하여 익히세요.', ja: '{0}を書いて体で覚えよう。', zh: '练习写{0}来培养肌肉记忆。' },
  'type_word_for': { en: 'Type the word for "{0}":', ko: '"{0}"에 해당하는 단어를 입력하세요:', ja: '「{0}」の単語を入力しよう:', zh: '输入"{0}"对应的词：' },
  'romanization_hint': { en: 'Romanization: {0}', ko: '로마자: {0}', ja: 'ローマ字: {0}', zh: '罗马音: {0}' },
  'build_char': { en: 'Build the character: {0}', ko: '글자를 조합하세요: {0}', ja: '文字を組み立てよう: {0}', zh: '组合这个字: {0}' },

  // Navigation
  'tap_to_continue': { en: 'Tap to continue', ko: '탭하여 계속', ja: 'タップして続く', zh: '点击继续' },
  'tap_to_skip': { en: 'Tap to skip', ko: '탭하여 건너뛰기', ja: 'タップでスキップ', zh: '点击跳过' },

  // Charge bar
  'charge_unlocked': { en: '✦ {0} unlocked', ko: '✦ {0} 해금', ja: '✦ {0} 解放', zh: '✦ {0} 已解锁' },

  // Pronunciation exercise
  'pron_prompt': { en: 'Listen and pick the matching character', ko: '듣고 맞는 글자를 고르세요', ja: '聞いて合う文字を選ぼう', zh: '听音选字' },
};

export function t(key: string, lang: UILang = 'en'): string {
  return STRINGS[key]?.[lang] ?? STRINGS[key]?.en ?? key;
}

/** t() with positional {0}, {1}, ... replacements. */
export function tFmt(key: string, lang: UILang = 'en', ...args: string[]): string {
  let s = t(key, lang);
  for (let i = 0; i < args.length; i++) {
    s = s.replace(`{${i}}`, args[i]);
  }
  return s;
}
