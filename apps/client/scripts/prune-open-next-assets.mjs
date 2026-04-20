#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(scriptDir, "..");
const OPEN_NEXT_ASSETS_DIR = path.join(clientRoot, ".open-next/assets");
const TEST_ASSETS_SEGMENT = `${path.sep}test-assets${path.sep}`;
const MAX_CF_ASSET_BYTES = 25 * 1024 * 1024;

function walkFiles(dirPath, files = []) {
  if (!fs.existsSync(dirPath)) return files;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
      continue;
    }
    if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function shouldPruneAsset(filePath) {
  if (filePath.includes(TEST_ASSETS_SEGMENT)) return "test-assets";
  const size = fs.statSync(filePath).size;
  if (size > MAX_CF_ASSET_BYTES) return "over-25mb";
  return null;
}

function main() {
  const files = walkFiles(OPEN_NEXT_ASSETS_DIR);
  const pruned = [];

  for (const filePath of files) {
    const reason = shouldPruneAsset(filePath);
    if (!reason) continue;
    fs.unlinkSync(filePath);
    pruned.push({ filePath, reason });
  }

  console.log(`OpenNext assets dir: ${OPEN_NEXT_ASSETS_DIR}`);
  console.log(`Files scanned: ${files.length}`);
  console.log(`Files pruned: ${pruned.length}`);
  for (const item of pruned) {
    const relPath = path.relative(clientRoot, item.filePath).split(path.sep).join("/");
    console.log(`Pruned (${item.reason}): ${relPath}`);
  }
}

main();
