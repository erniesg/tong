#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { relativeToRepo, resolveRepoRoot } from "./lib/qa_evidence.mjs";

const REQUIRED_ENV_VARS = [
  {
    name: "TONG_RUNS_R2_BUCKET",
    description: "Reviewer-facing QA evidence bucket",
  },
  {
    name: "TONG_RUNS_PUBLIC_BASE_URL",
    description: "Public base URL for uploaded reviewer-facing proof",
    validate(value) {
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },
    invalidMessage: "must be an absolute http(s) URL",
  },
];

const REQUIRED_COMMANDS = [
  {
    label: "node",
    command: "node",
    args: ["--version"],
    description: "Runs the QA scripts",
  },
  {
    label: "npm",
    command: "npm",
    args: ["--version"],
    description: "Runs repo package scripts",
  },
  {
    label: "python3",
    command: "python3",
    args: ["--version"],
    description: "Runs capture_reviewer_proof.py",
  },
  {
    label: "ffmpeg",
    command: "ffmpeg",
    args: ["-version"],
    description: "Generates reviewer GIF previews and poster frames",
  },
  {
    label: "ffprobe",
    command: "ffprobe",
    args: ["-version"],
    description: "Inspects proof video duration for preview selection",
  },
];

const OPTIONAL_COMMANDS = [
  {
    label: "magick",
    command: "magick",
    args: ["-version"],
    description: "Auto-generates comparison panels and focused crops",
  },
];

const REQUIRED_FILES = [
  "scripts/upload-qa-evidence.mjs",
  "scripts/render-qa-comment.mjs",
  ".agents/skills/_functional-qa/scripts/capture_reviewer_proof.py",
  "apps/client/wrangler.toml",
];

function parseArgs(argv) {
  const args = {
    json: false,
  };

  for (const arg of argv) {
    if (arg === "--json") {
      args.json = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/qa_evidence_preflight.mjs [options]

Checks whether the current shell can publish reviewer-visible QA evidence.

Options:
  --json    Print the full result as JSON
`);
}

function runCheck(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function firstLine(text) {
  return (text || "").trim().split("\n")[0] || "";
}

function checkCommand(definition, cwd) {
  const result = runCheck(definition.command, definition.args, cwd);
  if (result.status !== 0) {
    return {
      kind: "command",
      label: definition.label,
      ok: false,
      description: definition.description,
      detail: firstLine(result.stderr || result.stdout) || "command failed",
    };
  }

  return {
    kind: "command",
    label: definition.label,
    ok: true,
    description: definition.description,
    detail: firstLine(result.stdout || result.stderr),
  };
}

function checkWrangler(repoRoot) {
  const result = runCheck("npm", ["--prefix", "apps/client", "exec", "wrangler", "--", "--version"], repoRoot);
  if (result.status !== 0) {
    return {
      kind: "command",
      label: "wrangler",
      ok: false,
      description: "Uploads evidence to the R2 reviewer-proof bucket",
      detail: firstLine(result.stderr || result.stdout) || "wrangler command failed",
    };
  }

  return {
    kind: "command",
    label: "wrangler",
    ok: true,
    description: "Uploads evidence to the R2 reviewer-proof bucket",
    detail: firstLine(result.stdout || result.stderr),
  };
}

function checkEnv(definition) {
  const value = process.env[definition.name];
  if (!value) {
    return {
      kind: "env",
      label: definition.name,
      ok: false,
      description: definition.description,
      detail: "missing",
    };
  }

  if (definition.validate && !definition.validate(value)) {
    return {
      kind: "env",
      label: definition.name,
      ok: false,
      description: definition.description,
      detail: definition.invalidMessage || "invalid value",
      value,
    };
  }

  return {
    kind: "env",
    label: definition.name,
    ok: true,
    description: definition.description,
    detail: value,
  };
}

function checkFile(relativePath, repoRoot) {
  const absolutePath = path.join(repoRoot, relativePath);
  return {
    kind: "file",
    label: relativePath,
    ok: fs.existsSync(absolutePath),
    description: "Required repo entry point",
    detail: relativeToRepo(repoRoot, absolutePath),
  };
}

function buildResult(repoRoot) {
  const required = [
    ...REQUIRED_ENV_VARS.map((entry) => checkEnv(entry)),
    ...REQUIRED_COMMANDS.map((entry) => checkCommand(entry, repoRoot)),
    checkWrangler(repoRoot),
    ...REQUIRED_FILES.map((entry) => checkFile(entry, repoRoot)),
  ];

  const warnings = OPTIONAL_COMMANDS.map((entry) => checkCommand(entry, repoRoot));

  return {
    repo_root: repoRoot,
    ok: required.every((item) => item.ok),
    required,
    warnings,
    next_steps: [
      "npm run qa:upload-evidence -- --run-dir <RUN_DIR> --include-supporting",
      "python3 .agents/skills/_functional-qa/scripts/capture_reviewer_proof.py --run-dir <RUN_DIR>",
      "npm run qa:render-comment -- --run-dir <RUN_DIR>",
    ],
    notes: [
      "`artifacts/qa-runs/...` is local staging only; reviewer-visible proof must publish to `tong-runs` or another reviewer-openable surface.",
      "Missing `magick` does not block uploads, but the uploader will skip auto-generated comparison panels and focused crops.",
    ],
  };
}

function renderText(result) {
  const lines = [];
  lines.push("Reviewer-proof preflight");
  lines.push("");

  for (const item of result.required) {
    const status = item.ok ? "PASS" : "FAIL";
    lines.push(`- ${status} ${item.label}: ${item.detail}`);
  }

  for (const item of result.warnings) {
    const status = item.ok ? "PASS" : "WARN";
    lines.push(`- ${status} ${item.label}: ${item.detail}`);
  }

  lines.push("");
  lines.push(result.ok ? "Ready for reviewer-visible evidence publication." : "Not ready for reviewer-visible evidence publication.");
  lines.push("");
  lines.push("Next:");
  for (const step of result.next_steps) {
    lines.push(`- ${step}`);
  }
  lines.push("");
  lines.push("Notes:");
  for (const note of result.notes) {
    lines.push(`- ${note}`);
  }

  if (!result.ok) {
    lines.push("");
    lines.push("Missing env example:");
    lines.push("- export TONG_RUNS_R2_BUCKET=tong-runs");
    lines.push("- export TONG_RUNS_PUBLIC_BASE_URL=https://runs.tong.berlayar.ai");
  }

  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolveRepoRoot();
  const result = buildResult(repoRoot);

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderText(result)}\n`);
  }

  process.exit(result.ok ? 0 : 1);
}

main();
