#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  applyGeneratedFix,
  buildFileContext,
  generateFix,
} from './lib/autofix-core.mjs';

function run(bin, args = [], opts = {}) {
  try {
    return execFileSync(bin, args, {
      encoding: 'utf8',
      timeout: 180000,
      ...opts,
    }).trim();
  } catch (error) {
    return {
      error: true,
      message: error.message,
      stderr: error.stderr?.toString?.().trim() || '',
      stdout: error.stdout?.toString?.().trim() || '',
    };
  }
}

function parseArgs(argv) {
  const args = {
    issueJson: '',
    issueJsonFile: '',
    output: '',
    dryRun: false,
    skipValidation: false,
    repoRoot: process.cwd(),
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--issue-json') args.issueJson = argv[++index] || '';
    else if (arg === '--issue-json-file') args.issueJsonFile = argv[++index] || '';
    else if (arg === '--output') args.output = argv[++index] || '';
    else if (arg === '--repo-root') args.repoRoot = argv[++index] || process.cwd();
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--skip-validation') args.skipValidation = true;
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function usage() {
  return [
    'Usage: node scripts/autofix-from-analysis.mjs [options]',
    '',
    'Required (one):',
    '  --issue-json <json>          Inline triaged issue JSON payload',
    '  --issue-json-file <path>     Path to triaged issue JSON payload',
    '',
    'Optional:',
    '  --output <path>              Write result JSON to this path',
    '  --repo-root <path>           Repo root to operate on (default: cwd)',
    '  --dry-run                    Generate fix but do not write files',
    '  --skip-validation            Skip tsc/server validation after apply',
    '  --help                       Show this help',
  ].join('\n');
}

function loadIssuePayload({ issueJson, issueJsonFile }) {
  if (issueJson) {
    return JSON.parse(issueJson);
  }
  if (issueJsonFile) {
    return JSON.parse(fs.readFileSync(issueJsonFile, 'utf8'));
  }
  throw new Error('Expected --issue-json or --issue-json-file');
}

function validateIssueShape(issue) {
  const required = ['description', 'category', 'severity', 'suggestedFix'];
  const missing = required.filter((key) => issue[key] === undefined || issue[key] === null || issue[key] === '');
  if (missing.length > 0) {
    throw new Error(`Issue payload missing required field(s): ${missing.join(', ')}`);
  }
}

function runValidation(repoRoot) {
  const tsc = run('npx', ['tsc', '--noEmit'], {
    cwd: path.join(repoRoot, 'apps/client'),
    timeout: 240000,
  });

  const server = run('node', ['-e', "import('./apps/server/src/index.mjs').then(() => console.log('OK')).catch((e) => { console.error('FAIL', e.message); process.exit(1); })"], {
    cwd: repoRoot,
    timeout: 120000,
  });

  const tscOk = !tsc?.error && !String(tsc).includes('error TS');
  const serverOk = !server?.error && String(server).includes('OK');

  return {
    tsc: {
      ok: tscOk,
      output: tsc,
    },
    server: {
      ok: serverOk,
      output: server,
    },
    ok: tscOk && serverOk,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }

  const startedAt = new Date().toISOString();
  const repoRoot = path.resolve(args.repoRoot);
  const issue = loadIssuePayload(args);
  validateIssueShape(issue);

  const fileContext = buildFileContext(issue, repoRoot, (bin, binArgs) => run(bin, binArgs, { cwd: repoRoot }));
  const fix = await generateFix(issue, { fileContext });

  const result = {
    ok: false,
    skipped: false,
    startedAt,
    finishedAt: null,
    mode: args.dryRun ? 'dry-run' : 'apply',
    issue,
    fix,
    changedFiles: [],
    validation: null,
    error: null,
  };

  if (fix.skip) {
    result.ok = true;
    result.skipped = true;
    result.finishedAt = new Date().toISOString();
  } else if (args.dryRun) {
    result.ok = true;
    result.changedFiles = [fix.filePath, ...(fix.cssAddition ? ['apps/client/app/globals.css'] : [])];
    result.finishedAt = new Date().toISOString();
  } else {
    const applyResult = applyGeneratedFix({ repoRoot, fix });
    result.changedFiles = applyResult.changedFiles;

    if (!args.skipValidation) {
      result.validation = runValidation(repoRoot);
      result.ok = result.validation.ok;
    } else {
      result.ok = true;
    }

    result.finishedAt = new Date().toISOString();
  }

  if (args.output) {
    fs.writeFileSync(path.resolve(args.output), `${JSON.stringify(result, null, 2)}\n`);
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const failure = {
    ok: false,
    skipped: false,
    error: error.message,
    stack: error.stack,
  };
  process.stdout.write(`${JSON.stringify(failure, null, 2)}\n`);
  process.exit(1);
});
