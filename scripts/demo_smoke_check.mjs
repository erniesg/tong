import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const clientRoot = path.join(root, "apps/client");
const clientPublicRoot = path.join(clientRoot, "public");
const runtimeSourceRoots = [
  path.join(clientRoot, "app"),
  path.join(clientRoot, "components"),
  path.join(clientRoot, "lib"),
];
const runtimeSourceFileExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const clientAssetRefPattern = /\/assets\/[A-Za-z0-9_./-]+\.(?:png|jpg|jpeg|webp|svg|mp4|webm)/g;
const runtimeAssetKeyCallPattern = /\bruntimeAssetUrl\(\s*['"]([^'"]+)['"]\s*(?:,|\))/g;

function walkFiles(dir, files = [], allowedExtensions = runtimeSourceFileExtensions) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".turbo") {
        continue;
      }
      if (fullPath === path.join(clientPublicRoot, "assets")) {
        continue;
      }
      walkFiles(fullPath, files, allowedExtensions);
      continue;
    }

    if (allowedExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function collectClientRuntimeAssetUsage() {
  const directRefsByFile = new Map();
  const manifestKeys = new Set();

  for (const dir of runtimeSourceRoots) {
    for (const file of walkFiles(dir, [], runtimeSourceFileExtensions)) {
      const contents = fs.readFileSync(file, "utf8");
      const directMatches = [...new Set(contents.match(clientAssetRefPattern) ?? [])];
      if (directMatches.length > 0) {
        directRefsByFile.set(file, directMatches);
      }

      for (const match of contents.matchAll(runtimeAssetKeyCallPattern)) {
        manifestKeys.add(match[1]);
      }
    }
  }

  return {
    directRefsByFile,
    manifestKeys: [...manifestKeys].sort(),
  };
}

function resolveManifestUri(uri) {
  if (uri.startsWith("/assets/")) {
    return path.join(clientPublicRoot, uri.slice(1));
  }
  return path.join(root, uri);
}

const starterPackDir = path.join(root, "assets/content-packs");
const starterPackFiles = fs.readdirSync(starterPackDir)
  .filter((fileName) => fileName.endsWith(".starter.json"))
  .sort()
  .map((fileName) => path.join("assets/content-packs", fileName));

const requiredFiles = [
  "packages/contracts/api-contract.md",
  "packages/contracts/game-loop.json",
  "packages/contracts/objective-catalog.sample.json",
  "packages/contracts/objective-identity-map.sample.json",
  "packages/contracts/world-map-registry.sample.json",
  "packages/contracts/fixtures/captions.enriched.sample.json",
  "packages/contracts/fixtures/dictionary.entry.sample.json",
  "packages/contracts/fixtures/vocab.frequency.sample.json",
  "packages/contracts/fixtures/vocab.insights.sample.json",
  "packages/contracts/fixtures/planner.lesson-context.sample.json",
  "packages/contracts/fixtures/player.media-profile.sample.json",
  "packages/contracts/fixtures/game.start-or-resume.sample.json",
  "packages/contracts/fixtures/game.session.sample.json",
  "packages/contracts/fixtures/scene.session.sample.json",
  "packages/contracts/fixtures/checkpoint.player-resume.sample.json",
  "packages/contracts/fixtures/scenario.seed.review-ready.sample.json",
  "packages/contracts/fixtures/objectives.next.sample.json",
  "packages/contracts/fixtures/learn.sessions.sample.json",
  "packages/contracts/fixtures/scene.food-hangout.sample.json",
  "packages/contracts/fixtures/scene.shanghai-texting-reward.sample.json",
  "packages/contracts/fixtures/media.events.sample.json",
  "packages/contracts/fixtures/tools.list.sample.json",
  "packages/contracts/fixtures/tools.invoke.sample.json",
  "packages/contracts/fixtures/demo.secret-status.sample.json",
  "assets/manifest/runtime-asset-manifest.json",
  "assets/manifest/canonical-asset-manifest.json",
  "assets/manifest/starter-cast-registry.json",
  ...starterPackFiles,
  "assets/rewards/shanghai-reward-bundle.placeholder.json"
];

const missing = requiredFiles.filter((rel) => !fs.existsSync(path.join(root, rel)));
if (missing.length > 0) {
  console.error("Missing required files:");
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

const jsonFiles = requiredFiles.filter((f) => f.endsWith(".json"));
for (const rel of jsonFiles) {
  const full = path.join(root, rel);
  try {
    JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (err) {
    console.error(`Invalid JSON in ${rel}`);
    console.error(String(err));
    process.exit(1);
  }
}

const loop = JSON.parse(
  fs.readFileSync(path.join(root, "packages/contracts/game-loop.json"), "utf8")
);
const objectivesCatalog = JSON.parse(
  fs.readFileSync(path.join(root, "packages/contracts/objective-catalog.sample.json"), "utf8")
);
const worldMapRegistry = JSON.parse(
  fs.readFileSync(path.join(root, "packages/contracts/world-map-registry.sample.json"), "utf8")
);
const vocabInsights = JSON.parse(
  fs.readFileSync(path.join(root, "packages/contracts/fixtures/vocab.insights.sample.json"), "utf8")
);
const plannerContext = JSON.parse(
  fs.readFileSync(
    path.join(root, "packages/contracts/fixtures/planner.lesson-context.sample.json"),
    "utf8"
  )
);
const playerMediaProfile = JSON.parse(
  fs.readFileSync(
    path.join(root, "packages/contracts/fixtures/player.media-profile.sample.json"),
    "utf8"
  )
);
const demoSecretStatus = JSON.parse(
  fs.readFileSync(
    path.join(root, "packages/contracts/fixtures/demo.secret-status.sample.json"),
    "utf8"
  )
);
const mediaEvents = JSON.parse(
  fs.readFileSync(
    path.join(root, "packages/contracts/fixtures/media.events.sample.json"),
    "utf8"
  )
);
const gameStart = JSON.parse(
  fs.readFileSync(
    path.join(root, "packages/contracts/fixtures/game.start-or-resume.sample.json"),
    "utf8"
  )
);
const gameSession = JSON.parse(
  fs.readFileSync(
    path.join(root, "packages/contracts/fixtures/game.session.sample.json"),
    "utf8"
  )
);
const sceneSession = JSON.parse(
  fs.readFileSync(
    path.join(root, "packages/contracts/fixtures/scene.session.sample.json"),
    "utf8"
  )
);
const playerCheckpoint = JSON.parse(
  fs.readFileSync(
    path.join(root, "packages/contracts/fixtures/checkpoint.player-resume.sample.json"),
    "utf8"
  )
);
const scenarioSeed = JSON.parse(
  fs.readFileSync(
    path.join(root, "packages/contracts/fixtures/scenario.seed.review-ready.sample.json"),
    "utf8"
  )
);

const runtimeAssetManifest = JSON.parse(
  fs.readFileSync(
    path.join(root, "assets/manifest/runtime-asset-manifest.json"),
    "utf8"
  )
);
const canonicalAssetManifest = JSON.parse(
  fs.readFileSync(
    path.join(root, "assets/manifest/canonical-asset-manifest.json"),
    "utf8"
  )
);
const starterCastRegistry = JSON.parse(
  fs.readFileSync(
    path.join(root, "assets/manifest/starter-cast-registry.json"),
    "utf8"
  )
);
const starterPacks = starterPackFiles.map((relPath) =>
  JSON.parse(fs.readFileSync(path.join(root, relPath), "utf8"))
);
const seoulStarterPack = starterPacks.find(
  (pack) => pack.city === "seoul" && pack.mapLocationId === "food_street"
);
const shanghaiRewardBundle = JSON.parse(
  fs.readFileSync(
    path.join(root, "assets/rewards/shanghai-reward-bundle.placeholder.json"),
    "utf8"
  )
);
const clientRuntimeAssetUsage = collectClientRuntimeAssetUsage();

function assertRouteState(route, label) {
  if (!route || typeof route.pathname !== "string" || route.pathname.length === 0) {
    console.error(`${label} missing route.pathname`);
    process.exit(1);
  }
  if (route.query !== undefined && (typeof route.query !== "object" || Array.isArray(route.query))) {
    console.error(`${label} route.query must be an object when present`);
    process.exit(1);
  }
}

function assertObjectiveDescriptor(objective, label) {
  if (!objective || typeof objective.objectiveId !== "string" || objective.objectiveId.length === 0) {
    console.error(`${label} missing objectiveId`);
    process.exit(1);
  }
  if (objective.canonicalObjectiveId !== undefined && objective.objectiveId !== objective.canonicalObjectiveId) {
    console.error(`${label} objectiveId must equal canonicalObjectiveId when provided`);
    process.exit(1);
  }
  if (objective.legacyObjectiveId !== undefined && typeof objective.legacyObjectiveId !== "string") {
    console.error(`${label} legacyObjectiveId must be a string when present`);
    process.exit(1);
  }
  if (objective.objectiveAliasIds !== undefined && !Array.isArray(objective.objectiveAliasIds)) {
    console.error(`${label} objectiveAliasIds must be an array when present`);
    process.exit(1);
  }
  if (!["ko", "ja", "zh"].includes(objective.lang)) {
    console.error(`${label} has invalid lang`);
    process.exit(1);
  }
  if (!["hangout", "learn"].includes(objective.mode)) {
    console.error(`${label} has invalid mode`);
    process.exit(1);
  }
  if (!["seoul", "tokyo", "shanghai"].includes(objective.cityId)) {
    console.error(`${label} has invalid cityId`);
    process.exit(1);
  }
  if (objective.targetNodeIds !== undefined && !Array.isArray(objective.targetNodeIds)) {
    console.error(`${label} targetNodeIds must be an array when present`);
    process.exit(1);
  }
  if (objective.objectiveNodeId !== undefined && objective.objectiveNodeId !== `objective:${objective.objectiveId}`) {
    console.error(`${label} objectiveNodeId must wrap the canonical objectiveId`);
    process.exit(1);
  }
}

function assertMissionGate(gate, label) {
  if (!gate || typeof gate.readiness !== "number") {
    console.error(`${label} missing readiness`);
    process.exit(1);
  }
  if (typeof gate.validatedHangouts !== "number") {
    console.error(`${label} missing validatedHangouts`);
    process.exit(1);
  }
  if (typeof gate.missionAssessmentUnlocked !== "boolean") {
    console.error(`${label} missing missionAssessmentUnlocked`);
    process.exit(1);
  }
  if (typeof gate.masteryTier !== "number") {
    console.error(`${label} missing masteryTier`);
    process.exit(1);
  }
}

function assertUnlockSnapshot(unlocks, label) {
  if (!unlocks || !Array.isArray(unlocks.locationIds) || !Array.isArray(unlocks.missionIds) || !Array.isArray(unlocks.rewardIds)) {
    console.error(`${label} unlock snapshot is incomplete`);
    process.exit(1);
  }
}

function assertRngState(rng, label) {
  if (!rng || typeof rng.seed !== "string" || rng.seed.length === 0) {
    console.error(`${label} missing rng.seed`);
    process.exit(1);
  }
  if (!Number.isInteger(rng.version) || rng.version < 1) {
    console.error(`${label} missing valid rng.version`);
    process.exit(1);
  }
}

function assertProgressionDelta(delta, label) {
  if (!delta || typeof delta.xp !== "number" || typeof delta.sp !== "number" || typeof delta.rp !== "number") {
    console.error(`${label} missing xp/sp/rp`);
    process.exit(1);
  }
}

if (!Array.isArray(loop.cities) || loop.cities.length !== 3) {
  console.error("Expected exactly 3 cities in game-loop.json");
  process.exit(1);
}

if (!Array.isArray(loop.locations) || loop.locations.length !== 5) {
  console.error("Expected exactly 5 shared locations in game-loop.json");
  process.exit(1);
}

if (!Array.isArray(loop.masteryLevels) || loop.masteryLevels.length !== 7) {
  console.error("Expected exactly 7 mastery levels in game-loop.json");
  process.exit(1);
}

if (
  !loop.objectiveRequirements ||
  !Array.isArray(loop.objectiveRequirements.requiredTargetTypes)
) {
  console.error("Missing objectiveRequirements.requiredTargetTypes in game-loop.json");
  process.exit(1);
}

const requiredTargetTypes = ["vocabulary", "grammar", "sentenceStructures"];
for (const t of requiredTargetTypes) {
  if (!loop.objectiveRequirements.requiredTargetTypes.includes(t)) {
    console.error(`Missing required target type '${t}' in game-loop.json`);
    process.exit(1);
  }
}

if (!Array.isArray(objectivesCatalog.objectives) || objectivesCatalog.objectives.length === 0) {
  console.error("Expected at least one objective in objective-catalog.sample.json");
  process.exit(1);
}

for (const objective of objectivesCatalog.objectives) {
  if (!objective.coreTargets) {
    console.error(`Objective ${objective.objectiveId ?? "<unknown>"} missing coreTargets`);
    process.exit(1);
  }

  for (const field of requiredTargetTypes) {
    if (!Array.isArray(objective.coreTargets[field]) || objective.coreTargets[field].length === 0) {
      console.error(
        `Objective ${objective.objectiveId ?? "<unknown>"} missing non-empty coreTargets.${field}`
      );
      process.exit(1);
    }
  }
}

if (!Array.isArray(vocabInsights.clusters) || vocabInsights.clusters.length === 0) {
  console.error("Expected non-empty clusters in vocab.insights.sample.json");
  process.exit(1);
}

if (!Array.isArray(vocabInsights.items) || vocabInsights.items.length === 0) {
  console.error("Expected non-empty items in vocab.insights.sample.json");
  process.exit(1);
}

for (const item of vocabInsights.items) {
  if (typeof item.score !== "number") {
    console.error(`Vocab insight item ${item.lemma ?? "<unknown>"} missing numeric score`);
    process.exit(1);
  }

  if (!Array.isArray(item.objectiveLinks) || item.objectiveLinks.length === 0) {
    console.error(`Vocab insight item ${item.lemma ?? "<unknown>"} missing objectiveLinks`);
    process.exit(1);
  }

  if (!Array.isArray(item.placementHints) || item.placementHints.length === 0) {
    console.error(`Vocab insight item ${item.lemma ?? "<unknown>"} missing placementHints`);
    process.exit(1);
  }

  if (!Array.isArray(item.provenance?.samples) || item.provenance.samples.length === 0) {
    console.error(`Vocab insight item ${item.lemma ?? "<unknown>"} missing provenance.samples`);
    process.exit(1);
  }
}

if (!plannerContext.sourceBreakdown || !plannerContext.topicModel) {
  console.error("Expected sourceBreakdown + topicModel in planner.lesson-context sample");
  process.exit(1);
}

if (!Array.isArray(plannerContext.topTerms) || plannerContext.topTerms.length === 0) {
  console.error("Expected non-empty topTerms in planner.lesson-context sample");
  process.exit(1);
}

if (
  !plannerContext.plannerInput ||
  !Array.isArray(plannerContext.plannerInput.objectiveCandidates) ||
  plannerContext.plannerInput.objectiveCandidates.length === 0
) {
  console.error("Expected plannerInput.objectiveCandidates in planner.lesson-context sample");
  process.exit(1);
}

if (
  !Array.isArray(plannerContext.plannerInput.placementCandidates) ||
  plannerContext.plannerInput.placementCandidates.length === 0
) {
  console.error("Expected plannerInput.placementCandidates in planner.lesson-context sample");
  process.exit(1);
}

if (!Array.isArray(plannerContext.topTerms[0]?.provenance?.samples) || plannerContext.topTerms[0].provenance.samples.length === 0) {
  console.error("Expected topTerms[0].provenance.samples in planner.lesson-context sample");
  process.exit(1);
}

if (!playerMediaProfile.sourceBreakdown) {
  console.error("Expected sourceBreakdown in player.media-profile.sample.json");
  process.exit(1);
}

if (
  !Array.isArray(playerMediaProfile.learningSignals?.placementCandidates) ||
  playerMediaProfile.learningSignals.placementCandidates.length === 0
) {
  console.error("Expected learningSignals.placementCandidates in player.media-profile sample");
  process.exit(1);
}

for (const source of ["youtube", "spotify"]) {
  const sourceStats = playerMediaProfile.sourceBreakdown[source];
  if (!sourceStats) {
    console.error(`Missing sourceBreakdown.${source} in player.media-profile sample`);
    process.exit(1);
  }

  if (typeof sourceStats.minutes !== "number") {
    console.error(`Expected numeric sourceBreakdown.${source}.minutes`);
    process.exit(1);
  }

  if (!Array.isArray(sourceStats.topMedia)) {
    console.error(`Expected array sourceBreakdown.${source}.topMedia`);
    process.exit(1);
  }
}

if (!playerMediaProfile.learningSignals || !Array.isArray(playerMediaProfile.learningSignals.topTerms)) {
  console.error("Expected learningSignals.topTerms in player.media-profile sample");
  process.exit(1);
}

if (!Array.isArray(mediaEvents.events) || mediaEvents.events.length === 0) {
  console.error("Expected non-empty events array in media.events.sample.json");
  process.exit(1);
}

if (typeof gameStart.sessionId !== "string" || gameStart.sessionId.length === 0) {
  console.error("Expected sessionId in game.start-or-resume.sample.json");
  process.exit(1);
}

if (!["seoul", "tokyo", "shanghai"].includes(gameStart.city)) {
  console.error("Expected valid city in game.start-or-resume.sample.json");
  process.exit(1);
}

if (!["food_street", "cafe", "convenience_store", "subway_hub", "practice_studio"].includes(gameStart.location)) {
  console.error("Expected valid location in game.start-or-resume.sample.json");
  process.exit(1);
}

if (!["hangout", "learn"].includes(gameStart.mode)) {
  console.error("Expected valid mode in game.start-or-resume.sample.json");
  process.exit(1);
}

if (!gameStart.profile || !gameStart.profile.proficiency) {
  console.error("Expected profile in game.start-or-resume.sample.json");
  process.exit(1);
}

if (!gameStart.progression || typeof gameStart.progression.currentMasteryLevel !== "number") {
  console.error("Expected progression.currentMasteryLevel in game.start-or-resume.sample.json");
  process.exit(1);
}

if (!Array.isArray(gameStart.actions) || gameStart.actions.length === 0) {
  console.error("Expected non-empty actions in game.start-or-resume.sample.json");
  process.exit(1);
}

if (!["new_session", "checkpoint", "scenario_seed"].includes(gameStart.resumeSource)) {
  console.error("Expected valid resumeSource in game.start-or-resume.sample.json");
  process.exit(1);
}

if (!gameStart.gameSession || gameStart.gameSession.sessionId !== gameStart.sessionId) {
  console.error("game.start-or-resume sample must embed matching gameSession");
  process.exit(1);
}

if (!gameStart.sceneSession || gameStart.sceneSession.gameSessionId !== gameStart.sessionId) {
  console.error("game.start-or-resume sample must embed matching sceneSession");
  process.exit(1);
}

if (!gameStart.activeCheckpoint || gameStart.activeCheckpoint.gameSessionId !== gameStart.sessionId) {
  console.error("game.start-or-resume sample must embed matching activeCheckpoint");
  process.exit(1);
}

if (!Array.isArray(gameStart.availableScenarioSeeds) || gameStart.availableScenarioSeeds.length === 0) {
  console.error("Expected availableScenarioSeeds in game.start-or-resume.sample.json");
  process.exit(1);
}

if (!gameStart.availableScenarioSeeds.every((seed) => seed.qaOnly === true)) {
  console.error("Scenario seeds must be explicitly qaOnly=true");
  process.exit(1);
}

if (gameSession.sessionId !== gameStart.gameSession.sessionId) {
  console.error("game.session sample should align with embedded gameSession");
  process.exit(1);
}

assertObjectiveDescriptor(gameSession.activeObjective, "game.session.activeObjective");
assertMissionGate(gameSession.missionGate, "game.session.missionGate");
assertUnlockSnapshot(gameSession.unlocks, "game.session.unlocks");

if (!Array.isArray(gameSession.availableActions) || gameSession.availableActions.length === 0) {
  console.error("game.session.availableActions should not be empty");
  process.exit(1);
}

if (sceneSession.gameSessionId !== gameSession.sessionId) {
  console.error("scene.session sample should point at the matching game session");
  process.exit(1);
}

assertObjectiveDescriptor(sceneSession.objective, "scene.session.objective");
assertRouteState(sceneSession.route, "scene.session");
assertProgressionDelta(sceneSession.progressionDelta, "scene.session.progressionDelta");

if (typeof sceneSession.checkpointable !== "boolean") {
  console.error("scene.session.checkpointable must be boolean");
  process.exit(1);
}

if (!sceneSession.uiPolicy || sceneSession.uiPolicy.allowOnlyDialogueAndHints !== true) {
  console.error("scene.session uiPolicy should preserve immersive hangout constraints");
  process.exit(1);
}

if (playerCheckpoint.kind !== "player_resume") {
  console.error("checkpoint sample must use kind=player_resume");
  process.exit(1);
}

assertRouteState(playerCheckpoint.route, "checkpoint.player-resume");
assertObjectiveDescriptor(playerCheckpoint.objective, "checkpoint.player-resume.objective");
assertProgressionDelta(playerCheckpoint.progressionDelta, "checkpoint.player-resume.progressionDelta");
assertMissionGate(playerCheckpoint.missionGate, "checkpoint.player-resume.missionGate");
assertUnlockSnapshot(playerCheckpoint.unlocks, "checkpoint.player-resume.unlocks");
assertRngState(playerCheckpoint.rng, "checkpoint.player-resume");

if (!playerCheckpoint.activeExercise || typeof playerCheckpoint.activeExercise.exerciseId !== "string") {
  console.error("checkpoint.player-resume must include activeExercise state");
  process.exit(1);
}

if (scenarioSeed.qaOnly !== true) {
  console.error("scenario.seed sample must be qaOnly=true");
  process.exit(1);
}

assertRouteState(scenarioSeed.route, "scenario.seed.review-ready");
assertObjectiveDescriptor(scenarioSeed.objective, "scenario.seed.review-ready.objective");
assertRngState(scenarioSeed.rng, "scenario.seed.review-ready");

if (!["qa", "demo", "dev"].includes(scenarioSeed.source)) {
  console.error("scenario.seed sample must declare source=qa|demo|dev");
  process.exit(1);
}

if (!scenarioSeed.activeExercise || typeof scenarioSeed.activeExercise.exerciseType !== "string") {
  console.error("scenario.seed sample must include deterministic activeExercise state");
  process.exit(1);
}


if (!Array.isArray(runtimeAssetManifest.assets) || runtimeAssetManifest.assets.length === 0) {
  console.error("Expected non-empty assets array in runtime asset manifest");
  process.exit(1);
}

if (!Array.isArray(canonicalAssetManifest.assets) || canonicalAssetManifest.assets.length === 0) {
  console.error("Expected non-empty assets array in canonical asset manifest");
  process.exit(1);
}

if (runtimeAssetManifest.keyFormat !== "domain.scope.name.variant") {
  console.error("Unexpected keyFormat in runtime asset manifest");
  process.exit(1);
}

const runtimeKeys = runtimeAssetManifest.assets.map((asset) => asset.key);
const canonicalKeys = (canonicalAssetManifest.assets ?? []).map((asset) => asset.key);
const runtimeAssetsByKey = new Map(runtimeAssetManifest.assets.map((asset) => [asset.key, asset]));

if (canonicalAssetManifest.keyFormat !== "domain.scope.name.variant") {
  console.error("Unexpected keyFormat in canonical asset manifest");
  process.exit(1);
}

if (runtimeAssetManifest.sourceManifest !== "assets/manifest/canonical-asset-manifest.json") {
  console.error("runtime asset manifest must declare sourceManifest=assets/manifest/canonical-asset-manifest.json");
  process.exit(1);
}

if (runtimeKeys.length !== canonicalKeys.length) {
  console.error("Runtime manifest and canonical manifest key counts do not match");
  process.exit(1);
}

for (const key of canonicalKeys) {
  if (!runtimeKeys.includes(key)) {
    console.error(`Runtime manifest missing canonical key: ${key}`);
    process.exit(1);
  }

  const canonicalAsset = canonicalAssetManifest.assets.find((asset) => asset.key === key);
  const runtimeAsset = runtimeAssetsByKey.get(key);
  if (!canonicalAsset || !runtimeAsset) {
    console.error(`Asset key ${key} missing in canonical/runtime manifest lookup`);
    process.exit(1);
  }

  for (const field of ["type", "usage", "source", "status", "uri"]) {
    if (canonicalAsset[field] !== runtimeAsset[field]) {
      console.error(`Canonical/runtime manifest mismatch for ${key} field ${field}`);
      process.exit(1);
    }
  }
}

const keyRegex = /^[a-z0-9_]+(\.[a-z0-9_-]+){3,}$/;
const seenKeys = new Set();
for (const asset of runtimeAssetManifest.assets) {
  if (typeof asset.key !== "string" || !keyRegex.test(asset.key)) {
    console.error(`Invalid runtime asset key format: ${asset?.key ?? "<missing>"}`);
    process.exit(1);
  }
  if (seenKeys.has(asset.key)) {
    console.error(`Duplicate runtime asset key: ${asset.key}`);
    process.exit(1);
  }
  seenKeys.add(asset.key);

  if (typeof asset.uri !== "string" || asset.uri.length === 0) {
    console.error(`Runtime asset key ${asset.key} missing uri`);
    process.exit(1);
  }

  const resolvedPath = resolveManifestUri(asset.uri);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Runtime asset key ${asset.key} points to missing file: ${asset.uri}`);
    process.exit(1);
  }
}

for (const asset of canonicalAssetManifest.assets) {
  const resolvedPath = resolveManifestUri(asset.uri);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Canonical asset key ${asset.key} points to missing file: ${asset.uri}`);
    process.exit(1);
  }
}

if (clientRuntimeAssetUsage.directRefsByFile.size > 0) {
  console.error("Client runtime still contains direct /assets/... references:");
  for (const [file, refs] of clientRuntimeAssetUsage.directRefsByFile.entries()) {
    console.error(`- ${path.relative(root, file)}`);
    for (const ref of refs) {
      console.error(`  - ${ref}`);
    }
  }
  process.exit(1);
}

if (clientRuntimeAssetUsage.manifestKeys.length === 0) {
  console.error("Expected client runtime to resolve at least one asset via runtimeAssetUrl()");
  process.exit(1);
}

for (const key of clientRuntimeAssetUsage.manifestKeys) {
  const runtimeAsset = runtimeAssetsByKey.get(key);
  if (!runtimeAsset) {
    console.error(`Client runtime asset key missing from manifest: ${key}`);
    process.exit(1);
  }

  const resolvedPath = resolveManifestUri(runtimeAsset.uri);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Client runtime asset key ${key} points to missing file: ${runtimeAsset.uri}`);
    process.exit(1);
  }
}

if (!seoulStarterPack) {
  console.error("Expected a Seoul food_street starter pack in assets/content-packs");
  process.exit(1);
}

for (const starterPack of starterPacks) {
  for (const ref of starterPack.manifestKeys ?? []) {
    if (!seenKeys.has(ref)) {
      console.error(`Starter pack manifest key not found (${starterPack.packId}): ${ref}`);
      process.exit(1);
    }
  }
}

for (const ref of shanghaiRewardBundle.manifestKeys ?? []) {
  if (!seenKeys.has(ref)) {
    console.error(`Reward bundle manifest key not found: ${ref}`);
    process.exit(1);
  }
}

const seoulRegistry = worldMapRegistry.cities.find((city) => city.cityId === "seoul");
if (!seoulRegistry) {
  console.error("world-map-registry missing Seoul city entry");
  process.exit(1);
}

const authoredSeoulPacks = starterPacks
  .filter((pack) => pack.city === "seoul")
  .map((pack) => pack.mapLocationId)
  .sort();
const expectedSeoulPacks = seoulRegistry.locations.map((entry) => entry.mapLocationId).sort();
if (JSON.stringify(authoredSeoulPacks) !== JSON.stringify(expectedSeoulPacks)) {
  console.error("Seoul starter-pack coverage does not match world-map-registry");
  console.error(JSON.stringify({ expectedSeoulPacks, authoredSeoulPacks }, null, 2));
  process.exit(1);
}

for (const starterPack of starterPacks.filter((pack) => pack.city === "seoul")) {
  const expectedPackId = `pack.seoul.${starterPack.mapLocationId}.starter`;
  if (starterPack.packId !== expectedPackId) {
    console.error(`Unexpected Seoul starter packId for ${starterPack.mapLocationId}: ${starterPack.packId}`);
    process.exit(1);
  }
}

const practiceStudioPack = starterPacks.find(
  (pack) => pack.city === "seoul" && pack.mapLocationId === "practice_studio"
);
if (practiceStudioPack?.playerFacingLocationLabel !== "Chimaek Place") {
  console.error("Seoul practice_studio starter pack must preserve the Chimaek Place player-facing label");
  process.exit(1);
}

const tokyoSlotRosters = starterCastRegistry.cities.find((city) => city.cityId === "tokyo")?.slotRosters ?? [];
if (tokyoSlotRosters.some((roster) => roster.dagLocationSlot === "practice_studio")) {
  console.error("Tokyo starter-cast registry still contains a non-live practice_studio reserved roster");
  process.exit(1);
}

for (const field of [
  "demoPasswordEnabled",
  "youtubeApiKeyConfigured",
  "spotifyClientIdConfigured",
  "spotifyClientSecretConfigured",
  "openAiApiKeyConfigured"
]) {
  if (typeof demoSecretStatus[field] !== "boolean") {
    console.error(`Expected boolean ${field} in demo.secret-status.sample.json`);
    process.exit(1);
  }
}

console.log("Demo smoke check passed.");
console.log("- Contract files present");
console.log("- JSON fixtures parse");
console.log("- Core progression shape validated");
console.log("- Objective model targets validated");
console.log("- Vocab insight model validated");
console.log("- Planner lesson-context fixture validated");
console.log("- Player media profile includes youtube + spotify signals");
console.log("- Demo secret status fixture validated");
console.log("- Runtime asset manifest keys validated");
console.log("- Canonical/runtime manifest parity validated");
console.log(`- Client runtime manifest keys resolved (${clientRuntimeAssetUsage.manifestKeys.length})`);
console.log(`- Seoul starter-pack coverage validated (${authoredSeoulPacks.length} packs)`);
