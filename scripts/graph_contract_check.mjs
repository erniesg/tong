import fs from 'node:fs';
import path from 'node:path';
import {
  getGraphDashboard,
  getGraphHangoutBundle,
  getGraphLessonBundle,
  recordGraphEvidence,
  resetGraphRuntime,
  validatePack as validateRuntimePack,
} from '../apps/server/src/curriculum-graph.mjs';

const root = process.cwd();

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function collectContentIds(pack) {
  const sections = [
    ...(pack.content?.scriptTargets || []),
    ...(pack.content?.pronunciationTargets || []),
    ...(pack.content?.vocabularyTargets || []),
    ...(pack.content?.grammarTargets || []),
    ...(pack.content?.sentenceFrameTargets || []),
  ];

  const seen = new Map();
  const duplicates = [];
  for (const item of sections) {
    if (!item?.id) continue;
    if (seen.has(item.id)) duplicates.push(item.id);
    seen.set(item.id, item);
  }
  return { ids: new Set(seen.keys()), duplicates };
}

function detectRequiresCycle(pack) {
  const adjacency = new Map();
  for (const node of pack.nodes || []) adjacency.set(node.nodeId, []);
  for (const edge of pack.edges || []) {
    if (edge.type !== 'requires') continue;
    const list = adjacency.get(edge.fromNodeId) || [];
    list.push(edge.toNodeId);
    adjacency.set(edge.fromNodeId, list);
  }

  const visiting = new Set();
  const visited = new Set();

  function visit(nodeId) {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    for (const next of adjacency.get(nodeId) || []) {
      if (visit(next)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  }

  for (const nodeId of adjacency.keys()) {
    if (visit(nodeId)) return true;
  }
  return false;
}

function validateFixturePack(pack) {
  const issues = [];
  const nodeIds = new Set();
  for (const node of pack.nodes || []) {
    if (nodeIds.has(node.nodeId)) {
      issues.push(`duplicate node id: ${node.nodeId}`);
    }
    nodeIds.add(node.nodeId);
  }

  const { ids: contentIds, duplicates } = collectContentIds(pack);
  for (const duplicateId of duplicates) {
    issues.push(`duplicate content target id: ${duplicateId}`);
  }

  for (const node of pack.nodes || []) {
    for (const itemId of node.targetItemIds || []) {
      if (!contentIds.has(itemId)) {
        issues.push(`unmapped target item ${itemId} on node ${node.nodeId}`);
      }
    }
  }

  const levelNodeIds = new Set();
  for (const level of pack.levels || []) {
    for (const nodeId of level.objectiveNodeIds || []) {
      levelNodeIds.add(nodeId);
      if (!nodeIds.has(nodeId)) {
        issues.push(`level ${level.level} references unknown node ${nodeId}`);
      }
    }
    for (const nodeId of level.assessmentCriteria?.requiredNodeIds || []) {
      if (!nodeIds.has(nodeId)) {
        issues.push(`level ${level.level} requires unknown node ${nodeId}`);
      }
    }
  }

  for (const nodeId of nodeIds) {
    if (!levelNodeIds.has(nodeId)) {
      issues.push(`orphan node ${nodeId} is not assigned to any level`);
    }
  }

  for (const edge of pack.edges || []) {
    if (!nodeIds.has(edge.fromNodeId)) {
      issues.push(`edge ${edge.edgeId} has unknown fromNodeId ${edge.fromNodeId}`);
    }
    if (!nodeIds.has(edge.toNodeId)) {
      issues.push(`edge ${edge.edgeId} has unknown toNodeId ${edge.toNodeId}`);
    }
  }

  for (const mission of pack.missions || []) {
    for (const nodeId of mission.requiredNodeIds || []) {
      if (!nodeIds.has(nodeId)) {
        issues.push(`mission ${mission.missionId} references unknown node ${nodeId}`);
      }
    }
  }

  for (const scenario of pack.scenarios || []) {
    for (const nodeId of scenario.targetNodeIds || []) {
      if (!nodeIds.has(nodeId)) {
        issues.push(`scenario ${scenario.scenarioId} references unknown node ${nodeId}`);
      }
    }
  }

  if (detectRequiresCycle(pack)) {
    issues.push('requires graph contains a cycle');
  }

  return issues;
}

function expectValid(relativePath) {
  const pack = readJson(relativePath);
  const issues = validateFixturePack(pack);
  if (issues.length > 0) {
    console.error(`${relativePath} should be valid but failed:`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS valid fixture: ${relativePath}`);
}

function expectInvalid(relativePath, expectedSubstring) {
  const pack = readJson(relativePath);
  const issues = validateFixturePack(pack);
  if (!issues.some((issue) => issue.includes(expectedSubstring))) {
    console.error(`${relativePath} should contain issue "${expectedSubstring}" but got:`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS invalid fixture: ${relativePath}`);
}

expectValid('packages/contracts/fixtures/curriculum.graph.food-street.sample.json');
expectInvalid('packages/contracts/fixtures/curriculum.graph.invalid-cycle.sample.json', 'cycle');
expectInvalid(
  'packages/contracts/fixtures/curriculum.graph.invalid-unmapped-target.sample.json',
  'unmapped target item',
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function expectRuntimeSuccess(label, fn) {
  try {
    fn();
    console.log(`PASS runtime: ${label}`);
  } catch (error) {
    console.error(`FAIL runtime: ${label}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

resetGraphRuntime();

expectRuntimeSuccess('canonical pack validation response', () => {
  const result = validateRuntimePack();
  assert(result.valid === true, 'runtime validator should accept canonical pack');
  assert(result.packId === 'seoul_food_street_gold', 'runtime validator returned unexpected packId');
  assert(Array.isArray(result.issues), 'runtime validator should return issues[]');
});

expectRuntimeSuccess('dashboard returns canonical shape', () => {
  const dashboard = getGraphDashboard({ learnerId: 'persona_kpop_prompting' });
  assert(dashboard.learner?.learnerId === 'persona_kpop_prompting', 'dashboard missing learner');
  assert(Array.isArray(dashboard.roadmap) && dashboard.roadmap.length >= 3, 'dashboard missing roadmap');
  assert(dashboard.selectedPack?.pack?.cityId === 'seoul', 'dashboard should default to Seoul pack');
  assert(Array.isArray(dashboard.selectedPack?.nodes) && dashboard.selectedPack.nodes.length > 0, 'dashboard missing selected pack nodes');
  assert(Array.isArray(dashboard.overlays) && dashboard.overlays.length > 0, 'dashboard missing overlays');
  assert(Array.isArray(dashboard.recommendations) && dashboard.recommendations.length > 0, 'dashboard missing recommendations');
  assert(typeof dashboard.evidence?.totalEvents === 'number', 'dashboard missing evidence summary');
});

expectRuntimeSuccess('city/location selection uses registry instead of defaulting to Seoul', () => {
  const dashboard = getGraphDashboard({ learnerId: 'persona_kpop_prompting', city: 'tokyo' });
  assert(dashboard.selectedPack.pack.cityId === 'tokyo', 'selected pack should respect requested city');
  assert(dashboard.selectedPack.pack.locationId === 'food_street', 'selected pack should use city default location');
  assert(Array.isArray(dashboard.selectedPack.nodes) && dashboard.selectedPack.nodes.length === 0, 'Tokyo stub pack should have no authored nodes yet');
});

expectRuntimeSuccess('lesson bundle follows current active path', () => {
  const bundle = getGraphLessonBundle({ learnerId: 'persona_kpop_prompting' });
  assert(bundle.title === 'Food Street Polite Ordering Bundle', 'lesson bundle should target the current ordering path');
  assert(bundle.nodeIds.includes('ko-gram-juseyo'), 'lesson bundle should include ko-gram-juseyo');
});

expectRuntimeSuccess('hangout bundle does not unlock too early', () => {
  const beginnerBundle = getGraphHangoutBundle({ learnerId: 'persona_beginner_foundation' });
  assert(beginnerBundle.nodeIds.length === 0, 'beginner should not get a hangout bundle yet');
  const progressedBundle = getGraphHangoutBundle({ learnerId: 'persona_mixed_progress' });
  assert(progressedBundle.nodeIds.length >= 3, 'progressed learner should get a hangout bundle');
  assert(progressedBundle.scenarioId === 'ko-food-street-hangout-order', 'hangout bundle should expose scenarioId');
});

expectRuntimeSuccess('invalid evidence events are rejected instead of silently ignored', () => {
  let rejected = false;
  try {
    recordGraphEvidence({
      learnerId: 'persona_kpop_prompting',
      event: {
        nodeId: 'bad-node-id',
        mode: 'learn',
        quality: 0.8,
      },
    });
  } catch (error) {
    rejected = error?.code === 'unknown_graph_node';
  }
  assert(rejected, 'recordGraphEvidence should reject unknown node ids');
});

expectRuntimeSuccess('runtime learners start unseeded and advance from live evidence', () => {
  const learnerId = 'learner_runtime_contract_check';
  resetGraphRuntime(learnerId);

  const before = getGraphDashboard({ learnerId });
  assert(before.learner?.learnerId === learnerId, 'runtime learner id should remain stable');
  assert(before.evidence?.totalEvents === 0, 'runtime learner should not inherit seeded evidence');
  assert(before.progression?.xp === 0, 'runtime learner should start at zero progression');

  const recorded = recordGraphEvidence({
    learnerId,
    event: {
      nodeId: 'ko-script-consonants-basic',
      mode: 'learn',
      source: 'learn',
      qualityScore: 4,
      correct: true,
    },
  });

  assert(recorded.learnerId === learnerId, 'recorded event should stay attached to the runtime learner');
  assert(recorded.progression.xp > 0, 'recorded event should advance progression');

  const after = getGraphDashboard({ learnerId });
  assert(after.evidence?.totalEvents === 1, 'runtime learner evidence count should reflect live events');
  assert(after.progression?.xp === recorded.progression.xp, 'dashboard progression should match the recorded event progression');
});

expectRuntimeSuccess('legacy objective aliases normalize onto canonical graph nodes', () => {
  const learnerId = 'learner_runtime_alias_check';
  resetGraphRuntime(learnerId);

  const recorded = recordGraphEvidence({
    learnerId,
    event: {
      nodeId: 'ko-script-consonants',
      mode: 'learn',
      source: 'exercise',
      qualityScore: 4,
      correct: true,
    },
  });

  assert(recorded.event.nodeId === 'ko-script-consonants-basic', 'legacy node ids should normalize to canonical ids');
  assert(recorded.state.nodeId === 'ko-script-consonants-basic', 'normalized node state should use the canonical node id');
});
