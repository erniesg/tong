import { streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { buildLearnSystemPrompt, type LearnPromptVars } from '@/lib/ai/prompts/tong-learn';

export const runtime = 'nodejs';
export const maxDuration = 60;

/* ── Server-side pools & helpers ────────────────────────────── */

const CONSONANTS = ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const VOWELS     = ['ㅏ','ㅑ','ㅓ','ㅕ','ㅗ','ㅛ','ㅜ','ㅠ','ㅡ','ㅣ'];
const FOOD_WORDS = ['떡볶이','김밥','라면','순대','만두','호떡','어묵','붕어빵','핫도그','컵밥'];
const COURTESY_WORDS = ['감사합니다','주세요','안녕하세요','죄송합니다','네'];

/** Per-character translations for all 4 UI languages. */
const CHAR_ROMANIZATIONS: Record<string, Record<string, string>> = {
  // Consonants
  'ㄱ': { en: 'g/k', zh: 'g音(哥)', ko: 'ㄱ', ja: 'g(ガ)' },
  'ㄴ': { en: 'n', zh: 'n音(呢)', ko: 'ㄴ', ja: 'n(ナ)' },
  'ㄷ': { en: 'd/t', zh: 'd音(的)', ko: 'ㄷ', ja: 'd(ダ)' },
  'ㄹ': { en: 'r/l', zh: 'r/l音(了)', ko: 'ㄹ', ja: 'r/l(ラ)' },
  'ㅁ': { en: 'm', zh: 'm音(么)', ko: 'ㅁ', ja: 'm(マ)' },
  'ㅂ': { en: 'b/p', zh: 'b/p音(八)', ko: 'ㅂ', ja: 'b/p(バ)' },
  'ㅅ': { en: 's', zh: 's音(四)', ko: 'ㅅ', ja: 's(サ)' },
  'ㅇ': { en: 'ng', zh: 'ng音(嗯)', ko: 'ㅇ', ja: 'ng(ン)' },
  'ㅈ': { en: 'j', zh: 'j音(吉)', ko: 'ㅈ', ja: 'j(ジャ)' },
  'ㅊ': { en: 'ch', zh: 'ch音(吃)', ko: 'ㅊ', ja: 'ch(チャ)' },
  'ㅋ': { en: 'k', zh: 'k音(可)', ko: 'ㅋ', ja: 'k(カ)' },
  'ㅌ': { en: 't', zh: 't音(他)', ko: 'ㅌ', ja: 't(タ)' },
  'ㅍ': { en: 'p', zh: 'p音(怕)', ko: 'ㅍ', ja: 'p(パ)' },
  'ㅎ': { en: 'h', zh: 'h音(哈)', ko: 'ㅎ', ja: 'h(ハ)' },
  // Vowels
  'ㅏ': { en: 'a', zh: 'a音(啊)', ko: 'ㅏ', ja: 'a(ア)' },
  'ㅑ': { en: 'ya', zh: 'ya音(呀)', ko: 'ㅑ', ja: 'ya(ヤ)' },
  'ㅓ': { en: 'eo', zh: 'eo音(哦)', ko: 'ㅓ', ja: 'eo(オ)' },
  'ㅕ': { en: 'yeo', zh: 'yeo音(哟)', ko: 'ㅕ', ja: 'yeo(ヨ)' },
  'ㅗ': { en: 'o', zh: 'o音(喔)', ko: 'ㅗ', ja: 'o(オ)' },
  'ㅛ': { en: 'yo', zh: 'yo音(哟)', ko: 'ㅛ', ja: 'yo(ヨ)' },
  'ㅜ': { en: 'u', zh: 'u音(乌)', ko: 'ㅜ', ja: 'u(ウ)' },
  'ㅠ': { en: 'yu', zh: 'yu音(鱼)', ko: 'ㅠ', ja: 'yu(ユ)' },
  'ㅡ': { en: 'eu', zh: 'eu音(으)', ko: 'ㅡ', ja: 'eu(ウ)' },
  'ㅣ': { en: 'i', zh: 'i音(衣)', ko: 'ㅣ', ja: 'i(イ)' },
};

/** Food word translations for all 4 UI languages. */
const FOOD_TRANSLATIONS: Record<string, Record<string, string>> = {
  '떡볶이': { en: 'tteokbokki', zh: '辣炒年糕', ko: '떡볶이', ja: 'トッポッキ' },
  '김밥':   { en: 'gimbap', zh: '紫菜饭卷', ko: '김밥', ja: 'キンパ' },
  '라면':   { en: 'ramyeon', zh: '拉面', ko: '라면', ja: 'ラーメン' },
  '순대':   { en: 'sundae', zh: '血肠', ko: '순대', ja: 'スンデ' },
  '만두':   { en: 'mandu', zh: '饺子', ko: '만두', ja: 'マンドゥ' },
  '호떡':   { en: 'hotteok', zh: '糖饼', ko: '호떡', ja: 'ホットク' },
  '어묵':   { en: 'eomuk', zh: '鱼糕', ko: '어묵', ja: 'オデン' },
  '붕어빵': { en: 'bungeo-ppang', zh: '鲫鱼饼', ko: '붕어빵', ja: 'たい焼き' },
  '핫도그': { en: 'hotdog', zh: '热狗', ko: '핫도그', ja: 'ホットドッグ' },
  '컵밥':   { en: 'cupbap', zh: '杯饭', ko: '컵밥', ja: 'カップご飯' },
};

/** Romanizations for the wrap-up learnedItems. */
const CHAR_ROMANIZATION: Record<string, string> = {
  'ㄱ': 'g', 'ㄴ': 'n', 'ㄷ': 'd', 'ㄹ': 'r/l', 'ㅁ': 'm',
  'ㅂ': 'b/p', 'ㅅ': 's', 'ㅇ': 'ng', 'ㅈ': 'j', 'ㅊ': 'ch',
  'ㅋ': 'k', 'ㅌ': 't', 'ㅍ': 'p', 'ㅎ': 'h',
  'ㅏ': 'a', 'ㅑ': 'ya', 'ㅓ': 'eo', 'ㅕ': 'yeo', 'ㅗ': 'o',
  'ㅛ': 'yo', 'ㅜ': 'u', 'ㅠ': 'yu', 'ㅡ': 'eu', 'ㅣ': 'i',
  '떡볶이': 'tteokbokki', '김밥': 'gimbap', '라면': 'ramyeon', '순대': 'sundae',
  '만두': 'mandu', '호떡': 'hotteok', '어묵': 'eomuk', '붕어빵': 'bungeo-ppang',
  '핫도그': 'hotdog', '컵밥': 'cupbap',
};

function serverShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function serverPick<T>(pool: T[], n: number): T[] {
  return serverShuffle(pool).slice(0, n);
}

interface ItemMasteryEntry {
  correct?: number;
  incorrect?: number;
  masteryLevel?: string;
  nextReviewAt?: number;
}

/** SRS-aware pick: due items first, then unseen, then random fill. */
function srsAwarePick(
  pool: string[],
  count: number,
  itemMastery?: Record<string, ItemMasteryEntry>,
): string[] {
  if (!itemMastery || Object.keys(itemMastery).length === 0) {
    return serverPick(pool, count);
  }

  const now = Date.now();
  const due: string[] = [];
  const unseen: string[] = [];
  const rest: string[] = [];

  for (const item of pool) {
    const m = itemMastery[item];
    if (!m) {
      unseen.push(item);
    } else if (m.nextReviewAt && m.nextReviewAt <= now) {
      due.push(item);
    } else {
      rest.push(item);
    }
  }

  const result: string[] = [];
  for (const item of serverShuffle(due)) {
    if (result.length >= count) break;
    result.push(item);
  }
  for (const item of serverShuffle(unseen)) {
    if (result.length >= count) break;
    result.push(item);
  }
  for (const item of serverShuffle(rest)) {
    if (result.length >= count) break;
    result.push(item);
  }
  return result;
}

/** Exercise types available for fallback sessions. */
const EXERCISE_TYPES = ['matching', 'drag_drop', 'multiple_choice'] as const;

/**
 * Streaming lesson API — drives the learn chat via tool calls.
 *
 * Tools:
 *   teach_concept   → TeachingCard with jamo/vocab grid
 *   show_exercise   → ExerciseModal with type + hints
 *   offer_choices   → MenuChoices for topic selection
 *   give_feedback   → FeedbackBubble (correct/incorrect)
 *   wrap_up         → SessionSummary with stats
 */

const lessonTools = {
  teach_concept: tool({
    description: 'Teach vocabulary or jamo to the player. Shows a card with items they can tap to hear pronunciation.',
    parameters: z.object({
      message: z.string().describe('Teaching explanation (1-2 sentences)'),
      korean: z.string().nullable().describe('Space-separated Korean characters/words to display, or null'),
      translation: z.string().nullable().describe('Space-separated romanizations/meanings matching korean items, or null'),
    }),
    execute: async (args) => args,
  }),
  show_exercise: tool({
    description: 'Show an interactive exercise. After calling this, STOP and wait for the player result. PREFERRED: provide exerciseData with the complete exercise object for contextual, adaptive exercises. FALLBACK: set exerciseData to null and the client generates locally from hints.',
    parameters: z.object({
      exerciseType: z.enum([
        'matching', 'multiple_choice', 'drag_drop',
        'sentence_builder', 'fill_blank', 'pronunciation_select',
        'pattern_recognition', 'stroke_tracing', 'error_correction', 'free_input',
      ]).describe('Exercise UI type'),
      objectiveId: z.string().describe('Learning objective this tests'),
      exerciseData: z.string().nullable().describe('JSON-encoded complete exercise object. When provided, client parses and uses it directly. When null, client generates locally from hints. ID convention: "ai-{type}-{timestamp}".'),
      hintItems: z.array(z.string()).nullable().describe('Specific Korean chars/words to include in the exercise, or null'),
      hintCount: z.number().nullable().describe('How many items the exercise should contain, or null for default'),
      hintSubType: z.enum(['sound_quiz', 'visual_recognition']).nullable().describe('Exercise flavor for script exercises, or null'),
    }),
    execute: async (args) => args,
  }),
  offer_choices: tool({
    description: 'Present topic choices for the player. After calling this, STOP and wait for their choice.',
    parameters: z.object({
      prompt: z.string().describe('Question for the player'),
      choices: z.array(z.object({
        id: z.string(),
        text: z.string(),
      })).describe('Available choices'),
    }),
    execute: async (args) => args,
  }),
  give_feedback: tool({
    description: 'Give feedback on an exercise result.',
    parameters: z.object({
      positive: z.boolean().describe('True if the player got it right'),
      message: z.string().describe('Brief feedback message (1-2 sentences)'),
      detail: z.string().nullable().describe('Optional explanation or hint, or null'),
    }),
    execute: async (args) => args,
  }),
  wrap_up: tool({
    description: 'End the learning session with a summary.',
    parameters: z.object({
      summary: z.string().describe('Brief session recap'),
      xpEarned: z.number().describe('Total XP earned (base 30 + 10 per correct exercise)'),
      learnedItems: z.array(z.object({
        char: z.string(),
        romanization: z.string().nullable(),
      })).describe('Items learned in this session'),
    }),
    execute: async (args) => args,
  }),
};

/**
 * Deep-resolve any tool invocations still in 'call' state.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveUnresolvedTools(messages: any[]): any[] {
  let resolved = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function deepResolve(obj: any): any {
    if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(deepResolve);
    if (obj.state === 'call' && obj.toolCallId && obj.toolName) {
      resolved++;
      return { ...obj, state: 'result', result: obj.result ?? obj.args ?? {} };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      result[key] = deepResolve(val);
    }
    return result;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = messages.map((msg: any) => msg.role !== 'assistant' ? msg : deepResolve(msg));
  if (resolved > 0) {
    console.log(`[lesson] Auto-resolved ${resolved} unresolved tool invocations`);
  }
  return result;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (e) {
    console.error('[lesson] Failed to parse request body:', e);
    return new Response('Invalid JSON', { status: 400 });
  }

  const rawMessages = body.messages ?? [];
  const messages = resolveUnresolvedTools(rawMessages as Record<string, unknown>[]);

  // Parse context from latest user message
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
  const contextStr = (typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '') as string;

  let promptVars: LearnPromptVars | null = null;

  try {
    const ctxMatch = contextStr.match(/\[LEARN_CONTEXT\]([\s\S]*?)\[\/LEARN_CONTEXT\]/);
    if (ctxMatch) {
      const ctx = JSON.parse(ctxMatch[1]);
      promptVars = {
        playerLevel: ctx.playerLevel ?? 0,
        selfAssessedLevel: ctx.selfAssessedLevel ?? null,
        calibratedLevel: ctx.calibratedLevel ?? null,
        mastery: ctx.mastery ?? {
          script: { learned: [], total: 24 },
          pronunciation: { accuracy: 0, weakSounds: [] },
          vocabulary: { strong: [], weak: [], total: 45, mastered: 0 },
          grammar: { mastered: [], learning: [], notStarted: ['N+주세요', '을/를', 'N+개'] },
        },
        objectives: ctx.objectives ?? [],
        cityId: ctx.cityId ?? 'seoul',
        locationId: ctx.locationId ?? 'food_street',
        explainIn: ctx.explainIn ?? 'en',
        sessionExercisesCompleted: ctx.sessionExercisesCompleted ?? 0,
        sessionExercisesCorrect: ctx.sessionExercisesCorrect ?? 0,
      };
    }
  } catch { /* ignore parse errors */ }

  const hasApiKey = !!process.env.OPENAI_API_KEY;

  if (!hasApiKey) {
    return buildFallbackResponse(messages, promptVars?.explainIn ?? 'en');
  }

  const defaultVars: LearnPromptVars = promptVars ?? {
    playerLevel: 0,
    selfAssessedLevel: null,
    calibratedLevel: null,
    mastery: {
      script: { learned: [], total: 24 },
      pronunciation: { accuracy: 0, weakSounds: [] },
      vocabulary: { strong: [], weak: [], total: 45, mastered: 0 },
      grammar: { mastered: [], learning: [], notStarted: ['N+주세요', '을/를', 'N+개'] },
    },
    objectives: [],
    cityId: 'seoul',
    locationId: 'food_street',
    explainIn: 'en',
    sessionExercisesCompleted: 0,
    sessionExercisesCorrect: 0,
  };

  const systemPrompt = buildLearnSystemPrompt(defaultVars);
  const modelId = process.env.OPENAI_MODEL ?? 'gpt-5.2';

  console.log('[lesson] AI mode — model:', modelId, 'messages:', messages.length);

  try {
    const result = streamText({
      model: openai(modelId),
      system: systemPrompt,
      messages,
      tools: lessonTools,
      maxSteps: 4,
      temperature: 0.7,
      onError: (error) => {
        console.error('[lesson] Stream error:', error);
      },
      onStepFinish: ({ toolCalls, text }) => {
        if (text) console.log('[lesson] Step text:', text.slice(0, 200));
        if (toolCalls?.length) {
          for (const tc of toolCalls) {
            console.log(`[lesson] Tool: ${tc.toolName}`, JSON.stringify(tc.args).slice(0, 300));
          }
        }
      },
    });
    return result.toDataStreamResponse();
  } catch (err) {
    console.error('[lesson] AI error, falling back:', err);
    return buildFallbackResponse(messages);
  }
}

/**
 * Fallback when no API key is available.
 * Scripted 3-exercise session with randomized content each time.
 */
const FALLBACK_MSGS: Record<string, Record<string, string>> = {
  greeting: {
    en: "Hi! I'm Tong, your Korean learning buddy! Let's start with some basic Korean consonants. Tap each one to hear how it sounds!",
    zh: '嗨！我是小通，你的韩语学习伙伴！我们先从基本的韩文辅音开始吧。点击每个字母听发音哦！',
    ko: '안녕! 나는 통이야, 너의 한국어 학습 친구! 기본 자음부터 시작하자. 눌러서 소리를 들어봐!',
    ja: 'こんにちは！トンです、韓国語学習パートナー！まずは子音から始めましょう。タップして発音を聞いてね！',
  },
  consonants_correct: {
    en: 'Great job! You matched them all correctly!',
    zh: '太棒了！全部配对正确！',
    ko: '잘했어! 전부 맞았어!',
    ja: 'すばらしい！全部正解！',
  },
  consonants_wrong: {
    en: "Don't worry, consonants take practice. Let's keep going!",
    zh: '别担心，辅音需要多练习。继续加油！',
    ko: '걱정 마, 자음은 연습이 필요해. 계속 가보자!',
    ja: '大丈夫、子音は練習が必要。続けましょう！',
  },
  vowels_intro: {
    en: "Now let's learn some vowels! Korean vowels are based on simple shapes.",
    zh: '现在来学元音吧！韩文元音基于简单的形状。',
    ko: '이제 모음을 배워보자! 간단한 모양이 기본이야.',
    ja: '次は母音！韓国語の母音はシンプルな形が基本です。',
  },
  vowels_correct: {
    en: 'Perfect! You have a great ear for Korean sounds!',
    zh: '完美！你对韩语发音辨别力很强！',
    ko: '완벽해! 소리를 잘 구별하네!',
    ja: '完璧！韓国語の音をよく聞き分けています！',
  },
  vowels_wrong: {
    en: "Korean vowels can be tricky. You'll get better with practice!",
    zh: '韩文元音可能有点难。多练习就会进步！',
    ko: '모음은 어려울 수 있어. 연습하면 나아질 거야!',
    ja: '母音は難しいこともあります。練習すれば上達しますよ！',
  },
  food_intro: {
    en: "Now let's learn some food words you'll see at a 포장마차 (street food stall)!",
    zh: '现在来学在포장마차（小吃摊）会看到的美食词汇吧！',
    ko: '이제 포장마차에서 볼 수 있는 음식 단어를 배워보자!',
    ja: 'ポジャンマチャ（屋台）で見かける食べ物の言葉を学びましょう！',
  },
  great_job: {
    en: "Awesome! You're doing great!",
    zh: '太棒了！做得很好！',
    ko: '대단해! 잘하고 있어!',
    ja: 'すごい！とても良くできています！',
  },
  good_effort: {
    en: 'Good effort! Review the ones you missed.',
    zh: '不错！复习一下做错的部分吧。',
    ko: '수고했어! 틀린 것들을 복습해봐.',
    ja: '頑張りました！間違えたものを復習しましょう。',
  },
  wrap_summary: {
    en: 'Great session! {ex} exercises, {correct} correct. Keep it up!',
    zh: '棒！完成{ex}道练习，答对{correct}道。继续加油！',
    ko: '수고! {ex}개 연습, {correct}개 정답. 계속 화이팅!',
    ja: 'お疲れ様！{ex}問中{correct}問正解。頑張りましょう！',
  },
};

function fb(key: string, lang: string): string {
  return FALLBACK_MSGS[key]?.[lang] ?? FALLBACK_MSGS[key]?.en ?? key;
}

/** Build dynamic translation string from items and language. */
function buildTranslation(items: string[], lang: string): string {
  return items.map((c) => CHAR_ROMANIZATIONS[c]?.[lang] ?? FOOD_TRANSLATIONS[c]?.[lang] ?? c).join(' ');
}

/** Detect which exercise types have been used in prior turns. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getUsedExerciseTypes(messages: any[]): string[] {
  const used: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    const content = JSON.stringify(msg);
    for (const t of EXERCISE_TYPES) {
      if (content.includes(`"exerciseType":"${t}"`) || content.includes(`"exerciseType": "${t}"`)) {
        used.push(t);
      }
    }
  }
  return used;
}

/** Pick an exercise type not yet used in this session, or random. */
function pickExerciseType(usedTypes: string[]): string {
  const available = EXERCISE_TYPES.filter((t) => !usedTypes.includes(t));
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)];
  }
  return EXERCISE_TYPES[Math.floor(Math.random() * EXERCISE_TYPES.length)];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFallbackResponse(messages: any[], explainIn: string = 'en') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMsgs = messages.filter((m: any) => m.role === 'user');
  const lastContent = typeof userMsgs[userMsgs.length - 1]?.content === 'string'
    ? userMsgs[userMsgs.length - 1].content : '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exerciseCount = userMsgs.filter((m: any) => {
    const c = typeof m.content === 'string' ? m.content : '';
    return c.includes('Exercise result:');
  }).length;
  const lastWasCorrect = lastContent.includes('Exercise result:')
    && lastContent.includes('correct')
    && !lastContent.includes('incorrect');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const correctCount = userMsgs.filter((m: any) => {
    const c = typeof m.content === 'string' ? m.content : '';
    return c.includes('Exercise result:') && c.includes('correct') && !c.includes('incorrect');
  }).length;

  // Parse itemMastery from latest LEARN_CONTEXT if available
  let itemMastery: Record<string, ItemMasteryEntry> | undefined;
  try {
    const ctxMatch = lastContent.match(/\[LEARN_CONTEXT\]([\s\S]*?)\[\/LEARN_CONTEXT\]/);
    if (ctxMatch) {
      const ctx = JSON.parse(ctxMatch[1]);
      if (ctx.itemMastery && Object.keys(ctx.itemMastery).length > 0) {
        itemMastery = ctx.itemMastery;
      }
    }
  } catch { /* ignore */ }

  const usedTypes = getUsedExerciseTypes(messages);

  console.log(`[lesson] Fallback turn: userMsgs=${userMsgs.length}, exerciseCount=${exerciseCount}, usedTypes=${usedTypes.join(',')}`);

  const toolCalls: Array<{ toolName: string; args: Record<string, unknown>; pauses?: boolean }> = [];

  if (userMsgs.length <= 1) {
    // ── TURN 1: Greeting + teach random consonants ──
    const consonants = srsAwarePick(CONSONANTS, 3 + Math.floor(Math.random() * 3), itemMastery);
    const exType = pickExerciseType(usedTypes);
    toolCalls.push({
      toolName: 'teach_concept',
      args: {
        message: fb('greeting', explainIn),
        korean: consonants.join(' '),
        translation: buildTranslation(consonants, explainIn),
      },
    });
    toolCalls.push({
      toolName: 'show_exercise',
      args: {
        exerciseType: exType,
        objectiveId: 'ko-script-consonants',
        exerciseData: null,
        hintItems: consonants,
        hintCount: consonants.length,
        hintSubType: 'sound_quiz',
      },
      pauses: true,
    });
  } else if (exerciseCount === 1) {
    // ── TURN 2: Feedback + teach random vowels + different exercise type ──
    const vowels = srsAwarePick(VOWELS, 4, itemMastery);
    const exType = pickExerciseType(usedTypes);
    toolCalls.push({
      toolName: 'give_feedback',
      args: {
        positive: lastWasCorrect,
        message: lastWasCorrect
          ? fb('consonants_correct', explainIn)
          : fb('consonants_wrong', explainIn),
        detail: null,
      },
    });
    toolCalls.push({
      toolName: 'teach_concept',
      args: {
        message: fb('vowels_intro', explainIn),
        korean: vowels.join(' '),
        translation: buildTranslation(vowels, explainIn),
      },
    });
    toolCalls.push({
      toolName: 'show_exercise',
      args: {
        exerciseType: exType,
        objectiveId: 'ko-script-vowels',
        exerciseData: null,
        hintItems: vowels,
        hintCount: vowels.length,
        hintSubType: null,
      },
      pauses: true,
    });
  } else if (exerciseCount === 2) {
    // ── TURN 3: Feedback + teach random food words + yet another type ──
    const foods = srsAwarePick(FOOD_WORDS, 4, itemMastery);
    const exType = pickExerciseType(usedTypes);
    toolCalls.push({
      toolName: 'give_feedback',
      args: {
        positive: lastWasCorrect,
        message: lastWasCorrect
          ? fb('vowels_correct', explainIn)
          : fb('vowels_wrong', explainIn),
        detail: null,
      },
    });
    toolCalls.push({
      toolName: 'teach_concept',
      args: {
        message: fb('food_intro', explainIn),
        korean: foods.join(' '),
        translation: buildTranslation(foods, explainIn),
      },
    });
    toolCalls.push({
      toolName: 'show_exercise',
      args: {
        exerciseType: exType,
        objectiveId: 'ko-vocab-food-items',
        exerciseData: null,
        hintItems: foods,
        hintCount: foods.length,
        hintSubType: null,
      },
      pauses: true,
    });
  } else {
    // ── TURN 4+: Feedback + wrap up with dynamic learnedItems ──
    const xpEarned = 30 + correctCount * 10;

    // Build learnedItems by scanning prior teach_concept korean fields
    const learnedChars = new Set<string>();
    for (const msg of messages) {
      const content = JSON.stringify(msg);
      // Match korean fields from teach_concept tool calls
      const koreanMatch = content.match(/"korean"\s*:\s*"([^"]+)"/g);
      if (koreanMatch) {
        for (const m of koreanMatch) {
          const val = m.match(/"korean"\s*:\s*"([^"]+)"/)?.[1];
          if (val) {
            for (const char of val.split(/\s+/)) {
              if (char) learnedChars.add(char);
            }
          }
        }
      }
    }
    const learnedItems = [...learnedChars].map((char) => ({
      char,
      romanization: CHAR_ROMANIZATION[char] ?? null,
    }));

    toolCalls.push({
      toolName: 'give_feedback',
      args: {
        positive: lastWasCorrect,
        message: lastWasCorrect
          ? fb('great_job', explainIn)
          : fb('good_effort', explainIn),
        detail: null,
      },
    });
    toolCalls.push({
      toolName: 'wrap_up',
      args: {
        summary: fb('wrap_summary', explainIn).replace('{ex}', String(exerciseCount)).replace('{correct}', String(correctCount)),
        xpEarned,
        learnedItems,
      },
    });
  }

  // Build AI SDK data stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (let i = 0; i < toolCalls.length; i++) {
        const tc = toolCalls[i];
        const toolCallId = `fallback-${Date.now()}-${i}`;

        const toolCallData = JSON.stringify({
          toolCallId,
          toolName: tc.toolName,
          args: tc.args,
        });
        controller.enqueue(encoder.encode(`9:${toolCallData}\n`));

        if (!tc.pauses) {
          const toolResultData = JSON.stringify({
            toolCallId,
            result: tc.args,
          });
          controller.enqueue(encoder.encode(`a:${toolResultData}\n`));
        }
      }

      const finishData = JSON.stringify({
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0 },
      });
      controller.enqueue(encoder.encode(`d:${finishData}\n`));

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Vercel-AI-Data-Stream': 'v1',
    },
  });
}
