import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const objective = readJson('packages/contracts/fixtures/objectives.next.sample.json');
const objectiveIdentityMap = readJson('packages/contracts/objective-identity-map.sample.json');
const objectiveCatalog = readJson('packages/contracts/objective-catalog.sample.json');
const graphDashboard = readJson('packages/contracts/fixtures/graph.dashboard.sample.json');
const vocabInsights = readJson('packages/contracts/fixtures/vocab.insights.sample.json');
const curriculumGraph = readJson('packages/contracts/fixtures/curriculum.graph.food-street.sample.json');
const locationCurriculumPack = readJson('packages/contracts/fixtures/location.curriculum-pack.seoul-food-street.sample.json');

const canonicalByLegacy = new Map();
for (const identity of objectiveIdentityMap.objectives ?? []) {
  for (const legacyId of identity.legacyObjectiveIds ?? []) {
    canonicalByLegacy.set(legacyId, identity.canonicalObjectiveId);
  }
}

assert(typeof objective.lang === 'string', 'objective.lang is required');
assert(objectiveIdentityMap.sourceOfTruth === 'canonical_graph_pack', 'objective identity map sourceOfTruth mismatch');
assert(objective.objectiveId === objective.canonicalObjectiveId, 'objectiveId must carry the canonical objective id');
assert(
  objective.legacyObjectiveId && canonicalByLegacy.get(objective.legacyObjectiveId) === objective.objectiveId,
  'objective legacyObjectiveId must resolve to the canonical objectiveId',
);
assert(objective.objectiveGraph?.source === 'knowledge_graph', 'objectiveGraph.source must be knowledge_graph');
assert(Array.isArray(objective.objectiveGraph?.targetNodeIds), 'objectiveGraph.targetNodeIds must be an array');
assert(
  objective.objectiveGraph?.objectiveNodeId === `objective:${objective.objectiveId}`,
  'objectiveGraph.objectiveNodeId must wrap the canonical objective id',
);
assert(
  Array.isArray(objective.personalizedTargets) &&
    objective.personalizedTargets.every((item) => Array.isArray(item.linkedNodeIds) && item.linkedNodeIds.length > 0),
  'each personalized target must include linkedNodeIds',
);
assert(
  Number.isFinite(objective.completionCriteria?.minEvidenceEvents),
  'completionCriteria.minEvidenceEvents must be a number',
);
assert(
  Array.isArray(objective.completionCriteria?.acceptedEvidenceModes) &&
    objective.completionCriteria.acceptedEvidenceModes.length > 0,
  'completionCriteria.acceptedEvidenceModes must be a non-empty array',
);

const seededStandardSystems = new Set(['HSK', 'JLPT', 'TOPIK', 'CEFR']);

function validateStandardAlignments(value, path) {
  if (value === undefined || value === null) return [];
  assert(Array.isArray(value), `${path}.standardAlignments must be an array, null, or omitted`);
  for (const [index, alignment] of value.entries()) {
    const itemPath = `${path}.standardAlignments[${index}]`;
    assert(alignment && typeof alignment === 'object', `${itemPath} must be an object`);
    assert(typeof alignment.system === 'string' && alignment.system.length > 0, `${itemPath}.system is required`);
    assert(typeof alignment.level === 'string' && alignment.level.length > 0, `${itemPath}.level is required`);
    assert(typeof alignment.lang === 'string' && alignment.lang.length > 0, `${itemPath}.lang is required`);
    assert(typeof alignment.skill === 'string' && alignment.skill.length > 0, `${itemPath}.skill is required`);
    if (alignment.confidence !== undefined) {
      assert(
        typeof alignment.confidence === 'number' && alignment.confidence >= 0 && alignment.confidence <= 1,
        `${itemPath}.confidence must be between 0 and 1`,
      );
    }
    if (alignment.tags !== undefined) {
      assert(Array.isArray(alignment.tags), `${itemPath}.tags must be an array when present`);
    }
  }
  return value;
}

const alignmentsByLang = new Map();
const unmappedMarkers = [];

function collectStandardAlignments(value, path) {
  const alignments = validateStandardAlignments(value, path);
  if (value === null || (Array.isArray(value) && value.length === 0)) {
    unmappedMarkers.push(path);
  }
  for (const alignment of alignments) {
    if (!alignmentsByLang.has(alignment.lang)) alignmentsByLang.set(alignment.lang, []);
    alignmentsByLang.get(alignment.lang).push(alignment);
  }
}

collectStandardAlignments(objective.standardAlignments, 'objectives.next');
for (const [index, target] of (objective.personalizedTargets || []).entries()) {
  collectStandardAlignments(target.standardAlignments, `objectives.next.personalizedTargets[${index}]`);
}
for (const [index, identity] of (objectiveIdentityMap.objectives || []).entries()) {
  collectStandardAlignments(identity.standardAlignments, `objective-identity-map.objectives[${index}]`);
}
for (const [index, catalogObjective] of (objectiveCatalog.objectives || []).entries()) {
  collectStandardAlignments(catalogObjective.standardAlignments, `objective-catalog.objectives[${index}]`);
}
for (const [index, entry] of (graphDashboard.selectedPack?.pack?.nodes || []).entries()) {
  collectStandardAlignments(entry.standardAlignments, `graph.dashboard.selectedPack.pack.nodes[${index}]`);
}
for (const [index, entry] of (graphDashboard.selectedPack?.nodes || []).entries()) {
  collectStandardAlignments(entry.node?.standardAlignments, `graph.dashboard.selectedPack.nodes[${index}].node`);
}
for (const [itemIndex, item] of (vocabInsights.items || []).entries()) {
  for (const [linkIndex, link] of (item.objectiveLinks || []).entries()) {
    collectStandardAlignments(link.standardAlignments, `vocab.insights.items[${itemIndex}].objectiveLinks[${linkIndex}]`);
  }
}
for (const [packName, pack] of [
  ['curriculum.graph.food-street', curriculumGraph],
  ['location.curriculum-pack.seoul-food-street', locationCurriculumPack],
]) {
  for (const [sectionName, targets] of Object.entries(pack.content || {})) {
    for (const [targetIndex, target] of (targets || []).entries()) {
      collectStandardAlignments(target.standardAlignments, `${packName}.content.${sectionName}[${targetIndex}]`);
    }
  }
}

for (const lang of ['ko', 'ja', 'zh']) {
  assert((alignmentsByLang.get(lang) || []).length > 0, `expected at least one ${lang} standard alignment`);
}
for (const system of seededStandardSystems) {
  assert(
    [...alignmentsByLang.values()].flat().some((alignment) => alignment.system === system),
    `expected seeded standard system ${system}`,
  );
}
assert(unmappedMarkers.length > 0, 'expected at least one null or empty standardAlignments marker');

const evidence = readJson('packages/contracts/fixtures/graph.evidence.record.sample.json');
assert(Number.isFinite(evidence.recorded), 'graph evidence response must include recorded count');
assert(Array.isArray(evidence.events), 'graph evidence response must include events');
assert(Number.isFinite(evidence.metrics?.evidenceCount), 'graph evidence response must include metrics.evidenceCount');
assert(
  evidence.events.every(
    (evt) =>
      typeof evt.nodeId === 'string' &&
      typeof evt.objectiveId !== 'undefined' &&
      (evt.objectiveId === null || evt.objectiveId === evt.canonicalObjectiveId || evt.canonicalObjectiveId === undefined),
  ),
  'each graph evidence event must include nodeId and canonical objectiveId compatibility metadata',
);

console.log('KG contract schema check passed.');
