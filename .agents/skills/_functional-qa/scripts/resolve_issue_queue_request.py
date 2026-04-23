#!/usr/bin/env python3
"""Resolve trusted GitHub trigger input for the issue queue orchestrator."""

from __future__ import annotations

import json
import os
import shlex
import sys
from pathlib import Path

from remote_agent_providers import normalize_requested_provider


MAINTAINER_ASSOCIATIONS = {"OWNER", "MEMBER", "COLLABORATOR"}
TRUE_VALUES = {"1", "true", "yes", "on"}
SUPPORTED_ACTIONS = {"queue", "run", "retry", "hold", "route-human"}
SUPPORTED_PREFIXES = ("/tong", "/codex")


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def read_event_payload() -> dict:
    event_path = os.getenv("GITHUB_EVENT_PATH")
    if not event_path:
        fail("GITHUB_EVENT_PATH is required.")
    return json.loads(Path(event_path).read_text(encoding="utf-8"))


def write_output(name: str, value: str) -> None:
    rendered = "" if value is None else str(value)
    output_path = os.getenv("GITHUB_OUTPUT")
    if output_path:
        with Path(output_path).open("a", encoding="utf-8") as handle:
            handle.write(f"{name}<<__CODEX__\n{rendered}\n__CODEX__\n")
    else:
        print(f"{name}={rendered}")


def parse_boolean(raw: str | None, default: bool = False) -> bool:
    if raw is None:
        return default
    return raw.strip().lower() in TRUE_VALUES


def trusted_logins_from_env() -> set[str]:
    raw = os.getenv("ISSUE_QUEUE_TRUSTED_LOGINS", "")
    return {item.strip().lower() for item in raw.split(",") if item.strip()}


def normalize_issue_ref(raw: str | None, repo: str) -> str:
    value = (raw or "").strip()
    if not value:
        return ""
    if "#" in value and "/" in value:
        return value
    if value.startswith("#"):
        return f"{repo}{value}"
    if value.isdigit():
        return f"{repo}#{value}"
    return value


def parse_comment_command(body: str, repo: str, default_issue_ref: str) -> dict[str, str]:
    for raw_line in body.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        lowered = line.lower()
        if not any(lowered.startswith(prefix) for prefix in SUPPORTED_PREFIXES):
            continue

        try:
            tokens = shlex.split(line)
        except ValueError as exc:
            return {"requested": "true", "valid": "false", "reason": f"Could not parse command: {exc}."}

        if len(tokens) < 2:
            return {
                "requested": "true",
                "valid": "false",
                "reason": "Missing action. Try `/tong queue` or `/tong run #123`.",
            }

        action = tokens[1].lower()
        if action not in SUPPORTED_ACTIONS:
            return {
                "requested": "true",
                "valid": "false",
                "reason": f"Unsupported action `{action}`.",
            }

        target = normalize_issue_ref(tokens[2] if len(tokens) > 2 else default_issue_ref, repo)
        if action != "queue" and not target:
            return {
                "requested": "true",
                "valid": "false",
                "reason": f"Action `{action}` requires an issue ref such as `#123`.",
            }

        return {
            "requested": "true",
            "valid": "true",
            "action": action,
            "issue_ref": target,
            "command": line,
        }

    return {
        "requested": "false",
        "valid": "false",
        "reason": "Comment did not request repo orchestration. Raw `@codex ...` remains reserved for direct vendor-native Codex tasks.",
    }


def main() -> int:
    event_name = os.getenv("GITHUB_EVENT_NAME", "")
    repo = os.getenv("GITHUB_REPOSITORY", "")
    if not repo:
        fail("GITHUB_REPOSITORY is required.")

    event = read_event_payload()
    inputs = event.get("inputs", {})

    should_run = True
    reason = ""
    action = "queue"
    issue_ref = ""
    dry_run = False
    max_dispatches = "2"
    source_issue_number = ""
    source_is_pr = "false"
    command_text = ""
    provider = "auto"

    requested = "true"

    if event_name == "schedule":
        pass
    elif event_name == "workflow_dispatch":
        action = (inputs.get("action") or "queue").strip().lower() or "queue"
        if action not in SUPPORTED_ACTIONS:
            should_run = False
            reason = f"Unsupported workflow action `{action}`."
        issue_ref = normalize_issue_ref(inputs.get("issue_ref"), repo)
        dry_run = parse_boolean(inputs.get("dry_run"), False)
        max_dispatches = str(inputs.get("max_dispatches") or "2").strip() or "2"
        try:
            provider = normalize_requested_provider(inputs.get("provider") or "auto")
        except ValueError as exc:
            should_run = False
            reason = str(exc)
    elif event_name == "issue_comment":
        issue = event.get("issue") or {}
        comment = event.get("comment") or {}
        source_issue_number = str(issue.get("number") or "")
        source_is_pr = "true" if issue.get("pull_request") else "false"
        default_issue_ref = f"{repo}#{source_issue_number}" if source_issue_number else ""
        parsed = parse_comment_command(comment.get("body") or "", repo, default_issue_ref)
        command_text = parsed.get("command", "")
        requested = parsed.get("requested", "false")

        if parsed["requested"] != "true":
            should_run = False
            reason = parsed["reason"]
        else:
            trusted_logins = trusted_logins_from_env()
            comment_login = str(comment.get("user", {}).get("login") or "").strip().lower()
            allowed_by_association = comment.get("author_association", "") in MAINTAINER_ASSOCIATIONS
            allowed_by_login = bool(comment_login) and comment_login in trusted_logins
            if not (allowed_by_association or allowed_by_login):
                should_run = False
                trusted = ", ".join(sorted(trusted_logins)) or "none configured"
                reason = (
                    f"Comment author association `{comment.get('author_association') or 'UNKNOWN'}` "
                    f"and login `{comment_login or 'UNKNOWN'}` are not allowed to trigger trusted orchestration. "
                    f"Trusted logins: {trusted}."
                )
        if should_run and parsed["requested"] == "true" and parsed["valid"] != "true":
            should_run = False
            reason = parsed["reason"]
        elif should_run:
            action = parsed.get("action", "queue")
            issue_ref = parsed.get("issue_ref", "")
            dry_run = False
            max_dispatches = "1" if action != "queue" else "2"
    else:
        should_run = False
        requested = "false"
        reason = f"Unsupported event `{event_name or 'unknown'}`."

    if should_run and action != "queue" and not issue_ref:
        should_run = False
        reason = f"Action `{action}` requires an issue ref."

    write_output("should_run", "true" if should_run else "false")
    write_output("reason", reason)
    write_output("action", action)
    write_output("issue_ref", issue_ref)
    write_output("dry_run", "true" if dry_run else "false")
    write_output("max_dispatches", max_dispatches)
    write_output("provider", provider)
    write_output("source_issue_number", source_issue_number)
    write_output("source_is_pr", source_is_pr)
    write_output("command_text", command_text)
    write_output("requested", requested)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
