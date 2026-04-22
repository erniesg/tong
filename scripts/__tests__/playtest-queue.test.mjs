import assert from "node:assert/strict";
import test from "node:test";

import {
  applyQueueAction,
  buildManualTaskPrompt,
  parsePlaytestQueueCommand,
  queueBucketForFinding,
  renderQueueDigest,
  summarizeQueue,
} from "../lib/playtest-queue.mjs";

function makeFinding(overrides = {}) {
  return {
    artifactLinks: [{ href: "https://runs.tong.berlayar.ai/playtest/demo/recording.webm", label: "recording" }],
    findingId: "finding_queue123",
    inferredComponent: "apps/client/components/scene/ContinueButton.tsx",
    linkedRefs: { issueRefs: [], prRefs: [] },
    manualOverride: null,
    routeState: { status: "unrouted", reason: null, confidence: null },
    severity: "high",
    summary: "Continue CTA is hard to see",
    ...overrides,
  };
}

test("parsePlaytestQueueCommand reads action and flags", () => {
  const parsed = parsePlaytestQueueCommand(
    `/playtest-queue hold --finding-id finding_123 --note "Need a human" --queue-issue 242 --limit 15 --dry-run`,
  );

  assert.equal(parsed.requested, true);
  assert.equal(parsed.action, "hold");
  assert.equal(parsed.findingId, "finding_123");
  assert.equal(parsed.note, "Need a human");
  assert.equal(parsed.queueIssueNumber, "242");
  assert.equal(parsed.limit, "15");
  assert.equal(parsed.dryRun, true);
});

test("queueBucketForFinding and summarizeQueue group routed findings", () => {
  const findings = [
    makeFinding(),
    makeFinding({ findingId: "finding_2", routeState: { status: "direct_pr", reason: "scoped", confidence: 0.9 } }),
    makeFinding({
      findingId: "finding_3",
      routeState: { status: "human_review", reason: "protected", confidence: 0.98 },
      manualOverride: { active: true, actor: "qa-reviewer", status: "human_review", reason: "protected", confidence: 0.98 },
    }),
    makeFinding({ findingId: "finding_4", routeState: { status: "done", reason: "approved", confidence: 1 } }),
  ];

  assert.equal(queueBucketForFinding(findings[0]), "pending");
  assert.equal(queueBucketForFinding(findings[1]), "in_progress");
  assert.equal(queueBucketForFinding(findings[2]), "blocked");
  assert.equal(queueBucketForFinding(findings[3]), "completed");
  assert.deepEqual(summarizeQueue(findings), {
    blocked: 1,
    completed: 1,
    in_progress: 1,
    pending: 1,
  });
});

test("renderQueueDigest includes trusted commands and reusable prompts", () => {
  const digest = renderQueueDigest({
    findings: [
      makeFinding({
        linkedRefs: { issueRefs: ["erniesg/tong#242"], prRefs: [] },
        routeState: { status: "new_issue", reason: "needs_tracked_follow_up", confidence: 0.79 },
      }),
    ],
    queueIssueNumber: "242",
    repository: "erniesg/tong",
  });

  assert.match(digest, /Playtest Queue Digest/);
  assert.match(digest, /\/playtest-queue hold --finding-id <id>/);
  assert.match(digest, /Manual Codex\/Claude prompt/);
  assert.match(digest, /erniesg\/tong#242/);
  assert.match(buildManualTaskPrompt({ finding: makeFinding(), repository: "erniesg/tong" }), /Work playtest finding/);
});

test("applyQueueAction sends the expected worker mutations", async () => {
  const requests = [];
  const fetchImpl = async (url, init = {}) => {
    requests.push({
      body: init.body ? JSON.parse(init.body) : null,
      method: init.method || "GET",
      url,
    });
    return {
      ok: true,
      status: 200,
      async json() {
        return { ok: true, finding: { findingId: "finding_queue123" } };
      },
      async text() {
        return "";
      },
    };
  };

  await applyQueueAction({
    action: "hold",
    apiBase: "http://localhost:8788",
    fetchImpl,
    findingId: "finding_queue123",
    note: "Need a human",
  });
  await applyQueueAction({
    action: "retry",
    apiBase: "http://localhost:8788",
    fetchImpl,
    findingId: "finding_queue123",
  });

  assert.equal(requests[0].url, "http://localhost:8788/api/v1/playtest/findings/finding_queue123/override");
  assert.equal(requests[0].method, "PUT");
  assert.equal(requests[0].body.status, "human_review");
  assert.equal(requests[0].body.reason, "hold_requested");

  assert.equal(requests[1].url, "http://localhost:8788/api/v1/playtest/findings/finding_queue123/retry");
  assert.equal(requests[1].method, "POST");
  assert.equal(requests[2].url, "http://localhost:8788/api/v1/playtest/findings/finding_queue123/override");
  assert.equal(requests[2].body.active, false);
});
