#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import { resolve, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DEFAULT_OUTPUT_DIR = resolve(ROOT, 'artifacts', 'videoclaw');
const DEFAULT_CLUSTERS_PATH = resolve(ROOT, 'apps', 'client', 'public', 'signals-cache', '05-scene-clusters.json');
const DEFAULT_TRANSCRIPTS_PATH = resolve(ROOT, 'apps', 'client', 'public', 'signals-cache', '06-video-transcripts.json');
const DEFAULT_SOURCES_PATH = resolve(ROOT, 'apps', 'client', 'public', 'signals-cache', '05-scene-sources.json');
const DEFAULT_TOKEN_PATH = resolve(os.homedir(), '.videoclaw_personal_mcp_token');
const HUMEO_BASE_URL = 'https://app.humeo.com';
const DEFAULT_TIMEOUT_MINUTES = 45;
const DEFAULT_POLL_SECONDS = 30;
const DEFAULT_THEME_ID = 'journal';
const DEFAULT_RENDER_PROFILE = '1080p_30';
const SENSITIVE_QUERY_KEYS = new Set(['mcpPersonalToken', 'token', 'accessToken', 'authToken', 'bearer']);

const DEFAULT_PRODUCT_CONTEXT = [
  'Tong is a mobile-first language learning demo that blends subtitle augmentation, per-word dictionary lookup, and a narrative game world.',
  'The product value is immersive Korean, Japanese, and Chinese learning through short-form video, interactive captions, vocab reinforcement, and roleplay-style progression.',
  'Core beats to emphasize: creator-friendly short-form hook, clear learner pain point, concrete product demo, memorable bilingual example, and a direct call to try Tong.',
  'Preferred angle: make language learning feel social, cinematic, and immediately usable rather than textbook-heavy.',
].join('\n');

function printHelp() {
  console.log(`VideoClaw Autoflow

Commands:
  pack         Build a reusable reference pack from clustered scenes + transcripts
  recreate     Recreate a short generated video segment from a reference motif

Common options:
  --brief <text>                Extra product/context brief
  --brief-file <path>           Load product/context brief from .md/.txt/.json
  --clusters-file <path>        Override clustered-scenes JSON
  --transcripts-file <path>     Override transcripts JSON
  --sources-file <path>         Override source mapping JSON
  --output-dir <path>           Write artifacts here (default: artifacts/videoclaw)
  --scene-limit <n>             Number of top motifs to include (default: 12)
  --motifs-per-video <n>        Representative motifs kept per video (default: 3)
  --verbose                     Print raw API and prompt details

Recreate options:
  --topic <text>                Optional generation title
  --duration <sec>              Desired generated segment length 4-12 (default: 8)
  --poll-seconds <n>            Generation poll cadence (default: 30)
  --timeout-minutes <n>         Generation timeout (default: 45)
  --dry-run                     Build prompts and artifacts without calling Humeo
  --motif-id <id>               Recreate a specific local motif ID
  --video-id <id>               Prefer the strongest motif from this video
  --reference-image-url <url>   Override the image reference passed to Humeo
  --camera-fixed                Keep the generated camera fixed
  --wait                        Poll until generated video completes

Examples:
  node scripts/videoclaw_autoflow.mjs pack --brief-file docs/my-brief.md
  node scripts/videoclaw_autoflow.mjs recreate --video-id 2476db64807e --wait
  node scripts/videoclaw_autoflow.mjs recreate --motif-id 2476db64807e:m02 --wait`);
}

function timestampId(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  ensureDir(dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function writeText(filePath, text) {
  ensureDir(dirname(filePath));
  fs.writeFileSync(filePath, text.endsWith('\n') ? text : `${text}\n`);
}

function chmodPrivate(filePath) {
  fs.chmodSync(filePath, 0o600);
}

function truncate(text, maxLength = 240) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trim()}…`;
}

function normalizeText(text) {
  return String(text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(text) {
  const value = String(text || '').trim();
  return value ? value.split(/\s+/).length : 0;
}

function uniqueNonEmpty(values) {
  return [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))];
}

function hasLatin(text) {
  return /[A-Za-z]/.test(String(text || ''));
}

function hasCjk(text) {
  return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(String(text || ''));
}

function describeHookPattern(text) {
  const normalized = normalizeText(text);
  if (!normalized) return 'visual cold open';
  if (String(text || '').includes('?')) return 'question-led cold open';
  if (/\b(let s|practice|try|watch|look)\b/.test(normalized)) return 'practice-led opening';
  if (/\bif\b/.test(normalized)) return 'conditional pain-point opening';
  if (/^(\d+|here are)\b/.test(normalized)) return 'list-style opening';
  return 'direct statement opening';
}

function describeClosePattern(text) {
  const normalized = normalizeText(text);
  if (!normalized) return 'visual/payoff close';
  if (/\b(try|practice|plug in|repeat|use this|say this|introduc)\b/.test(normalized)) return 'practice prompt close';
  if (/\b(follow|join|start|learn|download|try tong|tap)\b/.test(normalized)) return 'cta close';
  if (/\b(thank|thanks)\b/.test(normalized)) return 'gratitude/payoff close';
  return 'payoff close';
}

function describeMotifPattern({ transcript, occurrenceCount, durationSec }) {
  const normalized = normalizeText(transcript);
  const traits = [];
  if (occurrenceCount > 1) traits.push(`repeats ${occurrenceCount}x`);
  if (hasLatin(transcript) && hasCjk(transcript)) {
    traits.push('bilingual explanation/demo');
  } else if (/\b(practice|try|learn|grammar|introduc|example)\b/.test(normalized)) {
    traits.push('teaching/demo beat');
  } else if (!normalized) {
    traits.push('visual reaction beat');
  } else {
    traits.push('example/payoff beat');
  }
  if (durationSec < 2) traits.push('quick cut');
  if (durationSec > 7) traits.push('longer proof beat');
  return traits.join(', ');
}

function redactSensitiveUrl(value) {
  const text = String(value || '');
  try {
    const url = new URL(text);
    let changed = false;
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEYS.has(key)) {
        url.searchParams.set(key, '[REDACTED]');
        changed = true;
      }
    }
    return changed ? url.toString() : text.replace(/humeo_pat_[A-Za-z0-9]+/g, '[REDACTED]');
  } catch {
    return text.replace(/humeo_pat_[A-Za-z0-9]+/g, '[REDACTED]');
  }
}

function sanitizeForArtifact(value) {
  if (typeof value === 'string') {
    return redactSensitiveUrl(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForArtifact(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeForArtifact(entry)]),
    );
  }
  return value;
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items || []) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function getAtPath(target, path) {
  let current = target;
  for (const segment of path.split('.')) {
    if (!current || typeof current !== 'object' || !(segment in current)) return undefined;
    current = current[segment];
  }
  return current;
}

function firstString(target, paths) {
  for (const path of paths) {
    const value = getAtPath(target, path);
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function firstArray(target, paths) {
  for (const path of paths) {
    const value = getAtPath(target, path);
    if (Array.isArray(value)) return value;
  }
  return [];
}

function clampPrompt(text, maxWords = 900) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  return words.length <= maxWords ? words.join(' ') : `${words.slice(0, maxWords).join(' ')} …`;
}

function toBriefText(rawValue) {
  if (!rawValue) return '';
  if (typeof rawValue === 'string') return rawValue.trim();
  if (Array.isArray(rawValue)) {
    return rawValue.map((item) => `- ${toBriefText(item)}`).filter(Boolean).join('\n');
  }
  if (typeof rawValue === 'object') {
    return Object.entries(rawValue)
      .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
      .join('\n');
  }
  return String(rawValue);
}

function loadBrief(args) {
  if (args.brief) return args.brief.trim();
  if (!args['brief-file']) return DEFAULT_PRODUCT_CONTEXT;

  const filePath = resolve(ROOT, args['brief-file']);
  const ext = extname(filePath).toLowerCase();
  const raw = fs.readFileSync(filePath, 'utf8');
  if (ext === '.json') {
    const parsed = JSON.parse(raw);
    return [
      toBriefText(parsed.brief),
      toBriefText(parsed.productContext),
      toBriefText(parsed.context),
      toBriefText(parsed),
    ].find(Boolean) || DEFAULT_PRODUCT_CONTEXT;
  }
  return raw.trim() || DEFAULT_PRODUCT_CONTEXT;
}

function buildScriptStructure(transcriptRecord, scenes, motifs) {
  const segments = [...(transcriptRecord?.transcript_segments || [])].sort((a, b) => (a.start_sec || 0) - (b.start_sec || 0));
  const sceneEnd = scenes.reduce((max, scene) => Math.max(max, Number(scene.end_sec || 0)), 0);
  const transcriptEnd = segments.reduce((max, segment) => Math.max(max, Number(segment.end_sec || 0)), 0);
  const durationSec = Math.max(sceneEnd, transcriptEnd, 0);
  const hookWindow = Math.max(5, Math.min(8, durationSec * 0.18 || 5));
  const closeWindowStart = Math.max(0, durationSec - Math.max(10, durationSec * 0.18 || 10));
  const hookExcerpt = truncate(segments.filter((segment) => Number(segment.end_sec || 0) <= hookWindow).map((segment) => segment.text).join(' '), 220);
  const closingExcerpt = truncate(segments.filter((segment) => Number(segment.start_sec || 0) >= closeWindowStart).map((segment) => segment.text).join(' '), 220);

  const duplicateCounts = new Map();
  for (const segment of segments) {
    const key = normalizeText(segment.text);
    if (!key) continue;
    duplicateCounts.set(key, (duplicateCounts.get(key) || 0) + 1);
  }

  const repeatedLines = [...duplicateCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([normalized, count]) => ({ text: normalized, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const recurringMotifs = motifs
    .filter((motif) => motif.occurrenceCount > 1)
    .map((motif) => ({
      motifId: motif.localMotifId,
      count: motif.occurrenceCount,
      transcript: truncate(motif.transcript, 120),
      startSec: motif.startSec,
      endSec: motif.endSec,
    }));

  return {
    durationSec: Number(durationSec.toFixed(2)),
    hookExcerpt,
    closingExcerpt,
    repeatedLines,
    recurringMotifs,
  };
}

function buildReferencePack({
  clustersPath,
  transcriptsPath,
  sourcesPath,
  briefText,
  sceneLimit,
  motifsPerVideo,
}) {
  const clusterData = readJson(clustersPath);
  const transcriptData = readJson(transcriptsPath);
  const sourceData = fs.existsSync(sourcesPath) ? readJson(sourcesPath) : { sources: {} };
  const sourceMap = sourceData.sources || {};
  const transcriptByVideo = new Map((transcriptData.videos || []).map((video) => [video.video_id, video]));
  const scenes = [...(clusterData.scenes || [])];

  const clusterSizes = {};
  for (const modality of ['clip', 'videomae', 'text', 'audio', 'combined']) {
    const counts = new Map();
    for (const scene of scenes) {
      const clusterId = scene.clusters?.[modality];
      if (clusterId == null || clusterId < 0) continue;
      counts.set(clusterId, (counts.get(clusterId) || 0) + 1);
    }
    clusterSizes[modality] = counts;
  }

  const videos = [];
  const scenesByVideo = groupBy(scenes, (scene) => scene.video_id);
  for (const [videoId, videoScenes] of [...scenesByVideo.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const orderedScenes = [...videoScenes].sort((a, b) => Number(a.start_sec || 0) - Number(b.start_sec || 0));
    const transcriptRecord = transcriptByVideo.get(videoId) || null;
    const source = sourceMap[videoId] || null;

    const motifGroups = groupBy(orderedScenes, (scene) => scene.local_motif_id || `${videoId}:scene-${scene.scene_idx}`);
    const motifs = [...motifGroups.entries()].map(([localMotifId, motifScenes]) => {
      const representative = motifScenes.find((scene) => scene.is_representative) || motifScenes[0];
      const combinedCluster = representative.clusters?.combined;
      const clipCluster = representative.clusters?.clip;
      const textCluster = representative.clusters?.text;
      const occurrenceCount = Math.max(
        Number(representative.local_motif_count || 0),
        motifScenes.length,
      );
      const transcript = truncate(
        uniqueNonEmpty(motifScenes.map((scene) => scene.transcript)).join(' / ') || representative.transcript || '',
        180,
      );
      const score =
        occurrenceCount * 10 +
        (representative.is_representative ? 4 : 0) +
        (clusterSizes.combined.get(combinedCluster) || 0) * 1.5 +
        (clusterSizes.clip.get(clipCluster) || 0) +
        (clusterSizes.text.get(textCluster) || 0) * 0.5;

      return {
        localMotifId,
        occurrenceCount,
        representativeSceneIdx: representative.scene_idx,
        startSec: representative.start_sec,
        endSec: representative.end_sec,
        durationSec: representative.duration_sec,
        transcript,
        thumbnail: representative.thumbnail || null,
        sourceUrl: source?.url || null,
        platform: source?.platform || null,
        author: source?.author || null,
        combinedCluster,
        clipCluster,
        textCluster,
        audioCluster: representative.clusters?.audio ?? null,
        patternDescription: describeMotifPattern({
          transcript,
          occurrenceCount,
          durationSec: representative.duration_sec,
        }),
        score: Number(score.toFixed(2)),
      };
    }).sort((a, b) => b.score - a.score || a.startSec - b.startSec);

    const topMotifs = motifs.slice(0, motifsPerVideo);
    const structure = buildScriptStructure(transcriptRecord, orderedScenes, motifs);
    const patternSummary = {
      hookPattern: describeHookPattern(structure.hookExcerpt),
      closePattern: describeClosePattern(structure.closingExcerpt),
      motifPatterns: uniqueNonEmpty(topMotifs.map((motif) => motif.patternDescription)),
    };

    videos.push({
      videoId,
      source,
      sceneCount: orderedScenes.length,
      motifCount: motifs.length,
      recurringMotifCount: motifs.filter((motif) => motif.occurrenceCount > 1).length,
      transcriptWordCount: countWords(transcriptRecord?.full_transcript || ''),
      fullTranscript: transcriptRecord?.full_transcript || '',
      transcriptSegments: transcriptRecord?.transcript_segments || [],
      motifs,
      topMotifs,
      structure,
      patternSummary,
    });
  }

  const topMotifs = videos
    .flatMap((video) => video.topMotifs.map((motif) => ({
      ...motif,
      videoId: video.videoId,
      hookExcerpt: video.structure.hookExcerpt,
      closingExcerpt: video.structure.closingExcerpt,
    })))
    .sort((a, b) => b.score - a.score)
    .slice(0, sceneLimit);

  const referenceLines = videos.map((video, index) => {
    const sourceLabel = video.source?.author ? `@${video.source.author}` : video.videoId;
    const motifSummary = video.topMotifs
      .map((motif) => motif.patternDescription)
      .join('; ');
    const repeatedSummary = video.structure.repeatedLines
      .map((line) => `${line.count}x repeated phrase`)
      .join('; ');
    return [
      `${index + 1}. ${sourceLabel}`,
      video.source?.url ? `   source: ${video.source.url}` : null,
      `   hook pattern: ${video.patternSummary.hookPattern}`,
      motifSummary ? `   motifs: ${motifSummary}` : null,
      repeatedSummary ? `   repeated lines: ${repeatedSummary}` : null,
      `   close pattern: ${video.patternSummary.closePattern}`,
    ].filter(Boolean).join('\n');
  }).join('\n');

  const continuityTranscript = clampPrompt(
    videos.map((video, index) => {
      const parts = [
        `Reference ${index + 1}: ${video.source?.author ? `@${video.source.author}` : video.videoId}`,
        `Hook pattern: ${video.patternSummary.hookPattern}`,
        `Close pattern: ${video.patternSummary.closePattern}`,
        video.topMotifs.length
          ? `Motifs: ${video.topMotifs.map((motif) => motif.patternDescription).join(' | ')}`
          : null,
      ].filter(Boolean);
      return parts.join('\n');
    }).join('\n\n'),
    700,
  );

  const structureNotes = uniqueNonEmpty(videos.flatMap((video) => {
    const notes = [];
    notes.push(`Reference hook pattern: ${video.patternSummary.hookPattern}`);
    if (video.recurringMotifCount > 0) {
      notes.push(`Uses recurring visual/semantic motifs ${video.recurringMotifCount} time(s)`);
    }
    notes.push(`Reference close pattern: ${video.patternSummary.closePattern}`);
    if (video.structure.repeatedLines.length > 0) {
      notes.push(`Contains repeated phrase reinforcement`);
    }
    return notes;
  })).slice(0, 12);

  return {
    generatedAt: new Date().toISOString(),
    sourceArtifacts: {
      clustersPath,
      transcriptsPath,
      sourcesPath,
    },
    summary: {
      totalVideos: videos.length,
      totalScenes: clusterData.total_scenes || scenes.length,
      totalLocalMotifs: clusterData.total_local_motifs || 0,
      totalRepresentatives: clusterData.total_representatives || 0,
      topMotifCount: topMotifs.length,
    },
    productContext: briefText,
    videos,
    topMotifs,
    promptInputs: {
      referenceLines,
      continuityTranscript,
      structureNotes,
    },
  };
}

function buildHookPrompt({ briefText, pack, research }) {
  const sections = [
    'Create short-form creator-video hooks for Tong.',
    '',
    'Updated product context:',
    briefText,
    '',
    'Reference patterns from scraped videos:',
    pack.promptInputs.referenceLines,
    '',
    'Emergent structure notes:',
    ...pack.promptInputs.structureNotes.map((note) => `- ${note}`),
  ];

  if (research?.research) {
    sections.push(
      '',
      'Fresh research summary:',
      truncate(research.research.summary || '', 500),
      '',
      'Useful angles:',
      ...(research.research.suggestedAngles || []).slice(0, 6).map((angle) => `- ${angle}`),
    );
  }

  sections.push(
    '',
    'Requirements:',
    '- Adapt the hook mechanics and pacing, not the source content literally.',
    '- Never copy the source topic, nouns, lesson examples, or domain-specific subject matter.',
    '- Every hook must explicitly fit Tong and its product demo, not the original reference video topic.',
    '- Fit a creator-led teleprompter or direct-to-camera video.',
    '- Make Tong feel social, immersive, and immediately useful for language learners.',
    '- Favor concrete user pain, a vivid payoff, and a clear reason to keep watching.',
    '- Keep hooks realistic for a single short-form clip.',
  );

  return sections.join('\n').trim();
}

function buildScriptPrompt({
  briefText,
  pack,
  selectedHook,
  durationSeconds,
  tone,
  audience,
  callToAction,
}) {
  const hookTitle = selectedHook?.title || 'Use the strongest hook from the provided context.';
  const hookDescription = selectedHook?.description ? `Selected hook details: ${selectedHook.description}` : '';
  const topMotifSummary = pack.topMotifs
    .slice(0, 6)
    .map((motif, index) => `${index + 1}. ${motif.author ? `@${motif.author}` : motif.videoId}: ${motif.patternDescription}`)
    .join('\n');

  return [
    `Write a ${durationSeconds}-second creator script for Tong.`,
    '',
    `Hook to anchor on: ${hookTitle}`,
    hookDescription,
    '',
    'Updated product context:',
    briefText,
    '',
    'Reference motifs to borrow structurally:',
    topMotifSummary,
    '',
    'Structure constraints:',
    '- Land the hook in the first line.',
    '- Move quickly from learner pain point to concrete product payoff.',
    '- Include one vivid learning example or demo beat.',
    '- End with a direct invitation to try Tong.',
    '- Do not copy the reference topic or exact teaching examples; only borrow pacing and structure.',
    '- Keep it shootable as a teleprompter/direct-to-camera creator video.',
    tone ? `Tone: ${tone}` : null,
    audience ? `Audience: ${audience}` : null,
    callToAction ? `Preferred CTA: ${callToAction}` : null,
  ].filter(Boolean).join('\n').trim();
}

function buildFallbackScriptText({
  briefText,
  selectedHook,
  pack,
  callToAction,
}) {
  const briefLines = String(briefText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
  const motifHints = uniqueNonEmpty(pack.topMotifs.slice(0, 3).map((motif) => motif.patternDescription));
  const lines = [
    selectedHook?.title || 'If language learning still feels passive, Tong is the faster way to turn watching into speaking.',
    briefLines[0] || 'Tong turns short-form language content into interactive practice.',
    briefLines[1] || 'Tap subtitles for translation, pronunciation, and dictionary help the moment a phrase appears.',
    'Move straight from watching into an in-context scene so the phrase becomes usable, not just memorable.',
    motifHints.length ? `Keep the pacing tight: ${motifHints.join('; ')}.` : 'Keep the pacing tight with quick demo beats and repeatable phrasing.',
    briefLines[2] || 'The goal is immediate learner payoff instead of passive memorization.',
    callToAction || 'Try Tong and learn your first usable phrase today.',
  ];
  return lines.join('\n');
}

function buildRecreationPrompt({ briefText, motif, video, durationSeconds }) {
  const sourceLabel = motif.author ? `@${motif.author}` : motif.videoId;
  const productLines = String(briefText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);
  const structureHints = uniqueNonEmpty([
    `Hook pattern: ${video?.patternSummary?.hookPattern || 'direct creator-led opener'}`,
    `Close pattern: ${video?.patternSummary?.closePattern || 'clear payoff close'}`,
    ...(video?.topMotifs || []).slice(0, 3).map((item) => item.patternDescription),
  ]);

  const imagePrompt = [
    'Vertical 9:16 cinematic creator-video frame for a mobile language learning ad.',
    'Show a creator demonstrating Tong on a phone with interactive subtitle overlays and a highlighted phrase chip.',
    productLines[0] || 'Tong blends short-form video with interactive language learning.',
    productLines[1] || 'Focus on immediate learner payoff and social, cinematic energy.',
    `Borrow only the structure from reference motif ${motif.localMotifId} from ${sourceLabel}: ${motif.patternDescription}.`,
    'All visible UI copy, subtitles, and captions must be English only.',
    'Do not render Chinese, Japanese, or Korean characters anywhere in the frame.',
    'If a foreign-language phrase appears, render it as romanized Latin letters only.',
    'Warm editorial lighting, premium mobile UI, creator-led composition, polished product-demo feel.',
  ].filter(Boolean).join(' ');

  const videoPrompt = [
    `Create a ${durationSeconds}-second vertical 9:16 short-form ad segment for Tong.`,
    'A creator demonstrates Tong on a phone while interactive English captions, highlighted words, and subtle UI overlays appear.',
    productLines.join(' '),
    `Reference motif pattern: ${motif.patternDescription}.`,
    structureHints.join(' '),
    'Do not replicate the original source topic or exact lesson content.',
    'All visible on-screen text and spoken lines should be English only.',
    'Do not render Chinese, Japanese, or Korean characters.',
    'If you need to imply a target-language example, use romanized Latin letters instead of native script.',
    'Make it feel like a premium product demo for language learners, with a strong hook, fast visual payoff, and clear CTA energy.',
  ].filter(Boolean).join(' ');

  return {
    imagePrompt,
    videoPrompt,
  };
}

function selectRecreationTarget(pack, args) {
  if (args['motif-id']) {
    for (const video of pack.videos || []) {
      const motif = (video.motifs || []).find((item) => item.localMotifId === args['motif-id']);
      if (motif) return { motif, video };
    }
    throw new Error(`motif not found: ${args['motif-id']}`);
  }

  if (args['video-id']) {
    const video = (pack.videos || []).find((item) => item.videoId === args['video-id']);
    if (!video) throw new Error(`video not found: ${args['video-id']}`);
    const motif = video.topMotifs?.[0] || video.motifs?.[0];
    if (!motif) throw new Error(`no motifs available for video: ${args['video-id']}`);
    return { motif, video };
  }

  const motif = pack.topMotifs?.[0];
  if (!motif) throw new Error('reference pack has no top motifs');
  const video = (pack.videos || []).find((item) => item.videoId === motif.videoId) || null;
  return { motif, video };
}

async function createScriptWithFallback({
  client,
  primaryPayload,
  fallbackPayload,
}) {
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await client.createScript(primaryPayload);
      return { response, usedFallback: false, primaryError: null };
    } catch (error) {
      lastError = error;
      if (attempt < 2) await sleep(1200);
    }
  }

  const response = await client.createScript(fallbackPayload);
  return {
    response,
    usedFallback: true,
    primaryError: lastError instanceof Error ? lastError.message : String(lastError),
  };
}

async function generateImageWithRetry(client, body, attempts = 2) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await client.generateImage(body);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(1500);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function latestOutputPath(outputDir, name) {
  return resolve(outputDir, `latest-${name}`);
}

function saveArtifact(outputDir, baseName, data) {
  const timestamp = timestampId();
  const stampedPath = resolve(outputDir, `${timestamp}-${baseName}`);
  const latestPath = latestOutputPath(outputDir, baseName);
  if (baseName.endsWith('.json')) {
    const sanitized = sanitizeForArtifact(data);
    writeJson(stampedPath, sanitized);
    writeJson(latestPath, sanitized);
  } else {
    writeText(stampedPath, data);
    writeText(latestPath, data);
  }
  return { stampedPath, latestPath };
}

function saveSecretText(outputDir, name, text) {
  const timestamp = timestampId();
  const stampedPath = resolve(outputDir, `${timestamp}-${name}.secret.txt`);
  const latestPath = latestOutputPath(outputDir, `${name}.secret.txt`);
  writeText(stampedPath, text);
  writeText(latestPath, text);
  chmodPrivate(stampedPath);
  chmodPrivate(latestPath);
  return { stampedPath, latestPath };
}

function loadToken() {
  if (process.env.VIDEOCLAW_PAT?.trim()) return process.env.VIDEOCLAW_PAT.trim();
  if (process.env.VIDEOCLAW_PERSONAL_MCP_TOKEN?.trim()) return process.env.VIDEOCLAW_PERSONAL_MCP_TOKEN.trim();
  if (fs.existsSync(DEFAULT_TOKEN_PATH)) {
    const value = fs.readFileSync(DEFAULT_TOKEN_PATH, 'utf8').trim();
    if (value) return value;
  }
  throw new Error(`Missing VideoClaw token. Expected VIDEOCLAW_PAT or ${DEFAULT_TOKEN_PATH}`);
}

class HumeoClient {
  constructor({ token, verbose = false }) {
    this.token = token;
    this.verbose = verbose;
  }

  async request(path, { method = 'GET', query, body } = {}) {
    const url = new URL(`${HUMEO_BASE_URL}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value == null || value === '') continue;
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
      },
      body: body == null ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (this.verbose) {
      console.error(`[videoclaw] ${method} ${path} -> ${response.status}`);
    }

    if (!response.ok) {
      const message = data?.error || data?.message || text || response.statusText;
      throw new Error(`${method} ${path} failed (${response.status}): ${message}`);
    }

    return data;
  }

  status() {
    return this.request('/api/mcp/auth/personal-token/status', { method: 'POST', body: {} });
  }

  research(topic, depth = 'standard') {
    return this.request('/api/mcp/research', {
      method: 'POST',
      body: { topic, depth, maxSources: 5 },
    });
  }

  createHooks(prompt) {
    return this.request('/api/mcp/hooks/create', {
      method: 'POST',
      body: { prompt },
    });
  }

  createScript(body) {
    return this.request('/api/mcp/teleprompter/scripts/create', {
      method: 'POST',
      body,
    });
  }

  createRecordingLink(body) {
    return this.request('/api/mcp/recording-link/create', {
      method: 'POST',
      body,
    });
  }

  generateImage(body) {
    return this.request('/api/mcp/generate-image', {
      method: 'POST',
      body,
    });
  }

  generateVideo(body) {
    return this.request('/api/mcp/generate-video', {
      method: 'POST',
      body,
    });
  }

  getGeneratedVideo(taskId) {
    return this.request('/api/mcp/generate-video', {
      method: 'GET',
      query: { taskId },
    });
  }

  handoff(body) {
    return this.request('/api/mcp/interviews/handoff', {
      method: 'POST',
      body: { ...body, origin: 'openclaw' },
    });
  }

  processInterview(body) {
    return this.request('/api/mcp/interviews/process', {
      method: 'POST',
      body,
    });
  }

  createCustomEdit(body) {
    return this.request('/api/mcp/interviews/custom-edit', {
      method: 'POST',
      body,
    });
  }

  getCustomEdit(resultId) {
    return this.request('/api/mcp/interviews/custom-edit', {
      method: 'GET',
      query: { resultId },
    });
  }

  requestRender(body) {
    return this.request('/api/mcp/renders/request', {
      method: 'POST',
      body,
    });
  }

  downloadRender(body) {
    return this.request('/api/mcp/renders/download', {
      method: 'POST',
      body,
    });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function selectHook(hooksResponse, hookIndex) {
  const hookItems = firstArray(hooksResponse, ['hookItems', 'data.hookItems', 'items']);
  if (!hookItems.length) {
    throw new Error('Hook creation succeeded but returned no hook items');
  }
  if (hookIndex < 0 || hookIndex >= hookItems.length) {
    throw new Error(`hook index ${hookIndex} out of range (0-${hookItems.length - 1})`);
  }
  return { hookItems, selectedHook: hookItems[hookIndex] };
}

function extractScriptId(scriptResponse) {
  return firstString(scriptResponse, [
    'scriptId',
    'id',
    'script.id',
    'data.scriptId',
    'data.id',
  ]);
}

function extractRecordingLink(recordingResponse) {
  return firstString(recordingResponse, [
    'magicLink',
    'recordingLink',
    'url',
    'data.magicLink',
    'data.url',
  ]);
}

function extractHandoffResultIds(handoffResponse) {
  const ids = uniqueNonEmpty([
    firstString(handoffResponse, ['interviewResultId', 'resultId', 'data.interviewResultId']),
    ...firstArray(handoffResponse, ['interviewResultIds', 'resultIds', 'data.resultIds']).map(String),
  ]);

  const finalDestination = firstString(handoffResponse, ['finalDestination']);
  if (finalDestination) {
    try {
      const url = new URL(finalDestination, HUMEO_BASE_URL);
      const resultId = url.searchParams.get('resultId');
      if (resultId) ids.push(resultId);
    } catch {
      // ignore parse errors
    }
  }

  return uniqueNonEmpty(ids);
}

function loadRunArtifact(runFile) {
  return readJson(resolve(ROOT, runFile));
}

function deriveWatchTarget(args, runArtifact) {
  const scriptId = args['script-id'] || runArtifact?.script?.scriptId || runArtifact?.script?.id || runArtifact?.watch?.scriptId || null;
  const interviewId = args['interview-id'] || runArtifact?.watch?.canonicalInterviewId || runArtifact?.recording?.interviewId || null;
  const hookItemId = args['hook-item-id'] || runArtifact?.selectedHook?.id || null;
  return { scriptId, interviewId, hookItemId };
}

async function watchHandoff({ client, target, pollSeconds, timeoutMinutes, verbose }) {
  const startedAt = Date.now();
  const timeoutMs = timeoutMinutes * 60 * 1000;
  let processTriggered = false;
  let lastSnapshot = null;

  while (Date.now() - startedAt < timeoutMs) {
    const requestBody = target.interviewId
      ? { interviewId: target.interviewId }
      : target.scriptId
        ? { scriptId: target.scriptId }
        : target.hookItemId
          ? { hookItemId: target.hookItemId }
          : null;

    if (!requestBody) {
      throw new Error('watch requires an interviewId, scriptId, or hookItemId');
    }

    const handoff = await client.handoff(requestBody);
    const canonicalInterviewId = firstString(handoff, ['canonicalInterviewId', 'interviewId']) || target.interviewId || null;
    const processingState = firstString(handoff, ['processingState', 'status']) || 'unknown';
    const failureReason = firstString(handoff, ['failureReason', 'error']) || null;
    const handoffUrl = firstString(handoff, ['handoffUrl']) || null;
    const resultIds = extractHandoffResultIds(handoff);

    if (canonicalInterviewId) {
      target.interviewId = canonicalInterviewId;
    }

    lastSnapshot = {
      checkedAt: new Date().toISOString(),
      canonicalInterviewId,
      processingState,
      handoffReady: Boolean(handoff?.handoffReady),
      handoffUrl,
      resultIds,
      failureReason,
      raw: handoff,
    };

    if (handoff?.handoffReady) {
      return {
        finalStatus: processingState || 'ready',
        timedOut: false,
        ...lastSnapshot,
      };
    }

    if (processingState === 'uploaded' && !processTriggered) {
      try {
        await client.processInterview(target.interviewId ? { interviewId: target.interviewId } : requestBody);
        processTriggered = true;
      } catch (error) {
        if (verbose) {
          console.error(`[videoclaw] process trigger skipped: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    if (['failed', 'error'].includes(processingState) || failureReason) {
      return {
        finalStatus: 'failed',
        timedOut: false,
        ...lastSnapshot,
      };
    }

    await sleep(pollSeconds * 1000);
  }

  return {
    finalStatus: 'timeout',
    timedOut: true,
    ...(lastSnapshot || {
      checkedAt: new Date().toISOString(),
      canonicalInterviewId: target.interviewId || null,
      processingState: 'timeout',
      handoffReady: false,
      handoffUrl: null,
      resultIds: [],
      failureReason: null,
      raw: null,
    }),
  };
}

async function waitForGeneratedVideo({ client, taskId, pollSeconds, timeoutMinutes }) {
  const startedAt = Date.now();
  const timeoutMs = timeoutMinutes * 60 * 1000;
  let lastTask = null;

  while (Date.now() - startedAt < timeoutMs) {
    const response = await client.getGeneratedVideo(taskId);
    const task = response?.task || response;
    lastTask = task;
    const status = firstString(task, ['status']) || 'unknown';
    if (status === 'succeeded' || status === 'failed') {
      return {
        timedOut: false,
        task,
      };
    }
    await sleep(pollSeconds * 1000);
  }

  return {
    timedOut: true,
    task: lastTask,
  };
}

function normalizeArgs(values) {
  return {
    ...values,
    'scene-limit': Number(values['scene-limit'] || 12),
    'motifs-per-video': Number(values['motifs-per-video'] || 3),
    duration: Number(values.duration || 45),
    'hook-index': Number(values['hook-index'] || 0),
    'poll-seconds': Number(values['poll-seconds'] || DEFAULT_POLL_SECONDS),
    'timeout-minutes': Number(values['timeout-minutes'] || DEFAULT_TIMEOUT_MINUTES),
  };
}

async function runPack(args) {
  const outputDir = resolve(ROOT, args['output-dir'] || DEFAULT_OUTPUT_DIR);
  ensureDir(outputDir);
  const briefText = loadBrief(args);
  const pack = buildReferencePack({
    clustersPath: resolve(ROOT, args['clusters-file'] || DEFAULT_CLUSTERS_PATH),
    transcriptsPath: resolve(ROOT, args['transcripts-file'] || DEFAULT_TRANSCRIPTS_PATH),
    sourcesPath: resolve(ROOT, args['sources-file'] || DEFAULT_SOURCES_PATH),
    briefText,
    sceneLimit: args['scene-limit'],
    motifsPerVideo: args['motifs-per-video'],
  });

  const { latestPath } = saveArtifact(outputDir, 'reference-pack.json', pack);
  const summaryText = [
    `Reference pack generated: ${pack.summary.totalVideos} videos, ${pack.summary.totalScenes} scenes, ${pack.summary.totalLocalMotifs} local motifs.`,
    '',
    'Top motifs:',
    ...pack.topMotifs.map((motif, index) => `${index + 1}. ${motif.author ? `@${motif.author}` : motif.videoId} | ${motif.occurrenceCount}x | ${truncate(motif.transcript, 100)}`),
  ].join('\n');
  saveArtifact(outputDir, 'reference-pack.txt', summaryText);

  console.log(JSON.stringify({
    ok: true,
    referencePackPath: latestPath,
    summary: pack.summary,
    topMotifs: pack.topMotifs.slice(0, 5),
  }, null, 2));
}

async function runAutoflow(args) {
  const outputDir = resolve(ROOT, args['output-dir'] || DEFAULT_OUTPUT_DIR);
  ensureDir(outputDir);

  const briefText = loadBrief(args);
  const pack = buildReferencePack({
    clustersPath: resolve(ROOT, args['clusters-file'] || DEFAULT_CLUSTERS_PATH),
    transcriptsPath: resolve(ROOT, args['transcripts-file'] || DEFAULT_TRANSCRIPTS_PATH),
    sourcesPath: resolve(ROOT, args['sources-file'] || DEFAULT_SOURCES_PATH),
    briefText,
    sceneLimit: args['scene-limit'],
    motifsPerVideo: args['motifs-per-video'],
  });

  const packArtifact = saveArtifact(outputDir, 'reference-pack.json', pack);
  const client = args['dry-run'] ? null : new HumeoClient({ token: loadToken(), verbose: Boolean(args.verbose) });

  const runRecord = {
    createdAt: new Date().toISOString(),
    topic: args.topic || 'Tong creator video from clustered reference set',
    options: {
      duration: args.duration,
      tone: args.tone || null,
      audience: args.audience || null,
      cta: args.cta || null,
      hookIndex: args['hook-index'],
      research: Boolean(args.research),
      researchDepth: args['research-depth'] || 'standard',
      dryRun: Boolean(args['dry-run']),
    },
    referencePackPath: packArtifact.latestPath,
    productContext: briefText,
    auth: null,
    research: null,
    hooks: null,
    selectedHook: null,
    script: null,
    recording: null,
    watch: null,
  };

  const hookPrompt = buildHookPrompt({
    briefText,
    pack,
    research: null,
  });
  const hookPromptArtifact = saveArtifact(outputDir, 'hook-prompt.txt', hookPrompt);

  if (args['dry-run']) {
    const scriptPrompt = buildScriptPrompt({
      briefText,
      pack,
      selectedHook: null,
      durationSeconds: args.duration,
      tone: args.tone,
      audience: args.audience,
      callToAction: args.cta,
    });
    const scriptPromptArtifact = saveArtifact(outputDir, 'script-prompt.txt', scriptPrompt);
    const runArtifact = saveArtifact(outputDir, 'run.json', {
      ...runRecord,
      hookPromptPath: hookPromptArtifact.latestPath,
      scriptPromptPath: scriptPromptArtifact.latestPath,
    });
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      referencePackPath: packArtifact.latestPath,
      hookPromptPath: hookPromptArtifact.latestPath,
      scriptPromptPath: scriptPromptArtifact.latestPath,
      runPath: runArtifact.latestPath,
    }, null, 2));
    return;
  }

  runRecord.auth = await client.status();

  if (args.research) {
    runRecord.research = await client.research(args.topic || 'Tong short-form language learning creator video', args['research-depth'] || 'standard');
  }

  const finalHookPrompt = buildHookPrompt({
    briefText,
    pack,
    research: runRecord.research,
  });
  saveArtifact(outputDir, 'hook-prompt.txt', finalHookPrompt);
  runRecord.hooks = await client.createHooks(finalHookPrompt);

  const { hookItems, selectedHook } = selectHook(runRecord.hooks, args['hook-index']);
  runRecord.selectedHook = selectedHook;

  const scriptPrompt = buildScriptPrompt({
    briefText,
    pack,
    selectedHook,
    durationSeconds: args.duration,
    tone: args.tone,
    audience: args.audience,
    callToAction: args.cta,
  });
  const scriptPromptArtifact = saveArtifact(outputDir, 'script-prompt.txt', scriptPrompt);
  const fallbackScriptText = buildFallbackScriptText({
    briefText,
    selectedHook,
    pack,
    callToAction: args.cta,
  });

  const scriptCreation = await createScriptWithFallback({
    client,
    primaryPayload: {
      prompt: scriptPrompt,
      title: truncate(args.topic || selectedHook?.title || 'Tong creator script', 90),
      durationSeconds: args.duration,
      tone: args.tone || undefined,
      audience: args.audience || undefined,
      callToAction: args.cta || undefined,
      hookItemId: selectedHook?.id || undefined,
      hookText: selectedHook?.title || undefined,
      transcriptText: pack.promptInputs.continuityTranscript,
    },
    fallbackPayload: {
      scriptText: fallbackScriptText,
      title: truncate(args.topic || selectedHook?.title || 'Tong creator script', 90),
      durationSeconds: args.duration,
      tone: args.tone || undefined,
      audience: args.audience || undefined,
      callToAction: args.cta || undefined,
      hookItemId: selectedHook?.id || undefined,
      hookText: selectedHook?.title || undefined,
      transcriptText: pack.promptInputs.continuityTranscript,
    },
  });

  runRecord.script = {
    ...scriptCreation.response,
    creationMode: scriptCreation.usedFallback ? 'fallback_script_text' : 'prompt_generation',
    primaryError: scriptCreation.primaryError,
  };
  if (scriptCreation.usedFallback) {
    const fallbackArtifact = saveArtifact(outputDir, 'fallback-script.txt', fallbackScriptText);
    runRecord.script.fallbackScriptPath = fallbackArtifact.latestPath;
  }

  const scriptId = extractScriptId(runRecord.script);
  if (!scriptId) {
    throw new Error('Script creation succeeded but returned no scriptId');
  }

  runRecord.script.scriptId = scriptId;
  runRecord.recording = await client.createRecordingLink({
    mode: 'teleprompter',
    scriptId,
  });
  runRecord.recording.scriptId = scriptId;
  const magicLink = extractRecordingLink(runRecord.recording);
  runRecord.recording.magicLink = magicLink;
  runRecord.recording.magicLinkRedacted = magicLink ? redactSensitiveUrl(magicLink) : null;
  if (magicLink) {
    const secretLink = saveSecretText(outputDir, 'recording-link', magicLink);
    runRecord.recording.magicLinkSecretPath = secretLink.latestPath;
  }

  if (args.watch) {
    runRecord.watch = await watchHandoff({
      client,
      target: { scriptId, interviewId: null, hookItemId: selectedHook?.id || null },
      pollSeconds: args['poll-seconds'],
      timeoutMinutes: args['timeout-minutes'],
      verbose: Boolean(args.verbose),
    });
  }

  const runArtifact = saveArtifact(outputDir, 'run.json', {
    ...runRecord,
    hookPromptPath: hookPromptArtifact.latestPath,
    scriptPromptPath: scriptPromptArtifact.latestPath,
    hookCount: hookItems.length,
  });

  console.log(JSON.stringify({
    ok: true,
    runPath: runArtifact.latestPath,
    referencePackPath: packArtifact.latestPath,
    selectedHook: selectedHook ? {
      id: selectedHook.id || null,
      title: selectedHook.title || null,
      description: selectedHook.description || null,
    } : null,
    scriptId,
    scriptMode: runRecord.script.creationMode,
    magicLink: runRecord.recording.magicLinkRedacted || null,
    recordingLinkPath: runRecord.recording.magicLinkSecretPath || null,
    watch: runRecord.watch
      ? {
          status: runRecord.watch.finalStatus,
          interviewId: runRecord.watch.canonicalInterviewId,
          resultIds: runRecord.watch.resultIds,
          handoffUrl: runRecord.watch.handoffUrl ? redactSensitiveUrl(runRecord.watch.handoffUrl) : null,
        }
      : null,
  }, null, 2));
}

async function runRecreate(args) {
  const outputDir = resolve(ROOT, args['output-dir'] || DEFAULT_OUTPUT_DIR);
  ensureDir(outputDir);

  const briefText = loadBrief(args);
  const pack = buildReferencePack({
    clustersPath: resolve(ROOT, args['clusters-file'] || DEFAULT_CLUSTERS_PATH),
    transcriptsPath: resolve(ROOT, args['transcripts-file'] || DEFAULT_TRANSCRIPTS_PATH),
    sourcesPath: resolve(ROOT, args['sources-file'] || DEFAULT_SOURCES_PATH),
    briefText,
    sceneLimit: args['scene-limit'],
    motifsPerVideo: args['motifs-per-video'],
  });

  const packArtifact = saveArtifact(outputDir, 'reference-pack.json', pack);
  const { motif, video } = selectRecreationTarget(pack, args);
  const prompts = buildRecreationPrompt({
    briefText,
    motif,
    video,
    durationSeconds: args.duration,
  });
  const imagePromptArtifact = saveArtifact(outputDir, 'recreate-image-prompt.txt', prompts.imagePrompt);
  const videoPromptArtifact = saveArtifact(outputDir, 'recreate-video-prompt.txt', prompts.videoPrompt);

  const result = {
    createdAt: new Date().toISOString(),
    referencePackPath: packArtifact.latestPath,
    motif,
    videoId: video?.videoId || motif.videoId || null,
    imagePromptPath: imagePromptArtifact.latestPath,
    videoPromptPath: videoPromptArtifact.latestPath,
    image: null,
    videoTask: null,
    videoResult: null,
  };

  if (args['dry-run']) {
    const artifact = saveArtifact(outputDir, 'recreate.json', result);
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      recreatePath: artifact.latestPath,
      motifId: motif.localMotifId,
      imagePromptPath: imagePromptArtifact.latestPath,
      videoPromptPath: videoPromptArtifact.latestPath,
    }, null, 2));
    return;
  }

  const client = new HumeoClient({ token: loadToken(), verbose: Boolean(args.verbose) });
  let referenceImageUrl = args['reference-image-url'] || null;

  if (!referenceImageUrl) {
    try {
      result.image = await generateImageWithRetry(client, {
        prompt: prompts.imagePrompt,
        size: '2K',
        watermark: false,
      });
      referenceImageUrl = firstString(result.image, ['image.url', 'url']);
    } catch (error) {
      result.imageError = error instanceof Error ? error.message : String(error);
    }
  }

  result.videoTask = await client.generateVideo({
    prompt: prompts.videoPrompt,
    duration: Math.max(4, Math.min(12, args.duration || 5)),
    cameraFixed: Boolean(args['camera-fixed']),
    referenceImageUrl: referenceImageUrl || undefined,
  });

  const taskId = firstString(result.videoTask, ['task.taskId', 'taskId']);
  if (!taskId) {
    throw new Error('generate-video succeeded but returned no taskId');
  }
  result.videoTask.taskId = taskId;
  result.referenceImageUrl = referenceImageUrl;

  if (args.wait) {
    result.videoResult = await waitForGeneratedVideo({
      client,
      taskId,
      pollSeconds: args['poll-seconds'],
      timeoutMinutes: args['timeout-minutes'],
    });
  }

  const artifact = saveArtifact(outputDir, 'recreate.json', result);
  const videoUrl = firstString(result.videoResult, ['task.videoUrl', 'videoUrl']);
  console.log(JSON.stringify({
    ok: true,
    recreatePath: artifact.latestPath,
    motifId: motif.localMotifId,
    referenceImageUrl,
    taskId,
    status: firstString(result.videoResult, ['task.status']) || firstString(result.videoTask, ['task.status']) || 'queued',
    videoUrl: videoUrl || null,
  }, null, 2));
}

async function runWatch(args) {
  const outputDir = resolve(ROOT, args['output-dir'] || DEFAULT_OUTPUT_DIR);
  ensureDir(outputDir);
  const runArtifact = args['run-file'] ? loadRunArtifact(args['run-file']) : null;
  const client = new HumeoClient({ token: loadToken(), verbose: Boolean(args.verbose) });
  const target = deriveWatchTarget(args, runArtifact);
  const watchResult = await watchHandoff({
    client,
    target,
    pollSeconds: args['poll-seconds'],
    timeoutMinutes: args['timeout-minutes'],
    verbose: Boolean(args.verbose),
  });
  if (watchResult.handoffUrl) {
    const secretLink = saveSecretText(outputDir, 'handoff-link', watchResult.handoffUrl);
    watchResult.handoffUrlSecretPath = secretLink.latestPath;
  }

  const result = {
    createdAt: new Date().toISOString(),
    target,
    watch: watchResult,
  };
  const artifact = saveArtifact(outputDir, 'watch.json', result);

  console.log(JSON.stringify({
    ok: true,
    watchPath: artifact.latestPath,
    status: watchResult.finalStatus,
    interviewId: watchResult.canonicalInterviewId,
    resultIds: watchResult.resultIds,
    handoffUrl: watchResult.handoffUrl ? redactSensitiveUrl(watchResult.handoffUrl) : null,
    handoffUrlPath: watchResult.handoffUrlSecretPath || null,
  }, null, 2));
}

async function runCustomEdit(args) {
  const outputDir = resolve(ROOT, args['output-dir'] || DEFAULT_OUTPUT_DIR);
  ensureDir(outputDir);
  const runArtifact = args['run-file'] ? loadRunArtifact(args['run-file']) : null;
  const interviewId = args['interview-id']
    || runArtifact?.watch?.canonicalInterviewId
    || runArtifact?.recording?.interviewId
    || null;

  if (!interviewId) {
    throw new Error('custom-edit requires --interview-id or a run file with a resolved interview ID');
  }

  if (!args['edit-prompt'] && !args.preset) {
    throw new Error('custom-edit requires --edit-prompt, --preset, or both');
  }

  const client = new HumeoClient({ token: loadToken(), verbose: Boolean(args.verbose) });
  const editResponse = await client.createCustomEdit({
    interviewId,
    prompt: args['edit-prompt'] || undefined,
    presetKey: args.preset || undefined,
  });

  const interviewResultId = firstString(editResponse, ['interviewResultId', 'resultId', 'data.interviewResultId']);
  const result = {
    createdAt: new Date().toISOString(),
    interviewId,
    prompt: args['edit-prompt'] || null,
    preset: args.preset || null,
    response: editResponse,
    interviewResultId,
  };

  if (args.wait && interviewResultId) {
    while (true) {
      const poll = await client.getCustomEdit(interviewResultId);
      result.poll = poll;
      const status = firstString(poll, ['status', 'processingState']) || 'unknown';
      if (status === 'ready' || status === 'failed') break;
      await sleep(args['poll-seconds'] * 1000);
    }
  }

  const artifact = saveArtifact(outputDir, 'custom-edit.json', result);
  console.log(JSON.stringify({
    ok: true,
    customEditPath: artifact.latestPath,
    interviewId,
    interviewResultId,
    status: firstString(result.poll, ['status']) || firstString(editResponse, ['status']) || 'processing',
  }, null, 2));
}

async function runRender(args) {
  const outputDir = resolve(ROOT, args['output-dir'] || DEFAULT_OUTPUT_DIR);
  ensureDir(outputDir);
  const runArtifact = args['run-file'] ? loadRunArtifact(args['run-file']) : null;
  const interviewResultId = args['result-id']
    || runArtifact?.interviewResultId
    || runArtifact?.response?.interviewResultId
    || runArtifact?.watch?.resultIds?.[0]
    || null;

  if (!interviewResultId) {
    throw new Error('render requires --result-id or a run/custom-edit artifact with an interview result ID');
  }

  const client = new HumeoClient({ token: loadToken(), verbose: Boolean(args.verbose) });
  const renderRequest = {
    interviewResultId,
    themeId: args.theme || DEFAULT_THEME_ID,
    renderProfile: args['render-profile'] || DEFAULT_RENDER_PROFILE,
  };

  const renderResponse = await client.requestRender(renderRequest);
  let download = null;

  if (args.wait) {
    while (true) {
      try {
        download = await client.downloadRender(renderRequest);
        if (download?.url) break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('(409)')) throw error;
      }
      await sleep(args['poll-seconds'] * 1000);
    }
  }

  const result = {
    createdAt: new Date().toISOString(),
    renderRequest,
    renderResponse,
    download,
  };
  const artifact = saveArtifact(outputDir, 'render.json', result);
  console.log(JSON.stringify({
    ok: true,
    renderPath: artifact.latestPath,
    interviewResultId,
    queued: true,
    downloadUrl: download?.url || null,
  }, null, 2));
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    strict: false,
    options: {
      brief: { type: 'string' },
      'brief-file': { type: 'string' },
      'clusters-file': { type: 'string' },
      'transcripts-file': { type: 'string' },
      'sources-file': { type: 'string' },
      'output-dir': { type: 'string' },
      'scene-limit': { type: 'string', default: '12' },
      'motifs-per-video': { type: 'string', default: '3' },
      topic: { type: 'string' },
      research: { type: 'boolean', default: false },
      'research-depth': { type: 'string', default: 'standard' },
      duration: { type: 'string', default: '8' },
      tone: { type: 'string' },
      audience: { type: 'string' },
      cta: { type: 'string' },
      'hook-index': { type: 'string', default: '0' },
      'motif-id': { type: 'string' },
      'video-id': { type: 'string' },
      'reference-image-url': { type: 'string' },
      'camera-fixed': { type: 'boolean', default: false },
      watch: { type: 'boolean', default: false },
      'poll-seconds': { type: 'string', default: String(DEFAULT_POLL_SECONDS) },
      'timeout-minutes': { type: 'string', default: String(DEFAULT_TIMEOUT_MINUTES) },
      'run-file': { type: 'string' },
      'script-id': { type: 'string' },
      'interview-id': { type: 'string' },
      'hook-item-id': { type: 'string' },
      'result-id': { type: 'string' },
      'edit-prompt': { type: 'string' },
      preset: { type: 'string' },
      theme: { type: 'string', default: DEFAULT_THEME_ID },
      'render-profile': { type: 'string', default: DEFAULT_RENDER_PROFILE },
      wait: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      verbose: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });

  const command = positionals[0];
  const args = normalizeArgs(values);

  if (args.help || !command) {
    printHelp();
    return;
  }

  if (command === 'pack') {
    await runPack(args);
    return;
  }

  if (command === 'run') {
    throw new Error('recording-based Humeo flow is disabled; use `recreate` instead');
  }

  if (command === 'recreate') {
    await runRecreate(args);
    return;
  }

  if (command === 'watch') {
    throw new Error('recording-based Humeo flow is disabled; use `recreate --wait` instead');
  }

  if (command === 'custom-edit') {
    throw new Error('recording-based Humeo flow is disabled; use `recreate` instead');
  }

  if (command === 'render') {
    throw new Error('recording-based Humeo flow is disabled; use `recreate` instead');
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
