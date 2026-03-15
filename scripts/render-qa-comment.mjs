#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { readJson, relativeToRepo, resolveRepoRoot } from "./lib/qa_evidence.mjs";

const DEFAULT_MANIFEST_NAME = "upload-manifest.json";
const DEFAULT_OUTPUT_NAME = "uploaded-comment.md";

function parseArgs(argv) {
  const args = {
    manifestName: DEFAULT_MANIFEST_NAME,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--run-dir") {
      args.runDir = argv[++i];
    } else if (arg === "--manifest") {
      args.manifestPath = argv[++i];
    } else if (arg === "--manifest-name") {
      args.manifestName = argv[++i];
    } else if (arg === "--out") {
      args.outputPath = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.manifestPath && !args.runDir) {
    throw new Error("Provide either --manifest <path> or --run-dir <dir>.");
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/render-qa-comment.mjs (--manifest <file> | --run-dir <dir>) [options]

Options:
  --manifest-name <name>    Manifest filename when using --run-dir (default: ${DEFAULT_MANIFEST_NAME})
  --out <path>              Write the rendered comment to a file instead of stdout
`);
}

function resolveManifestPath(args, repoRoot) {
  if (args.manifestPath) {
    return path.resolve(args.manifestPath);
  }
  return path.join(path.resolve(args.runDir), args.manifestName);
}

function relPathFromUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.pathname.split("/").pop();
  } catch {
    return url;
  }
}

function buildCacheBustToken(manifest) {
  const raw = manifest.generated_at || "";
  return raw.replace(/[^0-9A-Za-z]+/g, "");
}

function withCacheBust(url, token) {
  if (!url || !token) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("v", token);
    return parsed.toString();
  } catch {
    return url;
  }
}

function renderBullet(label, artifact, cacheBustToken) {
  if (!artifact?.url) return null;
  const text = relPathFromUrl(artifact.url);
  return `- ${label}: [${text}](${withCacheBust(artifact.url, cacheBustToken)})`;
}

function sameArtifact(left, right) {
  if (!left || !right) return false;
  if (left.id && right.id) return left.id === right.id;
  return left.url && right.url ? left.url === right.url : false;
}

function renderInlinePreview(manifest, cacheBustToken) {
  const previewArtifact =
    manifest.primary?.comparison_panel ||
    manifest.primary?.comparison_focus_crop ||
    manifest.primary?.gif_preview ||
    manifest.primary?.poster ||
    manifest.primary?.dialogue_screenshot;

  if (!previewArtifact?.url) return null;

  const alt = manifest.issue?.issue_ref
    ? `${manifest.issue.issue_ref} uploaded evidence preview`
    : `${manifest.run.issue_ref} uploaded evidence preview`;
  return `![${alt}](${withCacheBust(previewArtifact.url, cacheBustToken)})`;
}

function renderSummarySentence(manifest) {
  const summaryText = manifest.summary?.text?.trim();
  if (!summaryText) return null;
  return summaryText;
}

function renderNotes(manifest) {
  const notes = manifest.summary?.notes || [];
  if (notes.length === 0) return [];
  return notes.slice(0, 2).map((note) => `- Note: ${note}`);
}

function renderValidationSentence(manifest) {
  const validation = manifest.summary?.validation || {};
  const modes = Array.isArray(validation.runtime_modes_exercised) ? validation.runtime_modes_exercised : [];
  const modeText = modes.length > 0 ? ` Runtime modes exercised: ${modes.join(", ")}.` : "";
  const liveModel = validation.live_model_confirmed ? " Live-model output was confirmed." : "";
  return `${modeText}${liveModel}`.trim() || null;
}

function renderComparisonContext(manifest) {
  const previousRun = manifest.comparison?.previous_run;
  if (!previousRun?.run_id) return null;
  return `Before/after comparison uses baseline run \`${previousRun.run_id}\`.`;
}

function renderComparisonGap(manifest) {
  if (!manifest.comparison?.expected || manifest.comparison?.generated) {
    return null;
  }

  const reason = manifest.comparison?.missing_reason
    || "Add manual `comparison_panels` and `comparison_focus_crops` entries to evidence.json before publishing reviewer-facing evidence.";
  return `Comparison assets are still missing for this reviewer-visible QA run. ${reason}`;
}

function renderReviewerProofStatus(manifest) {
  const reviewerProof = manifest.reviewer_proof;
  if (!reviewerProof) return [];

  const lines = [];
  const status = reviewerProof.status || reviewerProof.classification || "missing";
  const route = reviewerProof.route ? ` Route: \`${reviewerProof.route}\`.` : "";
  const scenarioSeed = reviewerProof.scenario_seed ? ` Scenario seed: \`${reviewerProof.scenario_seed}\`.` : "";
  lines.push(`Reviewer-proof pack: \`${status}\`.${route}${scenarioSeed}`);

  const deterministicSetup = reviewerProof.deterministic_setup;
  if (deterministicSetup?.used) {
    lines.push(`Deterministic setup note: ${deterministicSetup.description || "Used only to reach the near-proof state."}`);
  }

  const cues = reviewerProof.cue_timestamps_ms || {};
  const cueFragments = [
    ["Ready", cues.ready_state],
    ["Input", cues.input],
    ["Immediate post-input", cues.immediate_post_input],
    ["Later transition", cues.later_transition],
    ["Stable post-action", cues.stable_post_action],
  ]
    .filter(([, value]) => typeof value === "number")
    .map(([label, value]) => `${label} +${Math.trunc(value)}ms`);

  if (cueFragments.length > 0) {
    lines.push(`Cue timestamps: ${cueFragments.join(", ")}.`);
  }

  if (Array.isArray(reviewerProof.missing_requirements) && reviewerProof.missing_requirements.length > 0) {
    lines.push(`Reviewer-proof gaps: ${reviewerProof.missing_requirements.join("; ")}`);
  }

  return lines;
}

function renderReviewerProofBullets(manifest, cacheBustToken) {
  const reviewerProof = manifest.reviewer_proof;
  if (!reviewerProof?.ordered_frames) return [];

  const orderedStages = [
    ["Pre-action frame", reviewerProof.ordered_frames.pre_action],
    ["Ready-state frame", reviewerProof.ordered_frames.ready_state],
    ["Immediate post-input frame", reviewerProof.ordered_frames.immediate_post_input],
    ["Later transition frame", reviewerProof.ordered_frames.later_transition],
    ["Stable post-action frame", reviewerProof.ordered_frames.stable_post_action],
  ];

  return orderedStages
    .map(([label, artifact]) => renderBullet(label, artifact, cacheBustToken))
    .filter(Boolean);
}

function renderComment(manifest) {
  const cacheBustToken = buildCacheBustToken(manifest);
  const issueRef = manifest.issue?.issue_ref || manifest.run.issue_ref;
  const tooltipArtifact = manifest.primary?.tooltip_screenshot;
  const dialogueArtifact = sameArtifact(manifest.primary?.dialogue_screenshot, tooltipArtifact)
    ? null
    : manifest.primary?.dialogue_screenshot;
  const preview = renderInlinePreview(manifest, cacheBustToken);
  const summarySentence = renderSummarySentence(manifest);
  const comparisonContext = renderComparisonContext(manifest);
  const comparisonGap = renderComparisonGap(manifest);
  const reviewerProofStatusLines = renderReviewerProofStatus(manifest);
  const reviewerProofBullets = renderReviewerProofBullets(manifest, cacheBustToken);
  const validationSentence = renderValidationSentence(manifest);

  const lines = [];
  lines.push(`Added uploaded verification evidence for \`${issueRef}\`.`);

  if (summarySentence) {
    lines.push("");
    lines.push(summarySentence);
  }

  if (comparisonContext) {
    lines.push("");
    lines.push(comparisonContext);
  }

  if (preview) {
    lines.push("");
    lines.push(preview);
  }

  if (comparisonGap) {
    lines.push("");
    lines.push(comparisonGap);
  }

  if (reviewerProofStatusLines.length > 0) {
    lines.push("");
    lines.push(...reviewerProofStatusLines);
  }

  lines.push("");
  const bullets = [
    renderBullet("Before/after comparison panel", manifest.primary?.comparison_panel, cacheBustToken),
    renderBullet("Focused comparison crop", manifest.primary?.comparison_focus_crop, cacheBustToken),
    renderBullet("GIF preview", manifest.primary?.gif_preview, cacheBustToken),
    renderBullet("Screen recording with audio", manifest.primary?.proof_video, cacheBustToken),
    ...reviewerProofBullets,
    renderBullet("Tooltip screenshot", tooltipArtifact, cacheBustToken),
    renderBullet("Dialogue screenshot", dialogueArtifact, cacheBustToken),
    renderBullet("Romanization-bait trace", manifest.primary?.romanization_trace, cacheBustToken),
    renderBullet("QA summary", manifest.primary?.summary, cacheBustToken),
    manifest.manifest_url ? `- Uploaded manifest: [manifest.json](${withCacheBust(manifest.manifest_url, cacheBustToken)})` : null,
  ].filter(Boolean);
  lines.push(...bullets);

  if (validationSentence) {
    lines.push("");
    lines.push(validationSentence);
  }

  const notes = renderNotes(manifest);
  if (notes.length > 0) {
    lines.push("");
    lines.push(...notes);
  }

  return lines.join("\n") + "\n";
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolveRepoRoot();
  const manifestPath = resolveManifestPath(args, repoRoot);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }

  const manifest = readJson(manifestPath);
  if (!manifest.run?.run_dir) {
    throw new Error(`Manifest is missing run.run_dir: ${manifestPath}`);
  }

  const comment = renderComment(manifest);
  const outputPath =
    (args.outputPath ? path.resolve(args.outputPath) : null) ||
    path.join(path.dirname(manifestPath), DEFAULT_OUTPUT_NAME);

  fs.writeFileSync(outputPath, comment, "utf8");

  console.error(`Comment written: ${relativeToRepo(repoRoot, outputPath)}`);
  process.stdout.write(comment);
}

try {
  main();
} catch (error) {
  console.error(String(error.message || error));
  process.exit(1);
}
