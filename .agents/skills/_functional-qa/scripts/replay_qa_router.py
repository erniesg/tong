#!/usr/bin/env python3
"""Normalize rrweb replay pins into QA findings and route them idempotently."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from qa_runtime import REPO_ROOT, artifact_root, repo_name_with_owner, slugify, timestamp_slug


PUBLIC_PROOF_RE = re.compile(r"^https?://", re.IGNORECASE)
DEFAULT_LEDGER = artifact_root() / "functional-qa" / "replay-findings" / "ledger.json"
DEFAULT_SUMMARY_ROOT = artifact_root() / "functional-qa" / "replay-routing"
SAFE_DECISIONS = {"new_issue", "update_issue", "direct_pr", "human_review", "skip"}
PROTECTED_PATH_PREFIXES = (
    ".github/workflows/",
    "infra/",
    "scripts/deploy",
    "scripts/release",
)


def utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def clean_text(value: Any, *, fallback: str = "") -> str:
    text = str(value or fallback).strip()
    return re.sub(r"\s+", " ", text)


def parse_timestamp_ms(value: str | int | float | None) -> int:
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return max(0, int(round(value)))
    raw = str(value).strip()
    if not raw:
        return 0
    if ":" in raw:
        parts = [float(part) for part in raw.split(":")]
        seconds = 0.0
        for part in parts:
            seconds = seconds * 60 + part
        return max(0, int(round(seconds * 1000)))
    number = float(raw)
    return max(0, int(round(number if number > 1000 else number * 1000)))


def severity_to_label(value: int) -> str:
    if value >= 5:
        return "critical"
    if value >= 4:
        return "high"
    if value >= 3:
        return "medium"
    return "low"


def normalize_proof_urls(payload: dict[str, Any]) -> dict[str, str]:
    proof = payload.get("proof") if isinstance(payload.get("proof"), dict) else {}
    urls = {
        "public_proof_url": payload.get("proofUrl") or payload.get("proof_url") or proof.get("publicProofUrl") or proof.get("public_proof_url"),
        "render_artifact_url": payload.get("renderUrl") or payload.get("render_url") or proof.get("renderArtifactUrl") or proof.get("render_artifact_url"),
        "frame_url": payload.get("frameUrl") or payload.get("frame_url") or proof.get("frameUrl") or proof.get("frame_url"),
    }
    return {key: clean_text(value) for key, value in urls.items() if clean_text(value)}


def public_proof_available(finding: dict[str, Any]) -> bool:
    proof = finding.get("proof") or {}
    return any(PUBLIC_PROOF_RE.match(str(proof.get(key, ""))) for key in ("public_proof_url", "render_artifact_url", "frame_url"))


def build_dedupe_key(fields: dict[str, Any]) -> str:
    bucket_ms = (int(fields["replay_timestamp_ms"]) // 5000) * 5000
    seed = "|".join(
        [
            fields["session_id"],
            fields["surface"],
            fields["route"],
            str(bucket_ms),
            fields["component_hint"].lower(),
            slugify(fields["title"] or fields["description"])[:80],
        ]
    )
    return "rrweb-" + hashlib.sha256(seed.encode("utf-8")).hexdigest()[:16]


def normalize_finding(raw: dict[str, Any]) -> dict[str, Any]:
    session_id = clean_text(raw.get("sessionId") or raw.get("session_id"))
    if not session_id:
        raise ValueError("finding is missing `sessionId`/`session_id`")

    timestamp_ms = parse_timestamp_ms(
        raw.get("replayTimestampMs")
        or raw.get("replay_timestamp_ms")
        or raw.get("timestampMs")
        or raw.get("timestamp")
    )
    route = clean_text(raw.get("route") or raw.get("url") or "unknown")
    surface = clean_text(raw.get("surface") or raw.get("routeSurface") or "playtest-replay")
    title = clean_text(raw.get("title") or raw.get("summary") or raw.get("description") or "Replay-reviewed UX finding")
    description = clean_text(raw.get("description") or raw.get("details") or title)
    severity = int(raw.get("severity") or raw.get("severityScore") or 3)
    component_hint = clean_text(raw.get("componentHint") or raw.get("component_hint") or raw.get("affectedComponent") or "unknown")
    proof = normalize_proof_urls(raw)
    if not proof:
        proof = {"public_proof_url": f"https://runs.tong.berlayar.ai/playtest/{session_id}/rrweb-render.webm"}

    finding = {
        "schema_version": "1",
        "finding_type": "rrweb_replay_pin",
        "dedupe_key": "",
        "session_id": session_id,
        "replay_timestamp_ms": timestamp_ms,
        "replay_timestamp": f"{timestamp_ms / 1000:.3f}s",
        "surface": surface,
        "route": route,
        "title": title,
        "description": description,
        "severity": max(1, min(5, severity)),
        "severity_label": severity_to_label(severity),
        "component_hint": component_hint,
        "proof": proof,
        "source": {
            "kind": clean_text(raw.get("sourceKind") or raw.get("source_kind") or "backstage-rrweb-pin"),
            "annotation_id": clean_text(raw.get("annotationId") or raw.get("annotation_id")),
        },
        "created_at": clean_text(raw.get("createdAt") or raw.get("created_at") or utc_iso()),
    }
    finding["dedupe_key"] = clean_text(raw.get("dedupeKey") or raw.get("dedupe_key")) or build_dedupe_key(finding)
    return finding


def load_ledger(path: Path) -> dict[str, Any]:
    if path.exists():
        ledger = read_json(path)
    else:
        ledger = {"schema_version": "1", "findings": []}
    ledger.setdefault("schema_version", "1")
    ledger.setdefault("findings", [])
    return ledger


def upsert_ledger(path: Path, finding: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any], str]:
    ledger = load_ledger(path)
    now = utc_iso()
    for idx, existing in enumerate(ledger["findings"]):
        if existing.get("dedupe_key") == finding["dedupe_key"]:
            merged = {**existing, **finding, "first_seen_at": existing.get("first_seen_at") or now, "last_seen_at": now}
            if existing.get("github"):
                merged["github"] = existing["github"]
            ledger["findings"][idx] = merged
            write_json(path, ledger)
            return ledger, merged, "updated"
    finding = {**finding, "first_seen_at": now, "last_seen_at": now}
    ledger["findings"].append(finding)
    write_json(path, ledger)
    return ledger, finding, "created"


def find_existing_issue(finding: dict[str, Any], ledger: dict[str, Any], repo: str) -> dict[str, Any] | None:
    for item in ledger.get("findings", []):
        if item.get("dedupe_key") == finding["dedupe_key"] and item.get("github", {}).get("issue_ref"):
            return item["github"]

    query = f'"{finding["dedupe_key"]}" repo:{repo} is:issue'
    result = subprocess.run(
        ["gh", "issue", "list", "--repo", repo, "--search", query, "--state", "all", "--limit", "1", "--json", "number,title,url,state"],
        cwd=str(REPO_ROOT),
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        return None
    matches = json.loads(result.stdout or "[]")
    if not matches:
        return None
    match = matches[0]
    return {
        "issue_ref": f"{repo}#{match['number']}",
        "issue_number": match["number"],
        "url": match.get("url"),
        "state": match.get("state"),
        "match": "github-search",
    }


def has_protected_paths(paths: list[str]) -> bool:
    return any(path.startswith(PROTECTED_PATH_PREFIXES) for path in paths)


def direct_pr_gate(args: argparse.Namespace, finding: dict[str, Any]) -> tuple[bool, list[str]]:
    blockers: list[str] = []
    if not args.safe_unattended:
        blockers.append("safe-unattended policy was not asserted")
    if not args.portable_context:
        blockers.append("portable context was not asserted")
    if args.lane_count != 1:
        blockers.append(f"finding spans {args.lane_count} lanes")
    if not public_proof_available(finding):
        blockers.append("reviewer-visible proof URL is missing")
    if has_protected_paths(args.touched_path):
        blockers.append("candidate touches protected paths")
    if args.design_ambiguous:
        blockers.append("finding is design-ambiguous and needs human review")
    return (not blockers, blockers)


def acceptance_checks(finding: dict[str, Any]) -> list[str]:
    proof = finding.get("proof") or {}
    render = proof.get("render_artifact_url") or proof.get("public_proof_url")
    return [
        f"Open the rrweb replay/render for session `{finding['session_id']}`.",
        f"Seek to `{finding['replay_timestamp']}` and verify the visible failure described in this issue.",
        f"After the fix, rerender or cite the same replay path (`{render}`) and capture reviewer-visible proof around the same timestamp.",
        "Post the verification proof to the issue or PR before marking fixed.",
    ]


def render_issue_body(finding: dict[str, Any], decision: dict[str, Any]) -> str:
    proof = finding.get("proof") or {}
    lines = [
        "## Replay Finding",
        "",
        finding["description"],
        "",
        "## Metadata",
        "",
        f"- Dedupe key: `{finding['dedupe_key']}`",
        f"- Session: `{finding['session_id']}`",
        f"- Replay timestamp: `{finding['replay_timestamp']}`",
        f"- Surface: `{finding['surface']}`",
        f"- Route: `{finding['route']}`",
        f"- Severity: `{finding['severity_label']}` ({finding['severity']}/5)",
        f"- Component hint: `{finding['component_hint']}`",
        "",
        "## Proof",
        "",
    ]
    for label, key in (("Public proof", "public_proof_url"), ("Render artifact", "render_artifact_url"), ("Pinned frame", "frame_url")):
        if proof.get(key):
            lines.append(f"- {label}: {proof[key]}")
    lines.extend(["", "## Acceptance Checks", ""])
    lines.extend(f"- {check}" for check in acceptance_checks(finding))
    lines.extend(["", "## Routing", ""])
    lines.append(f"- Decision: `{decision['decision']}`")
    lines.append(f"- Reason: {decision['reason']}")
    lines.append(f"- Confidence: `{decision['confidence']:.2f}`")
    return "\n".join(lines).strip() + "\n"


def choose_decision(args: argparse.Namespace, finding: dict[str, Any], existing_issue: dict[str, Any] | None) -> dict[str, Any]:
    if not public_proof_available(finding):
        return {"decision": "skip", "reason": "missing reviewer-visible proof URL", "confidence": 0.35}
    if existing_issue:
        return {
            "decision": "update_issue",
            "reason": f"dedupe key matches existing issue {existing_issue.get('issue_ref')}",
            "confidence": 0.94,
            "github": existing_issue,
        }
    direct_ok, blockers = direct_pr_gate(args, finding)
    if args.prefer_direct_pr and direct_ok:
        return {"decision": "direct_pr", "reason": "safe direct PR gates passed", "confidence": 0.82}
    if args.prefer_direct_pr and blockers:
        return {"decision": "human_review", "reason": "direct PR blocked: " + "; ".join(blockers), "confidence": 0.72}
    return {"decision": "new_issue", "reason": "no existing issue matched the dedupe key", "confidence": 0.86}


def apply_github_mutation(args: argparse.Namespace, finding: dict[str, Any], decision: dict[str, Any]) -> dict[str, Any]:
    repo = args.repo
    body = render_issue_body(finding, decision)
    if decision["decision"] == "new_issue":
        result = subprocess.run(
            ["gh", "issue", "create", "--repo", repo, "--title", finding["title"], "--body", body, "--label", "playtest-triage"],
            cwd=str(REPO_ROOT),
            text=True,
            capture_output=True,
            check=False,
        )
    elif decision["decision"] == "update_issue":
        issue_ref = decision.get("github", {}).get("issue_ref", "")
        number = issue_ref.rsplit("#", 1)[-1]
        result = subprocess.run(
            ["gh", "issue", "comment", number, "--repo", repo, "--body", body],
            cwd=str(REPO_ROOT),
            text=True,
            capture_output=True,
            check=False,
        )
    else:
        return {"applied": False, "reason": f"decision `{decision['decision']}` has no GitHub mutation"}

    if result.returncode != 0:
        return {"applied": False, "error": result.stderr.strip() or result.stdout.strip()}
    return {"applied": True, "url": result.stdout.strip()}


def build_routing_summary(args: argparse.Namespace, finding: dict[str, Any], ledger: dict[str, Any]) -> dict[str, Any]:
    existing_issue = find_existing_issue(finding, ledger, args.repo)
    decision = choose_decision(args, finding, existing_issue)
    if decision["decision"] not in SAFE_DECISIONS:
        raise ValueError(f"invalid routing decision: {decision['decision']}")
    summary = {
        "schema_version": "1",
        "generated_at": utc_iso(),
        "dry_run": not args.apply,
        "repo": args.repo,
        "finding": finding,
        "routing": decision,
        "issue_body": render_issue_body(finding, decision),
        "verification": {
            "reuses_rrweb_evidence": True,
            "commands": [
                f"node scripts/render-rrweb-video.mjs --session-id {finding['session_id']} --output artifacts/qa-runs/functional-qa/replay-routing/{finding['dedupe_key']}/rrweb-render.webm",
                "npm run qa:upload-evidence -- --run-dir <verify-run-dir> --include-supporting",
            ],
            "checks": acceptance_checks(finding),
        },
    }
    if args.apply:
        summary["github_mutation"] = apply_github_mutation(args, finding, decision)
    return summary


def command_normalize(args: argparse.Namespace) -> int:
    raw = read_json(Path(args.input)) if args.input else vars(args)
    finding = normalize_finding(raw)
    output = Path(args.output) if args.output else DEFAULT_SUMMARY_ROOT / timestamp_slug() / "finding.json"
    write_json(output, finding)
    print(str(output))
    return 0


def command_route(args: argparse.Namespace) -> int:
    finding = normalize_finding(read_json(Path(args.finding)))
    ledger, ledger_finding, action = upsert_ledger(Path(args.ledger), finding)
    summary = build_routing_summary(args, ledger_finding, ledger)
    summary["ledger"] = {"path": str(Path(args.ledger)), "action": action}
    output = Path(args.output) if args.output else DEFAULT_SUMMARY_ROOT / timestamp_slug() / "dispatch-summary.json"
    write_json(output, summary)
    markdown = [
        "# Replay QA Dispatch Summary",
        "",
        f"- Finding: `{ledger_finding['dedupe_key']}`",
        f"- Ledger action: `{action}`",
        f"- Routing decision: `{summary['routing']['decision']}`",
        f"- Reason: {summary['routing']['reason']}",
        f"- Confidence: `{summary['routing']['confidence']:.2f}`",
        f"- Dry run: `{str(summary['dry_run']).lower()}`",
        f"- Proof: `{(ledger_finding.get('proof') or {}).get('public_proof_url', 'n/a')}`",
        "",
        "## Verification",
        "",
    ]
    markdown.extend(f"- {check}" for check in summary["verification"]["checks"])
    output.with_suffix(".md").write_text("\n".join(markdown).strip() + "\n", encoding="utf-8")
    print(str(output))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    normalize = sub.add_parser("normalize", help="Normalize a raw replay pin or analysis finding.")
    normalize.add_argument("--input", help="Raw finding JSON. Omit to use CLI fields.")
    normalize.add_argument("--output")
    normalize.add_argument("--session-id")
    normalize.add_argument("--timestamp")
    normalize.add_argument("--route")
    normalize.add_argument("--surface")
    normalize.add_argument("--proof-url")
    normalize.add_argument("--render-url")
    normalize.add_argument("--frame-url")
    normalize.add_argument("--severity", type=int, default=3)
    normalize.add_argument("--component-hint", default="unknown")
    normalize.add_argument("--title", default="Replay-reviewed UX finding")
    normalize.add_argument("--description", default="")
    normalize.set_defaults(func=command_normalize)

    route = sub.add_parser("route", help="Upsert the replay finding and route it to issue/PR/human review.")
    route.add_argument("--finding", required=True)
    route.add_argument("--ledger", default=str(DEFAULT_LEDGER))
    route.add_argument("--output")
    route.add_argument("--repo", default=repo_name_with_owner())
    route.add_argument("--apply", action="store_true", help="Mutate GitHub. Default is dry-run only.")
    route.add_argument("--prefer-direct-pr", action="store_true")
    route.add_argument("--safe-unattended", action="store_true")
    route.add_argument("--portable-context", action="store_true")
    route.add_argument("--lane-count", type=int, default=1)
    route.add_argument("--touched-path", action="append", default=[])
    route.add_argument("--design-ambiguous", action="store_true")
    route.set_defaults(func=command_route)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
