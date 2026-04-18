#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { assertSafePath, generateFix } from './lib/autofix-core.mjs';

const repoRoot = process.cwd();

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function run(bin, args = [], opts = {}) {
  try {
    return execFileSync(bin, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 120000,
      ...opts,
    }).trim();
  } catch (error) {
    return { error: true, message: error.message, stderr: error.stderr?.trim() || '' };
  }
}

function getIssuePayload(args) {
  if (args['issue-json']) return JSON.parse(args['issue-json']);
  if (args['issue-json-file']) {
    const issuePath = assertSafePath(repoRoot, path.join(repoRoot, args['issue-json-file']));
    return JSON.parse(fs.readFileSync(issuePath, 'utf8'));
  }
  throw new Error('Provide --issue-json or --issue-json-file');
}

async function searchComponent(sanitized) {
  const result = run('grep', [
    '-rl', sanitized,
    'apps/client/components/', 'apps/client/app/',
    '--include=*.tsx', '--include=*.ts',
  ]);
  if (!result || result.error) return [];
  return result.split('\n').filter(Boolean);
}

function applyFix(fix) {
  const targetPath = assertSafePath(repoRoot, path.join(repoRoot, fix.filePath));
  if (!fs.existsSync(targetPath)) {
    throw new Error(`File not found: ${fix.filePath}`);
  }

  const original = fs.readFileSync(targetPath, 'utf8');
  if (!original.includes(fix.searchString)) {
    throw new Error(`Search string not found in ${fix.filePath} — fix may be stale`);
  }

  const updated = original.replace(fix.searchString, fix.replaceString);
  fs.writeFileSync(targetPath, updated);

  const touched = [fix.filePath];
  if (fix.cssAddition) {
    const cssPath = assertSafePath(repoRoot, path.join(repoRoot, 'apps/client/app/globals.css'));
    fs.appendFileSync(cssPath, `\n${fix.cssAddition}\n`);
    touched.push('apps/client/app/globals.css');
  }

  return touched;
}

function runValidation() {
  const tscResult = run('npx', ['tsc', '--noEmit'], {
    cwd: path.join(repoRoot, 'apps/client'),
    timeout: 180000,
  });

  const serverResult = run('node', ['-e', "import('./apps/server/src/index.mjs').then(() => console.log('OK')).catch((e) => { console.error('FAIL:', e.message); process.exit(1); })"]);

  const tscOk = !tscResult?.error && !String(tscResult).includes('error TS');
  const serverOk = !serverResult?.error && String(serverResult).includes('OK');

  return {
    ok: tscOk && serverOk,
    tsc: tscResult,
    server: serverResult,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const issue = getIssuePayload(args);
  const sessionId = args['session-id'] || 'unknown-session';
  const outputPath = args['output'] ? path.join(repoRoot, args.output) : null;

  const fix = await generateFix(issue, {
    apiKey: process.env.OPENAI_API_KEY || '',
    repoRoot,
    componentSearch: searchComponent,
  });

  const result = {
    sessionId,
    issue,
    fix,
    applied: false,
    changedFiles: [],
    validation: { ok: false, tsc: null, server: null },
    status: 'generated',
    generatedAt: new Date().toISOString(),
  };

  if (fix.skip) {
    result.status = 'skipped';
  } else {
    result.changedFiles = applyFix(fix);
    result.applied = true;
    result.validation = runValidation();
    result.status = result.validation.ok ? 'validated' : 'validation_failed';
  }

  const outputJson = JSON.stringify(result, null, 2);
  if (outputPath) {
    const safeOutput = assertSafePath(repoRoot, outputPath);
    fs.mkdirSync(path.dirname(safeOutput), { recursive: true });
    fs.writeFileSync(safeOutput, `${outputJson}\n`);
  }

  process.stdout.write(`${outputJson}\n`);
  if (result.status === 'validation_failed') process.exitCode = 2;
}

main().catch((error) => {
  const payload = {
    status: 'error',
    message: error.message,
    generatedAt: new Date().toISOString(),
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(1);
});
