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
    route: "/game",
    baseUrl: process.env.TONG_LOCAL_API_BASE_URL || "http://127.0.0.1:8787",
    label: "Strict API flow verification",
    checkScenarioSeed: false,
    checkProgressionPersistence: false,
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
      case "--base-url":
        args.baseUrl = next || args.baseUrl;
        index += 1;
        break;
      case "--label":
        args.label = next || args.label;
        index += 1;
        break;
      case "--check-scenario-seed":
        args.checkScenarioSeed = true;
        break;
      case "--check-progression-persistence":
        args.checkProgressionPersistence = true;
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
  console.log(`Usage: node scripts/record_issue_api_flow_recipe.mjs --issue-ref <ref> [options]

Options:
  --route <route>                         Route metadata to store in the run bundle (default: /game)
  --base-url <url>                       Local API base url (default: http://127.0.0.1:8787)
  --label <text>                         Summary label for the command
  --check-scenario-seed                  Assert scenarioSeedId resume behavior
  --check-progression-persistence        Assert missionGate/unlocks/rewards persistence across resume`);
}

function runCommand(command, args, { capture = true } = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: capture ? ["inherit", "pipe", "pipe"] : "inherit",
  });
  return result;
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

function writeEvidence(
  runDir,
  { label, route, commandText, logRelativePath, networkTraceRelativePath, success, errorText, scenarioSeed, progressionPersistence },
) {
  const evidencePath = path.join(runDir, "evidence.json");
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  const notes = [
    `${label} ran in trusted CI against ${route}.`,
    `Command: \`${commandText}\``,
  ];

  if (scenarioSeed) {
    notes.push("Scenario seed assertions were enabled.");
  }
  if (progressionPersistence) {
    notes.push("Mission gate, unlock, and reward persistence assertions were enabled.");
  }
  if (!success && errorText) {
    notes.push(`Failure summary: ${errorText}`);
  }

  evidence.summary = success
    ? `${label} passed in trusted CI.`
    : `${label} failed in trusted CI.`;
  evidence.notes = [...(evidence.notes || []), ...notes];
  evidence.console_logs = [
    ...(evidence.console_logs || []),
    {
      path: logRelativePath,
      label: "api-flow-log",
      description: `${label} command transcript`,
    },
  ];
  evidence.network_traces = [
    ...(evidence.network_traces || []),
    {
      path: networkTraceRelativePath,
      label: "api-flow-network-trace",
      description: `${label} structured request/response trace`,
    },
  ];
  evidence.contract_assertions = [
    ...(evidence.contract_assertions || []),
    {
      path: logRelativePath,
      label: "api-flow-assertions",
      description: success
        ? `${label} assertion transcript`
        : `${label} failing assertion transcript`,
    },
  ];
  evidence.validation = {
    ...(evidence.validation || {}),
    runtime_modes_exercised: [
      ...new Set([
        ...((evidence.validation && evidence.validation.runtime_modes_exercised) || []),
        "strict-api-flow",
        ...(scenarioSeed ? ["scenario-seed"] : []),
        ...(progressionPersistence ? ["progression-persistence"] : []),
      ]),
    ],
    notes: [
      ...new Set([
        ...((evidence.validation && evidence.validation.notes) || []),
        success ? `${label} passed in CI.` : `${label} failed in CI.`,
      ]),
    ],
  };

  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const runDir = runOrFail("python3", [
    ".agents/skills/_functional-qa/scripts/qa_runtime.py",
    "init-run",
    "validate-issue",
    "--target",
    args.issueRef,
    "--verify-fix",
  ]).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).at(-1);

  if (!runDir) {
    fail("qa_runtime init-run did not return a run directory.");
  }

  const logPath = path.join(runDir, "logs", "api-flow-check.log");
  const networkTracePath = path.join(runDir, "logs", "api-flow-network-trace.json");
  const commandArgs = [
    "scripts/mock_api_flow_check.mjs",
    args.baseUrl,
    "--strict-state",
    `--trace-file=${networkTracePath}`,
    ...(args.checkScenarioSeed ? ["--check-scenario-seed"] : []),
    ...(args.checkProgressionPersistence ? ["--check-progression-persistence"] : []),
  ];
  const commandText = `node ${commandArgs.join(" ")}`;
  const result = runCommand("node", commandArgs);
  const transcript = [
    `$ ${commandText}`,
    "",
    (result.stdout || "").trim(),
    (result.stderr || "").trim(),
  ]
    .filter(Boolean)
    .join("\n");
  fs.writeFileSync(logPath, `${transcript}\n`, "utf8");

  const summaryPath = path.join(runDir, "summary.md");
  const stepsPath = path.join(runDir, "steps.md");
  const logRelativePath = path.relative(process.cwd(), logPath);
  const networkTraceRelativePath = path.relative(process.cwd(), networkTracePath);
  const routeNote = `Route under test: \`${args.route}\``;

  if (result.status === 0) {
    replaceScaffoldPlaceholder(summaryPath, [
      `- ${args.label} passed in trusted CI.`,
      `- ${routeNote}`,
      `- Log: \`${logRelativePath}\``,
      `- Network trace: \`${networkTraceRelativePath}\``,
    ]);
    appendSection(summaryPath, "CI Verification", [
      `- ${args.label} passed.`,
      `- ${routeNote}`,
      `- Log: \`${logRelativePath}\``,
      `- Network trace: \`${networkTraceRelativePath}\``,
    ]);
    appendSection(stepsPath, "Trusted CI Replay", [
      "1. Initialized a `validate-issue --verify-fix` run scaffold.",
      `2. Ran \`${commandText}\`.`,
      "3. Stored the command transcript and structured network trace in the run logs, then finalized the verification run as fixed.",
    ]);
    writeEvidence(runDir, {
      label: args.label,
      route: args.route,
      commandText,
      logRelativePath,
      networkTraceRelativePath,
      success: true,
      scenarioSeed: args.checkScenarioSeed,
      progressionPersistence: args.checkProgressionPersistence,
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
      "0.93",
    ]);
    updateSummaryStatus(summaryPath, { verdict: "fixed", confidence: "0.93" });
  } else {
    const errorText = (result.stderr || result.stdout || "").trim() || "api-flow-check failed";
    replaceScaffoldPlaceholder(summaryPath, [
      `- ${args.label} failed in trusted CI.`,
      `- ${routeNote}`,
      `- Log: \`${logRelativePath}\``,
      `- Network trace: \`${networkTraceRelativePath}\``,
      `- Failure summary: ${errorText}`,
    ]);
    appendSection(summaryPath, "CI Verification", [
      `- ${args.label} failed.`,
      `- ${routeNote}`,
      `- Log: \`${logRelativePath}\``,
      `- Network trace: \`${networkTraceRelativePath}\``,
      `- Failure summary: ${errorText}`,
    ]);
    appendSection(stepsPath, "Trusted CI Replay", [
      "1. Initialized a `validate-issue --verify-fix` run scaffold.",
      `2. Ran \`${commandText}\`.`,
      "3. Stored the failing transcript and network trace in the run logs, then finalized the verification run as still reproducing.",
    ]);
    writeEvidence(runDir, {
      label: args.label,
      route: args.route,
      commandText,
      logRelativePath,
      networkTraceRelativePath,
      success: false,
      errorText,
      scenarioSeed: args.checkScenarioSeed,
      progressionPersistence: args.checkProgressionPersistence,
    });
    runOrFail("python3", [
      ".agents/skills/_functional-qa/scripts/qa_runtime.py",
      "finalize-run",
      "--run-dir",
      runDir,
      "--verdict",
      "reproduced",
      "--repro-status",
      "reproduced",
      "--fix-status",
      "still-reproduces",
      "--issue-accuracy",
      "accurate",
      "--confidence",
      "0.88",
    ]);
    updateSummaryStatus(summaryPath, { verdict: "reproduced", confidence: "0.88" });
  }

  process.stdout.write(`${runDir}\n`);
}

main();
