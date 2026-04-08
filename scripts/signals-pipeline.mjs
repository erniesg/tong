#!/usr/bin/env node
/**
 * Video Signals Pipeline CLI.
 *
 * Usage:
 *   node scripts/signals-pipeline.mjs keywords --text "product description" [--repo-context] [--image url]
 *   node scripts/signals-pipeline.mjs search --keywords-from ./keywords.json [--platforms tiktok,xiaohongshu]
 *   node scripts/signals-pipeline.mjs filter --results-from ./results.json --min-views 10000 --brief "description"
 *   node scripts/signals-pipeline.mjs run --text "microdrama inspirations" [--min-views 5000] [--top 20] [--output ./out.json]
 *
 * Each step reads/writes JSON files. `run` chains all steps.
 *
 * Env: GOOGLE_GEMINI_API_KEY, OPENAI_API_KEY
 */

import { parseArgs } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_SRC = resolve(__dirname, '..', 'apps', 'server', 'src');

// Dynamic imports of server modules
const { extractBriefFromMultimodal, filterByEngagement, runFilterPipeline } = await import(resolve(SERVER_SRC, 'signal-filter.mjs'));
const { generateKeywordsFromBrief } = await import(resolve(SERVER_SRC, 'signal-scheduler.mjs'));
const { saveKeywordSet, runTargetedScrape, searchPlatform } = await import(resolve(SERVER_SRC, 'signals.mjs'));
const { uploadVideo, analyzeVideo, ANALYSIS_PRESETS } = await import(resolve(SERVER_SRC, 'gemini-video.mjs'));
const { downloadVideo } = await import(resolve(SERVER_SRC, 'video-download.mjs'));

// ── CLI args ────────────────────────────────────────────────────────

const { positionals, values: args } = parseArgs({
  allowPositionals: true,
  options: {
    text: { type: 'string' },
    image: { type: 'string', multiple: true },
    'repo-context': { type: 'boolean', default: false },
    'keywords-from': { type: 'string' },
    'results-from': { type: 'string' },
    platforms: { type: 'string', default: 'tiktok,xiaohongshu,instagram' },
    'min-views': { type: 'string', default: '10000' },
    'min-likes': { type: 'string', default: '0' },
    brief: { type: 'string' },
    top: { type: 'string' },
    output: { type: 'string' },
    mode: { type: 'string', default: 'live' },
    preset: { type: 'string', default: 'scene_decomposition' },
    model: { type: 'string', default: 'flash' },
    'media-resolution': { type: 'string', default: 'low' },
    help: { type: 'boolean', default: false },
  },
  strict: false,
});

const command = positionals[0];

if (args.help || !command) {
  console.log(`Video Signals Pipeline CLI

Commands:
  keywords     Generate keywords from product brief (multimodal)
  search       Search platforms with keyword sets
  filter       Filter results by engagement + relevance
  fingerprint  Scene-decompose top videos via Gemini (produces 04-fingerprints.json)
  run          Full pipeline: keywords → search → filter

Options:
  --text <str>              Product description or campaign goal
  --image <url>             Product image URLs (repeatable)
  --repo-context            Read CLAUDE.md + package.json for context
  --keywords-from <file>    Load keyword sets from JSON file
  --results-from <file>     Load search results from JSON file
  --platforms <list>        Comma-separated: tiktok,xiaohongshu,instagram
  --min-views <n>           Engagement threshold (default: 10000)
  --min-likes <n>           Like threshold (default: 0)
  --brief <str>             Product brief for relevance scoring
  --top <n>                 Return top N results (fingerprint: number of videos to analyze, default 5)
  --output <file>           Write JSON output to file
  --mode <str>              live|mock|preflight (default: live)
  --preset <str>            Analysis preset for fingerprint (default: scene_decomposition)
  --model <str>             Gemini model for fingerprint: flash|pro (default: flash)
  --media-resolution <str>  low|medium|high for fingerprint (default: low)
  --help                    Show this help

Examples:
  node scripts/signals-pipeline.mjs keywords --text "dating sim language learning" --repo-context
  node scripts/signals-pipeline.mjs search --keywords-from ./keywords.json --platforms tiktok
  node scripts/signals-pipeline.mjs filter --results-from ./results.json --min-views 5000
  node scripts/signals-pipeline.mjs fingerprint --results-from ./03-filtered.json --top 5 --output ./04-fingerprints.json
  node scripts/signals-pipeline.mjs run --text "microdrama inspirations" --min-views 5000 --top 20`);
  process.exit(0);
}

function writeOutput(data, label) {
  const json = JSON.stringify(data, null, 2);
  if (args.output) {
    fs.writeFileSync(args.output, json);
    console.error(`[pipeline] ${label} written to ${args.output}`);
  } else {
    console.log(json);
  }
}

// ── Commands ────────────────────────────────────────────────────────

async function cmdKeywords() {
  console.error('[pipeline] Step 1: Extracting brief from inputs...');

  const { brief } = await extractBriefFromMultimodal({
    text: args.text,
    imageUrls: args.image,
    repoContext: args['repo-context'],
    executionMode: args.mode,
  });

  console.error(`[pipeline] Brief: ${brief.productName} — ${brief.description?.slice(0, 80)}...`);
  console.error(`[pipeline] Seed keywords: ${brief.keywords?.slice(0, 5).join(', ')}...`);

  console.error('[pipeline] Step 2: Generating keyword sets via OpenAI...');
  const sets = await generateKeywordsFromBrief(brief, { executionMode: args.mode });

  console.error(`[pipeline] Generated ${sets.length} keyword sets`);
  for (const s of sets) {
    console.error(`  - ${s.theme} (${s.priority}): ${Object.values(s.keywords || {}).flat().length} terms`);
  }

  const result = { brief, keywordSets: sets };
  writeOutput(result, 'Keywords');
  return result;
}

async function cmdSearch() {
  let keywordSets;
  if (args['keywords-from']) {
    const raw = JSON.parse(fs.readFileSync(args['keywords-from'], 'utf8'));
    keywordSets = raw.keywordSets || raw;
  } else {
    throw new Error('--keywords-from is required for search command');
  }

  // Save keyword sets to in-memory store
  for (const kw of keywordSets) {
    saveKeywordSet({ ...kw, source: 'pipeline' });
  }

  const platforms = args.platforms.split(',').map((p) => p.trim());
  console.error(`[pipeline] Searching ${platforms.join(', ')} with ${keywordSets.length} keyword sets...`);

  const scrapeResult = await runTargetedScrape({
    platforms,
    limit: 10,
    executionMode: args.mode,
  });

  console.error(`[pipeline] Found ${scrapeResult.results?.length || 0} results (${scrapeResult.warnings?.length || 0} warnings)`);

  writeOutput(scrapeResult, 'Search results');
  return scrapeResult;
}

async function cmdFilter() {
  let results;
  if (args['results-from']) {
    const raw = JSON.parse(fs.readFileSync(args['results-from'], 'utf8'));
    results = raw.results || raw;
  } else {
    throw new Error('--results-from is required for filter command');
  }

  const briefText = args.brief || args.text || 'general social media content';
  const brief = { description: briefText, keywords: briefText.split(/\s+/) };

  console.error(`[pipeline] Filtering ${results.length} results (minViews=${args['min-views']})...`);

  const filtered = await runFilterPipeline(results, brief, {
    minViews: Number(args['min-views']),
    minLikes: Number(args['min-likes']),
    topN: args.top ? Number(args.top) : undefined,
    executionMode: args.mode,
  });

  console.error(`[pipeline] ${filtered.stats.total} total → ${filtered.stats.afterEngagementFilter} after engagement → ${filtered.ranked.length} returned`);
  if (filtered.cost?.calls) {
    console.error(`[pipeline] Relevance scoring: ${filtered.cost.calls} Gemini calls, ${filtered.cost.inputTokens} input tokens`);
  }

  writeOutput(filtered, 'Filtered results');
  return filtered;
}

async function cmdRun() {
  // Step 1: Keywords
  const keywordsOutput = args.output ? args.output.replace('.json', '.keywords.json') : null;
  const origOutput = args.output;

  args.output = keywordsOutput;
  const { brief, keywordSets } = await cmdKeywords();

  // Step 2: Search
  for (const kw of keywordSets) {
    saveKeywordSet({ ...kw, source: 'pipeline' });
  }

  const platforms = args.platforms.split(',').map((p) => p.trim());
  console.error(`\n[pipeline] Step 3: Searching ${platforms.join(', ')}...`);

  const scrapeResult = await runTargetedScrape({
    platforms,
    limit: 10,
    executionMode: args.mode,
  });

  console.error(`[pipeline] Found ${scrapeResult.results?.length || 0} results`);

  // Step 3: Filter
  console.error(`\n[pipeline] Step 4: Filtering (minViews=${args['min-views']})...`);

  const filtered = await runFilterPipeline(scrapeResult.results || [], brief, {
    minViews: Number(args['min-views']),
    minLikes: Number(args['min-likes']),
    topN: args.top ? Number(args.top) : undefined,
    executionMode: args.mode,
  });

  console.error(`[pipeline] ${filtered.stats.total} → ${filtered.stats.afterEngagementFilter} after engagement → ${filtered.ranked.length} final`);

  const fullResult = {
    brief,
    keywordSets,
    search: { total: scrapeResult.results?.length || 0, warnings: scrapeResult.warnings },
    filter: filtered.stats,
    cost: filtered.cost,
    ranked: filtered.ranked,
  };

  args.output = origOutput;
  writeOutput(fullResult, 'Full pipeline');
  return fullResult;
}

async function cmdFingerprint() {
  if (!args['results-from']) {
    throw new Error('--results-from is required for fingerprint command');
  }

  const presetKey = args.preset || 'scene_decomposition';
  if (!ANALYSIS_PRESETS[presetKey]) {
    throw new Error(`Unknown preset: ${presetKey}. Available: ${Object.keys(ANALYSIS_PRESETS).join(', ')}`);
  }
  const preset = ANALYSIS_PRESETS[presetKey];

  const raw = JSON.parse(fs.readFileSync(args['results-from'], 'utf8'));
  // Support both flat arrays and ranked arrays from filter output
  const allResults = raw.ranked || raw.results || (Array.isArray(raw) ? raw : []);

  const topN = args.top ? Number(args.top) : 5;
  const candidates = allResults.slice(0, topN);

  if (candidates.length === 0) {
    throw new Error('No results found in input file');
  }

  console.error(`[pipeline] Fingerprinting ${candidates.length} videos with preset "${presetKey}" (model: ${args.model || 'flash'})...`);

  const fingerprints = [];

  for (let i = 0; i < candidates.length; i++) {
    const item = candidates[i];
    // Normalise the video URL — filter output uses videoPageUrl (TikTok/IG page URLs)
    const videoUrl = item.videoPageUrl || item.videoUrl || item.video_url || item.url || item.downloadUrl || item.video?.url || null;

    if (!videoUrl) {
      console.error(`[pipeline]   [${i + 1}/${candidates.length}] Skipping — no video URL: ${item.id || item.title || JSON.stringify(item).slice(0, 60)}`);
      fingerprints.push({ source: item, error: 'no_video_url', analysisId: null, result: null });
      continue;
    }

    const tag = `[${i + 1}/${candidates.length}]`;

    try {
      let filePath = null;
      let mimeType = 'video/mp4';

      // Social media page URLs need yt-dlp download before Gemini upload
      const isSocialUrl = /tiktok\.com|instagram\.com|xiaohongshu\.com|douyin\.com/.test(videoUrl);
      if (isSocialUrl) {
        console.error(`[pipeline]   ${tag} Downloading via yt-dlp: ${videoUrl.slice(0, 80)}...`);
        const dl = await downloadVideo({ url: videoUrl, timeout: 120000 });
        filePath = dl.filePath;
        mimeType = filePath.endsWith('.mp4') ? 'video/mp4' : filePath.endsWith('.webm') ? 'video/webm' : 'video/mp4';
        console.error(`[pipeline]   ${tag} Downloaded: ${dl.filename} (${(dl.size / 1024 / 1024).toFixed(1)} MB)`);
      } else {
        mimeType = videoUrl.endsWith('.mp4') ? 'video/mp4' : 'video/webm';
      }

      console.error(`[pipeline]   ${tag} Uploading to Gemini...`);
      const displayName = `fingerprint-${Date.now()}-${i}`;
      const uploadArgs = filePath
        ? { filePath, mimeType, displayName }
        : { url: videoUrl, mimeType, displayName };
      const { fileUri } = await uploadVideo(uploadArgs);

      console.error(`[pipeline]   ${tag} Analyzing...`);
      const analysis = await analyzeVideo({
        fileUri,
        mimeType,
        prompt: preset.prompt,
        model: args.model || 'flash',
        mediaResolution: args['media-resolution'] || 'low',
        responseSchema: preset.schema,
      });

      const sceneCount = analysis.result?.scenes?.length ?? 0;
      const autoScore = analysis.result?.automatabilityScore ?? 'n/a';
      console.error(`[pipeline]   ${tag} Done — ${sceneCount} scenes, automatability: ${autoScore}/100`);

      fingerprints.push({
        source: {
          id: item.id,
          platform: item.platform,
          author: item.author,
          title: item.title,
          caption: item.caption,
          views: item.stats?.views || item.views,
          likes: item.stats?.likes || item.likes,
          videoUrl,
          thumbnailUrl: item.thumbnailUrl || item.thumbnailCached || item.thumbnail_url || null,
          relevanceScore: item._relevance?.relevanceScore || item.relevanceScore || null,
        },
        preset: presetKey,
        analysisId: analysis.analysisId,
        model: analysis.model,
        tokensUsed: analysis.tokensUsed,
        result: analysis.result,
        analyzedAt: analysis.createdAt,
      });
    } catch (err) {
      console.error(`[pipeline]   ${tag} Error: ${err.message}`);
      fingerprints.push({ source: item, error: err.message, analysisId: null, result: null });
    }
  }

  const successful = fingerprints.filter((f) => f.result !== null).length;
  const totalTokens = fingerprints.reduce((sum, f) => sum + (f.tokensUsed?.totalTokens || 0), 0);

  console.error(`[pipeline] Fingerprinting complete: ${successful}/${candidates.length} succeeded, ${totalTokens} total tokens used`);

  const output = {
    preset: presetKey,
    model: args.model || 'flash',
    analyzedAt: new Date().toISOString(),
    stats: { total: candidates.length, successful, failed: candidates.length - successful, totalTokens },
    fingerprints,
  };

  writeOutput(output, 'Fingerprints');
  return output;
}

// ── Dispatch ────────────────────────────────────────────────────────

const commands = { keywords: cmdKeywords, search: cmdSearch, filter: cmdFilter, fingerprint: cmdFingerprint, run: cmdRun };

if (!commands[command]) {
  console.error(`Unknown command: ${command}. Use --help for usage.`);
  process.exit(1);
}

try {
  await commands[command]();
} catch (err) {
  console.error(`\n[pipeline] Error: ${err.message}`);
  process.exit(1);
}
