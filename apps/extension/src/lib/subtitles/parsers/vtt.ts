import type { SubtitleCue } from '@tong/core';
import { parseTimestamp } from '@tong/core';

/**
 * Parse WebVTT subtitle format
 * @see https://developer.mozilla.org/en-US/docs/Web/API/WebVTT_API
 */
export function parseVTT(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const lines = content.split(/\r?\n/);

  let currentCue: Partial<SubtitleCue> | null = null;
  let cueIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip WEBVTT header and empty lines
    if (line === 'WEBVTT' || line.startsWith('NOTE') || line === '') {
      if (currentCue && currentCue.text) {
        cues.push(currentCue as SubtitleCue);
        currentCue = null;
      }
      continue;
    }

    // Skip style and region blocks
    if (line.startsWith('STYLE') || line.startsWith('REGION')) {
      // Skip until empty line
      while (i < lines.length && lines[i].trim() !== '') {
        i++;
      }
      continue;
    }

    // Check for timestamp line (contains -->)
    if (line.includes('-->')) {
      const [startStr, rest] = line.split('-->').map((s) => s.trim());
      const endStr = rest.split(' ')[0]; // Remove any cue settings

      currentCue = {
        id: `cue-${cueIndex++}`,
        startTime: parseTimestamp(startStr),
        endTime: parseTimestamp(endStr),
        text: '',
      };
    } else if (currentCue) {
      // This is cue text
      if (currentCue.text) {
        currentCue.text += '\n' + stripVTTTags(line);
      } else {
        currentCue.text = stripVTTTags(line);
      }
    } else if (/^\d+$/.test(line) || /^[a-zA-Z0-9_-]+$/.test(line)) {
      // This might be a cue identifier, skip it
      // The next line should be the timestamp
    }
  }

  // Don't forget the last cue
  if (currentCue && currentCue.text) {
    cues.push(currentCue as SubtitleCue);
  }

  return cues;
}

/**
 * Strip VTT formatting tags from text
 */
function stripVTTTags(text: string): string {
  return text
    .replace(/<[^>]+>/g, '') // Remove tags like <c.yellow>
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Format subtitles as VTT
 */
export function formatVTT(cues: SubtitleCue[]): string {
  let output = 'WEBVTT\n\n';

  for (const cue of cues) {
    const startTime = formatVTTTimestamp(cue.startTime);
    const endTime = formatVTTTimestamp(cue.endTime);

    output += `${cue.id}\n`;
    output += `${startTime} --> ${endTime}\n`;
    output += `${cue.text}\n\n`;
  }

  return output;
}

/**
 * Format milliseconds as VTT timestamp (HH:MM:SS.mmm)
 */
function formatVTTTimestamp(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}
