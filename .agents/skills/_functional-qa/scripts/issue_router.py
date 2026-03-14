#!/usr/bin/env python3
"""Plan GitHub issue execution across functional QA skills and worktrees."""

from __future__ import annotations

import argparse
import json
import re
import shlex
from pathlib import Path
from typing import Any

from qa_runtime import (
    apply_execution_mode_override,
    CONFIG_ROOT,
    REPO_ROOT,
    artifact_root,
    build_validation_policy,
    classification_override,
    classify_issue_text,
    evidence_plan_for,
    fetch_issue,
    format_portability_summary,
    fetch_project_overrides,
    find_previous_run,
    issue_playbook,
    load_json,
    parse_issue_ref,
    portability_preflight,
    project_control_plane,
    relative_to_repo,
    render_portability_lines,
    repo_name_with_owner,
    run_command,
    slugify,
    timestamp_slug,
)


ROUTING_CONFIG = load_json(CONFIG_ROOT / "worktree-routing.json")
PATH_PATTERN = re.compile(r"(?P<path>(?:apps|packages|scripts|docs|infra|assets|\\.github)/[A-Za-z0-9._/-]+)")


def normalize_issue(payload: dict[str, Any]) -> dict[str, Any]:
    labels = payload.get("labels", [])
    normalized_labels = []
    for label in labels:
        if isinstance(label, dict):
            normalized_labels.append(label.get("name", ""))
        else:
            normalized_labels.append(str(label))
    return {
        "number": payload.get("number"),
        "title": payload.get("title", ""),
        "body": payload.get("body", ""),
        "url": payload.get("url") or payload.get("html_url", ""),
        "labels": [label for label in normalized_labels if label],
        "issue_ref": payload.get("issue_ref"),
    }


def fetch_open_issues(limit: int) -> list[dict[str, Any]]:
    result = run_command(
        [
            "gh",
            "issue",
            "list",
            "--repo",
            repo_name_with_owner(),
            "--state",
            "open",
            "--limit",
            str(limit),
            "--json",
            "number,title,body,url,labels",
        ]
    )
    payload = json.loads(result.stdout)
    issues: list[dict[str, Any]] = []
    for item in payload:
        normalized = normalize_issue(item)
        normalized["issue_ref"] = f"{repo_name_with_owner()}#{normalized['number']}"
        issues.append(normalized)
    return issues


def resolve_targets(targets: list[str], limit: int) -> tuple[str, list[dict[str, Any]]]:
    if not targets:
        return ("open-issues", fetch_open_issues(limit))

    resolved: list[dict[str, Any]] = []
    for target in targets:
        parsed = parse_issue_ref(target)
        if parsed["kind"] == "github":
            payload = fetch_issue(target)
            if not payload:
                continue
            resolved.append(normalize_issue(payload))
        else:
            resolved.append(
                {
                    "number": None,
                    "title": target,
                    "body": "",
                    "url": "",
                    "labels": [],
                    "issue_ref": None,
                }
            )
    return ("explicit-targets", resolved)


def extract_paths(*parts: str) -> list[str]:
    hits = {match.group("path").rstrip("`.,:);]") for part in parts for match in PATH_PATTERN.finditer(part)}
    return sorted(path for path in hits if path)


def pattern_matches_path(pattern: str, path: str) -> bool:
    if pattern.endswith("/**"):
        return path.startswith(pattern[:-3])
    return path == pattern or path.startswith(pattern.rstrip("/"))


def shared_zone_hits(paths: list[str]) -> list[str]:
    hits = set()
    for path in paths:
        for pattern in ROUTING_CONFIG["shared_zones"]:
            if pattern_matches_path(pattern, path):
                hits.add(pattern)
    return sorted(hits)


def score_worktree(worktree: dict[str, Any], lowered_text: str, labels_text: str, paths: list[str], issue_class: str) -> tuple[int, list[str], int]:
    score = 0
    reasons: list[str] = []
    explicit_matches = 0

    for path in paths:
        for hint in worktree.get("path_hints", []):
            if path.startswith(hint):
                explicit_matches += 1
                score += 12
                reasons.append(f"path match `{path}` -> `{hint}`")

    keyword_matches = [keyword for keyword in worktree.get("keyword_hints", []) if keyword in lowered_text or keyword in labels_text]
    if keyword_matches:
        score += len(keyword_matches)
        reasons.append("keyword match: " + ", ".join(keyword_matches[:5]))

    if issue_class in worktree.get("issue_classes", []):
        score += 4
        reasons.append(f"class fallback: `{issue_class}`")

    return (score, reasons, explicit_matches)


def route_worktree(issue: dict[str, Any], issue_class: str, explicit_paths: list[str]) -> tuple[dict[str, Any], list[str], bool, list[str]]:
    lowered_text = f"{issue['title']}\n{issue['body']}".lower()
    labels_text = " ".join(label.lower() for label in issue.get("labels", []))
    scored: list[tuple[int, list[str], int, dict[str, Any]]] = []
    explicit_candidates: set[str] = set()
    project_fields = issue.get("project_fields", {})
    lane_field = project_control_plane().get("lane_field") if project_control_plane() else None
    preferred_lane = project_fields.get(lane_field) if lane_field else None

    for worktree in ROUTING_CONFIG["worktrees"]:
        score, reasons, explicit_matches = score_worktree(worktree, lowered_text, labels_text, explicit_paths, issue_class)
        if explicit_matches:
            explicit_candidates.add(worktree["id"])
        scored.append((score, reasons, explicit_matches, worktree))

    if preferred_lane:
        preferred = next((item for item in ROUTING_CONFIG["worktrees"] if item["id"] == preferred_lane), None)
        if preferred:
            spans_multiple = len(explicit_candidates) > 1
            reasons = [f"project field `{lane_field}` pinned worktree to `{preferred_lane}`"]
            if spans_multiple:
                reasons.append("explicit file references span multiple worktrees; keep execution serialized")
            return (preferred, reasons, spans_multiple, sorted(explicit_candidates))

    scored.sort(key=lambda item: (item[2], item[0], item[3]["id"]), reverse=True)
    top_score, reasons, explicit_matches, worktree = scored[0]

    if top_score == 0:
        fallback_id = ROUTING_CONFIG["issue_class_fallbacks"].get(issue_class, "client-runtime")
        worktree = next(item for item in ROUTING_CONFIG["worktrees"] if item["id"] == fallback_id)
        reasons = [f"no path or keyword hit; fell back to `{fallback_id}` for `{issue_class}`"]

    spans_multiple = len(explicit_candidates) > 1
    if spans_multiple:
        reasons.append("explicit file references span multiple worktrees; keep execution serialized")

    return (worktree, reasons, spans_multiple, sorted(explicit_candidates))


def choose_skills(
    issue: dict[str, Any],
    issue_class: str,
    previous_run: dict[str, Any] | None,
    validation_policy: dict[str, Any],
) -> tuple[str, list[str], str]:
    lowered_text = f"{issue['title']}\n{issue['body']}".lower()
    trace_keywords = ROUTING_CONFIG.get("trace_keywords", [])
    trace_like = issue_class in ROUTING_CONFIG.get("trace_issue_classes", []) or any(keyword in lowered_text for keyword in trace_keywords)
    execution_mode = validation_policy["execution_mode"]

    if execution_mode in {"validate-and-propose-only", "needs-human-design-review"}:
        initial_skill = "trace-ui-state" if previous_run and previous_run.get("functional", {}).get("verdict") == "ambiguous" else "validate-issue"
        follow_ups = ["trace-ui-state if validation is ambiguous or timing-sensitive", "publish-issue-update"]
        reason = f"execution mode `{execution_mode}` is validation-first; stop before unattended code changes"
        return (initial_skill, follow_ups, reason)

    if execution_mode == "requires-live-model":
        initial_skill = "trace-ui-state" if previous_run and previous_run.get("functional", {}).get("verdict") == "ambiguous" else "validate-issue"
        follow_ups = ["validate-issue --verify-fix with live-model output", "publish-issue-update"]
        reason = "fixed claims require direct issue evidence plus confirmed live-model validation"
        return (initial_skill, follow_ups, reason)

    if previous_run and previous_run.get("functional", {}).get("verdict") == "ambiguous":
        return (
            "trace-ui-state",
            ["validate-issue --verify-fix", "publish-issue-update"],
            f"previous run `{previous_run['run_id']}` ended ambiguous, so start with trace",
        )

    if trace_like:
        return (
            "validate-issue",
            ["trace-ui-state if validation is ambiguous or timing-sensitive", "validate-issue --verify-fix", "publish-issue-update"],
            "issue class or text suggests timing-sensitive validation",
        )

    return (
        "validate-issue",
        ["validate-issue --verify-fix", "publish-issue-update"],
        "default functional QA flow",
    )


def build_issue_entry(issue: dict[str, Any]) -> dict[str, Any]:
    issue_ref = issue.get("issue_ref")
    raw_text = f"{issue['title']}\n\n{issue['body']}".strip()
    project_fields = fetch_project_overrides().get(issue_ref, {}) if issue_ref else {}
    classification = classify_issue_text(raw_text)
    override = classification_override(issue_ref)
    if override:
        classification = {
            "issue_class": override,
            "signals": classification["signals"],
            "reason": f"Repo adapter override selected `{override}` for {issue_ref}.",
        }
    evidence_plan = evidence_plan_for(classification["issue_class"])
    playbook = issue_playbook(issue_ref)
    validation_policy = build_validation_policy(playbook, classification["issue_class"], evidence_plan)
    execution_mode_field = project_control_plane().get("execution_mode_field") if project_control_plane() else None
    if execution_mode_field and project_fields.get(execution_mode_field):
        validation_policy = apply_execution_mode_override(validation_policy, project_fields[execution_mode_field])
    portability = portability_preflight(
        issue,
        project_fields=project_fields,
        playbook=playbook,
        evidence_plan=evidence_plan,
    )
    explicit_paths = extract_paths(issue["title"], issue["body"])
    issue["project_fields"] = project_fields
    worktree, routing_reasons, spans_multiple_worktrees, explicit_candidates = route_worktree(issue, classification["issue_class"], explicit_paths)
    shared_hits = shared_zone_hits(explicit_paths)
    previous_run = find_previous_run(issue_ref, slugify(issue_ref or issue["title"]))
    initial_skill, follow_up_skills, flow_reason = choose_skills(issue, classification["issue_class"], previous_run, validation_policy)

    return {
        "number": issue.get("number"),
        "title": issue["title"],
        "issue_ref": issue_ref,
        "url": issue.get("url", ""),
        "labels": issue.get("labels", []),
        "project_fields": project_fields,
        "classification": classification,
        "evidence_plan": evidence_plan,
        "portability_preflight": portability,
        "validation_policy": validation_policy,
        "initial_skill": initial_skill,
        "follow_up_skills": follow_up_skills,
        "flow_reason": flow_reason,
        "explicit_paths": explicit_paths,
        "shared_zone_hits": shared_hits,
        "spans_multiple_worktrees": spans_multiple_worktrees,
        "explicit_worktree_candidates": explicit_candidates,
        "recommended_worktree": {
            "id": worktree["id"],
            "branch": worktree["branch"],
            "path": worktree["path"],
            "exists": (REPO_ROOT / worktree["path"]).exists(),
        },
        "routing_reasons": routing_reasons,
        "previous_run": (
            {
                "run_id": previous_run["run_id"],
                "verdict": previous_run.get("functional", {}).get("verdict"),
                "fix_status": previous_run.get("functional", {}).get("fix_status"),
                "run_dir": relative_to_repo(Path(previous_run["run_dir"])),
            }
            if previous_run
            else None
        ),
    }


def build_parallel_lanes(issues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    lanes: dict[str, dict[str, Any]] = {}
    for issue in issues:
        worktree = issue["recommended_worktree"]
        if issue["shared_zone_hits"] or issue["spans_multiple_worktrees"]:
            lane_id = "serialized-cross-boundary"
            mode = "serial"
            reason = "Touches shared zones or spans multiple worktrees."
        else:
            lane_id = worktree["id"]
            mode = "parallel"
            reason = f"Owns `{worktree['id']}`; serialize only within that worktree."

        lane = lanes.setdefault(
            lane_id,
            {
                "lane_id": lane_id,
                "mode": mode,
                "reason": reason,
                "worktree_id": None if lane_id == "serialized-cross-boundary" else worktree["id"],
                "branch": None if lane_id == "serialized-cross-boundary" else worktree["branch"],
                "path": None if lane_id == "serialized-cross-boundary" else worktree["path"],
                "issues": [],
            },
        )
        lane["issues"].append(issue["issue_ref"] or issue["title"])

    ordered = sorted(lanes.values(), key=lambda item: (item["mode"] != "parallel", item["lane_id"]))
    return ordered


def render_markdown(plan: dict[str, Any]) -> str:
    lines = [
        "# Issue Queue Plan",
        "",
        f"- Source: `{plan['source']}`",
        f"- Repository: `{plan['repository']}`",
        f"- Generated at: `{plan['generated_at']}`",
        f"- Setup worktrees: `{plan['setup_worktrees_command']}`",
        f"- Launch parallel session: `{plan['launch_parallel_command']}`",
    ]
    if plan["worktrees_ensured"]:
        lines.append("- Worktrees were ensured for this plan run.")

    lines.extend(["", "## Parallel Lanes", ""])
    for lane in plan["parallel_lanes"]:
        header = f"- `{lane['lane_id']}` ({lane['mode']})"
        if lane["branch"] and lane["path"]:
            header += f" -> `{lane['branch']}` at `{lane['path']}`"
        lines.append(header)
        lines.append(f"  Reason: {lane['reason']}")
        lines.append(f"  Issues: {', '.join(lane['issues'])}")

    lines.extend(["", "## Issue Routing", ""])
    for issue in plan["issues"]:
        label = issue["issue_ref"] or issue["title"]
        lines.extend(
            [
                f"### {label}",
                f"- Title: {issue['title']}",
                f"- Issue class: `{issue['classification']['issue_class']}`",
                f"- Project fields: `{', '.join(f'{key}={value}' for key, value in issue['project_fields'].items()) or 'none'}`",
                f"- Execution mode: `{issue['validation_policy']['execution_mode']}`",
                f"- Evidence plan: `{', '.join(issue['evidence_plan']['required'])}`",
                f"- Portability: `{issue['portability_preflight']['status']}`",
                f"- Portability summary: {format_portability_summary(issue['portability_preflight'])}",
                f"- Start with: `{issue['initial_skill']}`",
                f"- Follow-ups: `{'; '.join(issue['follow_up_skills'])}`",
                f"- Worktree: `{issue['recommended_worktree']['id']}` -> `{issue['recommended_worktree']['branch']}` at `{issue['recommended_worktree']['path']}`",
                f"- Routing reason: {'; '.join(issue['routing_reasons'])}",
                f"- Flow reason: {issue['flow_reason']}",
                f"- Direct issue evidence required: `{'yes' if issue['validation_policy']['requires_direct_issue_evidence'] else 'no'}`",
                f"- Live model required for fixed: `{'yes' if issue['validation_policy']['requires_live_model_for_fixed'] else 'no'}`",
                f"- Human review required: `{'yes' if issue['validation_policy']['human_review_required'] else 'no'}`",
                f"- Shared-zone hits: `{', '.join(issue['shared_zone_hits']) or 'none'}`",
            ]
        )
        for line in render_portability_lines(issue["portability_preflight"]):
            if line.startswith("- Portability preflight:") or line.startswith("- Portability summary:"):
                continue
            lines.append(line)
        if issue["validation_policy"]["stop_conditions"]:
            lines.append(f"- Stop conditions: {'; '.join(issue['validation_policy']['stop_conditions'])}")
        if issue["explicit_paths"]:
            lines.append(f"- Explicit paths: `{', '.join(issue['explicit_paths'])}`")
        if issue["previous_run"]:
            lines.append(
                f"- Previous run: `{issue['previous_run']['run_id']}` ({issue['previous_run']['verdict']}, {issue['previous_run']['fix_status']})"
            )
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def ensure_worktrees() -> None:
    command = shlex.split(ROUTING_CONFIG["setup_worktrees_command"])
    run_command(command)


def build_plan(args: argparse.Namespace) -> int:
    source, targets = resolve_targets(args.targets, args.limit)
    planned_issues = [build_issue_entry(issue) for issue in targets]
    lanes = build_parallel_lanes(planned_issues)
    queue_timestamp = timestamp_slug()
    queue_dir = artifact_root() / "functional-qa" / "issue-queue" / queue_timestamp
    queue_dir.mkdir(parents=True, exist_ok=True)

    worktrees_ensured = False
    if args.ensure_worktrees and planned_issues:
        ensure_worktrees()
        for issue in planned_issues:
            issue["recommended_worktree"]["exists"] = (REPO_ROOT / issue["recommended_worktree"]["path"]).exists()
        worktrees_ensured = True

    plan = {
        "schema_version": "1",
        "generated_at": queue_timestamp,
        "source": source,
        "repository": repo_name_with_owner(),
        "setup_worktrees_command": ROUTING_CONFIG["setup_worktrees_command"],
        "launch_parallel_command": ROUTING_CONFIG["launch_parallel_command"],
        "worktrees_ensured": worktrees_ensured,
        "issues": planned_issues,
        "parallel_lanes": lanes,
    }

    (queue_dir / "queue-plan.json").write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")
    (queue_dir / "queue-plan.md").write_text(render_markdown(plan), encoding="utf-8")

    if args.json:
        print(json.dumps(plan, indent=2))
    else:
        print(str(queue_dir))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    plan_parser = subparsers.add_parser("plan", help="Plan issue routing and parallel execution.")
    plan_parser.add_argument("targets", nargs="*", help="Issue numbers, issue URLs, or descriptions. Defaults to open issues.")
    plan_parser.add_argument(
        "--limit",
        type=int,
        default=ROUTING_CONFIG["default_open_issue_limit"],
        help="Number of open issues to fetch when no explicit targets are given.",
    )
    plan_parser.add_argument("--ensure-worktrees", action="store_true", help="Run the repo worktree setup command after planning.")
    plan_parser.add_argument("--json", action="store_true", help="Print the queue plan JSON to stdout.")
    plan_parser.set_defaults(func=build_plan)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
