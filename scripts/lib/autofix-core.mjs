import fs from 'node:fs';
import path from 'node:path';

function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY || '';
}

function assertSafePath(filePath, repoRoot) {
  const resolved = path.resolve(filePath);
  const root = path.resolve(repoRoot);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error(`Path traversal blocked: ${filePath} resolves outside repo root`);
  }
  return resolved;
}

function normalizeFixPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid fix payload from model');
  }

  if (payload.skip) {
    return {
      skip: true,
      reason: payload.reason || 'Model requested skip without reason.',
    };
  }

  if (!payload.filePath || !payload.searchString || !payload.replaceString) {
    throw new Error('Fix payload missing one of: filePath, searchString, replaceString');
  }

  return {
    skip: false,
    filePath: payload.filePath,
    searchString: payload.searchString,
    replaceString: payload.replaceString,
    explanation: payload.explanation || 'Automated fix update.',
    cssAddition: payload.cssAddition || null,
  };
}

function buildPrompt(issue, fileContext) {
  return `You are fixing a bug in a Next.js 14 + TypeScript language learning game called Tong.

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
}

export function buildFileContext(issue, repoRoot, runCommand) {
  let fileContext = '';
  if (!issue?.affectedComponent) {
    return fileContext;
  }

  const sanitized = issue.affectedComponent.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!sanitized) {
    return fileContext;
  }

  const searchResult = runCommand('grep', [
    '-rl', sanitized,
    'apps/client/components/', 'apps/client/app/',
    '--include=*.tsx', '--include=*.ts',
  ]);

  if (!searchResult || searchResult.error) {
    return fileContext;
  }

  const files = searchResult.split('\n').filter(Boolean).slice(0, 3);
  for (const file of files) {
    try {
      const fullPath = assertSafePath(path.join(repoRoot, file), repoRoot);
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.length < 10000) {
        fileContext += `\n--- File: ${file} ---\n${content}\n`;
      }
    } catch {
      // Ignore inaccessible or out-of-root files
    }
  }

  return fileContext;
}

export async function generateFix(issue, options = {}) {
  const {
    model = process.env.TONG_AUTOFIX_OPENAI_MODEL || 'gpt-4o',
    fileContext = '',
  } = options;

  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const prompt = buildPrompt(issue, fileContext);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  return normalizeFixPayload(JSON.parse(content));
}

export function applyGeneratedFix({ repoRoot, fix }) {
  const filePath = assertSafePath(path.join(repoRoot, fix.filePath), repoRoot);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${fix.filePath}`);
  }

  const original = fs.readFileSync(filePath, 'utf8');
  if (!original.includes(fix.searchString)) {
    throw new Error(`Search string not found in ${fix.filePath} — fix may be stale`);
  }

  const updated = original.replace(fix.searchString, fix.replaceString);
  fs.writeFileSync(filePath, updated);

  const changedFiles = [fix.filePath];

  if (fix.cssAddition) {
    const cssPath = assertSafePath(path.join(repoRoot, 'apps/client/app/globals.css'), repoRoot);
    fs.appendFileSync(cssPath, `\n${fix.cssAddition}\n`);
    changedFiles.push('apps/client/app/globals.css');
  }

  return {
    changedFiles,
    targetFile: fix.filePath,
  };
}
