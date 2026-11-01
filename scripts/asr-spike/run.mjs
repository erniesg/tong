#!/usr/bin/env node
// ASR spike: can Muse Voice Transcribe (and gpt-4o-transcribe as baseline) serve eval 1–3 speaking checks?
// Usage: node scripts/asr-spike/run.mjs [--out DIR] [--wav-dir DIR] [--variants normal,fast,noisy] [--skip-tts]
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const flag = (name) => args.includes(`--${name}`);

const OUT = opt('out', join(process.env.TMPDIR || '/tmp', 'asr-spike'));
const WAV_DIR = opt('wav-dir', null);
const VARIANTS = opt('variants', 'normal,fast,noisy').split(',');
const ENV_FILE = opt('env', '/home/ubuntu/code/erniesg/tong/.env');
const RESULTS = opt('results', join(HERE, 'results.md'));

function loadEnv(file) {
  const env = {};
  if (!existsSync(file)) return env;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][\w-]*)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return env;
}
const fileEnv = loadEnv(ENV_FILE);
const OPENAI_KEY = process.env.OPENAI_API_KEY || fileEnv.OPENAI_API_KEY;
const MUSE_KEY = process.env.MODEL_API_KEY || fileEnv.MODEL_API_KEY;
const REPLICATE_KEY = process.env.REPLICATE_API_TOKEN || fileEnv.REPLICATE_API_TOKEN;
const TTS = opt('tts', 'edge'); // edge (free, no key) | openai

// Each slot is a list of accepted spellings (compared with spaces/punctuation stripped).
// `say` is what TTS speaks when it differs from the target (learner mistakes, phonetic spellings).
// `expect: 'reject'` lines are wrong answers: the check passes when the target slot is NOT found.
const LINES = [
  { id: 'e1_order', eval: 1, target: '김밥 두 줄하고 떡볶이 일 인분, 라면 두 개 주세요',
    slots: [['김밥'], ['두줄', '2줄'], ['떡볶이'], ['일인분', '1인분'], ['라면'], ['두개', '2개']] },
  { id: 'e1_order_wrong_counter', eval: 1, target: '김밥 두 줄하고 떡볶이 일 인분, 라면 두 개 주세요',
    say: '김밥 두 개하고 떡볶이 이 인분, 라면 두 개 주세요', expect: 'reject',
    slots: [['김밥두줄', '김밥2줄'], ['일인분', '1인분']] },
  { id: 'e1_order_accented', eval: 1, target: '김밥 두 줄하고 떡볶이 일 인분, 라면 두 개 주세요',
    say: 'Gimbap du jul hago, tteokbokki il inbun, ramyeon du gae juseyo', voice: 'en-US-GuyNeural',
    instructions: 'You are an American beginner learner of Korean. Read slowly and hesitantly with a strong American English accent, flattening Korean consonants.',
    slots: [['김밥'], ['두줄', '2줄'], ['떡볶이'], ['일인분', '1인분'], ['라면'], ['두개', '2개']] },
  { id: 'e1_family', eval: 1, target: '가족이 네 명이에요', slots: [['네명', '4명']] },
  { id: 'e1_weekend', eval: 1, target: '주말에 보통 친구하고 영화 봐요', slots: [['주말'], ['친구하고'], ['영화']] },
  { id: 'e2_booking', eval: 2, target: '토요일 오후 두 시에 B룸에서 연습해요',
    slots: [['토요일'], ['오후'], ['두시', '2시'], ['B룸', '비룸', 'b룸']] },
  { id: 'e2_booking_wrong', eval: 2, target: '토요일 오후 두 시에 B룸에서 연습해요',
    say: '일요일 오후 세 시에 B룸에서 연습해요', expect: 'reject', slots: [['토요일'], ['두시', '2시']] },
  { id: 'e2_time', eval: 2, target: '세 시 삼십 분', slots: [['세시', '3시'], ['삼십분', '30분']] },
  { id: 'e3_phone_favour', eval: 3, target: '죄송한데 전화 한 통만 써도 될까요?',
    slots: [['죄송한데'], ['전화'], ['한통', '1통'], ['써도될까요']] },
  { id: 'e3_lesson_favour', eval: 3, target: '보컬 레슨을 목요일로 바꿔 주실 수 있어요?',
    slots: [['보컬'], ['레슨'], ['목요일로'], ['바꿔주실수있어요']] },
  { id: 'e3_code4', eval: 3, target: '공팔이사 별표', rate: '+30%', instructions: 'Read these digits quickly and casually, like a friend on the phone.',
    slots: [['공팔이사', '0824', '영팔이사'], ['별표', '*']] },
  { id: 'e3_code6', eval: 3, target: '공팔이사칠일 별표', rate: '+30%', instructions: 'Read these digits quickly and casually, like a friend on the phone.',
    slots: [['공팔이사칠일', '082471', '영팔이사칠일'], ['별표', '*']] },
  { id: 'e3_linked', eval: 3, target: '같이 있어요', slots: [['같이'], ['있어요']] },
  // Phonetic spellings: TTS speaks the sound-spelling. If ASR returns the standard spelling, it normalised:
  // fine for dictation targets, but it means ASR alone cannot judge pronunciation.
  { id: 'phon_gachi', eval: 3, target: '같이 있어요', say: '가치 이써요', phonetic: true, slots: [['같이'], ['있어요']] },
  { id: 'phon_gamsa', eval: 7, target: '감사합니다', say: '감사함니다', phonetic: true, slots: [['감사합니다']] },
  { id: 'phon_gamsa_stiff', eval: 7, target: '감사합니다', say: '감, 사, 합, 니, 다',
    rate: '-30%', instructions: 'Pronounce every syllable separately and stiffly, exactly as spelled, with a pause between syllables.', phonetic: true, slots: [['감사합니다']] },
];

// ---------- Hangul helpers ----------
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const JONG = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];
const norm = (s) => s.normalize('NFC').replace(/[\s.,!?~·'"“”‘’-]/g, '');
function jamo(s) {
  const out = [];
  for (const ch of norm(s)) {
    const c = ch.codePointAt(0) - 0xac00;
    if (c >= 0 && c < 11172) {
      out.push(CHO[Math.floor(c / 588)], JUNG[Math.floor((c % 588) / 28)]);
      if (c % 28) out.push(JONG[c % 28]);
    } else out.push(ch.toLowerCase());
  }
  return out;
}
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const jer = (hyp, ref) => {
  const r = jamo(ref);
  return r.length ? editDistance(jamo(hyp), r) / r.length : 0;
};
// Replicate's gpt-4o-transcribe wrapper streams byte-level tokens and returns U+FFFD for some split
// Hangul syllables (server-side, unrecoverable). Let each slot syllable also match a run of U+FFFD.
const esc = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const slotRe = (a) => new RegExp([...norm(a).toLowerCase()].map((c) => `(?:${esc(c)}|\uFFFD{1,3})`).join(''));
function slotScore(hyp, line) {
  const h = norm(hyp).toLowerCase();
  const hits = line.slots.map((alts) => alts.some((a) => slotRe(a).test(h)));
  const found = hits.filter(Boolean).length;
  // For wrong answers, "pass" means the checker correctly does NOT find the target slots.
  const pass = line.expect === 'reject' ? found < line.slots.length : found === line.slots.length;
  return { found, total: line.slots.length, pass };
}

// ---------- audio ----------
async function tts(line, wavPath) {
  if (TTS === 'edge') return edgeTts(line, wavPath);
  return openaiTts(line, wavPath);
}
// Microsoft Edge neural voices via `uvx edge-tts` (no key). No style instructions; rate and voice only.
function edgeTts(line, wavPath) {
  const mp3 = wavPath.replace(/\.wav$/, '.mp3');
  execFileSync('uvx', ['edge-tts', '--voice', line.voice || 'ko-KR-SunHiNeural', `--rate=${line.rate || '+0%'}`,
    '--text', line.say || line.target, '--write-media', mp3], { stdio: 'ignore' });
  ff(['-i', mp3, '-ac', '1', '-ar', '16000', '-sample_fmt', 's16', wavPath]);
}
async function openaiTts(line, wavPath) {
  const text = line.say || line.target;
  const body = { model: 'gpt-4o-mini-tts', voice: 'coral', input: text, response_format: 'wav',
    instructions: line.instructions || 'Speak natural standard Seoul Korean at a normal conversational pace.' };
  let res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST', headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.warn(`gpt-4o-mini-tts failed (${res.status}); falling back to tts-1`);
    delete body.instructions;
    res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST', headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, model: 'tts-1' }),
    });
    if (!res.ok) throw new Error(`TTS ${res.status}: ${await res.text()}`);
  }
  const raw = wavPath.replace(/\.wav$/, '.raw.wav');
  writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  ff(['-i', raw, '-ac', '1', '-ar', '16000', '-sample_fmt', 's16', wavPath]);
}
const ff = (a) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a]);
function makeVariant(base, variant, out) {
  if (variant === 'fast') ff(['-i', base, '-filter:a', 'atempo=1.3', '-ac', '1', '-ar', '16000', '-sample_fmt', 's16', out]);
  else if (variant === 'noisy')
    ff(['-i', base, '-f', 'lavfi', '-i', 'anoisesrc=color=pink:amplitude=0.08:sample_rate=16000',
      '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=first:normalize=0', '-ac', '1', '-ar', '16000', '-sample_fmt', 's16', out]);
}

// ---------- ASR ----------
let openaiDirect = !!OPENAI_KEY;
// Official models take /models/{owner}/{name}/predictions; community models need a pinned version.
async function replicateRun(model, input, version) {
  const url = version ? 'https://api.replicate.com/v1/predictions' : `https://api.replicate.com/v1/models/${model}/predictions`;
  const res = await fetch(url, {
    method: 'POST', headers: { Authorization: `Bearer ${REPLICATE_KEY}`, 'Content-Type': 'application/json', Prefer: 'wait=60' },
    body: JSON.stringify(version ? { version, input } : { input }),
  });
  let p = await res.json();
  if (!p.urls && p.status !== 'succeeded') throw new Error(`replicate ${model}: ${p.detail || p.error || res.status}`);
  while (p.status && !['succeeded', 'failed', 'canceled'].includes(p.status)) {
    await new Promise((r) => setTimeout(r, 1500));
    p = await (await fetch(p.urls.get, { headers: { Authorization: `Bearer ${REPLICATE_KEY}` } })).json();
  }
  if (p.status !== 'succeeded') throw new Error(`replicate ${model}: ${p.error || p.detail || p.status}`);
  return p.output;
}
const dataUri = (wav) => `data:audio/wav;base64,${readFileSync(wav).toString('base64')}`;
async function gpt4oTranscribe(wav) {
  if (openaiDirect) {
    try { return await openaiTranscribe(wav); } catch (e) {
      if (!/429|quota|credit/.test(e.message) || !REPLICATE_KEY) throw e;
      console.warn('OpenAI direct out of credit; using gpt-4o-transcribe via Replicate.');
      openaiDirect = false;
    }
  }
  const out = await replicateRun('openai/gpt-4o-transcribe', { audio_file: dataUri(wav), language: 'ko' });
  return (Array.isArray(out) ? out.join('') : String(out)).trim();
}
async function whisperTranscribe(wav) {
  // openai/whisper on Replicate is large-v3.
  const out = await replicateRun('openai/whisper', { audio: dataUri(wav), language: 'ko' }, '8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e');
  return (out.transcription || '').trim();
}
async function openaiTranscribe(wav) {
  const fd = new FormData();
  fd.append('file', new Blob([readFileSync(wav)], { type: 'audio/wav' }), 'a.wav');
  fd.append('model', 'gpt-4o-transcribe');
  fd.append('language', 'ko');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${OPENAI_KEY}` }, body: fd,
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${await res.text()}`);
  return (await res.json()).text.trim();
}
async function museTranscribe(wav, keywords) {
  const request = { mode: 'PUSH_TO_TALK', model: 'muse-voice-transcribe-1.0', audioEncoding: 'WAV', languageBias: ['ko'] };
  if (keywords?.length) request.keywords = keywords;
  const fd = new FormData();
  fd.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }));
  fd.append('audio', new Blob([readFileSync(wav)], { type: 'audio/wav' }), 'a.wav');
  const res = await fetch('https://api.meta.ai/v1/asr/transcribe', {
    method: 'POST', headers: { Authorization: `Bearer ${MUSE_KEY}`, Accept: 'application/json' }, body: fd,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`muse ${res.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text);
  // Response shape is not fully documented; collect any turn/segment text we can find.
  const parts = [];
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if ((k === 'text' || k === 'transcript') && typeof v === 'string') parts.push(v);
      else walk(v);
    }
  })(json);
  return parts.join(' ').trim();
}
const keywordsFor = (line) => line.slots.map((alts) => alts[0]).filter((k) => /[가-힣]/.test(k) && k.length >= 2);

// ---------- main ----------
mkdirSync(OUT, { recursive: true });
const engines = [];
if (OPENAI_KEY || REPLICATE_KEY) engines.push({ id: 'gpt4o', run: (wav) => gpt4oTranscribe(wav) });
else console.warn('No OPENAI_API_KEY or REPLICATE_API_TOKEN: gpt-4o-transcribe baseline skipped.');
if (REPLICATE_KEY && !flag('no-whisper')) engines.push({ id: 'whisper', run: (wav) => whisperTranscribe(wav) });
if (MUSE_KEY) {
  engines.push({ id: 'muse', run: (wav) => museTranscribe(wav) });
  engines.push({ id: 'muse+kw', run: (wav, line) => museTranscribe(wav, keywordsFor(line)) });
} else console.warn('No MODEL_API_KEY: Muse skipped.');
if (!engines.length) process.exit(1);

const jobs = [];
if (WAV_DIR) {
  // Real recordings: <lineId>.wav (any format; converted to 16 kHz mono).
  for (const f of readdirSync(WAV_DIR).filter((f) => /\.(wav|m4a|mp3|webm|ogg)$/i.test(f))) {
    const line = LINES.find((l) => l.id === f.replace(/\.[^.]+$/, '').replace(/__.*$/, ''));
    if (!line) { console.warn(`skip ${f}: no line id`); continue; }
    const wav = join(OUT, `rec_${f.replace(/\.[^.]+$/, '')}.wav`);
    ff(['-i', join(WAV_DIR, f), '-ac', '1', '-ar', '16000', '-sample_fmt', 's16', wav]);
    jobs.push({ line, variant: `rec:${f}`, wav });
  }
} else {
  for (const line of LINES) {
    const base = join(OUT, `${line.id}.wav`);
    if (!existsSync(base) || !flag('skip-tts') && flag('regen')) await tts(line, base);
    for (const v of VARIANTS) {
      const wav = v === 'normal' ? base : join(OUT, `${line.id}.${v}.wav`);
      if (v !== 'normal') makeVariant(base, v, wav);
      jobs.push({ line, variant: v, wav });
    }
  }
}

const rows = [];
for (const job of jobs) {
  for (const eng of engines) {
    let hyp, err;
    try { hyp = await eng.run(job.wav, job.line); } catch (e) { err = e.message; }
    const row = { id: job.line.id, eval: job.line.eval, variant: job.variant, engine: eng.id, said: job.line.say || job.line.target, hyp: hyp ?? `ERR ${err}` };
    if (hyp != null) {
      row.jer = jer(hyp, job.line.target);
      Object.assign(row, slotScore(hyp, job.line));
      if (job.line.phonetic) row.normalised = norm(hyp) === norm(job.line.target);
      row.garbled = hyp.includes('\uFFFD');
    }
    rows.push(row);
    console.log(`${row.engine.padEnd(8)} ${row.variant.padEnd(6)} ${row.id.padEnd(24)} ${row.pass ? 'PASS' : 'fail'} jer=${row.jer?.toFixed(2)} | ${row.hyp}`);
  }
}
writeFileSync(join(OUT, 'results.json'), JSON.stringify(rows, null, 2));

// ---------- report ----------
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '–');
const lines = [`# ASR spike results`, '', `Generated ${new Date().toISOString()} · engines: ${engines.map((e) => e.id).join(', ')}${MUSE_KEY ? '' : ' (Muse skipped: no MODEL_API_KEY)'} · audio: ${WAV_DIR ? 'learner recordings' : (TTS === 'edge' ? 'edge-tts (ko-KR-SunHiNeural; en-US-GuyNeural for the accented line)' : 'OpenAI gpt-4o-mini-tts') + ', variants ' + VARIANTS.join('/')}`, ''];
lines.push('## Summary by engine and variant', '', '| Engine | Variant | Slot checks passed | Mean jamo error | Phonetic lines normalised to spelling | Transcripts with U+FFFD |', '|---|---|---|---|---|---|');
const keys = [...new Set(rows.map((r) => `${r.engine}|${r.variant}`))];
for (const k of keys) {
  const [e, v] = k.split('|');
  const rs = rows.filter((r) => r.engine === e && r.variant === v && r.jer != null);
  const ph = rs.filter((r) => r.normalised !== undefined);
  const mean = rs.length ? rs.filter((r) => !LINES.find((l) => l.id === r.id).say).reduce((a, r) => a + r.jer, 0) / rs.filter((r) => !LINES.find((l) => l.id === r.id).say).length : 0;
  lines.push(`| ${e} | ${v} | ${rs.filter((r) => r.pass).length}/${rs.length} (${pct(rs.filter((r) => r.pass).length, rs.length)}) | ${mean.toFixed(3)} | ${ph.filter((r) => r.normalised).length}/${ph.length} | ${rs.filter((r) => r.garbled).length}/${rs.length} |`);
}
lines.push('', 'Mean jamo error is over lines where the audio says the target (wrong-answer and phonetic lines excluded). Wrong-answer lines pass when the checker does *not* find the target slots. U+FFFD (�) in gpt4o-via-Replicate transcripts is a wrapper bug, not the model: slot checks treat it as a wildcard, jamo error counts it as wrong.', '');
lines.push('## Every transcript', '', '| Line | Eval | Engine | Variant | Said | Heard | Slots | Pass | JER |', '|---|---|---|---|---|---|---|---|---|');
for (const r of rows)
  lines.push(`| ${r.id} | ${r.eval} | ${r.engine} | ${r.variant} | ${r.said} | ${r.hyp.replace(/\|/g, '/')} | ${r.found ?? '–'}/${r.total ?? '–'} | ${r.pass ? '✓' : '✗'} | ${r.jer?.toFixed(2) ?? '–'} |`);
const existing = existsSync(RESULTS) ? readFileSync(RESULTS, 'utf8') : '';
const conclusion = existing.match(/\n## Conclusion[\s\S]*$/)?.[0] ?? '';
writeFileSync(RESULTS, lines.join('\n') + '\n' + conclusion);
console.log(`\nwrote ${RESULTS} and ${join(OUT, 'results.json')}`);
