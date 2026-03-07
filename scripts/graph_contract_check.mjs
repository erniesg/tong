import fs from 'node:fs';
import path from 'node:path';

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

function validatePack(pack) {
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
  const issues = validatePack(pack);
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
  const issues = validatePack(pack);
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
