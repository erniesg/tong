#!/usr/bin/env python3
"""Dispatch provider-neutral issue queue items from a generated queue plan."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from qa_runtime import repo_name_with_owner, run_command
from remote_agent_providers import get_provider_adapter, provider_breakdown


DISPATCHABLE_CLOUD_MODES = {"cloud-ready", "cloud-ready-with-local-proof"}


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def issue_number(issue_ref: str | None) -> int | None:
    if not issue_ref or "#" not in issue_ref:
        return None
    try:
        return int(issue_ref.rsplit("#", 1)[1])
    except ValueError:
        return None


def find_plan_path(queue_dir: Path) -> Path:
    queue_plan = queue_dir / "queue-plan.json"
    if queue_plan.exists():
        return queue_plan
    legacy_plan = queue_dir / "cloud-plan.json"
    if legacy_plan.exists():
        return legacy_plan
    raise FileNotFoundError(f"No queue plan found under {queue_dir}")


def fetch_issue_state(issue_ref: str) -> str | None:
    result = run_command(
        ["gh", "issue", "view", issue_ref, "--repo", repo_name_with_owner(), "--json", "state"],
        allow_failure=True,
    )
    if result.returncode != 0:
        return None
    payload = json.loads(result.stdout)
    return payload.get("state")


def dependencies_satisfied(issue: dict[str, Any]) -> tuple[bool, str]:
    depends_on = issue.get("depends_on") or []
    if not depends_on:
        return (True, "")

    unresolved: list[str] = []
    for dependency in depends_on:
        state = fetch_issue_state(dependency)
        if state != "CLOSED":
            unresolved.append(dependency if state else f"{dependency} (unknown)")

    if unresolved:
        return (False, f"blocked by unresolved dependencies: {', '.join(unresolved)}")
    return (True, "")


def list_open_prs() -> dict[str, dict[str, Any]]:
    result = run_command(
        [
            "gh",
            "pr",
            "list",
            "--repo",
            repo_name_with_owner(),
            "--state",
            "open",
            "--limit",
            "200",
            "--json",
            "number,title,url,headRefName",
        ]
    )
    payload = json.loads(result.stdout)
    return {item["headRefName"]: item for item in payload}


def select_candidates(plan: dict[str, Any], action: str, issue_ref: str) -> list[dict[str, Any]]:
    issues = plan.get("issues") or []
    if action == "queue":
        return issues
    return [item for item in issues if item.get("issue_ref") == issue_ref]


def build_summary_markdown(summary: dict[str, Any]) -> str:
    provider_line = ", ".join(f"{row['provider']} ({row['count']})" for row in summary["provider_breakdown"]) or "none"
    lines = [
        "# Issue Queue Dispatch Summary",
        "",
        f"- Action: `{summary['action']}`",
        f"- Dry run: `{str(summary['dry_run']).lower()}`",
        f"- Queue dir: `{summary['queue_dir']}`",
        f"- Plan file: `{summary['plan_file']}`",
        f"- Requested issue: `{summary['issue_ref'] or 'none'}`",
        f"- Requested provider: `{summary['provider_policy']['requested_provider']}`",
        f"- Default provider: `{summary['provider_policy']['default_provider']}`",
        f"- Provider mix: `{provider_line}`",
        f"- Considered: `{summary['counts']['considered']}`",
        f"- Dispatched: `{summary['counts']['dispatched']}`",
        f"- Skipped: `{summary['counts']['skipped']}`",
        "",
    ]

    if summary["launched"]:
        lines.append("## Dispatched")
        lines.append("")
        for item in summary["launched"]:
            lines.append(
                f"- `{item['issue_ref']}` -> `{item['provider']}` / `{item['branch_name']}` ({item['result']})"
            )
        lines.append("")

    if summary["skipped"]:
        lines.append("## Skipped")
        lines.append("")
        for item in summary["skipped"]:
            provider_text = f" [{item['provider']}]" if item.get("provider") else ""
            lines.append(f"- `{item['issue_ref']}`{provider_text}: {item['reason']}")
        lines.append("")

    return "\n".join(lines).strip() + "\n"


def build_dispatch_summary(
    plan: dict[str, Any],
    queue_dir: Path,
    *,
    plan_path: Path,
    action: str,
    issue_ref: str,
    max_dispatches: int,
    dry_run: bool,
) -> dict[str, Any]:
    repo = plan.get("repository") or repo_name_with_owner()
    open_prs = list_open_prs() if action in {"queue", "run", "retry"} else {}
    launched: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []

    candidates = select_candidates(plan, action, issue_ref)
    if issue_ref and not candidates:
        skipped.append({"issue_ref": issue_ref, "reason": "issue was not present in the generated queue plan"})

    if action in {"hold", "route-human"}:
        for issue in candidates:
            skipped.append(
                {
                    "issue_ref": issue.get("issue_ref") or issue["title"],
                    "provider": issue.get("provider") or "",
                    "reason": f"`{action}` acknowledged; persistent queue state belongs in the human override surface",
                }
            )
    else:
        for issue in candidates:
            ref = issue.get("issue_ref") or issue["title"]
            provider_id = str(issue.get("provider") or plan.get("default_provider") or "codex")
            adapter = get_provider_adapter(provider_id)
            if len(launched) >= max_dispatches:
                skipped.append({"issue_ref": ref, "provider": provider_id, "reason": f"dispatch cap `{max_dispatches}` reached"})
                continue
            if issue.get("cloud_mode") not in DISPATCHABLE_CLOUD_MODES:
                skipped.append(
                    {
                        "issue_ref": ref,
                        "provider": provider_id,
                        "reason": f"cloud mode `{issue.get('cloud_mode')}` is not dispatchable",
                    }
                )
                continue
            if issue.get("batch_id") == "unassigned":
                skipped.append({"issue_ref": ref, "provider": provider_id, "reason": "issue is not in an execution batch"})
                continue
            deps_ok, deps_reason = dependencies_satisfied(issue)
            if not deps_ok:
                skipped.append({"issue_ref": ref, "provider": provider_id, "reason": deps_reason})
                continue
            ready, ready_reason = adapter.dispatch_eligibility(issue)
            if not ready:
                skipped.append({"issue_ref": ref, "provider": provider_id, "reason": ready_reason})
                continue
            existing_pr = open_prs.get(issue["branch_name"])
            if existing_pr:
                skipped.append(
                    {
                        "issue_ref": ref,
                        "provider": provider_id,
                        "reason": f"branch already has open PR #{existing_pr['number']}: {existing_pr['url']}",
                    }
                )
                continue

            result, reason = adapter.dispatch(issue, queue_dir, dry_run=dry_run, repo=repo)
            launched.append(
                {
                    "issue_ref": ref,
                    "provider": provider_id,
                    "provider_display_name": adapter.display_name,
                    "branch_name": issue["branch_name"],
                    "result": result,
                    "reason": reason,
                }
            )

    return {
        "action": action,
        "issue_ref": issue_ref,
        "dry_run": dry_run,
        "queue_dir": str(queue_dir),
        "plan_file": str(plan_path.name),
        "provider_policy": {
            "requested_provider": plan.get("requested_provider", "auto"),
            "default_provider": plan.get("default_provider", "codex"),
        },
        "provider_breakdown": provider_breakdown(candidates),
        "launched": launched,
        "skipped": skipped,
        "counts": {
            "considered": len(candidates),
            "dispatched": len(launched),
            "skipped": len(skipped),
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--queue-dir", required=True, help="Generated queue directory from remote_agent_queue.py plan")
    parser.add_argument("--action", required=True, choices=["queue", "run", "retry", "hold", "route-human"])
    parser.add_argument("--issue-ref", default="", help="Optional issue ref, e.g. owner/repo#123")
    parser.add_argument("--max-dispatches", type=int, default=2)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--json", action="store_true", help="Print the summary JSON to stdout")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    queue_dir = Path(args.queue_dir).resolve()
    plan_path = find_plan_path(queue_dir)
    plan = load_json(plan_path)
    summary = build_dispatch_summary(
        plan,
        queue_dir,
        plan_path=plan_path,
        action=args.action,
        issue_ref=args.issue_ref,
        max_dispatches=max(args.max_dispatches, 0),
        dry_run=args.dry_run,
    )

    (queue_dir / "dispatch-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    (queue_dir / "dispatch-summary.md").write_text(build_summary_markdown(summary), encoding="utf-8")

    if args.json:
        print(json.dumps(summary, indent=2))
    else:
        print(str(queue_dir))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
