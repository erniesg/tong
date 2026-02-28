import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMockIngestion, writeGeneratedSnapshots } from './ingestion.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');
const snapshotPath = path.join(repoRoot, 'apps/server/data/mock-media-window.json');

const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
const result = runMockIngestion(snapshot);
writeGeneratedSnapshots(result);

console.log('Mock ingestion completed.');
console.log(`Generated at: ${result.generatedAtIso}`);
console.log(`Top term: ${result.frequency.items[0]?.lemma ?? 'n/a'}`);
console.log(
  `Sources -> YouTube: ${result.mediaProfile.sourceBreakdown.youtube.itemsConsumed}, Spotify: ${result.mediaProfile.sourceBreakdown.spotify.itemsConsumed}`,
);
