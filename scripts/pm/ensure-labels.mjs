#!/usr/bin/env node
/**
 * Ensure GitHub labels used by the PM, provider routing, and self-heal loops
 * exist before workflows try to reconcile or count them.
 */

import { execFileSync } from "node:child_process";
import process from "node:process";
import { parseArgs } from "node:util";

const DEFAULT_REPO = process.env.GITHUB_REPOSITORY || "erniesg/tong";

const LABELS = [
  { name: "pm:scored", color: "0E8A16", description: "PM gatekeeper has scored this issue." },
  { name: "pm:agent-ready", color: "1D76DB", description: "Portable issue eligible for PM agent dispatch." },
  { name: "pm:portability-gap", color: "D93F0B", description: "Issue is missing required portable execution context." },
  { name: "blocked-on-human", color: "B60205", description: "Automation is blocked on a protected human decision." },
  { name: "auto-self-heal", color: "5319E7", description: "PR is eligible for automatic retry on QA or reviewer failure." },
  { name: "self-heal:attempt-1", color: "FBCA04", description: "First automatic self-heal attempt has been dispatched." },
  { name: "self-heal:attempt-2", color: "FBCA04", description: "Second automatic self-heal attempt has been dispatched." },
  { name: "self-heal:exhausted", color: "B60205", description: "Automatic retry budget is exhausted." },
  { name: "priority:p0", color: "B60205", description: "Highest PM scheduling priority." },
  { name: "priority:p1", color: "D93F0B", description: "High PM scheduling priority." },
  { name: "priority:p2", color: "FBCA04", description: "Normal PM scheduling priority." },
  { name: "provider:codex", color: "5319E7", description: "Prefer Codex provider for this issue." },
  { name: "provider:claude", color: "5319E7", description: "Prefer Claude provider for this issue." },
  { name: "playtest-triage", color: "C2E0C6", description: "Issue came from playtest analysis." },
  { name: "initiative:pipeline-hardening", color: "BFDADC", description: "Agent-native pipeline hardening work." },
  { name: "lane:client-ui", color: "D4C5F9", description: "Client UI workstream." },
  { name: "lane:client-runtime", color: "D4C5F9", description: "Client game runtime workstream." },
  { name: "lane:client-overlay", color: "D4C5F9", description: "Subtitle overlay and dictionary workstream." },
  { name: "lane:qa-platform", color: "D4C5F9", description: "QA routing and reviewer-proof workstream." },
  { name: "lane:runtime-assets", color: "D4C5F9", description: "Runtime assets and evidence contracts workstream." },
  { name: "lane:server-api", color: "D4C5F9", description: "Server API and persistence workstream." },
  { name: "lane:server-ingestion", color: "D4C5F9", description: "Transcript and vocabulary ingestion workstream." },
  { name: "lane:game-engine", color: "D4C5F9", description: "Branching scene and Tong orchestration workstream." },
  { name: "lane:infra-deploy", color: "D4C5F9", description: "CI, deployment, and control-plane workstream." },
  { name: "lane:mock-ui", color: "D4C5F9", description: "Clickable mock and scripted demo workstream." },
  { name: "lane:creative-assets", color: "D4C5F9", description: "Generated asset and content-pack workstream." },
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function runGh(args) {
  try {
    return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    const stderr = err.stderr?.toString?.().trim() || err.message;
    throw new Error(`gh ${args.join(" ")} failed: ${stderr}`);
  }
}

function existingLabels(repo) {
  const out = runGh(["label", "list", "--repo", repo, "--limit", "500", "--json", "name"]);
  return new Set(JSON.parse(out).map((label) => label.name));
}

function printHelp() {
  console.log(`Usage: node scripts/pm/ensure-labels.mjs [options]

Options:
  --repo <owner/repo>  GitHub repo (default: ${DEFAULT_REPO})
  --dry-run            Print missing labels without creating them
  --help               Show this help`);
}

const { values: args } = parseArgs({
  options: {
    repo: { type: "string", default: DEFAULT_REPO },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
  strict: false,
});

if (args.help) {
  printHelp();
  process.exit(0);
}

try {
  const existing = existingLabels(args.repo);
  const created = [];
  const alreadyPresent = [];
  for (const label of LABELS) {
    if (existing.has(label.name)) {
      alreadyPresent.push(label.name);
      continue;
    }
    if (!args["dry-run"]) {
      runGh([
        "label",
        "create",
        label.name,
        "--repo",
        args.repo,
        "--color",
        label.color,
        "--description",
        label.description,
      ]);
    }
    created.push(label.name);
  }
  console.log(JSON.stringify({ ok: true, repo: args.repo, dryRun: args["dry-run"], created, alreadyPresent }, null, 2));
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
}
