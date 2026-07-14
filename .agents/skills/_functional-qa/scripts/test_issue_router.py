#!/usr/bin/env python3

from __future__ import annotations

import sys
import subprocess
import unittest
from pathlib import Path
from unittest import mock


SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import issue_router
import qa_runtime


def blocked_issue() -> dict[str, object]:
    return {
        "number": 359,
        "title": "Archive API fixture backlog before automation resumes",
        "body": "Compare API fixture PRs before any replacement is dispatched.",
        "url": "https://github.com/erniesg/tong/issues/359",
        "labels": ["blocked-on-human", "lane:qa-platform", "needs-consolidation"],
        "issue_ref": "erniesg/tong#359",
    }


class IssueLabelGateTests(unittest.TestCase):
    def test_issue_ref_selectors_do_not_match_longer_issue_numbers(self) -> None:
        self.assertTrue(qa_runtime.issue_ref_matches("erniesg/tong#359", "#359"))
        self.assertTrue(qa_runtime.issue_ref_matches("erniesg/tong#359", "erniesg/tong#359"))
        self.assertFalse(qa_runtime.issue_ref_matches("erniesg/tong#3590", "#359"))
        self.assertFalse(qa_runtime.issue_ref_matches("erniesg/other#359", "erniesg/tong#359"))
        self.assertEqual(qa_runtime.issue_fallback_labels("erniesg/tong#3590"), [])

    def test_blocked_on_human_is_a_non_weakenable_validation_floor(self) -> None:
        policy = {
            "execution_mode": "safe-unattended",
            "fix_allowed": True,
            "human_review_required": False,
            "stop_conditions": [],
        }

        gated = qa_runtime.apply_issue_label_gates(policy, ["blocked-on-human"])

        self.assertEqual(gated["execution_mode"], "validate-and-propose-only")
        self.assertFalse(gated["fix_allowed"])
        self.assertTrue(gated["human_review_required"])
        self.assertIn("blocked-on-human", " ".join(gated["stop_conditions"]))

    def test_all_documented_queue_skip_labels_disable_unattended_fixes(self) -> None:
        for label in (
            "blocked-on-human",
            "do-not-merge",
            "pm:portability-gap",
            "rucksack-blocked",
            "rucksack-needs-decision",
            "rucksack-needs-human",
            "rucksack-provider-limited",
            "self-heal:exhausted",
        ):
            with self.subTest(label=label):
                gated = qa_runtime.apply_issue_label_gates(
                    {
                        "execution_mode": "safe-unattended",
                        "fix_allowed": True,
                        "human_review_required": False,
                        "stop_conditions": [],
                    },
                    [label],
                )

                self.assertEqual(gated["execution_mode"], "validate-and-propose-only")
                self.assertFalse(gated["fix_allowed"])
                self.assertTrue(gated["human_review_required"])
                self.assertIn(label, " ".join(gated["stop_conditions"]))

    def test_missing_github_metadata_without_repo_fallback_fails_closed(self) -> None:
        policy = {
            "execution_mode": "safe-unattended",
            "fix_allowed": True,
            "human_review_required": False,
            "stop_conditions": [],
        }

        gated = qa_runtime.apply_issue_metadata_gate(policy, "fallback-no-gh")

        self.assertEqual(gated["execution_mode"], "validate-and-propose-only")
        self.assertFalse(gated["fix_allowed"])
        self.assertTrue(gated["human_review_required"])
        self.assertIn("metadata is unavailable", " ".join(gated["stop_conditions"]))

    def test_human_review_gate_blocks_fixed_claims_not_validation_updates(self) -> None:
        run = {
            "classification": {"issue_class": "functional-logic"},
            "validation_policy": {
                "execution_mode": "validate-and-propose-only",
                "human_review_required": True,
                "requires_direct_issue_evidence": False,
                "ui_acceptance_required": False,
                "required_runtime_modes_for_fixed": [],
                "requires_live_model_for_fixed": False,
            },
        }
        evidence = {
            "validation": {
                "human_review_completed": False,
                "missing_requirements": [],
            }
        }

        validation_failures = qa_runtime.validation_gate_failures(run, evidence, for_fixed_claim=False)
        fixed_failures = qa_runtime.validation_gate_failures(run, evidence, for_fixed_claim=True)

        self.assertNotIn("human review is not marked complete", validation_failures)
        self.assertIn("human review is not marked complete", fixed_failures)


class IssueRouterLabelTests(unittest.TestCase):
    def test_offline_issue_resolution_uses_repo_fallback_labels(self) -> None:
        unavailable = subprocess.CompletedProcess(args=["gh"], returncode=1, stdout="", stderr="offline")
        with (
            mock.patch.object(qa_runtime, "run_command", return_value=unavailable),
            mock.patch.object(issue_router, "fetch_project_overrides", return_value={}),
            mock.patch.object(issue_router, "find_previous_run", return_value=None),
        ):
            source, issues = issue_router.resolve_targets(["erniesg/tong#359"], limit=1)
            entry = issue_router.build_issue_entry(issues[0])

        self.assertEqual(source, "explicit-targets")
        self.assertEqual(issues[0]["metadata_resolution"], "repo-adapter-fallback")
        self.assertEqual(entry["metadata_resolution"], "repo-adapter-fallback")
        self.assertIn("blocked-on-human", entry["labels"])
        self.assertIn("lane:qa-platform", entry["labels"])
        self.assertIn("rucksack-blocked", entry["labels"])
        self.assertEqual(entry["validation_policy"]["execution_mode"], "validate-and-propose-only")
        self.assertFalse(entry["validation_policy"]["fix_allowed"])
        self.assertEqual(entry["recommended_worktree"]["id"], "qa-platform")

    def test_missing_gh_uses_repo_fallback_labels(self) -> None:
        with mock.patch.object(qa_runtime, "run_command", side_effect=FileNotFoundError("gh")):
            payload = qa_runtime.fetch_issue("erniesg/tong#359")

        self.assertIsNotNone(payload)
        self.assertEqual(payload["metadata_resolution"], "repo-adapter-fallback")
        self.assertIn("blocked-on-human", payload["labels"])
        self.assertIn("lane:qa-platform", payload["labels"])
        self.assertIn("rucksack-blocked", payload["labels"])

    def test_blocking_and_lane_labels_override_keyword_fallbacks(self) -> None:
        with (
            mock.patch.object(issue_router, "fetch_project_overrides", return_value={}),
            mock.patch.object(issue_router, "find_previous_run", return_value=None),
        ):
            entry = issue_router.build_issue_entry(blocked_issue())

        self.assertEqual(entry["classification"]["issue_class"], "functional-logic")
        self.assertEqual(entry["validation_policy"]["execution_mode"], "validate-and-propose-only")
        self.assertFalse(entry["validation_policy"]["fix_allowed"])
        self.assertTrue(entry["validation_policy"]["human_review_required"])
        self.assertEqual(entry["recommended_worktree"]["id"], "qa-platform")
        self.assertIn("label `lane:qa-platform`", " ".join(entry["routing_reasons"]))
        self.assertNotIn("validate-issue --verify-fix", entry["follow_up_skills"])

    def test_project_lane_remains_authoritative_over_lane_label(self) -> None:
        issue = blocked_issue()
        issue_ref = str(issue["issue_ref"])
        with (
            mock.patch.object(
                issue_router,
                "fetch_project_overrides",
                return_value={issue_ref: {"Lane": "server-api"}},
            ),
            mock.patch.object(issue_router, "find_previous_run", return_value=None),
        ):
            entry = issue_router.build_issue_entry(issue)

        self.assertEqual(entry["recommended_worktree"]["id"], "server-api")
        self.assertIn("project field `Lane`", " ".join(entry["routing_reasons"]))

    def test_lane_label_cannot_override_explicit_path_ownership(self) -> None:
        issue = {
            "number": 358,
            "title": "Update API route",
            "body": "Change apps/server/api/profile.ts.",
            "url": "https://github.com/erniesg/tong/issues/358",
            "labels": ["lane:qa-platform"],
            "issue_ref": "erniesg/tong#358",
        }
        with (
            mock.patch.object(issue_router, "fetch_project_overrides", return_value={}),
            mock.patch.object(issue_router, "find_previous_run", return_value=None),
        ):
            entry = issue_router.build_issue_entry(issue)

        self.assertEqual(entry["recommended_worktree"]["id"], "server-api")
        self.assertTrue(entry["spans_multiple_worktrees"])
        self.assertIn("conflicts with explicit path ownership", " ".join(entry["routing_reasons"]))
        lanes = issue_router.build_parallel_lanes([entry])
        self.assertEqual(lanes[0]["lane_id"], "serialized-cross-boundary")

    def test_hidden_qa_path_cannot_be_lost_to_stale_lane_label(self) -> None:
        issue = {
            "number": 361,
            "title": "Repair functional QA routing",
            "body": "Change .agents/skills/_functional-qa/scripts/issue_router.py.",
            "url": "https://github.com/erniesg/tong/issues/361",
            "labels": ["lane:server-api"],
            "issue_ref": "erniesg/tong#361",
        }
        with (
            mock.patch.object(issue_router, "fetch_project_overrides", return_value={}),
            mock.patch.object(issue_router, "find_previous_run", return_value=None),
        ):
            entry = issue_router.build_issue_entry(issue)

        self.assertIn(".agents/skills/_functional-qa/scripts/issue_router.py", entry["explicit_paths"])
        self.assertEqual(entry["recommended_worktree"]["id"], "qa-platform")
        self.assertEqual(entry["explicit_worktree_candidates"], ["qa-platform"])
        self.assertTrue(entry["spans_multiple_worktrees"])
        self.assertIn("conflicts with explicit path ownership", " ".join(entry["routing_reasons"]))
        self.assertEqual(issue_router.build_parallel_lanes([entry])[0]["lane_id"], "serialized-cross-boundary")

    def test_hidden_github_paths_are_extracted(self) -> None:
        self.assertEqual(
            issue_router.extract_paths("Update .github/ISSUE_TEMPLATE/bug.yml."),
            [".github/ISSUE_TEMPLATE/bug.yml"],
        )

    def test_hidden_paths_are_normalized_from_github_urls(self) -> None:
        self.assertEqual(
            issue_router.extract_paths(
                "Review https://github.com/erniesg/tong/blob/main/.agents/skills/_functional-qa/scripts/issue_router.py "
                "and https://github.com/erniesg/tong/blob/main/.github/workflows/issue-queue-orchestrator.yml."
            ),
            [
                ".agents/skills/_functional-qa/scripts/issue_router.py",
                ".github/workflows/issue-queue-orchestrator.yml",
            ],
        )


if __name__ == "__main__":
    unittest.main()
