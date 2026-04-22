import { execFileSync } from "node:child_process";

const PROTECTED_PATH_PREFIXES = [
  ".github/workflows/",
  ".github/CODEOWNERS",
  ".github/ISSUE_TEMPLATE/",
  ".agents/skills/",
  "docs/github-agent-bootstrap.md",
  "docs/agent-native-project-setup.md",
  "docs/codex-cloud-issue-runbook.md",
  "docs/deployment-track.md",
  "docs/qa-evidence-uploads.md",
  "scripts/deploy",
  "scripts/release",
  "scripts/healthcheck",
  ".env.example",
  "apps/client/.env.example",
  "apps/client/wrangler.toml",
  "apps/worker/wrangler.toml",
  "packages/contracts/",
];

const LANE_PREFIXES = [
  { lane: "client-ui", prefixes: ["apps/client/app/", "apps/client/components/shell/", "apps/client/components/city-map/", "apps/client/components/hud/", "apps/client/components/learn/", "apps/client/lib/session/", "apps/client/lib/backend/", "apps/client/lib/theme/"] },
  { lane: "client-runtime", prefixes: ["apps/client/app/api/", "apps/client/app/game/GamePageClient.tsx", "apps/client/components/exercises/", "apps/client/components/scene/", "apps/client/lib/ai/", "apps/client/lib/debug/", "apps/client/lib/store/", "apps/client/lib/types/hangout.ts"] },
  { lane: "client-overlay", prefixes: ["apps/client/components/overlay/", "apps/client/components/dictionary/", "apps/client/lib/captions/", "apps/client/lib/dictionary/", "apps/client/lib/romanization/"] },
  { lane: "qa-platform", prefixes: [".agents/skills/", ".agents/skills/_functional-qa/", ".github/ISSUE_TEMPLATE/", "docs/codex-cloud-issue-runbook.md", "docs/qa/", "docs/agent-native-project-setup.md"] },
  { lane: "runtime-assets", prefixes: ["assets/characters/", "assets/game/", "assets/generated/", "assets/manifest/", "docs/qa-evidence-uploads.md", "apps/client/lib/content/characters.ts", "apps/client/lib/content/tong-expressions.ts", "apps/client/components/scene/CharacterSprite.tsx"] },
  { lane: "server-api", prefixes: ["apps/worker/", "apps/server/api/", "apps/server/routes/", "apps/server/controllers/", "apps/server/services/profile/", "apps/server/services/sessions/", "apps/server/services/bootstrap/"] },
  { lane: "server-ingestion", prefixes: ["apps/server/ingestion/", "apps/server/jobs/", "apps/server/services/vocab/", "apps/server/services/media-profile/", "apps/server/services/insights/", "scripts/ingestion/"] },
  { lane: "game-engine", prefixes: ["apps/server/game-engine/", "apps/server/services/game-loop/", "apps/server/services/scenes/", "apps/server/services/rewards/"] },
  { lane: "infra-deploy", prefixes: ["infra/", "scripts/deploy", "scripts/release", "scripts/healthcheck", ".github/workflows/", "docs/deployment-track.md"] },
  { lane: "mock-ui", prefixes: ["apps/client/app/mock/", "apps/client/components/mock/", "apps/client/lib/mock/", "apps/client/public/mock/", "docs/demo-run-of-show.md"] },
  { lane: "creative-assets", prefixes: ["assets/presets/", "assets/content-packs/", "assets/rewards/", "assets/manifest/", "docs/mock-ui-and-assets-track.md"] },
];

const AMBIGUOUS_CATEGORIES = new Set([
  "copy",
  "content",
  "design",
  "ui_layout",
  "unclear_instruction",
  "visual_hierarchy",
  "ux",
]);

const SEVERITY_SCORE = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

function trimText(value, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizePath(value) {
  const text = trimText(value, 400);
  return text.replace(/^\/+/, "");
}

function tokenize(text) {
  return [...new Set(
    trimText(text, 500)
      .toLowerCase()
      .replace(/[^a-z0-9/_.-]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 4)
  )];
}

function pathMatchesPrefix(targetPath, prefix) {
  return targetPath === prefix || targetPath.startsWith(prefix);
}

export function isProtectedPath(filePath) {
  const normalized = normalizePath(filePath);
  return PROTECTED_PATH_PREFIXES.some((prefix) => pathMatchesPrefix(normalized, prefix));
}

export function inferLane(filePath) {
  const normalized = normalizePath(filePath);
  for (const candidate of LANE_PREFIXES) {
    if (candidate.prefixes.some((prefix) => pathMatchesPrefix(normalized, prefix))) {
      return candidate.lane;
    }
  }
  return null;
}

export function buildFindingMarker(findingId) {
  return `<!-- playtest-finding:${findingId} -->`;
}

export function buildIssueCommentMarker(findingId, action) {
  return `<!-- playtest-route:${findingId}:${action} -->`;
}

export function slugify(text, maxLength = 48) {
  return trimText(text, maxLength)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    || "finding";
}

export function branchNameForFinding(finding) {
  const findingId = trimText(finding.findingId, 120) || "finding";
  const suffix = findingId.replace(/^finding_/, "").slice(-12).replace(/[^a-zA-Z0-9-]+/g, "").toLowerCase();
  return `codex/playtest-${suffix || slugify(finding.summary)}`;
}

export function buildIssueTitle(finding) {
  return `Playtest finding: ${trimText(finding.summary, 72) || "Unnamed finding"}`;
}

export function hasRemoteEvidence(finding) {
  return Array.isArray(finding?.artifactLinks) && finding.artifactLinks.some((artifact) => /^https?:\/\//i.test(trimText(artifact?.href, 1000)));
}

export function summarizeScope(finding) {
  const path = normalizePath(finding?.inferredComponent);
  return {
    path: path || null,
    lane: path ? inferLane(path) : null,
    protected: path ? isProtectedPath(path) : false,
  };
}

function sharedTokenScore(issue, finding) {
  const issueTokens = new Set([
    ...tokenize(issue?.title),
    ...tokenize(issue?.body),
  ]);
  const findingTokens = tokenize(`${finding?.summary || ""} ${finding?.description || ""}`);
  if (findingTokens.length === 0) return 0;
  let shared = 0;
  for (const token of findingTokens) {
    if (issueTokens.has(token)) shared += 1;
  }
  return shared / findingTokens.length;
}

export function findIssueMatch(finding, issues = []) {
  const marker = buildFindingMarker(finding.findingId);
  let best = null;

  for (const issue of issues) {
    const title = trimText(issue?.title, 200);
    const body = trimText(issue?.body, 5000);
    if (`${title}\n${body}`.includes(marker)) {
      return { issue, score: 1, reason: "exact_finding_marker" };
    }

    let score = 0;
    if (finding?.inferredComponent && body.includes(trimText(finding.inferredComponent, 400))) {
      score += 0.45;
    }
    score += sharedTokenScore(issue, finding) * 0.55;

    if (!best || score > best.score) {
      best = { issue, score, reason: "summary_component_overlap" };
    }
  }

  return best && best.score >= 0.72 ? best : null;
}

export function chooseRouteDecision({
  finding,
  issues = [],
  confidenceThreshold = 0.82,
  allowDirectPr = true,
}) {
  const summary = trimText(finding?.summary, 500);
  const severity = trimText(finding?.severity, 20).toLowerCase();
  const severityScore = SEVERITY_SCORE[severity] ?? 0;
  const category = trimText(finding?.category, 120).toLowerCase();
  const scope = summarizeScope(finding);
  const issueMatch = findIssueMatch(finding, issues);

  if (!summary) {
    return {
      status: "human_review",
      reason: "missing_summary",
      confidence: 0.55,
      scope,
      issueMatch: null,
    };
  }

  if (scope.protected) {
    return {
      status: "human_review",
      reason: "protected_path_scope",
      confidence: 0.97,
      scope,
      issueMatch,
    };
  }

  if (issueMatch) {
    return {
      status: "update_issue",
      reason: issueMatch.reason,
      confidence: 0.91,
      scope,
      issueMatch,
    };
  }

  if (!hasRemoteEvidence(finding)) {
    return {
      status: "human_review",
      reason: "missing_remote_evidence",
      confidence: 0.84,
      scope,
      issueMatch: null,
    };
  }

  if (AMBIGUOUS_CATEGORIES.has(category)) {
    return {
      status: "human_review",
      reason: "design_or_product_ambiguity",
      confidence: 0.88,
      scope,
      issueMatch: null,
    };
  }

  if (
    allowDirectPr
    && scope.path
    && scope.lane
    && !scope.protected
    && severityScore >= 3
    && !["qa-platform", "infra-deploy", "runtime-assets", "creative-assets"].includes(scope.lane)
  ) {
    return {
      status: "direct_pr",
      reason: "single_lane_non_protected_scope",
      confidence: Math.max(confidenceThreshold, 0.9),
      scope,
      issueMatch: null,
    };
  }

  if (severityScore >= 2) {
    return {
      status: "new_issue",
      reason: scope.path ? "needs_tracked_follow_up" : "missing_component_scope",
      confidence: scope.path ? 0.79 : 0.72,
      scope,
      issueMatch: null,
    };
  }

  return {
    status: "skip",
    reason: "low_signal_or_low_severity",
    confidence: 0.63,
    scope,
    issueMatch: null,
  };
}

export function buildIssueBody({ finding, decision, repository, existingIssueRef = "" }) {
  const marker = buildFindingMarker(finding.findingId);
  const links = (finding.artifactLinks || [])
    .filter((artifact) => artifact?.href)
    .map((artifact) => `- [${trimText(artifact.label, 100) || "artifact"}](${artifact.href})`);
  const issueRefLine = existingIssueRef ? `- Existing tracker: \`${existingIssueRef}\`` : null;
  const componentLine = finding.inferredComponent ? `- Inferred component: \`${finding.inferredComponent}\`` : null;
  const routeLine = `- Orchestrator route: \`${decision.status}\` (${decision.reason}, confidence ${decision.confidence.toFixed(2)})`;

  return [
    marker,
    "",
    `Automated playtest finding routed from \`${repository}#241\`.`,
    "",
    "## Finding",
    `- Finding ID: \`${finding.findingId}\``,
    `- Session: \`${trimText(finding.sessionId, 120)}\``,
    `- Severity: \`${trimText(finding.severity, 20)}\``,
    componentLine,
    routeLine,
    issueRefLine,
    "",
    "## Summary",
    trimText(finding.summary, 500),
    "",
    "## Description",
    trimText(finding.description || finding.summary, 2000),
    "",
    "## Suggested Fix",
    trimText(finding.suggestedFix || "Investigate the failing interaction and add a targeted fix with regression coverage.", 2000),
    "",
    "## Acceptance Checks",
    "- Reproduce the finding from the attached artifact context.",
    "- Apply a scoped fix without crossing protected paths.",
    "- Re-run validation and attach proof of the fixed behavior.",
    "",
    "## Evidence",
    ...(links.length > 0 ? links : ["- No remote artifact links were attached to the finding."]),
  ].filter(Boolean).join("\n");
}

export function buildUpdateComment({ finding, decision, repository, issueRef }) {
  const marker = buildIssueCommentMarker(finding.findingId, "update_issue");
  const links = (finding.artifactLinks || [])
    .filter((artifact) => artifact?.href)
    .map((artifact) => `- [${trimText(artifact.label, 100) || "artifact"}](${artifact.href})`);

  return [
    marker,
    "",
    `Playtest orchestrator matched finding \`${finding.findingId}\` to \`${issueRef}\` from \`${repository}#241\`.`,
    "",
    `- Route reason: \`${decision.reason}\``,
    `- Route confidence: \`${decision.confidence.toFixed(2)}\``,
    `- Session: \`${trimText(finding.sessionId, 120)}\``,
    "",
    `Summary: ${trimText(finding.summary, 500)}`,
    "",
    ...(links.length > 0 ? ["Evidence:", ...links] : ["Evidence: no remote artifact links attached."]),
  ].join("\n");
}

export function buildDirectPrRequest({ finding, decision, repository, baseBranch = "main" }) {
  const branch = branchNameForFinding(finding);
  const summary = trimText(finding.summary, 120);
  const lane = decision.scope?.lane || "unknown";
  const body = [
    `Playtest finding \`${finding.findingId}\` routed to direct PR from \`${repository}#241\`.`,
    "",
    "## Finding",
    `- Session: \`${trimText(finding.sessionId, 120)}\``,
    `- Severity: \`${trimText(finding.severity, 20)}\``,
    `- Inferred component: \`${trimText(finding.inferredComponent, 300)}\``,
    `- Route confidence: \`${decision.confidence.toFixed(2)}\``,
    "",
    "## Constraints",
    `- Stay inside the inferred lane \`${lane}\`.`,
    "- Do not touch protected paths.",
    "- Run validate-issue first and validate-issue --verify-fix before claiming fixed.",
    "- If the change expands beyond a single-lane non-protected scope, stop and route back to human review.",
  ].join("\n");

  const prompt = [
    `Investigate and fix this playtest finding in ${repository}.`,
    "",
    `Finding ID: ${finding.findingId}`,
    `Session: ${trimText(finding.sessionId, 120)}`,
    `Severity: ${trimText(finding.severity, 20)}`,
    `Summary: ${summary}`,
    `Description: ${trimText(finding.description || "", 1500)}`,
    `Suggested fix: ${trimText(finding.suggestedFix || "", 1500)}`,
    `Inferred component: ${trimText(finding.inferredComponent || "", 300)}`,
    `Artifact links: ${(finding.artifactLinks || []).map((artifact) => artifact.href).join(", ")}`,
    "",
    "Constraints:",
    "- Start with .agents/skills/work-github-issues/SKILL.md and validate-issue.",
    "- Keep the fix inside the inferred single-lane scope only.",
    "- Do not touch protected paths.",
    "- Re-run validate-issue --verify-fix before finishing.",
    "- Stop and leave a human-review note if the fix expands beyond the scoped lane.",
  ].join("\n");

  return {
    baseBranch,
    branch,
    prTitle: `[codex] Playtest fix: ${summary.slice(0, 90)}`,
    prBody: body,
    prompt,
  };
}

export function toIssueRef(repository, issueNumber) {
  return `${repository}#${issueNumber}`;
}

export function toPrRef(repository, prNumber) {
  return `${repository}#${prNumber}`;
}

function buildHeaders(token, extra = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    ...extra,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function githubRequest({
  token,
  method = "GET",
  url,
  body,
  fetchImpl = fetch,
}) {
  const response = await fetchImpl(url, {
    method,
    headers: buildHeaders(token, body ? { "Content-Type": "application/json" } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub request failed (${response.status}): ${detail}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function workerRequest({
  apiBase,
  apiToken,
  path,
  method = "GET",
  body,
  fetchImpl = fetch,
}) {
  const response = await fetchImpl(`${apiBase.replace(/\/$/, "")}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Worker request failed (${response.status}): ${detail}`);
  }

  return response.json();
}

export function runGhWorkflow({ args, env = process.env, cwd = process.cwd() }) {
  return execFileSync("gh", args, {
    cwd,
    env,
    encoding: "utf8",
  }).trim();
}
