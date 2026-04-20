import assert from 'node:assert/strict';
import { __testing } from '../index.mjs';

__testing.resetState();

const ingestPayload = {
  sessionId: 'playtest-session-240',
  analyzedAtIso: '2026-04-20T16:20:00.000Z',
  findings: [{
    category: 'routing',
    severity: 'high',
    summary: 'Route state is missing from issue handoff',
    component: '/api/v1/playtest/findings',
    timestampIso: '2026-04-20T16:19:59.000Z',
    artifactLinks: [{ label: 'run bundle', href: 'https://tong-runs.example/run/240' }],
  }],
};

const firstIngest = __testing.upsertPlaytestFindings(ingestPayload);
assert.equal(firstIngest.length, 1);
assert.equal(firstIngest[0].routeState.status, 'unrouted');
assert.equal(firstIngest[0].linkedRefs.issueRefs.length, 0);

const rerunIngest = __testing.upsertPlaytestFindings(ingestPayload);
assert.equal(rerunIngest.length, 1);
assert.equal(rerunIngest[0].fingerprint, firstIngest[0].fingerprint);

const unrouted = __testing.listUnroutedFindings();
assert.equal(unrouted.length, 1);

const routed = __testing.markRouteDecision({
  fingerprint: firstIngest[0].fingerprint,
  status: 'routed',
  reason: 'needs_triage',
  confidence: 0.78,
  source: 'system',
});
assert.equal(routed.routeState.status, 'routed');
assert.equal(routed.routeState.reason, 'needs_triage');

const withRefs = __testing.attachFindingRefs({
  fingerprint: firstIngest[0].fingerprint,
  issueRefs: ['erniesg/tong#240'],
  prRefs: ['erniesg/tong#241'],
});
assert.deepEqual(withRefs.linkedRefs.issueRefs, ['erniesg/tong#240']);
assert.deepEqual(withRefs.linkedRefs.prRefs, ['erniesg/tong#241']);

const overridden = __testing.setManualOverride({
  fingerprint: firstIngest[0].fingerprint,
  override: {
    status: 'suppressed',
    reason: 'known_issue',
    confidence: 0.91,
    actor: 'qa-reviewer',
  },
});
assert.equal(overridden.manualOverride.status, 'suppressed');
assert.equal(overridden.routeState.status, 'suppressed');

const reopened = __testing.retryOrReopenFinding({
  fingerprint: firstIngest[0].fingerprint,
  action: 'reopen',
});
assert.equal(reopened.routeState.status, 'unrouted');
assert.equal(reopened.routeState.reason, 'needs_triage');

console.log('Playtest findings ledger regression test passed.');
