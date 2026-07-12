#!/usr/bin/env python3
"""Provider adapters and selection policy for the remote agent queue."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from qa_runtime import CONFIG_ROOT, TEMPLATE_ROOT, load_json, run_command, slugify


PROVIDER_REGISTRY = load_json(CONFIG_ROOT / "remote-agent-providers.json")
CODEX_CONFIG = load_json(CONFIG_ROOT / "codex-cloud.json")

PROVIDER_POLICY = PROVIDER_REGISTRY.get("provider_policy", {})
PROVIDER_DEFAULTS = {
    "environment_name": CODEX_CONFIG.get("environment_name", ""),
    "delivery_mode": CODEX_CONFIG.get("delivery_mode", "direct-task-pr"),
    "setup_commands": CODEX_CONFIG.get("setup_commands", []),
    "label_suggestions": CODEX_CONFIG.get("label_suggestions", []),
    "branch_pattern": CODEX_CONFIG.get("branch_pattern", "codex/issue-{number}-{slug}"),
    "pr_title_pattern": CODEX_CONFIG.get("pr_title_pattern", "fix: issue #{number} - {short_title}"),
}


@dataclass(frozen=True)
class ProviderSelection:
    provider: str
    reason: str
    source: str


class ProviderAdapter:
    """Base adapter for provider-specific prompt and dispatch behavior."""

    def __init__(self, provider_id: str, config: dict[str, Any]) -> None:
        self.provider_id = provider_id
        self.config = {**PROVIDER_DEFAULTS, **config}

    @property
    def display_name(self) -> str:
        return str(self.config.get("display_name") or self.provider_id.title())

    def environment_name(self) -> str:
        return str(self.config.get("environment_name") or "")

    def delivery_mode(self) -> str:
        return str(self.config.get("delivery_mode") or "manual")

    def setup_commands(self) -> list[str]:
        return list(self.config.get("setup_commands") or [])

    def label_suggestions(self) -> list[dict[str, Any]]:
        return list(self.config.get("label_suggestions") or [])

    def prompt_template_path(self) -> Path:
        return TEMPLATE_ROOT / str(self.config["prompt_template"])

    def pr_notes_template_path(self) -> Path:
        return TEMPLATE_ROOT / str(self.config["pr_notes_template"])

    def branch_name_for(self, issue_number: int | None, title: str) -> str:
        pattern = str(self.config.get("branch_pattern") or PROVIDER_DEFAULTS["branch_pattern"])
        if issue_number is None:
            return pattern.format(number="adhoc", slug=slugify(title))
        return pattern.format(number=issue_number, slug=slugify(title)[:48])

    def pr_title_for(self, issue_number: int | None, title: str) -> str:
        pattern = str(self.config.get("pr_title_pattern") or PROVIDER_DEFAULTS["pr_title_pattern"])
        if issue_number is None:
            return f"fix: {title}"
        return pattern.format(number=issue_number, short_title=title[:72])

    def dispatch_workflow(self) -> str:
        return str(self.config.get("dispatch_workflow") or "").strip()

    def supports_dispatch(self) -> bool:
        return bool(self.dispatch_workflow())

    def placeholder_reason(self) -> str:
        return str(self.config.get("placeholder_reason") or "").strip()

    def capabilities(self) -> dict[str, Any]:
        return dict(self.config.get("capabilities") or {})

    def dispatch_eligibility(self, issue: dict[str, Any]) -> tuple[bool, str]:
        validation_policy = issue.get("validation_policy") or {}
        if validation_policy.get("fix_allowed") is False:
            execution_mode = validation_policy.get("execution_mode", "validation-only")
            return (
                False,
                f"validation policy '{execution_mode}' blocks remote dispatch until the human gate is resolved",
            )
        if self.supports_dispatch():
            return (True, "")
        reason = self.placeholder_reason() or f"provider `{self.provider_id}` does not have a configured dispatch workflow yet"
        return (False, reason)

    def dispatch(self, issue: dict[str, Any], queue_dir: Path, *, dry_run: bool, repo: str) -> tuple[str, str]:
        raise NotImplementedError

    def launch_steps(self, issue: dict[str, Any]) -> list[str]:
        ready, reason = self.dispatch_eligibility(issue)
        if ready:
            return [
                f"Use the `{self.display_name}` environment `{self.environment_name()}`.",
                f"Start a task from `{issue['generated_files']['task_prompt']}`.",
                f"Use `{issue['generated_files']['pr_notes']}` when you need a stable PR/update envelope.",
            ]
        return [
            f"Skip `{self.display_name}` dispatch for now.",
            f"Reason: {reason}",
        ]


class CodexProviderAdapter(ProviderAdapter):
    def dispatch(self, issue: dict[str, Any], queue_dir: Path, *, dry_run: bool, repo: str) -> tuple[str, str]:
        prompt_path = queue_dir / issue["generated_files"]["task_prompt"]
        prompt_text = prompt_path.read_text(encoding="utf-8")
        command = [
            "gh",
            "workflow",
            "run",
            self.dispatch_workflow(),
            "--repo",
            repo,
            "-f",
            f"prompt={prompt_text}",
            "-f",
            "base_branch=main",
            "-f",
            f"branch={issue['branch_name']}",
            "-f",
            f"pr_title={issue['draft_pr_title']}",
            "-f",
            f"issue_ref={issue.get('issue_ref') or ''}",
        ]

        if dry_run:
            return ("dry-run", "dispatch command prepared")

        run_command(command)
        return ("dispatched", f"workflow `{self.dispatch_workflow()}` triggered")

    def launch_steps(self, issue: dict[str, Any]) -> list[str]:
        dependency_note = (
            f"Only launch after `{', '.join(issue['depends_on'])}` is merged or rebased into the current branch."
            if issue.get("depends_on")
            else ""
        )
        steps = [
            f"Open `chatgpt.com/codex` and choose the `{self.environment_name()}` environment.",
        ]
        if dependency_note:
            steps.append(dependency_note)
        steps.extend(
            [
                f"Start a new task and paste `{issue['generated_files']['task_prompt']}`.",
                "Wait for validation, code changes, and `--verify-fix` to finish.",
                f"Use Codex's PR flow with title `{issue['draft_pr_title']}`.",
                f"Copy any useful merge notes from `{issue['generated_files']['pr_notes']}` if needed.",
            ]
        )
        return steps


class ClaudeProviderAdapter(ProviderAdapter):
    pass


def normalize_requested_provider(raw: str | None) -> str:
    value = str(raw or "auto").strip().lower() or "auto"
    if value == "default":
        return "auto"
    if value != "auto" and value not in PROVIDER_REGISTRY.get("providers", {}):
        raise ValueError(f"Unsupported provider `{value}`.")
    return value


def default_provider_id(policy: dict[str, Any] | None = None) -> str:
    active_policy = policy or PROVIDER_POLICY
    provider_id = str(active_policy.get("default_provider") or "codex").strip().lower()
    if provider_id not in PROVIDER_REGISTRY.get("providers", {}):
        raise ValueError(f"Unknown default provider `{provider_id}` in policy.")
    return provider_id


def select_provider_for_issue(
    issue_entry: dict[str, Any],
    *,
    requested_provider: str | None = None,
    policy: dict[str, Any] | None = None,
) -> ProviderSelection:
    active_policy = policy or PROVIDER_POLICY
    normalized_request = normalize_requested_provider(requested_provider)
    if normalized_request != "auto":
        return ProviderSelection(normalized_request, f"requested provider `{normalized_request}`", "request")

    issue_ref = issue_entry.get("issue_ref") or ""
    for override in active_policy.get("issue_overrides", []):
        match = str(override.get("match") or "").strip()
        provider_id = str(override.get("provider") or "").strip().lower()
        if match and issue_ref and match in issue_ref and provider_id:
            normalize_requested_provider(provider_id)
            return ProviderSelection(provider_id, f"issue override `{match}`", "issue-override")

    lane_id = str(issue_entry.get("recommended_worktree", {}).get("id") or "").strip()
    lane_overrides = active_policy.get("lane_overrides", {})
    if lane_id and lane_id in lane_overrides:
        provider_id = normalize_requested_provider(lane_overrides[lane_id])
        return ProviderSelection(provider_id, f"lane override `{lane_id}`", "lane-override")

    execution_mode = str(issue_entry.get("validation_policy", {}).get("execution_mode") or "").strip()
    execution_overrides = active_policy.get("execution_mode_overrides", {})
    if execution_mode and execution_mode in execution_overrides:
        provider_id = normalize_requested_provider(execution_overrides[execution_mode])
        return ProviderSelection(provider_id, f"execution mode override `{execution_mode}`", "execution-mode-override")

    provider_id = default_provider_id(active_policy)
    return ProviderSelection(provider_id, "default provider policy", "policy")


def get_provider_adapter(provider_id: str) -> ProviderAdapter:
    providers = PROVIDER_REGISTRY.get("providers", {})
    normalized = normalize_requested_provider(provider_id)
    if normalized == "auto":
        normalized = default_provider_id()
    config = providers[normalized]
    if normalized == "codex":
        return CodexProviderAdapter(normalized, config)
    if normalized == "claude":
        return ClaudeProviderAdapter(normalized, config)
    return ProviderAdapter(normalized, config)


def provider_breakdown(issues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for issue in issues:
        provider_id = str(issue.get("provider") or "unknown")
        counts[provider_id] = counts.get(provider_id, 0) + 1

    rows: list[dict[str, Any]] = []
    for provider_id in sorted(counts):
        display_name = provider_id
        if provider_id in PROVIDER_REGISTRY.get("providers", {}):
            display_name = get_provider_adapter(provider_id).display_name
        rows.append(
            {
                "provider": provider_id,
                "display_name": display_name,
                "count": counts[provider_id],
            }
        )
    return rows
