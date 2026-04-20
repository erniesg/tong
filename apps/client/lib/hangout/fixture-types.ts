export type SceneFixture = {
  id: string;
  location: string;
  entryNarration?: string;
  povVariants?: Record<string, POVVariant>;
  seatingRandomized?: boolean;
  beats: Beat[];
  cliffhanger?: CliffhangerSpec;
  resolution: ResolutionSpec;
};

export type Beat = {
  id: string;
  speaker: "dingman" | "shoucheng" | "ayi" | "ambient" | "webtoon";
  intent: string;
  lockedLines?: string[];
  variantExamples?: string[];
  styleRules?: string[];
  expression?: string;
  clarity?: "full" | "fragment";
  translation?: string;
  tongBeat?: TongBeat;
  exerciseHook?: ExerciseHook;
  pairGroup?: string;
  followUp?: string;
};

export type POVVariant = {
  seatDescription: string;
  offscreenVoice?: string;
};

export type TongBeat = {
  trigger: "before" | "after";
  text: string;
  free: boolean;
  vocab?: { zh: string; py: string; en: string }[];
};

export type ExerciseHook = {
  type: string;
  target: string;
  radicalBreakdown?: string;
};

export type AyiLine = {
  zh: string;
  py?: string;
  en?: string;
  expression?: string;
  clarity?: "full" | "fragment";
};

export type CliffhangerSpec = {
  webtoon: WebtoonSpec;
  tongBeat?: TongBeat;
  creditGate?: CreditGate;
};

export type WebtoonSpec = {
  panels: WebtoonPanel[];
  autoAdvance?: boolean;
};

export type WebtoonPanel = {
  id: string;
  imageUrl: string;
  // Three width tiers. No "inset-narrow"/"floating" anymore — those were
  // fake cards. A real inset sits on the theme-surface, not on a black void.
  widthType: "full-bleed" | "full-width" | "inset";
  heightClass: "short" | "standard" | "tall" | "ultra-tall";
  aspectRatio: string;
  shotType: string;
  // Gap before this panel. Either a solid color OR a vertical linear gradient
  // carrying mood from the previous panel into this one.
  gapBefore: WebtoonGap;
  /** Optional border treatment, typically used for inset panels. */
  frame?: WebtoonPanelFrame;
  /** Optional layout overrides for staggered inset compositions. */
  layout?: WebtoonPanelLayout;
  isThumbStop?: boolean;
  bubble?: WebtoonBubble;
  transition: "fade" | "cut" | "darken";
};

export type WebtoonPanelFrame = {
  /** `all` = full frame, `top-bottom` = manga/webtoon-style horizontal rules only. */
  edges: "all" | "top-bottom";
  color?: string;
  widthPx?: number;
  dark?: {
    color?: string;
  };
};

export type WebtoonPanelLayout = {
  align?: "left" | "center" | "right";
  /** Pull the panel upward to create a staggered overlap with the previous panel. */
  liftPx?: number;
  /** Override the rendered width when the default inset width is not enough. */
  widthPct?: number;
  flipX?: boolean;
  /** Force a different visible crop ratio while keeping the source asset. */
  cropAspectRatio?: string;
  /** CSS object-position used when the panel is cropped. */
  cropPosition?: string;
  /** Optional local backdrop behind an inset panel so the surrounding surface blends better. */
  backdropColor?: string;
  darkBackdropColor?: string;
};

export type WebtoonGap = {
  px: number;
  color?: string;
  /** [fromColor, toColor] vertical gradient — fades across the gap. */
  gradient?: [string, string];
  /** Optional overrides when the strip is rendered in dark theme. */
  dark?: {
    color?: string;
    gradient?: [string, string];
  };
};

export type WebtoonBubble = {
  /** Original Chinese with punctuation. */
  zh: string;
  /** Pinyin as one syllable per non-punctuation character, for ruby alignment. */
  py?: string[];
  /** English translation shown below the ruby-annotated hanzi when the bubble is expanded. */
  en?: string;
  speaker: string;
  position: "top" | "bottom" | "center-bottom";
  layout?: WebtoonBubbleLayout;
};

export type WebtoonBubbleLayout = {
  /** Render the balloon partly outside the panel instead of fully inside it. */
  outside?: boolean;
  align?: "left" | "center" | "right";
  offsetXPx?: number;
  offsetYPx?: number;
  tailOffsetPct?: number;
  outsideOverlapPx?: number;
  reserveSpacePx?: number;
  maxWidth?: string;
};

export type CreditGate = {
  cost: number;
  spendPayload: {
    additionalLines?: AyiLine[];
    tongExplanation?: string;
    vocabUnlocks?: string[];
  };
  skipPayload: {
    tongFallback?: string;
  };
};

export type ResolutionSpec = {
  masteryUpdates: { id: string; item: string; firstContact?: boolean }[];
  affinityChanges: { characterId: string; delta: number; note?: string }[];
  stateUpdates?: Record<string, unknown>;
  nextHook?: string;
};
