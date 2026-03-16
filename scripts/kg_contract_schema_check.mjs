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
assert(typeof objective.lang === 'string', 'objective.lang is required');
assert(objective.objectiveGraph?.source === 'knowledge_graph', 'objectiveGraph.source must be knowledge_graph');
assert(Array.isArray(objective.objectiveGraph?.targetNodeIds), 'objectiveGraph.targetNodeIds must be an array');
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
  evidence.events.every((evt) => typeof evt.nodeId === 'string' && typeof evt.objectiveId !== 'undefined'),
  'each graph evidence event must include nodeId and objectiveId',
);

console.log('KG contract schema check passed.');
