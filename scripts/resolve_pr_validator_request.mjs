#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";

const MAINTAINER_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readEventPayload() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) fail("GITHUB_EVENT_PATH is required.");
  return JSON.parse(fs.readFileSync(eventPath, "utf8"));
}

function parseCommand(body) {
  const trimmed = String(body || "").trim();
  if (!trimmed.startsWith("/pr-validator")) {
    return { action: "validate", requested: false };
  }
  const [, action = "validate"] = trimmed.split(/\s+/, 2);
  return {
    action: action === "retry" ? "retry" : "validate",
    requested: true,
  };
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

function main() {
  const eventName = process.env.GITHUB_EVENT_NAME || "";
  const event = readEventPayload();
  const workflowInputs = event.inputs || {};

  let action = String(workflowInputs.action || "validate").trim() || "validate";
  let prNumber = String(workflowInputs.pr_number || "").trim();
  let shouldRun = true;
  let reason = "";

  if (eventName === "pull_request") {
    prNumber = String(event.pull_request?.number || "");
    action = "validate";
  } else if (eventName === "workflow_run") {
    prNumber = String(event.workflow_run?.pull_requests?.[0]?.number || "");
    action = "validate";
    if (!prNumber) {
      shouldRun = false;
      reason = "workflow_run did not expose an associated pull request.";
    }
  } else if (eventName === "workflow_dispatch") {
    if (!prNumber) {
      shouldRun = false;
      reason = "workflow_dispatch requires pr_number.";
    }
  } else if (eventName === "issue_comment") {
    const issue = event.issue || {};
    const comment = event.comment || {};
    const parsed = parseCommand(comment.body || "");
    prNumber = String(issue.number || "");
    action = parsed.action;

    if (!issue.pull_request) {
      shouldRun = false;
      reason = "Comment is not attached to a pull request.";
    } else if (!parsed.requested) {
      shouldRun = false;
      reason = "Comment did not request /pr-validator.";
    } else if (!MAINTAINER_ASSOCIATIONS.has(comment.author_association || "")) {
      shouldRun = false;
      reason = `Comment author association \`${comment.author_association || "UNKNOWN"}\` is not allowed to trigger validator retries.`;
    }
  } else {
    shouldRun = false;
    reason = `Unsupported event ${eventName || "unknown"}.`;
  }

  output("should_run", shouldRun ? "true" : "false");
  output("reason", reason);
  output("action", action === "retry" ? "retry" : "validate");
  output("pr_number", prNumber);
}

main();
