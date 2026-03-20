function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeQaPublishRequest(request = {}) {
  return {
    issue_ref: typeof request.issue_ref === "string" ? request.issue_ref.trim() : "",
    run_dir: typeof request.run_dir === "string" ? request.run_dir.trim() : "",
    route: typeof request.route === "string" ? request.route.trim() : "",
    scenario_seed: typeof request.scenario_seed === "string" ? request.scenario_seed.trim() : "",
    checkpoint_id: typeof request.checkpoint_id === "string" ? request.checkpoint_id.trim() : "",
    qa_recipe: typeof request.qa_recipe === "string" ? request.qa_recipe.trim() : "",
    no_auto_evidence_upload: request.no_auto_evidence_upload === true,
  };
}

function mergeQaPublishRequest(defaults = {}, request = {}) {
  const normalizedDefaults = normalizeQaPublishRequest(defaults);
  const normalizedRequest = normalizeQaPublishRequest(request);
  return {
    issue_ref: normalizedRequest.issue_ref || normalizedDefaults.issue_ref,
    run_dir: normalizedRequest.run_dir || normalizedDefaults.run_dir,
    route: normalizedRequest.route || normalizedDefaults.route,
    scenario_seed: normalizedRequest.scenario_seed || normalizedDefaults.scenario_seed,
    checkpoint_id: normalizedRequest.checkpoint_id || normalizedDefaults.checkpoint_id,
    qa_recipe: normalizedRequest.qa_recipe || normalizedDefaults.qa_recipe,
    no_auto_evidence_upload:
      normalizedRequest.no_auto_evidence_upload || normalizedDefaults.no_auto_evidence_upload,
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

function parseQaPublishRequest(body) {
  const range = findHeadingRange(body, "QA Publish Request");
  if (!range) return {};

  const parsed = parseJsonFence((body || "").slice(range.contentStart, range.end));
  return Object.keys(parsed).length > 0 ? normalizeQaPublishRequest(parsed) : {};
}

function stripQaPublishRequestBlock(body) {
  const range = findHeadingRange(body, "QA Publish Request");
  if (!range) return body || "";

  const before = (body || "").slice(0, range.start).trimEnd();
  const after = (body || "").slice(range.end).trimStart();
  if (before && after) {
    return `${before}\n\n${after}`;
  }
  return before || after || "";
}

function renderQaPublishRequestBlock(request = {}) {
  const normalized = normalizeQaPublishRequest(request);
  return [
    "## QA Publish Request",
    "",
    "```json",
    JSON.stringify(normalized, null, 2),
    "```",
  ].join("\n");
}

export {
  mergeQaPublishRequest,
  normalizeQaPublishRequest,
  parseQaPublishRequest,
  renderQaPublishRequestBlock,
  stripQaPublishRequestBlock,
};
