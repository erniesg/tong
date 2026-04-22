import assert from 'node:assert/strict';
import { __testing } from './index.mjs';

__testing.resetState();

const session = __testing.createPlaytestSession({ city: 'seoul', sceneType: 'hangout' });

const firstIngest = __testing.upsertPlaytestFindings({
  sessionId: session.sessionId,
  analysisId: 'analysis-1',
  issues: [
    {
      category: 'translation',
      severity: 'high',
      description: 'CTA copy feels mistranslated and confusing',
      affectedComponent: 'apps/client/components/hud/ActionCTA.tsx',
      artifactLinks: ['https://tong-runs.example.com/run-1/frame-2.png', '/tmp/local-only.png'],
    },
  ],
});

assert.equal(firstIngest.created, 1);
assert.equal(firstIngest.updated, 0);
assert.equal(firstIngest.totalFindingsForSession, 1);

const secondIngest = __testing.upsertPlaytestFindings({
  sessionId: session.sessionId,
  analysisId: 'analysis-2',
  issues: [
    {
      category: 'translation',
      severity: 'high',
      description: 'CTA copy feels mistranslated and confusing',
      affectedComponent: 'apps/client/components/hud/ActionCTA.tsx',
      artifactLinks: ['https://tong-runs.example.com/run-2/frame-6.png'],
    },
  ],
});

assert.equal(secondIngest.created, 0);
assert.equal(secondIngest.updated, 1);

const findings = __testing.listPlaytestFindings({ sessionId: session.sessionId });
assert.equal(findings.length, 1);
assert.equal(findings[0].occurrences, 2);
assert.equal(findings[0].routeStatus, 'unrouted');
assert.equal(findings[0].artifactLinks.length, 2);

const routeUpdate = __testing.updatePlaytestFindingRoute(findings[0].findingId, {
  routeStatus: 'new_issue',
  routeReason: 'high-confidence duplicate prevention route',
  routeConfidence: 0.91,
});
assert.equal(routeUpdate.statusCode, 200);
assert.equal(routeUpdate.finding.routeStatus, 'new_issue');
assert.equal(routeUpdate.finding.routeConfidence, 0.91);

const linkUpdate = __testing.updatePlaytestFindingLinks(findings[0].findingId, {
  linkedIssue: 'erniesg/tong#240',
  linkedPr: '#999',
});
assert.equal(linkUpdate.statusCode, 200);
assert.equal(linkUpdate.finding.linkedIssue, 'erniesg/tong#240');

const overrideUpdate = __testing.updatePlaytestFindingOverride(findings[0].findingId, {
  decision: 'route_to_human',
  note: 'Needs design review before automation',
  actor: 'qa-reviewer',
});
assert.equal(overrideUpdate.statusCode, 200);
assert.equal(overrideUpdate.finding.humanOverride.actor, 'qa-reviewer');

const retried = __testing.retryPlaytestFinding(findings[0].findingId, {
  routeReason: 'retry after bugfix landed',
});
assert.equal(retried.statusCode, 200);
assert.equal(retried.finding.routeStatus, 'unrouted');

const unrouted = __testing.listPlaytestFindings({ sessionId: session.sessionId, routeStatus: 'unrouted' });
assert.equal(unrouted.length, 1);
assert.equal(unrouted[0].routeHistory.length >= 5, true);

console.log('Issue #240 playtest findings ledger regression test passed.');
