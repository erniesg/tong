#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";
import { defaultPublishRequest, inferIssueRef } from "./lib/qa_publish_defaults.mjs";
import {
  mergeQaPublishRequest,
  normalizeQaPublishRequest,
  renderQaPublishRequestBlock,
  stripQaPublishRequestBlock,
} from "./lib/qa_publish_request.mjs";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    bodyPath: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    switch (token) {
      case "--body-path":
        args.bodyPath = next || "";
        index += 1;
        break;
      default:
        fail(`Unknown argument: ${token}`);
    }
  }

  if (!args.bodyPath) fail("--body-path is required.");
  return args;
}

function output(name, value) {
  const rendered = value == null ? "" : String(value);
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  fs.appendFileSync(outputPath, `${name}<<__CODEX__\n${rendered}\n__CODEX__\n`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repo = process.env.GITHUB_REPOSITORY || "";
  const prTitle = (process.env.INPUT_PR_TITLE || "").trim();
  const branch = (process.env.INPUT_BRANCH || "").trim();
  const prBody = process.env.INPUT_PR_BODY || "";
  const requested = normalizeQaPublishRequest({
    issue_ref: process.env.INPUT_ISSUE_REF || "",
    route: process.env.INPUT_ROUTE || "",
    scenario_seed: process.env.INPUT_SCENARIO_SEED || "",
    checkpoint_id: process.env.INPUT_CHECKPOINT_ID || "",
    qa_recipe: process.env.INPUT_QA_RECIPE || "",
    no_auto_evidence_upload: (process.env.INPUT_NO_AUTO_EVIDENCE_UPLOAD || "").trim() === "true",
  });

  const inferredIssueRef =
    requested.issue_ref ||
    inferIssueRef({
      repo,
      title: prTitle,
      body: prBody,
      headRef: branch,
    });
  const defaults = defaultPublishRequest({
    issueRef: inferredIssueRef,
    title: prTitle,
    headRef: branch,
  });
  const resolved = mergeQaPublishRequest(defaults, {
    ...requested,
    issue_ref: requested.issue_ref || inferredIssueRef,
  });

  const bodySections = [];
  const trimmedBody = stripQaPublishRequestBlock(prBody).trim();
  if (trimmedBody) {
    bodySections.push(trimmedBody, "");
  }
  bodySections.push(renderQaPublishRequestBlock(resolved));

  fs.writeFileSync(args.bodyPath, `${bodySections.join("\n").trim()}\n`, "utf8");

  output("issue_ref", resolved.issue_ref);
  output("route", resolved.route);
  output("scenario_seed", resolved.scenario_seed);
  output("checkpoint_id", resolved.checkpoint_id);
  output("qa_recipe", resolved.qa_recipe);
  output("no_auto_evidence_upload", resolved.no_auto_evidence_upload ? "true" : "false");
}

main();
