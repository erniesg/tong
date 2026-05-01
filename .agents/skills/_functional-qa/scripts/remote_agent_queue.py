#!/usr/bin/env python3
"""Generate provider-neutral remote agent queue plans.

This wrapper keeps the existing Codex queue generator as the source of task
prompt generation while adding provider metadata used by repo-native queue
commands and notification workflows.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
from typing import Any

from qa_runtime import CONFIG_ROOT, REPO_ROOT, load_json


PROVIDER_CONFIG = load_json(CONFIG_ROOT / "remote-agent-providers.json")


def choose_provider(issue: dict[str, Any], requested: str) -> str:
    if requested != "auto":
        return requested

    issue_ref = issue.get("issue_ref")
    issue_overrides = PROVIDER_CONFIG.get("issue_provider", {})
    if issue_ref and issue_ref in issue_overrides:
        return issue_overrides[issue_ref]

    lane = issue.get("recommended_worktree", {}).get("id")
    lane_overrides = PROVIDER_CONFIG.get("lane_provider", {})
    if lane and lane in lane_overrides:
        return lane_overrides[lane]

    execution_mode = issue.get("validation_policy", {}).get("execution_mode")
    execution_overrides = PROVIDER_CONFIG.get("execution_mode_provider", {})
    if execution_mode and execution_mode in execution_overrides:
        return execution_overrides[execution_mode]

    return PROVIDER_CONFIG.get("default_provider", "codex")


def provider_meta(provider_id: str) -> dict[str, Any]:
    providers = PROVIDER_CONFIG.get("providers", {})
    provider = providers.get(provider_id)
    if not provider:
        raise ValueError(f"Unknown provider `{provider_id}`")
    return {"id": provider_id, **provider}


def render_markdown(plan: dict[str, Any]) -> str:
    lines = [
        "# Remote Agent Queue Plan",
        "",
        f"- Repository: `{plan['repository']}`",
        f"- Generated at: `{plan['generated_at']}`",
        f"- Requested provider: `{plan['requested_provider']}`",
        f"- Default provider: `{plan['provider_policy'].get('default_provider', 'codex')}`",
        f"- Source queue: `{plan['source_queue_dir']}`",
        "",
        "## Issues",
        "",
    ]

    for issue in plan["issues"]:
        provider = issue["provider"]
        lines.extend(
            [
                f"### {issue.get('issue_ref') or issue.get('title')}",
                f"- Provider: `{provider['id']}` ({provider['status']})",
                f"- Delivery mode: `{provider['delivery_mode']}`",
                f"- Queue action: `{issue.get('queue_action', 'n/a')}`",
                f"- Worktree lane: `{issue.get('recommended_worktree', {}).get('id', 'n/a')}`",
                f"- Cloud mode: `{issue.get('cloud_mode', 'n/a')}`",
                f"- Batch: `{issue.get('batch_id', 'unassigned')}`",
                f"- Task prompt: `{issue.get('generated_files', {}).get('task_prompt', '')}`",
                f"- PR notes: `{issue.get('generated_files', {}).get('pr_notes', '')}`",
                f"- Provider notes: {provider.get('notes', '')}",
                "",
            ]
        )

    return "\n".join(lines).strip() + "\n"


def run_codex_generator(args: argparse.Namespace) -> Path:
    command = [
        "python",
        str(CONFIG_ROOT.parent / "scripts" / "codex_cloud_queue.py"),
        "plan",
        *args.targets,
        "--limit",
        str(args.limit),
    ]
    if args.json:
        command.append("--json")

    result = subprocess.run(
        command,
        cwd=str(REPO_ROOT),
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())

    if args.json:
        payload = json.loads(result.stdout)
        generated_at = payload["generated_at"]
        return REPO_ROOT / "artifacts" / "qa-runs" / "functional-qa" / "codex-cloud-queue" / generated_at

    return Path(result.stdout.strip())


def empty_plan(args: argparse.Namespace) -> tuple[Path, dict[str, Any]]:
    from qa_runtime import artifact_root, repo_name_with_owner, timestamp_slug

    generated_at = timestamp_slug()
    queue_dir = artifact_root() / "functional-qa" / "remote-agent-queue" / generated_at
    queue_dir.mkdir(parents=True, exist_ok=True)
    plan = {
      "schema_version": "1",
      "generated_at": generated_at,
      "repository": repo_name_with_owner(),
      "environment_name": "",
      "delivery_mode": "provider-neutral",
      "source": "empty",
      "setup_commands": [],
      "label_suggestions": [],
      "issues": [],
      "batches": [],
    }
    return queue_dir, plan


def build_plan(args: argparse.Namespace) -> int:
    if args.provider != "auto":
        provider_meta(args.provider)

    if not args.targets and args.limit == 0:
        queue_dir, plan = empty_plan(args)
    else:
        queue_dir = run_codex_generator(args)
        cloud_plan_path = queue_dir / "cloud-plan.json"
        plan = json.loads(cloud_plan_path.read_text(encoding="utf-8"))

    for issue in plan.get("issues", []):
        selected = choose_provider(issue, args.provider)
        issue["provider"] = provider_meta(selected)

    plan["schema_version"] = "1"
    plan["source_queue_dir"] = str(queue_dir.relative_to(REPO_ROOT))
    plan["requested_provider"] = args.provider
    plan["provider_policy"] = {
        "default_provider": PROVIDER_CONFIG.get("default_provider", "codex"),
        "providers": PROVIDER_CONFIG.get("providers", {}),
    }

    (queue_dir / "remote-plan.json").write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")
    (queue_dir / "remote-plan.md").write_text(render_markdown(plan), encoding="utf-8")

    if args.json:
        print(json.dumps(plan, indent=2))
    else:
        print(str(queue_dir))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    plan_parser = subparsers.add_parser("plan", help="Generate a provider-neutral queue plan.")
    plan_parser.add_argument("targets", nargs="*", help="Issue numbers or URLs. Defaults to open issues.")
    plan_parser.add_argument("--limit", type=int, default=50)
    plan_parser.add_argument("--provider", choices=["auto", *PROVIDER_CONFIG.get("providers", {}).keys()], default="auto")
    plan_parser.add_argument("--json", action="store_true")
    plan_parser.set_defaults(func=build_plan)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
