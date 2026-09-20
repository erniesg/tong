import fs from "node:fs";
import path from "node:path";

/**
 * Deterministic portability rules for PM orchestrator.
 *
 * Scores an issue body against the portable-issue requirements defined in
 * docs/agent-native-project-setup.md so a remote agent can pick it up
 * without laptop-only context.
 *
 * Each rule is a regex check on the issue body. Missing rules contribute to
 * the gap list. The score is the number of present rules over the total
 * required, in [0, 1].
 */

const REQUIRED_RULES = [
  {
    id: "route_or_surface",
    label: "Real route or surface under test",
    pattern: /(^|\n)##\s*Real route or surface\s*\n[\s\S]*?\S/i,
    hint: "Add a `## Real route or surface` heading naming the route, e.g. `/game`, `/overlay`, or the surface id.",
  },
  {
    id: "actual_behavior",
    label: "Actual behavior",
    pattern: /(^|\n)##\s*Actual behavior\s*\n[\s\S]*?\S/i,
    hint: "Add a `## Actual behavior` heading describing what currently happens.",
  },
  {
    id: "expected_behavior",
    label: "Expected behavior",
    pattern: /(^|\n)##\s*Expected behavior\s*\n[\s\S]*?\S/i,
    hint: "Add an `## Expected behavior` heading describing the visible acceptance criterion.",
  },
  {
    id: "visible_proof_sequence",
    label: "Visible proof sequence",
    pattern: /(^|\n)##\s*Visible proof sequence\s*\n[\s\S]*?\S/i,
    hint: "Add a `## Visible proof sequence` heading with a numbered list a remote reviewer can replay.",
  },
  {
    id: "remote_dependencies",
    label: "Remote dependencies",
    pattern: /(^|\n)##\s*Remote dependencies\s*\n[\s\S]*?\S/i,
    hint: "Add a `## Remote dependencies` heading. Use `repo-only` if the work needs nothing beyond the checked-out tree.",
  },
  {
    id: "reviewer_proof_required",
    label: "Reviewer proof required",
    pattern: /(^|\n)##\s*Reviewer proof required\s*\n[\s\S]*?\S/i,
    hint: "Add a `## Reviewer proof required` heading naming the proof type: None | Screenshot | Clip | Clip+Trace.",
  },
];

const OPTIONAL_RULES = [
  {
    id: "scenario_seed",
    label: "Scenario seed or checkpoint",
    pattern: /(^|\n)##\s*Scenario seed or checkpoint\s*\n[\s\S]*?\S/i,
    hint: "Add a `## Scenario seed or checkpoint` heading when deterministic setup is required.",
  },
];

const ANTI_PATTERNS = [
  {
    id: "absolute_user_path",
    label: "Absolute user path",
    pattern: /(\/Users\/[A-Za-z0-9_.-]+\/)/,
    hint: "Replace `/Users/...` paths with repo-relative paths or upload the asset to a shared host.",
  },
  {
    id: "laptop_only_clip_path",
    label: "Laptop-only clip path",
    pattern: /(artifacts\/qa-runs\/[^\s)]+\.(mp4|webm|mov))/i,
    hint: "Local `artifacts/qa-runs/...` clips are not reviewer-visible. Upload to `tong-runs` or attach in PR body.",
  },
];

const REPO_PATH_PREFIXES = [
  ".agents/",
  ".claude/",
  ".github/",
  "apps/",
  "assets/",
  "docs/",
  "packages/",
  "scripts/",
  "tests/",
];

const PATH_TOKEN_RE = /(?:^|[\s([{"'])((?:\.agents|\.claude|\.github|apps|assets|docs|packages|scripts|tests)\/[A-Za-z0-9_./*?@+=-]+)(?=$|[\s)\]},.;:'"`])/g;
const BACKTICK_RE = /`([^`\n]+)`/g;
const NPM_RUN_RE = /\bnpm(?:\s+--prefix\s+([^\s]+))?\s+run\s+([A-Za-z0-9:_-]+)/g;
const SCRIPT_CONTEXT_RE = /\b(npm|npm run|package script|package scripts)\b/i;
const NEW_REFERENCE_CONTEXT_RE = /\b(new|add|adds|adding|create|creates|creating|files?\s+to\s+add|new\s+files?|new\s+workflow|new\s+script|new\s+skill)\b/i;
const NEW_BLOCK_RE = /\b(files?\s+to\s+add|new\s+files?|new\s+workflow|new\s+script|new\s+skill|files?\s+in)\b.*:?\s*$/i;

function stripCodeFences(text) {
  return String(text || "").replace(/```[\s\S]*?```/g, "");
}

function splitLinesWithContext(text) {
  const lines = String(text || "").split(/\r?\n/);
  return lines.map((line, index) => ({
    line,
    lineNumber: index + 1,
    previous: lines.slice(Math.max(0, index - 2), index).join("\n"),
  }));
}

function normalizePathReference(raw) {
  let value = String(raw || "").trim();
  if (!value) return null;
  value = value.split(/\s+/)[0];
  value = value.replace(/^['"`([{]+|['"`)\]},.;:]+$/g, "");
  if (value.startsWith("./")) value = value.slice(2);
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return null;
  if (/[<>]/.test(value)) return null;
  if (!REPO_PATH_PREFIXES.some((prefix) => value.startsWith(prefix))) return null;
  return value;
}

function pathTargetForExists(reference) {
  let target = String(reference || "");
  target = target.replace(/[#:]L?\d+$/i, "");
  const globIndex = target.search(/[*?]/);
  if (globIndex >= 0) {
    target = target.slice(0, globIndex);
    target = target.replace(/[^/]*$/, "");
  }
  return target || reference;
}

function isSafeRepoRelativePath(reference) {
  const trimmed = reference.replace(/\/+$/, "");
  const normalized = path.normalize(trimmed);
  return normalized === trimmed;
}

function referenceExists(repoRoot, reference) {
  const target = pathTargetForExists(reference);
  if (!isSafeRepoRelativePath(target) || target.startsWith("../")) return false;
  return fs.existsSync(path.join(repoRoot, target));
}

function referenceHasNewContext(line, previous) {
  return NEW_REFERENCE_CONTEXT_RE.test(`${previous}\n${line}`);
}

function extractPathReferences(text) {
  const references = [];
  const body = stripCodeFences(text);
  let newBlockRemaining = 0;
  for (const { line, lineNumber, previous } of splitLinesWithContext(body)) {
    const trimmedLine = line.trim();
    if (NEW_BLOCK_RE.test(trimmedLine)) {
      newBlockRemaining = 12;
    } else if (newBlockRemaining > 0) {
      if (trimmedLine === "") {
        newBlockRemaining = 0;
      } else {
        newBlockRemaining -= 1;
      }
    }
    const seenOnLine = new Set();
    for (const regex of [BACKTICK_RE, PATH_TOKEN_RE]) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(line)) !== null) {
        const raw = match[1];
        const target = normalizePathReference(raw);
        if (!target || seenOnLine.has(target)) continue;
        seenOnLine.add(target);
        references.push({
          type: "path",
          target,
          line: lineNumber,
          sample: line.trim(),
          declaredNew: newBlockRemaining > 0 || referenceHasNewContext(line, previous),
        });
      }
    }
  }
  return references;
}

function findPackageScriptMap(repoRoot) {
  const packageDirs = [repoRoot];
  for (const parent of ["apps", "packages"]) {
    const parentPath = path.join(repoRoot, parent);
    if (!fs.existsSync(parentPath)) continue;
    for (const entry of fs.readdirSync(parentPath, { withFileTypes: true })) {
      if (entry.isDirectory()) packageDirs.push(path.join(parentPath, entry.name));
    }
  }

  const packages = [];
  for (const dir of packageDirs) {
    const packagePath = path.join(dir, "package.json");
    if (!fs.existsSync(packagePath)) continue;
    try {
      const json = JSON.parse(fs.readFileSync(packagePath, "utf8"));
      packages.push({
        dir,
        relativeDir: path.relative(repoRoot, dir) || ".",
        scripts: json.scripts || {},
      });
    } catch {
      /* ignore malformed package files; other checks will catch them */
    }
  }
  return packages;
}

function packageScriptExists(repoRoot, scriptName, prefix = "") {
  const packages = findPackageScriptMap(repoRoot);
  if (prefix) {
    const normalizedPrefix = prefix.replace(/^\.\/|\/$/g, "");
    const match = packages.find((pkg) => pkg.relativeDir === normalizedPrefix);
    return Boolean(match?.scripts?.[scriptName]);
  }
  return packages.some((pkg) => Boolean(pkg.scripts?.[scriptName]));
}

function extractNpmScriptReferences(text) {
  const references = [];
  const body = stripCodeFences(text);
  for (const { line, lineNumber, previous } of splitLinesWithContext(body)) {
    NPM_RUN_RE.lastIndex = 0;
    let match;
    while ((match = NPM_RUN_RE.exec(line)) !== null) {
      references.push({
        type: "npm_script",
        target: match[2],
        prefix: match[1] || "",
        line: lineNumber,
        sample: line.trim(),
        declaredNew: referenceHasNewContext(line, previous),
      });
    }

    BACKTICK_RE.lastIndex = 0;
    while ((match = BACKTICK_RE.exec(line)) !== null) {
      const target = String(match[1] || "").trim();
      if (!/^[A-Za-z0-9][A-Za-z0-9:_-]*$/.test(target)) continue;
      if (!target.includes(":")) continue;
      if (/^(pm|self-heal|lane|provider|priority|initiative):/.test(target)) continue;
      if (!SCRIPT_CONTEXT_RE.test(line)) continue;
      references.push({
        type: "npm_script",
        target,
        prefix: "",
        line: lineNumber,
        sample: line.trim(),
        declaredNew: referenceHasNewContext(line, previous),
      });
    }
  }
  return references;
}

function validateReferences(body, { repoRoot = process.cwd() } = {}) {
  const pathReferences = extractPathReferences(body);
  const declaredNewPaths = new Set(
    pathReferences.filter((ref) => ref.declaredNew).map((ref) => ref.target),
  );
  const references = [
    ...pathReferences,
    ...extractNpmScriptReferences(body),
  ];
  const seen = new Set();
  const missing = [];
  const present = [];
  const declaredNew = [];

  for (const ref of references) {
    const key = `${ref.type}:${ref.prefix || ""}:${ref.target}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const allowedNew = ref.declaredNew || declaredNewPaths.has(ref.target);
    if (allowedNew) {
      declaredNew.push(ref);
      continue;
    }

    const exists = ref.type === "npm_script"
      ? packageScriptExists(repoRoot, ref.target, ref.prefix)
      : referenceExists(repoRoot, ref.target);
    if (exists) {
      present.push(ref);
    } else {
      missing.push(ref);
    }
  }

  return { present, missing, declaredNew };
}

function evaluateBody(body, options = {}) {
  const text = String(body || "");
  const required = REQUIRED_RULES.map((rule) => ({
    ...rule,
    present: rule.pattern.test(text),
  }));
  const optional = OPTIONAL_RULES.map((rule) => ({
    ...rule,
    present: rule.pattern.test(text),
  }));
  const antiHits = ANTI_PATTERNS.flatMap((rule) => {
    const match = text.match(rule.pattern);
    if (!match) return [];
    return [{ ...rule, sample: match[1] || match[0] }];
  });

  const requiredPresent = required.filter((r) => r.present).length;
  const score = REQUIRED_RULES.length === 0 ? 1 : requiredPresent / REQUIRED_RULES.length;

  const missingRequired = required.filter((r) => !r.present);
  const missingOptional = optional.filter((r) => !r.present);
  const references = validateReferences(text, options);

  return {
    score,
    requiredCount: REQUIRED_RULES.length,
    requiredPresent,
    missingRequired,
    missingOptional,
    antiHits,
    missingReferences: references.missing,
    presentReferences: references.present,
    declaredNewReferences: references.declaredNew,
    isComplete: missingRequired.length === 0
      && antiHits.length === 0
      && references.missing.length === 0,
  };
}

function renderGapComment(evaluation, { issueRef = "", scoredAt = new Date().toISOString() } = {}) {
  const lines = [
    "## PM portability check",
    "",
    `Issue: \`${issueRef || "(unknown)"}\``,
    `Scored at: \`${scoredAt}\``,
    `Score: \`${evaluation.requiredPresent}/${evaluation.requiredCount}\` required sections present.`,
    "",
  ];

  if (
    evaluation.missingRequired.length === 0
    && evaluation.antiHits.length === 0
    && (evaluation.missingReferences || []).length === 0
  ) {
    lines.push("All required sections present, referenced repo paths/scripts resolve, and no anti-patterns detected. Marking `pm:agent-ready`.");
    return lines.join("\n").trim() + "\n";
  }

  if (evaluation.missingRequired.length > 0) {
    lines.push("### Missing required sections");
    for (const rule of evaluation.missingRequired) {
      lines.push(`- **${rule.label}** — ${rule.hint}`);
    }
    lines.push("");
  }

  if (evaluation.missingOptional.length > 0) {
    lines.push("### Recommended (optional) sections");
    for (const rule of evaluation.missingOptional) {
      lines.push(`- ${rule.label} — ${rule.hint}`);
    }
    lines.push("");
  }

  if (evaluation.antiHits.length > 0) {
    lines.push("### Anti-patterns detected");
    for (const hit of evaluation.antiHits) {
      lines.push(`- **${hit.label}** (\`${hit.sample}\`) — ${hit.hint}`);
    }
    lines.push("");
  }

  if ((evaluation.missingReferences || []).length > 0) {
    lines.push("### Missing referenced paths or scripts");
    for (const ref of evaluation.missingReferences) {
      const label = ref.type === "npm_script"
        ? `npm script \`${ref.prefix ? `${ref.prefix}:` : ""}${ref.target}\``
        : `repo path \`${ref.target}\``;
      lines.push(`- **${label}** — line ${ref.line}: ${ref.sample}`);
    }
    lines.push("");
  }

  lines.push(
    "Until these are resolved, the issue is labeled `pm:portability-gap` and will not be auto-dispatched. Remove the label or update the issue body to retrigger the check.",
  );

  return lines.join("\n").trim() + "\n";
}

export {
  ANTI_PATTERNS,
  OPTIONAL_RULES,
  REQUIRED_RULES,
  evaluateBody,
  renderGapComment,
  validateReferences,
};
