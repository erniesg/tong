# Scene Clustering Methodology

## Problem

We want to discover reusable video components from short-form social media content (TikTok, IG Reels, XHS). The goal is an empirical taxonomy of scene types — not one we impose, but one that emerges from the data.

## Why Not LLM Labels

Our first approach (Gemini scene_decomposition preset) asked the LLM to classify each scene into predefined categories: `talking_head`, `text_overlay`, `b_roll`, etc. Results from 3 fingerprinted videos:

- **28/28 scenes** classified as `talking_head`
- automationDifficulty varied (trivial/moderate/hard) but is also an LLM judgment
- The LLM flattened real visual differences into a single bucket

This is label-then-cluster — we imposed categories before looking at the data. Any subsequent clustering on these labels would just rediscover our own taxonomy.

## Approach: Discover Then Label

1. **Detect** scenes from raw video signal (visual cuts, not LLM opinion)
2. **Embed** each scene using pretrained models (no task-specific labels)
3. **Cluster** the embeddings to find natural groupings
4. **Then label** — use LLM to describe what each cluster contains

## Pipeline

```
videos (mp4)
  |
  v
[Scene Detection] — pyscenedetect ContentDetector
  |                  finds visual cuts / transitions
  v
scenes (start_time, end_time, keyframe.jpg)
  |
  +---> [CLIP] ------> frame embeddings (512d per keyframe)
  |                     captures: visual style, composition, objects, text
  |
  +---> [VideoMAE] ---> temporal embeddings (768d per segment)
  |                     captures: motion, gestures, transitions, pacing
  |
  +---> [Whisper] ----> transcription text per segment
  |         |
  |         +---------> text embeddings (384d via sentence-transformers)
  |                     captures: what is being said, topic, language
  |
  +---> [Audio] ------> audio embeddings (512d via CLAP or mel-spectrogram)
  |                     captures: music vs speech vs silence, energy, tone
  |
  v
[Clustering] — HDBSCAN on each embedding type + combined
  |
  v
[UMAP] — 2D projection for visualization
  |
  v
[LLM Labeling] — Gemini describes each cluster from exemplar keyframes + transcripts
```

## Embedding Components

### A. CLIP Frame Embeddings (static visual)
- Model: `ViT-B-32` via open_clip (or `ViT-L-14` for higher quality)
- Input: 1 keyframe per detected scene (middle frame)
- Output: 512d vector
- Captures: visual composition, text overlays, objects, color palette, framing
- Does NOT capture: motion, temporal patterns, audio
- Cost: ~50ms per frame on M2 Max

### B. VideoMAE Temporal Embeddings
- Model: `MCG-NJU/videomae-base` via transformers
- Input: 16 frames sampled uniformly from each scene segment
- Output: 768d vector (CLS token)
- Captures: motion patterns, gesture dynamics, transition styles, pacing
- Cost: ~200ms per segment on M2 Max (MPS accelerated)

### C. Whisper Transcription + Text Embedding
- Transcription: `openai/whisper` (base or small model)
- Text embedding: `sentence-transformers/all-MiniLM-L6-v2` (384d)
- Input: audio track of each scene segment
- Output: transcription string + 384d text embedding
- Captures: spoken content, language, topic, instructional vs conversational
- Cost: ~1-3s per segment (whisper), ~10ms per embedding

### D. Audio Embeddings
- Approach: mel-spectrogram + mean pooling (lightweight, no extra model)
  - OR: CLAP model for richer audio understanding
- Input: audio waveform of each scene segment
- Output: 128d (mel) or 512d (CLAP)
- Captures: music vs speech vs silence, energy level, background sounds
- Cost: ~20ms per segment (mel), ~100ms (CLAP)

## Clustering Strategy

### Per-component clustering
Run HDBSCAN separately on each embedding type to see what each modality finds:
- CLIP clusters: groups by visual appearance
- VideoMAE clusters: groups by motion/temporal pattern
- Whisper clusters: groups by spoken content
- Audio clusters: groups by sound characteristics

### Combined clustering
Concatenate normalized embeddings: `[CLIP_512 | VideoMAE_768 | Text_384 | Audio_128]` = 1792d
- L2-normalize each component before concatenation (equal weighting)
- Or weight by component: visual (0.4) + temporal (0.3) + text (0.2) + audio (0.1)

### HDBSCAN parameters
- `min_cluster_size`: start with 3 (small dataset), increase with more data
- `min_samples`: 2
- `metric`: cosine (for normalized embeddings) or euclidean
- Allow noise points (-1 label) — not every scene needs a cluster

### Visualization
- UMAP projection to 2D for each clustering result
- Color by cluster assignment
- Hover/tooltip shows keyframe thumbnail + metadata

## Data

### Current inventory (2026-04-08)
- 4 unique TikTok videos (29s, 38s, 80s, 99s) = ~246s total footage
- All language learning tutorials (Korean)
- Estimated ~20-40 detected scenes

### Scaling plan
- Run pipeline on full 20 ranked videos → ~200-400 scenes
- Then expand keyword sets to get diverse content (not just tutorials)
- Target: 500+ scenes for meaningful clustering

## Hardware
- Apple M2 Max, 64GB RAM
- MPS acceleration for PyTorch
- All models fit comfortably in memory

## Output Format

```json
{
  "scenes": [
    {
      "video_id": "cea153b264e3",
      "scene_idx": 0,
      "start_sec": 0.0,
      "end_sec": 3.2,
      "keyframe_path": "artifacts/scenes/cea153b264e3/scene_000.jpg",
      "transcript": "Hello everyone, today we're going to...",
      "embeddings": {
        "clip": [0.12, -0.34, ...],       // 512d
        "videomae": [0.05, 0.22, ...],    // 768d
        "text": [-0.11, 0.44, ...],       // 384d
        "audio": [0.33, -0.18, ...]       // 128d
      },
      "clusters": {
        "clip_only": 2,
        "videomae_only": 0,
        "audio_only": 1,
        "combined": 3
      }
    }
  ],
  "cluster_labels": {
    "combined": {
      "0": "Instructor speaking to camera with Korean text overlay",
      "1": "Transition screen with topic title",
      "3": "Practice prompt with countdown"
    }
  }
}
```
