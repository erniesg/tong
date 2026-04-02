/**
 * Auto-fix pipeline — takes a triaged issue, generates a fix, validates, and creates a PR.
 *
 * Flow:
 *   1. Create a git branch from main
 *   2. Generate fix code via AI (OpenAI)
 *   3. Apply the fix
 *   4. Run validation (tsc --noEmit, server module check)
 *   5. Commit + push
 *   6. Create PR via gh CLI
 *   7. Return PR URL for human QA
 *
 * Designed to be called from the tool invocation layer.
 * Requires: git, gh CLI, and OPENAI_API_KEY for code generation.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// ── Configuration ────────────────────────────────────────────────────

const OPENAI_API_KEY = () => process.env.OPENAI_API_KEY || '';
const REPO_ROOT = process.env.TONG_REPO_ROOT || execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();

// In-memory fix job tracker
const fixJobs = new Map();

// Mutex to prevent concurrent git operations
let gitLock = null;

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Validate that a resolved path stays within REPO_ROOT.
 * Prevents path traversal (e.g. "../../etc/passwd").
 */
function assertSafePath(filePath) {
  const resolved = path.resolve(filePath);
  const root = path.resolve(REPO_ROOT);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error(`Path traversal blocked: ${filePath} resolves outside repo root`);
  }
  return resolved;
}

/**
 * Run a git/CLI command safely using execFileSync (no shell interpolation).
 * @param {string} bin – executable name
 * @param {string[]} args – argument array
 * @param {object} [opts]
 */
function run(bin, args = [], opts = {}) {
  try {
    return execFileSync(bin, args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      timeout: 60000,
      ...opts,
    }).trim();
  } catch (err) {
    return { error: true, message: err.message, stderr: err.stderr?.trim() };
  }
}

function generateBranchName(issue) {
  const slug = (issue.description || 'fix')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)
    .replace(/-+$/, '');
  return `autofix/${slug}-${Date.now().toString(36)}`;
}

// ── 1. Generate Fix via AI ──────────────────────────────────────────

/**
 * Ask OpenAI to generate a code fix for the given issue.
 * Returns { filePath, original, fixed, explanation }.
 */
async function generateFix(issue) {
  const apiKey = OPENAI_API_KEY();
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  // Read the affected file if we know it
  let fileContext = '';
  if (issue.affectedComponent) {
    // Sanitize: only allow alphanumeric, hyphens, underscores, dots
    const sanitized = issue.affectedComponent.replace(/[^a-zA-Z0-9._-]/g, '');
    if (sanitized) {
      const searchResult = run('grep', [
        '-rl', sanitized,
        'apps/client/components/', 'apps/client/app/',
        '--include=*.tsx', '--include=*.ts',
      ]);
      if (searchResult && !searchResult.error) {
        const files = searchResult.split('\n').filter(Boolean).slice(0, 3);
        for (const f of files) {
          try {
            const fullPath = assertSafePath(path.join(REPO_ROOT, f));
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.length < 10000) {
              fileContext += `\n--- File: ${f} ---\n${content}\n`;
            }
          } catch { /* skip files outside repo root */ }
        }
      }
    }
  }

  const prompt = `You are fixing a bug in a Next.js 14 + TypeScript language learning game called Tong.

Issue from playtest analysis:
- Category: ${issue.category}
- Severity: ${issue.severity}/5
- Description: ${issue.description}
- What user expected: ${issue.whatUserExpected || 'not specified'}
- What actually happened: ${issue.whatActuallyHappened || 'not specified'}
- Suggested fix: ${issue.suggestedFix}
- Affected component: ${issue.affectedComponent || 'unknown'}

${fileContext ? `Relevant source code:\n${fileContext}` : 'No source files found for this component.'}

Conventions:
- Plain CSS classes in globals.css, NOT Tailwind utilities
- Functional components with hooks
- Game state via singleton store (dispatch / useGameState)

Respond with a JSON object:
{
  "filePath": "relative path from repo root",
  "searchString": "exact string to find and replace (include enough context to be unique)",
  "replaceString": "the fixed code",
  "explanation": "one sentence explaining the fix",
  "cssAddition": "optional CSS to append to globals.css, or null"
}

If you cannot determine a fix, respond with: { "skip": true, "reason": "..." }`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No response from OpenAI');

  return JSON.parse(content);
}

// ── 2. Apply, Validate, PR ──────────────────────────────────────────

/**
 * Full auto-fix pipeline for a single issue.
 *
 * @param {object} args
 * @param {string} args.sessionId     – Playtest session this came from
 * @param {object} args.issue         – The triaged issue object
 * @param {boolean} [args.dryRun]     – If true, generate fix but don't commit/PR
 * @returns {Promise<{ jobId, status, branch?, pr?, fix?, error? }>}
 */
export async function runAutoFix(args) {
  const { sessionId, issue, dryRun } = args;
  const jobId = `fix-${Date.now().toString(36)}`;
  const job = {
    jobId,
    sessionId,
    issue,
    status: 'generating',
    startedAt: new Date().toISOString(),
  };
  fixJobs.set(jobId, job);

  // Acquire git lock — only one autofix can run at a time
  if (gitLock) {
    job.status = 'error';
    job.error = 'Another auto-fix is already in progress';
    fixJobs.set(jobId, job);
    return job;
  }

  try {
    // Step 1: Generate fix
    const fix = await generateFix(issue);
    job.fix = fix;

    if (fix.skip) {
      job.status = 'skipped';
      job.reason = fix.reason;
      fixJobs.set(jobId, job);
      return job;
    }

    if (dryRun) {
      job.status = 'dry_run';
      fixJobs.set(jobId, job);
      return job;
    }

    // Validate fix.filePath before any git operations
    const filePath = assertSafePath(path.join(REPO_ROOT, fix.filePath));

    // Acquire lock for git operations
    gitLock = jobId;

    // Step 2: Create branch
    const branch = generateBranchName(issue);
    job.branch = branch;
    job.status = 'applying';
    fixJobs.set(jobId, job);

    run('git', ['stash', '--include-untracked']);
    const branchResult = run('git', ['checkout', '-b', branch, 'main']);
    if (branchResult?.error) {
      run('git', ['stash', 'pop']);
      throw new Error(`Failed to create branch: ${branchResult.message}`);
    }

    // Step 3: Apply fix
    if (!fs.existsSync(filePath)) {
      run('git', ['checkout', 'main']);
      run('git', ['stash', 'pop']);
      throw new Error(`File not found: ${fix.filePath}`);
    }

    let content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes(fix.searchString)) {
      run('git', ['checkout', 'main']);
      run('git', ['stash', 'pop']);
      throw new Error(`Search string not found in ${fix.filePath} — fix may be stale`);
    }

    content = content.replace(fix.searchString, fix.replaceString);
    fs.writeFileSync(filePath, content);

    // Apply CSS if needed
    if (fix.cssAddition) {
      const cssPath = assertSafePath(path.join(REPO_ROOT, 'apps/client/app/globals.css'));
      fs.appendFileSync(cssPath, `\n${fix.cssAddition}\n`);
    }

    // Step 4: Validate
    job.status = 'validating';
    fixJobs.set(jobId, job);

    const tscResult = run('npx', ['tsc', '--noEmit'], { cwd: path.join(REPO_ROOT, 'apps/client'), timeout: 120000 });
    const serverResult = run('node', ['-e', "import('./apps/server/src/index.mjs').then(() => console.log('OK')).catch(e => console.error('FAIL:', e.message))"]);

    const tscOk = !tscResult?.error && !tscResult?.includes('error TS');
    const serverOk = !serverResult?.error && serverResult?.includes?.('OK');

    // If validation fails, revert
    if (!tscOk || !serverOk) {
      run('git', ['checkout', '--', '.']);
      run('git', ['checkout', 'main']);
      run('git', ['stash', 'pop']);
      job.status = 'validation_failed';
      job.validationErrors = { tsc: tscResult, server: serverResult };
      fixJobs.set(jobId, job);
      return job;
    }

    // Step 5: Commit + push
    job.status = 'committing';
    fixJobs.set(jobId, job);

    run('git', ['add', fix.filePath]);
    if (fix.cssAddition) run('git', ['add', 'apps/client/app/globals.css']);

    const commitMsg = [
      `fix(autofix): ${fix.explanation}`,
      '',
      `Playtest session: ${sessionId}`,
      `Category: ${issue.category}`,
      `Severity: ${issue.severity}/5`,
      '',
      'Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>',
    ].join('\n');
    run('git', ['commit', '-m', commitMsg]);

    const pushResult = run('git', ['push', '-u', 'origin', branch]);
    if (pushResult?.error) {
      job.status = 'push_failed';
      job.error = pushResult.message;
      run('git', ['checkout', 'main']);
      run('git', ['stash', 'pop']);
      fixJobs.set(jobId, job);
      return job;
    }

    // Step 6: Create PR
    job.status = 'creating_pr';
    fixJobs.set(jobId, job);

    const prBody = [
      '## Auto-fix from playtest triage',
      '',
      `**Session:** ${sessionId}`,
      `**Category:** ${issue.category}`,
      `**Severity:** ${issue.severity}/5`,
      '',
      '### Issue',
      issue.description,
      '',
      '### Fix',
      fix.explanation,
      '',
      '### File changed',
      `\`${fix.filePath}\``,
      '',
      '### Validation',
      '- TypeScript: passed',
      '- Server load: passed',
      '',
      '---',
      'Generated by Tong auto-fix pipeline from playtest session analysis.',
    ].join('\n');

    const prTitle = `fix(autofix): ${fix.explanation}`;
    const prResult = run('gh', ['pr', 'create', '--title', prTitle, '--body', prBody, '--base', 'main']);

    // Switch back to main
    run('git', ['checkout', 'main']);
    run('git', ['stash', 'pop']);

    if (prResult?.error) {
      job.status = 'pr_failed';
      job.error = prResult.message;
    } else {
      job.status = 'completed';
      job.pr = prResult;
    }

    fixJobs.set(jobId, job);
    return job;
  } catch (err) {
    job.status = 'error';
    job.error = err.message;
    // Try to return to main
    try {
      run('git', ['checkout', 'main']);
      run('git', ['stash', 'pop']);
    } catch { /* best effort */ }
    fixJobs.set(jobId, job);
    return job;
  } finally {
    gitLock = null;
  }
}

// ── Status helpers ──────────────────────────────────────────────────

export function getAutoFixJob(jobId) {
  return fixJobs.get(jobId) || null;
}

export function listAutoFixJobs() {
  return [...fixJobs.values()].sort(
    (a, b) => new Date(b.startedAt) - new Date(a.startedAt),
  );
}

export function getAutoFixStatus() {
  return {
    openaiKeyConfigured: Boolean(OPENAI_API_KEY()),
    repoRoot: REPO_ROOT,
    jobCount: fixJobs.size,
    locked: Boolean(gitLock),
    ghAvailable: !run('which', ['gh'])?.error,
  };
}
