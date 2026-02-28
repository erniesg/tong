export type MasteryLevel = 'new' | 'seen' | 'learning' | 'familiar' | 'mastered';

export interface ItemMastery {
  itemId: string;          // e.g. "ㄱ", "떡볶이", "N+주세요"
  category: 'script' | 'vocabulary' | 'grammar';
  correct: number;
  incorrect: number;
  lastSeen: number;        // Date.now()
  masteryLevel: MasteryLevel;
}

export interface MasterySnapshot {
  script: { learned: string[]; total: number };
  pronunciation: { accuracy: number; weakSounds: string[] };
  vocabulary: {
    strong: string[];
    weak: string[];
    total: number;
    mastered: number;
  };
  grammar: {
    mastered: string[];
    learning: string[];
    notStarted: string[];
  };
}

export function computeMasteryLevel(
  correct: number,
  total: number,
): MasteryLevel {
  if (total === 0) return 'new';
  const ratio = correct / total;
  if (ratio >= 0.9 && total >= 5) return 'mastered';
  if (ratio >= 0.7 && total >= 3) return 'familiar';
  if (ratio >= 0.4) return 'learning';
  return 'seen';
}
