import fs from 'node:fs';
import path from 'node:path';

export function assertSafePath(repoRoot, filePath) {
  const resolved = path.resolve(filePath);
  const root = path.resolve(repoRoot);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error(`Path traversal blocked: ${filePath} resolves outside repo root`);
  }
  return resolved;
}

function toFileContext(files, repoRoot) {
  let context = '';
  for (const relativePath of files.slice(0, 3)) {
    const fullPath = assertSafePath(repoRoot, path.join(repoRoot, relativePath));
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.length > 10000) continue;
    context += `\n--- File: ${relativePath} ---\n${content}\n`;
  }
  return context;
}

export function buildFixPrompt(issue, fileContext = '') {
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

export async function generateFix(issue, options = {}) {
  const {
    apiKey,
    model = 'gpt-4o',
    repoRoot,
    componentSearch = async () => [],
    fetchImpl = fetch,
  } = options;

  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  if (!repoRoot) throw new Error('repoRoot is required');

  let fileContext = '';
  if (issue?.affectedComponent) {
    const sanitized = issue.affectedComponent.replace(/[^a-zA-Z0-9._-]/g, '');
    if (sanitized) {
      const files = await componentSearch(sanitized);
      fileContext = toFileContext(files, repoRoot);
    }
  }

  const prompt = buildFixPrompt(issue, fileContext);
  const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
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

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('No response from OpenAI');

  return JSON.parse(content);
}
