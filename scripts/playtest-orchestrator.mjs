#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  buildDirectPrRequest,
  buildIssueBody,
  buildIssueTitle,
  buildUpdateComment,
  chooseRouteDecision,
  githubRequest,
  runGhWorkflow,
  toIssueRef,
  toPrRef,
  workerRequest,
} from "./lib/playtest-orchestrator.mjs";

function parseArgs(argv) {
  const args = {
    apiBase: process.env.TONG_REMOTE_API_BASE_URL || "https://tong-api.erniesg.workers.dev",
    baseBranch: "main",
    confidenceThreshold: 0.82,
    dryRun: false,
    findingId: "",
    limit: 20,
    output: "",
    repo: process.env.GITHUB_REPOSITORY || "",
    allowDirectPr: true,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--api-base") args.apiBase = argv[++index] || args.apiBase;
    else if (arg === "--base-branch") args.baseBranch = argv[++index] || args.baseBranch;
    else if (arg === "--confidence-threshold") args.confidenceThreshold = Number(argv[++index] || args.confidenceThreshold);
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--finding-id") args.findingId = argv[++index] || "";
    else if (arg === "--limit") args.limit = Number(argv[++index] || args.limit);
    else if (arg === "--no-direct-pr") args.allowDirectPr = false;
    else if (arg === "--output") args.output = argv[++index] || "";
    else if (arg === "--repo") args.repo = argv[++index] || "";
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/playtest-orchestrator.mjs [options]

Options:
  --api-base <url>                Worker API base URL
  --base-branch <branch>          Base branch for dispatched direct PRs (default: main)
  --confidence-threshold <num>    Minimum confidence for direct PR routing (default: 0.82)
  --dry-run                       Plan routes without mutating GitHub or the finding ledger
  --finding-id <id>               Limit processing to a single finding id
  --limit <n>                     Maximum number of unrouted findings to inspect (default: 20)
  --no-direct-pr                  Disable direct PR dispatch and fall back to issue routing
  --output <path>                 Write JSON result to a file
  --repo <owner/name>             Repository full name (defaults to GITHUB_REPOSITORY)
`);
}

async function fetchOpenIssues({ repo, token, fetchImpl }) {
  const issues = await githubRequest({
    token,
    url: `https://api.github.com/repos/${repo}/issues?state=open&per_page=100`,
    fetchImpl,
  });
  return (issues || []).filter((issue) => !issue.pull_request);
}

async function fetchIssueComments({ repo, issueNumber, token, fetchImpl }) {
  return githubRequest({
    token,
    url: `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments?per_page=100`,
    fetchImpl,
  });
}

async function findOpenPullForBranch({ repo, branch, token, fetchImpl }) {
  const pulls = await githubRequest({
    token,
    url: `https://api.github.com/repos/${repo}/pulls?state=open&head=${encodeURIComponent(`${repo.split("/")[0]}:${branch}`)}`,
    fetchImpl,
  });
  return Array.isArray(pulls) && pulls.length > 0 ? pulls[0] : null;
}

async function createIssue({ repo, token, title, body, fetchImpl }) {
  return githubRequest({
    token,
    method: "POST",
    url: `https://api.github.com/repos/${repo}/issues`,
    body: { title, body },
    fetchImpl,
  });
}

async function createIssueComment({ repo, issueNumber, token, body, fetchImpl }) {
  return githubRequest({
    token,
    method: "POST",
    url: `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`,
    body: { body },
    fetchImpl,
  });
}

async function routeFinding({
  apiBase,
  apiToken,
  baseBranch,
  dryRun,
  fetchImpl,
  finding,
  ghToken,
  issues,
  repo,
  allowDirectPr,
  confidenceThreshold,
}) {
  const decision = chooseRouteDecision({
    finding,
    issues,
    allowDirectPr,
    confidenceThreshold,
  });

  const result = {
    action: decision.status,
    branch: "",
    confidence: decision.confidence,
    findingId: finding.findingId,
    issueRef: "",
    lane: decision.scope?.lane || "",
    prRef: "",
    reason: decision.reason,
  };

  if (dryRun) {
    return result;
  }

  if (decision.status === "skip" || decision.status === "human_review" || decision.status === "done") {
    await workerRequest({
      apiBase,
      apiToken,
      path: `/api/v1/playtest/findings/${finding.findingId}/route`,
      method: "POST",
      body: {
        actor: "playtest-orchestrator",
        confidence: decision.confidence,
        reason: decision.reason,
        status: decision.status,
      },
      fetchImpl,
    });
    return result;
  }

  if (decision.status === "update_issue" && decision.issueMatch?.issue?.number) {
    const issueNumber = decision.issueMatch.issue.number;
    const issueRef = toIssueRef(repo, issueNumber);
    const marker = `playtest-route:${finding.findingId}:update_issue`;
    const comments = await fetchIssueComments({ repo, issueNumber, token: ghToken, fetchImpl });
    const alreadyCommented = (comments || []).some((comment) => String(comment.body || "").includes(marker));

    if (!alreadyCommented) {
      await createIssueComment({
        repo,
        issueNumber,
        token: ghToken,
        body: buildUpdateComment({ finding, decision, repository: repo, issueRef }),
        fetchImpl,
      });
    }

    await workerRequest({
      apiBase,
      apiToken,
      path: `/api/v1/playtest/findings/${finding.findingId}/refs`,
      method: "POST",
      body: {
        actor: "playtest-orchestrator",
        issueRefs: [issueRef],
      },
      fetchImpl,
    });
    await workerRequest({
      apiBase,
      apiToken,
      path: `/api/v1/playtest/findings/${finding.findingId}/route`,
      method: "POST",
      body: {
        actor: "playtest-orchestrator",
        confidence: decision.confidence,
        reason: decision.reason,
        status: decision.status,
      },
      fetchImpl,
    });

    result.issueRef = issueRef;
    return result;
  }

  if (decision.status === "new_issue") {
    const created = await createIssue({
      repo,
      token: ghToken,
      title: buildIssueTitle(finding),
      body: buildIssueBody({ finding, decision, repository: repo }),
      fetchImpl,
    });
    const issueRef = toIssueRef(repo, created.number);
    await workerRequest({
      apiBase,
      apiToken,
      path: `/api/v1/playtest/findings/${finding.findingId}/refs`,
      method: "POST",
      body: {
        actor: "playtest-orchestrator",
        issueRefs: [issueRef],
      },
      fetchImpl,
    });
    await workerRequest({
      apiBase,
      apiToken,
      path: `/api/v1/playtest/findings/${finding.findingId}/route`,
      method: "POST",
      body: {
        actor: "playtest-orchestrator",
        confidence: decision.confidence,
        reason: decision.reason,
        status: decision.status,
      },
      fetchImpl,
    });

    result.issueRef = issueRef;
    return result;
  }

  if (decision.status === "direct_pr") {
    const request = buildDirectPrRequest({
      finding,
      decision,
      repository: repo,
      baseBranch,
    });
    const existingPr = await findOpenPullForBranch({
      repo,
      branch: request.branch,
      token: ghToken,
      fetchImpl,
    });

    if (!existingPr) {
      runGhWorkflow({
        args: [
          "workflow",
          "run",
          "codex-headless-pr.yml",
          "--repo",
          repo,
          "-f",
          `prompt=${request.prompt}`,
          "-f",
          `base_branch=${request.baseBranch}`,
          "-f",
          `branch=${request.branch}`,
          "-f",
          `pr_title=${request.prTitle}`,
          "-f",
          `pr_body=${request.prBody}`,
        ],
        env: process.env,
        cwd: process.cwd(),
      });
    }

    const openPr = existingPr || await findOpenPullForBranch({
      repo,
      branch: request.branch,
      token: ghToken,
      fetchImpl,
    });

    if (openPr?.number) {
      const prRef = toPrRef(repo, openPr.number);
      await workerRequest({
        apiBase,
        apiToken,
        path: `/api/v1/playtest/findings/${finding.findingId}/refs`,
        method: "POST",
        body: {
          actor: "playtest-orchestrator",
          prRefs: [prRef],
        },
        fetchImpl,
      });
      result.prRef = prRef;
    }

    await workerRequest({
      apiBase,
      apiToken,
      path: `/api/v1/playtest/findings/${finding.findingId}/route`,
      method: "POST",
      body: {
        actor: "playtest-orchestrator",
        confidence: decision.confidence,
        reason: decision.reason,
        status: decision.status,
      },
      fetchImpl,
    });

    result.branch = request.branch;
    return result;
  }

  throw new Error(`Unsupported route action: ${decision.status}`);
}

function summarize(actions) {
  return actions.reduce((accumulator, action) => {
    accumulator[action.action] = (accumulator[action.action] || 0) + 1;
    return accumulator;
  }, {});
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }
  if (!args.repo) {
    throw new Error("Repository is required. Set GITHUB_REPOSITORY or pass --repo.");
  }

  const ghToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
  const apiToken = process.env.TONG_PLAYTEST_READ_API_TOKEN || "";
  const findingsResponse = await workerRequest({
    apiBase: args.apiBase,
    apiToken,
    path: `/api/v1/playtest/findings/unrouted?limit=${encodeURIComponent(String(args.limit))}`,
  });
  const findings = Array.isArray(findingsResponse?.findings)
    ? findingsResponse.findings.filter((finding) => !args.findingId || finding.findingId === args.findingId)
    : [];
  const issues = await fetchOpenIssues({ repo: args.repo, token: ghToken });

  const actions = [];
  for (const finding of findings) {
    const action = await routeFinding({
      apiBase: args.apiBase,
      apiToken,
      baseBranch: args.baseBranch,
      dryRun: args.dryRun,
      fetchImpl: fetch,
      finding,
      ghToken,
      issues,
      repo: args.repo,
      allowDirectPr: args.allowDirectPr,
      confidenceThreshold: args.confidenceThreshold,
    });
    actions.push(action);
  }

  const result = {
    apiBase: args.apiBase,
    dryRun: args.dryRun,
    findingsInspected: findings.length,
    repository: args.repo,
    routes: actions,
    summary: summarize(actions),
  };

  const rendered = `${JSON.stringify(result, null, 2)}\n`;
  if (args.output) {
    fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });
    fs.writeFileSync(path.resolve(args.output), rendered, "utf8");
  }
  process.stdout.write(rendered);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
