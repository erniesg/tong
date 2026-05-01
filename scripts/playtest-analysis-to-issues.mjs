#!/usr/bin/env node
/**
 * Convert a stored playtest analysis into portable GitHub issues.
 *
 * Input is the JSON emitted by scripts/analyze-playtest-session.mjs, either from
 * a local file or from runs.tong.berlayar.ai/playtest/<sessionId>/analysis.json.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const DEFAULT_REPO = process.env.GITHUB_REPOSITORY || 'erniesg/tong';
const DEFAULT_R2_BASE = process.env.TONG_RUNS_PUBLIC_BASE_URL || 'https://runs.tong.berlayar.ai';
const DEFAULT_API_BASE = process.env.TONG_PLAYTEST_API_BASE || 'https://tong-api.erniesg.workers.dev';

const CATEGORY_LANE_HINTS = [
  { match: /translation|language|subtitle|caption|dictionary|roman/i, lane: 'client-overlay' },
  { match: /layout|visual|readability|accessibility|hud|onboarding/i, lane: 'client-ui' },
  { match: /api|contract|session|persist|auth|server|bootstrap/i, lane: 'server-api' },
  { match: /ingest|transcript|lyrics|frequency|vocab|ranking/i, lane: 'server-ingestion' },
  { match: /asset|avatar|video|image|manifest/i, lane: 'runtime-assets' },
  { match: /scene|dialogue|exercise|tap|transition|stream|runtime/i, lane: 'client-runtime' },
];

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function parseBoolean(value, fallback = false) {
  if (value == null) return fallback;
  return TRUE_VALUES.has(String(value).trim().toLowerCase());
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function runGh(args, { allowFailure = false } = {}) {
  try {
    return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    if (allowFailure) return '';
    const stderr = err.stderr?.toString?.().trim() || err.message;
    throw new Error(`gh ${args.join(' ')} failed: ${stderr}`);
  }
}

function stableText(value, fallback = '') {
  return String(value ?? fallback).replace(/\s+/g, ' ').trim();
}

function truncate(value, max = 90) {
  const text = stableText(value, 'Playtest issue');
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`;
}

function severityValue(issue) {
  const raw = issue?.severity;
  if (typeof raw === 'number') return raw;
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : 1;
}

function inferLane(issue) {
  const haystack = [
    issue.category,
    issue.issueType,
    issue.description,
    issue.suggestedFix,
    issue.affectedComponent,
  ].join('\n');
  const hit = CATEGORY_LANE_HINTS.find((item) => item.match.test(haystack));
  return hit?.lane || 'client-runtime';
}

function inferProof(issue, fallback) {
  if (fallback) return fallback;
  const text = [issue.category, issue.description, issue.suggestedFix].join('\n');
  if (/transition|timing|tap|stream|animation|flicker|race/i.test(text)) return 'Clip+Trace';
  if (/visual|layout|readability|translation|subtitle|caption|tooltip/i.test(text)) return 'Screenshot';
  return 'None';
}

function evidenceLinks({ sessionId, r2Base }) {
  if (!sessionId) return [];
  return [
    ['Recording', `${r2Base}/playtest/${sessionId}/recording.webm`],
    ['Annotations', `${r2Base}/playtest/${sessionId}/annotations.json`],
    ['Analysis', `${r2Base}/playtest/${sessionId}/analysis.json`],
    ['State log', `${r2Base}/playtest/${sessionId}/state-log.json`],
    ['Filmstrip', `${r2Base}/playtest/${sessionId}/filmstrip/manifest.json`],
  ];
}

function issueTitle(issue, index) {
  const category = stableText(issue.category || issue.issueType || 'playtest');
  return `[Playtest] ${category.replace(/_/g, ' ')} — ${truncate(issue.description || issue.suggestedFix || `analysis issue ${index + 1}`, 82)}`;
}

function renderIssueBody({ analysis, issue, index, route, r2Base, remoteDependencies, proof }) {
  const sessionId = analysis.sessionId || 'unknown';
  const lane = inferLane(issue);
  const category = stableText(issue.category || issue.issueType || 'unknown');
  const description = stableText(issue.description || issue.whatActuallyHappened || 'No description supplied.');
  const expected = stableText(issue.whatUserExpected || issue.expected || issue.suggestedFix || 'Expected behavior should be inferred from the playtest evidence and acceptance sequence.');
  const actual = stableText(issue.whatActuallyHappened || issue.actual || description);
  const timestamp = stableText(issue.timestamp || issue.time || 'not specified');
  const affected = stableText(issue.affectedComponent || '');
  const suggestedFix = stableText(issue.suggestedFix || '');
  const autoFixable = Boolean(issue.autoFixable);
  const links = evidenceLinks({ sessionId, r2Base });

  const lines = [
    '## Playtest Analysis Issue',
    '',
    `Playtest session: ${sessionId}`,
    `Analysis issue index: ${index}`,
    `Analysis preset: ${analysis.preset || 'unknown'}`,
    `Timestamp: ${timestamp}`,
    `Severity: ${severityValue(issue)}/5`,
    `Category: ${category}`,
    `Auto-fixable: ${autoFixable ? 'yes' : 'no'}`,
    affected ? `Affected component: \`${affected}\`` : '',
    '',
    '## Initiative',
    'Playtest Polish',
    '',
    '## Lane',
    lane,
    '',
    '## Real route or surface',
    route,
    '',
    '## Visible proof sequence',
    '1. Open the playtest evidence links below.',
    timestamp !== 'not specified'
      ? `2. Scrub to approximately \`${timestamp}\` or inspect the nearest annotated screenshot/filmstrip frame.`
      : '2. Inspect the annotation, screenshot, and filmstrip evidence for the described moment.',
    '3. Confirm the visible behavior described under Actual behavior.',
    '4. Apply the fix and rerun validation on the same route or a deterministic equivalent.',
    '5. Publish reviewer-visible evidence showing the fixed behavior.',
    '',
    '## Actual behavior',
    actual,
    '',
    '## Expected behavior',
    expected,
    suggestedFix ? ['', '## Suggested fix', suggestedFix] : '',
    '',
    '## Scenario seed or checkpoint',
    'Use the playtest session evidence unless a deterministic seed is added during validation.',
    '',
    '## Remote dependencies',
    remoteDependencies,
    '',
    '## Reviewer proof required',
    proof,
    '',
    '## Portability checklist',
    '- [x] This issue does not require `/Users/...` paths or laptop-only files.',
    '- [x] The relevant playtest context is linked below.',
    '- [x] The visible acceptance sequence is specific enough for a remote reviewer.',
    '',
    '## Evidence',
    ...links.map(([label, url]) => `- [${label}](${url})`),
    '',
    '## Agent metadata',
    '```json',
    JSON.stringify(
      {
        source: 'playtest-analysis-to-issues',
        sessionId,
        analysisIssueIndex: index,
        analysisId: analysis.analysisId || null,
        route,
        lane,
        autoFixable,
        proofRequired: proof,
        remoteDependencies,
      },
      null,
      2,
    ),
    '```',
  ];

  return lines.flat().filter((line) => line !== '').join('\n') + '\n';
}

async function loadAnalysis(args) {
  if (args.analysis) {
    if (/^https?:\/\//i.test(args.analysis)) {
      const res = await fetch(args.analysis);
      if (!res.ok) throw new Error(`${args.analysis} returned ${res.status}`);
      return res.json();
    }
    return JSON.parse(readFileSync(resolve(args.analysis), 'utf8'));
  }

  if (!args['session-id']) {
    throw new Error('Provide --analysis or --session-id.');
  }

  const url = `${args['r2-base']}/playtest/${args['session-id']}/analysis.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json();
}

function existingIssue({ repo, sessionId, index }) {
  if (!sessionId) return null;
  const search = `"Playtest session: ${sessionId}" "Analysis issue index: ${index}" in:body`;
  const raw = runGh(
    ['issue', 'list', '--repo', repo, '--state', 'all', '--search', search, '--json', 'number,url,title,state', '--limit', '10'],
    { allowFailure: true },
  );
  if (!raw) return null;
  const matches = JSON.parse(raw);
  return matches[0] || null;
}

function createIssue({ repo, title, body, labels, dryRun }) {
  if (dryRun) return { url: '', number: null, state: 'DRY_RUN' };

  const url = runGh(['issue', 'create', '--repo', repo, '--title', title, '--body', body]);
  const number = Number.parseInt(url.split('/').pop() || '', 10);

  for (const label of labels) {
    runGh(['issue', 'edit', String(number || url), '--repo', repo, '--add-label', label], { allowFailure: true });
  }

  return { url, number: Number.isFinite(number) ? number : null, state: 'OPEN' };
}

function printHelp() {
  console.log(`Usage: node scripts/playtest-analysis-to-issues.mjs --session-id <id> [options]

Options:
  --analysis <path-or-url>       Use an existing analysis JSON file or URL
  --session-id <id>              Fetch analysis from R2 for this session
  --repo <owner/repo>            GitHub repo (default: ${DEFAULT_REPO})
  --r2-base <url>                R2 public base (default: ${DEFAULT_R2_BASE})
  --route <path>                 Route under test (default: /game)
  --remote-dependencies <text>   Remote dependency text (default: repo-only)
  --proof <kind>                 None | Screenshot | Clip | Clip+Trace
  --min-severity <n>             Include issues at or above severity (default: 1)
  --auto-fixable-only            Include only auto-fixable findings
  --limit <n>                    Max issues to create
  --labels <a,b>                 Labels to apply after create
  --dry-run                      Render output without creating GitHub issues
  --output <path>                Write result JSON
  --help                         Show this help`);
}

const { values: args } = parseArgs({
  options: {
    analysis: { type: 'string' },
    'session-id': { type: 'string' },
    repo: { type: 'string', default: DEFAULT_REPO },
    'api-base': { type: 'string', default: DEFAULT_API_BASE },
    'r2-base': { type: 'string', default: DEFAULT_R2_BASE },
    route: { type: 'string', default: '/game' },
    'remote-dependencies': { type: 'string', default: 'repo-only' },
    proof: { type: 'string' },
    'min-severity': { type: 'string', default: '1' },
    'auto-fixable-only': { type: 'boolean', default: false },
    limit: { type: 'string' },
    labels: { type: 'string', default: 'bug,playtest-triage' },
    'dry-run': { type: 'boolean', default: false },
    output: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
  strict: false,
});

if (args.help) {
  printHelp();
  process.exit(0);
}

try {
  const analysis = await loadAnalysis(args);
  const issues = analysis.result?.issues || [];
  const minSeverity = Number.parseInt(args['min-severity'], 10) || 1;
  const limit = args.limit ? Number.parseInt(args.limit, 10) : Number.POSITIVE_INFINITY;
  const labels = parseCsv(args.labels);
  const dryRun = parseBoolean(args['dry-run'], false);

  const selected = issues
    .map((issue, index) => ({ issue, index }))
    .filter(({ issue }) => severityValue(issue) >= minSeverity)
    .filter(({ issue }) => !args['auto-fixable-only'] || issue.autoFixable)
    .slice(0, limit);

  const results = [];
  for (const item of selected) {
    const title = issueTitle(item.issue, item.index);
    const proof = inferProof(item.issue, args.proof);
    const body = renderIssueBody({
      analysis,
      issue: item.issue,
      index: item.index,
      route: args.route,
      r2Base: args['r2-base'],
      remoteDependencies: args['remote-dependencies'],
      proof,
    });

    const existing = dryRun
      ? null
      : existingIssue({ repo: args.repo, sessionId: analysis.sessionId, index: item.index });
    if (existing) {
      results.push({
        action: 'existing',
        index: item.index,
        title: existing.title,
        number: existing.number,
        url: existing.url,
        state: existing.state,
      });
      continue;
    }

    const created = createIssue({ repo: args.repo, title, body, labels, dryRun });
    results.push({
      action: dryRun ? 'dry-run' : 'created',
      index: item.index,
      title,
      number: created.number,
      url: created.url,
      state: created.state,
      bodyPreview: dryRun ? body : undefined,
    });
  }

  const output = {
    ok: true,
    sessionId: analysis.sessionId || args['session-id'] || null,
    analysisId: analysis.analysisId || null,
    issueCount: issues.length,
    selectedCount: selected.length,
    createdCount: results.filter((item) => item.action === 'created').length,
    existingCount: results.filter((item) => item.action === 'existing').length,
    dryRun,
    issues: results,
  };

  const json = JSON.stringify(output, null, 2);
  if (args.output) {
    const outputPath = resolve(args.output);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${json}\n`);
  }
  console.log(json);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
