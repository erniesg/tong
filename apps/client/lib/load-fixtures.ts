import fs from "node:fs/promises";
import path from "node:path";

export type ScriptToken = {
  text: string;
  lemma: string;
  pos: string;
  dictionaryId: string;
};

export type CaptionSegment = {
  startMs: number;
  endMs: number;
  surface: string;
  romanized: string;
  english: string;
  tokens: ScriptToken[];
};

export type CaptionsFixture = {
  videoId: string;
  segments: CaptionSegment[];
};

export type DictionaryFixture = {
  term: string;
  lang: string;
  meaning: string;
  examples: string[];
  crossCjk: {
    zhHans: string;
    ja: string;
  };
  readings: {
    ko: string;
    zhPinyin: string;
    jaRomaji: string;
  };
};

export type VocabFrequencyFixture = {
  windowStartIso: string;
  windowEndIso: string;
  items: Array<{
    lemma: string;
    lang: string;
    count: number;
    sourceCount: number;
  }>;
};

export type MediaTopItem = {
  mediaId: string;
  title: string;
  lang: string;
  minutes: number;
  embedUrl?: string;
};

export type PlayerMediaProfileFixture = {
  userId: string;
  windowDays: number;
  generatedAtIso: string;
  sourceBreakdown: {
    youtube: {
      itemsConsumed: number;
      minutes: number;
      topMedia: MediaTopItem[];
    };
    spotify: {
      itemsConsumed: number;
      minutes: number;
      topMedia: MediaTopItem[];
    };
  };
  learningSignals: {
    topTerms: Array<{
      lemma: string;
      lang: string;
      weightedScore: number;
      dominantSource: "youtube" | "spotify";
    }>;
    clusterAffinities: Array<{
      clusterId: string;
      label: string;
      score: number;
    }>;
  };
};

export type GameLoopFixture = {
  cities: string[];
  locations: string[];
  modes: string[];
  modeUiPolicies: {
    hangout: {
      immersiveFirstPerson: boolean;
      allowOnlyDialogueAndHints: boolean;
    };
    learn: {
      chatStyleByCity: Record<string, string>;
      supportsHistoryView: boolean;
      supportsStartNewSession: boolean;
    };
  };
  currencies: string[];
  unlockRules: {
    hangoutsRequiredForMission: number;
    missionPassRequiredForTierUnlock: boolean;
    spSpendRequiredForLocationUnlock: boolean;
  };
  objectiveRequirements: {
    requiredTargetTypes: string[];
    requiresObjectiveSpecificSessions: boolean;
  };
  advancedRewardFlow: {
    routeCity: string;
    requiresLevelAtLeast: number;
    steps: string[];
  };
};

export type StartOrResumeFixture = {
  sessionId: string;
  city: string;
  sceneId: string;
  profile: {
    nativeLanguage: string;
    targetLanguages: string[];
    proficiency: Record<string, string>;
  };
  progression: {
    xp: number;
    sp: number;
    rp: number;
    currentMasteryLevel: number;
  };
};

export type SceneStep =
  | {
      type: "dialogue";
      speaker: string;
      text: string;
    }
  | {
      type: "exercise";
      exerciseId: string;
      masteryLevel: number;
      successCriteria: string;
    }
  | {
      type: "reward";
      delta: {
        xp: number;
        sp: number;
        rp: number;
      };
    }
  | {
      type: "texting_mission";
      channelStyle: string;
      objective: string;
    }
  | {
      type: "reward_unlock";
      unlock: string;
    };

export type SceneFixture = {
  sceneId: string;
  city: string;
  location: string;
  mode: string;
  objective?: string;
  requires?: {
    masteryLevelAtLeast: number;
    relationshipTierAtLeast: number;
  };
  steps: SceneStep[];
};

export type LearnSessionsFixture = {
  items: Array<{
    learnSessionId: string;
    title: string;
    objectiveId: string;
    city: string;
    lang: string;
    uiTheme: string;
    lastMessageAt: string;
  }>;
};

export type ObjectivesNextFixture = {
  objectiveId: string;
  level: number;
  mode: string;
  coreTargets: {
    vocabulary: string[];
    grammar: string[];
    sentenceStructures: string[];
  };
  personalizedTargets: Array<{
    lemma: string;
    source: string;
  }>;
  completionCriteria: {
    requiredTurns: number;
    requiredAccuracy: number;
  };
};

export type VocabInsightsFixture = {
  clusters: Array<{
    clusterId: string;
    label: string;
    keywords: string[];
    topTerms: string[];
  }>;
  items: Array<{
    lemma: string;
    lang: string;
    score: number;
    frequency: number;
    burst: number;
    clusterId: string;
  }>;
};

export type DemoData = {
  captions: CaptionsFixture;
  dictionary: DictionaryFixture;
  vocabFrequency: VocabFrequencyFixture;
  playerMediaProfile: PlayerMediaProfileFixture;
  gameLoop: GameLoopFixture;
  startOrResume: StartOrResumeFixture;
  sceneFood: SceneFixture;
  sceneShanghaiReward: SceneFixture;
  learnSessions: LearnSessionsFixture;
  objectivesNext: ObjectivesNextFixture;
  vocabInsights: VocabInsightsFixture;
};

const FIXTURE_FILES = {
  captions: "packages/contracts/fixtures/captions.enriched.sample.json",
  dictionary: "packages/contracts/fixtures/dictionary.entry.sample.json",
  vocabFrequency: "packages/contracts/fixtures/vocab.frequency.sample.json",
  playerMediaProfile: "packages/contracts/fixtures/player.media-profile.sample.json",
  gameLoop: "packages/contracts/game-loop.json",
  startOrResume: "packages/contracts/fixtures/game.start-or-resume.sample.json",
  sceneFood: "packages/contracts/fixtures/scene.food-hangout.sample.json",
  sceneShanghaiReward: "packages/contracts/fixtures/scene.shanghai-texting-reward.sample.json",
  learnSessions: "packages/contracts/fixtures/learn.sessions.sample.json",
  objectivesNext: "packages/contracts/fixtures/objectives.next.sample.json",
  vocabInsights: "packages/contracts/fixtures/vocab.insights.sample.json"
} as const;

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveRepoRoot() {
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "..", ".."),
    path.resolve(process.cwd(), "..", "..", "..")
  ];

  for (const candidate of candidates) {
    const fixturesDir = path.join(candidate, "packages", "contracts", "fixtures");
    if (await pathExists(fixturesDir)) {
      return candidate;
    }
  }

  throw new Error("Unable to locate repository root from current working directory.");
}

async function readFixture<T>(repoRoot: string, relativePath: string): Promise<T> {
  const filePath = path.join(repoRoot, relativePath);
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function loadDemoData(): Promise<DemoData> {
  const repoRoot = await resolveRepoRoot();

  const [
    captions,
    dictionary,
    vocabFrequency,
    playerMediaProfile,
    gameLoop,
    startOrResume,
    sceneFood,
    sceneShanghaiReward,
    learnSessions,
    objectivesNext,
    vocabInsights
  ] = await Promise.all([
    readFixture<CaptionsFixture>(repoRoot, FIXTURE_FILES.captions),
    readFixture<DictionaryFixture>(repoRoot, FIXTURE_FILES.dictionary),
    readFixture<VocabFrequencyFixture>(repoRoot, FIXTURE_FILES.vocabFrequency),
    readFixture<PlayerMediaProfileFixture>(repoRoot, FIXTURE_FILES.playerMediaProfile),
    readFixture<GameLoopFixture>(repoRoot, FIXTURE_FILES.gameLoop),
    readFixture<StartOrResumeFixture>(repoRoot, FIXTURE_FILES.startOrResume),
    readFixture<SceneFixture>(repoRoot, FIXTURE_FILES.sceneFood),
    readFixture<SceneFixture>(repoRoot, FIXTURE_FILES.sceneShanghaiReward),
    readFixture<LearnSessionsFixture>(repoRoot, FIXTURE_FILES.learnSessions),
    readFixture<ObjectivesNextFixture>(repoRoot, FIXTURE_FILES.objectivesNext),
    readFixture<VocabInsightsFixture>(repoRoot, FIXTURE_FILES.vocabInsights)
  ]);

  return {
    captions,
    dictionary,
    vocabFrequency,
    playerMediaProfile,
    gameLoop,
    startOrResume,
    sceneFood,
    sceneShanghaiReward,
    learnSessions,
    objectivesNext,
    vocabInsights
  };
}
