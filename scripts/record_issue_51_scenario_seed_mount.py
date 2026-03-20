#!/usr/bin/env python3

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote

from playwright.async_api import async_playwright


ROOT = Path(__file__).resolve().parents[1]
DEMO_PASSWORD = os.environ.get("TONG_DEMO_PASSWORD") or os.environ.get("TONG_DEMO_CODE") or "TONG-DEMO-ACCESS"


def run(command: list[str]) -> str:
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip() or "command failed"
        raise RuntimeError(detail)
    return result.stdout.strip()


def replace_placeholder(path: Path, lines: list[str]) -> None:
    current = path.read_text(encoding="utf-8")
    next_text = current.replace(
        "## Notes\n\n- Replace this scaffold with the actual validation findings.\n",
        "## Notes\n\n" + "\n".join(lines) + "\n",
    )
    path.write_text(next_text, encoding="utf-8")


def append_section(path: Path, heading: str, lines: list[str]) -> None:
    with path.open("a", encoding="utf-8") as handle:
        handle.write(f"\n\n## {heading}\n\n")
        handle.write("\n".join(lines))
        handle.write("\n")


def update_summary_status(path: Path, verdict: str, confidence: str) -> None:
    current = path.read_text(encoding="utf-8")
    current = current.replace("- Verdict: pending", f"- Verdict: {verdict}")
    current = current.replace("- Verdict: reproduced", f"- Verdict: {verdict}")
    current = current.replace("- Verdict: fixed", f"- Verdict: {verdict}")
    current = current.replace("- Confidence: 0.0", f"- Confidence: {confidence}")
    path.write_text(current, encoding="utf-8")


async def capture_browser(run_dir: Path, route: str) -> tuple[dict, list]:
    screenshot_path = run_dir / "screenshots" / "issue-51-scenario-seed-mount.png"
    browser_logs_path = run_dir / "logs" / "browser-state.json"

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 430, "height": 932})
        await page.goto(route, wait_until="networkidle")
        await page.wait_for_function(
            """
            () => {
              const qa = window.__TONG_QA__;
              if (!qa) return false;
              const state = qa.getState?.();
              return Boolean(
                state &&
                state.phase === 'hangout' &&
                state.hangoutResumeSource === 'scenario_seed' &&
                state.hangoutCheckpointPhase === 'review' &&
                state.sceneTurn === 4 &&
                state.currentExercise?.type === 'block_crush' &&
                Array.isArray(state.availableScenarioSeedIds) &&
                state.availableScenarioSeedIds.includes('review_ready')
              );
            }
            """,
            timeout=30000,
        )
        state = await page.evaluate("window.__TONG_QA__.getState()")
        logs = await page.evaluate("window.__TONG_QA__.getLogs()")
        browser_logs_path.write_text(json.dumps({"state": state, "logs": logs}, indent=2) + "\n", encoding="utf-8")
        await page.screenshot(path=str(screenshot_path), full_page=True)
        await browser.close()
        return state, logs


def update_evidence(run_dir: Path, route: str, state: dict, browser_log_relative: str, api_log_relative: str) -> None:
    evidence_path = run_dir / "evidence.json"
    screenshot_relative = str((run_dir / "screenshots" / "issue-51-scenario-seed-mount.png").relative_to(ROOT))
    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    evidence["summary"] = "Scenario seed mount verification passed in trusted CI."
    evidence["notes"] = [
        *(evidence.get("notes") or []),
        "Remote dependencies: none (repo-only local demo services in CI).",
        f"Browser route under test: `{route}`",
        "Seeded /game entry mounted the deterministic review-ready runtime without replaying the hangout intro.",
        "Strict API assertions also confirmed scenario_seed resume behavior and ordinary player checkpoint resume continuity.",
    ]
    evidence["console_logs"] = [
        *(evidence.get("console_logs") or []),
        {
            "path": browser_log_relative,
            "label": "browser-state",
            "description": "window.__TONG_QA__ state + session logs for the seeded /game mount",
        },
        {
            "path": api_log_relative,
            "label": "api-flow-log",
            "description": "Strict API flow transcript with scenario seed and ordinary resume assertions",
        },
    ]
    evidence["contract_assertions"] = [
        *(evidence.get("contract_assertions") or []),
        {
            "path": api_log_relative,
            "label": "scenario-seed-and-resume-assertions",
            "description": "Strict API assertions for scenario_seed and checkpoint resume behavior",
        },
    ]
    evidence["screenshots"] = [
        *(evidence.get("screenshots") or []),
        {
            "path": screenshot_relative,
            "label": "seeded-game-mount",
            "description": "Seeded /game review-ready state rendered from the deterministic scenario seed",
        },
    ]
    evidence["validation"] = {
        **(evidence.get("validation") or {}),
        "runtime_modes_exercised": [
            "browser-seeded-game-mount",
            "strict-api-flow",
            "scenario-seed",
            "checkpoint-resume",
        ],
        "notes": [
            "Trusted CI verified the seeded /game route mount and the strict API state contract.",
        ],
    }
    evidence_path.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")


async def main() -> None:
    issue_ref = "erniesg/tong#51"
    run_dir_text = run(
        [
            "python3",
            ".agents/skills/_functional-qa/scripts/qa_runtime.py",
            "init-run",
            "validate-issue",
            "--target",
            issue_ref,
            "--verify-fix",
        ]
    ).splitlines()[-1].strip()
    if not run_dir_text:
        raise RuntimeError("qa_runtime init-run did not return a run directory")

    run_dir = Path(run_dir_text)
    summary_path = run_dir / "summary.md"
    steps_path = run_dir / "steps.md"
    api_log_path = run_dir / "logs" / "api-flow-check.log"

    route = f"http://127.0.0.1:3000/game?scenarioSeed=review_ready&demo={quote(DEMO_PASSWORD)}&qa_run_id={quote(run_dir.name)}&qa_trace=1"
    state, logs = await capture_browser(run_dir, route)

    assert state["hangoutResumeSource"] == "scenario_seed"
    assert state["hangoutCheckpointPhase"] == "review"
    assert state["sceneTurn"] == 4
    assert state["currentExercise"]["type"] == "block_crush"
    assert "review_ready" in state["availableScenarioSeedIds"]

    api_command = [
        "node",
        "scripts/mock_api_flow_check.mjs",
        "http://127.0.0.1:8787",
        "--strict-state",
        "--check-scenario-seed",
    ]
    api_env = os.environ.copy()
    api_env.setdefault("TONG_DEMO_PASSWORD", DEMO_PASSWORD)
    api_result = subprocess.run(api_command, cwd=ROOT, capture_output=True, text=True, env=api_env)
    transcript = "\n".join(
        part for part in [f"$ {' '.join(api_command)}", api_result.stdout.strip(), api_result.stderr.strip()] if part
    )
    api_log_path.write_text(transcript + "\n", encoding="utf-8")
    if api_result.returncode != 0:
        raise RuntimeError((api_result.stderr or api_result.stdout or "").strip() or "mock_api_flow_check failed")

    replace_placeholder(
        summary_path,
        [
            "- Trusted CI mounted `/game?scenarioSeed=review_ready` into the deterministic review-ready runtime state.",
            f"- Browser route: `{route}`",
            f"- Seeded mount state: resumeSource=`{state['hangoutResumeSource']}`, phase=`{state['hangoutCheckpointPhase']}`, turn=`{state['sceneTurn']}`, exercise=`{state['currentExercise']['type']}`.",
            f"- Browser logs captured {len(logs)} session log bundle(s).",
            f"- Strict API transcript: `{api_log_path.relative_to(ROOT)}`",
            "- Remote dependencies: none (repo-only local demo services in CI).",
        ],
    )
    append_section(
        summary_path,
        "Verification",
        [
            "- Browser-backed seeded route mount passed.",
            "- `window.__TONG_QA__` showed `hangoutResumeSource === \"scenario_seed\"` and a `block_crush` exercise on turn 4.",
            "- Strict API replay also passed for scenario seed start-or-resume and ordinary player checkpoint resume.",
        ],
    )
    append_section(
        steps_path,
        "Trusted CI Replay",
        [
            "1. Initialized a `validate-issue --verify-fix` run scaffold.",
            f"2. Opened `{route}` in headless Chromium and waited for the seeded `/game` mount to report review-ready QA state.",
            "3. Saved a seeded mount screenshot plus `window.__TONG_QA__` state/log export.",
            "4. Ran `node scripts/mock_api_flow_check.mjs http://127.0.0.1:8787 --strict-state --check-scenario-seed` to verify scenario seed + ordinary resume contract behavior.",
            "5. Finalized the run as fixed.",
        ],
    )
    update_evidence(
        run_dir,
        route,
        state,
        str((run_dir / "logs" / "browser-state.json").relative_to(ROOT)),
        str(api_log_path.relative_to(ROOT)),
    )
    run(
        [
            "python3",
            ".agents/skills/_functional-qa/scripts/qa_runtime.py",
            "finalize-run",
            "--run-dir",
            str(run_dir),
            "--verdict",
            "fixed",
            "--repro-status",
            "not-reproduced",
            "--fix-status",
            "fixed",
            "--issue-accuracy",
            "accurate",
            "--confidence",
            "0.94",
        ]
    )
    update_summary_status(summary_path, "fixed", "0.94")
    print(run_dir)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:  # noqa: BLE001
        print(str(exc), file=sys.stderr)
        sys.exit(1)
