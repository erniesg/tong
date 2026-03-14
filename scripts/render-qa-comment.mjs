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

function renderInlinePreview(manifest, cacheBustToken) {
  const previewArtifact = manifest.primary?.gif_preview || manifest.primary?.poster || manifest.primary?.dialogue_screenshot;
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

function renderComment(manifest) {
  const cacheBustToken = buildCacheBustToken(manifest);
  const issueRef = manifest.issue?.issue_ref || manifest.run.issue_ref;
  const proofVideo = manifest.primary?.proof_video;
  const dialogue = manifest.primary?.dialogue_screenshot;
  const tooltip = manifest.primary?.tooltip_screenshot;
  const trace = manifest.primary?.romanization_trace;
  const summaryArtifact = manifest.primary?.summary;
  const preview = renderInlinePreview(manifest, cacheBustToken);
  const summarySentence = renderSummarySentence(manifest);
  const validationSentence = renderValidationSentence(manifest);

  const lines = [];
  lines.push(`Added uploaded verification evidence for \`${issueRef}\`.`);

  if (summarySentence) {
    lines.push("");
    lines.push(summarySentence);
  }

  if (preview) {
    lines.push("");
    lines.push(preview);
  }

  lines.push("");
  const bullets = [
    renderBullet("GIF preview", manifest.primary?.gif_preview, cacheBustToken),
    renderBullet("Screen recording with audio", proofVideo, cacheBustToken),
    renderBullet("Tooltip screenshot", tooltip, cacheBustToken),
    renderBullet("Dialogue screenshot", dialogue, cacheBustToken),
    renderBullet("Romanization-bait trace", trace, cacheBustToken),
    renderBullet("QA summary", summaryArtifact, cacheBustToken),
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
    path.join(path.resolve(repoRoot, manifest.run.run_dir), DEFAULT_OUTPUT_NAME);

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
