import { githubRequest, summarizeScope, workerRequest } from "./playtest-orchestrator.mjs";

export const PLAYTEST_QUEUE_DIGEST_MARKER = "<!-- playtest-queue-digest -->";
export const PLAYTEST_QUEUE_ACTIONS = [
  "refresh",
  "hold",
  "retry",
  "approve",
  "reject",
  "route-to-human",
  "force-manual",
];

function trimText(value, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function formatConfidence(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : "n/a";
}

function formatRefs(values = []) {
  const refs = Array.isArray(values)
    ? values.map((value) => trimText(value, 200)).filter(Boolean)
    : [];
  return refs.length > 0 ? refs.join(", ") : "none";
}

export function normalizeQueueAction(value) {
  const normalized = trimText(value, 120).toLowerCase();
  return PLAYTEST_QUEUE_ACTIONS.includes(normalized) ? normalized : "refresh";
}

export function tokenizeCommand(text) {
  if (!text) return [];
  const matches = text.match(/"[^"]*"|'[^']*'|\S+/g);
  return (matches || []).map((token) => {
    if (
      (token.startsWith("\"") && token.endsWith("\"")) ||
      (token.startsWith("'") && token.endsWith("'"))
    ) {
      return token.slice(1, -1);
    }
    return token;
  });
}

export function parsePlaytestQueueCommand(body) {
  const trimmed = trimText(body, 5000);
  if (!trimmed.startsWith("/playtest-queue")) {
    return {
      action: "refresh",
      dryRun: false,
      findingId: "",
      limit: "",
      note: "",
      queueIssueNumber: "",
      requested: false,
    };
  }

  const tokens = tokenizeCommand(trimmed);
  const parsed = {
    action: "refresh",
    dryRun: false,
    findingId: "",
    limit: "",
    note: "",
    queueIssueNumber: "",
    requested: true,
  };

  let index = 1;
  if (tokens[index] && !tokens[index].startsWith("-")) {
    parsed.action = normalizeQueueAction(tokens[index]);
    index += 1;
  }

  for (; index < tokens.length; index += 1) {
    const token = tokens[index];
    const next = tokens[index + 1];
    switch (token) {
      case "--finding-id":
        parsed.findingId = next || "";
        index += 1;
        break;
      case "--limit":
        parsed.limit = next || "";
        index += 1;
        break;
      case "--note":
        parsed.note = next || "";
        index += 1;
        break;
      case "--queue-issue":
        parsed.queueIssueNumber = next || "";
        index += 1;
        break;
      case "--dry-run":
        parsed.dryRun = true;
        break;
      default:
        break;
    }
  }

  return parsed;
}

export function queueBucketForFinding(finding) {
  if (finding?.manualOverride?.active || finding?.routeState?.status === "human_review") {
    return "blocked";
  }

  switch (finding?.routeState?.status) {
    case "direct_pr":
    case "new_issue":
    case "update_issue":
      return "in_progress";
    case "skip":
    case "done":
      return "completed";
    case "unrouted":
    default:
      return "pending";
  }
}

export function summarizeQueue(findings = []) {
  const summary = {
    blocked: 0,
    completed: 0,
    in_progress: 0,
    pending: 0,
  };

  for (const finding of findings) {
    summary[queueBucketForFinding(finding)] += 1;
  }

  return summary;
}

export function executorForFinding(finding) {
  if (finding?.manualOverride?.active) {
    return trimText(finding.manualOverride.actor, 120) || "human";
  }
  if (finding?.routeState?.status === "unrouted") {
    return "unassigned";
  }
  if (finding?.routeState?.status === "human_review") {
    return "human";
  }
  return "playtest-orchestrator";
}

export function nextActionForFinding(finding) {
  const bucket = queueBucketForFinding(finding);
  if (bucket === "blocked") {
    return "maintainer review or manual handoff";
  }

  switch (finding?.routeState?.status) {
    case "unrouted":
      return "run the orchestrator";
    case "direct_pr":
      return finding?.linkedRefs?.prRefs?.length ? "review linked PR" : "dispatch or wait for Codex PR";
    case "new_issue":
    case "update_issue":
      return finding?.linkedRefs?.issueRefs?.length ? "work the linked issue" : "check routed issue creation";
    case "skip":
    case "done":
      return "none";
    default:
      return "inspect queue state";
  }
}

export function buildManualTaskPrompt({ finding, repository }) {
  const scope = summarizeScope(finding);
  const refs = [
    ...(finding?.linkedRefs?.issueRefs || []),
    ...(finding?.linkedRefs?.prRefs || []),
  ].filter(Boolean);

  return [
    `Work playtest finding ${trimText(finding?.findingId, 120)} in ${repository}.`,
    "",
    "Use this queued finding as the source of truth.",
    `- Summary: ${trimText(finding?.summary, 500)}`,
    `- Severity: ${trimText(finding?.severity, 40) || "unknown"}`,
    `- Route status: ${trimText(finding?.routeState?.status, 80) || "unknown"}`,
    `- Route reason: ${trimText(finding?.routeState?.reason, 300) || "none"}`,
    `- Route confidence: ${formatConfidence(finding?.routeState?.confidence)}`,
    `- Inferred component: ${trimText(finding?.inferredComponent, 300) || "unknown"}`,
    `- Inferred lane: ${scope?.lane || "unknown"}`,
    `- Protected path: ${scope?.protected ? "yes" : "no"}`,
    `- Existing refs: ${refs.length > 0 ? refs.join(", ") : "none"}`,
    `- Artifact links: ${(finding?.artifactLinks || []).map((artifact) => artifact.href).join(", ") || "none"}`,
    "",
    "Constraints:",
    "- Keep scope aligned to the queued finding only.",
    "- Respect protected-path review for workflow, contract, and control-plane files.",
    "- Validate before claiming fixed and include reviewer-visible evidence or a precise blocker.",
    "- If the finding is ambiguous or spills across lanes, route it back to human review instead of guessing.",
  ].join("\n");
}

function renderFindingEntry(finding, repository) {
  const scope = summarizeScope(finding);
  const refs = [
    ...(finding?.linkedRefs?.issueRefs || []),
    ...(finding?.linkedRefs?.prRefs || []),
  ].filter(Boolean);
  const lines = [
    `- \`${trimText(finding?.findingId, 120)}\` ${trimText(finding?.summary, 180) || "Unnamed finding"}`,
    `  - route: \`${trimText(finding?.routeState?.status, 80) || "unknown"}\` (${trimText(finding?.routeState?.reason, 240) || "no reason"}, confidence ${formatConfidence(finding?.routeState?.confidence)})`,
    `  - executor: \`${executorForFinding(finding)}\``,
    `  - next action: ${nextActionForFinding(finding)}`,
    `  - lane: \`${scope?.lane || "unknown"}\`${scope?.protected ? " protected-path" : ""}`,
    `  - refs: ${refs.length > 0 ? refs.join(", ") : "none"}`,
  ];

  if (finding?.manualOverride?.active) {
    lines.push(
      `  - override: \`${trimText(finding.manualOverride.status, 80) || "unknown"}\` by \`${trimText(finding.manualOverride.actor, 120) || "human"}\` (${trimText(finding.manualOverride.reason, 240) || "no reason"})`,
    );
  }

  lines.push(
    "",
    `<details><summary>Manual Codex/Claude prompt for \`${trimText(finding?.findingId, 120)}\`</summary>`,
    "",
    "```text",
    buildManualTaskPrompt({ finding, repository }),
    "```",
    "",
    "</details>",
  );

  return lines.join("\n");
}

export function renderQueueDigest({
  findings = [],
  generatedAt = new Date().toISOString(),
  queueIssueNumber,
  repository,
}) {
  const summary = summarizeQueue(findings);
  const sections = {
    pending: [],
    in_progress: [],
    blocked: [],
    completed: [],
  };

  for (const finding of findings) {
    sections[queueBucketForFinding(finding)].push(renderFindingEntry(finding, repository));
  }

  const lines = [
    PLAYTEST_QUEUE_DIGEST_MARKER,
    "",
    "## Playtest Queue Digest",
    "",
    `- Generated: \`${generatedAt}\``,
    `- Queue issue: ${queueIssueNumber ? `#${queueIssueNumber}` : "not configured"}`,
    `- Findings shown: \`${findings.length}\``,
    "",
    "### Status Summary",
    `- Pending: \`${summary.pending}\``,
    `- In progress: \`${summary.in_progress}\``,
    `- Blocked: \`${summary.blocked}\``,
    `- Completed: \`${summary.completed}\``,
    "",
    "### Trusted Commands",
    "- `/playtest-queue refresh`",
    "- `/playtest-queue hold --finding-id <id> --note \"reason\"`",
    "- `/playtest-queue retry --finding-id <id>`",
    "- `/playtest-queue approve --finding-id <id> --note \"reason\"`",
    "- `/playtest-queue reject --finding-id <id> --note \"reason\"`",
    "- `/playtest-queue route-to-human --finding-id <id> --note \"reason\"`",
    "- `/playtest-queue force-manual --finding-id <id> --note \"reason\"`",
  ];

  for (const [bucket, title] of [
    ["pending", "Pending"],
    ["in_progress", "In Progress"],
    ["blocked", "Blocked"],
    ["completed", "Completed"],
  ]) {
    lines.push("", `### ${title}`);
    if (sections[bucket].length === 0) {
      lines.push("- None.");
    } else {
      lines.push(...sections[bucket]);
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

export async function upsertQueueDigestComment({
  body,
  issueNumber,
  repo,
  token,
  fetchImpl = fetch,
}) {
  const comments = await githubRequest({
    token,
    url: `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments?per_page=100`,
    fetchImpl,
  });
  const existing = (comments || []).find((comment) => String(comment.body || "").includes(PLAYTEST_QUEUE_DIGEST_MARKER));

  if (existing?.id) {
    return githubRequest({
      token,
      method: "PATCH",
      url: `https://api.github.com/repos/${repo}/issues/comments/${existing.id}`,
      body: { body },
      fetchImpl,
    });
  }

  return githubRequest({
    token,
    method: "POST",
    url: `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`,
    body: { body },
    fetchImpl,
  });
}

export async function applyQueueAction({
  action,
  actor = "playtest-queue",
  apiBase,
  apiToken,
  fetchImpl = fetch,
  findingId,
  note = "",
}) {
  if (normalizeQueueAction(action) === "refresh") {
    return null;
  }

  const safeFindingId = trimText(findingId, 120);
  if (!safeFindingId) {
    throw new Error(`Action ${action} requires --finding-id.`);
  }

  const reasonMap = {
    approve: "approved_by_human",
    "force-manual": "force_manual_handoff",
    hold: "hold_requested",
    reject: "rejected_by_human",
    "route-to-human": "routed_to_human",
  };
  const statusMap = {
    approve: "done",
    "force-manual": "human_review",
    hold: "human_review",
    reject: "skip",
    "route-to-human": "human_review",
  };

  if (action === "retry") {
    await workerRequest({
      apiBase,
      apiToken,
      path: `/api/v1/playtest/findings/${safeFindingId}/retry`,
      method: "POST",
      body: { actor },
      fetchImpl,
    });
    return workerRequest({
      apiBase,
      apiToken,
      path: `/api/v1/playtest/findings/${safeFindingId}/override`,
      method: "PUT",
      body: {
        active: false,
        actor,
        note: trimText(note, 1000) || null,
      },
      fetchImpl,
    });
  }

  return workerRequest({
    apiBase,
    apiToken,
    path: `/api/v1/playtest/findings/${safeFindingId}/override`,
    method: "PUT",
    body: {
      active: true,
      actor,
      confidence: 1,
      note: trimText(note, 1000) || null,
      reason: reasonMap[action] || "manual_override",
      status: statusMap[action] || "human_review",
    },
    fetchImpl,
  });
}
