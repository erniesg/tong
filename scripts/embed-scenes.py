#!/usr/bin/env python3
"""
Scene embedding pipeline: detect → extract → embed → cluster → visualize.

Usage:
  python scripts/embed-scenes.py                          # process all unique videos in artifacts/videos/
  python scripts/embed-scenes.py --videos artifacts/videos/cea153b264e3.mp4
  python scripts/embed-scenes.py --skip-extract           # reuse cached embeddings, just re-cluster

Steps:
  1. Scene detection (pyscenedetect ContentDetector)
  2. Full-video transcription (Whisper with timestamps)
  3. Keyframe + audio extraction (ffmpeg)
  4. Embedding extraction:
     a. CLIP frame embeddings (ViT-B-32, 512d)
     b. VideoMAE temporal embeddings (videomae-base, 768d)
     c. Full-video transcript alignment → sentence-transformer text embeddings (384d)
     d. Mel-spectrogram audio embeddings (128d)
  5. Intra-video motif grouping (representative scene per recurring motif)
  6. HDBSCAN clustering over motif representatives (per-component + combined)
  7. UMAP 2D projection + HTML visualization

Output:
  artifacts/scenes/{video_id}/scene_{NNN}.jpg    — keyframes
  artifacts/scenes/{video_id}/scene_{NNN}.wav    — audio clips
  artifacts/scene-embeddings.json                — all embeddings + metadata
  artifacts/scene-clusters.json                  — cluster assignments
  artifacts/scene-clusters.html                  — interactive visualization
"""

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
import torch

# ── Config ────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parent.parent
VIDEOS_DIR = REPO_ROOT / "artifacts" / "videos"
SCENES_DIR = REPO_ROOT / "artifacts" / "scenes"
OUTPUT_DIR = REPO_ROOT / "artifacts"
CLIENT_SIGNAL_CACHE_DIR = REPO_ROOT / "apps" / "client" / "public" / "signals-cache"
CLIENT_SIGNAL_SCENES_DIR = CLIENT_SIGNAL_CACHE_DIR / "scenes"

DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"
MOTIF_COMPONENT_WEIGHTS = {
    "clip": 0.35,
    "videomae": 0.35,
    "text": 0.20,
    "audio": 0.10,
}

# ── 1. Scene Detection ───────────────────────────────────────────────

def detect_scenes(video_path, threshold=27.0):
    """Detect scene boundaries using pyscenedetect ContentDetector."""
    from scenedetect import open_video, SceneManager, ContentDetector

    video = open_video(str(video_path))
    sm = SceneManager()
    sm.add_detector(ContentDetector(threshold=threshold))
    sm.detect_scenes(video)
    scene_list = sm.get_scene_list()

    if not scene_list:
        # If no cuts detected, treat entire video as one scene
        from scenedetect import FrameTimecode
        duration = video.duration
        scene_list = [(video.base_timecode, duration)]

    scenes = []
    for i, (start, end) in enumerate(scene_list):
        scenes.append({
            "idx": i,
            "start_sec": start.get_seconds(),
            "end_sec": end.get_seconds(),
            "duration_sec": end.get_seconds() - start.get_seconds(),
        })
    return scenes


def extract_keyframe(video_path, scene, output_path):
    """Extract middle frame of a scene as JPEG."""
    mid_sec = (scene["start_sec"] + scene["end_sec"]) / 2
    subprocess.run(
        ["ffmpeg", "-y", "-ss", str(mid_sec), "-i", str(video_path),
         "-frames:v", "1", "-q:v", "2", str(output_path)],
        capture_output=True, timeout=30,
    )
    return output_path.exists()


def extract_audio_clip(video_path, scene, output_path):
    """Extract audio segment as WAV (16kHz mono for Whisper)."""
    duration = scene["end_sec"] - scene["start_sec"]
    if duration < 0.1:
        return False
    subprocess.run(
        ["ffmpeg", "-y", "-ss", str(scene["start_sec"]),
         "-t", str(duration), "-i", str(video_path),
         "-ar", "16000", "-ac", "1", "-f", "wav", str(output_path)],
        capture_output=True, timeout=30,
    )
    return output_path.exists()


def cache_scene_thumbnail(video_id, scene_idx, keyframe_path):
    """Copy a keyframe into the checked-in client cache for local inspection."""
    if not keyframe_path.exists():
        return None
    CLIENT_SIGNAL_SCENES_DIR.mkdir(parents=True, exist_ok=True)
    cached_name = f"{video_id}_s{scene_idx:03d}.jpg"
    cached_path = CLIENT_SIGNAL_SCENES_DIR / cached_name
    shutil.copy2(keyframe_path, cached_path)
    return f"/signals-cache/scenes/{cached_name}"


# ── 2. Embedding Extraction ──────────────────────────────────────────

class CLIPEmbedder:
    """CLIP frame embeddings via open_clip."""

    def __init__(self):
        import open_clip
        self.model, _, self.preprocess = open_clip.create_model_and_transforms(
            "ViT-B-32", pretrained="laion2b_s34b_b79k", device=DEVICE,
        )
        self.model.eval()
        print(f"  CLIP ViT-B-32 loaded on {DEVICE}")

    @torch.no_grad()
    def embed_image(self, image_path):
        from PIL import Image
        img = Image.open(image_path).convert("RGB")
        tensor = self.preprocess(img).unsqueeze(0).to(DEVICE)
        features = self.model.encode_image(tensor)
        features = features / features.norm(dim=-1, keepdim=True)
        return features.cpu().numpy().flatten()


class VideoMAEEmbedder:
    """VideoMAE temporal embeddings — 16 frames per segment."""

    def __init__(self):
        from transformers import VideoMAEModel, VideoMAEImageProcessor
        self.processor = VideoMAEImageProcessor.from_pretrained("MCG-NJU/videomae-base")
        self.model = VideoMAEModel.from_pretrained("MCG-NJU/videomae-base")
        # VideoMAE doesn't support MPS well — use CPU
        self.model.eval()
        print("  VideoMAE loaded on cpu")

    @torch.no_grad()
    def embed_segment(self, video_path, start_sec, end_sec, num_frames=16):
        """Sample num_frames uniformly from segment, return CLS embedding."""
        import cv2
        cap = cv2.VideoCapture(str(video_path))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        start_frame = int(start_sec * fps)
        end_frame = int(end_sec * fps)
        total = max(end_frame - start_frame, 1)

        indices = np.linspace(start_frame, end_frame - 1, num_frames, dtype=int)
        frames = []
        for idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if ret:
                frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            elif frames:
                frames.append(frames[-1])  # repeat last frame
        cap.release()

        if len(frames) < num_frames:
            while len(frames) < num_frames:
                frames.append(frames[-1] if frames else np.zeros((224, 224, 3), dtype=np.uint8))

        inputs = self.processor(list(frames), return_tensors="pt")
        outputs = self.model(**inputs)
        # CLS token is the first token of last_hidden_state
        cls = outputs.last_hidden_state[:, 0, :]
        cls = cls / cls.norm(dim=-1, keepdim=True)
        return cls.cpu().numpy().flatten()


class WhisperTranscriber:
    """Whisper transcription + sentence-transformer text embedding."""

    def __init__(self):
        import whisper
        self.whisper_model = whisper.load_model("base", device="cpu")
        print("  Whisper base loaded on cpu")

        from sentence_transformers import SentenceTransformer
        self.text_model = SentenceTransformer("all-MiniLM-L6-v2", device=DEVICE)
        print(f"  SentenceTransformer loaded on {DEVICE}")

    def transcribe_full_media(self, media_path):
        """Return (full_text, timestamped_segments[]) from the complete video."""
        result = self.whisper_model.transcribe(
            str(media_path),
            language=None,
            fp16=False,
            verbose=False,
        )
        segments = []
        for segment in result.get("segments", []):
            text = (segment.get("text") or "").strip()
            if not text:
                continue
            segments.append({
                "start_sec": round(float(segment.get("start", 0.0)), 2),
                "end_sec": round(float(segment.get("end", 0.0)), 2),
                "text": text,
            })
        transcript = " ".join(segment["text"] for segment in segments).strip()
        return transcript, segments

    def embed_text(self, text):
        """Return normalized text embedding (384d) or zeros for empty text."""
        text = (text or "").strip()
        if not text:
            return np.zeros(384, dtype=np.float32)
        embedding = self.text_model.encode(text, normalize_embeddings=True)
        return np.array(embedding, dtype=np.float32)

    def transcribe_and_embed(self, audio_path):
        """Return (transcript_text, text_embedding_384d)."""
        if not audio_path.exists() or audio_path.stat().st_size < 100:
            return "", np.zeros(384, dtype=np.float32)

        result = self.whisper_model.transcribe(
            str(audio_path), language=None, fp16=False, verbose=False,
        )
        text = result.get("text", "").strip()

        return text, self.embed_text(text)


class AudioEmbedder:
    """Mel-spectrogram audio embeddings (lightweight, no extra model)."""

    def __init__(self, n_mels=128):
        self.n_mels = n_mels
        print(f"  AudioEmbedder (mel-spectrogram, {n_mels}d)")

    def embed_audio(self, audio_path):
        """Return mean mel-spectrogram vector (128d)."""
        if not audio_path.exists() or audio_path.stat().st_size < 100:
            return np.zeros(self.n_mels, dtype=np.float32)

        import librosa
        y, sr = librosa.load(str(audio_path), sr=16000, mono=True)
        if len(y) < 400:
            return np.zeros(self.n_mels, dtype=np.float32)

        mel = librosa.feature.melspectrogram(
            y=y, sr=sr, n_mels=self.n_mels, n_fft=1024, hop_length=512,
        )
        # Log scale + mean over time → (n_mels,)
        log_mel = np.log1p(mel)
        mean_mel = log_mel.mean(axis=-1)
        # L2 normalize
        norm = np.linalg.norm(mean_mel)
        if norm > 0:
            mean_mel = mean_mel / norm
        return mean_mel.astype(np.float32)


# ── 3. Pipeline ──────────────────────────────────────────────────────

def normalize_vector(vec):
    arr = np.array(vec, dtype=np.float32)
    norm = np.linalg.norm(arr)
    if norm > 0:
        arr = arr / norm
    return arr


def cosine_similarity(vec_a, vec_b):
    a = normalize_vector(vec_a)
    b = normalize_vector(vec_b)
    if np.allclose(a, 0) or np.allclose(b, 0):
        return 0.0
    return float(np.dot(a, b))


def build_scene_feature_vector(scene):
    parts = []
    for key, weight in MOTIF_COMPONENT_WEIGHTS.items():
        parts.append(normalize_vector(scene["embeddings"][key]) * weight)
    return normalize_vector(np.concatenate(parts, axis=0))


def align_transcript_to_scene(scene, transcript_segments, margin=0.35):
    """Project full-video transcript segments onto a detected raw scene."""
    if not transcript_segments:
        return "", None, None, 0

    scene_start = float(scene["start_sec"])
    scene_end = float(scene["end_sec"])
    matched = []
    seen_spans = set()

    for segment in transcript_segments:
        start = float(segment["start_sec"])
        end = float(segment["end_sec"])
        overlap = min(scene_end + margin, end) - max(scene_start - margin, start)
        if overlap <= 0:
            continue
        key = (start, end, segment["text"])
        if key not in seen_spans:
            matched.append(segment)
            seen_spans.add(key)

    if not matched:
        for segment in transcript_segments:
            midpoint = (float(segment["start_sec"]) + float(segment["end_sec"])) / 2
            if scene_start - margin <= midpoint <= scene_end + margin:
                matched.append(segment)

    if not matched:
        return "", None, None, 0

    transcript = " ".join(segment["text"] for segment in matched).strip()
    span_start = round(min(float(segment["start_sec"]) for segment in matched), 2)
    span_end = round(max(float(segment["end_sec"]) for segment in matched), 2)
    return transcript, span_start, span_end, len(matched)


def assign_local_motifs(all_scenes, similarity_threshold=0.82):
    """Group recurring scenes within each video before global clustering."""
    scenes_by_video = {}
    for scene in all_scenes:
        scenes_by_video.setdefault(scene["video_id"], []).append(scene)

    representatives = []
    total_motifs = 0

    for video_id, scenes in scenes_by_video.items():
        ordered = sorted(scenes, key=lambda s: (s["start_sec"], s["scene_idx"]))
        motifs = []

        for scene in ordered:
            feature_vec = build_scene_feature_vector(scene)
            scene["_motif_feature_vec"] = feature_vec
            best_motif = None
            best_similarity = -1.0

            for motif in motifs:
                similarity = cosine_similarity(feature_vec, motif["centroid"])
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_motif = motif

            if best_motif is not None and best_similarity >= similarity_threshold:
                best_motif["members"].append(scene)
                stacked = np.stack([member["_motif_feature_vec"] for member in best_motif["members"]], axis=0)
                best_motif["centroid"] = normalize_vector(stacked.mean(axis=0))
            else:
                motifs.append({
                    "members": [scene],
                    "centroid": feature_vec.copy(),
                })

        motifs.sort(key=lambda motif: min(member["start_sec"] for member in motif["members"]))
        total_motifs += len(motifs)
        print(f"  {video_id}: {len(ordered)} raw scenes → {len(motifs)} local motifs")

        for motif_index, motif in enumerate(motifs):
            members = sorted(motif["members"], key=lambda s: (s["start_sec"], s["scene_idx"]))
            centroid = normalize_vector(
                np.stack([member["_motif_feature_vec"] for member in members], axis=0).mean(axis=0)
            )
            ranked_members = sorted(
                members,
                key=lambda scene: (
                    -cosine_similarity(scene["_motif_feature_vec"], centroid),
                    scene["start_sec"],
                    scene["scene_idx"],
                ),
            )
            representative = ranked_members[0]
            motif_count = len(members)
            motif_id = f"{video_id}:m{motif_index:02d}"

            for occurrence_index, scene in enumerate(members, start=1):
                similarity_to_centroid = cosine_similarity(scene["_motif_feature_vec"], centroid)
                scene["local_motif_id"] = motif_id
                scene["local_motif_index"] = motif_index
                scene["local_motif_count"] = motif_count
                scene["local_motif_occurrence_index"] = occurrence_index
                scene["is_representative"] = scene["scene_idx"] == representative["scene_idx"]
                scene["representative_scene_idx"] = representative["scene_idx"]
                scene["motif_similarity"] = round(similarity_to_centroid, 3)

            representatives.append(representative)

    for scene in all_scenes:
        scene.pop("_motif_feature_vec", None)

    representatives.sort(key=lambda s: (s["video_id"], s["start_sec"], s["scene_idx"]))
    return representatives, total_motifs


def jitter_projection(base_xy, scene, projection_key):
    """Spread recurring motif members slightly around their representative."""
    if scene.get("is_representative") or scene.get("local_motif_count", 1) <= 1:
        return [round(float(base_xy[0]), 3), round(float(base_xy[1]), 3)]

    digest = hashlib.md5(
        f"{projection_key}:{scene['video_id']}:{scene['scene_idx']}".encode("utf-8")
    ).hexdigest()
    angle = (int(digest[:6], 16) / 0xFFFFFF) * (2 * np.pi)
    radius = min(0.12, 0.03 * scene.get("local_motif_occurrence_index", 1))
    return [
        round(float(base_xy[0] + np.cos(angle) * radius), 3),
        round(float(base_xy[1] + np.sin(angle) * radius), 3),
    ]


def propagate_representative_clusters(all_scenes, representatives, cluster_results, projections):
    """Assign representative cluster labels/UMAP coordinates back onto all raw scenes."""
    rep_lookup = {}
    for index, rep in enumerate(representatives):
        rep["clusters"] = {key: labels[index] for key, labels in cluster_results.items()}
        rep["umap"] = {
            key: [
                round(float(projections.get(key, [[0, 0]] * len(representatives))[index][0]), 3),
                round(float(projections.get(key, [[0, 0]] * len(representatives))[index][1]), 3),
            ]
            for key in cluster_results.keys()
        }
        rep_lookup[(rep["video_id"], rep["scene_idx"])] = rep

    propagated_labels = {key: [] for key in cluster_results.keys()}

    for scene in all_scenes:
        rep_key = (scene["video_id"], scene["representative_scene_idx"])
        representative = rep_lookup[rep_key]
        scene["clusters"] = dict(representative["clusters"])
        scene["umap"] = {
            key: jitter_projection(representative["umap"][key], scene, key)
            for key in representative["umap"].keys()
        }
        for key in propagated_labels.keys():
            propagated_labels[key].append(scene["clusters"][key])

    return propagated_labels

def deduplicate_videos(video_dir):
    """Return list of unique video paths (by file hash)."""
    seen = {}
    for p in sorted(video_dir.glob("*.mp4")):
        h = hashlib.md5(p.read_bytes()).hexdigest()
        if h not in seen:
            seen[h] = p
    return list(seen.values())


def process_video(video_path, clip_emb, vmae_emb, whisper_emb, audio_emb):
    """Full pipeline for one video: detect → extract → embed."""
    video_id = video_path.stem
    scene_dir = SCENES_DIR / video_id
    scene_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"Processing: {video_id} ({video_path.stat().st_size / 1e6:.1f} MB)")

    # 1. Detect scenes
    print("  Detecting scenes...")
    scenes = detect_scenes(video_path)
    print(f"  Found {len(scenes)} scenes")

    # 2. Full-video transcription
    print("  Transcribing full video...")
    full_transcript, transcript_segments = whisper_emb.transcribe_full_media(video_path)
    print(
        f"  Transcript: {len(transcript_segments)} timestamped segments"
        f"{f', {len(full_transcript)} chars' if full_transcript else ''}"
    )

    results = []
    for scene in scenes:
        idx = scene["idx"]
        keyframe_path = scene_dir / f"scene_{idx:03d}.jpg"
        audio_path = scene_dir / f"scene_{idx:03d}.wav"

        # 3. Extract keyframe + audio
        extract_keyframe(video_path, scene, keyframe_path)
        extract_audio_clip(video_path, scene, audio_path)
        thumbnail_path = cache_scene_thumbnail(video_id, idx, keyframe_path)

        # 4. Scene-level alignment + embeddings
        transcript, transcript_span_start, transcript_span_end, transcript_segment_count = align_transcript_to_scene(
            scene,
            transcript_segments,
        )
        transcript_source = "full_video_alignment"
        text_vec = whisper_emb.embed_text(transcript)

        if not transcript:
            transcript, text_vec = whisper_emb.transcribe_and_embed(audio_path)
            transcript_source = "scene_audio_fallback" if transcript else "empty"
            if transcript:
                transcript_span_start = round(scene["start_sec"], 2)
                transcript_span_end = round(scene["end_sec"], 2)
                transcript_segment_count = 1

        clip_vec = clip_emb.embed_image(keyframe_path) if keyframe_path.exists() else np.zeros(512, dtype=np.float32)
        vmae_vec = vmae_emb.embed_segment(video_path, scene["start_sec"], scene["end_sec"])
        audio_vec = audio_emb.embed_audio(audio_path)

        results.append({
            "video_id": video_id,
            "scene_idx": idx,
            "start_sec": round(scene["start_sec"], 2),
            "end_sec": round(scene["end_sec"], 2),
            "duration_sec": round(scene["duration_sec"], 2),
            "keyframe_path": str(keyframe_path.relative_to(REPO_ROOT)),
            "audio_path": str(audio_path.relative_to(REPO_ROOT)),
            "transcript": transcript,
            "transcript_source": transcript_source,
            "transcript_span_start_sec": transcript_span_start,
            "transcript_span_end_sec": transcript_span_end,
            "transcript_segment_count": transcript_segment_count,
            "thumbnail": thumbnail_path,
            "embeddings": {
                "clip": clip_vec.tolist(),
                "videomae": vmae_vec.tolist(),
                "text": text_vec.tolist(),
                "audio": audio_vec.tolist(),
            },
        })
        print(f"    scene {idx}: {scene['start_sec']:.1f}-{scene['end_sec']:.1f}s"
              f"  transcript={transcript[:40]!r}...")

    video_metadata = {
        "video_id": video_id,
        "video_path": str(video_path.relative_to(REPO_ROOT)),
        "scene_count": len(scenes),
        "full_transcript": full_transcript,
        "transcript_segments": transcript_segments,
    }

    return results, video_metadata


# ── 4. Clustering ────────────────────────────────────────────────────

def cluster_scenes(all_scenes):
    """Run HDBSCAN on each embedding type + combined."""
    import hdbscan

    emb_keys = ["clip", "videomae", "text", "audio"]
    matrices = {}
    for key in emb_keys:
        matrices[key] = np.array([s["embeddings"][key] for s in all_scenes], dtype=np.float32)

    # Combined: concatenate all normalized embeddings
    combined = np.concatenate([matrices[k] for k in emb_keys], axis=1)
    matrices["combined"] = combined

    cluster_results = {}
    for key, X in matrices.items():
        # Skip if all zeros (e.g. no audio)
        if np.allclose(X, 0):
            cluster_results[key] = [-1] * len(all_scenes)
            print(f"  {key}: all zeros, skipping")
            continue

        min_cluster = max(2, len(all_scenes) // 8)
        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=min_cluster,
            min_samples=2,
            metric="euclidean",
        )
        labels = clusterer.fit_predict(X)
        n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
        n_noise = (labels == -1).sum()
        cluster_results[key] = labels.tolist()
        print(f"  {key}: {n_clusters} clusters, {n_noise} noise points")

    return cluster_results, matrices


def umap_project(matrices, cluster_results):
    """UMAP 2D projection for each embedding type."""
    import umap

    projections = {}
    for key, X in matrices.items():
        if np.allclose(X, 0):
            projections[key] = [[0, 0]] * X.shape[0]
            continue
        n_neighbors = min(15, X.shape[0] - 1)
        if n_neighbors < 2:
            projections[key] = [[0, 0]] * X.shape[0]
            continue
        reducer = umap.UMAP(n_components=2, n_neighbors=n_neighbors, random_state=42)
        xy = reducer.fit_transform(X)
        projections[key] = xy.tolist()
    return projections


# ── 5. Output ────────────────────────────────────────────────────────

def write_html_viz(all_scenes, output_path):
    """Write interactive HTML scatter plot."""
    # Build data for each embedding type
    tabs = []
    for key in ["clip", "videomae", "text", "audio", "combined"]:
        points = []
        for scene in all_scenes:
            xy = scene.get("umap", {}).get(key, [0, 0])
            cluster = scene.get("clusters", {}).get(key, -1)
            points.append({
                "x": round(xy[0], 3),
                "y": round(xy[1], 3),
                "cluster": cluster,
                "video": scene["video_id"],
                "scene": scene["scene_idx"],
                "time": f"{scene['start_sec']:.1f}-{scene['end_sec']:.1f}s",
                "transcript": scene["transcript"][:80],
                "keyframe": scene["keyframe_path"],
                "motif": scene.get("local_motif_id"),
                "motifCount": scene.get("local_motif_count", 1),
                "representative": bool(scene.get("is_representative")),
            })
        tabs.append({"key": key, "points": points})

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Scene Clusters</title>
<style>
body {{ font-family: -apple-system, system-ui, sans-serif; background: #0f172a; color: #e2e8f0; margin: 20px; }}
.tabs {{ display: flex; gap: 8px; margin-bottom: 16px; }}
.tab {{ padding: 6px 14px; border-radius: 8px; border: 1px solid #334155; background: transparent; color: #94a3b8; cursor: pointer; font-size: 13px; }}
.tab.active {{ background: #1e40af; color: #fff; border-color: #1e40af; }}
canvas {{ border-radius: 12px; background: #1e293b; }}
#tooltip {{ position: fixed; background: #1e293b; border: 1px solid #475569; border-radius: 8px; padding: 8px 12px; font-size: 12px; pointer-events: none; display: none; max-width: 300px; z-index: 10; }}
.stats {{ font-size: 13px; color: #94a3b8; margin: 10px 0; }}
</style></head><body>
<h2>Scene Cluster Explorer</h2>
<div class="tabs" id="tabs"></div>
<div class="stats" id="stats"></div>
<canvas id="canvas" width="900" height="600"></canvas>
<div id="tooltip"></div>
<script>
const DATA = {json.dumps(tabs)};
const COLORS = ['#3b82f6','#ef4444','#22c55e','#f59e0b','#a855f7','#ec4899','#06b6d4','#f97316','#84cc16','#6366f1'];
let activeTab = 0;

function render() {{
  const tab = DATA[activeTab];
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, PAD = 40;

  // Update tabs
  document.getElementById('tabs').innerHTML = DATA.map((t, i) =>
    `<button class="tab ${{i === activeTab ? 'active' : ''}}" onclick="activeTab=${{i}};render()">${{t.key}}</button>`
  ).join('');

  // Stats
  const clusters = new Set(tab.points.map(p => p.cluster));
  const nClusters = [...clusters].filter(c => c >= 0).length;
  const nNoise = tab.points.filter(p => p.cluster === -1).length;
  document.getElementById('stats').textContent =
    `${{tab.key}}: ${{tab.points.length}} scenes, ${{nClusters}} clusters, ${{nNoise}} noise`;

  // Scale
  const xs = tab.points.map(p => p.x), ys = tab.points.map(p => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1, yRange = yMax - yMin || 1;
  const sx = x => PAD + (x - xMin) / xRange * (W - 2*PAD);
  const sy = y => PAD + (y - yMin) / yRange * (H - 2*PAD);

  ctx.clearRect(0, 0, W, H);
  for (const p of tab.points) {{
    const color = p.cluster >= 0 ? COLORS[p.cluster % COLORS.length] : '#475569';
    ctx.beginPath();
    ctx.arc(sx(p.x), sy(p.y), 6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }}

  // Tooltip on hover
  canvas.onmousemove = (e) => {{
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let closest = null, minDist = 20;
    for (const p of tab.points) {{
      const dx = sx(p.x) - mx, dy = sy(p.y) - my;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < minDist) {{ closest = p; minDist = d; }}
    }}
    const tip = document.getElementById('tooltip');
    if (closest) {{
      tip.style.display = 'block';
      tip.style.left = (e.clientX + 12) + 'px';
      tip.style.top = (e.clientY + 12) + 'px';
      tip.innerHTML = `<b>${{closest.video}}</b> scene ${{closest.scene}}<br>
        ${{closest.time}}<br>
        cluster: ${{closest.cluster}}<br>
        motif: ${{closest.motif || '—'}} (${{closest.motifCount}}x, ${{closest.representative ? 'rep' : 'member'}})<br>
        <i>${{closest.transcript || '(no speech)'}}</i>`;
    }} else {{
      tip.style.display = 'none';
    }}
  }};
}}
render();
</script></body></html>"""
    output_path.write_text(html)
    print(f"\nVisualization: {output_path}")


# ── Main ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Scene embedding pipeline")
    parser.add_argument("--videos", nargs="*", help="Specific video files to process")
    parser.add_argument("--skip-extract", action="store_true", help="Reuse cached embeddings")
    parser.add_argument("--threshold", type=float, default=27.0, help="Scene detection threshold")
    args = parser.parse_args()

    if args.skip_extract:
        emb_path = OUTPUT_DIR / "scene-embeddings.json"
        if not emb_path.exists():
            print("No cached embeddings found. Run without --skip-extract first.")
            sys.exit(1)
        all_scenes = json.loads(emb_path.read_text())["scenes"]
        video_metadata = []
        print(f"Loaded {len(all_scenes)} cached scenes")
    else:
        # Get video list
        if args.videos:
            videos = [Path(v) for v in args.videos]
        else:
            videos = deduplicate_videos(VIDEOS_DIR)

        print(f"Videos: {len(videos)} unique files")
        for v in videos:
            print(f"  {v.name} ({v.stat().st_size / 1e6:.1f} MB)")

        # Load models
        print("\nLoading models...")
        clip_emb = CLIPEmbedder()
        vmae_emb = VideoMAEEmbedder()
        whisper_emb = WhisperTranscriber()
        audio_emb = AudioEmbedder()

        # Process each video
        all_scenes = []
        video_metadata = []
        for video_path in videos:
            scenes, video_meta = process_video(video_path, clip_emb, vmae_emb, whisper_emb, audio_emb)
            all_scenes.extend(scenes)
            video_metadata.append(video_meta)

        print(f"\nTotal scenes: {len(all_scenes)}")

        # Save embeddings
        emb_path = OUTPUT_DIR / "scene-embeddings.json"
        emb_path.write_text(json.dumps({"scenes": all_scenes}, indent=2))
        print(f"Embeddings saved: {emb_path}")

        transcript_path = OUTPUT_DIR / "video-transcripts.json"
        transcript_payload = {"videos": video_metadata}
        transcript_path.write_text(json.dumps(transcript_payload, indent=2))
        print(f"Video transcripts saved: {transcript_path}")

        CLIENT_SIGNAL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        client_transcript_path = CLIENT_SIGNAL_CACHE_DIR / "06-video-transcripts.json"
        client_transcript_path.write_text(json.dumps(transcript_payload, indent=2))
        print(f"Client transcript cache saved: {client_transcript_path}")

    # Intra-video motif grouping
    print("\nGrouping recurring scenes within each video...")
    representatives, total_motifs = assign_local_motifs(all_scenes)
    print(f"Representative scenes: {len(representatives)} / {len(all_scenes)} raw scenes")

    # Cluster representative scenes only
    print("\nClustering motif representatives...")
    representative_cluster_results, matrices = cluster_scenes(representatives)

    # UMAP on representatives only
    print("\nUMAP projection...")
    projections = umap_project(matrices, representative_cluster_results)

    # Propagate representative assignments back onto all raw scenes
    propagated_cluster_results = propagate_representative_clusters(
        all_scenes,
        representatives,
        representative_cluster_results,
        projections,
    )

    # Save cluster results
    cluster_path = OUTPUT_DIR / "scene-clusters.json"
    # Strip embeddings for the cluster output (too large)
    cluster_scenes_out = []
    for s in all_scenes:
        out = {k: v for k, v in s.items() if k != "embeddings"}
        cluster_scenes_out.append(out)
    cluster_path.write_text(json.dumps({
        "total_scenes": len(all_scenes),
        "total_representatives": len(representatives),
        "total_local_motifs": total_motifs,
        "clustering": {k: {
            "n_clusters": len(set(v)) - (1 if -1 in v else 0),
            "n_noise": v.count(-1),
            "labels": propagated_cluster_results[k],
            "representative_labels": v,
            "representative_count": len(representatives),
        } for k, v in representative_cluster_results.items()},
        "scenes": cluster_scenes_out,
    }, indent=2))
    print(f"Clusters saved: {cluster_path}")

    # HTML visualization
    viz_path = OUTPUT_DIR / "scene-clusters.html"
    write_html_viz(all_scenes, viz_path)

    print("\nDone!")


if __name__ == "__main__":
    main()
