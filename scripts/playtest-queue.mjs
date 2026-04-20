#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  applyQueueAction,
  normalizeQueueAction,
  renderQueueDigest,
  summarizeQueue,
  upsertQueueDigestComment,
} from "./lib/playtest-queue.mjs";
import { workerRequest } from "./lib/playtest-orchestrator.mjs";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    action: "refresh",
    apiBase: process.env.TONG_REMOTE_API_BASE_URL || "https://tong-api.erniesg.workers.dev",
    dryRun: false,
    findingId: "",
    limit: 20,
    note: "",
    output: "",
    queueIssueNumber: process.env.PLAYTEST_QUEUE_ISSUE_NUMBER || "242",
    repo: process.env.GITHUB_REPOSITORY || "",
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--action") args.action = argv[++index] || args.action;
    else if (arg === "--api-base") args.apiBase = argv[++index] || args.apiBase;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--finding-id") args.findingId = argv[++index] || "";
    else if (arg === "--limit") args.limit = Number(argv[++index] || args.limit);
    else if (arg === "--note") args.note = argv[++index] || "";
    else if (arg === "--output") args.output = argv[++index] || "";
    else if (arg === "--queue-issue") args.queueIssueNumber = argv[++index] || args.queueIssueNumber;
    else if (arg === "--repo") args.repo = argv[++index] || "";
    else if (arg === "--help") args.help = true;
    else fail(`Unknown argument: ${arg}`);
  }

  args.action = normalizeQueueAction(args.action);
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/playtest-queue.mjs [options]

Options:
  --action <name>                 refresh | hold | retry | approve | reject | route-to-human | force-manual
  --api-base <url>                Worker API base URL
  --dry-run                       Plan without mutating GitHub or the queue digest comment
  --finding-id <id>               Target finding id for operator actions
  --limit <n>                     Maximum findings to include in the digest (default: 20)
  --note <text>                   Optional operator note to persist with the action
  --output <path>                 Write JSON result to a file
  --queue-issue <number>          GitHub issue number used for the queue digest comment
  --repo <owner/name>             Repository full name (defaults to GITHUB_REPOSITORY)
`);
}

async function fetchQueue({ apiBase, apiToken, findingId = "", limit = 20 }) {
  const query = new URLSearchParams();
  query.set("limit", String(limit));
  if (findingId) query.set("findingId", findingId);
  const response = await workerRequest({
    apiBase,
    apiToken,
    path: `/api/v1/playtest/findings/queue?${query.toString()}`,
  });
  return Array.isArray(response?.findings) ? response.findings : [];
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  const ghToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
  const apiToken = process.env.TONG_PLAYTEST_READ_API_TOKEN || "";

  if (!args.dryRun && !args.repo) {
    fail("--repo or GITHUB_REPOSITORY is required unless --dry-run is set.");
  }

  let actionResult = null;
  if (!args.dryRun && args.action !== "refresh") {
    actionResult = await applyQueueAction({
      action: args.action,
      apiBase: args.apiBase,
      apiToken,
      findingId: args.findingId,
      note: args.note,
    });
  }

  const findings = await fetchQueue({
    apiBase: args.apiBase,
    apiToken,
    limit: args.limit,
  });
  const targetFinding = args.findingId
    ? (await fetchQueue({
      apiBase: args.apiBase,
      apiToken,
      findingId: args.findingId,
      limit: 1,
    }))[0] || null
    : null;
  const generatedAt = new Date().toISOString();
  const digest = renderQueueDigest({
    findings,
    generatedAt,
    queueIssueNumber: args.queueIssueNumber,
    repository: args.repo || "erniesg/tong",
  });

  let digestComment = null;
  if (!args.dryRun && ghToken && args.queueIssueNumber) {
    digestComment = await upsertQueueDigestComment({
      body: digest,
      issueNumber: args.queueIssueNumber,
      repo: args.repo,
      token: ghToken,
    });
  }

  const result = {
    action: args.action,
    actionResult,
    apiBase: args.apiBase,
    digestCommentUrl: digestComment?.html_url || "",
    dryRun: args.dryRun,
    findingId: args.findingId,
    findingsInspected: findings.length,
    generatedAt,
    queueIssueNumber: args.queueIssueNumber,
    summary: summarizeQueue(findings),
    targetFinding,
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
