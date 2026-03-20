#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import process from "node:process";
import { defaultPublishRequest } from "./lib/qa_publish_defaults.mjs";

const EVIDENCE_BY_CLASS = {
  "interaction-input": ["temporal-capture", "cue-timestamps", "console-state-trace", "screenshots"],
  "visual-layout": ["screenshots", "comparison-panel"],
  "animation-transition": ["temporal-capture", "cue-timestamps", "screenshots"],
  "async-streaming-state": ["temporal-capture", "cue-timestamps", "network-trace", "console-state-trace"],
  "data-contract-api": ["contract-assertions", "network-trace"],
  "persistence-state-sync": ["console-state-trace", "contract-assertions"],
  "performance-resource": ["perf-profile"],
  "compatibility-environment": ["cross-env-matrix"],
  "localization-content": ["screenshots", "comparison-panel", "comparison-focus-crop"],
  "auth-permissions": ["screenshots", "network-trace", "console-state-trace"],
  "integration-third-party": ["network-trace", "contract-assertions"],
  "accessibility": ["screenshots", "comparison-panel"],
  "flaky-nondeterministic": ["temporal-capture", "cue-timestamps", "console-state-trace"],
  "functional-logic": ["contract-assertions", "console-state-trace"],
};

const CLASSIFIERS = [
  {
    issueClass: "data-contract-api",
    keywords: ["api", "endpoint", "schema", "payload", "fixture", "contract", "response", "request body", "ingestion"],
    routePrefixes: ["/api/"],
    reasons: ["Issue points at an API or contract surface."],
  },
  {
    issueClass: "persistence-state-sync",
    keywords: ["checkpoint", "resume", "persist", "restore", "saved state", "session", "cache", "sync"],
    reasons: ["Issue centers on resume, checkpoint, or persisted state behavior."],
  },
  {
    issueClass: "localization-content",
    keywords: ["translation", "romanization", "subtitle", "hangul", "hanja", "kanji", "pronunciation", "locale", "copy"],
    reasons: ["Issue is about language content or localized presentation."],
  },
  {
    issueClass: "animation-transition",
    keywords: ["animation", "transition", "fade", "flicker", "flash", "stale frame", "dismiss"],
    reasons: ["Issue looks timing-sensitive around a transition or animated state."],
  },
  {
    issueClass: "async-streaming-state",
    keywords: ["stream", "streaming", "loading", "arrives all at once", "race", "delayed", "async"],
    reasons: ["Issue mentions asynchronous or race-like state updates."],
  },
  {
    issueClass: "interaction-input",
    keywords: ["click", "tap", "press", "hover", "gesture", "button", "link", "input", "route"],
    reasons: ["Issue is driven by user interaction on a visible surface."],
  },
  {
    issueClass: "visual-layout",
    keywords: ["layout", "spacing", "overlap", "clip", "cropped", "typography", "font", "misaligned", "overflow", "visual"],
    reasons: ["Issue is a reviewer-visible layout or typography regression."],
  },
  {
    issueClass: "accessibility",
    keywords: ["keyboard", "focus", "screen reader", "contrast", "aria", "target size"],
    reasons: ["Issue is about accessibility behavior or presentation."],
  },
  {
    issueClass: "compatibility-environment",
    keywords: ["safari", "ios", "android", "firefox", "chrome", "browser", "device", "worker"],
    reasons: ["Issue is environment- or browser-specific."],
  },
  {
    issueClass: "performance-resource",
    keywords: ["slow", "lag", "perf", "performance", "memory", "cpu", "jank"],
    reasons: ["Issue is framed as a performance or resource problem."],
  },
  {
    issueClass: "auth-permissions",
    keywords: ["auth", "permission", "permissions", "401", "403", "login", "role"],
    reasons: ["Issue is gated by auth or permissions behavior."],
  },
  {
    issueClass: "integration-third-party",
    keywords: ["youtube", "spotify", "openai", "github", "clerk", "webhook"],
    reasons: ["Issue depends on an external integration boundary."],
  },
  {
    issueClass: "flaky-nondeterministic",
    keywords: ["flaky", "intermittent", "sometimes", "random", "nondeterministic"],
    reasons: ["Issue is described as intermittent or hard to pin down."],
  },
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    issueRef: "",
    title: "",
    body: "",
    route: "",
    headRef: "",
    json: false,
    noFetch: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    switch (token) {
      case "--issue-ref":
        args.issueRef = next || "";
        index += 1;
        break;
      case "--title":
        args.title = next || "";
        index += 1;
        break;
      case "--body":
        args.body = next || "";
        index += 1;
        break;
      case "--route":
        args.route = next || "";
        index += 1;
        break;
      case "--head-ref":
        args.headRef = next || "";
        index += 1;
        break;
      case "--json":
        args.json = true;
        break;
      case "--no-fetch":
        args.noFetch = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        fail(`Unknown argument: ${token}`);
    }
  }

  if (!args.issueRef && !args.title && !args.body) {
    fail("Provide at least one of --issue-ref, --title, or --body.");
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/suggest_qa_recipe.mjs [options]

Suggest a deterministic QA evidence path for an issue or PR surface.

Options:
  --issue-ref <owner/repo#num>  GitHub issue reference to inspect
  --title <text>                Issue or PR title
  --body <text>                 Issue or PR body / bug description
  --route <path>                Explicit route or endpoint under test
  --head-ref <branch>           PR head branch name for recipe/default inference
  --json                        Emit machine-readable JSON instead of text
  --no-fetch                    Do not fetch issue metadata through gh api
`);
}

function hasKeyword(haystack, keywords) {
  return keywords.some((keyword) => haystack.includes(keyword));
}

function parseIssueRef(issueRef) {
  const fullMatch = String(issueRef || "").trim().match(/^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)#(\d+)$/);
  if (fullMatch) {
    return {
      repo: fullMatch[1],
      number: fullMatch[2],
      issueRef: `${fullMatch[1]}#${fullMatch[2]}`,
    };
  }

  const shortMatch = String(issueRef || "").trim().match(/^#(\d+)$/);
  if (shortMatch && process.env.GITHUB_REPOSITORY) {
    return {
      repo: process.env.GITHUB_REPOSITORY,
      number: shortMatch[1],
      issueRef: `${process.env.GITHUB_REPOSITORY}#${shortMatch[1]}`,
    };
  }

  return null;
}

function runGhApi(endpoint) {
  const result = spawnSync("gh", ["api", endpoint], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim() || "gh api failed";
    throw new Error(detail);
  }
  return JSON.parse(result.stdout);
}

function tryFetchIssue(issueRef) {
  const parsed = parseIssueRef(issueRef);
  if (!parsed) return { data: null, warning: "" };
  try {
    const data = runGhApi(`repos/${parsed.repo}/issues/${parsed.number}`);
    return { data, warning: "" };
  } catch (error) {
    return { data: null, warning: `Issue metadata fetch skipped: ${error.message}` };
  }
}

function inferRoute({ route, title, body, headRef }) {
  if (route) return route;

  const routeMatch = `${title}\n${body}`.match(/(\/api\/v1\/[A-Za-z0-9/_-]+|\/dashboard|\/game|\/roadmap|\/[a-z][A-Za-z0-9/_-]*)/);
  if (routeMatch) return routeMatch[1];

  const signature = `${title}\n${body}\n${headRef}`.toLowerCase();
  if (signature.includes("dashboard")) return "/dashboard";
  if (signature.includes("start-or-resume") || signature.includes("checkpoint") || signature.includes("resume")) {
    return "/game";
  }
  return "";
}

function classifyIssue({ title, body, route, headRef }) {
  const signature = `${title}\n${body}\n${route}\n${headRef}`.toLowerCase();
  const reasons = [];

  for (const classifier of CLASSIFIERS) {
    const routeMatch = classifier.routePrefixes?.some((prefix) => route.startsWith(prefix));
    const keywordMatch = hasKeyword(signature, classifier.keywords || []);
    if (routeMatch || keywordMatch) {
      reasons.push(...classifier.reasons);
      return {
        issueClass: classifier.issueClass,
        reasons,
      };
    }
  }

  reasons.push("No narrower QA classification matched; defaulting to functional logic.");
  return {
    issueClass: "functional-logic",
    reasons,
  };
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function shellQuote(value) {
  return JSON.stringify(String(value));
}

function buildScaffoldCommand({ issueRef, template, route, label }) {
  if (!issueRef) return "";
  const parts = [
    "npm run qa:new-recipe --",
    "--issue-ref",
    shellQuote(issueRef),
    "--template",
    shellQuote(template),
  ];
  if (route) parts.push("--route", shellQuote(route));
  if (label) parts.push("--label", shellQuote(label));
  return parts.join(" ");
}

function summarizeTitle(title, fallback) {
  const cleaned = String(title || "")
    .replace(/^feat:\s*/i, "")
    .replace(/^fix:\s*/i, "")
    .trim();
  return cleaned || fallback;
}

function decideStrategy({ issueRef, title, body, route, headRef, issueClass }) {
  const defaults = defaultPublishRequest({
    issueRef: issueRef || "",
    title,
    headRef,
  });
  const reasons = [];

  if (defaults.qa_recipe) {
    reasons.push("Repo defaults already map this issue or PR signature to a supported CI recipe.");
    return {
      kind: "use-existing-recipe",
      qaRecipe: defaults.qa_recipe,
      route: defaults.route || route,
      template: defaults.qa_recipe.includes("dashboard") ? "dashboard-smoke" : "api-flow",
      command: issueRef
        ? `npm run qa:run-publish-recipe -- --recipe ${shellQuote(defaults.qa_recipe)} --issue-ref ${shellQuote(issueRef)}${defaults.route || route ? ` --route ${shellQuote(defaults.route || route)}` : ""}`
        : "",
      followup: "",
      reasons,
    };
  }

  const signature = `${title}\n${body}\n${route}\n${headRef}`.toLowerCase();
  const deterministicGameState =
    route === "/game" &&
    hasKeyword(signature, ["checkpoint", "resume", "session", "start-or-resume", "scenario seed", "objective"]);

  if (issueClass === "data-contract-api" || route.startsWith("/api/") || deterministicGameState) {
    reasons.push("This looks deterministic enough for a contract or strict API replay recipe.");
    return {
      kind: "scaffold-recipe",
      qaRecipe: "",
      route: route || "/game",
      template: "api-flow",
      command: buildScaffoldCommand({
        issueRef,
        template: "api-flow",
        route: route || "/game",
        label: summarizeTitle(title, "Strict API flow proof"),
      }),
      followup: "Customize the generated runner if the issue needs extra assertions or setup, then add the QA Publish Request block.",
      reasons,
    };
  }

  if (route === "/dashboard") {
    reasons.push("Dashboard issues can use the browser-backed deterministic screenshot path.");
    return {
      kind: "scaffold-recipe",
      qaRecipe: "",
      route,
      template: "dashboard-smoke",
      command: buildScaffoldCommand({
        issueRef,
        template: "dashboard-smoke",
        route,
        label: summarizeTitle(title, "Dashboard smoke proof"),
      }),
      followup: "Extend the generated runner if the proof needs seeded state before the dashboard capture.",
      reasons,
    };
  }

  if (["animation-transition", "async-streaming-state", "flaky-nondeterministic"].includes(issueClass)) {
    reasons.push("Timing-sensitive behavior should be traced before deciding whether a deterministic recipe is realistic.");
    return {
      kind: "trace-ui-state",
      qaRecipe: "",
      route,
      template: "",
      command: "",
      followup: "Run validate-issue, then trace-ui-state. If the fix becomes deterministic enough, add a recipe afterward; otherwise finish with capture-reviewer-proof.",
      reasons,
    };
  }

  if (["interaction-input", "visual-layout", "localization-content", "accessibility"].includes(issueClass)) {
    reasons.push("This is reviewer-visible UI work without a reusable deterministic CI recipe yet for the named surface.");
    return {
      kind: "capture-reviewer-proof",
      qaRecipe: "",
      route,
      template: "",
      command: "",
      followup: "Use validate-issue for repro/fix verification, then capture-reviewer-proof for final reviewer-facing media.",
      reasons,
    };
  }

  reasons.push("Start with validate-issue and only add a recipe if the validated flow becomes deterministic and replayable.");
  return {
    kind: "validate-issue",
    qaRecipe: "",
    route,
    template: "",
    command: "",
    followup: "Use the validation run to decide whether this surface deserves a new checked-in recipe or only trace/proof artifacts.",
    reasons,
  };
}

function toJsonSummary(summary) {
  return JSON.stringify(summary, null, 2);
}

function toTextSummary(summary) {
  const lines = [
    "QA recipe suggestion",
    `- Decision: ${summary.decision.kind}`,
    `- Issue class: ${summary.primary_issue_class}`,
    `- Route: ${summary.route || "n/a"}`,
    `- Evidence: ${summary.evidence_strategy.join(", ") || "n/a"}`,
  ];

  if (summary.decision.qaRecipe) {
    lines.push(`- Existing recipe: ${summary.decision.qaRecipe}`);
  }
  if (summary.decision.template) {
    lines.push(`- Scaffold template: ${summary.decision.template}`);
  }
  if (summary.decision.command) {
    lines.push(`- Suggested command: ${summary.decision.command}`);
  }
  if (summary.fetch_warning) {
    lines.push(`- Fetch note: ${summary.fetch_warning}`);
  }
  lines.push("- Why:");
  for (const reason of summary.reasons) {
    lines.push(`  - ${reason}`);
  }
  if (summary.decision.followup) {
    lines.push(`- Follow-up: ${summary.decision.followup}`);
  }

  return `${lines.join("\n")}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const fetchResult =
    args.issueRef && !args.noFetch && (!args.title || !args.body)
      ? tryFetchIssue(args.issueRef)
      : { data: null, warning: "" };

  const title = args.title || fetchResult.data?.title || "";
  const body = args.body || fetchResult.data?.body || "";
  const defaultHint = defaultPublishRequest({
    issueRef: args.issueRef || "",
    title,
    headRef: args.headRef,
  });
  const route = inferRoute({
    route: args.route || defaultHint.route || "",
    title,
    body,
    headRef: args.headRef,
  });
  const classification = classifyIssue({
    title,
    body,
    route,
    headRef: args.headRef,
  });
  const decision = decideStrategy({
    issueRef: args.issueRef,
    title,
    body,
    route,
    headRef: args.headRef,
    issueClass: classification.issueClass,
  });

  const summary = {
    issue_ref: args.issueRef || "",
    title: title || "",
    route: decision.route || route,
    head_ref: args.headRef || "",
    primary_issue_class: classification.issueClass,
    evidence_strategy: EVIDENCE_BY_CLASS[classification.issueClass] || [],
    reasons: [...classification.reasons, ...decision.reasons],
    fetch_warning: fetchResult.warning,
    decision: {
      kind: decision.kind,
      qa_recipe: decision.qaRecipe,
      template: decision.template,
      route: decision.route,
      command: decision.command,
      followup: decision.followup,
      suggested_recipe_slug:
        decision.kind === "scaffold-recipe" && args.issueRef
          ? slugify(`${args.issueRef}-${decision.template}-${decision.route || classification.issueClass}`)
          : "",
    },
    notes: [
      "Heuristic suggestion only. Let validate-issue override this if the live repro disagrees.",
    ],
  };

  process.stdout.write(args.json ? `${toJsonSummary(summary)}\n` : toTextSummary(summary));
}

main();
