import { defaultPublishRequest, inferIssueRef } from "./qa_publish_defaults.mjs";
import { parseQaPublishRequest } from "./qa_publish_request.mjs";
import { normalizePrValidatorRequest, parsePrValidatorRequest } from "./pr_validator_request.mjs";
import { githubRequest, runGhWorkflow } from "./playtest-orchestrator.mjs";

export const PR_VALIDATOR_SUMMARY_MARKER = "<!-- pr-validator-summary -->";
export const PR_VALIDATOR_RETRY_MARKER = "<!-- pr-validator-retry -->";

function trimText(value, maxLength = 1000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function isBotLogin(login) {
  const value = trimText(login, 200).toLowerCase();
  return value.includes("[bot]") || value === "github-actions" || value === "github-actions[bot]";
}

function latestCheckRun(checkRuns, name) {
  return (checkRuns || [])
    .filter((check) => {
      const checkName = trimText(check?.name, 120);
      const appName = trimText(check?.app?.name, 200);
      const detailsUrl = trimText(check?.html_url || check?.details_url, 1000);
      return (
        checkName === name
        && (!appName || appName === "GitHub Actions")
        && (!detailsUrl || detailsUrl.includes("/actions/"))
      );
    })
    .sort((left, right) => {
      const leftTime = Date.parse(left?.completed_at || left?.started_at || 0);
      const rightTime = Date.parse(right?.completed_at || right?.started_at || 0);
      return rightTime - leftTime;
    })[0] || null;
}

function isHumanComment(comment) {
  const login = trimText(comment?.user?.login || comment?.author?.login, 200);
  return Boolean(login) && !isBotLogin(login);
}

export function isAgentCreatedPr(pr) {
  const headRef = trimText(pr?.head?.ref, 200);
  const title = trimText(pr?.title, 200).toLowerCase();
  const login = trimText(pr?.user?.login, 200);

  return (
    headRef.startsWith("codex/")
    || headRef.startsWith("autofix/")
    || title.startsWith("[codex]")
    || title.startsWith("fix(autofix)")
    || isBotLogin(login)
  );
}

export function resolvePrValidatorContext({ pr, repo }) {
  const qaPublishRequest = parseQaPublishRequest(pr?.body || "");
  const inferredIssueRef =
    qaPublishRequest.issue_ref ||
    inferIssueRef({
      repo,
      title: pr?.title || "",
      body: pr?.body || "",
      headRef: pr?.head?.ref || "",
    });
  const qaDefaults = defaultPublishRequest({
    issueRef: inferredIssueRef,
    title: pr?.title || "",
    headRef: pr?.head?.ref || "",
  });
  const validatorRequest = normalizePrValidatorRequest(parsePrValidatorRequest(pr?.body || ""));

  return {
    inferredIssueRef,
    isAgentPr: isAgentCreatedPr(pr),
    issueRef: qaPublishRequest.issue_ref || inferredIssueRef,
    qaPublishRequest: {
      issue_ref: qaPublishRequest.issue_ref || inferredIssueRef,
      qa_recipe: qaPublishRequest.qa_recipe || qaDefaults.qa_recipe || "",
      route: qaPublishRequest.route || qaDefaults.route || "",
      run_dir: qaPublishRequest.run_dir || "",
      scenario_seed: qaPublishRequest.scenario_seed || qaDefaults.scenario_seed || "",
      checkpoint_id: qaPublishRequest.checkpoint_id || "",
      no_auto_evidence_upload: qaPublishRequest.no_auto_evidence_upload === true,
    },
    validatorRequest,
  };
}

export async function fetchPrValidatorContext({ repo, prNumber, token, fetchImpl = fetch }) {
  const pr = await githubRequest({
    token,
    url: `https://api.github.com/repos/${repo}/pulls/${prNumber}`,
    fetchImpl,
  });
  const issueComments = await githubRequest({
    token,
    url: `https://api.github.com/repos/${repo}/issues/${prNumber}/comments?per_page=100`,
    fetchImpl,
  });
  const reviewComments = await githubRequest({
    token,
    url: `https://api.github.com/repos/${repo}/pulls/${prNumber}/comments?per_page=100`,
    fetchImpl,
  });
  const reviews = await githubRequest({
    token,
    url: `https://api.github.com/repos/${repo}/pulls/${prNumber}/reviews?per_page=100`,
    fetchImpl,
  });
  const checks = await githubRequest({
    token,
    url: `https://api.github.com/repos/${repo}/commits/${pr.head.sha}/check-runs`,
    fetchImpl,
  });

  return {
    checkRuns: Array.isArray(checks?.check_runs) ? checks.check_runs : [],
    issueComments: Array.isArray(issueComments) ? issueComments : [],
    pr,
    reviewComments: Array.isArray(reviewComments) ? reviewComments : [],
    reviews: Array.isArray(reviews) ? reviews : [],
  };
}

export function countRetryAttempts(issueComments = []) {
  return issueComments.filter((comment) => String(comment.body || "").includes(PR_VALIDATOR_RETRY_MARKER)).length;
}

export function collectActionableFeedback({ issueComments = [], reviewComments = [], reviews = [] }) {
  const feedback = [];
  const seen = new Set();

  for (const review of reviews) {
    const body = trimText(review?.body, 2000);
    const state = trimText(review?.state, 80).toUpperCase();
    if (!body || !isHumanComment(review) || !["CHANGES_REQUESTED", "COMMENTED"].includes(state)) {
      continue;
    }
    const entry = `review (${state.toLowerCase()}): ${body}`;
    if (!seen.has(entry)) {
      seen.add(entry);
      feedback.push(entry);
    }
  }

  for (const comment of reviewComments) {
    const body = trimText(comment?.body, 2000);
    if (!body || !isHumanComment(comment)) {
      continue;
    }
    const location = [trimText(comment?.path, 300), comment?.line ?? comment?.original_line]
      .filter(Boolean)
      .join(":");
    const entry = location ? `${location}: ${body}` : body;
    if (!seen.has(entry)) {
      seen.add(entry);
      feedback.push(entry);
    }
  }

  for (const comment of issueComments) {
    const body = trimText(comment?.body, 2000);
    if (
      !body
      || !isHumanComment(comment)
      || body.startsWith("/")
      || body.includes(PR_VALIDATOR_SUMMARY_MARKER)
      || body.includes(PR_VALIDATOR_RETRY_MARKER)
      || body.includes("Added uploaded verification evidence")
    ) {
      continue;
    }
    if (!seen.has(body)) {
      seen.add(body);
      feedback.push(body);
    }
  }

  return feedback.slice(0, 10);
}

function findEvidenceCommentLinks({ issueComments = [], repo, prNumber }) {
  return issueComments
    .filter((comment) => String(comment.body || "").includes("Added uploaded verification evidence"))
    .map((comment) => ({
      body: trimText(comment.body, 500),
      url: comment.html_url || `https://github.com/${repo}/pull/${prNumber}#issuecomment-${comment.id}`,
    }));
}

export function evaluatePrValidatorState({
  checkRuns = [],
  context,
  issueComments = [],
  pr,
  reviewComments = [],
  reviews = [],
}) {
  const resolveCheck = latestCheckRun(checkRuns, "resolve");
  const publishCheck = latestCheckRun(checkRuns, "publish");
  const evidenceLinks = findEvidenceCommentLinks({
    issueComments,
    repo: pr.base.repo.full_name,
    prNumber: pr.number,
  });
  const retryAttempts = countRetryAttempts(issueComments);
  const actionableFeedback = collectActionableFeedback({ issueComments, reviewComments, reviews });
  const unresolvedRisks = [];
  let verdict = "human_review_required";
  let confidence = 0.58;

  if (!context.isAgentPr) {
    verdict = "not_applicable";
    confidence = 0.4;
    unresolvedRisks.push("PR is not detected as agent-created, so validator automation is informational only.");
  } else if (!resolveCheck && !publishCheck) {
    verdict = "in_progress";
    confidence = 0.46;
    unresolvedRisks.push("Trusted QA Publish has not reported yet for this PR head SHA.");
  } else if (
    (resolveCheck && resolveCheck.status !== "completed" && resolveCheck.status !== "COMPLETED")
    || (publishCheck && publishCheck.status !== "completed" && publishCheck.status !== "COMPLETED")
  ) {
    verdict = "in_progress";
    confidence = 0.62;
    unresolvedRisks.push("Trusted QA Publish is still running.");
  } else if (publishCheck?.conclusion?.toUpperCase() === "SUCCESS") {
    verdict = "validated";
    confidence = evidenceLinks.length > 0 ? 0.9 : 0.82;
    if (evidenceLinks.length === 0) {
      unresolvedRisks.push("Trusted QA Publish succeeded, but no reviewer-visible evidence comment was found on the PR yet.");
    }
  } else if (
    publishCheck?.conclusion?.toUpperCase() === "SKIPPED"
    && resolveCheck?.conclusion?.toUpperCase() === "SUCCESS"
  ) {
    verdict = "human_review_required";
    confidence = 0.57;
    unresolvedRisks.push("Trusted QA Publish skipped because this PR does not expose CI-rerunnable QA metadata or publishable proof.");
  } else if (resolveCheck && resolveCheck.conclusion?.toUpperCase() !== "SUCCESS") {
    verdict = "blocked";
    confidence = 0.45;
    unresolvedRisks.push(`Trusted QA Publish resolve failed with \`${resolveCheck.conclusion}\`.`);
  } else if (publishCheck && !["SUCCESS", "SKIPPED"].includes((publishCheck.conclusion || "").toUpperCase())) {
    verdict = "blocked";
    confidence = 0.43;
    unresolvedRisks.push(`Trusted QA Publish publish failed with \`${publishCheck.conclusion}\`.`);
  }

  if (!context.issueRef) {
    unresolvedRisks.push("Issue context could not be resolved from the PR metadata.");
  }
  if (trimText(pr?.review_decision, 80).toUpperCase() === "CHANGES_REQUESTED") {
    unresolvedRisks.push("GitHub review decision currently requests changes.");
  }
  if (actionableFeedback.length > 0) {
    unresolvedRisks.push(`There are ${actionableFeedback.length} actionable feedback items pending review or rework.`);
  }
  if (context.validatorRequest.human_final_approval_required) {
    unresolvedRisks.push("Merge to main and production promotion still require explicit human approval.");
  }

  return {
    actionableFeedback,
    canRetry:
      context.isAgentPr
      && actionableFeedback.length > 0
      && retryAttempts < context.validatorRequest.max_retries,
    confidence,
    evidenceLinks,
    publishCheck,
    resolveCheck,
    retryAttempts,
    unresolvedRisks,
    verdict,
  };
}

export function buildRetryPrompt({ feedback = [], issueRef, pr, retryAttempts, maxRetries }) {
  const renderedFeedback = feedback.length > 0
    ? feedback.map((entry) => `- ${entry}`).join("\n")
    : "- No actionable feedback was captured.";

  return [
    `Address review feedback on existing PR #${pr.number} in ${pr.base.repo.full_name}.`,
    "",
    `Issue context: ${issueRef || "unknown"}`,
    `Branch: ${pr.head.ref}`,
    `Retry attempt: ${retryAttempts + 1} of ${maxRetries}`,
    "",
    "Work inside the existing branch and preserve the PR.",
    "Do not auto-merge. Keep human final approval as the merge and production gate.",
    "Re-run the relevant validation or verify-fix path before finishing.",
    "",
    "Actionable feedback:",
    renderedFeedback,
  ].join("\n");
}

export function renderPrValidatorSummary({
  context,
  evaluation,
  pr,
}) {
  const resolveStatus = evaluation.resolveCheck
    ? `[${evaluation.resolveCheck.name}](${evaluation.resolveCheck.html_url || evaluation.resolveCheck.details_url}) \`${evaluation.resolveCheck.conclusion || evaluation.resolveCheck.status}\``
    : "`missing`";
  const publishStatus = evaluation.publishCheck
    ? `[${evaluation.publishCheck.name}](${evaluation.publishCheck.html_url || evaluation.publishCheck.details_url}) \`${evaluation.publishCheck.conclusion || evaluation.publishCheck.status}\``
    : "`missing`";
  const proofLines = evaluation.evidenceLinks.length > 0
    ? evaluation.evidenceLinks.map((link) => `- [QA publish evidence](${link.url})`)
    : ["- No reviewer-visible QA publish comment found yet."];

  return [
    PR_VALIDATOR_SUMMARY_MARKER,
    "",
    "## PR Validator Summary",
    "",
    `- PR: #${pr.number}`,
    `- Issue: \`${context.issueRef || "unknown"}\``,
    `- Verdict: \`${evaluation.verdict}\``,
    `- Confidence: \`${evaluation.confidence.toFixed(2)}\``,
    `- Retry usage: \`${evaluation.retryAttempts}/${context.validatorRequest.max_retries}\``,
    `- Retry available: \`${evaluation.canRetry}\``,
    "",
    "### QA Publish",
    `- Resolve: ${resolveStatus}`,
    `- Publish: ${publishStatus}`,
    "",
    "### Proof Links",
    ...proofLines,
    "",
    "### Unresolved Risks",
    ...(evaluation.unresolvedRisks.length > 0
      ? evaluation.unresolvedRisks.map((risk) => `- ${risk}`)
      : ["- None."]),
    "",
    "### Retry Policy",
    `- Max automated rework cycles: \`${context.validatorRequest.max_retries}\``,
    "- Use `/pr-validator retry` on the PR only after actionable feedback exists.",
    "- Once the retry cap is reached, route follow-up work to a human instead of looping indefinitely.",
    "",
    "### Final Approval",
    `- Human final approval required: \`${context.validatorRequest.human_final_approval_required}\``,
    "- Validator success never auto-merges the PR and never approves production promotion on its own.",
  ].join("\n");
}

export async function upsertPrValidatorSummaryComment({
  body,
  prNumber,
  repo,
  token,
  fetchImpl = fetch,
}) {
  const comments = await githubRequest({
    token,
    url: `https://api.github.com/repos/${repo}/issues/${prNumber}/comments?per_page=100`,
    fetchImpl,
  });
  const existing = (comments || []).find((comment) => String(comment.body || "").includes(PR_VALIDATOR_SUMMARY_MARKER));

  if (existing?.id) {
    return githubRequest({
      token,
      method: "PATCH",
      url: `https://api.github.com/repos/${repo}/issues/comments/${existing.id}`,
      body: { body },
      fetchImpl,
    });
  }

  return githubRequest({
    token,
    method: "POST",
    url: `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`,
    body: { body },
    fetchImpl,
  });
}

export async function postRetryDispatchComment({
  prNumber,
  repo,
  retryAttempt,
  token,
  maxRetries,
  fetchImpl = fetch,
}) {
  const body = [
    PR_VALIDATOR_RETRY_MARKER,
    "",
    `Validator retry dispatched for PR #${prNumber}.`,
    `- Retry attempt: \`${retryAttempt}/${maxRetries}\``,
    "- The existing PR branch was handed back to the Codex Headless PR workflow.",
  ].join("\n");

  return githubRequest({
    token,
    method: "POST",
    url: `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`,
    body: { body },
    fetchImpl,
  });
}

export function dispatchPrRetry({
  context,
  env = process.env,
  evaluation,
  issueRef,
  pr,
}) {
  const prompt = buildRetryPrompt({
    feedback: evaluation.actionableFeedback,
    issueRef,
    maxRetries: context.validatorRequest.max_retries,
    pr,
    retryAttempts: evaluation.retryAttempts,
  });

  return runGhWorkflow({
    args: [
      "workflow",
      "run",
      "codex-headless-pr.yml",
      "--repo",
      pr.base.repo.full_name,
      "-f",
      `prompt=${prompt}`,
      "-f",
      `base_branch=${pr.base.ref}`,
      "-f",
      `branch=${pr.head.ref}`,
      "-f",
      `pr_title=${pr.title}`,
      "-f",
      `pr_body=${pr.body || ""}`,
      "-f",
      `issue_ref=${issueRef || ""}`,
      "-f",
      `route=${context.qaPublishRequest.route || ""}`,
      "-f",
      `scenario_seed=${context.qaPublishRequest.scenario_seed || ""}`,
      "-f",
      `checkpoint_id=${context.qaPublishRequest.checkpoint_id || ""}`,
      "-f",
      `qa_recipe=${context.qaPublishRequest.qa_recipe || ""}`,
      "-f",
      "auto_qa_publish=true",
    ],
    env,
  });
}
