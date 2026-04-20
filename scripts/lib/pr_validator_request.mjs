function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizePrValidatorRequest(request = {}) {
  const maxRetries = Number(request.max_retries);
  return {
    enabled: request.enabled !== false,
    human_final_approval_required: request.human_final_approval_required !== false,
    max_retries: Number.isInteger(maxRetries) && maxRetries >= 0 ? maxRetries : 2,
  };
}

function mergePrValidatorRequest(defaults = {}, request = {}) {
  const normalizedDefaults = normalizePrValidatorRequest(defaults);
  const normalizedRequest = normalizePrValidatorRequest(request);
  return {
    enabled: normalizedRequest.enabled,
    human_final_approval_required: normalizedRequest.human_final_approval_required,
    max_retries: normalizedRequest.max_retries ?? normalizedDefaults.max_retries,
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

function parsePrValidatorRequest(body) {
  const range = findHeadingRange(body, "PR Validator Request");
  if (!range) return {};

  const parsed = parseJsonFence((body || "").slice(range.contentStart, range.end));
  return Object.keys(parsed).length > 0 ? normalizePrValidatorRequest(parsed) : {};
}

function stripPrValidatorRequestBlock(body) {
  const range = findHeadingRange(body, "PR Validator Request");
  if (!range) return body || "";

  const before = (body || "").slice(0, range.start).trimEnd();
  const after = (body || "").slice(range.end).trimStart();
  if (before && after) {
    return `${before}\n\n${after}`;
  }
  return before || after || "";
}

function renderPrValidatorRequestBlock(request = {}) {
  const normalized = normalizePrValidatorRequest(request);
  return [
    "## PR Validator Request",
    "",
    "```json",
    JSON.stringify(normalized, null, 2),
    "```",
  ].join("\n");
}

export {
  mergePrValidatorRequest,
  normalizePrValidatorRequest,
  parsePrValidatorRequest,
  renderPrValidatorRequestBlock,
  stripPrValidatorRequestBlock,
};
