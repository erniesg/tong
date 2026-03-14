import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm"]);
const TEXT_EXTENSIONS = new Set([".md", ".txt", ".json", ".log"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function formatLabelFromFilename(filePath) {
  const stem = path.basename(filePath, path.extname(filePath));
  return stem
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function inferRole(filePath, category) {
  const base = path.basename(filePath).toLowerCase();

  if (base.includes("dialogue")) return "dialogue";
  if (base.includes("tooltip")) return "tooltip";
  if (base.includes("subtitle")) return "subtitle";
  if (base.includes("translation")) return "translation";
  if (base.includes("dictionary")) return "dictionary";
  if (base.includes("proof")) return "proof";
  if (base.includes("romanization-bait")) return "romanization-bait";
  if (category === "summary") return "summary";
  if (category === "manifest") return "manifest";
  if (category === "preview-gif") return "preview";
  if (category === "preview-poster") return "poster";
  if (category === "comparison-panel") return "comparison-panel";
  if (category === "comparison-focus-crop") return "comparison-focus-crop";
  return category;
}

function classifyByExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (TEXT_EXTENSIONS.has(ext)) return "text";
  return "binary";
}

function inferContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".mp4":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    case ".webm":
      return "video/webm";
    case ".md":
      return "text/markdown; charset=utf-8";
    case ".txt":
    case ".log":
      return "text/plain; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function normalizeDescription(entry) {
  return entry.description || entry.assertion || entry.label || "";
}

function normalizeEvidenceEntry(entry) {
  if (typeof entry === "string") {
    return { path: entry };
  }
  if (entry && typeof entry === "object") {
    return entry;
  }
  return null;
}

function safeRelativeRunPath(runDir, repoRoot, absolutePath) {
  const candidate = relativeToRun(runDir, absolutePath);
  if (!candidate.startsWith("../") && candidate !== "..") {
    return candidate;
  }

  return path.posix.join("_repo", relativeToRepo(repoRoot, absolutePath));
}

function resolveRepoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

function inferRepoRootFromRun(runJson, fallbackRepoRoot) {
  const manifestRepoRoot = runJson?.environment?.repo_root;
  if (typeof manifestRepoRoot === "string" && manifestRepoRoot.trim()) {
    return path.resolve(manifestRepoRoot);
  }
  return path.resolve(fallbackRepoRoot || resolveRepoRoot());
}

function relativeToRepo(repoRoot, absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

function relativeToRun(runDir, absolutePath) {
  return path.relative(runDir, absolutePath).split(path.sep).join("/");
}

function toPublicUrl(publicBaseUrl, key) {
  const normalizedBase = publicBaseUrl.replace(/\/+$/, "");
  const encodedKey = key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${normalizedBase}/${encodedKey}`;
}

function makeArtifactRecord({
  category,
  description = "",
  filePath,
  label,
  repoRoot,
  role,
  runDir,
  source,
}) {
  const absolutePath = path.resolve(repoRoot, filePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  const stats = fs.statSync(absolutePath);
  const relativeRunPath = safeRelativeRunPath(runDir, repoRoot, absolutePath);
  return {
    id: `${category}-${relativeRunPath.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    category,
    role: role || inferRole(absolutePath, category),
    label: label || formatLabelFromFilename(absolutePath),
    description,
    source,
    local_path: relativeToRepo(repoRoot, absolutePath),
    relative_run_path: relativeRunPath,
    content_type: inferContentType(absolutePath),
    media_kind: classifyByExtension(absolutePath),
    size_bytes: stats.size,
  };
}

function collectEvidenceSectionArtifacts({
  category,
  entries,
  repoRoot,
  runDir,
  source,
}) {
  const artifacts = [];
  for (const entry of entries || []) {
    const normalizedEntry = normalizeEvidenceEntry(entry);
    if (!normalizedEntry?.path) continue;
    const artifact = makeArtifactRecord({
      category,
      description: normalizeDescription(normalizedEntry),
      filePath: normalizedEntry.path,
      label: normalizedEntry.label,
      repoRoot,
      runDir,
      source,
    });
    if (artifact) artifacts.push(artifact);
  }
  return artifacts;
}

function collectRunDirArtifacts({
  category,
  dirName,
  repoRoot,
  runDir,
  role,
  source,
}) {
  const artifactDir = path.join(runDir, dirName);
  if (!fs.existsSync(artifactDir)) {
    return [];
  }

  const artifacts = [];
  for (const entry of fs.readdirSync(artifactDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const absolutePath = path.join(artifactDir, entry.name);
    const artifact = makeArtifactRecord({
      category,
      filePath: absolutePath,
      repoRoot,
      role,
      runDir,
      source,
    });
    if (artifact) artifacts.push(artifact);
  }

  return artifacts;
}

function dedupeArtifacts(artifacts) {
  const seen = new Set();
  return artifacts.filter((artifact) => {
    const key = `${artifact.category}:${artifact.local_path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectQaArtifacts(bundle, options = {}) {
  const { repoRoot, runDir, runJson, evidenceJson } = bundle;
  const { includeSupporting = false } = options;

  const artifacts = [];

  const summaryPath = runJson.artifacts?.summary_md;
  if (summaryPath) {
    const summaryArtifact = makeArtifactRecord({
      category: "summary",
      description: "Functional QA summary",
      filePath: summaryPath,
      label: "QA Summary",
      repoRoot,
      role: "summary",
      runDir,
      source: "run.json",
    });
    if (summaryArtifact) artifacts.push(summaryArtifact);
  }

  artifacts.push(
    ...collectEvidenceSectionArtifacts({
      category: "screenshots",
      entries: evidenceJson.screenshots,
      repoRoot,
      runDir,
      source: "evidence.json",
    }),
  );

  artifacts.push(
    ...collectEvidenceSectionArtifacts({
      category: "comparison-panel",
      entries: evidenceJson.comparison_panels,
      repoRoot,
      runDir,
      source: "evidence.json",
    }),
  );

  artifacts.push(
    ...collectEvidenceSectionArtifacts({
      category: "comparison-focus-crop",
      entries: evidenceJson.comparison_focus_crops,
      repoRoot,
      runDir,
      source: "evidence.json",
    }),
  );

  artifacts.push(
    ...collectEvidenceSectionArtifacts({
      category: "temporal-capture",
      entries: evidenceJson.temporal_capture,
      repoRoot,
      runDir,
      source: "evidence.json",
    }),
  );

  if (includeSupporting) {
    const supportingSections = [
      { category: "contract-assertions", entries: evidenceJson.contract_assertions },
      { category: "console-logs", entries: evidenceJson.console_logs },
      { category: "network-traces", entries: evidenceJson.network_traces },
      { category: "perf-profiles", entries: evidenceJson.perf_profiles },
      { category: "cross-env-matrix", entries: evidenceJson.cross_env_matrix },
    ];

    for (const section of supportingSections) {
      artifacts.push(
        ...collectEvidenceSectionArtifacts({
          category: section.category,
          entries: section.entries,
          repoRoot,
          runDir,
          source: "evidence.json",
        }),
      );
    }
  }

  artifacts.push(
    ...collectRunDirArtifacts({
      category: "temporal-capture",
      dirName: "video",
      repoRoot,
      role: "proof",
      runDir,
      source: "run-dir:auto",
    }),
  );

  return dedupeArtifacts(artifacts);
}

function groupArtifactsByCategory(artifacts) {
  const grouped = {};
  for (const artifact of artifacts) {
    grouped[artifact.category] ||= [];
    grouped[artifact.category].push(artifact);
  }
  return grouped;
}

function loadQaRunBundle(runDirInput, repoRootInput) {
  const runDir = path.resolve(runDirInput);
  const runJsonPath = path.join(runDir, "run.json");
  const evidenceJsonPath = path.join(runDir, "evidence.json");
  const issueJsonPath = path.join(runDir, "issue.json");

  if (!fs.existsSync(runJsonPath)) {
    throw new Error(`Missing run.json in ${runDir}`);
  }
  if (!fs.existsSync(evidenceJsonPath)) {
    throw new Error(`Missing evidence.json in ${runDir}`);
  }

  const runJson = readJson(runJsonPath);
  const repoRoot = inferRepoRootFromRun(runJson, repoRootInput);

  return {
    repoRoot,
    runDir,
    runJsonPath,
    evidenceJsonPath,
    issueJsonPath,
    runJson,
    evidenceJson: readJson(evidenceJsonPath),
    issueJson: fs.existsSync(issueJsonPath) ? readJson(issueJsonPath) : null,
  };
}

function qaArtifactRoot(repoRootInput) {
  const repoRoot = path.resolve(repoRootInput || resolveRepoRoot());
  return path.join(repoRoot, "artifacts", "qa-runs", "functional-qa");
}

function findQaRunDirByRunId(runId, repoRootInput) {
  if (!runId) return null;

  const functionalQaRoot = qaArtifactRoot(repoRootInput);
  if (!fs.existsSync(functionalQaRoot)) {
    return null;
  }

  for (const targetEntry of fs.readdirSync(functionalQaRoot, { withFileTypes: true })) {
    if (!targetEntry.isDirectory()) continue;
    const targetDir = path.join(functionalQaRoot, targetEntry.name);

    for (const runEntry of fs.readdirSync(targetDir, { withFileTypes: true })) {
      if (!runEntry.isDirectory()) continue;
      const runDir = path.join(targetDir, runEntry.name);
      const manifestPath = path.join(runDir, "run.json");
      if (!fs.existsSync(manifestPath)) continue;

      try {
        const manifest = readJson(manifestPath);
        if (manifest.run_id === runId) {
          return runDir;
        }
      } catch {
        // Ignore malformed manifests while scanning prior runs.
      }
    }
  }

  return null;
}

function loadPreviousQaRunBundle(bundle, repoRootInput) {
  const previousRunId = bundle?.runJson?.previous_run_id;
  if (!previousRunId) {
    return null;
  }

  const previousRunDir = findQaRunDirByRunId(previousRunId, repoRootInput || bundle.repoRoot);
  if (!previousRunDir) {
    return null;
  }

  return loadQaRunBundle(previousRunDir, repoRootInput || bundle.repoRoot);
}

export {
  collectQaArtifacts,
  ensureDir,
  findQaRunDirByRunId,
  formatLabelFromFilename,
  groupArtifactsByCategory,
  inferContentType,
  loadQaRunBundle,
  loadPreviousQaRunBundle,
  readJson,
  relativeToRepo,
  resolveRepoRoot,
  toPublicUrl,
  writeJson,
};
