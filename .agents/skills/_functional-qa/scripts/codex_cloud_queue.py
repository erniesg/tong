#!/usr/bin/env python3
"""Generate Codex cloud issue batching and direct Codex task prompts."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from issue_router import build_issue_entry, resolve_targets
from qa_runtime import (
    CONFIG_ROOT,
    artifact_root,
    format_portability_summary,
    load_json,
    render_portability_lines,
    repo_name_with_owner,
    slugify,
    timestamp_slug,
)


CLOUD_CONFIG = load_json(CONFIG_ROOT / "codex-cloud.json")
TEMPLATE_ROOT = CONFIG_ROOT.parent / "templates"


def render_template(path: Path, replacements: dict[str, str]) -> str:
    rendered = path.read_text(encoding="utf-8")
    for needle, value in replacements.items():
        rendered = rendered.replace(needle, value)
    return rendered


def override_for(issue_ref: str | None) -> dict[str, Any] | None:
    if not issue_ref:
        return None
    for item in CLOUD_CONFIG.get("issue_overrides", []):
        if item["match"] in issue_ref:
            return item
    return None


def default_cloud_mode(raw_issue: dict[str, Any], issue_entry: dict[str, Any]) -> tuple[str, bool, str, list[str]]:
    lowered = f"{raw_issue['title']}\n{raw_issue['body']}".lower()
    project_fields = issue_entry.get("project_fields", {})
    portability = issue_entry.get("portability_preflight", {})
    portable_context = project_fields.get("Portable Context")
    if portability.get("blocking"):
        reason = "Portability preflight failed: " + format_portability_summary(portability)
        return ("local-only", True, reason, [])
    if portable_context == "No":
        reason = "Project marks `Portable Context=No`, so keep this out of unattended cloud execution for now."
        if project_fields.get("Blocked By"):
            reason += f" Blocked by: {project_fields['Blocked By']}."
        return ("local-only", True, reason, [])

    if project_fields.get("Agent Ready") == "No":
        reason = "Project marks `Agent Ready=No`, so this issue should not launch as an unattended cloud task yet."
        if project_fields.get("Blocked By"):
            reason += f" Blocked by: {project_fields['Blocked By']}."
        return ("local-only", True, reason, [])

    blockers = [] if portable_context == "Yes" else [keyword for keyword in CLOUD_CONFIG.get("local_only_keywords", []) if keyword in lowered]
    if blockers:
        return (
            "local-only",
            True,
            f"Found local-only blocker keywords: {', '.join(blockers)}.",
            [],
        )

    issue_class = issue_entry["classification"]["issue_class"]
    if issue_class in CLOUD_CONFIG.get("cloud_issue_classes_needing_local_acceptance", []):
        return (
            "cloud-ready-with-local-proof",
            True,
            f"`{issue_class}` is cloud-fixable, but final confidence still needs browser-backed local acceptance.",
            [],
        )

    return (
        "cloud-ready",
        False,
        "No known cloud blocker was detected; the issue appears reproducible from repo state plus setup.",
        [],
    )


def merge_readiness_reason(reason: str, portability: dict[str, Any]) -> str:
    if not portability:
        return reason
    if portability.get("blocking"):
        detail = "Portability preflight: " + format_portability_summary(portability)
        return reason if detail in reason else f"{reason} {detail}"
    if portability.get("warnings"):
        detail = "Portability notes: " + "; ".join(portability["warnings"])
        return reason if detail in reason else f"{reason} {detail}"
    return reason


def enforce_portability_blockers(
    cloud_mode: str,
    needs_local_acceptance: bool,
    readiness_reason: str,
    portability: dict[str, Any],
) -> tuple[str, bool, str]:
    if not portability.get("blocking") or cloud_mode == "local-only":
        return cloud_mode, needs_local_acceptance, readiness_reason

    blocked_reason = "Portability preflight failed; keep this out of unattended cloud execution until blockers are removed."
    if blocked_reason not in readiness_reason:
        readiness_reason = f"{readiness_reason} {blocked_reason}".strip()
    return ("local-only", True, readiness_reason)


def branch_name_for(issue_number: int | None, title: str) -> str:
    if issue_number is None:
        slug = slugify(title)
        return CLOUD_CONFIG["branch_pattern"].format(number="adhoc", slug=slug)
    short_slug = slugify(title)[:48]
    return CLOUD_CONFIG["branch_pattern"].format(number=issue_number, slug=short_slug)


def pr_title_for(issue_number: int | None, title: str) -> str:
    if issue_number is None:
        return f"fix: {title}"
    short_title = title[:72]
    return CLOUD_CONFIG["pr_title_pattern"].format(number=issue_number, short_title=short_title)


def batch_order_value(batch_id: str) -> int:
    for index, batch in enumerate(CLOUD_CONFIG.get("current_batches", []), start=1):
        if batch["id"] == batch_id:
            return index
    return 999


def configured_batch_for(issue_ref: str | None) -> str:
    if not issue_ref:
        return "unassigned"
    for batch in CLOUD_CONFIG.get("current_batches", []):
        for item in batch.get("issues", []):
            if item in issue_ref:
                return batch["id"]
    return "unassigned"


def issue_order_value(issue_ref: str | None, batch_id: str) -> int:
    for batch in CLOUD_CONFIG.get("current_batches", []):
        if batch["id"] != batch_id:
            continue
        for index, item in enumerate(batch.get("issues", [])):
            if issue_ref and item in issue_ref:
                return index
        return 999
    return 999


def is_dispatchable(issue: dict[str, Any]) -> bool:
    return issue["cloud_mode"] != "local-only" and issue["batch_id"] != "unassigned"


def queue_action_for(issue: dict[str, Any]) -> str:
    if issue["cloud_mode"] == "local-only":
        return "skip cloud for now"
    if issue["batch_id"] == "unassigned":
        return "hold for manual batching or split before dispatch"
    if issue["depends_on"]:
        return "launch after listed dependencies merge or are rebased into the task branch"
    return "launch a direct Codex task and create a PR from the task result"


def reviewer_evidence_expectation(issue_entry: dict[str, Any]) -> str:
    issue_class = issue_entry["classification"]["issue_class"]
    if issue_class in {"visual-layout", "localization-content", "accessibility"}:
        return (
            "Include one before/after full-frame comparison of the same UI state and one focused comparison crop of the changed region. "
            "For subtitle, translation, tooltip, or typography fixes, the focused crop should isolate the exact text region reviewers need to inspect."
        )
    if issue_entry["evidence_plan"].get("requires_ui_capture"):
        return (
            "Include reviewer-facing UI evidence in the PR body or linked comment. "
            "For timing-sensitive fixes, use ordered frames or short video/GIF evidence anchored to the proof moment."
        )
    return "Summarize the non-visual evidence inline and link any uploaded reviewer-facing artifacts."


def verification_instruction_for(issue_entry: dict[str, Any]) -> str:
    policy = issue_entry["validation_policy"]
    if policy.get("fix_allowed"):
        return "After code changes, rerun `validate-issue --verify-fix` before claiming the issue is fixed."
    return (
        f"Execution mode is `{policy.get('execution_mode', 'safe-unattended')}`. "
        "Validate, trace if needed, and stop with evidence plus a scoped proposal instead of claiming a fix."
    )


def completion_instruction_for(issue_entry: dict[str, Any]) -> str:
    if issue_entry["validation_policy"].get("fix_allowed"):
        return (
            "Return a concise final summary covering validation result, root cause, files changed, "
            "verification outcome, and reviewer-visible evidence."
        )
    return (
        "Return a concise validation summary with the reproduced behavior, root-cause hypothesis, "
        "proposed fix scope, and any blockers. Do not make unattended product changes."
    )


def lane_guidance_for(issue_entry: dict[str, Any]) -> str:
    worktree = issue_entry["recommended_worktree"]
    shared_zone_hits = issue_entry.get("shared_zone_hits", [])
    explicit_paths = issue_entry.get("explicit_paths", [])
    if shared_zone_hits:
        return (
            f"Stay within the `{worktree['id']}` lane and keep changes serialized around shared zones: "
            f"{', '.join(shared_zone_hits)}."
        )
    if explicit_paths:
        return (
            f"Prefer edits in the `{worktree['id']}` lane's owned paths. If validation forces a cross-lane change, "
            f"name the boundary and keep it minimal. Explicit paths: {', '.join(explicit_paths)}."
        )
    return (
        f"Stay within the `{worktree['id']}` lane's owned paths and avoid cross-lane edits unless validation proves "
        "the issue spans another lane."
    )


def render_validation_gate_lines_for_issue(issue_entry: dict[str, Any]) -> str:
    policy = issue_entry["validation_policy"]
    runtime_modes = policy.get("required_runtime_modes_for_fixed", [])
    lines = [
        f"- Execution mode: `{policy.get('execution_mode', 'safe-unattended')}`",
        f"- Direct issue evidence: `{'required' if policy.get('requires_direct_issue_evidence') else 'not-required'}`",
        f"- UI acceptance gate: `{'required' if policy.get('ui_acceptance_required') else 'not-required'}`",
        f"- Runtime modes to exercise for fixed claim: `{', '.join(runtime_modes) if runtime_modes else 'none specified'}`",
        f"- Live model confirmation: `{'required' if policy.get('requires_live_model_for_fixed') else 'not-required'}`",
        f"- Human review: `{'required' if policy.get('human_review_required') else 'not-required'}`",
    ]
    return "\n".join(lines)


def render_stop_conditions_for_issue(issue: dict[str, Any]) -> str:
    policy = issue["validation_policy"]
    portability = issue.get("portability_preflight", {})
    stop_conditions = list(policy.get("stop_conditions", []))
    if not policy.get("fix_allowed"):
        stop_conditions.append(
            f"Execution mode `{policy.get('execution_mode', 'safe-unattended')}` is validation-only; stop after evidence and a scoped proposal."
        )
    if issue.get("cloud_mode") == "local-only":
        stop_conditions.append("Portable context is not sufficient for unattended cloud execution; stop without code changes.")
    if portability.get("blocking"):
        stop_conditions.append(f"Portability blockers remain unresolved: {format_portability_summary(portability)}")
    if issue.get("needs_final_local_acceptance"):
        stop_conditions.append(
            "If reviewer-visible media cannot be produced from the cloud task, leave final correctness pending local/browser-backed acceptance."
        )
    if not stop_conditions:
        return "- None."
    return "\n".join(f"- {item}" for item in stop_conditions)


def build_cloud_issue(raw_issue: dict[str, Any], queue_dir: Path) -> dict[str, Any]:
    issue_entry = build_issue_entry(raw_issue)
    issue_ref = issue_entry.get("issue_ref")
    portability = issue_entry.get("portability_preflight", {})
    override = override_for(issue_ref)
    if override:
        cloud_mode = override["cloud_mode"]
        needs_local_acceptance = override["needs_final_local_acceptance"]
        readiness_reason = override["reason"]
        depends_on = override.get("depends_on", [])
        batch_id = override["batch"]
    else:
        cloud_mode, needs_local_acceptance, readiness_reason, depends_on = default_cloud_mode(raw_issue, issue_entry)
        batch_id = configured_batch_for(issue_ref)
    cloud_mode, needs_local_acceptance, readiness_reason = enforce_portability_blockers(
        cloud_mode,
        needs_local_acceptance,
        readiness_reason,
        portability,
    )
    readiness_reason = merge_readiness_reason(readiness_reason, portability)

    issue_number = issue_entry.get("number")
    effective_title = issue_entry["title"]
    if override and override.get("fallback_title") and issue_ref and issue_entry["title"].strip() == issue_ref:
        effective_title = override["fallback_title"]
    file_stub = f"issue-{issue_number}" if issue_number is not None else slugify(issue_entry["title"])
    branch_name = branch_name_for(issue_number, effective_title)
    pr_title = pr_title_for(issue_number, effective_title)
    worktree = issue_entry["recommended_worktree"]

    issue_dir = queue_dir / "issues"
    issue_dir.mkdir(exist_ok=True)
    task_prompt_path = issue_dir / f"{file_stub}-task-prompt.md"
    pr_notes_path = issue_dir / f"{file_stub}-pr-notes.md"

    replacements = {
        "{{repository}}": repo_name_with_owner(),
        "{{environment_name}}": CLOUD_CONFIG["environment_name"],
        "{{issue_ref}}": issue_ref or issue_entry["title"],
        "{{issue_url}}": raw_issue.get("html_url") or raw_issue.get("url", ""),
        "{{batch_id}}": batch_id,
        "{{worktree_id}}": worktree["id"],
        "{{worktree_branch}}": worktree["branch"],
        "{{cloud_mode}}": cloud_mode,
        "{{needs_local_acceptance}}": "yes" if needs_local_acceptance else "no",
        "{{issue_class}}": issue_entry["classification"]["issue_class"],
        "{{evidence_required}}": ", ".join(issue_entry["evidence_plan"]["required"]),
        "{{reviewer_evidence_expectation}}": reviewer_evidence_expectation(issue_entry),
        "{{initial_skill}}": issue_entry["initial_skill"],
        "{{follow_up_skills}}": "; ".join(issue_entry["follow_up_skills"]),
        "{{queue_action}}": queue_action_for(
            {
                **issue_entry,
                "cloud_mode": cloud_mode,
                "batch_id": batch_id,
                "depends_on": depends_on,
            }
        ),
        "{{verification_instruction}}": verification_instruction_for(issue_entry),
        "{{completion_instruction}}": completion_instruction_for(issue_entry),
        "{{execution_mode}}": issue_entry["validation_policy"].get("execution_mode", "safe-unattended"),
        "{{lane_guidance}}": lane_guidance_for(issue_entry),
        "{{validation_gate_lines}}": render_validation_gate_lines_for_issue(issue_entry),
        "{{stop_conditions}}": render_stop_conditions_for_issue(
            {
                **issue_entry,
                "cloud_mode": cloud_mode,
                "batch_id": batch_id,
                "depends_on": depends_on,
                "needs_final_local_acceptance": needs_local_acceptance,
            }
        ),
        "{{readiness_reason}}": readiness_reason,
        "{{suggested_pr_title}}": pr_title,
        "{{suggested_branch_name}}": branch_name,
        "{{final_acceptance_note}}": (
            "Do not send this issue to Codex cloud yet; keep it local until the blocking asset or environment dependency is removed."
            if cloud_mode == "local-only"
            else
            "Run the final local/browser-backed acceptance recording after merge."
            if needs_local_acceptance
            else "No extra local acceptance step is required beyond the normal final integration recording."
        ),
    }

    task_prompt_path.write_text(
        render_template(TEMPLATE_ROOT / "codex-cloud-task.md.tmpl", replacements) + "\n",
        encoding="utf-8",
    )
    pr_notes_path.write_text(
        render_template(TEMPLATE_ROOT / "codex-cloud-pr-notes.md.tmpl", replacements) + "\n",
        encoding="utf-8",
    )

    return {
        **issue_entry,
        "cloud_mode": cloud_mode,
        "needs_final_local_acceptance": needs_local_acceptance,
        "readiness_reason": readiness_reason,
        "depends_on": depends_on,
        "batch_id": batch_id,
        "branch_name": branch_name,
        "draft_pr_title": pr_title,
        "generated_files": {
            "task_prompt": str(task_prompt_path.relative_to(queue_dir)),
            "pr_notes": str(pr_notes_path.relative_to(queue_dir)),
        },
    }


def build_batches(issues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_id: dict[str, dict[str, Any]] = {}
    batch_meta = {item["id"]: item for item in CLOUD_CONFIG.get("current_batches", [])}
    for issue in issues:
        batch_id = issue["batch_id"]
        meta = batch_meta.get(batch_id, {"id": batch_id, "description": "Unassigned batch."})
        bucket = by_id.setdefault(
            batch_id,
            {
                "id": batch_id,
                "description": meta["description"],
                "issues": [],
            },
        )
        bucket["issues"].append(issue["issue_ref"] or issue["title"])
    return sorted(by_id.values(), key=lambda item: batch_order_value(item["id"]))


def render_markdown(plan: dict[str, Any]) -> str:
    lines = [
        "# Codex Cloud Issue Plan",
        "",
        f"- Repository: `{plan['repository']}`",
        f"- Environment: `{plan['environment_name']}`",
        f"- Generated at: `{plan['generated_at']}`",
        f"- Source: `{plan['source']}`",
        f"- Delivery mode: `{plan['delivery_mode']}`",
        f"- Suggested labels: `{', '.join(label['name'] for label in plan['label_suggestions'])}`",
        "",
        "## Recommended setup",
        "",
    ]
    for command in plan["setup_commands"]:
        lines.append(f"- `{command}`")

    lines.extend(["", "## Batches", ""])
    for batch in plan["batches"]:
        lines.append(f"### {batch['id']}")
        lines.append(batch["description"])
        lines.append(f"- Issues: {', '.join(batch['issues'])}")
        lines.append("")

    lines.extend(["## Issue Instructions", ""])
    for issue in plan["issues"]:
        label = issue["issue_ref"] or issue["title"]
        lines.extend(
            [
                f"### {label}",
                f"- Cloud mode: `{issue['cloud_mode']}`",
                f"- Batch: `{issue['batch_id']}`",
                f"- Branch: `{issue['branch_name']}`",
                f"- Draft PR title: `{issue['draft_pr_title']}`",
                f"- Worktree lane: `{issue['recommended_worktree']['id']}` -> `{issue['recommended_worktree']['branch']}`",
                f"- Start with: `{issue['initial_skill']}`",
                f"- Follow-ups: `{'; '.join(issue['follow_up_skills'])}`",
                f"- Depends on: `{', '.join(issue['depends_on']) or 'none'}`",
                f"- Portability: `{issue['portability_preflight']['status']}`",
                f"- Portability summary: {format_portability_summary(issue['portability_preflight'])}",
                f"- Readiness: {issue['readiness_reason']}",
                f"- Queue action: `{queue_action_for(issue)}`",
                f"- Task prompt: `{issue['generated_files']['task_prompt']}`",
                f"- PR notes: `{issue['generated_files']['pr_notes']}`",
            ]
        )
        for line in render_portability_lines(issue["portability_preflight"]):
            if line.startswith("- Portability preflight:") or line.startswith("- Portability summary:"):
                continue
            lines.append(line)
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def build_launch_instructions(plan: dict[str, Any]) -> str:
    lines = [
        "# Codex Launch Instructions",
        "",
        f"Use the Codex environment `{plan['environment_name']}` for implementation tasks.",
        "Start with the earliest batch only.",
        "",
    ]
    for issue in plan["issues"]:
        if not is_dispatchable(issue):
            reason = issue["readiness_reason"]
            if issue["batch_id"] == "unassigned":
                reason = f"{reason} Keep this item out of the launch queue until it is explicitly batched or split into narrower tasks."
            lines.extend(
                [
                    f"# {issue['issue_ref'] or issue['title']}",
                    "1. Skip this issue in Codex cloud for now.",
                    f"2. Reason: {reason}",
                    "",
                ]
            )
            continue
        dependency_note = (
            f"2. Only launch after `{', '.join(issue['depends_on'])}` is merged or rebased into the current branch."
            if issue["depends_on"]
            else None
        )
        lines.extend(
            [
                f"# {issue['issue_ref'] or issue['title']}",
                "1. Open `chatgpt.com/codex` and choose the configured environment.",
                *( [dependency_note] if dependency_note else [] ),
                f"{3 if dependency_note else 2}. Start a new task and paste `{issue['generated_files']['task_prompt']}`.",
                f"{4 if dependency_note else 3}. Wait for the task to finish validation, code changes, and `--verify-fix`.",
                f"{5 if dependency_note else 4}. Use Codex's built-in PR creation flow from the task result with title `{issue['draft_pr_title']}`.",
                f"{6 if dependency_note else 5}. Copy any useful merge notes from `{issue['generated_files']['pr_notes']}` into the PR if Codex does not already summarize them well.",
                f"{7 if dependency_note else 6}. Review the resulting GitHub diff before moving on to the next issue in the batch.",
                "",
            ]
        )
    return "\n".join(lines).strip() + "\n"


def build_plan(args: argparse.Namespace) -> int:
    source, targets = resolve_targets(args.targets, args.limit)
    queue_timestamp = timestamp_slug()
    queue_dir = artifact_root() / "functional-qa" / "codex-cloud-queue" / queue_timestamp
    queue_dir.mkdir(parents=True, exist_ok=True)

    issues = [build_cloud_issue(issue, queue_dir) for issue in targets]
    issues.sort(
        key=lambda item: (
            batch_order_value(item["batch_id"]),
            issue_order_value(item.get("issue_ref"), item["batch_id"]),
            item.get("number") or 99999,
            item["title"],
        )
    )
    batches = build_batches(issues)
    plan = {
        "schema_version": "1",
        "generated_at": queue_timestamp,
        "repository": repo_name_with_owner(),
        "environment_name": CLOUD_CONFIG["environment_name"],
        "delivery_mode": CLOUD_CONFIG["delivery_mode"],
        "source": source,
        "setup_commands": CLOUD_CONFIG["setup_commands"],
        "label_suggestions": CLOUD_CONFIG["label_suggestions"],
        "issues": issues,
        "batches": batches,
    }

    (queue_dir / "cloud-plan.json").write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")
    (queue_dir / "cloud-plan.md").write_text(render_markdown(plan), encoding="utf-8")
    (queue_dir / "launch.md").write_text(build_launch_instructions(plan), encoding="utf-8")
    (queue_dir / "commands.sh").write_text(
        "# Deprecated: use launch.md and the generated task prompt files for direct Codex environment tasks.\n",
        encoding="utf-8",
    )

    if args.json:
        print(json.dumps(plan, indent=2))
    else:
        print(str(queue_dir))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    plan_parser = subparsers.add_parser("plan", help="Generate the Codex cloud issue queue plan.")
    plan_parser.add_argument("targets", nargs="*", help="Issue numbers or URLs. Defaults to the open GitHub issue queue.")
    plan_parser.add_argument("--limit", type=int, default=50, help="Open issue limit when no explicit targets are given.")
    plan_parser.add_argument("--json", action="store_true", help="Print the JSON plan to stdout.")
    plan_parser.set_defaults(func=build_plan)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
