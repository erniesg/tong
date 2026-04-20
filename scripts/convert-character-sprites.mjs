#!/usr/bin/env node
// Convert PNG character sprites under apps/client/public/assets/characters/** to WebP.
// Replaces each .png with a .webp at q=90 (keeps alpha). Re-runnable: existing .webp
// paths are left alone unless --force is passed.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const CHARACTERS_DIR = path.join(repoRoot, 'apps/client/public/assets/characters');
const QUALITY = 90;

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const force = args.has('--force');
const keepPng = args.has('--keep-png');

function walkPngs(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkPngs(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) out.push(full);
  }
  return out;
}

function convert(pngPath) {
  const webpPath = pngPath.replace(/\.png$/i, '.webp');
  if (!force && fs.existsSync(webpPath)) {
    return { pngPath, webpPath, status: 'skipped-existing' };
  }
  if (dryRun) return { pngPath, webpPath, status: 'dry-run' };

  const result = spawnSync('cwebp', ['-q', String(QUALITY), '-quiet', pngPath, '-o', webpPath]);
  if (result.status !== 0) {
    return { pngPath, webpPath, status: 'failed', stderr: result.stderr?.toString() };
  }
  if (!keepPng) fs.unlinkSync(pngPath);
  return { pngPath, webpPath, status: keepPng ? 'converted-kept-png' : 'converted' };
}

const pngs = walkPngs(CHARACTERS_DIR);
if (!pngs.length) {
  console.log('No .png files found under', CHARACTERS_DIR);
  process.exit(0);
}

console.log(`Found ${pngs.length} .png file(s). quality=${QUALITY} dryRun=${dryRun} force=${force} keepPng=${keepPng}`);
let converted = 0;
let skipped = 0;
let failed = 0;
for (const png of pngs) {
  const rel = path.relative(repoRoot, png);
  const result = convert(png);
  if (result.status === 'converted' || result.status === 'converted-kept-png') {
    converted += 1;
    console.log(`  ✓ ${rel} → ${path.basename(result.webpPath)}`);
  } else if (result.status === 'skipped-existing') {
    skipped += 1;
    console.log(`  - ${rel} (webp exists, use --force to overwrite)`);
  } else if (result.status === 'dry-run') {
    console.log(`  (dry-run) ${rel} → ${path.basename(result.webpPath)}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${rel} failed: ${result.stderr || 'unknown'}`);
  }
}
console.log(`Done. converted=${converted} skipped=${skipped} failed=${failed}`);
if (failed) process.exit(1);
