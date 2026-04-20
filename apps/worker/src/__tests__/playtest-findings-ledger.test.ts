import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  attachFindingRefs,
  extractAnalysisFindings,
  listQueuedFindings,
  listUnroutedFindings,
  normalizeFindingListLimit,
  reopenFinding,
  retryFinding,
  setFindingManualOverride,
  upsertFindingLedgerEntries,
  updateFindingRoute,
} from '../playtest-findings.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationPath = path.resolve(__dirname, '../../migrations/0005_playtest_findings_ledger.sql');

function createSqlExecutor() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(migrationPath, 'utf8'));
  return {
    all(sql: string, params: unknown[] = []) {
      return db.prepare(sql).all(...params) as Record<string, unknown>[];
    },
    db,
    get(sql: string, params: unknown[] = []) {
      return (db.prepare(sql).get(...params) as Record<string, unknown> | undefined) ?? null;
    },
    run(sql: string, params: unknown[] = []) {
      const result = db.prepare(sql).run(...params);
      return { changes: Number(result.changes ?? 0) };
    },
  };
}

test('ingests analysis.result.issues[] and normalizes current Gemini issue shape', async () => {
  const sql = createSqlExecutor();
  const result = await upsertFindingLedgerEntries(sql, {
    analysisData: {
      analysisId: 'analysis-240-a',
      result: {
        issues: [
          {
            affectedComponent: 'apps/client/components/scene/ContinueButton',
            artifactLinks: [
              'https://runs.tong.berlayar.ai/playtest/demo-session/custom-proof.webm',
              '/Users/local-only-proof.webm',
            ],
            category: 'navigation',
            description: 'Continue affordance is unclear after dialogue ends.',
            severity: 5,
            suggestedFix: 'Add a clearer continue CTA.',
            timestamp: '01:23',
            whatActuallyHappened: 'User paused and hovered without advancing.',
            whatUserExpected: 'A visible prompt to continue immediately.',
          },
        ],
      },
    },
    analysisId: 'analysis-240-a',
    publicBase: 'https://runs.tong.berlayar.ai',
    sessionId: 'demo-session',
  });

  assert.deepEqual(result, {
    deduped: 0,
    findingIds: [result!.findingIds[0]],
    inserted: 1,
  });

  const findings = await listUnroutedFindings(sql);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].sessionId, 'demo-session');
  assert.equal(findings[0].analysisId, 'analysis-240-a');
  assert.equal(findings[0].observedAtText, '01:23');
  assert.equal(findings[0].observedAtMs, 83000);
  assert.equal(findings[0].severity, 'critical');
  assert.equal(findings[0].summary, 'Continue affordance is unclear after dialogue ends.');
  assert.equal(findings[0].inferredComponent, 'apps/client/components/scene/ContinueButton');
  assert.equal(findings[0].artifactLinks.some((link) => link.href.startsWith('https://runs.tong.berlayar.ai/playtest/demo-session/')), true);
  assert.equal(findings[0].artifactLinks.some((link) => link.href.includes('/Users/')), false);
  assert.equal(findings[0].routeState.status, 'unrouted');
  assert.equal(findings[0].routeState.confidence, null);
  assert.equal(findings[0].history[0].type, 'ingested');
});

test('rerun dedupes by fingerprint and preserves route state, refs, and manual override', async () => {
  const sql = createSqlExecutor();
  const first = await upsertFindingLedgerEntries(sql, {
    analysisData: {
      analysisId: 'analysis-240-b',
      result: {
        issues: [
          {
            affectedComponent: 'apps/client/components/hud/HelpTab',
            category: 'unclear_instruction',
            description: 'Hint copy is too vague during the first step.',
            severity: 3,
            suggestedFix: 'Add explicit instruction text.',
            timestamp: '00:18',
          },
        ],
      },
    },
    analysisId: 'analysis-240-b',
    publicBase: 'https://runs.tong.berlayar.ai',
    sessionId: 'demo-session',
  });

  const findingId = first!.findingIds[0];
  await updateFindingRoute(sql, findingId, {
    confidence: 0.83,
    reason: 'needs_issue_creation',
    status: 'new_issue',
  });
  await attachFindingRefs(sql, findingId, {
    issueRefs: ['erniesg/tong#240'],
    prRefs: ['erniesg/tong#245'],
  });
  await setFindingManualOverride(sql, findingId, {
    active: true,
    actor: 'qa-reviewer',
    confidence: 0.92,
    note: 'Escalate to a human if lane ownership is unclear.',
    reason: 'manual escalation',
    status: 'human_review',
  });

  const second = await upsertFindingLedgerEntries(sql, {
    analysisData: {
      analysisId: 'analysis-240-c',
      result: {
        issues: [
          {
            affectedComponent: 'apps/client/components/hud/HelpTab',
            category: 'unclear_instruction',
            description: 'Hint copy is too vague during the first step.',
            severity: 3,
            suggestedFix: 'Add explicit instruction text.',
            timestamp: '00:18',
          },
        ],
      },
    },
    analysisId: 'analysis-240-c',
    publicBase: 'https://runs.tong.berlayar.ai',
    sessionId: 'demo-session',
  });

  assert.equal(second?.inserted, 0);
  assert.equal(second?.deduped, 1);
  assert.deepEqual(second?.findingIds, [findingId]);

  const findings = await listUnroutedFindings(sql);
  assert.equal(findings.length, 0);

  const row = sql.get('SELECT * FROM playtest_findings_ledger WHERE finding_id = ?', [findingId]);
  assert.ok(row);
  assert.equal(row?.route_status, 'human_review');
  assert.equal(String(row?.linked_issue_refs_json).includes('erniesg/tong#240'), true);
  assert.equal(String(row?.linked_pr_refs_json).includes('erniesg/tong#245'), true);
  assert.equal(String(row?.manual_override_json).includes('manual escalation'), true);
});

test('supports route, refs, retry, reopen, and override lifecycle updates', async () => {
  const sql = createSqlExecutor();
  const ingest = await upsertFindingLedgerEntries(sql, {
    analysisData: {
      analysisId: 'analysis-240-d',
      result: {
        issues: [
          {
            affectedComponent: 'apps/client/components/overlay/DictionaryPopover',
            category: 'ui_layout',
            description: 'Dictionary popover overlaps the subtitle lane.',
            severity: 4,
            suggestedFix: 'Offset the popover below the controls.',
            timestamp: '02:05',
          },
        ],
      },
    },
    analysisId: 'analysis-240-d',
    publicBase: 'https://runs.tong.berlayar.ai',
    sessionId: 'overlay-session',
  });

  const findingId = ingest!.findingIds[0];
  const routed = await updateFindingRoute(sql, findingId, {
    confidence: 0.77,
    reason: 'single-lane-fixable',
    status: 'direct_pr',
  });
  assert.equal(routed?.routeState.status, 'direct_pr');

  const linked = await attachFindingRefs(sql, findingId, {
    issueRefs: ['erniesg/tong#240', 'erniesg/tong#240'],
    prRefs: ['erniesg/tong#245'],
  });
  assert.deepEqual(linked?.linkedRefs.issueRefs, ['erniesg/tong#240']);
  assert.deepEqual(linked?.linkedRefs.prRefs, ['erniesg/tong#245']);

  const retried = await retryFinding(sql, findingId, 'queue-operator');
  assert.equal(retried?.routeState.status, 'unrouted');
  assert.equal(retried?.routeState.reason, 'retry_requested');

  const reopened = await reopenFinding(sql, findingId, {
    actor: 'queue-operator',
    reason: 'regression_still_reproduces',
  });
  assert.equal(reopened?.routeState.status, 'unrouted');
  assert.equal(reopened?.routeState.reason, 'regression_still_reproduces');

  const overridden = await setFindingManualOverride(sql, findingId, {
    active: true,
    actor: 'qa-reviewer',
    confidence: 0.88,
    note: 'Needs explicit human review.',
    reason: 'design ambiguity',
    status: 'human_review',
  });
  assert.equal(overridden?.manualOverride?.active, true);
  assert.equal(overridden?.routeState.status, 'human_review');
});

test('returns null when lifecycle updates target a missing finding', async () => {
  const sql = createSqlExecutor();
  assert.equal(await updateFindingRoute(sql, 'missing', { status: 'done' }), null);
  assert.equal(await attachFindingRefs(sql, 'missing', { issueRefs: ['erniesg/tong#240'] }), null);
  assert.equal(await retryFinding(sql, 'missing'), null);
  assert.equal(await reopenFinding(sql, 'missing', {}), null);
  assert.equal(await setFindingManualOverride(sql, 'missing', { active: true, status: 'skip' }), null);
});

test('extractAnalysisFindings prefers the first populated candidate array', () => {
  const findings = extractAnalysisFindings({
    findings: [],
    result: {
      issues: [
        {
          category: 'navigation',
          description: 'The overlay does not advance after the clip ends.',
        },
      ],
    },
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.description, 'The overlay does not advance after the clip ends.');
});

test('normalizeFindingListLimit clamps invalid or out-of-range list limits', () => {
  assert.equal(normalizeFindingListLimit(null), 50);
  assert.equal(normalizeFindingListLimit('foo'), 50);
  assert.equal(normalizeFindingListLimit('-2'), 1);
  assert.equal(normalizeFindingListLimit('9.8'), 9);
  assert.equal(normalizeFindingListLimit('999'), 200);
});

test('listQueuedFindings returns recent findings across statuses and supports filters', async () => {
  const sql = createSqlExecutor();
  const first = await upsertFindingLedgerEntries(sql, {
    analysisData: {
      analysisId: 'analysis-242-a',
      result: {
        issues: [
          {
            affectedComponent: 'apps/client/components/scene/ContinueButton',
            category: 'navigation',
            description: 'The continue CTA is hard to see.',
            severity: 4,
            timestamp: '00:12',
          },
        ],
      },
    },
    analysisId: 'analysis-242-a',
    publicBase: 'https://runs.tong.berlayar.ai',
    sessionId: 'queue-session',
  });
  const second = await upsertFindingLedgerEntries(sql, {
    analysisData: {
      analysisId: 'analysis-242-b',
      result: {
        issues: [
          {
            affectedComponent: '.github/workflows/qa-publish.yml',
            category: 'automation',
            description: 'Protected workflow needs a manual decision.',
            severity: 3,
            timestamp: '00:24',
          },
        ],
      },
    },
    analysisId: 'analysis-242-b',
    publicBase: 'https://runs.tong.berlayar.ai',
    sessionId: 'queue-session',
  });

  await updateFindingRoute(sql, first!.findingIds[0], {
    actor: 'playtest-orchestrator',
    confidence: 0.9,
    reason: 'single_lane_non_protected_scope',
    status: 'direct_pr',
  });
  await setFindingManualOverride(sql, second!.findingIds[0], {
    active: true,
    actor: 'qa-reviewer',
    confidence: 0.98,
    note: 'Wait for human approval.',
    reason: 'protected_path_scope',
    status: 'human_review',
  });

  const allFindings = await listQueuedFindings(sql, { limit: 10 });
  assert.equal(allFindings.length, 2);
  assert.deepEqual(
    allFindings.map((finding) => finding.findingId).sort(),
    [first!.findingIds[0], second!.findingIds[0]].sort(),
  );

  const humanReview = await listQueuedFindings(sql, {
    routeStatuses: ['human_review'],
  });
  assert.deepEqual(humanReview.map((finding) => finding.findingId), [second!.findingIds[0]]);

  const directPr = await listQueuedFindings(sql, {
    findingId: first!.findingIds[0],
    routeStatuses: ['direct_pr'],
  });
  assert.deepEqual(directPr.map((finding) => finding.findingId), [first!.findingIds[0]]);
});
