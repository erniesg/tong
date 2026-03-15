#!/usr/bin/env python3
"""Validate and render a reviewer-proof pack from a QA run bundle."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCRIPT_PATH = Path(__file__).resolve()
REPO_ROOT = SCRIPT_PATH.parents[4]
REQUIRED_FRAME_STAGES = (
    "pre_action",
    "ready_state",
    "immediate_post_input",
    "later_transition",
    "stable_post_action",
)
REQUIRED_CUE_KEYS = (
    "ready_state",
    "input",
    "immediate_post_input",
    "later_transition",
    "stable_post_action",
)
REQUIRED_CHECKS = (
    "real_route",
    "semantically_coherent",
    "ready_state_legible",
    "input_visible",
    "pre_action_hold",
    "stable_post_action",
)
STAGE_LABELS = {
    "pre_action": "Pre-action",
    "ready_state": "Ready state",
    "immediate_post_input": "Immediate post-input",
    "later_transition": "Later transition",
    "stable_post_action": "Stable post-action",
}


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def relative_to_repo(path: Path) -> str:
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build reviewer-proof metadata from an existing QA run.")
    parser.add_argument("--run-dir", required=True, help="Path to the QA run directory.")
    return parser.parse_args()


def normalize_artifact_entry(entry: Any) -> dict[str, Any]:
    if isinstance(entry, str):
        return {"path": entry}
    if isinstance(entry, dict):
        return dict(entry)
    return {}


def artifact_lookup(upload_manifest: dict[str, Any]) -> dict[str, dict[str, Any]]:
    mapping: dict[str, dict[str, Any]] = {}
    for artifact in upload_manifest.get("artifacts", []):
        local_path = artifact.get("local_path")
        relative_run_path = artifact.get("relative_run_path")
        if local_path:
            mapping[str(local_path)] = artifact
        if relative_run_path:
            mapping[str(relative_run_path)] = artifact
        if local_path:
            mapping[Path(str(local_path)).name] = artifact
        if relative_run_path:
            mapping[Path(str(relative_run_path)).name] = artifact
    return mapping


def resolve_artifact(entry: Any, upload_lookup: dict[str, dict[str, Any]]) -> dict[str, Any]:
    normalized = normalize_artifact_entry(entry)
    candidate_path = normalized.get("path") or normalized.get("local_path") or normalized.get("relative_run_path") or ""
    artifact = upload_lookup.get(str(candidate_path)) or upload_lookup.get(Path(str(candidate_path)).name)
    resolved = {
        "path": candidate_path,
        "label": normalized.get("label") or (artifact or {}).get("label"),
        "description": normalized.get("description") or (artifact or {}).get("description"),
        "url": normalized.get("url") or (artifact or {}).get("url"),
        "artifact_id": normalized.get("artifact_id") or (artifact or {}).get("id"),
    }
    return resolved


def route_is_real(route: str) -> bool:
    if not route or not route.startswith("/game"):
        return False
    return "dev=exercise" not in route


def format_ms(value: Any) -> str | None:
    if isinstance(value, (int, float)):
        return f"+{int(value)}ms"
    return None


def build_missing_requirements(
    reviewer_proof: dict[str, Any],
    frames: dict[str, dict[str, Any]],
    proof_video: dict[str, Any],
    gif_preview: dict[str, Any],
) -> list[str]:
    missing: list[str] = []
    classification = reviewer_proof.get("classification") or "not-evaluated"

    if classification not in {"reviewer-proof", "trace-only"}:
        missing.append("classification must be `reviewer-proof` or `trace-only`")
        return missing

    route = reviewer_proof.get("route", "")
    checks = reviewer_proof.get("checks") or {}
    cue_timestamps_ms = reviewer_proof.get("cue_timestamps_ms") or {}

    if classification == "trace-only":
        if not reviewer_proof.get("notes"):
            missing.append("trace-only packs need a note explaining why the capture is not reviewer-ready")
        return missing

    if not route:
        missing.append("route is required")
    elif not route_is_real(route):
        missing.append("route must use the real `/game` surface and not the isolated `?dev=exercise` tester")

    for key in REQUIRED_CHECKS:
        if not checks.get(key):
            missing.append(f"check `{key}` must be true for reviewer-proof classification")

    if not checks.get("reviewer_visible_media", False):
        missing.append("check `reviewer_visible_media` must be true for reviewer-proof classification")

    for stage in REQUIRED_FRAME_STAGES:
        if not frames.get(stage, {}).get("path"):
            missing.append(f"ordered frame `{stage}` is required")
        if not frames.get(stage, {}).get("url"):
            missing.append(f"ordered frame `{stage}` must have a reviewer-visible URL")

    if not proof_video.get("path"):
        missing.append("proof video is required")
    if not proof_video.get("url"):
        missing.append("proof video must have a reviewer-visible URL")
    if not gif_preview.get("path"):
        missing.append("GIF preview is required")
    if not gif_preview.get("url"):
        missing.append("GIF preview must have a reviewer-visible URL")

    for cue_key in REQUIRED_CUE_KEYS:
        if cue_key not in cue_timestamps_ms:
            missing.append(f"cue timestamp `{cue_key}` is required")

    return missing


def render_markdown(proof_pack: dict[str, Any]) -> str:
    lines = [
        "## Reviewer Proof",
        "",
        f"- Status: `{proof_pack['status']}`",
        f"- Route: `{proof_pack.get('route') or 'n/a'}`",
    ]

    if proof_pack.get("scenario_seed"):
        lines.append(f"- Scenario seed: `{proof_pack['scenario_seed']}`")

    deterministic_setup = proof_pack.get("deterministic_setup") or {}
    if deterministic_setup.get("used"):
        description = deterministic_setup.get("description") or "Used only to reach the near-proof state."
        lines.append(f"- Deterministic setup: {description}")

    cue_timestamps = proof_pack.get("cue_timestamps_ms") or {}
    if cue_timestamps:
        formatted = []
        for key in REQUIRED_CUE_KEYS:
            label = STAGE_LABELS.get(key, key.replace("_", " "))
            value = format_ms(cue_timestamps.get(key))
            if value:
                formatted.append(f"{label} {value}")
        if formatted:
            lines.append(f"- Cue timestamps: {', '.join(formatted)}")

    media = proof_pack.get("media") or {}
    proof_video = media.get("proof_video") or {}
    gif_preview = media.get("gif_preview") or {}
    if proof_video.get("url"):
        lines.append(f"- Proof clip: [{Path(proof_video['path']).name}]({proof_video['url']})")
    if gif_preview.get("url"):
        lines.append(f"- GIF preview: [{Path(gif_preview['path']).name}]({gif_preview['url']})")

    ordered_frames = proof_pack.get("ordered_frames") or {}
    if ordered_frames:
        lines.extend(["", "### Ordered Frames", ""])
        for stage in REQUIRED_FRAME_STAGES:
            frame = ordered_frames.get(stage) or {}
            if not frame.get("url"):
                continue
            label = STAGE_LABELS[stage]
            description = frame.get("description") or frame.get("label") or ""
            suffix = f" - {description}" if description else ""
            lines.append(f"- {label}: [{Path(frame['path']).name}]({frame['url']}){suffix}")

    if proof_pack.get("notes"):
        lines.extend(["", "### Notes", ""])
        lines.extend(f"- {note}" for note in proof_pack["notes"])

    if proof_pack.get("missing_requirements"):
        lines.extend(["", "### Missing Requirements", ""])
        lines.extend(f"- {item}" for item in proof_pack["missing_requirements"])

    return "\n".join(lines) + "\n"


def main() -> int:
    args = parse_args()
    run_dir = Path(args.run_dir).resolve()
    evidence_path = run_dir / "evidence.json"
    run_path = run_dir / "run.json"
    upload_manifest_path = run_dir / "upload-manifest.json"

    evidence = load_json(evidence_path)
    run = load_json(run_path)
    reviewer_proof = dict(evidence.get("reviewer_proof") or {})
    classification = reviewer_proof.get("classification") or "not-evaluated"
    if classification == "not-evaluated":
        print("Reviewer proof classification is `not-evaluated`; nothing to do.")
        return 0

    upload_manifest = load_json(upload_manifest_path) if upload_manifest_path.exists() else {}
    upload_lookup = artifact_lookup(upload_manifest)

    artifacts = reviewer_proof.get("artifacts") or {}
    proof_video = resolve_artifact(artifacts.get("proof_video"), upload_lookup)
    gif_preview = resolve_artifact(artifacts.get("gif_preview"), upload_lookup)
    if not gif_preview.get("path"):
        gif_preview = resolve_artifact(
            {
                "path": ((upload_manifest.get("primary") or {}).get("gif_preview") or {}).get("local_path", ""),
            },
            upload_lookup,
        )

    frames = {
        stage: resolve_artifact((reviewer_proof.get("ordered_frames") or {}).get(stage), upload_lookup)
        for stage in REQUIRED_FRAME_STAGES
    }

    if frames.get("ready_state", {}).get("url") and proof_video.get("url") and gif_preview.get("url"):
        reviewer_proof.setdefault("checks", {})["reviewer_visible_media"] = True

    missing_requirements = build_missing_requirements(reviewer_proof, frames, proof_video, gif_preview)
    status = "reviewer-proof" if classification == "reviewer-proof" and not missing_requirements else "trace-only" if classification == "trace-only" else "incomplete"

    proof_pack = {
        "schema_version": "1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "classification": classification,
        "issue_ref": run.get("issue_ref"),
        "surface": reviewer_proof.get("surface") or "/game",
        "route": reviewer_proof.get("route") or "",
        "scenario_seed": reviewer_proof.get("scenario_seed") or "",
        "proof_moment": reviewer_proof.get("proof_moment") or "",
        "deterministic_setup": reviewer_proof.get("deterministic_setup") or {"used": False, "description": ""},
        "checks": reviewer_proof.get("checks") or {},
        "cue_timestamps_ms": reviewer_proof.get("cue_timestamps_ms") or {},
        "media": {
            "proof_video": proof_video,
            "gif_preview": gif_preview,
            "uploaded_manifest": {
                "path": relative_to_repo(upload_manifest_path) if upload_manifest_path.exists() else "",
                "url": upload_manifest.get("manifest_url"),
            },
        },
        "ordered_frames": frames,
        "notes": reviewer_proof.get("notes") or [],
        "missing_requirements": missing_requirements,
    }

    reviewer_proof.update(
        {
            "status": status,
            "checks": proof_pack["checks"],
            "missing_requirements": missing_requirements,
            "artifacts": {
                "proof_video": proof_video.get("path", ""),
                "gif_preview": gif_preview.get("path", ""),
            },
        }
    )
    evidence["reviewer_proof"] = reviewer_proof
    write_json(evidence_path, evidence)

    reviewer_proof_json_path = run_dir / "reviewer-proof.json"
    reviewer_proof_md_path = run_dir / "reviewer-proof.md"
    write_json(reviewer_proof_json_path, proof_pack)
    reviewer_proof_md_path.write_text(render_markdown(proof_pack), encoding="utf-8")

    if upload_manifest:
        upload_manifest["reviewer_proof"] = {
            **proof_pack,
            "json_path": relative_to_repo(reviewer_proof_json_path),
            "snippet_path": relative_to_repo(reviewer_proof_md_path),
        }
        write_json(upload_manifest_path, upload_manifest)

    print(relative_to_repo(reviewer_proof_md_path))
    if status == "incomplete":
        print("Reviewer-proof pack is incomplete.", flush=True)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
