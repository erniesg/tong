import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const clientRoot = path.join(root, "apps/client");
const clientPublicRoot = path.join(clientRoot, "public");
const clientAssetRefPattern = /\/assets\/[A-Za-z0-9_./-]+\.(?:png|jpg|jpeg|webp|svg|mp4|webm)/g;
const sourceFileExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".html"]);

function walkFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".turbo") {
        continue;
      }
      if (fullPath === path.join(clientPublicRoot, "assets")) {
        continue;
      }
      walkFiles(fullPath, files);
      continue;
    }

    if (sourceFileExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function collectClientAssetRefs() {
  const refs = new Set();
  for (const file of walkFiles(clientRoot)) {
    const contents = fs.readFileSync(file, "utf8");
    const matches = contents.match(clientAssetRefPattern) ?? [];
    for (const match of matches) refs.add(match);
  }
  return [...refs].sort();
}

function resolveManifestUri(uri) {
  if (uri.startsWith("/assets/")) {
    return path.join(clientPublicRoot, uri.slice(1));
  }
  return path.join(root, uri);
}

const requiredFiles = [
  "packages/contracts/api-contract.md",
  "packages/contracts/game-loop.json",
  "packages/contracts/objective-catalog.sample.json",
  "packages/contracts/fixtures/captions.enriched.sample.json",
  "packages/contracts/fixtures/dictionary.entry.sample.json",
  "packages/contracts/fixtures/vocab.frequency.sample.json",
  "packages/contracts/fixtures/vocab.insights.sample.json",
  "packages/contracts/fixtures/player.media-profile.sample.json",
  "packages/contracts/fixtures/game.start-or-resume.sample.json",
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
  "assets/content-packs/seoul-food-street.starter.json",
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
const vocabInsights = JSON.parse(
  fs.readFileSync(path.join(root, "packages/contracts/fixtures/vocab.insights.sample.json"), "utf8")
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
const seoulStarterPack = JSON.parse(
  fs.readFileSync(
    path.join(root, "assets/content-packs/seoul-food-street.starter.json"),
    "utf8"
  )
);
const shanghaiRewardBundle = JSON.parse(
  fs.readFileSync(
    path.join(root, "assets/rewards/shanghai-reward-bundle.placeholder.json"),
    "utf8"
  )
);
const clientAssetRefs = collectClientAssetRefs();

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
}

if (!playerMediaProfile.sourceBreakdown) {
  console.error("Expected sourceBreakdown in player.media-profile.sample.json");
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
const runtimeUris = new Set(runtimeAssetManifest.assets.map((asset) => asset.uri));

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

const keyRegex = /^[a-z0-9]+(\.[a-z0-9-]+){3,}$/;
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

for (const ref of clientAssetRefs) {
  if (!runtimeUris.has(ref)) {
    console.error(`Client asset reference missing from runtime manifest: ${ref}`);
    process.exit(1);
  }

  const resolvedPath = resolveManifestUri(ref);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Client asset reference missing on disk: ${ref}`);
    process.exit(1);
  }
}

for (const ref of seoulStarterPack.manifestKeys ?? []) {
  if (!seenKeys.has(ref)) {
    console.error(`Starter pack manifest key not found: ${ref}`);
    process.exit(1);
  }
}

for (const ref of shanghaiRewardBundle.manifestKeys ?? []) {
  if (!seenKeys.has(ref)) {
    console.error(`Reward bundle manifest key not found: ${ref}`);
    process.exit(1);
  }
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
console.log("- Player media profile includes youtube + spotify signals");
console.log("- Demo secret status fixture validated");
console.log("- Runtime asset manifest keys validated");
console.log("- Canonical/runtime manifest parity validated");
console.log(`- Client asset references resolved (${clientAssetRefs.length})`);
