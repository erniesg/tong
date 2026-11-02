// The 한글 X/24 tracker (docs/seoul-day1.md): which of the 24 basic letters the
// player has met, counted from the words they actually rebuilt. Scenes record a
// word with a `hangul:<word>` story flag; read signs count too.

export const BASIC = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ';
const LEAD = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const VOWEL = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const TAIL = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

/** The basic letters in a word, in reading order, each once. Doubled and combined letters aren't counted. */
export function basicLetters(word) {
  const out = [];
  const keep = (j) => { if (j && BASIC.includes(j) && !out.includes(j)) out.push(j); };
  for (const ch of word) {
    const code = ch.charCodeAt(0) - 0xac00;
    if (code < 0 || code > 11171) { keep(ch); continue; }
    keep(LEAD[Math.floor(code / 588)]);
    keep(VOWEL[Math.floor((code % 588) / 28)]);
    keep(TAIL[code % 28]);
  }
  return out;
}

/** Words the player has met, in the order they were met where the flags allow. */
export function metWords(flags = {}, signWords = []) {
  const words = Object.keys(flags).filter((k) => k.startsWith('hangul:') && flags[k]).map((k) => k.slice(7));
  for (const w of signWords) if (!words.includes(w)) words.push(w);
  return words;
}

/** { letters: [{ letter, word }], count, total } — each letter tied to the first word it came from. */
export function hangulProgress(words) {
  const letters = [];
  for (const word of words) for (const letter of basicLetters(word)) if (!letters.some((l) => l.letter === letter)) letters.push({ letter, word });
  return { letters, count: letters.length, total: BASIC.length };
}
