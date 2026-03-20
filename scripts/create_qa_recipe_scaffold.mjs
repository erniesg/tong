#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const TEMPLATE_DEFAULTS = {
  "api-flow": {
    route: "/game",
    label: "Strict API flow proof",
    description: "Strict API replay for issue verification",
  },
  "dashboard-smoke": {
    route: "/dashboard",
    label: "Dashboard smoke proof",
    description: "Dashboard smoke validation with reviewer-visible screenshot capture",
  },
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    issueRef: "",
    recipeId: "",
    route: "",
    template: "api-flow",
    label: "",
    description: "",
    noRegister: false,
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    switch (token) {
      case "--issue-ref":
        args.issueRef = next || "";
        index += 1;
        break;
      case "--recipe":
        args.recipeId = next || "";
        index += 1;
        break;
      case "--route":
        args.route = next || "";
        index += 1;
        break;
      case "--template":
        args.template = next || args.template;
        index += 1;
        break;
      case "--label":
        args.label = next || "";
        index += 1;
        break;
      case "--description":
        args.description = next || "";
        index += 1;
        break;
      case "--no-register":
        args.noRegister = true;
        break;
      case "--force":
        args.force = true;
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
  if (!TEMPLATE_DEFAULTS[args.template]) {
    fail(`Unsupported --template value: ${args.template}`);
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/create_qa_recipe_scaffold.mjs --issue-ref <ref> [options]

Options:
  --recipe <id>          Explicit qa_recipe id (default: derived from issue + route/template)
  --route <route>        Route metadata for publish defaults (default: template-specific)
  --template <name>      One of: api-flow, dashboard-smoke
  --label <text>         Human-readable label used in the generated runner
  --description <text>   Dispatcher description used in scripts/run_qa_publish_recipe.mjs
  --no-register          Only create the runner file; do not edit dispatcher/default mappings
  --force                Overwrite an existing runner file / tolerate existing registrations
`);
}

function issueNumberFromRef(issueRef) {
  const match = String(issueRef || "").match(/#(\d+)/);
  if (!match) {
    fail(`Could not parse issue number from ${issueRef}`);
  }
  return match[1];
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function deriveRecipeId(args, issueNumber) {
  if (args.recipeId) return args.recipeId;
  const slugSource =
    args.label ||
    args.route ||
    (args.template === "dashboard-smoke" ? "dashboard_smoke" : "api_flow");
  const slug = slugify(slugSource) || (args.template === "dashboard-smoke" ? "dashboard_smoke" : "api_flow");
  return `issue_${issueNumber}_${slug}`;
}

function deriveRoute(args) {
  return args.route || TEMPLATE_DEFAULTS[args.template].route;
}

function deriveLabel(args, issueNumber) {
  return args.label || `Issue ${issueNumber} ${TEMPLATE_DEFAULTS[args.template].label}`;
}

function deriveDescription(args, label) {
  return args.description || label;
}

function runnerFilePath(recipeId) {
  return path.join("scripts", `record_${recipeId}_recipe.mjs`);
}

function escapeJsString(value) {
  return JSON.stringify(String(value));
}

function renderApiFlowRunner({ issueRef, route, label }) {
  return `#!/usr/bin/env node

import { spawnSync } from "node:child_process";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    issueRef: ${escapeJsString(issueRef)},
    route: ${escapeJsString(route)},
    baseUrl: process.env.TONG_LOCAL_API_BASE_URL || "http://127.0.0.1:8787",
    label: ${escapeJsString(label)},
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    switch (token) {
      case "--issue-ref":
        args.issueRef = next || args.issueRef;
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
      case "--help":
      case "-h":
        console.log("Usage: node ${path.basename(runnerFilePath("RECIPE_ID"))} [--issue-ref <ref>] [--route <route>] [--base-url <url>] [--label <text>]");
        process.exit(0);
      default:
        fail(\`Unknown argument: \${token}\`);
    }
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const delegateArgs = [
    "scripts/record_issue_api_flow_recipe.mjs",
    "--issue-ref",
    args.issueRef,
    "--route",
    args.route,
    "--base-url",
    args.baseUrl,
    "--label",
    args.label,
  ];

  // Extend this wrapper with issue-specific flags or post-processing as needed.
  const result = spawnSync("node", delegateArgs, {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
}

main();
`;
}

function renderDashboardRunner({ issueRef, route, label }) {
  return `#!/usr/bin/env node

import { spawnSync } from "node:child_process";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    issueRef: ${escapeJsString(issueRef)},
    route: ${escapeJsString(route)},
    apiBaseUrl: process.env.TONG_LOCAL_API_BASE_URL || "http://127.0.0.1:8787",
    clientBaseUrl: process.env.TONG_LOCAL_CLIENT_BASE_URL || "http://127.0.0.1:3000",
    label: ${escapeJsString(label)},
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    switch (token) {
      case "--issue-ref":
        args.issueRef = next || args.issueRef;
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
        console.log("Usage: node ${path.basename(runnerFilePath("RECIPE_ID"))} [--issue-ref <ref>] [--route <route>] [--api-base-url <url>] [--client-base-url <url>] [--label <text>]");
        process.exit(0);
      default:
        fail(\`Unknown argument: \${token}\`);
    }
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const delegateArgs = [
    "scripts/record_dashboard_smoke_recipe.mjs",
    "--issue-ref",
    args.issueRef,
    "--route",
    args.route,
    "--api-base-url",
    args.apiBaseUrl,
    "--client-base-url",
    args.clientBaseUrl,
    "--label",
    args.label,
  ];

  // Extend this wrapper with issue-specific setup once the visual proof path needs it.
  const result = spawnSync("node", delegateArgs, {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
}

main();
`;
}

function renderRunnerFile(args) {
  if (args.template === "dashboard-smoke") {
    return renderDashboardRunner(args);
  }
  return renderApiFlowRunner(args);
}

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
}

function ensureInsertable(sourcePath, marker, description) {
  const source = readFile(sourcePath);
  const index = source.indexOf(marker);
  if (index === -1) {
    fail(`Could not find insertion marker for ${description} in ${sourcePath}`);
  }
  return { source, index };
}

function insertRecipeCase({ sourcePath, recipeId, runnerRelativePath, route, template, label, description, force }) {
  const caseMarker = `case ${escapeJsString(recipeId)}`;
  const source = readFile(sourcePath);
  if (source.includes(caseMarker)) {
    if (force) return false;
    fail(`Recipe ${recipeId} is already registered in ${sourcePath}`);
  }

  const resolveRecipeIndex = source.indexOf("function resolveRecipe(args) {");
  if (resolveRecipeIndex === -1) {
    fail(`Could not find resolveRecipe(args) in ${sourcePath}`);
  }
  const marker = "    default:\n";
  const index = source.indexOf(marker, resolveRecipeIndex);
  if (index === -1) {
    fail(`Could not find resolveRecipe default case in ${sourcePath}`);
  }

  const routeExpression = `args.route || ${escapeJsString(route)}`;
  const baseUrlLines =
    template === "dashboard-smoke"
      ? [
          `          "--client-base-url",`,
          `          args.baseUrl,`,
          `          "--api-base-url",`,
          `          args.baseUrl.replace(/:3000$/, ":8787"),`,
        ]
      : [
          `          "--base-url",`,
          `          args.baseUrl.replace(/:3000$/, ":8787"),`,
        ];

  const caseBlock = [
    `    case ${escapeJsString(recipeId)}:`,
    `      return {`,
    `        command: "node",`,
    `        args: [`,
    `          ${escapeJsString(runnerRelativePath)},`,
    `          "--issue-ref",`,
    `          args.issueRef,`,
    `          "--route",`,
    `          ${routeExpression},`,
    ...baseUrlLines,
    `          "--label",`,
    `          ${escapeJsString(label)},`,
    `        ],`,
    `        description: ${escapeJsString(description)},`,
    `      };`,
    ``,
  ].join("\n");

  writeFile(sourcePath, `${source.slice(0, index)}${caseBlock}${source.slice(index)}`);
  return true;
}

function insertDefaultMapping({ sourcePath, issueNumber, recipeId, route, force }) {
  const source = readFile(sourcePath);
  const issueCaseMarker = `case ${escapeJsString(issueNumber)}:`;
  if (source.includes(issueCaseMarker)) {
    if (source.includes(`qa_recipe: ${escapeJsString(recipeId)}`)) {
      return false;
    }
    if (force) return false;
    fail(`Issue #${issueNumber} already has a default publish mapping in ${sourcePath}`);
  }

  const marker = "    default:\n";
  const index = source.indexOf(marker);
  if (index === -1) {
    fail(`Could not find default case in ${sourcePath}`);
  }

  const caseBlock = [
    `    case ${escapeJsString(issueNumber)}:`,
    `      return {`,
    `        route: ${escapeJsString(route)},`,
    `        qa_recipe: ${escapeJsString(recipeId)},`,
    `      };`,
    ``,
  ].join("\n");

  writeFile(sourcePath, `${source.slice(0, index)}${caseBlock}${source.slice(index)}`);
  return true;
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const issueNumber = issueNumberFromRef(parsed.issueRef);
  const route = deriveRoute(parsed);
  const recipeId = deriveRecipeId({ ...parsed, route }, issueNumber);
  const label = deriveLabel(parsed, issueNumber);
  const description = deriveDescription(parsed, label);
  const runnerRelativePath = runnerFilePath(recipeId);
  const runnerAbsolutePath = path.join(process.cwd(), runnerRelativePath);

  if (fs.existsSync(runnerAbsolutePath) && !parsed.force) {
    fail(`Runner file already exists: ${runnerRelativePath}`);
  }

  const runnerContent = renderRunnerFile({
    template: parsed.template,
    issueRef: parsed.issueRef,
    route,
    label,
  }).replaceAll("RECIPE_ID", recipeId);
  writeFile(runnerAbsolutePath, runnerContent);

  const changes = [
    `created ${runnerRelativePath}`,
  ];

  if (!parsed.noRegister) {
    const recipeRegistered = insertRecipeCase({
      sourcePath: path.join(process.cwd(), "scripts", "run_qa_publish_recipe.mjs"),
      recipeId,
      runnerRelativePath,
      route,
      template: parsed.template,
      label,
      description,
      force: parsed.force,
    });
    const defaultRegistered = insertDefaultMapping({
      sourcePath: path.join(process.cwd(), "scripts", "lib", "qa_publish_defaults.mjs"),
      issueNumber,
      recipeId,
      route,
      force: parsed.force,
    });

    if (recipeRegistered) changes.push(`registered ${recipeId} in scripts/run_qa_publish_recipe.mjs`);
    if (defaultRegistered) changes.push(`mapped issue #${issueNumber} to ${recipeId} in scripts/lib/qa_publish_defaults.mjs`);
  }

  console.log("QA recipe scaffolded.");
  console.log(`- issue: ${parsed.issueRef}`);
  console.log(`- recipe: ${recipeId}`);
  console.log(`- template: ${parsed.template}`);
  console.log(`- route: ${route}`);
  console.log(`- runner: ${runnerRelativePath}`);
  console.log(`- label: ${label}`);
  for (const line of changes) {
    console.log(`- ${line}`);
  }
}

main();
