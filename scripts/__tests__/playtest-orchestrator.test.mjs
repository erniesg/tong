import assert from "node:assert/strict";
import test from "node:test";

import {
  branchNameForFinding,
  buildFindingMarker,
  chooseRouteDecision,
  findIssueMatch,
  inferLane,
  isProtectedPath,
} from "../lib/playtest-orchestrator.mjs";

function makeFinding(overrides = {}) {
  return {
    artifactLinks: [{ href: "https://runs.tong.berlayar.ai/playtest/demo/analysis.json", label: "analysis" }],
    category: "bug",
    description: "Continue button is hard to discover.",
    findingId: "finding_abc123456789",
    inferredComponent: "apps/client/components/scene/ContinueButton.tsx",
    sessionId: "demo-session",
    severity: "high",
    summary: "Continue button is hard to discover",
    ...overrides,
  };
}

test("detects protected paths and lane ownership", () => {
  assert.equal(isProtectedPath(".github/workflows/playtest-orchestrator.yml"), true);
  assert.equal(isProtectedPath("apps/client/components/scene/ContinueButton.tsx"), false);
  assert.equal(inferLane("apps/worker/src/index.ts"), "server-api");
  assert.equal(inferLane(".github/workflows/playtest-orchestrator.yml"), "infra-deploy");
});

test("matches an existing issue by finding marker", () => {
  const finding = makeFinding();
  const marker = buildFindingMarker(finding.findingId);
  const match = findIssueMatch(finding, [
    { body: `${marker}\nExisting issue body`, number: 88, title: "Existing finding tracker" },
  ]);

  assert.ok(match);
  assert.equal(match.issue.number, 88);
  assert.equal(match.reason, "exact_finding_marker");
});

test("routes protected or ambiguous scope to human review", () => {
  const protectedDecision = chooseRouteDecision({
    finding: makeFinding({ inferredComponent: ".github/workflows/playtest-orchestrator.yml" }),
  });
  assert.equal(protectedDecision.status, "human_review");
  assert.equal(protectedDecision.reason, "protected_path_scope");

  const ambiguousDecision = chooseRouteDecision({
    finding: makeFinding({ category: "ui_layout" }),
  });
  assert.equal(ambiguousDecision.status, "human_review");
  assert.equal(ambiguousDecision.reason, "design_or_product_ambiguity");
});

test("routes single-lane non-protected high-signal findings to direct_pr", () => {
  const decision = chooseRouteDecision({
    finding: makeFinding(),
    issues: [],
  });

  assert.equal(decision.status, "direct_pr");
  assert.equal(decision.scope.lane, "client-runtime");
  assert.match(branchNameForFinding(makeFinding()), /^codex\/playtest-/);
});

test("falls back to new_issue or skip for lower-signal findings", () => {
  const newIssueDecision = chooseRouteDecision({
    finding: makeFinding({ inferredComponent: "", severity: "medium" }),
    issues: [],
  });
  assert.equal(newIssueDecision.status, "new_issue");

  const skipDecision = chooseRouteDecision({
    finding: makeFinding({ artifactLinks: [], inferredComponent: "", severity: "info" }),
    issues: [],
  });
  assert.equal(skipDecision.status, "human_review");
  assert.equal(skipDecision.reason, "missing_remote_evidence");
});

test("honors active manual overrides before applying heuristic routing", () => {
  const decision = chooseRouteDecision({
    finding: makeFinding({
      manualOverride: {
        active: true,
        status: "human_review",
        reason: "hold_requested",
        confidence: 0.99,
      },
    }),
    issues: [],
  });

  assert.equal(decision.status, "human_review");
  assert.equal(decision.reason, "manual_override:hold_requested");
  assert.equal(decision.confidence, 0.99);
});
