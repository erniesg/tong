import type { SubtitleCue } from '@tong/core';
import { parseTimestamp } from '@tong/core';

/**
 * Parse SRT subtitle format
 */
export function parseSRT(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const blocks = content.trim().split(/\r?\n\r?\n/);

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    if (lines.length < 2) continue;

    let lineIndex = 0;

    // First line might be the cue number
    const firstLine = lines[lineIndex].trim();
    let cueNumber = '';

    if (/^\d+$/.test(firstLine)) {
      cueNumber = firstLine;
      lineIndex++;
    }

    if (lineIndex >= lines.length) continue;

    // Next line should be the timestamp
    const timestampLine = lines[lineIndex].trim();
    const timestampMatch = timestampLine.match(
      /(\d{2}:\d{2}:\d{2}[,.:]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.:]\d{3})/
    );

    if (!timestampMatch) continue;

    const startTime = parseTimestamp(timestampMatch[1]);
    const endTime = parseTimestamp(timestampMatch[2]);
    lineIndex++;

    // Remaining lines are the text
    const textLines = lines.slice(lineIndex).filter((l) => l.trim() !== '');
    const text = stripSRTTags(textLines.join('\n'));

    if (text) {
      cues.push({
        id: cueNumber || `cue-${cues.length}`,
        startTime,
        endTime,
        text,
      });
    }
  }

  return cues;
}

/**
 * Strip SRT formatting tags from text
 */
function stripSRTTags(text: string): string {
  return text
    .replace(/<[^>]+>/g, '') // Remove HTML-like tags
    .replace(/\{[^}]+\}/g, '') // Remove SSA-style tags
    .replace(/\\N/g, '\n') // Convert \N to newline
    .trim();
}

/**
 * Format subtitles as SRT
 */
export function formatSRT(cues: SubtitleCue[]): string {
  let output = '';

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    const startTime = formatSRTTimestamp(cue.startTime);
    const endTime = formatSRTTimestamp(cue.endTime);

    output += `${i + 1}\n`;
    output += `${startTime} --> ${endTime}\n`;
    output += `${cue.text}\n\n`;
  }

  return output;
}

/**
 * Format milliseconds as SRT timestamp (HH:MM:SS,mmm)
 */
function formatSRTTimestamp(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}
