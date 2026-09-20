#!/usr/bin/env node
/**
 * PM lane health: surface stuck issues and PRs for a Discord ping.
 *
 * Stuck heuristics:
 * - `pm:agent-ready` issue with no linked PR for > stuck_issue_hours.
 * - Open PR with `auto-self-heal` label and no commits or QA-publish run for
 *   > stuck_pr_hours.
 * - PR with `self-heal:exhausted` label that has no human review yet.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";
import { parseArgs } from "node:util";

const DEFAULT_REPO = process.env.GITHUB_REPOSITORY || "erniesg/tong";
const DEFAULT_CONFIG_PATH = ".agents/skills/_functional-qa/config/pm-orchestrator.json";

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

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return {
      stuck_issue_hours: 48,
      stuck_pr_hours: 12,
    };
  }
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function hoursSince(iso) {
  if (!iso) return Number.POSITIVE_INFINITY;
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
}

function fetchReadyIssues({ repo }) {
  return ghJson([
    "issue",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--label",
    "pm:agent-ready",
    "--limit",
    "100",
    "--json",
    "number,title,url,labels,createdAt,updatedAt",
  ]) || [];
}

function fetchAutoSelfHealPrs({ repo }) {
  return ghJson([
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--label",
    "auto-self-heal",
    "--limit",
    "100",
    "--json",
    "number,title,url,labels,headRefName,createdAt,updatedAt,reviews",
  ]) || [];
}

function fetchExhaustedPrs({ repo }) {
  return ghJson([
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--label",
    "self-heal:exhausted",
    "--limit",
    "100",
    "--json",
    "number,title,url,labels,headRefName,createdAt,updatedAt,reviews",
  ]) || [];
}

function findLinkedPrForIssue({ repo, issueNumber }) {
  // Cheap heuristic: look for open PRs whose head branch matches one of the
  // codex/claude branch patterns containing `issue-<n>`.
  const prs = ghJson([
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--search",
    `issue-${issueNumber} in:head`,
    "--limit",
    "5",
    "--json",
    "number,headRefName,url",
  ]) || [];
  return prs.find((pr) =>
    typeof pr.headRefName === "string"
    && (pr.headRefName.startsWith("codex/") || pr.headRefName.startsWith("claude/"))
    && pr.headRefName.includes(`issue-${issueNumber}`),
  ) || null;
}

const { values: args } = parseArgs({
  options: {
    repo: { type: "string", default: DEFAULT_REPO },
    "config-path": { type: "string", default: DEFAULT_CONFIG_PATH },
    output: { type: "string" },
    help: { type: "boolean", default: false },
  },
  strict: false,
});

if (args.help) {
  console.log(`Usage: node scripts/pm/lane-health.mjs [options]

Detects stuck issues and PRs for human attention.

Options:
  --repo <owner/repo>      GitHub repo (default: ${DEFAULT_REPO})
  --config-path <path>     PM config (default: ${DEFAULT_CONFIG_PATH})
  --output <path>          Write report JSON
  --help                   Show this help`);
  process.exit(0);
}

const config = loadConfig(args["config-path"]);
const stuckIssueHours = config.stuck_issue_hours || 48;
const stuckPrHours = config.stuck_pr_hours || 12;

const readyIssues = fetchReadyIssues({ repo: args.repo });
const stuckIssues = [];
for (const issue of readyIssues) {
  const updatedHours = hoursSince(issue.updatedAt);
  if (updatedHours < stuckIssueHours) continue;
  const linkedPr = findLinkedPrForIssue({ repo: args.repo, issueNumber: issue.number });
  if (linkedPr) continue;
  stuckIssues.push({
    number: issue.number,
    title: issue.title,
    url: issue.url,
    hoursSinceUpdate: Number(updatedHours.toFixed(1)),
    reason: "agent-ready issue with no linked PR after threshold",
  });
}

const autoHealPrs = fetchAutoSelfHealPrs({ repo: args.repo });
const stuckPrs = [];
for (const pr of autoHealPrs) {
  const updatedHours = hoursSince(pr.updatedAt);
  if (updatedHours < stuckPrHours) continue;
  stuckPrs.push({
    number: pr.number,
    title: pr.title,
    url: pr.url,
    headRefName: pr.headRefName,
    hoursSinceUpdate: Number(updatedHours.toFixed(1)),
    reason: "auto-self-heal PR idle after threshold",
  });
}

const exhaustedPrs = fetchExhaustedPrs({ repo: args.repo });
const exhaustedNeedingReview = [];
for (const pr of exhaustedPrs) {
  const reviews = Array.isArray(pr.reviews) ? pr.reviews : [];
  const humanReviews = reviews.filter(
    (r) => !["github-actions", "github-actions[bot]"].includes(r?.author?.login || ""),
  );
  if (humanReviews.length > 0) continue;
  exhaustedNeedingReview.push({
    number: pr.number,
    title: pr.title,
    url: pr.url,
    headRefName: pr.headRefName,
    reason: "self-heal exhausted, awaiting human review",
  });
}

const report = {
  ok: true,
  repo: args.repo,
  generatedAt: new Date().toISOString(),
  thresholds: { stuckIssueHours, stuckPrHours },
  stuckIssues,
  stuckPrs,
  exhaustedNeedingReview,
  hasFindings: stuckIssues.length + stuckPrs.length + exhaustedNeedingReview.length > 0,
};

const json = JSON.stringify(report, null, 2);
if (args.output) fs.writeFileSync(args.output, `${json}\n`, "utf8");
console.log(json);
