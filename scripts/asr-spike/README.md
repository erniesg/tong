# ASR spike: speaking checks for Seoul evals 1–3

Question: can Meta's **Muse Voice Transcribe** (`muse-voice-transcribe-1.0`) serve the eval 1–3 speaking checks (ordering with counters, booking a time, phone favours, a door code read fast)? `gpt-4o-transcribe` and Whisper large-v3 are the baselines.

`run.mjs` synthesises each test line (correct answers, wrong-counter / wrong-day answers, an English-accented romanised attempt, and phonetic spellings like 가치 이써요 / 감사함니다), makes normal, fast (×1.3) and noisy (pink noise) variants as mono 16-bit 16 kHz WAV, transcribes them with every engine it has a key for, and scores:

- **Slot checks**: are the items, counters, numbers, day/time and digits the eval needs present? Wrong-answer lines pass when the target slots are *not* found.
- **Jamo error rate**: Hangul decomposed to jamo, edit distance to the target spelling.
- **Normalised**: for phonetic-spelling lines, did the ASR return the standard spelling? If yes, ASR text alone cannot tell good from bad pronunciation.

## Run

```bash
# from the repo root; audio goes to --out, never into the repo
node scripts/asr-spike/run.mjs --out "$RUCKSACK_SCRATCH_ROOT/asr-spike"

# add Muse (key from dev.meta.ai); also reads MODEL_API_KEY from the main checkout's .env
MODEL_API_KEY=... node scripts/asr-spike/run.mjs --out "$RUCKSACK_SCRATCH_ROOT/asr-spike"

# score real learner recordings: files named <lineId>.wav (or .m4a/.webm/...), optional __suffix
node scripts/asr-spike/run.mjs --wav-dir ~/recordings/evals --out "$RUCKSACK_SCRATCH_ROOT/asr-spike-rec"
```

| Env var | Used for |
|---|---|
| `MODEL_API_KEY` | Muse via `POST https://api.meta.ai/v1/asr/transcribe` (with and without `keywords` biasing) |
| `OPENAI_API_KEY` | `gpt-4o-transcribe` direct; falls back to Replicate when out of credit |
| `REPLICATE_API_TOKEN` | `openai/gpt-4o-transcribe` and `openai/whisper` (large-v3) on Replicate |

Keys are read from the environment, then from `/home/ubuntu/code/erniesg/tong/.env` (`--env` to change). Options: `--variants normal,fast,noisy`, `--tts edge|openai` (default `edge`: free `uvx edge-tts`, voice `ko-KR-SunHiNeural`), `--regen` to resynthesise, `--no-whisper`, `--results <path>`.

Line ids are in `LINES` at the top of `run.mjs`. Output: `results.md` here (summary + every transcript; the hand-written Conclusion section is kept across reruns) and `results.json` in `--out`.
