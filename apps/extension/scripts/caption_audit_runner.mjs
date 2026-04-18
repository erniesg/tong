#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { resolveCaptionLanguage } from '../src/content/caption-language-resolver.ts';

const manifestPath = process.argv[2] || 'apps/extension/fixtures/caption-audit-manifest.sample.json';
const outPath = process.argv[3] || 'artifacts/qa-runs/caption-audit/report.json';

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (!Array.isArray(manifest.items) || manifest.items.length === 0) {
  throw new Error('Manifest must include non-empty items[]');
}

const results = manifest.items.map((item) => {
  const decision = resolveCaptionLanguage({
    preferences: item.preferences ?? null,
    tracks: item.tracks ?? [],
    selectedTrackId: item.selectedTrackId ?? null,
    manualTrackOverride: Boolean(item.manualTrackOverride),
    cues: item.cues ?? [],
    pageMetadata: item.pageMetadata ?? {},
  });

  return {
    id: item.id,
    url: item.url,
    reviewedGroundTruth: item.reviewedGroundTruth ?? null,
    selectedTrackId: decision.selectedTrackId,
    resolvedSourceLanguage: decision.sourceLanguage,
    confidence: decision.confidence,
    reasonCode: decision.reasonCode,
    reasonDetail: decision.detail,
    pass: item.reviewedGroundTruth ? decision.sourceLanguage === item.reviewedGroundTruth : null,
  };
});

const comparable = results.filter((r) => r.reviewedGroundTruth);
const passes = comparable.filter((r) => r.pass === true).length;
const accuracy = comparable.length > 0 ? passes / comparable.length : null;

const report = {
  manifest: path.resolve(manifestPath),
  totalItems: results.length,
  comparedItems: comparable.length,
  exactMatchRate: accuracy,
  disagreements: comparable.filter((r) => r.pass === false),
  results,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`Audit complete: ${results.length} items`);
if (accuracy !== null) {
  console.log(`Exact match rate: ${(accuracy * 100).toFixed(1)}% (${passes}/${comparable.length})`);
}
console.log(`Report written to ${outPath}`);
