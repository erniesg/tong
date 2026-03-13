#!/usr/bin/env python3
"""Generate Codex cloud issue batching and PR/task prompts."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from issue_router import build_issue_entry, resolve_targets
from qa_runtime import CONFIG_ROOT, artifact_root, load_json, repo_name_with_owner, slugify, timestamp_slug


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
    blockers = [keyword for keyword in CLOUD_CONFIG.get("local_only_keywords", []) if keyword in lowered]
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


def build_cloud_issue(raw_issue: dict[str, Any], queue_dir: Path) -> dict[str, Any]:
    issue_entry = build_issue_entry(raw_issue)
    issue_ref = issue_entry.get("issue_ref")
    override = override_for(issue_ref)
    if override:
        cloud_mode = override["cloud_mode"]
        needs_local_acceptance = override["needs_final_local_acceptance"]
        readiness_reason = override["reason"]
        depends_on = override.get("depends_on", [])
        batch_id = override["batch"]
    else:
        cloud_mode, needs_local_acceptance, readiness_reason, depends_on = default_cloud_mode(raw_issue, issue_entry)
        batch_id = "unassigned"

    issue_number = issue_entry.get("number")
    file_stub = f"issue-{issue_number}" if issue_number is not None else slugify(issue_entry["title"])
    branch_name = branch_name_for(issue_number, issue_entry["title"])
    pr_title = pr_title_for(issue_number, issue_entry["title"])
    worktree = issue_entry["recommended_worktree"]

    issue_dir = queue_dir / "issues"
    issue_dir.mkdir(exist_ok=True)
    comment_path = issue_dir / f"{file_stub}-codex-comment.md"
    pr_body_path = issue_dir / f"{file_stub}-pr-body.md"

    replacements = {
        "{{issue_ref}}": issue_ref or issue_entry["title"],
        "{{issue_url}}": raw_issue.get("url", ""),
        "{{batch_id}}": batch_id,
        "{{worktree_id}}": worktree["id"],
        "{{worktree_branch}}": worktree["branch"],
        "{{cloud_mode}}": cloud_mode,
        "{{needs_local_acceptance}}": "yes" if needs_local_acceptance else "no",
        "{{initial_skill}}": issue_entry["initial_skill"],
        "{{follow_up_skills}}": "; ".join(issue_entry["follow_up_skills"]),
        "{{readiness_reason}}": readiness_reason,
        "{{comment_path}}": str(comment_path.relative_to(queue_dir)),
        "{{final_acceptance_note}}": (
            "Do not send this issue to Codex cloud yet; keep it local until the blocking asset or environment dependency is removed."
            if cloud_mode == "local-only"
            else
            "Run the final local/browser-backed acceptance recording after merge."
            if needs_local_acceptance
            else "No extra local acceptance step is required beyond the normal final integration recording."
        ),
    }

    pr_body_path.write_text(
        render_template(TEMPLATE_ROOT / "codex-cloud-pr-body.md.tmpl", replacements) + "\n",
        encoding="utf-8",
    )
    comment_path.write_text(
        render_template(TEMPLATE_ROOT / "codex-cloud-comment.md.tmpl", replacements) + "\n",
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
            "comment": str(comment_path.relative_to(queue_dir)),
            "pr_body": str(pr_body_path.relative_to(queue_dir)),
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
        f"- Generated at: `{plan['generated_at']}`",
        f"- Source: `{plan['source']}`",
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
                f"- Readiness: {issue['readiness_reason']}",
                f"- Queue action: `{'skip cloud for now' if issue['cloud_mode'] == 'local-only' else 'open draft PR and hand to Codex'}`",
                f"- Generated PR body: `{issue['generated_files']['pr_body']}`",
                f"- Generated Codex comment: `{issue['generated_files']['comment']}`",
            ]
        )
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def build_commands(plan: dict[str, Any]) -> str:
    lines = ["# Review the generated PR body and Codex comment files before running these commands.", ""]
    for issue in plan["issues"]:
        if issue["cloud_mode"] == "local-only":
            lines.extend(
                [
                    f"# {issue['issue_ref'] or issue['title']}",
                    "# Skip this issue in Codex cloud for now.",
                    f"# Reason: {issue['readiness_reason']}",
                    "",
                ]
            )
            continue
        branch = issue["branch_name"]
        pr_body = issue["generated_files"]["pr_body"]
        comment = issue["generated_files"]["comment"]
        pr_title = issue["draft_pr_title"].replace('"', '\\"')
        lines.extend(
            [
                f"# {issue['issue_ref'] or issue['title']}",
                "git switch main",
                "git pull --ff-only",
                f"git switch -c {branch}",
                f"git push -u origin {branch}",
                f'gh pr create --draft --title "{pr_title}" --body-file "{pr_body}" --base main --head "{branch}"',
                f"# After PR creation, post: gh pr comment <PR_NUMBER> --body-file \"{comment}\"",
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
    batches = build_batches(issues)
    plan = {
        "schema_version": "1",
        "generated_at": queue_timestamp,
        "repository": repo_name_with_owner(),
        "source": source,
        "setup_commands": CLOUD_CONFIG["setup_commands"],
        "label_suggestions": CLOUD_CONFIG["label_suggestions"],
        "issues": issues,
        "batches": batches,
    }

    (queue_dir / "cloud-plan.json").write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")
    (queue_dir / "cloud-plan.md").write_text(render_markdown(plan), encoding="utf-8")
    (queue_dir / "commands.sh").write_text(build_commands(plan), encoding="utf-8")

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
    plan_parser.add_argument("--limit", type=int, default=20, help="Open issue limit when no explicit targets are given.")
    plan_parser.add_argument("--json", action="store_true", help="Print the JSON plan to stdout.")
    plan_parser.set_defaults(func=build_plan)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
