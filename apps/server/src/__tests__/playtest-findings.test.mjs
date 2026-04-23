import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ingestPlaytestFindings,
  updateFindingRoute,
  linkFindingGithubRefs,
  reopenFinding,
  storeFindingOverride,
  listPlaytestFindings,
} from '../playtest-findings.mjs';

test('ingest creates stable finding identity and dedupes reruns', () => {
  const findingsMap = new Map();
  const payload = {
    sessionId: 'session-1',
    findings: [
      {
        category: 'translation',
        severity: 'high',
        description: 'Tooltip omits hanja annotation',
        whatUserExpected: 'Hanja should be shown',
        whatActuallyHappened: 'Only hangul appears',
      },
    ],
  };

  const first = ingestPlaytestFindings({ findingsMap, ...payload, analysisId: 'analysis-a' });
  const second = ingestPlaytestFindings({ findingsMap, ...payload, analysisId: 'analysis-b' });

  assert.equal(first.created, 1);
  assert.equal(second.updated, 1);
  assert.equal(findingsMap.size, 1);

  const finding = first.findings[0];
  assert.equal(finding.findingId, second.findings[0].findingId);
  assert.deepEqual(second.findings[0].analysisIds.sort(), ['analysis-a', 'analysis-b']);
  assert.equal(second.findings[0].occurrenceCount, 2);
});

test('route/link/override workflow updates audit-ready fields', () => {
  const findingsMap = new Map();
  const ingest = ingestPlaytestFindings({
    findingsMap,
    sessionId: 'session-2',
    findings: [{ category: 'ux', severity: 'medium', description: 'Continue CTA looks disabled' }],
  });
  const findingId = ingest.findings[0].findingId;

  const routed = updateFindingRoute({
    findingsMap,
    findingId,
    routeStatus: 'update_issue',
    reason: 'Duplicate of existing issue',
    confidence: 0.92,
    actor: 'qa-bot',
  });
  assert.equal(routed.routeStatus, 'update_issue');
  assert.equal(routed.routeReason, 'Duplicate of existing issue');
  assert.equal(routed.routeConfidence, 0.92);

  const linked = linkFindingGithubRefs({
    findingsMap,
    findingId,
    issueRef: 'erniesg/tong#240',
    prRef: 'erniesg/tong#245',
    actor: 'qa-bot',
  });
  assert.equal(linked.githubIssueRef, 'erniesg/tong#240');
  assert.equal(linked.githubPrRef, 'erniesg/tong#245');

  const overridden = storeFindingOverride({
    findingsMap,
    findingId,
    override: { decision: 'human_review', note: 'Needs product triage' },
    actor: 'reviewer-1',
  });
  assert.equal(overridden.humanOverride.decision, 'human_review');
  assert.equal(overridden.humanOverride.actor, 'reviewer-1');

  const reopened = reopenFinding({
    findingsMap,
    findingId,
    reason: 'Reopened after regression',
    actor: 'reviewer-1',
  });
  assert.equal(reopened.routeStatus, 'unrouted');

  const unroutedOnly = listPlaytestFindings({ findingsMap, routeStatus: 'unrouted' });
  assert.equal(unroutedOnly.length, 1);
  assert.ok(reopened.auditTrail.length >= 5);
});
