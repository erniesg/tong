// Line audio for evals: one interface, two backends.
//   play({ song, line, text }) → Promise<{ ok, via }> resolves when the line has finished.
// Today: browser speechSynthesis (ko-KR). Later: the recorded song plus a line timing map
// (docs/seoul-songs.md: start/end ms per line) via createSongAudio, with no change to the rounds.

const clean = (t) => String(t ?? '').replace(/[…"“”~]/g, ' ').replace(/[^\p{Script=Hangul}\p{L}\p{N}\s,.!?]/gu, '').trim();

export function createTtsAudio({ rate = 0.85, isMuted = () => false } = {}) {
  const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  const pickVoice = () => synth?.getVoices().find((v) => v.lang?.toLowerCase().startsWith('ko')) ?? null;
  return {
    kind: 'tts',
    /** True when a Korean voice exists; tier 2 "audio only" falls back to text when it doesn't. */
    available: () => !!pickVoice(),
    play({ text } = {}) {
      const words = clean(text);
      const voice = pickVoice();
      if (!synth || !voice || !words || isMuted()) return Promise.resolve({ ok: false, via: 'tts' });
      return new Promise((resolve) => {
        const u = new SpeechSynthesisUtterance(words);
        u.voice = voice;
        u.lang = voice.lang || 'ko-KR';
        u.rate = rate;
        const done = (ok) => { clearTimeout(timer); resolve({ ok, via: 'tts' }); };
        const timer = setTimeout(() => done(true), 1200 + words.length * 260);
        u.onend = () => done(true);
        u.onerror = () => done(false);
        synth.cancel();
        synth.speak(u);
      });
    },
    stop: () => synth?.cancel(),
  };
}

/**
 * Recorded song + timing map: { [lineId]: [startMs, endMs] }. Lines without a timing
 * (calls, interview questions) fall through to `fallback` (normally the TTS backend).
 */
export function createSongAudio({ src, timing, fallback }) {
  const el = typeof Audio !== 'undefined' ? new Audio(src) : null;
  let stopTimer = null;
  return {
    kind: 'song',
    available: () => !!el,
    play(req = {}) {
      const span = req.line && timing?.[req.line];
      if (!el || !span) return fallback ? fallback.play(req) : Promise.resolve({ ok: false, via: 'song' });
      const [start, end] = span;
      return new Promise((resolve) => {
        clearTimeout(stopTimer);
        el.currentTime = start / 1000;
        el.play().catch(() => resolve({ ok: false, via: 'song' }));
        stopTimer = setTimeout(() => { el.pause(); resolve({ ok: true, via: 'song' }); }, end - start);
      });
    },
    stop() { clearTimeout(stopTimer); el?.pause(); fallback?.stop(); },
  };
}
