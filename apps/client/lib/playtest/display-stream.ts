/**
 * Hands a getDisplayMedia stream from the /playtest entry page (where the
 * user gesture happens) to the PlaytestOverlay on /game. Survives the SPA
 * navigation because module state persists across route changes.
 */
let pendingStream: MediaStream | null = null;

export function setDisplayStream(stream: MediaStream): void {
  pendingStream = stream;
}

export function takeDisplayStream(): MediaStream | null {
  const stream = pendingStream;
  pendingStream = null;
  if (!stream) return null;
  const live = stream.getVideoTracks().some((t) => t.readyState === 'live');
  if (!live) {
    stream.getTracks().forEach((t) => t.stop());
    return null;
  }
  return stream;
}
