#!/usr/bin/env node
/**
 * Dispatch supported remote-agent queue items to their provider workflow.
 *
 * Codex items launch via .github/workflows/codex-headless-pr.yml.
 * Claude items launch via .github/workflows/claude-headless-pr.yml.
 * Other providers fall through with action='unsupported-provider'.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const DEFAULT_REPO = process.env.GITHUB_REPOSITORY || 'erniesg/tong';

function runGh(args, { dryRun = false } = {}) {
  if (dryRun) return { command: ['gh', ...args].join(' ') };
  const stdout = execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  return { stdout };
}

function isDispatchable(issue, includeUnassigned) {
  if (issue.cloud_mode === 'local-only') return false;
  if (!includeUnassigned && issue.batch_id === 'unassigned') return false;
  return true;
}

function readPrompt(queueDir, issue) {
  const promptPath = issue.generated_files?.task_prompt;
  if (!promptPath) return '';
  return readFileSync(resolve(queueDir, promptPath), 'utf8');
}

const PROVIDER_CONFIG = {
  codex: {
    workflow: 'codex-headless-pr.yml',
    branchPrefix: 'codex/',
  },
  claude: {
    workflow: 'claude-headless-pr.yml',
    branchPrefix: 'claude/',
  },
};

function dispatchProvider({ provider, repo, queueDir, issue, dryRun }) {
  const config = PROVIDER_CONFIG[provider];
  if (!config) {
    return {
      ok: false,
      provider,
      issueRef: issue.issue_ref,
      action: 'unsupported-provider',
      reason: `No trusted dispatch workflow is configured for ${provider}.`,
    };
  }

  const prompt = readPrompt(queueDir, issue);
  if (!prompt) {
    return {
      ok: false,
      provider,
      issueRef: issue.issue_ref,
      action: 'skipped',
      reason: 'missing task prompt',
    };
  }

  const fallbackBranch = `${config.branchPrefix}issue-${issue.number || 'adhoc'}`;
  let branch = issue.branch_name || fallbackBranch;
  if (!branch.startsWith(config.branchPrefix)) {
    branch = `${config.branchPrefix}${branch.replace(/^[\w-]+\//, '')}`;
  }
  const title = issue.draft_pr_title || `fix: ${issue.issue_ref || issue.title}`;
  const result = runGh(
    [
      'workflow',
      'run',
      config.workflow,
      '--repo',
      repo,
      '-f',
      `prompt=${prompt}`,
      '-f',
      'base_branch=main',
      '-f',
      `branch=${branch}`,
      '-f',
      `pr_title=${title}`,
      '-f',
      `issue_ref=${issue.issue_ref || ''}`,
      '-f',
      'route=/game',
      '-f',
      'auto_qa_publish=true',
      '-f',
      'enable_self_heal=true',
    ],
    { dryRun },
  );

  return {
    ok: true,
    provider,
    issueRef: issue.issue_ref,
    action: dryRun ? 'dry-run' : 'workflow-dispatched',
    workflow: config.workflow,
    branch,
    title,
    ...result,
  };
}

function dispatchCodex(args) {
  return dispatchProvider({ ...args, provider: 'codex' });
}

function dispatchClaude(args) {
  return dispatchProvider({ ...args, provider: 'claude' });
}

function printHelp() {
  console.log(`Usage: node scripts/dispatch-remote-agent-queue.mjs --plan <remote-plan.json> [options]

Options:
  --plan <path>           remote-plan.json
  --queue-dir <path>      Queue directory, inferred from --plan by default
  --repo <owner/repo>     GitHub repo (default: ${DEFAULT_REPO})
  --include-unassigned    Dispatch ad-hoc unassigned but cloud-ready issues
  --limit <n>             Max dispatches
  --dry-run               Print dispatches without calling gh
  --output <path>         Write result JSON
  --help                  Show this help`);
}

const { values: args } = parseArgs({
  options: {
    plan: { type: 'string' },
    'queue-dir': { type: 'string' },
    repo: { type: 'string', default: DEFAULT_REPO },
    'include-unassigned': { type: 'boolean', default: false },
    limit: { type: 'string' },
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

if (!args.plan) {
  console.error('Missing --plan.');
  process.exit(1);
}

const planPath = resolve(args.plan);
const queueDir = resolve(args['queue-dir'] || dirname(planPath));
const plan = JSON.parse(readFileSync(planPath, 'utf8'));
const limit = args.limit ? Number.parseInt(args.limit, 10) : Number.POSITIVE_INFINITY;
const selected = (plan.issues || [])
  .filter((issue) => isDispatchable(issue, args['include-unassigned']))
  .slice(0, limit);

const dispatches = selected.map((issue) => {
  const provider = issue.provider?.id || 'codex';
  return dispatchProvider({ provider, repo: args.repo, queueDir, issue, dryRun: args['dry-run'] });
});

const output = {
  ok: dispatches.every((item) => item.ok || item.action === 'unsupported-provider'),
  dryRun: args['dry-run'],
  selectedCount: selected.length,
  dispatchedCount: dispatches.filter((item) => item.action === 'workflow-dispatched').length,
  unsupportedCount: dispatches.filter((item) => item.action === 'unsupported-provider').length,
  dispatches,
};

const json = JSON.stringify(output, null, 2);
if (args.output) {
  const outputPath = resolve(args.output);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${json}\n`);
}
console.log(json);
