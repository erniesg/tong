export const ROADMAP_PROJECT_URL = 'https://github.com/users/erniesg/projects/3';
export const ROADMAP_REPO_URL = 'https://github.com/erniesg/tong';

export type RoadmapExecution = 'agent-ready' | 'human-blocked' | 'validate-first';

export type RoadmapIssue = {
  number: number;
  title: string;
  lane: string;
  priority: 'P0' | 'P1' | 'P2';
  execution: RoadmapExecution;
  blockedBy?: number[];
  note?: string;
};

export type RoadmapPhase = {
  id: string;
  label: string;
  title: string;
  summary: string;
  outcome: string;
  issues: RoadmapIssue[];
};

export const CRITICAL_PATH: number[] = [66, 65, 29, 35, 36, 46, 37, 38, 47, 48];

export const ROADMAP_PHASES: RoadmapPhase[] = [
  {
    id: 'phase-0',
    label: 'Phase 0',
    title: 'Immediate Unblockers',
    summary: 'Remove the avoidable failures that waste local and remote QA cycles.',
    outcome: 'Validation stops failing for infrastructure reasons before product work even starts.',
    issues: [
      {
        number: 66,
        title: '/game returns 404 under next dev but works under next start',
        lane: 'client-runtime',
        priority: 'P0',
        execution: 'validate-first',
        note: 'Fixes the local route that blocks routine QA runs.',
      },
      {
        number: 65,
        title: 'QA platform: preflight issue portability for remote agents',
        lane: 'qa-platform',
        priority: 'P0',
        execution: 'agent-ready',
        note: 'Stops non-portable issues before they reach unattended queues.',
      },
    ],
  },
  {
    id: 'phase-1',
    label: 'Phase 1',
    title: 'Remote-First Foundation',
    summary: 'Make assets, proof, and validation work the same way for humans, local agents, and cloud agents.',
    outcome: 'PRs can carry reviewer-visible proof and runtime assets no longer depend on one laptop.',
    issues: [
      {
        number: 29,
        title: 'Epic: make Tong remote-first and agent-native for assets, QA evidence, and PR publishing',
        lane: 'qa-platform',
        priority: 'P0',
        execution: 'agent-ready',
        note: 'Umbrella for the first real unlock wave.',
      },
      {
        number: 35,
        title: 'Runtime assets: define tong-assets bucket and env contract',
        lane: 'infra-deploy',
        priority: 'P0',
        execution: 'agent-ready',
        note: 'Defines the boundary between runtime assets and published QA evidence.',
      },
      {
        number: 36,
        title: 'Creative assets: publish canonical runtime asset manifest and keys',
        lane: 'runtime-assets',
        priority: 'P0',
        execution: 'agent-ready',
        note: 'Gives runtime and content work stable logical asset keys.',
      },
      {
        number: 46,
        title: 'Build first-class reviewer-proof capture workflow for timing-sensitive UI interactions',
        lane: 'qa-platform',
        priority: 'P0',
        execution: 'agent-ready',
        note: 'Turns local evidence into reviewer-legible proof.',
      },
      {
        number: 37,
        title: 'Client runtime: resolve character assets via manifest with fallbacks',
        lane: 'runtime-assets',
        priority: 'P1',
        execution: 'agent-ready',
        blockedBy: [35, 36],
        note: 'Consumes the asset contract instead of hardcoded file assumptions.',
      },
      {
        number: 38,
        title: 'Validation: fail smoke on unresolved runtime asset references',
        lane: 'qa-platform',
        priority: 'P1',
        execution: 'agent-ready',
        blockedBy: [35, 36, 37],
        note: 'Makes missing assets a pre-merge failure instead of a late playtest surprise.',
      },
    ],
  },
  {
    id: 'phase-2',
    label: 'Phase 2',
    title: 'Progression, Resume, and Checkpoints',
    summary: 'Give players resumable sessions and give QA deterministic near-proof setup points.',
    outcome: 'Players can leave and return cleanly, and agents no longer need full replay loops to validate one transition.',
    issues: [
      {
        number: 47,
        title: 'Epic: resumable sessions, checkpoints, and mission progression',
        lane: 'game-engine',
        priority: 'P0',
        execution: 'agent-ready',
        note: 'Umbrella for persistence, resume, and deterministic QA setup.',
      },
      {
        number: 48,
        title: 'Contracts: define game session, scene session, checkpoint, and scenario seed payloads',
        lane: 'game-engine',
        priority: 'P0',
        execution: 'agent-ready',
        note: 'The contracts-first dependency for the whole progression track.',
      },
      {
        number: 49,
        title: 'Server/game-engine: persist and resume hangout checkpoints',
        lane: 'game-engine',
        priority: 'P1',
        execution: 'agent-ready',
        blockedBy: [48],
      },
      {
        number: 52,
        title: 'Game engine: persist mission gates, unlocks, and reward state across resume',
        lane: 'game-engine',
        priority: 'P1',
        execution: 'agent-ready',
        blockedBy: [48],
      },
      {
        number: 50,
        title: 'Client: return to world map and resume active hangout',
        lane: 'client-runtime',
        priority: 'P1',
        execution: 'agent-ready',
        blockedBy: [48, 49],
      },
      {
        number: 51,
        title: 'QA: deterministic scenario seeds and checkpoint mounts for /game',
        lane: 'qa-platform',
        priority: 'P1',
        execution: 'agent-ready',
        blockedBy: [48, 49],
        note: 'Turns deterministic fallbacks into an official QA primitive instead of ad hoc toggles.',
      },
    ],
  },
  {
    id: 'phase-3',
    label: 'Phase 3',
    title: 'Playtest Polish',
    summary: 'Use the new proof and checkpoint rails to work through player-facing issues with shorter validation loops.',
    outcome: 'Interaction and onboarding polish can be fixed against real routes with less guesswork.',
    issues: [
      {
        number: 31,
        title: 'Block Crush: add first-time hint and ease multi-char cognitive load',
        lane: 'client-runtime',
        priority: 'P1',
        execution: 'agent-ready',
      },
      {
        number: 17,
        title: 'Tap flow: "double tap" to advance — root cause unclear, needs investigation',
        lane: 'client-runtime',
        priority: 'P1',
        execution: 'validate-first',
      },
      {
        number: 19,
        title: 'Dialogue not truly streamed — player sees loading then full text appears at once',
        lane: 'client-runtime',
        priority: 'P1',
        execution: 'validate-first',
      },
      {
        number: 11,
        title: 'Onboarding: clarify language settings + let players pick which languages to learn',
        lane: 'client-ui',
        priority: 'P1',
        execution: 'validate-first',
      },
      {
        number: 14,
        title: 'HUD is hidden — players do not know it exists or what the charge meter means',
        lane: 'client-ui',
        priority: 'P1',
        execution: 'human-blocked',
        note: 'Needs human product/design judgment before blind implementation.',
      },
      {
        number: 12,
        title: 'Hangout: empty space, static backdrop, and Tong whisper discoverability',
        lane: 'client-runtime',
        priority: 'P1',
        execution: 'human-blocked',
        note: 'Still depends on remote-hosted scene assets and product direction.',
      },
      {
        number: 42,
        title: 'Mobile-specific /game validation follow-up',
        lane: 'client-ui',
        priority: 'P1',
        execution: 'human-blocked',
        note: 'Still device-sensitive and not fully portable.',
      },
    ],
  },
  {
    id: 'phase-4',
    label: 'Phase 4',
    title: 'Knowledge Graph',
    summary: 'Turn KG work into a real execution stream instead of an implied side branch.',
    outcome: 'KG-backed objectives become a track across ingestion, API, and game-engine work instead of a ghost lane.',
    issues: [
      {
        number: 53,
        title: 'Epic: KG-backed lessons and hangouts across KO/JA/ZH',
        lane: 'server-ingestion',
        priority: 'P1',
        execution: 'agent-ready',
      },
      {
        number: 54,
        title: 'Contracts/schema for KG-backed objectives and evidence',
        lane: 'server-api',
        priority: 'P1',
        execution: 'agent-ready',
      },
      {
        number: 55,
        title: 'Ingestion/retrieval pipeline for KG-backed objective selection',
        lane: 'server-ingestion',
        priority: 'P1',
        execution: 'agent-ready',
        blockedBy: [54],
      },
      {
        number: 56,
        title: 'API/bootstrap wiring for KG-backed lessons and hangouts',
        lane: 'server-api',
        priority: 'P1',
        execution: 'agent-ready',
        blockedBy: [54, 55],
      },
      {
        number: 57,
        title: 'Game-engine session generation from KG-backed objectives',
        lane: 'game-engine',
        priority: 'P1',
        execution: 'agent-ready',
        blockedBy: [54, 55, 56],
      },
      {
        number: 58,
        title: 'KO pilot rollout for KG-backed lessons and hangouts',
        lane: 'game-engine',
        priority: 'P2',
        execution: 'agent-ready',
        blockedBy: [54, 55, 56, 57],
      },
      {
        number: 59,
        title: 'JA/ZH expansion for KG-backed lessons and hangouts',
        lane: 'game-engine',
        priority: 'P2',
        execution: 'agent-ready',
        blockedBy: [58],
      },
    ],
  },
  {
    id: 'phase-5',
    label: 'Phase 5',
    title: 'Starter World Content',
    summary: 'Define the pack structure and the human-generated starter cast before pretending city packs can run unattended.',
    outcome: 'World-content work stops hiding the real character-media dependency and becomes easier to schedule honestly.',
    issues: [
      {
        number: 60,
        title: 'Epic: starter world content for Seoul/Tokyo/Shanghai',
        lane: 'creative-assets',
        priority: 'P1',
        execution: 'human-blocked',
      },
      {
        number: 61,
        title: 'Content template for city/location/character starter packs',
        lane: 'creative-assets',
        priority: 'P1',
        execution: 'agent-ready',
      },
      {
        number: 69,
        title: 'Creative assets: define starter cast roster and required per-character asset bundle',
        lane: 'creative-assets',
        priority: 'P1',
        execution: 'human-blocked',
        note: 'This is the explicit Haeun-style media blocker for the city packs.',
      },
      {
        number: 62,
        title: 'Seoul starter pack',
        lane: 'creative-assets',
        priority: 'P1',
        execution: 'human-blocked',
        blockedBy: [61, 69],
      },
      {
        number: 63,
        title: 'Tokyo starter pack',
        lane: 'creative-assets',
        priority: 'P1',
        execution: 'human-blocked',
        blockedBy: [61, 69],
      },
      {
        number: 64,
        title: 'Shanghai starter pack',
        lane: 'creative-assets',
        priority: 'P1',
        execution: 'human-blocked',
        blockedBy: [61, 69],
      },
    ],
  },
];

export function issueUrl(number: number) {
  return `${ROADMAP_REPO_URL}/issues/${number}`;
}
