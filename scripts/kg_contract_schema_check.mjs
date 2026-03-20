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
