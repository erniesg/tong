#!/usr/bin/env python3

from __future__ import annotations

import sys
import unittest
from unittest import mock
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import dispatch_issue_queue
import remote_agent_queue
import remote_agent_providers
import resolve_issue_queue_request


def sample_issue(*, lane: str = "qa-platform", execution_mode: str = "safe-unattended") -> dict[str, object]:
    return {
        "issue_ref": "erniesg/tong#292",
        "recommended_worktree": {"id": lane},
        "validation_policy": {"execution_mode": execution_mode},
    }


class ProviderSelectionTests(unittest.TestCase):
    def test_select_provider_uses_default_policy(self) -> None:
        selection = remote_agent_providers.select_provider_for_issue(
            sample_issue(),
            policy={
                "default_provider": "codex",
                "lane_overrides": {},
                "execution_mode_overrides": {},
                "issue_overrides": [],
            },
        )

        self.assertEqual(selection.provider, "codex")
        self.assertEqual(selection.source, "policy")

    def test_select_provider_applies_lane_override(self) -> None:
        selection = remote_agent_providers.select_provider_for_issue(
            sample_issue(lane="infra-deploy"),
            policy={
                "default_provider": "codex",
                "lane_overrides": {"infra-deploy": "claude"},
                "execution_mode_overrides": {},
                "issue_overrides": [],
            },
        )

        self.assertEqual(selection.provider, "claude")
        self.assertEqual(selection.source, "lane-override")

    def test_requested_provider_overrides_policy(self) -> None:
        selection = remote_agent_providers.select_provider_for_issue(
            sample_issue(),
            requested_provider="claude",
            policy={
                "default_provider": "codex",
                "lane_overrides": {"qa-platform": "codex"},
                "execution_mode_overrides": {"safe-unattended": "codex"},
                "issue_overrides": [{"match": "#292", "provider": "codex"}],
            },
        )

        self.assertEqual(selection.provider, "claude")
        self.assertEqual(selection.source, "request")


class CommentParsingTests(unittest.TestCase):
    def test_parse_comment_command_accepts_repo_native_prefix(self) -> None:
        parsed = resolve_issue_queue_request.parse_comment_command("/tong run #292", "erniesg/tong", "")

        self.assertEqual(parsed["valid"], "true")
        self.assertEqual(parsed["action"], "run")
        self.assertEqual(parsed["issue_ref"], "erniesg/tong#292")

    def test_parse_comment_command_accepts_codex_compat_prefix(self) -> None:
        parsed = resolve_issue_queue_request.parse_comment_command("/codex hold", "erniesg/tong", "erniesg/tong#292")

        self.assertEqual(parsed["valid"], "true")
        self.assertEqual(parsed["action"], "hold")
        self.assertEqual(parsed["issue_ref"], "erniesg/tong#292")

    def test_parse_comment_command_ignores_raw_vendor_trigger(self) -> None:
        parsed = resolve_issue_queue_request.parse_comment_command("@codex run #292", "erniesg/tong", "")

        self.assertEqual(parsed["requested"], "false")
        self.assertIn("vendor-native", parsed["reason"])

    def test_trusted_logins_from_env_parses_csv(self) -> None:
        with mock.patch.dict("os.environ", {"ISSUE_QUEUE_TRUSTED_LOGINS": "route-human-bot, codex-bot "}):
            self.assertEqual(
                resolve_issue_queue_request.trusted_logins_from_env(),
                {"route-human-bot", "codex-bot"},
            )


class DispatchSummaryTests(unittest.TestCase):
    def test_validation_only_issue_is_not_remotely_dispatchable(self) -> None:
        issue = {
            "cloud_mode": "cloud-ready",
            "batch_id": "batch-1",
            "depends_on": [],
            "provider": "codex",
            "provider_display_name": "Codex",
            "provider_dispatch_supported": False,
            "provider_dispatch_reason": "validation policy 'validate-and-propose-only' blocks remote dispatch",
            "validation_policy": {
                "execution_mode": "validate-and-propose-only",
                "fix_allowed": False,
            },
        }

        ready, reason = remote_agent_providers.get_provider_adapter("codex").dispatch_eligibility(issue)

        self.assertFalse(ready)
        self.assertIn("blocks remote dispatch", reason)
        self.assertFalse(remote_agent_queue.is_dispatchable(issue))
        self.assertIn("blocks remote dispatch", remote_agent_queue.queue_action_for(issue))

    def test_dispatcher_skips_validation_only_issue(self) -> None:
        issue = {
            "issue_ref": "erniesg/tong#359",
            "title": "Archive API fixture backlog before automation resumes",
            "cloud_mode": "cloud-ready",
            "batch_id": "batch-1",
            "depends_on": [],
            "provider": "codex",
            "branch_name": "codex/issue-359-planner-gates",
            "validation_policy": {
                "execution_mode": "validate-and-propose-only",
                "fix_allowed": False,
            },
        }
        plan = {"repository": "erniesg/tong", "default_provider": "codex", "issues": [issue]}

        with mock.patch.object(dispatch_issue_queue, "list_open_prs", return_value={}):
            summary = dispatch_issue_queue.build_dispatch_summary(
                plan,
                Path("/tmp/queue"),
                plan_path=Path("/tmp/queue/queue-plan.json"),
                action="queue",
                issue_ref="",
                max_dispatches=1,
                dry_run=True,
            )

        self.assertEqual(summary["counts"], {"considered": 1, "dispatched": 0, "skipped": 1})
        self.assertIn("blocks remote dispatch", summary["skipped"][0]["reason"])

    def test_build_summary_markdown_lists_provider_per_issue(self) -> None:
        markdown = dispatch_issue_queue.build_summary_markdown(
            {
                "action": "queue",
                "dry_run": True,
                "queue_dir": "/tmp/queue",
                "plan_file": "queue-plan.json",
                "issue_ref": "",
                "provider_policy": {"requested_provider": "auto", "default_provider": "codex"},
                "provider_breakdown": [{"provider": "codex", "display_name": "Codex", "count": 1}],
                "launched": [
                    {
                        "issue_ref": "erniesg/tong#292",
                        "provider": "codex",
                        "branch_name": "codex/issue-292-provider-agnostic",
                        "result": "dry-run",
                    }
                ],
                "skipped": [],
                "counts": {"considered": 1, "dispatched": 1, "skipped": 0},
            }
        )

        self.assertIn("`erniesg/tong#292` -> `codex` / `codex/issue-292-provider-agnostic`", markdown)
        self.assertIn("- Requested provider: `auto`", markdown)


if __name__ == "__main__":
    unittest.main()
