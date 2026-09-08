#!/usr/bin/env python3

from __future__ import annotations

import argparse
import contextlib
import io
import json
import sys
import tempfile
import unittest
from unittest import mock
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import dispatch_issue_queue
import codex_cloud_queue
import remote_agent_providers
import remote_agent_queue
import resolve_issue_queue_request
import qa_runtime


def sample_issue(*, lane: str = "qa-platform", execution_mode: str = "safe-unattended") -> dict[str, object]:
    return {
        "issue_ref": "erniesg/tong#292",
        "recommended_worktree": {"id": lane},
        "validation_policy": {"execution_mode": execution_mode},
    }


class ProviderSelectionTests(unittest.TestCase):
    def test_codex_branch_pattern_is_preserved(self) -> None:
        branch = remote_agent_providers.get_provider_adapter("codex").branch_name_for(35, "Route remote queue work")

        self.assertEqual(branch, "codex/issue-35-route-remote-queue-work")

    def test_unavailable_provider_is_not_dispatchable(self) -> None:
        adapter = remote_agent_providers.ClaudeProviderAdapter(
            "claude",
            {
                "status": "paused",
                "availability": {"status": "unavailable", "unavailable_until": ""},
                "dispatch_workflow": "claude-headless-pr.yml",
            },
        )

        ready, reason = adapter.dispatch_eligibility(sample_issue())

        self.assertFalse(ready)
        self.assertIn("paused", reason)

    def test_planned_provider_status_prevents_dispatch(self) -> None:
        adapter = remote_agent_providers.get_provider_adapter("claude")

        ready, reason = adapter.dispatch_eligibility(
            {"provider": {"id": "claude", "status": "paused", "availability": {"status": "unavailable"}}}
        )

        self.assertFalse(ready)
        self.assertIn("paused", reason)

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
    def test_dry_run_uses_provider_selected_by_remote_planner(self) -> None:
        """Catch a Claude selection that falls back to Codex or cannot dispatch."""
        with tempfile.TemporaryDirectory() as temporary_directory:
            queue_dir = Path(temporary_directory)
            raw_issue = {
                "number": 35,
                "issue_ref": "erniesg/tong#35",
                "title": "Route remote queue work",
                "body": "Repo-only remote queue update. Remote dependencies: none.",
                "url": "https://github.com/erniesg/tong/issues/35",
                "labels": [],
            }
            with mock.patch.object(qa_runtime, "PROJECT_OVERRIDE_CACHE", {}):
                cloud_issue = codex_cloud_queue.build_cloud_issue(raw_issue, queue_dir)
            cloud_plan = {
                "schema_version": "1",
                "generated_at": "20260908T000000Z",
                "repository": "erniesg/tong",
                "environment_name": "tong",
                "delivery_mode": "direct-task-pr",
                "source": "explicit-targets",
                "setup_commands": [],
                "label_suggestions": [],
                "issues": [cloud_issue],
                "batches": [],
            }
            (queue_dir / "cloud-plan.json").write_text(json.dumps(cloud_plan), encoding="utf-8")
            planner_args = argparse.Namespace(
                provider="claude",
                targets=["35"],
                limit=1,
                out_dir=None,
                json=False,
            )
            generator_result = mock.Mock(returncode=0, stdout=str(queue_dir), stderr="")
            with (
                mock.patch("remote_agent_queue.subprocess.run", return_value=generator_result),
                contextlib.redirect_stdout(io.StringIO()),
            ):
                self.assertEqual(remote_agent_queue.build_plan(planner_args), 0)

            plan_path = dispatch_issue_queue.find_plan_path(queue_dir)
            with (
                mock.patch.object(dispatch_issue_queue, "list_open_prs", return_value={}),
                mock.patch.object(remote_agent_providers, "run_command") as run_command,
            ):
                summary = dispatch_issue_queue.build_dispatch_summary(
                    dispatch_issue_queue.load_json(plan_path),
                    queue_dir,
                    plan_path=plan_path,
                    action="queue",
                    issue_ref="",
                    max_dispatches=1,
                    dry_run=True,
                )

            self.assertEqual(plan_path.name, "remote-plan.json")
            remote_plan = dispatch_issue_queue.load_json(plan_path)
            remote_issue = remote_plan["issues"][0]
            self.assertTrue(remote_issue["branch_name"].startswith("claude/"))
            task_prompt = (queue_dir / remote_issue["generated_files"]["task_prompt"]).read_text(encoding="utf-8")
            pr_notes = (queue_dir / remote_issue["generated_files"]["pr_notes"]).read_text(encoding="utf-8")
            self.assertIn(remote_issue["branch_name"], task_prompt)
            self.assertIn(remote_issue["branch_name"], pr_notes)
            self.assertNotIn(cloud_issue["branch_name"], task_prompt)
            self.assertNotIn(cloud_issue["branch_name"], pr_notes)
            self.assertEqual(summary["provider_breakdown"][0]["provider"], "claude")
            self.assertEqual(summary["launched"][0]["provider"], "claude")
            self.assertEqual(summary["launched"][0]["result"], "dry-run")
            self.assertIn("claude-headless-pr.yml", summary["launched"][0]["reason"])
            run_command.assert_not_called()

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
