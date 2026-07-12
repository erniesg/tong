#!/usr/bin/env python3

from __future__ import annotations

import sys
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
        for label in ("blocked-on-human", "do-not-merge", "pm:portability-gap", "self-heal:exhausted"):
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


if __name__ == "__main__":
    unittest.main()
