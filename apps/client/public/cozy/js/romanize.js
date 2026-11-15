// Revised Romanization of Korean, as pronounced. Pure: no DOM, node-testable
// (scripts/cozy-romanize.test.mjs). A scene's own `rom` always wins over this.

const LEADS = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
const VOWELS = [...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'];
const TAILS = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];

const LEAD_ROM = { ㄱ: 'g', ㄲ: 'kk', ㄴ: 'n', ㄷ: 'd', ㄸ: 'tt', ㄹ: 'r', ㅁ: 'm', ㅂ: 'b', ㅃ: 'pp', ㅅ: 's', ㅆ: 'ss', ㅇ: '', ㅈ: 'j', ㅉ: 'jj', ㅊ: 'ch', ㅋ: 'k', ㅌ: 't', ㅍ: 'p', ㅎ: 'h' };
const VOWEL_ROM = { ㅏ: 'a', ㅐ: 'ae', ㅑ: 'ya', ㅒ: 'yae', ㅓ: 'eo', ㅔ: 'e', ㅕ: 'yeo', ㅖ: 'ye', ㅗ: 'o', ㅘ: 'wa', ㅙ: 'wae', ㅚ: 'oe', ㅛ: 'yo', ㅜ: 'u', ㅝ: 'wo', ㅞ: 'we', ㅟ: 'wi', ㅠ: 'yu', ㅡ: 'eu', ㅢ: 'ui', ㅣ: 'i' };
// A final consonant is heard as one of seven sounds.
const TAIL_SOUND = { ㄱ: 'ㄱ', ㄲ: 'ㄱ', ㅋ: 'ㄱ', ㄳ: 'ㄱ', ㄺ: 'ㄱ', ㄴ: 'ㄴ', ㄵ: 'ㄴ', ㄶ: 'ㄴ', ㄷ: 'ㄷ', ㅅ: 'ㄷ', ㅆ: 'ㄷ', ㅈ: 'ㄷ', ㅊ: 'ㄷ', ㅌ: 'ㄷ', ㅎ: 'ㄷ', ㄹ: 'ㄹ', ㄼ: 'ㄹ', ㄽ: 'ㄹ', ㄾ: 'ㄹ', ㅀ: 'ㄹ', ㅁ: 'ㅁ', ㄻ: 'ㅁ', ㅂ: 'ㅂ', ㅍ: 'ㅂ', ㅄ: 'ㅂ', ㄿ: 'ㅂ', ㅇ: 'ㅇ' };
const TAIL_ROM = { ㄱ: 'k', ㄴ: 'n', ㄷ: 't', ㄹ: 'l', ㅁ: 'm', ㅂ: 'p', ㅇ: 'ng' };
// Before a vowel a double final splits: the first stays, the second moves over.
const SPLIT = { ㄳ: 'ㄱㅅ', ㄵ: 'ㄴㅈ', ㄶ: 'ㄴㅎ', ㄺ: 'ㄹㄱ', ㄻ: 'ㄹㅁ', ㄼ: 'ㄹㅂ', ㄽ: 'ㄹㅅ', ㄾ: 'ㄹㅌ', ㄿ: 'ㄹㅍ', ㅀ: 'ㄹㅎ', ㅄ: 'ㅂㅅ' };
const ASPIRATE = { ㄱ: 'ㅋ', ㄷ: 'ㅌ', ㅈ: 'ㅊ' };
const NASAL = { ㄱ: 'ㅇ', ㄷ: 'ㄴ', ㅂ: 'ㅁ' };

const isSyllable = (ch) => ch >= '가' && ch <= '힣';

function decompose(ch) {
  const n = ch.charCodeAt(0) - 0xac00;
  return { block: ch, lead: LEADS[Math.floor(n / 588)], vowel: VOWELS[Math.floor(n / 28) % 21], tail: TAILS[n % 28] };
}

/** One run of Hangul blocks → its sounds, with the rules that cross block edges applied. */
function pronounce(word) {
  const s = [...word].map((ch) => {
    const d = decompose(ch);
    return { lead: d.lead, vowel: d.vowel, tail: d.tail };
  });
  for (let i = 0; i < s.length; i++) {
    const a = s[i];
    const b = s[i + 1];
    if (!b) {
      a.tail = TAIL_SOUND[a.tail] ?? '';
      continue;
    }
    let [keep, move] = SPLIT[a.tail] ? [...SPLIT[a.tail]] : ['', a.tail];
    if (!a.tail) {
      /* open syllable: nothing crosses */
    } else if (b.lead === 'ㅇ') {
      // Liaison: the final is said as the next block's first sound.
      if (move === 'ㅇ') [keep, move] = ['ㅇ', ''];
      else if (move === 'ㅎ') [keep, move] = ['', keep]; // ㅎ is not heard before a vowel
      else if ((b.vowel === 'ㅣ' || b.vowel === 'ㅕ') && (move === 'ㄷ' || move === 'ㅌ')) move = move === 'ㄷ' ? 'ㅈ' : 'ㅊ';
      a.tail = keep;
      if (move) b.lead = move;
      continue;
    } else if (move === 'ㅎ') {
      // ㅎ final: aspirates ㄱ ㄷ ㅈ, vanishes before ㅅ, turns nasal before ㄴ.
      if (ASPIRATE[b.lead]) { b.lead = ASPIRATE[b.lead]; a.tail = keep; continue; }
      if (b.lead === 'ㅅ') { a.tail = keep; continue; }
      if (b.lead === 'ㄴ') { a.tail = keep || 'ㄴ'; continue; }
    } else if (b.lead === 'ㅎ' && (move === 'ㅈ' || a.tail === 'ㄵ')) {
      b.lead = 'ㅊ';
      a.tail = keep;
      continue;
    }
    let t = a.tail === 'ㄺ' && b.lead === 'ㄱ' ? 'ㄹ' : (TAIL_SOUND[a.tail] ?? '');
    if (NASAL[t] && (b.lead === 'ㄴ' || b.lead === 'ㅁ')) t = NASAL[t];
    else if (NASAL[t] && b.lead === 'ㄹ') { t = NASAL[t]; b.lead = 'ㄴ'; }
    else if ((t === 'ㅁ' || t === 'ㅇ') && b.lead === 'ㄹ') b.lead = 'ㄴ';
    else if (t === 'ㄴ' && b.lead === 'ㄹ') t = 'ㄹ';
    else if (t === 'ㄹ' && b.lead === 'ㄴ') b.lead = 'ㄹ';
    a.tail = t;
  }
  let out = '';
  s.forEach((x, i) => {
    const afterL = i > 0 && s[i - 1].tail === 'ㄹ';
    out += (x.lead === 'ㄹ' && afterL ? 'l' : LEAD_ROM[x.lead]) + VOWEL_ROM[x.vowel] + (TAIL_ROM[x.tail] ?? '');
  });
  return out;
}

/** 감사합니다 → gamsahamnida. Anything that is not a Hangul block passes through. */
export function romanize(text) {
  return String(text ?? '').replace(/[가-힣]+/g, pronounce);
}

/** Per block: its letters and how the block sounds on its own. */
export function syllables(word) {
  return [...String(word ?? '')].filter(isSyllable).map((ch) => ({ ...decompose(ch), rom: pronounce(ch) }));
}

const CONS_FINAL = { ㄱ: 'k', ㄷ: 't', ㄹ: 'l', ㅂ: 'p', ㅅ: 't', ㅈ: 't', ㅊ: 't', ㅎ: 't', ㅆ: 't', ㄲ: 'k', ㅋ: 'k', ㅌ: 't', ㅍ: 'p' };

/** A short sound label for one letter: "ㅏ a", "ㄱ g/k", "ㅇ silent / ng". `pos` ('lead' | 'tail') narrows it. */
export function jamoName(j, pos) {
  if (VOWEL_ROM[j]) return `${j} ${VOWEL_ROM[j]}`;
  if (j === 'ㅇ') return pos === 'lead' ? 'ㅇ silent' : pos === 'tail' ? 'ㅇ ng' : 'ㅇ silent / ng';
  const lead = LEAD_ROM[j];
  const tail = TAIL_ROM[TAIL_SOUND[j]];
  if (lead == null) return tail ? `${j} ${tail}` : String(j ?? '');
  if (pos === 'lead') return `${j} ${lead}`;
  if (pos === 'tail') return `${j} ${tail ?? lead}`;
  const fin = CONS_FINAL[j];
  return fin && fin !== lead ? `${j} ${lead}/${fin}` : `${j} ${lead}`;
}
