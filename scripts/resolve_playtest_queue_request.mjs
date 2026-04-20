#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";
import { parsePlaytestQueueCommand } from "./lib/playtest-queue.mjs";

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

function parseBoolean(value) {
  if (typeof value !== "string") return false;
  return TRUE_VALUES.has(value.trim().toLowerCase());
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
  const defaultQueueIssueNumber =
    String(workflowInputs.queue_issue_number || process.env.PLAYTEST_QUEUE_ISSUE_NUMBER || "").trim();

  let action = "refresh";
  let dryRun = parseBoolean(String(workflowInputs.dry_run || ""));
  let findingId = String(workflowInputs.finding_id || "").trim();
  let limit = String(workflowInputs.limit || "20").trim();
  let note = String(workflowInputs.note || "").trim();
  let queueIssueNumber = defaultQueueIssueNumber;
  let shouldRun = true;
  let reason = "";

  if (eventName === "issue_comment") {
    const issue = event.issue || {};
    const comment = event.comment || {};
    const parsed = parsePlaytestQueueCommand(comment.body || "");

    action = parsed.action;
    dryRun = parsed.dryRun;
    findingId = parsed.findingId || "";
    limit = parsed.limit || limit;
    note = parsed.note || note;
    queueIssueNumber = parsed.queueIssueNumber || String(issue.number || "") || defaultQueueIssueNumber;

    if (issue.pull_request) {
      shouldRun = false;
      reason = "Queue commands only run from issues, not pull request comments.";
    } else if (!parsed.requested) {
      shouldRun = false;
      reason = "Comment did not request /playtest-queue.";
    } else if (!MAINTAINER_ASSOCIATIONS.has(comment.author_association || "")) {
      shouldRun = false;
      reason = `Comment author association \`${comment.author_association || "UNKNOWN"}\` is not allowed to trigger trusted queue controls.`;
    }
  } else if (eventName === "workflow_dispatch") {
    action = String(workflowInputs.action || action).trim() || "refresh";
  } else if (eventName === "schedule") {
    action = "refresh";
  } else {
    shouldRun = false;
    reason = `Unsupported event ${eventName || "unknown"}.`;
  }

  if (!queueIssueNumber) {
    shouldRun = false;
    reason = "No queue issue number was resolved.";
  }

  if (shouldRun && action !== "refresh" && !findingId) {
    shouldRun = false;
    reason = `Action ${action} requires finding_id.`;
  }

  output("should_run", shouldRun ? "true" : "false");
  output("reason", reason);
  output("action", action);
  output("dry_run", dryRun ? "true" : "false");
  output("finding_id", findingId);
  output("limit", limit || "20");
  output("note", note);
  output("queue_issue_number", queueIssueNumber);
}

main();
