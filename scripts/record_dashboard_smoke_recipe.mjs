#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    issueRef: "",
    route: "/dashboard",
    apiBaseUrl: process.env.TONG_LOCAL_API_BASE_URL || "http://127.0.0.1:8787",
    clientBaseUrl: process.env.TONG_LOCAL_CLIENT_BASE_URL || "http://127.0.0.1:3000",
    label: "Dashboard validator smoke proof",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    switch (token) {
      case "--issue-ref":
        args.issueRef = next || "";
        index += 1;
        break;
      case "--route":
        args.route = next || args.route;
        index += 1;
        break;
      case "--api-base-url":
        args.apiBaseUrl = next || args.apiBaseUrl;
        index += 1;
        break;
      case "--client-base-url":
        args.clientBaseUrl = next || args.clientBaseUrl;
        index += 1;
        break;
      case "--label":
        args.label = next || args.label;
        index += 1;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        fail(`Unknown argument: ${token}`);
    }
  }

  if (!args.issueRef) {
    fail("--issue-ref is required.");
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/record_dashboard_smoke_recipe.mjs --issue-ref <ref> [options]

Options:
  --route <route>              Route metadata to store in the run bundle (default: /dashboard)
  --api-base-url <url>         Local API base url (default: http://127.0.0.1:8787)
  --client-base-url <url>      Local client base url (default: http://127.0.0.1:3000)
  --label <text>               Summary label for the command`);
}

function runCommand(command, args, { env = process.env } = {}) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
    env,
  });
}

function runOrFail(command, args) {
  const result = runCommand(command, args);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim() || `${command} failed`;
    fail(detail);
  }
  return result.stdout.trim();
}

function appendSection(filePath, heading, lines) {
  const body = `\n\n## ${heading}\n\n${lines.join("\n")}\n`;
  fs.appendFileSync(filePath, body, "utf8");
}

function replaceScaffoldPlaceholder(filePath, replacementLines) {
  const current = fs.readFileSync(filePath, "utf8");
  const next = current.replace(
    /## Notes\s*\n\s*- Replace this scaffold with the actual validation findings\.\s*\n?/,
    `## Notes\n\n${replacementLines.join("\n")}\n`,
  );
  fs.writeFileSync(filePath, next, "utf8");
}

function updateSummaryStatus(filePath, { verdict, confidence }) {
  const current = fs.readFileSync(filePath, "utf8");
  const next = current
    .replace("- Verdict: pending", `- Verdict: ${verdict}`)
    .replace("- Verdict: reproduced", `- Verdict: ${verdict}`)
    .replace("- Verdict: fixed", `- Verdict: ${verdict}`)
    .replace(/- Confidence: [0-9.]+/, `- Confidence: ${confidence}`);
  fs.writeFileSync(filePath, next, "utf8");
}

async function requestJson(url) {
  const response = await fetch(url, { method: "GET", redirect: "follow" });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${url}`);
  }

  return data;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeEvidence(runDir, details) {
  const evidencePath = path.join(runDir, "evidence.json");
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));

  evidence.summary = details.summary;
  evidence.screenshots = [
    ...(evidence.screenshots || []),
    {
      path: details.screenshotRelativePath,
      label: "dashboard-validator-screenshot",
      description: "Reviewer-visible screenshot for the all-city dashboard validator section.",
    },
  ];
  evidence.console_logs = [
    ...(evidence.console_logs || []),
    {
      path: details.logRelativePath,
      label: "dashboard-smoke-log",
      description: `${details.label} command transcript`,
    },
  ];
  evidence.network_traces = [
    ...(evidence.network_traces || []),
    {
      path: details.personasRelativePath,
      label: "graph-personas",
      description: "Persona lookup used during the dashboard proof run.",
    },
    {
      path: details.dashboardRelativePath,
      label: "graph-dashboard",
      description: "Dashboard read-model payload used during the dashboard proof run.",
    },
  ];
  evidence.contract_assertions = [
    ...(evidence.contract_assertions || []),
    {
      path: details.dashboardRelativePath,
      label: "dashboard-contract",
      description: "Dashboard read-model payload captured during trusted CI validation.",
    },
  ];
  evidence.notes = [
    ...(evidence.notes || []),
    `${details.label} ran in trusted CI against ${details.route}.`,
    `Client base: \`${details.clientBaseUrl}\``,
    `API base: \`${details.apiBaseUrl}\``,
  ];
  evidence.validation = {
    ...(evidence.validation || {}),
    runtime_modes_exercised: [
      ...new Set([
        ...((evidence.validation && evidence.validation.runtime_modes_exercised) || []),
        "dashboard-smoke",
        "reviewer-screenshot",
      ]),
    ],
    notes: [
      ...new Set([
        ...((evidence.validation && evidence.validation.notes) || []),
        `${details.label} passed in CI.`,
      ]),
    ],
  };

  writeJson(evidencePath, evidence);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runDir = runOrFail("python3", [
    ".agents/skills/_functional-qa/scripts/qa_runtime.py",
    "init-run",
    "validate-issue",
    "--target",
    args.issueRef,
  ]).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).at(-1);

  if (!runDir) {
    fail("qa_runtime init-run did not return a run directory.");
  }

  const logPath = path.join(runDir, "logs", "dashboard-smoke.log");
  const screenshotPath = path.join(runDir, "screenshots", "dashboard-validator-smoke.png");
  const commandArgs = ["scripts/dashboard_smoke_check.mjs"];
  const commandText = `node ${commandArgs.join(" ")}`;
  const result = runCommand("node", commandArgs, {
    env: {
      ...process.env,
      TONG_LOCAL_API_BASE_URL: args.apiBaseUrl,
      TONG_LOCAL_CLIENT_BASE_URL: args.clientBaseUrl,
      TONG_DASHBOARD_SMOKE_SCREENSHOT_PATH: screenshotPath,
    },
  });
  const transcript = [
    `$ TONG_LOCAL_API_BASE_URL=${args.apiBaseUrl} TONG_LOCAL_CLIENT_BASE_URL=${args.clientBaseUrl} TONG_DASHBOARD_SMOKE_SCREENSHOT_PATH=${screenshotPath} ${commandText}`,
    "",
    (result.stdout || "").trim(),
    (result.stderr || "").trim(),
  ].filter(Boolean).join("\n");
  fs.writeFileSync(logPath, `${transcript}\n`, "utf8");

  const summaryPath = path.join(runDir, "summary.md");
  const stepsPath = path.join(runDir, "steps.md");
  const screenshotRelativePath = path.relative(process.cwd(), screenshotPath);
  const logRelativePath = path.relative(process.cwd(), logPath);

  if (result.status !== 0) {
    replaceScaffoldPlaceholder(summaryPath, [
      `- ${args.label} failed in trusted CI.`,
      `- Route under test: \`${args.route}\``,
      `- Log: \`${logRelativePath}\``,
    ]);
    appendSection(summaryPath, "CI Verification", [
      `- ${args.label} failed.`,
      `- Route under test: \`${args.route}\``,
      `- Log: \`${logRelativePath}\``,
    ]);
    updateSummaryStatus(summaryPath, { verdict: "reproduced", confidence: "0.3" });
    process.stderr.write(result.stderr || result.stdout || "Dashboard smoke failed.\n");
    process.exit(result.status || 1);
  }

  if (!fs.existsSync(screenshotPath)) {
    fail(`Dashboard smoke succeeded but screenshot was not created at ${screenshotPath}`);
  }

  const personasPath = path.join(runDir, "logs", "network-personas.json");
  const dashboardPath = path.join(runDir, "logs", "network-dashboard.json");
  const personas = await requestJson(`${args.apiBaseUrl.replace(/\/$/, "")}/api/v1/graph/personas`);
  writeJson(personasPath, personas);
  const learnerId = personas?.items?.[0]?.learnerId || personas?.items?.[0]?.personaId;
  if (!learnerId) {
    fail("Dashboard recipe could not resolve a learnerId from /api/v1/graph/personas.");
  }

  const dashboard = await requestJson(
    `${args.apiBaseUrl.replace(/\/$/, "")}/api/v1/graph/dashboard?learnerId=${encodeURIComponent(learnerId)}`,
  );
  writeJson(dashboardPath, dashboard);

  replaceScaffoldPlaceholder(summaryPath, [
    `- ${args.label} passed in trusted CI with a reviewer-visible screenshot.`,
    `- Route under test: \`${args.route}?learnerId=${learnerId}\``,
    `- Screenshot: \`${screenshotRelativePath}\``,
    `- Log: \`${logRelativePath}\``,
  ]);
  appendSection(summaryPath, "CI Verification", [
    `- ${args.label} passed.`,
    `- Route under test: \`${args.route}?learnerId=${learnerId}\``,
    `- Screenshot: \`${screenshotRelativePath}\``,
    `- Log: \`${logRelativePath}\``,
  ]);
  appendSection(stepsPath, "Trusted CI Replay", [
    "1. Initialized a `validate-issue` run scaffold.",
    `2. Ran \`${commandText}\` against the pre-started CI client and server.`,
    `3. Captured the screenshot directly into \`${screenshotRelativePath}\`.`,
    `4. Stored the dashboard personas and read-model payloads in the run logs and finalized the run as fixed.`,
  ]);
  writeEvidence(runDir, {
    summary: `${args.label} passed in trusted CI with a reviewer-visible screenshot.`,
    screenshotRelativePath,
    logRelativePath,
    personasRelativePath: path.relative(process.cwd(), personasPath),
    dashboardRelativePath: path.relative(process.cwd(), dashboardPath),
    label: args.label,
    route: args.route,
    clientBaseUrl: args.clientBaseUrl,
    apiBaseUrl: args.apiBaseUrl,
  });
  runOrFail("python3", [
    ".agents/skills/_functional-qa/scripts/qa_runtime.py",
    "finalize-run",
    "--run-dir",
    runDir,
    "--verdict",
    "fixed",
    "--repro-status",
    "not-reproduced",
    "--fix-status",
    "fixed",
    "--issue-accuracy",
    "accurate",
    "--confidence",
    "0.94",
  ]);
  updateSummaryStatus(summaryPath, { verdict: "fixed", confidence: "0.94" });
  process.stdout.write(`${runDir}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
