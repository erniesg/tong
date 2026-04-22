import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRetryPrompt,
  evaluatePrValidatorState,
  isAgentCreatedPr,
  resolvePrValidatorContext,
} from "../lib/pr-validator.mjs";
import {
  parsePrValidatorRequest,
  renderPrValidatorRequestBlock,
} from "../lib/pr_validator_request.mjs";

function makePr(overrides = {}) {
  return {
    base: {
      ref: "main",
      repo: { full_name: "erniesg/tong" },
    },
    body: "Part of #243.",
    head: {
      ref: "codex/example-branch",
      sha: "deadbeef",
    },
    number: 250,
    title: "[codex] Example PR",
    user: { login: "chatgpt-codex-connector[bot]" },
    ...overrides,
  };
}

test("PR validator request block round-trips", () => {
  const body = [
    "Intro",
    "",
    renderPrValidatorRequestBlock({
      enabled: true,
      human_final_approval_required: true,
      max_retries: 3,
    }),
  ].join("\n");

  assert.deepEqual(parsePrValidatorRequest(body), {
    enabled: true,
    human_final_approval_required: true,
    max_retries: 3,
  });
});

test("detects agent-created PRs", () => {
  assert.equal(isAgentCreatedPr(makePr()), true);
  assert.equal(isAgentCreatedPr(makePr({ head: { ref: "feature/manual", sha: "abc" }, title: "Manual PR", user: { login: "erniesg" } })), false);
});

test("resolves issue and validator metadata from the PR body", () => {
  const pr = makePr({
    body: [
      "Implements #243.",
      "",
      "## QA Publish Request",
      "",
      "```json",
      JSON.stringify({ issue_ref: "erniesg/tong#243", qa_recipe: "dashboard_validator_smoke" }, null, 2),
      "```",
      "",
      renderPrValidatorRequestBlock({ enabled: true, human_final_approval_required: true, max_retries: 2 }),
    ].join("\n"),
  });

  const context = resolvePrValidatorContext({ pr, repo: "erniesg/tong" });
  assert.equal(context.issueRef, "erniesg/tong#243");
  assert.equal(context.qaPublishRequest.qa_recipe, "dashboard_validator_smoke");
  assert.equal(context.validatorRequest.max_retries, 2);
});

test("evaluates validated PRs from trusted QA publish state", () => {
  const pr = makePr();
  const context = resolvePrValidatorContext({ pr, repo: "erniesg/tong" });
  const evaluation = evaluatePrValidatorState({
    checkRuns: [
      { name: "resolve", status: "COMPLETED", conclusion: "SUCCESS", html_url: "https://github.com/erniesg/tong/actions/runs/1/job/1" },
      { name: "publish", status: "COMPLETED", conclusion: "SUCCESS", html_url: "https://github.com/erniesg/tong/actions/runs/1/job/2" },
    ],
    context,
    issueComments: [],
    linkedIssueComments: [
      { body: "# Functional QA Update\n\nEvidence ready.", html_url: "https://example.com/evidence", user: { login: "github-actions[bot]" } },
    ],
    pr,
    reviewComments: [],
    reviews: [],
  });

  assert.equal(evaluation.verdict, "validated");
  assert.equal(evaluation.canRetry, false);
  assert.equal(evaluation.evidenceLinks.length, 1);
  assert.equal(evaluation.evidenceLinks[0].source, "issue");
});

test("retry prompt includes actionable feedback and retry budget", () => {
  const prompt = buildRetryPrompt({
    feedback: ["apps/client/app/page.tsx:12: tighten the empty state copy"],
    issueRef: "erniesg/tong#243",
    maxRetries: 2,
    pr: makePr(),
    retryAttempts: 0,
  });

  assert.match(prompt, /Address review feedback on existing PR #250/);
  assert.match(prompt, /Retry attempt: 1 of 2/);
  assert.match(prompt, /tighten the empty state copy/);
});
