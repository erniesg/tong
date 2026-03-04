import type { SubtitleCue, SubtitleFormat } from '@tong/core';
import { parseVTT } from './vtt';
import { parseSRT } from './srt';
import { parseASS } from './ass';

/**
 * Detect subtitle format from content
 */
export function detectFormat(content: string): SubtitleFormat {
  const trimmed = content.trim();

  // VTT starts with WEBVTT
  if (trimmed.startsWith('WEBVTT')) {
    return 'vtt';
  }

  // ASS/SSA starts with [Script Info]
  if (trimmed.includes('[Script Info]') || trimmed.includes('[V4+ Styles]')) {
    return 'ass';
  }

  // SRT has numbered entries with --> timestamps
  if (/^\d+\r?\n\d{2}:\d{2}:\d{2}[,.:]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.:]\d{3}/m.test(trimmed)) {
    return 'srt';
  }

  // Default to VTT (most common for web)
  return 'vtt';
}

/**
 * Parse subtitles from any supported format
 */
export function parseSubtitles(content: string, format?: SubtitleFormat): SubtitleCue[] {
  const detectedFormat = format || detectFormat(content);

  switch (detectedFormat) {
    case 'vtt':
      return parseVTT(content);
    case 'srt':
      return parseSRT(content);
    case 'ass':
    case 'ssa':
      return parseASS(content);
    default:
      return parseVTT(content);
  }
}
