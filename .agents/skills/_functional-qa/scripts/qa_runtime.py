#!/usr/bin/env python3
"""Shared runtime for the functional QA skill suite."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCRIPT_PATH = Path(__file__).resolve()
SHARED_ROOT = SCRIPT_PATH.parents[1]
REPO_ROOT = SCRIPT_PATH.parents[4]
CONFIG_ROOT = SHARED_ROOT / "config"
TEMPLATE_ROOT = SHARED_ROOT / "templates"

VERDICTS = {"reproduced", "not-reproduced", "partially-reproduced", "ambiguous", "blocked", "fixed"}
REPRO_STATUSES = {"reproduced", "not-reproduced", "partially-reproduced", "ambiguous", "blocked", "not-run"}
FIX_STATUSES = {"not-checked", "fixed", "still-reproduces", "inconclusive"}
ISSUE_ACCURACY = {"accurate", "stale", "misdescribed", "n/a"}
FIX_ALLOWED_EXECUTION_MODES = {"safe-unattended", "requires-live-model"}


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


CLASSIFICATION_RULES = load_json(CONFIG_ROOT / "classification-rules.json")
EVIDENCE_STRATEGIES = load_json(CONFIG_ROOT / "evidence-strategies.json")
PUBLISH_POLICY = load_json(CONFIG_ROOT / "publish-policy.json")
REPO_ADAPTER = load_json(CONFIG_ROOT / "repo-adapter.json")


def run_command(command: list[str], *, cwd: Path | None = None, allow_failure: bool = False) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        command,
        cwd=str(cwd or REPO_ROOT),
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0 and not allow_failure:
        raise RuntimeError(f"Command failed: {' '.join(command)}\n{result.stderr.strip()}")
    return result


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:80] or "target"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def timestamp_slug() -> str:
    return utc_now().strftime("%Y%m%dT%H%M%SZ")


def relative_to_repo(path: Path) -> str:
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def repo_name_with_owner() -> str:
    return REPO_ADAPTER["repository"]["name_with_owner"]


def parse_issue_ref(raw: str) -> dict[str, Any]:
    cleaned = raw.strip()
    number_match = re.fullmatch(r"#?(\d+)", cleaned)
    if number_match:
        issue_number = int(number_match.group(1))
        return {
            "kind": "github",
            "repo": repo_name_with_owner(),
            "number": issue_number,
            "issue_ref": f"{repo_name_with_owner()}#{issue_number}",
        }

    repo_ref_match = re.fullmatch(r"([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)#(\d+)", cleaned)
    if repo_ref_match:
        repo = repo_ref_match.group(1)
        issue_number = int(repo_ref_match.group(2))
        return {
            "kind": "github",
            "repo": repo,
            "number": issue_number,
            "issue_ref": f"{repo}#{issue_number}",
        }

    url_match = re.fullmatch(r"https://github\.com/([^/]+/[^/]+)/issues/(\d+)", cleaned)
    if url_match:
        repo = url_match.group(1)
        issue_number = int(url_match.group(2))
        return {
            "kind": "github",
            "repo": repo,
            "number": issue_number,
            "issue_ref": f"{repo}#{issue_number}",
        }

    return {
        "kind": "description",
        "repo": None,
        "number": None,
        "issue_ref": None,
    }


def fetch_issue(target: str) -> dict[str, Any] | None:
    parsed = parse_issue_ref(target)
    if parsed["kind"] != "github":
        return None

    result = run_command(
        [
            "gh",
            "api",
            f"repos/{parsed['repo']}/issues/{parsed['number']}",
        ],
        allow_failure=True,
    )
    if result.returncode != 0:
        return {
            "repo": parsed["repo"],
            "number": parsed["number"],
            "issue_ref": parsed["issue_ref"],
            "title": target if target != parsed["issue_ref"] else parsed["issue_ref"],
            "body": "",
            "html_url": f"https://github.com/{parsed['repo']}/issues/{parsed['number']}",
            "labels": [],
            "created_at": None,
            "updated_at": None,
            "metadata_resolution": "fallback-no-gh",
        }

    payload = json.loads(result.stdout)
    return {
        "repo": parsed["repo"],
        "number": parsed["number"],
        "issue_ref": parsed["issue_ref"],
        "title": payload.get("title", ""),
        "body": payload.get("body", ""),
        "html_url": payload.get("html_url", ""),
        "labels": [label["name"] for label in payload.get("labels", [])],
        "created_at": payload.get("created_at"),
        "updated_at": payload.get("updated_at"),
    }


def collect_issue_notes(issue_ref: str | None) -> list[str]:
    if not issue_ref:
        return []
    notes: list[str] = []
    for item in REPO_ADAPTER.get("issue_notes", []):
        if item["match"] in issue_ref:
            notes.extend(item["notes"])
    return notes


def issue_playbook(issue_ref: str | None) -> dict[str, Any] | None:
    if not issue_ref:
        return None
    for item in REPO_ADAPTER.get("issue_playbooks", []):
        if item["match"] in issue_ref:
            return item
    return None


def classification_override(issue_ref: str | None) -> str | None:
    if not issue_ref:
        return None
    for item in REPO_ADAPTER.get("issue_notes", []):
        if item["match"] in issue_ref:
            return item.get("issue_class_override")
    return None


def unique_lines(items: list[str]) -> list[str]:
    return list(dict.fromkeys(item for item in items if item))


def build_validation_policy(playbook: dict[str, Any] | None, issue_class: str, evidence_plan: dict[str, Any]) -> dict[str, Any]:
    defaults = REPO_ADAPTER.get("validation_defaults", {})
    requirements = (playbook or {}).get("validation_requirements", {})
    execution_mode = (playbook or {}).get("execution_mode") or defaults.get("execution_mode", "safe-unattended")

    requires_direct_issue_evidence = requirements.get("requires_direct_issue_evidence", evidence_plan["requires_ui_capture"])
    ui_acceptance_required = requirements.get("ui_acceptance_required", evidence_plan["requires_ui_capture"])

    direct_evidence = unique_lines(
        (defaults.get("direct_evidence_requirements", []) if requires_direct_issue_evidence else [])
        + requirements.get("direct_evidence", [])
    )
    ui_acceptance_checks = unique_lines(
        (defaults.get("ui_acceptance_checks", []) if ui_acceptance_required else [])
        + requirements.get("ui_acceptance_checks", [])
    )

    return {
        "issue_class": issue_class,
        "execution_mode": execution_mode,
        "fix_allowed": execution_mode in FIX_ALLOWED_EXECUTION_MODES,
        "requires_direct_issue_evidence": requires_direct_issue_evidence,
        "direct_evidence": direct_evidence,
        "ui_acceptance_required": ui_acceptance_required,
        "ui_acceptance_checks": ui_acceptance_checks,
        "required_runtime_modes_for_fixed": requirements.get("required_runtime_modes_for_fixed", []),
        "requires_live_model_for_fixed": requirements.get("requires_live_model_for_fixed", False),
        "human_review_required": requirements.get("human_review_required", execution_mode == "needs-human-design-review"),
        "stop_conditions": requirements.get("stop_conditions", []),
    }


def classify_issue_text(text: str) -> dict[str, Any]:
    lowered = text.lower()
    candidates: list[tuple[int, int, str, list[str]]] = []
    for rule in CLASSIFICATION_RULES["rules"]:
        matches = [keyword for keyword in rule["keywords"] if keyword in lowered]
        if matches:
            candidates.append((len(matches), rule["priority"], rule["issue_class"], matches))

    if not candidates:
        return {
            "issue_class": CLASSIFICATION_RULES["default_issue_class"],
            "signals": [],
            "reason": "No keyword rule matched; fell back to the default issue class.",
        }

    candidates.sort(reverse=True)
    match_count, priority, issue_class, signals = candidates[0]
    return {
        "issue_class": issue_class,
        "signals": signals,
        "reason": f"Matched {match_count} keyword signal(s) at priority {priority}.",
    }


def evidence_plan_for(issue_class: str) -> dict[str, Any]:
    defaults = EVIDENCE_STRATEGIES["defaults"]
    strategy = EVIDENCE_STRATEGIES["strategies"].get(issue_class, defaults)
    return {
        "required": strategy["required"],
        "optional": strategy["optional"],
        "requires_ui_capture": strategy["requires_ui_capture"],
    }


def render_template(path: Path, replacements: dict[str, str]) -> str:
    rendered = path.read_text(encoding="utf-8")
    for needle, value in replacements.items():
        rendered = rendered.replace(needle, value)
    return rendered


def build_browser_route(playbook: dict[str, Any], run_id: str) -> str:
    defaults = REPO_ADAPTER.get("browser_defaults", {})
    route = playbook["route_template"]
    route = route.replace("{{run_id}}", run_id)
    route = route.replace("{{demo_password}}", defaults.get("demo_password", "TONG-JUDGE-DEMO"))
    base_url = defaults.get("base_url", "")
    if route.startswith("http://") or route.startswith("https://"):
        return route
    return f"{base_url}{route}"


def create_browser_artifacts(run_dir: Path, run_manifest: dict[str, Any], playbook: dict[str, Any]) -> None:
    browser_dir = run_dir / "browser"
    browser_dir.mkdir(exist_ok=True)

    route = build_browser_route(playbook, run_manifest["run_id"])
    steps_md = "\n".join(f"{idx}. {item}" for idx, item in enumerate(playbook.get("steps", []), start=1))
    screenshot_targets = "\n".join(f"- {item}" for item in playbook.get("screenshot_targets", [])) or "- None specified."
    state_targets = "\n".join(f"- {item}" for item in playbook.get("state_targets", [])) or "- None specified."

    replacements = {
        "{{run_id}}": run_manifest["run_id"],
        "{{issue_ref}}": run_manifest.get("issue_ref") or "n/a",
        "{{surface}}": playbook.get("surface", "unknown"),
        "{{route}}": route,
        "{{steps}}": steps_md,
        "{{screenshot_targets}}": screenshot_targets,
        "{{state_targets}}": state_targets,
        "{{screenshots_dir}}": relative_to_repo(run_dir / "screenshots"),
        "{{logs_dir}}": relative_to_repo(run_dir / "logs"),
    }

    (run_dir / "browser-playbook.md").write_text(
        render_template(TEMPLATE_ROOT / "browser-playbook.md.tmpl", replacements) + "\n",
        encoding="utf-8",
    )
    (browser_dir / "session-export.js").write_text(
        render_template(
            TEMPLATE_ROOT / "browser-session-export.js.tmpl",
            {
                "{{run_id}}": run_manifest["run_id"],
                "{{issue_ref}}": run_manifest.get("issue_ref") or "n/a",
            },
        )
        + "\n",
        encoding="utf-8",
    )
    (browser_dir / "state-snapshot.js").write_text(
        render_template(TEMPLATE_ROOT / "browser-state-snapshot.js.tmpl", {}) + "\n",
        encoding="utf-8",
    )

    run_manifest["artifacts"]["browser_playbook_md"] = relative_to_repo(run_dir / "browser-playbook.md")
    run_manifest["artifacts"]["browser_dir"] = relative_to_repo(browser_dir)
    run_manifest["browser_route"] = route


def collect_environment() -> dict[str, Any]:
    branch = run_command(["git", "rev-parse", "--abbrev-ref", "HEAD"]).stdout.strip()
    commit = run_command(["git", "rev-parse", "HEAD"]).stdout.strip()
    return {
        "generated_at": utc_now().isoformat(),
        "repo_root": str(REPO_ROOT),
        "repo_name_with_owner": repo_name_with_owner(),
        "branch": branch,
        "commit": commit,
        "default_branch": REPO_ADAPTER["repository"]["default_branch"],
        "smoke_commands": REPO_ADAPTER.get("smoke_commands", []),
    }


def artifact_root() -> Path:
    return REPO_ROOT / REPO_ADAPTER["artifact_root"]


def load_run_manifest(run_dir: Path) -> dict[str, Any]:
    return load_json(run_dir / "run.json")


def find_previous_run(issue_ref: str | None, target_slug: str, exclude_dir: Path | None = None) -> dict[str, Any] | None:
    matches: list[tuple[str, dict[str, Any], Path]] = []
    for manifest_path in artifact_root().glob("functional-qa/*/*/run.json"):
        run_dir = manifest_path.parent
        if exclude_dir and run_dir == exclude_dir:
            continue
        manifest = load_json(manifest_path)
        same_issue = issue_ref and manifest.get("issue_ref") == issue_ref
        same_target = manifest.get("target", {}).get("slug") == target_slug
        if same_issue or same_target:
            matches.append((manifest["environment"]["generated_at"], manifest, run_dir))
    if not matches:
        return None
    matches.sort(key=lambda item: item[0], reverse=True)
    _, manifest, run_dir = matches[0]
    manifest["run_dir"] = str(run_dir)
    return manifest


def bootstrap_text(
    mode: str,
    issue_payload: dict[str, Any] | None,
    verify_fix: bool,
    previous_run: dict[str, Any] | None,
    validation_policy: dict[str, Any],
) -> tuple[str, str, dict[str, Any]]:
    summary_lines = [
        "# Summary",
        "",
        f"- Mode: `{mode}`",
        f"- Target: `{issue_payload['issue_ref'] if issue_payload else 'ad-hoc target'}`",
        f"- Execution mode: `{validation_policy['execution_mode']}`",
        "- Verdict: pending",
        "- Confidence: 0.0",
        "",
        "## Notes",
        "",
        "- Replace this scaffold with the actual validation findings.",
    ]
    steps_lines = [
        "# Steps",
        "",
        "1. Read the issue or target description.",
        "2. Run the smoke commands from the repo adapter.",
        "3. Capture evidence according to the evidence plan.",
        "4. If the run is ambiguous and stateful, invoke `trace-ui-state`.",
        "5. Finalize the run manifest and publish according to policy.",
        "",
        "## Validation Gates",
        "",
        f"- Execution mode: `{validation_policy['execution_mode']}`",
        f"- Direct issue evidence required: `{'yes' if validation_policy['requires_direct_issue_evidence'] else 'no'}`",
        f"- UI acceptance gate required: `{'yes' if validation_policy['ui_acceptance_required'] else 'no'}`",
        f"- Live model required for a fixed verdict: `{'yes' if validation_policy['requires_live_model_for_fixed'] else 'no'}`",
        f"- Human review required before a fixed verdict: `{'yes' if validation_policy['human_review_required'] else 'no'}`",
    ]
    if validation_policy["direct_evidence"]:
        steps_lines.extend(["", "### Direct Evidence Targets", ""])
        steps_lines.extend(f"- {item}" for item in validation_policy["direct_evidence"])
    if validation_policy["ui_acceptance_checks"]:
        steps_lines.extend(["", "### UI Acceptance Checks", ""])
        steps_lines.extend(f"- {item}" for item in validation_policy["ui_acceptance_checks"])
    if validation_policy["required_runtime_modes_for_fixed"]:
        steps_lines.extend(["", "### Required Runtime Modes For Fixed", ""])
        steps_lines.extend(f"- `{item}`" for item in validation_policy["required_runtime_modes_for_fixed"])
    if validation_policy["stop_conditions"]:
        steps_lines.extend(["", "### Stop Conditions", ""])
        steps_lines.extend(f"- {item}" for item in validation_policy["stop_conditions"])
    if verify_fix and previous_run:
        steps_lines.extend(
            [
                "",
                "## Replay the previous run",
                "",
                f"- Previous run id: `{previous_run['run_id']}`",
                f"- Previous run dir: `{previous_run['run_dir']}`",
                "- Reuse the prior steps before claiming a fix.",
            ]
        )

    evidence = {
        "summary": "",
        "screenshots": [],
        "comparison_panels": [],
        "comparison_focus_crops": [],
        "temporal_capture": [],
        "console_logs": [],
        "network_traces": [],
        "contract_assertions": [],
        "perf_profiles": [],
        "cross_env_matrix": [],
        "open_questions": [],
        "notes": [],
        "validation": {
            "direct_issue_evidence_complete": not validation_policy["requires_direct_issue_evidence"],
            "ui_acceptance_complete": not validation_policy["ui_acceptance_required"],
            "runtime_modes_exercised": [],
            "live_model_confirmed": not validation_policy["requires_live_model_for_fixed"],
            "human_review_completed": not validation_policy["human_review_required"],
            "missing_requirements": [],
            "notes": []
        }
    }
    return ("\n".join(summary_lines) + "\n", "\n".join(steps_lines) + "\n", evidence)


def validation_gate_failures(run: dict[str, Any], evidence: dict[str, Any], *, for_fixed_claim: bool) -> list[str]:
    policy = run.get("validation_policy", {})
    validation = evidence.get("validation", {})
    failures: list[str] = []

    if for_fixed_claim and policy.get("execution_mode") not in FIX_ALLOWED_EXECUTION_MODES:
        failures.append(f"execution mode `{policy.get('execution_mode', 'unknown')}` is validation-only")

    if policy.get("requires_direct_issue_evidence") and not validation.get("direct_issue_evidence_complete", False):
        failures.append("direct issue evidence is not marked complete")

    if policy.get("ui_acceptance_required") and not validation.get("ui_acceptance_complete", False):
        failures.append("UI acceptance gate is not marked complete")

    required_modes = policy.get("required_runtime_modes_for_fixed", [])
    if required_modes:
        exercised = set(validation.get("runtime_modes_exercised", []))
        missing_modes = [mode for mode in required_modes if mode not in exercised]
        if missing_modes:
            failures.append("missing required runtime modes: " + ", ".join(missing_modes))

    if policy.get("requires_live_model_for_fixed") and not validation.get("live_model_confirmed", False):
        failures.append("live-model validation is not confirmed")

    if policy.get("human_review_required") and not validation.get("human_review_completed", False):
        failures.append("human review is not marked complete")

    for item in validation.get("missing_requirements", []):
        failures.append(f"missing requirement noted by runner: {item}")

    return failures


def render_validation_gate_lines(run: dict[str, Any], evidence: dict[str, Any]) -> str:
    policy = run.get("validation_policy", {})
    validation = evidence.get("validation", {})
    runtime_modes = validation.get("runtime_modes_exercised", [])
    failures = validation_gate_failures(run, evidence, for_fixed_claim=run["functional"]["fix_status"] == "fixed" or run["functional"]["verdict"] == "fixed")

    lines = [
        f"- Execution mode: `{policy.get('execution_mode', 'safe-unattended')}`",
        f"- Direct issue evidence: `{'complete' if validation.get('direct_issue_evidence_complete', False) else 'missing' if policy.get('requires_direct_issue_evidence') else 'not-required'}`",
        f"- UI acceptance gate: `{'complete' if validation.get('ui_acceptance_complete', False) else 'missing' if policy.get('ui_acceptance_required') else 'not-required'}`",
        f"- Runtime modes exercised: `{', '.join(runtime_modes) if runtime_modes else 'none recorded'}`",
        f"- Live model confirmation: `{'confirmed' if validation.get('live_model_confirmed', False) else 'missing' if policy.get('requires_live_model_for_fixed') else 'not-required'}`",
        f"- Human review: `{'complete' if validation.get('human_review_completed', False) else 'missing' if policy.get('human_review_required') else 'not-required'}`",
    ]
    if failures:
        lines.append("- Remaining validation gaps:")
        lines.extend(f"  - {item}" for item in failures)
    return "\n".join(lines)


def render_publish(run: dict[str, Any], run_dir: Path) -> str:
    template = (TEMPLATE_ROOT / "publish-comment.md.tmpl").read_text(encoding="utf-8")
    summary_path = run_dir / "summary.md"
    steps_path = run_dir / "steps.md"
    evidence_path = run_dir / "evidence.json"
    summary_body = summary_path.read_text(encoding="utf-8").strip()
    evidence = load_json(evidence_path)
    bullets = []
    for key in (
        "screenshots",
        "comparison_panels",
        "comparison_focus_crops",
        "temporal_capture",
        "console_logs",
        "network_traces",
        "contract_assertions",
        "perf_profiles",
        "cross_env_matrix",
    ):
        entries = evidence.get(key, [])
        if entries:
            bullets.append(f"- `{key}`: {len(entries)} item(s)")
    if not bullets:
        bullets.append("- Evidence bundle still needs real capture entries.")

    open_questions = evidence.get("open_questions", [])
    open_questions_md = "\n".join(f"- {item}" for item in open_questions) if open_questions else "- None."

    if run["mode"] == "validate-issue" and run["functional"]["fix_status"] == "not-checked":
        regression_checks = "- Re-run the saved repro checklist after the fix and compare against this run."
    elif run["functional"]["fix_status"] == "fixed":
        regression_checks = "- The prior repro no longer occurs. Keep adjacent smoke checks green."
    else:
        regression_checks = f"- Fix status: `{run['functional']['fix_status']}`."

    replacements = {
        "{{run_id}}": run["run_id"],
        "{{mode}}": run["mode"],
        "{{issue_ref}}": run.get("issue_ref") or "n/a",
        "{{issue_class}}": run["classification"]["issue_class"],
        "{{execution_mode}}": run.get("validation_policy", {}).get("execution_mode", "safe-unattended"),
        "{{evidence_plan}}": ", ".join(run["evidence_plan"]["required"]),
        "{{verdict}}": run["functional"]["verdict"],
        "{{confidence}}": f"{run['confidence']:.2f}",
        "{{issue_accuracy}}": run["functional"]["issue_accuracy"],
        "{{summary_body}}": summary_body,
        "{{evidence_bullets}}": "\n".join(bullets),
        "{{validation_gates}}": render_validation_gate_lines(run, evidence),
        "{{regression_checks}}": regression_checks,
        "{{open_questions}}": open_questions_md,
        "{{summary_path}}": relative_to_repo(summary_path),
        "{{steps_path}}": relative_to_repo(steps_path),
        "{{evidence_path}}": relative_to_repo(evidence_path),
        "{{run_path}}": relative_to_repo(run_dir / "run.json"),
    }
    rendered = template
    for needle, value in replacements.items():
        rendered = rendered.replace(needle, value)
    return rendered


def summary_is_placeholder(summary_text: str) -> bool:
    return "Replace this scaffold with the actual validation findings." in summary_text


def validate_outcome_combination(verdict: str, repro_status: str, fix_status: str) -> None:
    if verdict == "fixed" and fix_status != "fixed":
        raise ValueError("`verdict=fixed` requires `fix_status=fixed`.")
    if fix_status == "fixed" and repro_status != "not-reproduced":
        raise ValueError("`fix_status=fixed` requires `repro_status=not-reproduced`.")
    if fix_status == "still-reproduces" and repro_status != "reproduced":
        raise ValueError("`fix_status=still-reproduces` requires `repro_status=reproduced`.")
    if verdict == "not-reproduced" and repro_status == "reproduced":
        raise ValueError("`verdict=not-reproduced` cannot be paired with `repro_status=reproduced`.")
    if verdict in {"reproduced", "partially-reproduced", "ambiguous", "blocked"} and fix_status == "fixed":
        raise ValueError(f"`verdict={verdict}` cannot be paired with `fix_status=fixed`.")


def init_run(args: argparse.Namespace) -> int:
    issue_payload = fetch_issue(args.target)
    raw_text = args.target
    if issue_payload:
        if issue_payload.get("title") or issue_payload.get("body"):
            raw_text = f"{issue_payload['title']}\n\n{issue_payload['body']}".strip()
        else:
            raw_text = args.target
    classification = classify_issue_text(raw_text)
    override = classification_override(issue_payload["issue_ref"] if issue_payload else None)
    if override:
        classification = {
            "issue_class": override,
            "signals": classification["signals"],
            "reason": f"Repo adapter override selected `{override}` for {issue_payload['issue_ref']}.",
        }
    evidence_plan = evidence_plan_for(classification["issue_class"])
    playbook = issue_playbook(issue_payload["issue_ref"] if issue_payload else None)
    validation_policy = build_validation_policy(playbook, classification["issue_class"], evidence_plan)

    target_slug = slugify(issue_payload["issue_ref"] if issue_payload else args.target)
    run_timestamp = timestamp_slug()
    run_id = f"functional-qa-{args.mode}-{run_timestamp}-{target_slug}"
    run_dir = artifact_root() / "functional-qa" / target_slug / run_timestamp
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "screenshots").mkdir(exist_ok=True)
    (run_dir / "logs").mkdir(exist_ok=True)

    previous_run = find_previous_run(issue_payload["issue_ref"] if issue_payload else None, target_slug, exclude_dir=run_dir)
    summary_text, steps_text, evidence = bootstrap_text(
        args.mode,
        issue_payload,
        args.verify_fix,
        previous_run,
        validation_policy,
    )

    run_manifest = {
        "schema_version": "1",
        "run_id": run_id,
        "suite": "functional-qa",
        "mode": args.mode,
        "target": {
            "raw": args.target,
            "slug": target_slug,
        },
        "issue_ref": issue_payload["issue_ref"] if issue_payload else None,
        "classification": classification,
        "evidence_plan": evidence_plan,
        "validation_policy": validation_policy,
        "functional": {
            "verdict": "pending",
            "repro_status": "not-run",
            "fix_status": "not-checked" if not args.verify_fix else "inconclusive",
            "issue_accuracy": "n/a" if not issue_payload else "accurate",
        },
        "confidence": 0.0,
        "environment": collect_environment(),
        "artifacts": {
            "run_json": relative_to_repo(run_dir / "run.json"),
            "summary_md": relative_to_repo(run_dir / "summary.md"),
            "steps_md": relative_to_repo(run_dir / "steps.md"),
            "evidence_json": relative_to_repo(run_dir / "evidence.json"),
            "publish_md": relative_to_repo(run_dir / "publish.md"),
            "screenshots_dir": relative_to_repo(run_dir / "screenshots"),
            "logs_dir": relative_to_repo(run_dir / "logs"),
        },
        "published_comment_url": None,
        "previous_run_id": previous_run["run_id"] if previous_run and args.verify_fix else None,
        "repo_notes": collect_issue_notes(issue_payload["issue_ref"] if issue_payload else None),
    }

    if playbook:
        create_browser_artifacts(run_dir, run_manifest, playbook)

    (run_dir / "run.json").write_text(json.dumps(run_manifest, indent=2) + "\n", encoding="utf-8")
    (run_dir / "summary.md").write_text(summary_text, encoding="utf-8")
    (run_dir / "steps.md").write_text(steps_text, encoding="utf-8")
    (run_dir / "evidence.json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    (run_dir / "publish.md").write_text("Publish draft will be rendered after finalize-run.\n", encoding="utf-8")
    if issue_payload:
        (run_dir / "issue.json").write_text(json.dumps(issue_payload, indent=2) + "\n", encoding="utf-8")

    print(str(run_dir))
    return 0


def finalize_run(args: argparse.Namespace) -> int:
    run_dir = Path(args.run_dir).resolve()
    run = load_run_manifest(run_dir)
    evidence = load_json(run_dir / "evidence.json")
    verdict = args.verdict
    if verdict not in VERDICTS:
        raise ValueError(f"Unsupported verdict: {verdict}")
    if args.repro_status not in REPRO_STATUSES:
        raise ValueError(f"Unsupported repro status: {args.repro_status}")
    if args.fix_status not in FIX_STATUSES:
        raise ValueError(f"Unsupported fix status: {args.fix_status}")
    if args.issue_accuracy not in ISSUE_ACCURACY:
        raise ValueError(f"Unsupported issue accuracy: {args.issue_accuracy}")
    validate_outcome_combination(verdict, args.repro_status, args.fix_status)

    if verdict == "fixed" or args.fix_status == "fixed":
        failures = validation_gate_failures(run, evidence, for_fixed_claim=True)
        if failures:
            raise ValueError("Cannot finalize as fixed: " + "; ".join(failures))

    run["functional"]["verdict"] = verdict
    run["functional"]["repro_status"] = args.repro_status
    run["functional"]["fix_status"] = args.fix_status
    run["functional"]["issue_accuracy"] = args.issue_accuracy
    run["confidence"] = args.confidence
    if args.previous_run_id:
        run["previous_run_id"] = args.previous_run_id

    (run_dir / "run.json").write_text(json.dumps(run, indent=2) + "\n", encoding="utf-8")
    rendered = render_publish(run, run_dir)
    (run_dir / "publish.md").write_text(rendered + "\n", encoding="utf-8")
    print(str(run_dir / "publish.md"))
    return 0


def publish_github(args: argparse.Namespace) -> int:
    run_dir = Path(args.run_dir).resolve()
    run = load_run_manifest(run_dir)
    evidence = load_json(run_dir / "evidence.json")
    issue_ref = run.get("issue_ref")
    if not issue_ref:
        print("Run has no GitHub issue reference; skipping publish.")
        return 0

    summary_body = (run_dir / "summary.md").read_text(encoding="utf-8")
    if summary_is_placeholder(summary_body):
        print("Publish blocked: summary.md still contains the scaffold placeholder.")
        return 3

    threshold = PUBLISH_POLICY["confidence_threshold"]
    verdict = run["functional"]["verdict"]
    confidence = run["confidence"]
    should_publish = args.force or confidence >= threshold or (verdict == "ambiguous" and PUBLISH_POLICY["publish_ambiguous"])

    if not should_publish:
        print(f"Publish skipped by policy: confidence {confidence:.2f} < {threshold:.2f} and verdict `{verdict}` is not force-published.")
        return 0

    if PUBLISH_POLICY.get("block_publish_for_unmet_validation_gates"):
        failures = validation_gate_failures(run, evidence, for_fixed_claim=run["functional"]["fix_status"] == "fixed" or verdict == "fixed")
        if failures:
            print("Publish blocked: unmet validation gates: " + "; ".join(failures))
            return 4

    auth = run_command(["gh", "auth", "status"], allow_failure=True)
    if auth.returncode != 0:
        message = "GitHub auth unavailable; stopping without publish."
        if PUBLISH_POLICY["stop_without_publish_if_missing_auth"]:
            print(message)
            return 2
        print(message)
        return 0

    body = (run_dir / "publish.md").read_text(encoding="utf-8")
    if args.dry_run:
        print(f"Dry run: would publish comment for {issue_ref} from {relative_to_repo(run_dir / 'publish.md')}")
        return 0

    repo, number = issue_ref.split("#", 1)
    payload = {"body": body}
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as handle:
        json.dump(payload, handle)
        temp_path = Path(handle.name)

    try:
        result = run_command(
            [
                "gh",
                "api",
                f"repos/{repo}/issues/{number}/comments",
                "--input",
                str(temp_path),
            ]
        )
    finally:
        temp_path.unlink(missing_ok=True)

    response = json.loads(result.stdout)
    run["published_comment_url"] = response.get("html_url")

    if run["functional"]["fix_status"] == "fixed" and PUBLISH_POLICY["auto_close_fixed"]:
        run_command(
            [
                "gh",
                "api",
                f"repos/{repo}/issues/{number}",
                "-X",
                "PATCH",
                "-f",
                "state=closed",
            ]
        )

    (run_dir / "run.json").write_text(json.dumps(run, indent=2) + "\n", encoding="utf-8")
    print(run["published_comment_url"])
    return 0


def show_policy(_: argparse.Namespace) -> int:
    print(json.dumps(PUBLISH_POLICY, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Functional QA runtime")
    subparsers = parser.add_subparsers(dest="command", required=True)

    init_parser = subparsers.add_parser("init-run", help="Create a run scaffold.")
    init_parser.add_argument("mode", choices=["validate-issue", "trace-ui-state", "publish-issue-update"])
    init_parser.add_argument("--target", required=True, help="Issue number, issue URL, or plain-language target.")
    init_parser.add_argument("--verify-fix", action="store_true", help="Link the run to the most recent matching validation run.")
    init_parser.set_defaults(func=init_run)

    finalize_parser = subparsers.add_parser("finalize-run", help="Finalize a run and render publish.md.")
    finalize_parser.add_argument("--run-dir", required=True)
    finalize_parser.add_argument("--verdict", required=True)
    finalize_parser.add_argument("--repro-status", default="not-run")
    finalize_parser.add_argument("--fix-status", default="not-checked")
    finalize_parser.add_argument("--issue-accuracy", default="n/a")
    finalize_parser.add_argument("--confidence", type=float, required=True)
    finalize_parser.add_argument("--previous-run-id")
    finalize_parser.set_defaults(func=finalize_run)

    publish_parser = subparsers.add_parser("publish-github", help="Publish the rendered issue update.")
    publish_parser.add_argument("--run-dir", required=True)
    publish_parser.add_argument("--dry-run", action="store_true")
    publish_parser.add_argument("--force", action="store_true")
    publish_parser.set_defaults(func=publish_github)

    policy_parser = subparsers.add_parser("show-policy", help="Print the active publish policy.")
    policy_parser.set_defaults(func=show_policy)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return args.func(args)
    except Exception as exc:  # pragma: no cover - CLI guard
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
