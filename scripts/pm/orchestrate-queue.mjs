#!/usr/bin/env node
/**
 * PM cron orchestrator: rank `pm:agent-ready` issues, then plan + dispatch
 * the top-N respecting lane and provider concurrency caps.
 *
 * The PM does NOT re-implement queue planning — it picks input issue numbers,
 * then delegates to the existing `remote_agent_queue.py plan` (queue model)
 * and `dispatch-remote-agent-queue.mjs` (provider routing) tools.
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";

const DEFAULT_REPO = process.env.GITHUB_REPOSITORY || "erniesg/tong";
const DEFAULT_CONFIG_PATH = ".agents/skills/_functional-qa/config/pm-orchestrator.json";
const DEFAULT_PROVIDER_CONFIG_PATH = ".agents/skills/_functional-qa/config/remote-agent-providers.json";

const PRIORITY_LABEL_TO_SCORE = {
  "priority:p0": 100,
  "priority:p1": 50,
  "priority:p2": 10,
  "pm:priority-p0": 100,
  "pm:priority-p1": 50,
  "pm:priority-p2": 10,
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

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return {
      max_dispatches_per_run: 3,
      provider_concurrency_caps: { codex: 3, claude: 3 },
      stale_age_days: 14,
      skip_labels: [
        "pm:portability-gap",
        "self-heal:exhausted",
        "do-not-merge",
        "blocked-on-human",
      ],
      include_label: "pm:agent-ready",
    };
  }
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function loadJson(configPath, fallback = {}) {
  if (!fs.existsSync(configPath)) return fallback;
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function fetchAgentReadyIssues({ repo, includeLabel, skipLabels }) {
  const issues = ghJson([
    "issue",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--label",
    includeLabel,
    "--limit",
    "100",
    "--json",
    "number,title,labels,createdAt,updatedAt,url,body",
  ]) || [];
  return issues.filter((issue) => {
    const names = (issue.labels || []).map((l) => l.name || l);
    return !skipLabels.some((skip) => names.includes(skip));
  });
}

function parseIssueNumberList(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const numbers = raw
    .split(/[\s,]+/)
    .map((token) => token.replace(/^#/, "").trim())
    .filter(Boolean)
    .map((token) => Number.parseInt(token, 10))
    .filter((number) => Number.isFinite(number) && number > 0);
  return new Set(numbers);
}

function fetchOpenAgentPrCount({ repo }) {
  // Scope the count to PRs from THIS pipeline only — both headless workflows
  // (codex-headless-pr.yml and claude-headless-pr.yml) apply `auto-self-heal`
  // when they create a PR. Without this scope the cap also counts pre-pipeline
  // codex/* branches the team had open before the orchestrator existed.
  const prs = ghJson([
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
    "number,headRefName,labels",
  ]) || [];
  const counts = { codex: 0, claude: 0 };
  for (const pr of prs) {
    if (typeof pr.headRefName === "string") {
      if (pr.headRefName.startsWith("codex/")) counts.codex += 1;
      if (pr.headRefName.startsWith("claude/")) counts.claude += 1;
    }
  }
  return counts;
}

function priorityScore(issue) {
  const names = (issue.labels || []).map((l) => l.name || l);
  let max = 0;
  for (const name of names) {
    const score = PRIORITY_LABEL_TO_SCORE[name];
    if (score && score > max) max = score;
  }
  return max;
}

function laneFromLabels(issue) {
  const names = (issue.labels || []).map((l) => l.name || l);
  for (const name of names) {
    if (name.startsWith("lane:")) return name.slice("lane:".length);
    if (name.startsWith("pm:lane-")) return name.slice("pm:lane-".length);
  }
  return null;
}

function providerFromLabels(issue) {
  const names = (issue.labels || []).map((l) => l.name || l);
  const label = names.find((name) => String(name).startsWith("provider:"));
  return label ? String(label).slice("provider:".length) : "";
}

function issueRef({ repo, issue }) {
  return `${repo}#${issue.number}`;
}

function executionModeFromBody(issue) {
  const body = String(issue.body || "");
  const markdown = body.match(/\*\*Execution mode:\*\*\s*`?([A-Za-z0-9_-]+)`?/i);
  if (markdown) return markdown[1];
  const heading = body.match(/Execution mode:\s*`?([A-Za-z0-9_-]+)`?/i);
  return heading ? heading[1] : "";
}

function severityFromBody(issue) {
  const body = String(issue.body || "");
  const match = body.match(/Severity:\s*(\d)\s*\/\s*5/i);
  if (!match) return 0;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : 0;
}

function ageDays(issue) {
  const created = new Date(issue.createdAt || Date.now()).getTime();
  const now = Date.now();
  return Math.max(0, (now - created) / (1000 * 60 * 60 * 24));
}

function rankIssues(issues, { staleAgeDays, severityWeight = 10, ageWeight = 1 }) {
  return issues
    .map((issue) => {
      const priority = priorityScore(issue);
      const severity = severityFromBody(issue);
      const age = Math.min(ageDays(issue), staleAgeDays);
      const score = priority + severity * severityWeight + age * ageWeight;
      return {
        issue,
        score,
        priority,
        severity,
        ageDays: age,
        lane: laneFromLabels(issue),
        executionMode: executionModeFromBody(issue),
      };
    })
    .sort((a, b) => b.score - a.score || a.issue.number - b.issue.number);
}

function parseIso(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function providerIsAvailable(providerId, providerConfig) {
  const provider = providerConfig.providers?.[providerId];
  if (!provider || provider.status !== "working") return false;
  const availability = provider.availability || {};
  const status = String(availability.status || "available").toLowerCase();
  if (!["available", "working"].includes(status)) return false;
  const unavailableUntil = parseIso(availability.unavailable_until || "");
  if (unavailableUntil && unavailableUntil > Date.now()) return false;
  return true;
}

function providerCandidates(item, { providerConfig, repo, requestedProvider = "auto" }) {
  const forced = providerFromLabels(item.issue);
  if (forced) return [forced];

  const candidates = [];
  if (requestedProvider && requestedProvider !== "auto") candidates.push(requestedProvider);

  const issueOverrides = providerConfig.issue_provider || {};
  const ref = issueRef({ repo, issue: item.issue });
  if (issueOverrides[ref]) candidates.push(issueOverrides[ref]);
  if (issueOverrides[`#${item.issue.number}`]) candidates.push(issueOverrides[`#${item.issue.number}`]);

  const laneOverrides = providerConfig.lane_provider || {};
  if (item.lane && laneOverrides[item.lane]) candidates.push(laneOverrides[item.lane]);

  const executionOverrides = providerConfig.execution_mode_provider || {};
  if (item.executionMode && executionOverrides[item.executionMode]) {
    candidates.push(executionOverrides[item.executionMode]);
  }

  candidates.push(providerConfig.default_provider || "codex");
  candidates.push(...Object.keys(providerConfig.providers || {}));
  return [...new Set(candidates.filter(Boolean))];
}

function chooseProvider(item, { providerConfig, caps, openCounts, repo, requestedProvider }) {
  const candidates = providerCandidates(item, { providerConfig, repo, requestedProvider });
  const reasons = [];
  for (const provider of candidates) {
    if (!providerConfig.providers?.[provider]) {
      reasons.push(`${provider}: unknown provider`);
      continue;
    }
    if (!providerIsAvailable(provider, providerConfig)) {
      reasons.push(`${provider}: unavailable`);
      continue;
    }
    const cap = caps[provider] ?? Number.POSITIVE_INFINITY;
    const open = openCounts[provider] ?? 0;
    if (open >= cap) {
      reasons.push(`${provider}: cap ${open}/${cap}`);
      continue;
    }
    return { provider, candidates, reasons };
  }
  return { provider: "", candidates, reasons };
}

function applyLaneAndProviderCaps(
  ranked,
  { caps, openCounts, maxDispatches, providerConfig, repo, requestedProvider },
) {
  const usedLanes = new Set();
  const remainingProvider = { ...openCounts };
  const allowed = [];
  const skipped = [];
  for (const item of ranked) {
    if (allowed.length >= maxDispatches) break;
    if (item.lane && usedLanes.has(item.lane)) {
      skipped.push({
        number: item.issue.number,
        reason: `lane ${item.lane} already selected this tick`,
      });
      continue;
    }

    const decision = chooseProvider(item, {
      providerConfig,
      caps,
      openCounts: remainingProvider,
      repo,
      requestedProvider,
    });
    const provider = decision.provider;
    if (!provider) {
      skipped.push({
        number: item.issue.number,
        reason: decision.reasons.join("; ") || "no provider available",
        providerCandidates: decision.candidates,
      });
      continue;
    }
    const open = remainingProvider[provider] ?? 0;
    remainingProvider[provider] = open + 1;
    if (item.lane) usedLanes.add(item.lane);
    allowed.push({ ...item, provider, providerCandidates: decision.candidates });
  }
  return { allowed, skipped };
}

function planQueue({ repo, issueNumbers, dryRun, queueOutDir }) {
  if (issueNumbers.length === 0) return null;
  const args = [
    ".agents/skills/_functional-qa/scripts/remote_agent_queue.py",
    "plan",
    ...issueNumbers.map((n) => `#${n}`),
    "--provider",
    "auto",
  ];
  if (queueOutDir) {
    args.push("--out-dir", queueOutDir);
  }
  if (dryRun) {
    return { dryRun: true, command: ["python", ...args].join(" "), planPath: "" };
  }
  const result = spawnSync("python", args, {
    encoding: "utf8",
    env: { ...process.env, GITHUB_REPOSITORY: repo },
  });
  if (result.status !== 0) {
    throw new Error(
      `remote_agent_queue.py plan failed (exit ${result.status}): ${result.stderr || result.stdout}`,
    );
  }
  const dir = result.stdout.trim();
  return { dryRun: false, queueDir: dir, planPath: path.join(dir, "remote-plan.json") };
}

function providerMeta(providerConfig, providerId) {
  const provider = providerConfig.providers?.[providerId];
  if (!provider) return null;
  return { id: providerId, ...provider };
}

function applyProviderOverridesToPlan({ planPath, selected, providerConfig }) {
  if (!planPath || !fs.existsSync(planPath)) return null;
  const assignments = new Map(
    selected.map((item) => [String(item.issue.number), item.provider]),
  );
  const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
  for (const issue of plan.issues || []) {
    const keys = [
      String(issue.number || ""),
      String(issue.issue_ref || "").split("#").pop() || "",
    ].filter(Boolean);
    const providerId = keys.map((key) => assignments.get(key)).find(Boolean);
    if (!providerId) continue;
    const meta = providerMeta(providerConfig, providerId);
    if (meta) issue.provider = meta;
  }
  plan.pm_provider_assignments = selected.map((item) => ({
    issue: item.issue.number,
    provider: item.provider,
    candidates: item.providerCandidates,
  }));
  fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  return plan.pm_provider_assignments;
}

function dispatchPlan({ planPath, repo, dryRun, includeUnassigned, output }) {
  const args = [
    "scripts/dispatch-remote-agent-queue.mjs",
    "--plan",
    planPath,
    "--repo",
    repo,
  ];
  if (includeUnassigned) args.push("--include-unassigned");
  if (dryRun) args.push("--dry-run");
  if (output) args.push("--output", output);
  const result = spawnSync("node", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `dispatch-remote-agent-queue.mjs failed (exit ${result.status}): ${result.stderr || result.stdout}`,
    );
  }
  return JSON.parse(result.stdout || "{}");
}

const { values: args } = parseArgs({
  options: {
    repo: { type: "string", default: DEFAULT_REPO },
    "config-path": { type: "string", default: DEFAULT_CONFIG_PATH },
    "provider-config-path": { type: "string", default: DEFAULT_PROVIDER_CONFIG_PATH },
    "max-dispatches": { type: "string" },
    "issue-numbers": { type: "string" },
    provider: { type: "string", default: "auto" },
    "dry-run": { type: "boolean", default: false },
    "skip-dispatch": {
      type: "boolean",
      default: false,
    },
    output: { type: "string" },
    "queue-out-dir": { type: "string" },
    help: { type: "boolean", default: false },
  },
  strict: false,
});

if (args.help) {
  console.log(`Usage: node scripts/pm/orchestrate-queue.mjs [options]

Cron-friendly: ranks pm:agent-ready issues and dispatches top-N via the
existing queue planner + dispatch tools.

Options:
  --repo <owner/repo>     GitHub repo (default: ${DEFAULT_REPO})
  --config-path <path>    PM config (default: ${DEFAULT_CONFIG_PATH})
  --provider-config-path <path>
                          Provider policy config (default: ${DEFAULT_PROVIDER_CONFIG_PATH})
  --max-dispatches <n>    Override max dispatches per run
  --issue-numbers <list>  Restrict dispatch to these issue numbers (#1,#2 or space-separated)
  --provider <id|auto>    Preferred provider for this run; explicit issue labels still win
  --dry-run               Skip mutations (no plan generation, no dispatch)
  --skip-dispatch         Generate plan but do not dispatch
  --queue-out-dir <path>  Forward to remote_agent_queue.py --out-dir
  --output <path>         Write decision JSON
  --help                  Show this help`);
  process.exit(0);
}

const config = loadConfig(args["config-path"]);
const providerConfig = loadJson(args["provider-config-path"], {
  default_provider: "codex",
  providers: {
    codex: { status: "working", availability: { status: "available" } },
  },
});
if (
  args.provider !== "auto" &&
  !Object.prototype.hasOwnProperty.call(providerConfig.providers || {}, args.provider)
) {
  fail(`Unknown provider '${args.provider}'.`);
}
const maxDispatches = args["max-dispatches"]
  ? Number.parseInt(args["max-dispatches"], 10) || config.max_dispatches_per_run
  : config.max_dispatches_per_run;

try {
  const targetIssueNumbers = parseIssueNumberList(args["issue-numbers"]);
  const allReadyIssues = fetchAgentReadyIssues({
    repo: args.repo,
    includeLabel: config.include_label || "pm:agent-ready",
    skipLabels: config.skip_labels || [],
  });
  const issues = targetIssueNumbers
    ? allReadyIssues.filter((issue) => targetIssueNumbers.has(issue.number))
    : allReadyIssues;
  const ranked = rankIssues(issues, {
    staleAgeDays: config.stale_age_days || 14,
    severityWeight: config.severity_body_weight ?? 10,
    ageWeight: config.age_weight_per_day ?? 1,
  });
  const openCounts = fetchOpenAgentPrCount({ repo: args.repo });
  const { allowed, skipped } = applyLaneAndProviderCaps(ranked, {
    caps: config.provider_concurrency_caps || {},
    openCounts,
    maxDispatches,
    providerConfig,
    repo: args.repo,
    requestedProvider: args.provider,
  });

  const decision = {
    ok: true,
    repo: args.repo,
    dryRun: args["dry-run"],
    totalReady: allReadyIssues.length,
    targetedReady: issues.length,
    issueNumberFilter: targetIssueNumbers ? [...targetIssueNumbers].sort((a, b) => a - b) : [],
    rankedCount: ranked.length,
    selectedCount: allowed.length,
    openProviderCounts: openCounts,
    providerPolicy: {
      defaultProvider: providerConfig.default_provider || "codex",
      requestedProvider: args.provider,
      providers: Object.fromEntries(
        Object.entries(providerConfig.providers || {}).map(([id, provider]) => [
          id,
          {
            status: provider.status,
            availability: provider.availability || {},
            strengths: provider.strengths || [],
          },
        ]),
      ),
    },
    selected: allowed.map((item) => ({
      number: item.issue.number,
      title: item.issue.title,
      url: item.issue.url,
      score: item.score,
      priority: item.priority,
      severity: item.severity,
      ageDays: Number(item.ageDays.toFixed(2)),
      lane: item.lane,
      executionMode: item.executionMode,
      provider: item.provider,
      providerCandidates: item.providerCandidates,
    })),
    skipped: skipped.slice(0, 25),
    plan: null,
    dispatch: null,
  };

  if (allowed.length === 0) {
    decision.reason = "No agent-ready issues meet the dispatch criteria.";
    if (args.output) fs.writeFileSync(args.output, `${JSON.stringify(decision, null, 2)}\n`);
    console.log(JSON.stringify(decision, null, 2));
    process.exit(0);
  }

  const issueNumbers = allowed.map((item) => item.issue.number);
  if (args["dry-run"]) {
    decision.plan = { dryRun: true, queueIssues: issueNumbers };
    decision.dispatch = { dryRun: true, skipped: true };
    if (args.output) fs.writeFileSync(args.output, `${JSON.stringify(decision, null, 2)}\n`);
    console.log(JSON.stringify(decision, null, 2));
    process.exit(0);
  }

  const planResult = planQueue({
    repo: args.repo,
    issueNumbers,
    dryRun: false,
    queueOutDir: args["queue-out-dir"],
  });
  decision.plan = planResult;
  decision.providerAssignments = applyProviderOverridesToPlan({
    planPath: planResult?.planPath,
    selected: allowed,
    providerConfig,
  });

  if (args["skip-dispatch"] || !planResult?.planPath) {
    decision.dispatch = { skipped: true, reason: "skip-dispatch flag or missing plan path" };
  } else {
    const dispatchResult = dispatchPlan({
      planPath: planResult.planPath,
      repo: args.repo,
      dryRun: false,
      includeUnassigned: true,
    });
    decision.dispatch = dispatchResult;
  }

  if (args.output) fs.writeFileSync(args.output, `${JSON.stringify(decision, null, 2)}\n`);
  console.log(JSON.stringify(decision, null, 2));
} catch (err) {
  console.error(err instanceof Error ? err.stack || err.message : String(err));
  process.exit(1);
}
