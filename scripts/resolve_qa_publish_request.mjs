#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";
import { spawnSync } from "node:child_process";

const MAINTAINER_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readEventPayload() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) fail("GITHUB_EVENT_PATH is required.");
  return JSON.parse(fs.readFileSync(eventPath, "utf8"));
}

function runGhApi(pathname) {
  const result = spawnSync("gh", ["api", pathname], {
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim() || "gh api failed";
    fail(`Failed to fetch GitHub context: ${detail}`);
  }
  return JSON.parse(result.stdout);
}

function parseBoolean(value) {
  if (typeof value !== "string") return false;
  return TRUE_VALUES.has(value.trim().toLowerCase());
}

function tokenizeCommand(text) {
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

function parseCommandFlags(body) {
  const trimmed = (body || "").trim();
  if (!trimmed.startsWith("/qa-publish")) {
    return { requested: false };
  }

  const tokens = tokenizeCommand(trimmed);
  const flags = {
    requested: true,
    no_auto_evidence_upload: false,
    force: false,
    dry_run: false,
  };

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    const next = tokens[index + 1];
    switch (token) {
      case "--run-dir":
        flags.run_dir = next || "";
        index += 1;
        break;
      case "--issue-ref":
        flags.issue_ref = next || "";
        index += 1;
        break;
      case "--route":
        flags.route = next || "";
        index += 1;
        break;
      case "--scenario-seed":
        flags.scenario_seed = next || "";
        index += 1;
        break;
      case "--checkpoint-id":
        flags.checkpoint_id = next || "";
        index += 1;
        break;
      case "--no-auto-evidence-upload":
        flags.no_auto_evidence_upload = true;
        break;
      case "--force":
        flags.force = true;
        break;
      case "--dry-run":
        flags.dry_run = true;
        break;
      default:
        break;
    }
  }

  return flags;
}

function parsePrMetadata(body) {
  const match = (body || "").match(/##\s*QA Publish Request\s*```json\s*([\s\S]*?)```/i);
  if (!match) return {};

  try {
    const parsed = JSON.parse(match[1]);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function output(name, value) {
  const rendered = value == null ? "" : String(value);
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    fs.appendFileSync(outputPath, `${name}<<__CODEx__\n${rendered}\n__CODEx__\n`);
  } else {
    process.stdout.write(`${name}=${rendered}\n`);
  }
}

function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const eventName = process.env.GITHUB_EVENT_NAME;
  if (!repo) fail("GITHUB_REPOSITORY is required.");

  const event = readEventPayload();
  const workflowInputs = event.inputs || {};

  let shouldRun = true;
  let reason = "";
  let prNumber = "";
  let commentFlags = {
    requested: false,
    no_auto_evidence_upload: false,
    force: false,
    dry_run: false,
  };

  let pr = null;

  if (eventName === "issue_comment") {
    const issue = event.issue || {};
    const comment = event.comment || {};
    commentFlags = parseCommandFlags(comment.body || "");
    if (!issue.pull_request) {
      shouldRun = false;
      reason = "Comment is not attached to a pull request.";
    } else if (!commentFlags.requested) {
      shouldRun = false;
      reason = "Comment did not request /qa-publish.";
    } else if (!MAINTAINER_ASSOCIATIONS.has(comment.author_association || "")) {
      shouldRun = false;
      reason = `Comment author association \`${comment.author_association || "UNKNOWN"}\` is not allowed to trigger trusted publish.`;
    } else {
      prNumber = String(issue.number || "");
    }
  } else if (eventName === "workflow_dispatch") {
    prNumber = String(workflowInputs.pr_number || "");
    if (!prNumber) {
      shouldRun = false;
      reason = "workflow_dispatch requires pr_number.";
    }
  } else if (eventName === "pull_request") {
    pr = event.pull_request || null;
    prNumber = String(pr?.number || "");
    const prMetadata = parsePrMetadata(pr?.body || "");
    const hasMetadata = Boolean(prMetadata.issue_ref || prMetadata.run_dir || prMetadata.qa_recipe);
    if (!prNumber) {
      shouldRun = false;
      reason = "pull_request event payload is missing pull_request.number.";
    } else if (!hasMetadata) {
      shouldRun = false;
      reason = "Pull request body does not contain a QA Publish Request block.";
    }
  } else {
    shouldRun = false;
    reason = `Unsupported event ${eventName || "unknown"}.`;
  }

  if (shouldRun) {
    pr = pr || runGhApi(`repos/${repo}/pulls/${prNumber}`);
  }

  const prMetadata = pr ? parsePrMetadata(pr.body || "") : {};
  const merged = {
    issue_ref: workflowInputs.issue_ref || commentFlags.issue_ref || prMetadata.issue_ref || "",
    run_dir: workflowInputs.run_dir || commentFlags.run_dir || prMetadata.run_dir || "",
    route: workflowInputs.route || commentFlags.route || prMetadata.route || "",
    scenario_seed:
      workflowInputs.scenario_seed || commentFlags.scenario_seed || prMetadata.scenario_seed || "",
    checkpoint_id:
      workflowInputs.checkpoint_id || commentFlags.checkpoint_id || prMetadata.checkpoint_id || "",
    qa_recipe: workflowInputs.qa_recipe || prMetadata.qa_recipe || "",
    no_auto_evidence_upload:
      parseBoolean(workflowInputs.no_auto_evidence_upload) ||
      commentFlags.no_auto_evidence_upload ||
      parseBoolean(String(prMetadata.no_auto_evidence_upload || "")),
    force:
      parseBoolean(workflowInputs.force) ||
      commentFlags.force ||
      parseBoolean(String(prMetadata.force || "")),
    dry_run:
      parseBoolean(workflowInputs.dry_run) ||
      commentFlags.dry_run ||
      parseBoolean(String(prMetadata.dry_run || "")),
  };

  const headRepo = pr?.head?.repo?.full_name || "";
  const baseRepo = pr?.base?.repo?.full_name || repo;
  const sameRepo = Boolean(headRepo && headRepo === baseRepo);

  output("should_run", shouldRun ? "true" : "false");
  output("reason", reason);
  output("pr_number", prNumber);
  output("pr_url", pr?.html_url || "");
  output("head_ref", pr?.head?.ref || "");
  output("head_sha", pr?.head?.sha || "");
  output("head_repo", headRepo);
  output("base_repo", baseRepo);
  output("same_repo", sameRepo ? "true" : "false");
  output("issue_ref", merged.issue_ref);
  output("run_dir", merged.run_dir);
  output("route", merged.route);
  output("scenario_seed", merged.scenario_seed);
  output("checkpoint_id", merged.checkpoint_id);
  output("qa_recipe", merged.qa_recipe);
  output("no_auto_evidence_upload", merged.no_auto_evidence_upload ? "true" : "false");
  output("force", merged.force ? "true" : "false");
  output("dry_run", merged.dry_run ? "true" : "false");
}

main();
