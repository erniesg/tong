"""
SAM2 Segmentation Sidecar Server.

Provides subject extraction, interactive segmentation, contour generation,
and multi-layer compositing via FastAPI.

Modes:
  - SAM2_MOCK=1: Uses simple threshold-based segmentation (no model needed)
  - Default: Loads SAM2 model for production-quality segmentation

Run: uvicorn server:app --port 8100
Test: SAM2_MOCK=1 python3 -m pytest test_server.py -v
"""

import base64
import io
import os
import logging
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from PIL import Image, ImageFilter, ImageDraw
from pydantic import BaseModel

logger = logging.getLogger("sam2-sidecar")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="SAM2 Segmentation Sidecar", version="0.1.0")

MOCK_MODE = os.environ.get("SAM2_MOCK", "0") == "1"

# ── SAM2 Model Loading ─────────────────────────────────────────────

_sam2_model = None
_sam2_processor = None


def get_device():
    import torch
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def load_sam2():
    """Lazy-load SAM2 model on first real inference."""
    global _sam2_model, _sam2_processor
    if _sam2_model is not None:
        return _sam2_model, _sam2_processor

    try:
        from sam2.build_sam import build_sam2
        from sam2.sam2_image_predictor import SAM2ImagePredictor

        device = get_device()
        logger.info(f"Loading SAM2 on {device}...")
        # Use the smallest checkpoint for speed
        checkpoint = os.environ.get("SAM2_CHECKPOINT", "sam2.1_hiera_small.pt")
        config = os.environ.get("SAM2_CONFIG", "configs/sam2.1/sam2.1_hiera_s.yaml")
        model = build_sam2(config, checkpoint, device=device)
        predictor = SAM2ImagePredictor(model)
        _sam2_model = model
        _sam2_processor = predictor
        logger.info("SAM2 loaded successfully")
        return model, predictor
    except Exception as e:
        logger.warning(f"SAM2 not available: {e}. Using mock segmentation.")
        return None, None


# ── Request/Response Models ────────────────────────────────────────

class SegmentRequest(BaseModel):
    imageBase64: str
    imageUrl: Optional[str] = None


class PointPrompt(BaseModel):
    x: float
    y: float
    label: int = 1  # 1 = foreground, 0 = background


class InteractiveSegmentRequest(BaseModel):
    imageBase64: str
    points: Optional[list[PointPrompt]] = None
    box: Optional[list[float]] = None  # [x1, y1, x2, y2]


class ContourRequest(BaseModel):
    maskBase64: str
    color: str = "#FFFFFF"
    width: int = 3


class CompositeLayer(BaseModel):
    imageBase64: str
    x: int = 0
    y: int = 0
    width: Optional[int] = None
    height: Optional[int] = None
    opacity: float = 1.0
    dropShadow: Optional[dict] = None


class CompositeRequest(BaseModel):
    backgroundBase64: str
    width: int
    height: int
    layers: list[CompositeLayer]


# ── Helpers ────────────────────────────────────────────────────────

def decode_image(b64: str) -> Image.Image:
    """Decode base64 to PIL Image."""
    data = base64.b64decode(b64)
    return Image.open(io.BytesIO(data))


def encode_image(img: Image.Image, fmt: str = "PNG") -> str:
    """Encode PIL Image to base64 string."""
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return base64.b64encode(buf.getvalue()).decode()


def mock_segment(img_np: np.ndarray) -> np.ndarray:
    """
    Simple mock segmentation: threshold on color difference from edge pixels.
    Good enough for testing without SAM2 model.
    """
    # Use edge pixel as background reference
    bg_color = img_np[0, 0].astype(np.float32)
    diff = np.sqrt(np.sum((img_np.astype(np.float32) - bg_color) ** 2, axis=2))
    # Threshold: pixels significantly different from background
    threshold = 30.0
    mask = (diff > threshold).astype(np.uint8) * 255
    # Clean up with morphological ops
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    return mask


def sam2_segment(img_np: np.ndarray, points=None, box=None):
    """Run SAM2 segmentation. Returns binary mask (H, W) uint8 0/255."""
    _, predictor = load_sam2()
    if predictor is None:
        return mock_segment(img_np)

    predictor.set_image(img_np)

    if points:
        coords = np.array([[p["x"], p["y"]] for p in points])
        labels = np.array([p["label"] for p in points])
        masks, scores, _ = predictor.predict(
            point_coords=coords,
            point_labels=labels,
            multimask_output=True,
        )
    elif box:
        masks, scores, _ = predictor.predict(
            box=np.array(box),
            multimask_output=True,
        )
    else:
        # Auto mode: use center point as foreground
        h, w = img_np.shape[:2]
        masks, scores, _ = predictor.predict(
            point_coords=np.array([[w // 2, h // 2]]),
            point_labels=np.array([1]),
            multimask_output=True,
        )

    # Pick highest-scoring mask
    best_idx = np.argmax(scores)
    mask = masks[best_idx].astype(np.uint8) * 255
    return mask


def mask_to_subject(img: Image.Image, mask_np: np.ndarray) -> Image.Image:
    """Apply mask to image, returning RGBA with transparent background."""
    rgba = img.convert("RGBA")
    mask_pil = Image.fromarray(mask_np, mode="L")
    # Ensure same size
    if mask_pil.size != rgba.size:
        mask_pil = mask_pil.resize(rgba.size, Image.NEAREST)
    rgba.putalpha(mask_pil)
    return rgba


def mask_bounding_box(mask_np: np.ndarray) -> dict:
    """Get bounding box of non-zero pixels in mask."""
    coords = cv2.findNonZero(mask_np)
    if coords is None:
        return {"x": 0, "y": 0, "w": 0, "h": 0}
    x, y, w, h = cv2.boundingRect(coords)
    return {"x": int(x), "y": int(y), "w": int(w), "h": int(h)}


# ── Endpoints ──────────────────────────────────────────────────────

@app.get("/health")
def health():
    device = "mock" if MOCK_MODE else get_device()
    return {"status": "ok", "device": device, "mock": MOCK_MODE}


@app.post("/segment")
def segment(req: SegmentRequest):
    """Auto-segment the largest foreground subject."""
    if not req.imageBase64:
        raise HTTPException(400, "imageBase64 is required")

    img = decode_image(req.imageBase64)
    img_np = np.array(img.convert("RGB"))

    if MOCK_MODE:
        mask_np = mock_segment(img_np)
    else:
        mask_np = sam2_segment(img_np)

    subject = mask_to_subject(img, mask_np)
    bb = mask_bounding_box(mask_np)

    return {
        "subjectBase64": encode_image(subject),
        "maskBase64": encode_image(Image.fromarray(mask_np, mode="L")),
        "boundingBox": bb,
    }


@app.post("/segment/interactive")
def segment_interactive(req: InteractiveSegmentRequest):
    """Segment with point or box prompts for user-guided extraction."""
    if not req.imageBase64:
        raise HTTPException(400, "imageBase64 is required")

    img = decode_image(req.imageBase64)
    img_np = np.array(img.convert("RGB"))

    points = [{"x": p.x, "y": p.y, "label": p.label} for p in req.points] if req.points else None
    box = req.box

    if MOCK_MODE:
        # In mock mode, use simple threshold regardless of prompts
        mask_np = mock_segment(img_np)
    else:
        mask_np = sam2_segment(img_np, points=points, box=box)

    subject = mask_to_subject(img, mask_np)
    bb = mask_bounding_box(mask_np)

    return {
        "subjectBase64": encode_image(subject),
        "maskBase64": encode_image(Image.fromarray(mask_np, mode="L")),
        "boundingBox": bb,
    }


@app.post("/contour")
def contour(req: ContourRequest):
    """Generate contour/outline from a mask. Returns RGBA PNG with just the outlines."""
    mask_img = decode_image(req.maskBase64).convert("L")
    mask_np = np.array(mask_img)

    # Find contours
    contours, _ = cv2.findContours(mask_np, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # Parse hex color
    color_hex = req.color.lstrip("#")
    r, g, b = int(color_hex[0:2], 16), int(color_hex[2:4], 16), int(color_hex[4:6], 16)

    # Draw contours on transparent RGBA canvas
    h, w = mask_np.shape
    canvas = np.zeros((h, w, 4), dtype=np.uint8)
    cv2.drawContours(canvas, contours, -1, (r, g, b, 255), req.width)

    result = Image.fromarray(canvas, mode="RGBA")
    return {"contourBase64": encode_image(result)}


@app.post("/composite")
def composite(req: CompositeRequest):
    """
    Composite multiple layers onto a background.

    Each layer is an RGBA image positioned at (x, y) with optional resize,
    opacity, and drop shadow. Layers are composited in order (first = bottom).
    """
    # Start with background
    bg = decode_image(req.backgroundBase64).convert("RGBA")
    bg = bg.resize((req.width, req.height), Image.LANCZOS)
    canvas = bg.copy()

    for layer in req.layers:
        layer_img = decode_image(layer.imageBase64).convert("RGBA")

        # Resize if specified
        lw = layer.width or layer_img.width
        lh = layer.height or layer_img.height
        if (lw, lh) != layer_img.size:
            layer_img = layer_img.resize((lw, lh), Image.LANCZOS)

        # Apply opacity
        if layer.opacity < 1.0:
            alpha = layer_img.getchannel("A")
            alpha = alpha.point(lambda a: int(a * layer.opacity))
            layer_img.putalpha(alpha)

        # Drop shadow
        if layer.dropShadow:
            shadow = _create_drop_shadow(layer_img, layer.dropShadow)
            sx = layer.x + layer.dropShadow.get("offsetX", 5)
            sy = layer.y + layer.dropShadow.get("offsetY", 5)
            canvas.paste(shadow, (sx, sy), shadow)

        # Paste layer
        canvas.paste(layer_img, (layer.x, layer.y), layer_img)

    return {"resultBase64": encode_image(canvas)}


def _create_drop_shadow(img: Image.Image, shadow_cfg: dict) -> Image.Image:
    """Create a drop shadow from an image's alpha channel."""
    alpha = img.getchannel("A")

    # Parse color
    color_str = shadow_cfg.get("color", "black")
    if color_str == "black":
        shadow_color = (0, 0, 0)
    elif color_str.startswith("#"):
        h = color_str.lstrip("#")
        shadow_color = (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
    else:
        shadow_color = (0, 0, 0)

    # Create shadow image
    shadow = Image.new("RGBA", img.size, (*shadow_color, 0))
    shadow.putalpha(alpha)

    # Blur
    blur = shadow_cfg.get("blur", 10)
    if blur > 0:
        shadow = shadow.filter(ImageFilter.GaussianBlur(radius=blur))

    return shadow


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("SAM2_PORT", "8100"))
    uvicorn.run(app, host="0.0.0.0", port=port)
