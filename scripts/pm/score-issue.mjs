#!/usr/bin/env node
/**
 * PM gatekeeper: score one GitHub issue against portable-issue requirements,
 * post or refresh a single PM portability comment, and reconcile labels.
 *
 * Idempotent: re-running on the same issue updates the existing PM comment
 * (identified by the leading `<!-- pm:scored -->` marker) instead of stacking.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";
import { parseArgs } from "node:util";
import {
  evaluateBody,
  renderGapComment,
} from "./lib/portability-rules.mjs";

const DEFAULT_REPO = process.env.GITHUB_REPOSITORY || "erniesg/tong";
const COMMENT_MARKER = "<!-- pm:scored -->";

const PM_LABELS = {
  scored: "pm:scored",
  gap: "pm:portability-gap",
  ready: "pm:agent-ready",
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

function runGh(args, { allowFailure = false } = {}) {
  try {
    return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    if (allowFailure) return "";
    const stderr = err.stderr?.toString?.().trim() || err.message;
    throw new Error(`gh ${args.join(" ")} failed: ${stderr}`);
  }
}

function ghJson(args) {
  const out = runGh(args).trim();
  if (!out) return null;
  return JSON.parse(out);
}

function fetchIssue({ repo, number }) {
  return ghJson([
    "issue",
    "view",
    String(number),
    "--repo",
    repo,
    "--json",
    "number,title,body,labels,state,url",
  ]);
}

function fetchPmComments({ repo, number }) {
  const comments = ghJson([
    "api",
    `repos/${repo}/issues/${number}/comments`,
    "--jq",
    "[.[] | {id, body}]",
  ]);
  if (!Array.isArray(comments)) return [];
  return comments.filter((c) => String(c.body || "").startsWith(COMMENT_MARKER));
}

function postOrUpdateComment({ repo, number, body, dryRun }) {
  const stamped = `${COMMENT_MARKER}\n${body}`;
  if (dryRun) {
    return { action: "dry-run", body: stamped };
  }
  const existing = fetchPmComments({ repo, number });
  if (existing.length === 0) {
    runGh([
      "issue",
      "comment",
      String(number),
      "--repo",
      repo,
      "--body",
      stamped,
    ]);
    return { action: "created" };
  }
  const target = existing[existing.length - 1];
  runGh([
    "api",
    `repos/${repo}/issues/comments/${target.id}`,
    "-X",
    "PATCH",
    "-f",
    `body=${stamped}`,
  ]);
  // Delete extras to keep one authoritative PM comment per issue.
  for (const extra of existing.slice(0, -1)) {
    runGh(
      ["api", `repos/${repo}/issues/comments/${extra.id}`, "-X", "DELETE"],
      { allowFailure: true },
    );
  }
  return { action: "updated", commentId: target.id };
}

function reconcileLabels({ repo, number, currentLabels, isComplete, dryRun }) {
  const currentNames = new Set((currentLabels || []).map((l) => l.name || l));
  const desiredAdds = new Set([PM_LABELS.scored]);
  const desiredRemoves = new Set();
  if (isComplete) {
    desiredAdds.add(PM_LABELS.ready);
    desiredRemoves.add(PM_LABELS.gap);
  } else {
    desiredAdds.add(PM_LABELS.gap);
    desiredRemoves.add(PM_LABELS.ready);
  }

  const adds = [...desiredAdds].filter((l) => !currentNames.has(l));
  const removes = [...desiredRemoves].filter((l) => currentNames.has(l));

  if (dryRun) {
    return { adds, removes, action: "dry-run" };
  }
  for (const label of adds) {
    runGh(
      ["issue", "edit", String(number), "--repo", repo, "--add-label", label],
      { allowFailure: true },
    );
  }
  for (const label of removes) {
    runGh(
      ["issue", "edit", String(number), "--repo", repo, "--remove-label", label],
      { allowFailure: true },
    );
  }
  return { adds, removes, action: "applied" };
}

function buildIssueRef({ repo, number }) {
  return `${repo}#${number}`;
}

const { values: args } = parseArgs({
  options: {
    repo: { type: "string", default: DEFAULT_REPO },
    number: { type: "string" },
    "event-path": { type: "string", default: process.env.GITHUB_EVENT_PATH || "" },
    "dry-run": { type: "boolean", default: false },
    output: { type: "string" },
    help: { type: "boolean", default: false },
  },
  strict: false,
});

if (args.help) {
  console.log(`Usage: node scripts/pm/score-issue.mjs --number <issue-number> [options]

Scores a GitHub issue against portable-issue requirements and reconciles
labels + a single PM comment on the issue.

Options:
  --repo <owner/repo>      GitHub repo (default: ${DEFAULT_REPO})
  --number <n>             Issue number to score (or read from event payload)
  --event-path <path>      GitHub issue event payload (default: $GITHUB_EVENT_PATH)
  --dry-run                Print decisions without mutating the issue
  --output <path>          Write decision JSON to a file
  --help                   Show this help`);
  process.exit(0);
}

let number = args.number ? Number.parseInt(args.number, 10) : null;
if (!number && args["event-path"] && fs.existsSync(args["event-path"])) {
  try {
    const event = JSON.parse(fs.readFileSync(args["event-path"], "utf8"));
    number = Number(event?.issue?.number) || null;
  } catch {
    /* ignore */
  }
}
if (!number) fail("Missing --number (and could not infer from event payload).");

const issue = fetchIssue({ repo: args.repo, number });
if (!issue) fail(`Could not fetch issue #${number}.`);

const evaluation = evaluateBody(issue.body || "");
const issueRef = buildIssueRef({ repo: args.repo, number });
const commentBody = renderGapComment(evaluation, { issueRef });
const commentResult = postOrUpdateComment({
  repo: args.repo,
  number,
  body: commentBody,
  dryRun: args["dry-run"],
});
const labelResult = reconcileLabels({
  repo: args.repo,
  number,
  currentLabels: issue.labels,
  isComplete: evaluation.isComplete,
  dryRun: args["dry-run"],
});

const decision = {
  ok: true,
  repo: args.repo,
  number,
  issueRef,
  state: issue.state,
  isComplete: evaluation.isComplete,
  score: evaluation.requiredPresent,
  scoreOutOf: evaluation.requiredCount,
  missingRequired: evaluation.missingRequired.map((r) => r.id),
  missingOptional: evaluation.missingOptional.map((r) => r.id),
  antiHits: evaluation.antiHits.map((r) => ({ id: r.id, sample: r.sample })),
  missingReferences: evaluation.missingReferences.map((r) => ({
    type: r.type,
    target: r.target,
    prefix: r.prefix || "",
    line: r.line,
    sample: r.sample,
  })),
  presentReferenceCount: evaluation.presentReferences.length,
  declaredNewReferenceCount: evaluation.declaredNewReferences.length,
  comment: commentResult,
  labels: labelResult,
  dryRun: args["dry-run"],
};

const json = JSON.stringify(decision, null, 2);
if (args.output) {
  fs.writeFileSync(args.output, `${json}\n`, "utf8");
}
console.log(json);
