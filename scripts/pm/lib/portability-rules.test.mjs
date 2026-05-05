import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  evaluateBody,
  renderGapComment,
  validateReferences,
} from "./portability-rules.mjs";

let repoRoot;

function writeFile(relativePath, contents = "") {
  const fullPath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, contents, "utf8");
}

function completeIssue(extra = "") {
  return [
    "## Real route or surface",
    "/game",
    "",
    "## Actual behavior",
    "Current behavior.",
    "",
    "## Expected behavior",
    "Expected behavior.",
    "",
    "## Visible proof sequence",
    "1. Open the route.",
    "",
    "## Remote dependencies",
    "repo-only",
    "",
    "## Reviewer proof required",
    "Screenshot",
    "",
    extra,
  ].join("\n");
}

beforeEach(() => {
  repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tong-portability-"));
  writeFile("package.json", JSON.stringify({ scripts: { "demo:smoke": "node smoke.mjs" } }));
  writeFile("apps/client/package.json", JSON.stringify({ scripts: { "cf:deploy": "wrangler deploy" } }));
  writeFile("apps/server/src/signals.mjs", "export {};\n");
  writeFile("docs/pm-orchestrator.md", "# PM\n");
});

afterEach(() => {
  fs.rmSync(repoRoot, { recursive: true, force: true });
});

describe("portability reference validation", () => {
  it("keeps complete issues agent-ready when referenced paths and npm scripts exist", () => {
    const body = completeIssue([
      "Use `apps/server/src/signals.mjs`.",
      "Also read `apps/server/src/`.",
      "Run `npm --prefix apps/client run cf:deploy`.",
      "See `docs/pm-orchestrator.md > Next steps`.",
    ].join("\n"));

    const evaluation = evaluateBody(body, { repoRoot });

    assert.equal(evaluation.isComplete, true);
    assert.equal(evaluation.missingReferences.length, 0);
  });

  it("marks missing referenced repo paths and scripts as portability gaps", () => {
    const body = completeIssue([
      "Use `apps/server/src/signals/`.",
      "Run `npm run cf:build`.",
    ].join("\n"));

    const evaluation = evaluateBody(body, { repoRoot });
    const comment = renderGapComment(evaluation, { issueRef: "erniesg/tong#999" });

    assert.equal(evaluation.isComplete, false);
    assert.deepEqual(
      evaluation.missingReferences.map((ref) => `${ref.type}:${ref.target}`),
      ["path:apps/server/src/signals/", "npm_script:cf:build"],
    );
    assert.match(comment, /Missing referenced paths or scripts/);
    assert.match(comment, /apps\/server\/src\/signals\//);
    assert.match(comment, /cf:build/);
  });

  it("does not block files explicitly declared as new work products", () => {
    const body = completeIssue([
      "Files to add:",
      "- `.github/workflows/typecheck.yml`",
      "- `scripts/persona-review/dispatch-personas.mjs`",
      "",
      "Visible proof opens `.github/workflows/typecheck.yml` after the PR lands.",
    ].join("\n"));

    const evaluation = evaluateBody(body, { repoRoot });

    assert.equal(evaluation.isComplete, true);
    assert.equal(evaluation.missingReferences.length, 0);
    assert.deepEqual(
      evaluation.declaredNewReferences.map((ref) => ref.target),
      [".github/workflows/typecheck.yml", "scripts/persona-review/dispatch-personas.mjs"],
    );
  });

  it("treats multi-line files-to-add blocks as new references", () => {
    const body = completeIssue([
      "Files to add:",
      "- `docs/surfaces/game.md`",
      "- `docs/surfaces/overlay.md`",
      "- `docs/surfaces/insights.md`",
    ].join("\n"));

    const evaluation = evaluateBody(body, { repoRoot });

    assert.equal(evaluation.isComplete, true);
    assert.equal(evaluation.missingReferences.length, 0);
    assert.deepEqual(
      evaluation.declaredNewReferences.map((ref) => ref.target),
      ["docs/surfaces/game.md", "docs/surfaces/overlay.md", "docs/surfaces/insights.md"],
    );
  });

  it("ignores repo-like paths inside fenced code blocks", () => {
    const body = completeIssue([
      "Example only:",
      "```markdown",
      "Use `apps/server/src/not-real.mjs`.",
      "```",
    ].join("\n"));

    const result = validateReferences(body, { repoRoot });

    assert.equal(result.missing.length, 0);
  });

  it("ignores generic placeholder path references", () => {
    const body = completeIssue("Each `docs/surfaces/<id>.md` contains the same sections.");

    const result = validateReferences(body, { repoRoot });

    assert.equal(result.missing.length, 0);
  });

  it("does not treat labels as npm script references", () => {
    const body = completeIssue([
      "Apply `pm:agent-ready` only after review.",
      "A `self-heal:attempt-1` label may appear after feedback.",
    ].join("\n"));

    const result = validateReferences(body, { repoRoot });

    assert.equal(result.missing.length, 0);
  });
});
