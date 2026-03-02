/**
 * King Sejong's Hangul design system as structured data.
 * The AI can reference these principles when teaching to explain
 * WHY characters look and sound the way they do.
 */

export interface DesignPrinciple {
  id: string;
  title: string;
  description: string;
  examples: Array<{ chars: string; explanation: string }>;
  teachingHook: string; // memorable way to introduce this principle
}

export const HANGUL_DESIGN_PRINCIPLES: DesignPrinciple[] = [
  {
    id: 'consonant-organ-shapes',
    title: 'Consonants mirror the mouth',
    description: 'Each basic consonant shape represents the speech organ used to make that sound.',
    examples: [
      { chars: 'ㄱ', explanation: 'Tongue touching the back of the mouth (velum) — looks like a tongue curving up' },
      { chars: 'ㄴ', explanation: 'Tongue touching the ridge behind the teeth — looks like a tongue pointing up' },
      { chars: 'ㅁ', explanation: 'Lips pressed together — looks like a mouth (square shape)' },
      { chars: 'ㅅ', explanation: 'Shape of a tooth — the sound passes through the teeth' },
      { chars: 'ㅇ', explanation: 'Open throat — round circle means open/nothing (silent as initial)' },
    ],
    teachingHook: 'Hangul consonants are literally pictures of your mouth! ㅁ looks like lips, ㄴ looks like your tongue.',
  },
  {
    id: 'aspiration-series',
    title: 'Add a stroke = more breath',
    description: 'Aspirated consonants add an extra stroke to the basic form, representing stronger breath.',
    examples: [
      { chars: 'ㄱ→ㅋ', explanation: 'g/k → kh — one extra stroke = more air' },
      { chars: 'ㄷ→ㅌ', explanation: 'd/t → th — one extra stroke = more air' },
      { chars: 'ㅂ→ㅍ', explanation: 'b/p → ph — one extra stroke = more air' },
      { chars: 'ㅈ→ㅊ', explanation: 'j → ch — one extra stroke = more air' },
    ],
    teachingHook: 'Think of the extra stroke as a puff of air escaping! ㄱ(g) + air = ㅋ(k).',
  },
  {
    id: 'tensed-doubles',
    title: 'Double = tense/strong',
    description: 'Doubling a consonant makes it tense (no aspiration, but stronger and sharper).',
    examples: [
      { chars: 'ㄱ→ㄲ', explanation: 'g → kk (tense)' },
      { chars: 'ㄷ→ㄸ', explanation: 'd → tt (tense)' },
      { chars: 'ㅂ→ㅃ', explanation: 'b → pp (tense)' },
      { chars: 'ㅅ→ㅆ', explanation: 's → ss (tense)' },
      { chars: 'ㅈ→ㅉ', explanation: 'j → jj (tense)' },
    ],
    teachingHook: 'Doubles are like clenching — tight throat, sharp sound. Say "appa" (아빠 = dad) and feel the tension!',
  },
  {
    id: 'vowel-cosmic-elements',
    title: 'Vowels come from heaven, earth, and human',
    description: 'The three basic vowel elements: ㆍ (dot = heaven/sun), ㅡ (horizontal = earth), ㅣ (vertical = human standing).',
    examples: [
      { chars: 'ㅏ', explanation: 'ㅣ + dot right = "a" — bright vowel (yang), sun is to the east/right' },
      { chars: 'ㅓ', explanation: 'ㅣ + dot left = "eo" — dark vowel (yin), sun has set/left' },
      { chars: 'ㅗ', explanation: 'ㅡ + dot above = "o" — bright vowel (yang), sun is above' },
      { chars: 'ㅜ', explanation: 'ㅡ + dot below = "u" — dark vowel (yin), sun is below' },
    ],
    teachingHook: 'Korean vowels encode yin and yang! ㅏ(bright/open) ↔ ㅓ(dark/closed) are mirror images.',
  },
  {
    id: 'y-glide-double-dot',
    title: 'Double the dot = add "y"',
    description: 'Adding a second dot (or stroke) to a vowel adds a "y" glide at the beginning.',
    examples: [
      { chars: 'ㅏ→ㅑ', explanation: 'a → ya (add y-glide)' },
      { chars: 'ㅓ→ㅕ', explanation: 'eo → yeo (add y-glide)' },
      { chars: 'ㅗ→ㅛ', explanation: 'o → yo (add y-glide)' },
      { chars: 'ㅜ→ㅠ', explanation: 'u → yu (add y-glide)' },
    ],
    teachingHook: 'One stroke = simple vowel. Two strokes = "y" + vowel. ㅏ(a) → ㅑ(ya), ㅗ(o) → ㅛ(yo).',
  },
  {
    id: 'syllable-blocks',
    title: 'Characters stack into blocks',
    description: 'Korean is written in syllable blocks: initial consonant + vowel (+ optional final consonant).',
    examples: [
      { chars: 'ㄱ+ㅏ=가', explanation: 'C+V → 2-part block (ga)' },
      { chars: 'ㅎ+ㅏ+ㄴ=한', explanation: 'C+V+C → 3-part block (han)' },
      { chars: 'ㄱ+ㅡ+ㄹ=글', explanation: 'C+V+C → 3-part block (geul) — as in 한글 (hangul)' },
    ],
    teachingHook: 'Each Korean "letter" is actually a mini puzzle — consonant + vowel stacked together. 한 = ㅎ+ㅏ+ㄴ.',
  },
];

/**
 * Look up a design principle by ID.
 */
export function getPrinciple(id: string): DesignPrinciple | undefined {
  return HANGUL_DESIGN_PRINCIPLES.find((p) => p.id === id);
}

/**
 * Get principles relevant to a set of characters.
 */
export function getPrinciplesForChars(chars: string[]): DesignPrinciple[] {
  return HANGUL_DESIGN_PRINCIPLES.filter((p) =>
    p.examples.some((ex) =>
      chars.some((c) => ex.chars.includes(c)),
    ),
  );
}
