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
    recipe: "",
    issueRef: "",
    route: "",
    scenarioSeed: "",
    checkpointId: "",
    baseUrl: "http://127.0.0.1:3000",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    switch (token) {
      case "--recipe":
        args.recipe = next || "";
        index += 1;
        break;
      case "--issue-ref":
        args.issueRef = next || "";
        index += 1;
        break;
      case "--route":
        args.route = next || "";
        index += 1;
        break;
      case "--scenario-seed":
        args.scenarioSeed = next || "";
        index += 1;
        break;
      case "--checkpoint-id":
        args.checkpointId = next || "";
        index += 1;
        break;
      case "--base-url":
        args.baseUrl = next || args.baseUrl;
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

  if (!args.recipe) fail("--recipe is required.");
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/run_qa_publish_recipe.mjs --recipe <id> [options]

Runs a trusted CI QA recipe and prints the generated run directory.

Options:
  --issue-ref <ref>
  --route <route>
  --scenario-seed <id>
  --checkpoint-id <id>
  --base-url <url>`);
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim() || `${command} failed`;
    fail(detail);
  }
  return result.stdout.trim();
}

function resolveRecipe(args) {
  switch (args.recipe) {
    case "haeun_fresh_demo":
      return {
        command: "python3",
        args: [
          "scripts/record_haeun_fresh_demo.py",
          "--base-url",
          args.baseUrl,
          "--playthrough-style",
          "proof",
        ],
        description: "Fresh Haeun live cinematic reviewer-proof capture",
      };
    case "issue_49_checkpoint_resume":
      return {
        command: "node",
        args: [
          "scripts/record_issue_api_flow_recipe.mjs",
          "--issue-ref",
          args.issueRef,
          "--route",
          args.route || "/game",
          "--base-url",
          args.baseUrl.replace(/:3000$/, ":8787"),
          "--label",
          "Checkpoint resume strict API flow",
        ],
        description: "Strict API replay for persisted checkpoint resume",
      };
    case "issue_51_scenario_seed_api":
      return {
        command: "node",
        args: [
          "scripts/record_issue_api_flow_recipe.mjs",
          "--issue-ref",
          args.issueRef,
          "--route",
          args.route || "/game",
          "--base-url",
          args.baseUrl.replace(/:3000$/, ":8787"),
          "--label",
          "Scenario seed strict API flow",
          "--check-scenario-seed",
        ],
        description: "Strict API replay for scenario seed start-or-resume behavior",
      };
    case "issue_52_progression_persistence":
      return {
        command: "node",
        args: [
          "scripts/record_issue_api_flow_recipe.mjs",
          "--issue-ref",
          args.issueRef,
          "--route",
          args.route || "/game",
          "--base-url",
          args.baseUrl.replace(/:3000$/, ":8787"),
          "--label",
          "Progression persistence strict API flow",
          "--check-progression-persistence",
        ],
        description: "Strict API replay for mission gate, unlock, and reward persistence",
      };
    default:
      fail(
        `Unsupported qa_recipe: ${args.recipe}. Add it to scripts/run_qa_publish_recipe.mjs before using it in PR metadata.`,
      );
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const recipe = resolveRecipe(args);
  const output = runCommand(recipe.command, recipe.args);
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const runDir = lines.at(-1);
  if (!runDir) {
    fail(`Recipe ${args.recipe} did not print a run directory.`);
  }
  if (args.issueRef) {
    const manifestPath = path.join(
      path.isAbsolute(runDir) ? runDir : path.join(process.cwd(), runDir),
      "run.json",
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.issue_ref = args.issueRef;
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }
  process.stdout.write(`${runDir}\n`);
}

main();
