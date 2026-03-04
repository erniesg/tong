import type { SubtitleCue } from '@tong/core';

/**
 * Parse ASS/SSA subtitle format
 * @see https://en.wikipedia.org/wiki/SubStation_Alpha
 */
export function parseASS(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const lines = content.split(/\r?\n/);

  let inEvents = false;
  let formatOrder: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for Events section
    if (trimmed === '[Events]') {
      inEvents = true;
      continue;
    }

    // Check for other sections (exit Events)
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      inEvents = false;
      continue;
    }

    if (!inEvents) continue;

    // Parse Format line to get column order
    if (trimmed.startsWith('Format:')) {
      const formatStr = trimmed.substring(7).trim();
      formatOrder = formatStr.split(',').map((s) => s.trim().toLowerCase());
      continue;
    }

    // Parse Dialogue lines
    if (trimmed.startsWith('Dialogue:')) {
      const dataStr = trimmed.substring(9).trim();
      const data = parseASSLine(dataStr, formatOrder.length);

      if (data.length < formatOrder.length) continue;

      const getValue = (key: string): string => {
        const index = formatOrder.indexOf(key);
        return index >= 0 ? data[index] : '';
      };

      const startStr = getValue('start');
      const endStr = getValue('end');
      const text = getValue('text');

      if (startStr && endStr && text) {
        cues.push({
          id: `cue-${cues.length}`,
          startTime: parseASSTimestamp(startStr),
          endTime: parseASSTimestamp(endStr),
          text: stripASSTags(text),
        });
      }
    }
  }

  return cues;
}

/**
 * Parse ASS line respecting the fact that Text field may contain commas
 */
function parseASSLine(line: string, expectedFields: number): string[] {
  const result: string[] = [];
  let current = '';
  let fieldCount = 0;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    // If we've reached all fields except the last (Text), take the rest as-is
    if (fieldCount === expectedFields - 1) {
      result.push(line.substring(i));
      break;
    }

    if (char === ',') {
      result.push(current.trim());
      current = '';
      fieldCount++;
    } else {
      current += char;
    }
  }

  // Add last field if not already added
  if (fieldCount < expectedFields - 1 && current) {
    result.push(current.trim());
  }

  return result;
}

/**
 * Parse ASS timestamp (H:MM:SS.cc)
 */
function parseASSTimestamp(timestamp: string): number {
  const match = timestamp.match(/(\d+):(\d{2}):(\d{2})\.(\d{2})/);
  if (!match) return 0;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const centiseconds = parseInt(match[4], 10);

  return (hours * 3600 + minutes * 60 + seconds) * 1000 + centiseconds * 10;
}

/**
 * Strip ASS formatting tags from text
 */
function stripASSTags(text: string): string {
  return text
    .replace(/\{[^}]*\}/g, '') // Remove override tags like {\pos(x,y)}
    .replace(/\\N/g, '\n') // Convert \N to newline
    .replace(/\\n/g, '\n') // Convert \n to newline
    .replace(/\\h/g, ' ') // Convert \h to space
    .trim();
}

/**
 * Format subtitles as ASS
 */
export function formatASS(cues: SubtitleCue[]): string {
  let output = `[Script Info]
Title: Tong Subtitles
ScriptType: v4.00+
Collisions: Normal
PlayDepth: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  for (const cue of cues) {
    const startTime = formatASSTimestamp(cue.startTime);
    const endTime = formatASSTimestamp(cue.endTime);
    const text = cue.text.replace(/\n/g, '\\N');

    output += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${text}\n`;
  }

  return output;
}

/**
 * Format milliseconds as ASS timestamp (H:MM:SS.cc)
 */
function formatASSTimestamp(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);

  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}
