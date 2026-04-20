#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  dispatchPrRetry,
  evaluatePrValidatorState,
  fetchPrValidatorContext,
  renderPrValidatorSummary,
  resolvePrValidatorContext,
  upsertPrValidatorSummaryComment,
  postRetryDispatchComment,
} from "./lib/pr-validator.mjs";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    action: "validate",
    output: "",
    prNumber: "",
    repo: process.env.GITHUB_REPOSITORY || "",
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--action") args.action = argv[++index] || args.action;
    else if (arg === "--output") args.output = argv[++index] || "";
    else if (arg === "--pr-number") args.prNumber = argv[++index] || "";
    else if (arg === "--repo") args.repo = argv[++index] || args.repo;
    else if (arg === "--help") args.help = true;
    else fail(`Unknown argument: ${arg}`);
  }

  if (!args.help && (!args.prNumber || !args.repo)) {
    fail("--pr-number and --repo are required.");
  }

  args.action = args.action === "retry" ? "retry" : "validate";
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/pr-validator.mjs --pr-number <n> --repo <owner/name> [options]

Options:
  --action <name>                 validate | retry
  --output <path>                 Write JSON result to a file
`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
  const fetched = await fetchPrValidatorContext({
    repo: args.repo,
    prNumber: args.prNumber,
    token,
  });
  const context = resolvePrValidatorContext({
    pr: fetched.pr,
    repo: args.repo,
  });
  const evaluation = evaluatePrValidatorState({
    checkRuns: fetched.checkRuns,
    context,
    issueComments: fetched.issueComments,
    pr: fetched.pr,
    reviewComments: fetched.reviewComments,
    reviews: fetched.reviews,
  });

  let retryDispatched = false;
  if (args.action === "retry" && context.isAgentPr && evaluation.canRetry) {
    dispatchPrRetry({
      context,
      evaluation,
      issueRef: context.issueRef,
      pr: fetched.pr,
    });
    retryDispatched = true;
    await postRetryDispatchComment({
      maxRetries: context.validatorRequest.max_retries,
      prNumber: fetched.pr.number,
      repo: args.repo,
      retryAttempt: evaluation.retryAttempts + 1,
      token,
    });
    evaluation.unresolvedRisks.unshift("Automated rework was dispatched to the Codex Headless PR workflow for this branch.");
    evaluation.verdict = "requeued";
    evaluation.confidence = 0.63;
  } else if (args.action === "retry" && !evaluation.canRetry) {
    evaluation.unresolvedRisks.unshift("Retry was requested, but the validator blocked rework because the cap was reached or no actionable feedback was available.");
  }

  let summaryComment = null;
  if (token && context.isAgentPr) {
    summaryComment = await upsertPrValidatorSummaryComment({
      body: renderPrValidatorSummary({
        context,
        evaluation,
        pr: fetched.pr,
      }),
      prNumber: fetched.pr.number,
      repo: args.repo,
      token,
    });
  }

  const result = {
    action: args.action,
    canRetry: evaluation.canRetry,
    confidence: evaluation.confidence,
    context,
    prNumber: fetched.pr.number,
    retryDispatched,
    summaryCommentUrl: summaryComment?.html_url || "",
    unresolvedRisks: evaluation.unresolvedRisks,
    verdict: evaluation.verdict,
  };

  if (args.output) {
    fs.mkdirSync(path.dirname(args.output), { recursive: true });
    fs.writeFileSync(args.output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
});
