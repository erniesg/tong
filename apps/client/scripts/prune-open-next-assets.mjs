#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const OPEN_NEXT_ASSETS_DIR = ".open-next/assets";
const DEFAULT_MAX_SIZE_BYTES = 25 * 1024 * 1024;

function walkFiles(dirPath, files = []) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function relative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function main() {
  const rootDir = process.cwd();
  const assetsDir = path.join(rootDir, OPEN_NEXT_ASSETS_DIR);
  if (!fs.existsSync(assetsDir)) {
    console.log(`No ${OPEN_NEXT_ASSETS_DIR} directory found; nothing to prune.`);
    return;
  }

  const removed = [];
  const candidates = walkFiles(assetsDir);

  for (const filePath of candidates) {
    const rel = relative(assetsDir, filePath);
    const stat = fs.statSync(filePath);
    const inTestAssetsDir = rel.startsWith("test-assets/");
    const tooLarge = stat.size > DEFAULT_MAX_SIZE_BYTES;
    if (!inTestAssetsDir && !tooLarge) continue;

    fs.rmSync(filePath);
    removed.push({
      path: rel,
      reason: inTestAssetsDir ? "test-assets path" : `>25MB (${Math.round(stat.size / (1024 * 1024))}MB)`,
    });
  }

  if (removed.length === 0) {
    console.log("No build assets pruned.");
    return;
  }

  console.log(`Pruned ${removed.length} build asset(s):`);
  for (const entry of removed) {
    console.log(` - ${entry.path} [${entry.reason}]`);
  }
}

main();
