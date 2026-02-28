import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

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
  "packages/contracts/fixtures/scene.shanghai-texting-reward.sample.json"
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

console.log("Demo smoke check passed.");
console.log("- Contract files present");
console.log("- JSON fixtures parse");
console.log("- Core progression shape validated");
console.log("- Objective model targets validated");
console.log("- Vocab insight model validated");
console.log("- Player media profile includes youtube + spotify signals");
