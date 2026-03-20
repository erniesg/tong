#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";

const MAINTAINER_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseBoolean(value, fallback = false) {
  if (typeof value !== "string") return fallback;
  return TRUE_VALUES.has(value.trim().toLowerCase());
}

function readEventPayload() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) fail("GITHUB_EVENT_PATH is required.");
  return JSON.parse(fs.readFileSync(eventPath, "utf8"));
}

function output(name, value) {
  const rendered = value == null ? "" : String(value);
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    fs.appendFileSync(outputPath, `${name}<<__CODEX__\n${rendered}\n__CODEX__\n`);
  } else {
    process.stdout.write(`${name}=${rendered}\n`);
  }
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseJsonBlock(body, heading) {
  const pattern = new RegExp(`##\\s*${escapeRegex(heading)}\\s*\`\`\`json\\s*([\\s\\S]*?)\`\`\``, "i");
  const match = (body || "").match(pattern);
  if (!match) return {};
  try {
    const parsed = JSON.parse(match[1]);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function parsePatchBlock(body) {
  const match = (body || "").match(/```(?:diff|patch)\s*([\s\S]*?)```/i);
  return match ? `${match[1].trimEnd()}\n` : "";
}

function ensureCodexBranch(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return "";
  return trimmed.startsWith("codex/") ? trimmed : `codex/${trimmed.replace(/^\/+/, "")}`;
}

function renderQaPublishBlock(request) {
  if (!request || typeof request !== "object" || Object.keys(request).length === 0) return "";
  return [
    "## QA Publish Request",
    "",
    "```json",
    JSON.stringify(request, null, 2),
    "```",
    "",
  ].join("\n");
}

function main() {
  const eventName = process.env.GITHUB_EVENT_NAME;
  const repo = process.env.GITHUB_REPOSITORY || "";
  const patchPath = process.env.REQUEST_PATCH_PATH;
  const bodyPath = process.env.REQUEST_PR_BODY_PATH;
  if (!patchPath) fail("REQUEST_PATCH_PATH is required.");
  if (!bodyPath) fail("REQUEST_PR_BODY_PATH is required.");

  const event = readEventPayload();
  const inputs = event.inputs || {};

  let shouldRun = true;
  let reason = "";
  let sourceIssueNumber = "";
  let bodyText = "";
  let metadata = {};
  let patchText = "";

  if (eventName === "issue_comment") {
    const issue = event.issue || {};
    const comment = event.comment || {};
    bodyText = comment.body || "";
    if (!bodyText.trim().startsWith("/codex-create-pr")) {
      shouldRun = false;
      reason = "Comment did not request /codex-create-pr.";
    } else if (!MAINTAINER_ASSOCIATIONS.has(comment.author_association || "")) {
      shouldRun = false;
      reason = `Comment author association \`${comment.author_association || "UNKNOWN"}\` is not allowed to trigger trusted PR creation.`;
    } else {
      sourceIssueNumber = String(issue.number || "");
      metadata = parseJsonBlock(bodyText, "Codex PR Request");
      patchText = parsePatchBlock(bodyText);
    }
  } else if (eventName === "workflow_dispatch") {
    metadata = {};
  } else {
    shouldRun = false;
    reason = `Unsupported event ${eventName || "unknown"}.`;
  }

  const qaPublishRequest =
    typeof metadata.qa_publish_request === "object" && metadata.qa_publish_request
      ? metadata.qa_publish_request
      : {};

  const request = {
    base_branch: (inputs.base_branch || metadata.base_branch || "main").trim(),
    new_branch: ensureCodexBranch(inputs.new_branch || metadata.new_branch || ""),
    pr_title: (inputs.pr_title || metadata.pr_title || "").trim(),
    commit_message: (inputs.commit_message || metadata.commit_message || "").trim(),
    issue_ref: (inputs.issue_ref || metadata.issue_ref || "").trim(),
    pr_body: inputs.pr_body || metadata.pr_body || "",
    patch_text: inputs.patch_text || patchText || "",
    patch_url: (inputs.patch_url || metadata.patch_url || "").trim(),
    patch_path: (inputs.patch_path || metadata.patch_path || "").trim(),
    dry_run: parseBoolean(inputs.dry_run, false) || metadata.dry_run === true,
    qa_publish_request: {
      issue_ref: (inputs.issue_ref || metadata.issue_ref || qaPublishRequest.issue_ref || "").trim(),
      run_dir: (inputs.run_dir || qaPublishRequest.run_dir || "").trim(),
      route: (inputs.route || qaPublishRequest.route || "").trim(),
      scenario_seed: (inputs.scenario_seed || qaPublishRequest.scenario_seed || "").trim(),
      checkpoint_id: (inputs.checkpoint_id || qaPublishRequest.checkpoint_id || "").trim(),
      qa_recipe: (inputs.qa_recipe || qaPublishRequest.qa_recipe || "").trim(),
      no_auto_evidence_upload:
        parseBoolean(inputs.no_auto_evidence_upload, false) ||
        qaPublishRequest.no_auto_evidence_upload === true,
    },
  };

  if (!request.commit_message) {
    request.commit_message = request.pr_title || "chore: apply Codex patch request";
  }
  if (!request.issue_ref && repo && sourceIssueNumber) {
    request.issue_ref = `${repo}#${sourceIssueNumber}`;
  }
  if (!request.qa_publish_request.issue_ref && request.issue_ref) {
    request.qa_publish_request.issue_ref = request.issue_ref;
  }

  if (!request.new_branch) {
    shouldRun = false;
    reason = "Missing new_branch.";
  } else if (!request.pr_title) {
    shouldRun = false;
    reason = "Missing pr_title.";
  } else if (!request.patch_text && !request.patch_url && !request.patch_path) {
    shouldRun = false;
    reason = "Provide one patch source: patch_text, patch_url, or patch_path.";
  }

  if (request.patch_text) {
    fs.writeFileSync(patchPath, request.patch_text, "utf8");
  }

  const prBodySections = [];
  if (request.pr_body.trim()) {
    prBodySections.push(request.pr_body.trim(), "");
  }
  if (request.issue_ref) {
    prBodySections.push(`Fix context: \`${request.issue_ref}\``, "");
  } else if (sourceIssueNumber) {
    prBodySections.push(`Source issue thread: #${sourceIssueNumber}`, "");
  }
  const qaBlock = renderQaPublishBlock(request.qa_publish_request);
  if (qaBlock) {
    prBodySections.push(qaBlock.trim(), "");
  }
  fs.writeFileSync(bodyPath, `${prBodySections.join("\n").trim()}\n`, "utf8");

  output("should_run", shouldRun ? "true" : "false");
  output("reason", reason);
  output("base_branch", request.base_branch);
  output("new_branch", request.new_branch);
  output("pr_title", request.pr_title);
  output("commit_message", request.commit_message);
  output("issue_ref", request.issue_ref);
  output("patch_source", request.patch_text ? "inline" : request.patch_url ? "url" : request.patch_path ? "path" : "");
  output("patch_url", request.patch_url);
  output("patch_path", request.patch_path);
  output("dry_run", request.dry_run ? "true" : "false");
  output("source_issue_number", sourceIssueNumber);
}

main();
