#!/usr/bin/env node
/**
 * Prepare the next self-heal attempt for a Codex/Claude/external PR.
 *
 * Reads a PR's `Agent PR Request` block, counts `self-heal:attempt-N` labels,
 * gathers failure context (review comments OR latest qa-publish blocker comment)
 * and emits the new prompt + dispatch metadata for the self-heal workflow.
 *
 * Outputs to GITHUB_OUTPUT (or stdout when running locally):
 *   provider, branch, base_branch, pr_title, issue_ref, route, qa_recipe,
 *   prompt, attempt, exhausted, dispatch_workflow, failure_summary, reason
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";
import { parseArgs } from "node:util";
import {
  decodePromptB64,
  parseAgentPrRequest,
} from "./lib/agent_pr_request.mjs";

const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_REPO = process.env.GITHUB_REPOSITORY || "erniesg/tong";

const PROVIDER_WORKFLOWS = {
  codex: "codex-headless-pr.yml",
  claude: "claude-headless-pr.yml",
};

const QA_PUBLISH_FAILURE_MARKERS = [
  "Trusted QA publish was blocked",
  "Trusted QA publish could not find a repo-visible run bundle",
  "Trusted QA publish did not start",
];

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

function readEvent(eventPath) {
  if (!eventPath) return null;
  if (!fs.existsSync(eventPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(eventPath, "utf8"));
  } catch {
    return null;
  }
}

function resolvePrNumber({ event, eventName, fallback }) {
  if (fallback) return Number(fallback);
  if (!event) return null;
  if (eventName === "pull_request_review" || eventName === "pull_request") {
    return Number(event.pull_request?.number || 0) || null;
  }
  if (eventName === "workflow_run") {
    const prs = event.workflow_run?.pull_requests || [];
    if (prs.length > 0) return Number(prs[0].number) || null;
    return null;
  }
  if (eventName === "issue_comment") {
    return Number(event.issue?.number || 0) || null;
  }
  return null;
}

function countAttemptLabels(labels) {
  let max = 0;
  for (const label of labels || []) {
    const name = label?.name || label;
    const match = String(name || "").match(/^self-heal:attempt-(\d+)$/);
    if (match) {
      const n = Number.parseInt(match[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max;
}

function hasLabel(labels, name) {
  return (labels || []).some((label) => (label?.name || label) === name);
}

function summarizeReview(event) {
  const review = event?.review || {};
  const state = String(review.state || "").toLowerCase();
  if (state !== "changes_requested") return "";

  const reviewer = review.user?.login || "reviewer";
  const lines = [
    `Review by @${reviewer} requested changes.`,
    "",
    review.body ? review.body.trim() : "(no review summary)",
  ];

  return lines.join("\n").trim();
}

function fetchReviewComments({ repo, prNumber, reviewId }) {
  if (!reviewId) return [];
  const out = runGh(
    [
      "api",
      `repos/${repo}/pulls/${prNumber}/reviews/${reviewId}/comments`,
      "--jq",
      "[.[] | {path, line, body}]",
    ],
    { allowFailure: true },
  );
  if (!out.trim()) return [];
  try {
    return JSON.parse(out);
  } catch {
    return [];
  }
}

function fetchLatestQaPublishBlocker({ repo, prNumber }) {
  const comments = ghJson([
    "api",
    `repos/${repo}/issues/${prNumber}/comments`,
    "--jq",
    "[.[] | {body, created_at, user: .user.login}]",
  ]);
  if (!Array.isArray(comments)) return "";
  const matches = comments.filter((c) =>
    QA_PUBLISH_FAILURE_MARKERS.some((marker) => String(c.body || "").includes(marker)),
  );
  if (matches.length === 0) return "";
  return matches[matches.length - 1].body || "";
}

function buildFailureSummary({ event, eventName, repo, prNumber }) {
  if (eventName === "pull_request_review") {
    const head = summarizeReview(event);
    if (!head) return "";
    const reviewId = event?.review?.id;
    const inline = fetchReviewComments({ repo, prNumber, reviewId });
    if (inline.length === 0) return head;
    const inlineText = inline
      .map((c) => `- \`${c.path}\`${c.line ? `:${c.line}` : ""} — ${String(c.body || "").trim()}`)
      .join("\n");
    return `${head}\n\nInline review comments:\n${inlineText}`;
  }
  if (eventName === "workflow_run") {
    const conclusion = event?.workflow_run?.conclusion;
    const runUrl = event?.workflow_run?.html_url;
    const blocker = fetchLatestQaPublishBlocker({ repo, prNumber });
    const lines = [
      `Trusted QA Publish workflow run completed with conclusion: ${conclusion || "unknown"}.`,
      runUrl ? `Workflow run: ${runUrl}` : "",
      "",
      blocker ? `Latest qa-publish blocker comment:\n${blocker.trim()}` : "(no qa-publish blocker comment found)",
    ];
    return lines.filter(Boolean).join("\n");
  }
  return "";
}

function buildHealedPrompt({ originalPrompt, failureSummary, attempt }) {
  const sections = [
    "You are continuing a self-healing pull request iteration.",
    `Self-heal attempt: ${attempt}`,
    "",
    "## Original task",
    originalPrompt.trim() || "(original prompt missing)",
    "",
    "## Feedback that must be addressed before this PR can merge",
    failureSummary.trim() || "(no failure summary captured)",
    "",
    "## What you must do now",
    "1. Read the feedback carefully and identify every concrete change requested.",
    "2. Apply changes on the existing branch — do not rename or recreate it.",
    "3. Keep the original task acceptance criteria intact while addressing feedback.",
    "4. Work in small coherent slices and create local checkpoint commits when the environment supports them without interfering with PR creation; otherwise include a checkpoint log in the final output.",
    "5. Update the PR body if the scope or evidence requirements have changed.",
    "6. If a request is ambiguous or out of scope, leave a PR comment explaining the gap rather than guessing.",
  ];
  return sections.join("\n");
}

function emit(name, value) {
  const out = process.env.GITHUB_OUTPUT;
  const rendered = value == null ? "" : String(value);
  if (!out) {
    process.stdout.write(`${name}=${rendered.split("\n").join("\\n")}\n`);
    return;
  }
  fs.appendFileSync(out, `${name}<<__SELFHEAL__\n${rendered}\n__SELFHEAL__\n`);
}

function emitJson(name, value) {
  emit(name, JSON.stringify(value));
}

const { values: args } = parseArgs({
  options: {
    repo: { type: "string", default: DEFAULT_REPO },
    "pr-number": { type: "string" },
    "event-path": { type: "string", default: process.env.GITHUB_EVENT_PATH || "" },
    "event-name": { type: "string", default: process.env.GITHUB_EVENT_NAME || "" },
    "max-attempts": {
      type: "string",
      default: String(process.env.SELF_HEAL_MAX_ATTEMPTS || DEFAULT_MAX_ATTEMPTS),
    },
    "require-label": { type: "string", default: "auto-self-heal" },
    output: { type: "string" },
    help: { type: "boolean", default: false },
  },
  strict: false,
});

if (args.help) {
  console.log(`Usage: node scripts/self-heal-prepare-prompt.mjs [options]

Reads the active GitHub event (review or workflow_run failure) and emits
prompt + dispatch metadata for the self-heal workflow.

Options:
  --repo <owner/repo>      GitHub repo (default: ${DEFAULT_REPO})
  --pr-number <n>          Override PR number (otherwise inferred from event)
  --event-path <path>      GitHub event payload (default: $GITHUB_EVENT_PATH)
  --event-name <name>      Event name (default: $GITHUB_EVENT_NAME)
  --max-attempts <n>       Self-heal attempt budget (default: ${DEFAULT_MAX_ATTEMPTS})
  --require-label <name>   Require this label on the PR (default: auto-self-heal)
  --output <path>          Write decision JSON to a file
  --help                   Show this help`);
  process.exit(0);
}

const event = readEvent(args["event-path"]);
const eventName = (args["event-name"] || "").trim();
const prNumber = resolvePrNumber({ event, eventName, fallback: args["pr-number"] });

const decision = {
  ok: false,
  should_run: false,
  reason: "",
  pr_number: prNumber,
  provider: "",
  branch: "",
  base_branch: "main",
  pr_title: "",
  issue_ref: "",
  route: "",
  qa_recipe: "",
  attempt: 0,
  prior_attempts: 0,
  exhausted: false,
  failure_summary: "",
  prompt: "",
  dispatch_workflow: "",
};

function finish() {
  emit("should_run", decision.should_run ? "true" : "false");
  emit("reason", decision.reason);
  emit("pr_number", decision.pr_number ?? "");
  emit("provider", decision.provider);
  emit("branch", decision.branch);
  emit("base_branch", decision.base_branch);
  emit("pr_title", decision.pr_title);
  emit("issue_ref", decision.issue_ref);
  emit("route", decision.route);
  emit("qa_recipe", decision.qa_recipe);
  emit("attempt", String(decision.attempt));
  emit("prior_attempts", String(decision.prior_attempts));
  emit("exhausted", decision.exhausted ? "true" : "false");
  emit("dispatch_workflow", decision.dispatch_workflow);
  emit("failure_summary", decision.failure_summary);
  emit("prompt", decision.prompt);
  emitJson("decision", decision);

  if (args.output) {
    fs.writeFileSync(args.output, `${JSON.stringify(decision, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(decision, null, 2));
}

try {
  if (!prNumber) {
    decision.reason = "Could not resolve PR number from event payload.";
    finish();
    process.exit(0);
  }

  if (eventName === "pull_request_review") {
    const reviewState = String(event?.review?.state || "").toLowerCase();
    if (reviewState !== "changes_requested") {
      decision.reason = `Review state is '${reviewState}', not 'changes_requested'.`;
      finish();
      process.exit(0);
    }
  } else if (eventName === "workflow_run") {
    const conclusion = String(event?.workflow_run?.conclusion || "").toLowerCase();
    if (conclusion !== "failure" && conclusion !== "timed_out") {
      decision.reason = `workflow_run conclusion is '${conclusion}', not a failure.`;
      finish();
      process.exit(0);
    }
  } else if (eventName !== "workflow_dispatch") {
    decision.reason = `Unsupported event '${eventName}'.`;
    finish();
    process.exit(0);
  }

  const pr = ghJson([
    "pr",
    "view",
    String(prNumber),
    "--repo",
    args.repo,
    "--json",
    "number,title,body,headRefName,baseRefName,labels,state,url,isDraft",
  ]);
  if (!pr) fail(`Could not fetch PR #${prNumber}.`);

  if (pr.state !== "OPEN") {
    decision.reason = `PR #${prNumber} state is ${pr.state}; not retrying.`;
    finish();
    process.exit(0);
  }

  if (args["require-label"] && !hasLabel(pr.labels, args["require-label"])) {
    decision.reason = `PR #${prNumber} is missing required label '${args["require-label"]}'.`;
    finish();
    process.exit(0);
  }

  if (hasLabel(pr.labels, "self-heal:exhausted")) {
    decision.reason = "PR already labeled self-heal:exhausted; skipping.";
    decision.exhausted = true;
    finish();
    process.exit(0);
  }

  const meta = parseAgentPrRequest(pr.body || "");
  if (!meta.provider || !PROVIDER_WORKFLOWS[meta.provider]) {
    decision.reason = `PR #${prNumber} has no Agent PR Request block with a known provider (codex|claude).`;
    finish();
    process.exit(0);
  }

  const branch = (meta.branch || pr.headRefName || "").trim();
  if (!branch) {
    decision.reason = "Agent PR Request is missing branch.";
    finish();
    process.exit(0);
  }
  const baseBranch = (meta.base_branch || pr.baseRefName || "main").trim();
  const prTitle = (meta.pr_title || pr.title || "").trim();

  const priorAttempts = countAttemptLabels(pr.labels);
  const nextAttempt = priorAttempts + 1;
  const maxAttempts = Math.max(1, Number.parseInt(args["max-attempts"], 10) || DEFAULT_MAX_ATTEMPTS);

  decision.provider = meta.provider;
  decision.branch = branch;
  decision.base_branch = baseBranch;
  decision.pr_title = prTitle;
  decision.issue_ref = meta.issue_ref || "";
  decision.route = meta.route || "";
  decision.qa_recipe = meta.qa_recipe || "";
  decision.prior_attempts = priorAttempts;
  decision.attempt = nextAttempt;
  decision.dispatch_workflow = PROVIDER_WORKFLOWS[meta.provider];

  if (priorAttempts >= maxAttempts) {
    decision.exhausted = true;
    decision.reason = `Self-heal budget exhausted at ${priorAttempts}/${maxAttempts} attempts.`;
    finish();
    process.exit(0);
  }

  const failureSummary = buildFailureSummary({
    event,
    eventName,
    repo: args.repo,
    prNumber,
  });
  if (!failureSummary) {
    decision.reason = "Could not extract a failure summary from the event; skipping self-heal.";
    finish();
    process.exit(0);
  }

  const originalPrompt = decodePromptB64(meta.prompt_b64);
  const healedPrompt = buildHealedPrompt({
    originalPrompt,
    failureSummary,
    attempt: nextAttempt,
  });

  decision.failure_summary = failureSummary;
  decision.prompt = healedPrompt;
  decision.should_run = true;
  decision.ok = true;
  decision.reason = `Self-heal attempt ${nextAttempt}/${maxAttempts} prepared for ${meta.provider}.`;
  finish();
} catch (err) {
  decision.reason = err instanceof Error ? err.message : String(err);
  finish();
  process.exit(1);
}
