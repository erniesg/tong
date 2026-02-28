#!/usr/bin/env python3
"""Reusable SAM-based background removal for character sprites."""

from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
import shutil
from typing import Iterable, List, Tuple

import cv2
import numpy as np
import torch
from segment_anything import SamAutomaticMaskGenerator, SamPredictor, sam_model_registry


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Remove image backgrounds using Segment Anything and export transparent PNGs."
    )
    parser.add_argument(
        "--input-glob",
        default="backup/tong_*.png",
        help="Glob pattern for source images.",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Directory for generated PNGs. Defaults to sam_output_<timestamp>.",
    )
    parser.add_argument(
        "--checkpoint",
        default="/tmp/sam_vit_b_01ec64.pth",
        help="Path to SAM checkpoint.",
    )
    parser.add_argument(
        "--model-type",
        choices=["vit_b", "vit_l", "vit_h"],
        default="vit_b",
        help="SAM model type matching the checkpoint.",
    )
    parser.add_argument(
        "--device",
        choices=["auto", "cpu", "mps", "cuda"],
        default="auto",
        help="Inference device.",
    )
    parser.add_argument(
        "--replace-dir",
        default=None,
        help="If set, overwrite same filenames in this directory with SAM outputs.",
    )
    parser.add_argument(
        "--backup-dir",
        default=None,
        help="Backup directory used with --replace-dir. Defaults to backup_pre_sam_<timestamp>.",
    )
    parser.add_argument(
        "--alpha-threshold",
        type=int,
        default=10,
        help="Threshold for binary mask/metrics (0-255).",
    )
    parser.add_argument(
        "--feather-sigma",
        type=float,
        default=1.1,
        help="Gaussian sigma used to soften alpha edges.",
    )
    parser.add_argument(
        "--target-area",
        type=float,
        default=0.30,
        help="Preferred foreground area fraction used for mask scoring.",
    )
    parser.add_argument(
        "--min-area",
        type=float,
        default=0.15,
        help="If seed point mask area is below this, run expanded point prompts.",
    )
    parser.add_argument(
        "--max-area",
        type=float,
        default=0.90,
        help="If seed point mask area is above this, run expanded point prompts.",
    )
    parser.add_argument(
        "--fg-point",
        action="append",
        default=[],
        help="Extra foreground point as 'x,y'. Use 0..1 normalized or pixel coords.",
    )
    parser.add_argument(
        "--bg-point",
        action="append",
        default=[],
        help="Extra background point as 'x,y'. Use 0..1 normalized or pixel coords.",
    )
    parser.add_argument(
        "--edge-refine",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Use edge-guided GrabCut refinement before writing alpha.",
    )
    return parser.parse_args()


def resolve_device(raw: str) -> str:
    if raw != "auto":
        return raw
    if torch.cuda.is_available():
        return "cuda"
    # SAM + MPS can hit float64 conversion issues on some macOS/PyTorch builds.
    # Defaulting auto to CPU is slower but avoids intermittent runtime failures.
    return "cpu"


def border_touch(mask: np.ndarray) -> float:
    border = np.concatenate([mask[0, :], mask[-1, :], mask[:, 0], mask[:, -1]])
    return float(border.mean())


def parse_user_points(raw_points: List[str], width: int, height: int) -> np.ndarray:
    pts: List[Tuple[float, float]] = []
    for raw in raw_points:
        try:
            xs, ys = raw.split(",", 1)
            x = float(xs.strip())
            y = float(ys.strip())
        except Exception as exc:
            raise SystemExit(f"Invalid point '{raw}'. Expected format x,y") from exc

        if 0.0 <= x <= 1.0 and 0.0 <= y <= 1.0:
            x = x * float(width - 1)
            y = y * float(height - 1)
        x = float(np.clip(x, 0, width - 1))
        y = float(np.clip(y, 0, height - 1))
        pts.append((x, y))

    if not pts:
        return np.zeros((0, 2), dtype=np.float32)
    return np.array(pts, dtype=np.float32)


def keep_main_components(mask: np.ndarray) -> np.ndarray:
    m = (mask > 0).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    if n <= 1:
        return m

    h, w = m.shape
    border = np.zeros_like(m, dtype=np.uint8)
    border[0, :] = 1
    border[-1, :] = 1
    border[:, 0] = 1
    border[:, -1] = 1

    largest = max(float(stats[i, cv2.CC_STAT_AREA]) for i in range(1, n))
    kept_labels: List[int] = []
    for i in range(1, n):
        area = float(stats[i, cv2.CC_STAT_AREA])
        comp = (labels == i).astype(np.uint8)
        border_hits = float((comp * border).sum())
        if area >= largest * 0.12 and border_hits <= area * 0.25:
            kept_labels.append(i)

    if not kept_labels:
        best_label = max(range(1, n), key=lambda i: stats[i, cv2.CC_STAT_AREA])
        return (labels == best_label).astype(np.uint8)

    out = np.zeros_like(m, dtype=np.uint8)
    for i in kept_labels:
        out[labels == i] = 1
    return out


def edge_guided_refine_mask(bgr: np.ndarray, mask: np.ndarray) -> np.ndarray:
    m = (mask > 0).astype(np.uint8)
    if float(m.mean()) < 0.01:
        return m

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (0, 0), sigmaX=1.1, sigmaY=1.1)
    edges = cv2.Canny(gray, 35, 110)
    edges = (edges > 0).astype(np.uint8)
    edge_band = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)

    k3 = np.ones((3, 3), np.uint8)
    k5 = np.ones((5, 5), np.uint8)
    sure_fg = cv2.erode(m, k3, iterations=2)
    probable_fg = cv2.dilate(m, k5, iterations=2)

    sure_bg = np.zeros_like(m, dtype=np.uint8)
    margin = max(8, int(0.03 * min(m.shape[0], m.shape[1])))
    sure_bg[:margin, :] = 1
    sure_bg[-margin:, :] = 1
    sure_bg[:, :margin] = 1
    sure_bg[:, -margin:] = 1
    sure_bg = np.maximum(sure_bg, (cv2.erode((1 - probable_fg).astype(np.uint8), k5, iterations=1)))

    gc_mask = np.full(m.shape, cv2.GC_PR_BGD, dtype=np.uint8)
    gc_mask[probable_fg > 0] = cv2.GC_PR_FGD
    gc_mask[sure_bg > 0] = cv2.GC_BGD
    gc_mask[sure_fg > 0] = cv2.GC_FGD
    gc_mask[(edge_band > 0) & (probable_fg > 0)] = cv2.GC_PR_FGD

    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(bgr, gc_mask, None, bgd_model, fgd_model, 3, cv2.GC_INIT_WITH_MASK)
    except cv2.error:
        return m

    refined = np.where(
        (gc_mask == cv2.GC_FGD) | (gc_mask == cv2.GC_PR_FGD),
        1,
        0,
    ).astype(np.uint8)

    src_area = float(m.mean())
    out_area = float(refined.mean())
    if out_area < src_area * 0.55 or out_area > src_area * 1.85:
        return m
    return refined


def score_point_mask(mask: np.ndarray, pred_score: float, target_area: float) -> float:
    h, w = mask.shape
    cy, cx = h // 2, w // 2
    area = float(mask.mean())
    bt = border_touch(mask)
    center_on = 1.0 if mask[cy, cx] else 0.0
    return float(pred_score) + 1.8 * center_on - 2.8 * bt - 1.5 * abs(area - target_area)


def score_auto_mask(mask: np.ndarray, pred_iou: float, stability: float, target_area: float) -> float:
    h, w = mask.shape
    cy, cx = h // 2, w // 2
    area = float(mask.mean())
    bt = border_touch(mask)
    center_on = 1.0 if mask[cy, cx] else 0.0
    return pred_iou + 0.7 * stability + 1.6 * center_on - 2.8 * bt - 1.3 * abs(area - target_area)


def points_for_image(
    width: int,
    height: int,
    *,
    expanded: bool,
    extra_fg: np.ndarray,
    extra_bg: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray]:
    cx, cy = width // 2, height // 2
    pos = np.array(
        [
            [cx, cy],
            [int(width * 0.50), int(height * 0.42)],
            [int(width * 0.50), int(height * 0.58)],
            [int(width * 0.42), int(height * 0.50)],
            [int(width * 0.58), int(height * 0.50)],
        ],
        dtype=np.float32,
    )
    if expanded:
        pos = np.vstack(
            [
                pos,
                np.array(
                    [
                        [int(width * 0.50), int(height * 0.68)],
                        [int(width * 0.50), int(height * 0.80)],
                        [int(width * 0.38), int(height * 0.68)],
                        [int(width * 0.62), int(height * 0.68)],
                        [int(width * 0.30), int(height * 0.80)],
                        [int(width * 0.70), int(height * 0.80)],
                    ],
                    dtype=np.float32,
                ),
            ]
        )
    neg = np.array(
        [
            [0, 0],
            [width - 1, 0],
            [0, height - 1],
            [width - 1, height - 1],
            [width // 2, 0],
            [width // 2, height - 1],
            [0, height // 2],
            [width - 1, height // 2],
            [int(width * 0.10), int(height * 0.10)],
            [int(width * 0.90), int(height * 0.10)],
            [int(width * 0.10), int(height * 0.90)],
            [int(width * 0.90), int(height * 0.90)],
        ],
        dtype=np.float32,
    )
    if extra_fg.size:
        pos = np.vstack([pos, extra_fg])
    if extra_bg.size:
        neg = np.vstack([neg, extra_bg])

    coords = np.vstack([pos, neg])
    labels = np.array([1] * len(pos) + [0] * len(neg), dtype=np.int32)
    return coords, labels


def refine_alpha(mask: np.ndarray, feather_sigma: float) -> np.ndarray:
    m = mask.astype(np.uint8)
    kernel = np.ones((3, 3), np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, kernel, iterations=1)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, kernel, iterations=1)
    alpha = (m * 255).astype(np.uint8)
    if feather_sigma > 0:
        alpha = cv2.GaussianBlur(alpha, (0, 0), sigmaX=feather_sigma, sigmaY=feather_sigma)
    return alpha


def run(
    inputs: Iterable[Path],
    output_dir: Path,
    checkpoint: Path,
    model_type: str,
    device: str,
    alpha_threshold: int,
    feather_sigma: float,
    target_area: float,
    min_area: float,
    max_area: float,
    extra_fg_raw: List[str],
    extra_bg_raw: List[str],
    edge_refine: bool,
) -> None:
    if not checkpoint.exists():
        raise SystemExit(f"Checkpoint not found: {checkpoint}")

    sam = sam_model_registry[model_type](checkpoint=str(checkpoint))
    sam.to(device=device)
    predictor = SamPredictor(sam)
    auto = SamAutomaticMaskGenerator(
        sam,
        points_per_side=32,
        pred_iou_thresh=0.86,
        stability_score_thresh=0.92,
        min_mask_region_area=1000,
    )

    output_dir.mkdir(parents=True, exist_ok=True)

    for path in sorted(inputs):
        bgr = cv2.imread(str(path), cv2.IMREAD_COLOR)
        if bgr is None:
            print(f"skip {path.name}: failed to read")
            continue
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        h, w = rgb.shape[:2]
        cx, cy = w // 2, h // 2
        extra_fg = parse_user_points(extra_fg_raw, w, h)
        extra_bg = parse_user_points(extra_bg_raw, w, h)

        predictor.set_image(rgb)

        candidates: List[Tuple[np.ndarray, float, str]] = []

        def add_point_candidates(expanded: bool, with_box: bool) -> None:
            points, labels = points_for_image(
                w,
                h,
                expanded=expanded,
                extra_fg=extra_fg,
                extra_bg=extra_bg,
            )
            box = None
            if with_box:
                box = np.array([int(w * 0.03), int(h * 0.03), int(w * 0.97), int(h * 0.97)], dtype=np.float32)
            masks, scores, _ = predictor.predict(
                point_coords=points,
                point_labels=labels,
                box=box,
                multimask_output=True,
            )
            source = "point-expanded" if expanded else "point-seed"
            if with_box:
                source += "-box"
            for idx in range(len(masks)):
                m = masks[idx].astype(np.uint8)
                s = score_point_mask(m, float(scores[idx]), target_area=target_area)
                candidates.append((m, s, source))

        add_point_candidates(expanded=False, with_box=False)

        if not candidates:
            print(f"skip {path.name}: no point masks")
            continue

        seed_mask, _, _ = max(candidates, key=lambda item: item[1])
        seed_area = float(seed_mask.mean())
        if seed_area < min_area or seed_area > max_area:
            add_point_candidates(expanded=True, with_box=False)
            add_point_candidates(expanded=True, with_box=True)

        generated = auto.generate(rgb)
        for item in generated:
            m = item["segmentation"].astype(np.uint8)
            s = score_auto_mask(
                m,
                float(item.get("predicted_iou", 0.0)),
                float(item.get("stability_score", 0.0)),
                target_area=target_area,
            )
            candidates.append((m, s, "auto"))

        filtered: List[Tuple[np.ndarray, float, str]] = []
        for cmask, cscore, csource in candidates:
            carea = float(cmask.mean())
            cbt = border_touch(cmask)
            if min_area <= carea <= max_area and cbt <= 0.08:
                filtered.append((cmask, cscore, csource))

        pick_pool = filtered if filtered else candidates
        best_mask, _, best_source = max(pick_pool, key=lambda item: item[1])
        mask = keep_main_components(best_mask)
        if edge_refine:
            mask = edge_guided_refine_mask(bgr, mask)
            mask = keep_main_components(mask)

        alpha = refine_alpha(mask, feather_sigma=feather_sigma)

        rgba = cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA)
        rgba[:, :, 3] = alpha
        out_path = output_dir / path.name
        cv2.imwrite(str(out_path), rgba)

        fg = float((alpha > alpha_threshold).mean())
        bt = float(
            (
                np.concatenate([alpha[0, :], alpha[-1, :], alpha[:, 0], alpha[:, -1]]) > alpha_threshold
            ).mean()
        )
        print(
            f"processed {path.name} source={best_source} area={fg:.4f} "
            f"border_touch={bt:.4f} seed_area={seed_area:.4f} "
            f"candidates={len(candidates)} filtered={len(filtered)}"
        )


def replace_outputs(output_dir: Path, replace_dir: Path, backup_dir: Path) -> None:
    backup_dir.mkdir(parents=True, exist_ok=True)
    for out in sorted(output_dir.glob("*.png")):
        target = replace_dir / out.name
        if target.exists():
            shutil.copy2(target, backup_dir / target.name)
        shutil.copy2(out, target)
    print(f"backup_dir={backup_dir}")


def main() -> None:
    args = parse_args()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    output_dir = Path(args.output_dir) if args.output_dir else Path(f"sam_output_{timestamp}")
    checkpoint = Path(args.checkpoint)
    device = resolve_device(args.device)

    inputs = list(Path(".").glob(args.input_glob))
    if not inputs:
        raise SystemExit(f"No files matched: {args.input_glob}")

    print(f"model={args.model_type} device={device}")
    print(f"input_count={len(inputs)} output_dir={output_dir}")
    run(
        inputs=inputs,
        output_dir=output_dir,
        checkpoint=checkpoint,
        model_type=args.model_type,
        device=device,
        alpha_threshold=args.alpha_threshold,
        feather_sigma=args.feather_sigma,
        target_area=args.target_area,
        min_area=args.min_area,
        max_area=args.max_area,
        extra_fg_raw=args.fg_point,
        extra_bg_raw=args.bg_point,
        edge_refine=args.edge_refine,
    )
    print(f"out_dir={output_dir}")

    if args.replace_dir:
        replace_dir = Path(args.replace_dir)
        backup_dir = Path(args.backup_dir) if args.backup_dir else Path(f"backup_pre_sam_{timestamp}")
        replace_outputs(output_dir, replace_dir, backup_dir)


if __name__ == "__main__":
    main()
