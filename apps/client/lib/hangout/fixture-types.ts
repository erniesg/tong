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
  widthType: "full-bleed" | "full-width" | "inset-wide" | "inset-narrow" | "floating";
  heightClass: "short" | "standard" | "tall" | "ultra-tall";
  aspectRatio: string;
  shotType: string;
  gapBefore: { px: number; color: string };
  isThumbStop?: boolean;
  bubble?: WebtoonBubble;
  transition: "fade" | "cut" | "darken";
};

export type WebtoonBubble = {
  zh: string;
  py?: string;
  en?: string;
  speaker: string;
  position: "top" | "bottom" | "center-bottom";
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
