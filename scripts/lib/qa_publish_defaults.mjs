function normalizeIssueRef(raw, repo) {
  const value = (raw || "").trim();
  if (!value) return "";
  const fullMatch = value.match(/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)#(\d+)/);
  if (fullMatch) {
    return `${fullMatch[1]}#${fullMatch[2]}`;
  }
  const shortMatch = value.match(/#(\d+)/);
  if (shortMatch && repo) {
    return `${repo}#${shortMatch[1]}`;
  }
  return "";
}

function inferIssueRef({ repo, title = "", body = "", headRef = "" }) {
  const candidates = [title, body, headRef];

  for (const candidate of candidates) {
    const normalized = normalizeIssueRef(candidate, repo);
    if (normalized) return normalized;
  }

  const branchMatch = headRef.match(/(?:^|[/-])issue-(\d+)(?:[-/]|$)/i);
  if (branchMatch && repo) {
    return `${repo}#${branchMatch[1]}`;
  }

  return "";
}

function defaultPublishRequest({ issueRef = "", title = "", headRef = "" }) {
  const numberMatch = issueRef.match(/#(\d+)$/);
  const issueNumber = numberMatch ? numberMatch[1] : "";
  const signature = `${title} ${headRef}`.toLowerCase();

  switch (issueNumber) {
    case "49":
      return {
        route: "/game",
        qa_recipe: "issue_49_checkpoint_resume",
      };
    case "52":
      return {
        route: "/game",
        qa_recipe: "issue_52_progression_persistence",
      };
    case "51":
      if (signature.includes("scenario-seed-api") || signature.includes("part 1")) {
        return {
          route: "/game",
          scenario_seed: "review_ready",
          qa_recipe: "issue_51_scenario_seed_api",
        };
      }
      if (
        signature.includes("scenario-seed-mount")
        || signature.includes("scenario seed mount")
        || signature.includes("part 2")
      ) {
        return {
          route: "/game",
          scenario_seed: "review_ready",
          qa_recipe: "issue_51_scenario_seed_mount",
        };
      }
      return {
        route: "/game",
      };
    case "50":
      return {
        route: "/game",
      };
    default:
      return {};
  }
}

export {
  defaultPublishRequest,
  inferIssueRef,
};
