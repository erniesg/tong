import tempfile
import unittest
from argparse import Namespace
from pathlib import Path
from unittest.mock import patch

import replay_qa_router as router


def sample_raw(**overrides):
    payload = {
        "sessionId": "Lalo8rAB1wBB",
        "replayTimestampMs": 42150,
        "route": "/game?qa_trace=1",
        "surface": "game",
        "proofUrl": "https://runs.tong.berlayar.ai/playtest/Lalo8rAB1wBB/rrweb-render.webm",
        "severity": 4,
        "componentHint": "CharacterSprite",
        "title": "Ha-eun invisible in hangout",
        "description": "Ha-eun is hidden when the video source fails.",
    }
    payload.update(overrides)
    return payload


class ReplayQaRouterTests(unittest.TestCase):
    def test_normalize_finding_has_stable_dedupe_key(self):
        first = router.normalize_finding(sample_raw())
        second = router.normalize_finding(sample_raw(replayTimestampMs=44999))

        self.assertEqual(first["dedupe_key"], second["dedupe_key"])
        self.assertEqual(first["replay_timestamp"], "42.150s")
        self.assertEqual(first["severity_label"], "high")
        self.assertEqual(first["proof"]["public_proof_url"], sample_raw()["proofUrl"])

    def test_ledger_upsert_is_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            ledger_path = Path(tmp) / "ledger.json"
            finding = router.normalize_finding(sample_raw())

            _, created, first_action = router.upsert_ledger(ledger_path, finding)
            ledger, updated, second_action = router.upsert_ledger(ledger_path, {**finding, "description": "Updated"})

            self.assertEqual(first_action, "created")
            self.assertEqual(second_action, "updated")
            self.assertEqual(created["dedupe_key"], updated["dedupe_key"])
            self.assertEqual(updated["description"], "Updated")
            self.assertEqual(len(ledger["findings"]), 1)

    @patch("replay_qa_router.subprocess.run")
    def test_route_updates_existing_issue_from_ledger(self, mock_run):
        finding = router.normalize_finding(sample_raw())
        ledger = {
            "schema_version": "1",
            "findings": [
                {
                    **finding,
                    "github": {
                        "issue_ref": "erniesg/tong#123",
                        "issue_number": 123,
                        "url": "https://github.com/erniesg/tong/issues/123",
                    },
                }
            ],
        }
        args = Namespace(
            repo="erniesg/tong",
            apply=False,
            prefer_direct_pr=False,
            safe_unattended=False,
            portable_context=False,
            lane_count=1,
            touched_path=[],
            design_ambiguous=False,
        )

        summary = router.build_routing_summary(args, finding, ledger)

        self.assertEqual(summary["routing"]["decision"], "update_issue")
        self.assertIn("erniesg/tong#123", summary["routing"]["reason"])
        mock_run.assert_not_called()

    @patch("replay_qa_router.find_existing_issue", return_value=None)
    def test_direct_pr_requires_all_safe_gates(self, _mock_find):
        finding = router.normalize_finding(sample_raw())
        args = Namespace(
            repo="erniesg/tong",
            apply=False,
            prefer_direct_pr=True,
            safe_unattended=True,
            portable_context=True,
            lane_count=1,
            touched_path=[],
            design_ambiguous=False,
        )

        summary = router.build_routing_summary(args, finding, {"schema_version": "1", "findings": []})

        self.assertEqual(summary["routing"]["decision"], "direct_pr")
        self.assertIn("render-rrweb-video.mjs", summary["verification"]["commands"][0])

    @patch("replay_qa_router.find_existing_issue", return_value=None)
    def test_direct_pr_blocked_by_protected_path(self, _mock_find):
        finding = router.normalize_finding(sample_raw())
        args = Namespace(
            repo="erniesg/tong",
            apply=False,
            prefer_direct_pr=True,
            safe_unattended=True,
            portable_context=True,
            lane_count=1,
            touched_path=[".github/workflows/playtest-agent-pipeline.yml"],
            design_ambiguous=False,
        )

        summary = router.build_routing_summary(args, finding, {"schema_version": "1", "findings": []})

        self.assertEqual(summary["routing"]["decision"], "human_review")
        self.assertIn("protected paths", summary["routing"]["reason"])

    def test_issue_body_contains_replay_verification_path(self):
        finding = router.normalize_finding(sample_raw())
        body = router.render_issue_body(
            finding,
            {"decision": "new_issue", "reason": "test", "confidence": 0.86},
        )

        self.assertIn(finding["dedupe_key"], body)
        self.assertIn("Seek to `42.150s`", body)
        self.assertIn("rrweb-render.webm", body)


if __name__ == "__main__":
    unittest.main()
