function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const KNOWN_PROVIDERS = new Set(["codex", "claude", "external"]);

function normalizeAgentPrRequest(request = {}) {
  const provider = typeof request.provider === "string" ? request.provider.trim().toLowerCase() : "";
  return {
    provider: KNOWN_PROVIDERS.has(provider) ? provider : "",
    prompt_b64: typeof request.prompt_b64 === "string" ? request.prompt_b64 : "",
    base_branch: typeof request.base_branch === "string" ? request.base_branch.trim() : "",
    branch: typeof request.branch === "string" ? request.branch.trim() : "",
    pr_title: typeof request.pr_title === "string" ? request.pr_title.trim() : "",
    issue_ref: typeof request.issue_ref === "string" ? request.issue_ref.trim() : "",
    route: typeof request.route === "string" ? request.route.trim() : "",
    qa_recipe: typeof request.qa_recipe === "string" ? request.qa_recipe.trim() : "",
    attempts: Number.isFinite(request.attempts) ? Math.max(0, Math.trunc(request.attempts)) : 0,
    original_run_url:
      typeof request.original_run_url === "string" ? request.original_run_url.trim() : "",
  };
}

function findHeadingRange(body, heading) {
  const source = body || "";
  const headingRegex = new RegExp(`^##\\s*${escapeRegex(heading)}\\s*$`, "im");
  const match = headingRegex.exec(source);
  if (!match) return null;

  const start = match.index;
  const contentStart = match.index + match[0].length;
  const nextHeadingRegex = /^##\s+/gm;
  nextHeadingRegex.lastIndex = contentStart;
  const nextMatch = nextHeadingRegex.exec(source);

  return {
    start,
    contentStart,
    end: nextMatch ? nextMatch.index : source.length,
  };
}

function parseJsonFence(section) {
  const match = (section || "").match(/```json\s*([\s\S]*?)```/i);
  if (!match) return {};
  try {
    const parsed = JSON.parse(match[1]);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function parseAgentPrRequest(body) {
  const range = findHeadingRange(body, "Agent PR Request");
  if (!range) return {};

  const parsed = parseJsonFence((body || "").slice(range.contentStart, range.end));
  return Object.keys(parsed).length > 0 ? normalizeAgentPrRequest(parsed) : {};
}

function stripAgentPrRequestBlock(body) {
  const range = findHeadingRange(body, "Agent PR Request");
  if (!range) return body || "";

  const before = (body || "").slice(0, range.start).trimEnd();
  const after = (body || "").slice(range.end).trimStart();
  if (before && after) {
    return `${before}\n\n${after}`;
  }
  return before || after || "";
}

function renderAgentPrRequestBlock(request = {}) {
  const normalized = normalizeAgentPrRequest(request);
  if (!normalized.provider) return "";
  return [
    "## Agent PR Request",
    "",
    "<!-- Self-heal pipeline reads this block. The prompt is base64-encoded to keep markdown stable. Edit at your own risk. -->",
    "",
    "```json",
    JSON.stringify(normalized, null, 2),
    "```",
  ].join("\n");
}

function encodePromptB64(prompt) {
  return Buffer.from(String(prompt || ""), "utf8").toString("base64");
}

function decodePromptB64(b64) {
  if (!b64) return "";
  try {
    return Buffer.from(String(b64), "base64").toString("utf8");
  } catch {
    return "";
  }
}

export {
  decodePromptB64,
  encodePromptB64,
  KNOWN_PROVIDERS,
  normalizeAgentPrRequest,
  parseAgentPrRequest,
  renderAgentPrRequestBlock,
  stripAgentPrRequestBlock,
};
