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
REVIEWER_PROOF_REQUIRED_CLASSES = {"interaction-input", "animation-transition", "async-streaming-state"}


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


CLASSIFICATION_RULES = load_json(CONFIG_ROOT / "classification-rules.json")
EVIDENCE_STRATEGIES = load_json(CONFIG_ROOT / "evidence-strategies.json")
PUBLISH_POLICY = load_json(CONFIG_ROOT / "publish-policy.json")
REPO_ADAPTER = load_json(CONFIG_ROOT / "repo-adapter.json")
WORKTREE_ROUTING = load_json(CONFIG_ROOT / "worktree-routing.json")
CLOUD_CONFIG = load_json(CONFIG_ROOT / "codex-cloud.json")

PROJECT_OVERRIDE_CACHE: dict[str, dict[str, str]] | None = None

LOCAL_PATH_PATTERN = re.compile(
    r"(?P<path>(?:"
    r"/Users/[^/\s`\"'<>]+(?:/[^\s`\"'<>]+)+"
    r"|/home/[^/\s`\"'<>]+(?:/[^\s`\"'<>]+)+"
    r"|/var/folders/[^/\s`\"'<>]+(?:/[^\s`\"'<>]+)+"
    r"|/private/var/[^/\s`\"'<>]+(?:/[^\s`\"'<>]+)+"
    r"|[A-Za-z]:(?:\\)+Users(?:\\)+[^\\\s`\"'<>]+(?:(?:\\)+[^\\\s`\"'<>]+)+"
    r"))"
)
PRIVATE_REFERENCE_PATTERNS = (
    re.compile(r"\bprivate(?:-| )?(?:repo|repository)(?:-only)?\b", re.IGNORECASE),
    re.compile(r"\bprivate(?:-| )?(?:branch|submodule|gist)\b", re.IGNORECASE),
    re.compile(r"\bprivate github repo\b", re.IGNORECASE),
)
GAME_ROUTE_PATTERN = re.compile(r"(?P<route>/game(?:[/?][^\s`\"'<>]+)?)")
PROOF_CONTEXT_KEYWORDS = (
    "before/after",
    "screenshot",
    "screenshot target",
    "screen recording",
    "gif",
    "reviewer-visible",
    "steps to reproduce",
)
GAME_SURFACE_KEYWORDS = (
    "apps/client/app/game",
    "apps/client/components/scene/",
    "apps/client/components/exercises/",
    "hangout",
    "block crush",
)
REMOTE_DEPENDENCY_KEYWORDS = (
    "asset",
    "avatar",
    "bucket",
    "cloudflare",
    "device",
    "env",
    "oauth",
    "real device",
    "runtime asset",
    "secret",
    "spotify",
    "tong-runs",
    "video",
    "youtube",
)
CHECKPOINT_HINTS = ("scenario seed", "checkpoint", "deterministic", "seed=")
CHECKPOINT_ROUTE_HINTS = ("dev=", "fresh=", "seed=", "checkpoint", "scenario", "dev_intro=")
REMOTE_DEPENDENCIES_NONE_PATTERN = re.compile(r"\bremote dependenc(?:y|ies)\s*:\s*none\b", re.IGNORECASE)


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


def print_command_failure(label: str, result: subprocess.CompletedProcess[str]) -> None:
    details = result.stderr.strip() or result.stdout.strip() or f"exit code {result.returncode}"
    print(f"{label} failed: {details}")


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


def project_control_plane() -> dict[str, Any] | None:
    return WORKTREE_ROUTING.get("project_control_plane")


def fetch_project_overrides() -> dict[str, dict[str, str]]:
    global PROJECT_OVERRIDE_CACHE
    if PROJECT_OVERRIDE_CACHE is not None:
        return PROJECT_OVERRIDE_CACHE

    cfg = project_control_plane()
    if not cfg:
        PROJECT_OVERRIDE_CACHE = {}
        return PROJECT_OVERRIDE_CACHE

    owner_fragment = "user" if cfg.get("owner_type", "user") == "user" else "organization"
    query = f"""
    query($owner: String!, $number: Int!, $first: Int!, $after: String) {{
      {owner_fragment}(login: $owner) {{
        projectV2(number: $number) {{
          items(first: $first, after: $after) {{
            pageInfo {{
              hasNextPage
              endCursor
            }}
            nodes {{
              content {{
                ... on Issue {{
                  number
                  repository {{
                    nameWithOwner
                  }}
                }}
              }}
              fieldValues(first: 50) {{
                nodes {{
                  ... on ProjectV2ItemFieldSingleSelectValue {{
                    field {{
                      ... on ProjectV2FieldCommon {{
                        name
                      }}
                    }}
                    name
                  }}
                  ... on ProjectV2ItemFieldTextValue {{
                    field {{
                      ... on ProjectV2FieldCommon {{
                        name
                      }}
                    }}
                    text
                  }}
                }}
              }}
            }}
          }}
        }}
      }}
    }}
    """

    overrides: dict[str, dict[str, str]] = {}
    cursor: str | None = None
    while True:
        command = [
            "gh",
            "api",
            "graphql",
            "-f",
            f"query={query}",
            "-F",
            f"owner={cfg['owner']}",
            "-F",
            f"number={cfg['number']}",
            "-F",
            "first=100",
        ]
        if cursor:
            command.extend(["-F", f"after={cursor}"])
        try:
            result = run_command(command, allow_failure=True)
        except FileNotFoundError:
            PROJECT_OVERRIDE_CACHE = {}
            return PROJECT_OVERRIDE_CACHE
        if result.returncode != 0:
            PROJECT_OVERRIDE_CACHE = {}
            return PROJECT_OVERRIDE_CACHE
        payload = json.loads(result.stdout)
        owner_payload = payload["data"].get(owner_fragment)
        if not owner_payload or not owner_payload.get("projectV2"):
            break

        items_payload = owner_payload["projectV2"]["items"]
        for node in items_payload["nodes"]:
            content = node.get("content")
            if not content or "number" not in content:
                continue
            issue_ref = f"{content['repository']['nameWithOwner']}#{content['number']}"
            field_map: dict[str, str] = {}
            for field_node in node.get("fieldValues", {}).get("nodes", []):
                field_name = field_node.get("field", {}).get("name")
                if not field_name:
                    continue
                value = field_node.get("name") or field_node.get("text")
                if value:
                    field_map[field_name] = value
            overrides[issue_ref] = field_map

        if not items_payload["pageInfo"]["hasNextPage"]:
            break
        cursor = items_payload["pageInfo"]["endCursor"]

    PROJECT_OVERRIDE_CACHE = overrides
    return overrides


def project_fields_for(issue_ref: str | None) -> dict[str, str]:
    if not issue_ref:
        return {}
    return fetch_project_overrides().get(issue_ref, {})


def unique_strings(items: list[str]) -> list[str]:
    return list(dict.fromkeys(item for item in items if item))


def format_portability_summary(portability: dict[str, Any]) -> str:
    if portability.get("blockers"):
        return portability["blockers"][0]
    if portability.get("warnings"):
        return portability["warnings"][0]
    return "Portable from repo state plus documented setup."


def render_portability_lines(portability: dict[str, Any], *, bullet: str = "- ") -> list[str]:
    lines = [
        f"{bullet}Portability preflight: `{portability.get('status', 'unknown')}`",
        f"{bullet}Portability summary: {portability.get('summary', 'No portability summary recorded.')}",
    ]
    if portability.get("blockers"):
        lines.append(f"{bullet}Portability blockers: {'; '.join(portability['blockers'])}")
    if portability.get("warnings"):
        lines.append(f"{bullet}Portability warnings: {'; '.join(portability['warnings'])}")
    return lines


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


def fetch_project_overrides() -> dict[str, dict[str, str]]:
    global PROJECT_OVERRIDE_CACHE
    if PROJECT_OVERRIDE_CACHE is not None:
        return PROJECT_OVERRIDE_CACHE

    cfg = project_control_plane()
    if not cfg:
        PROJECT_OVERRIDE_CACHE = {}
        return PROJECT_OVERRIDE_CACHE

    owner_fragment = "user" if cfg.get("owner_type", "user") == "user" else "organization"
    query = f"""
    query($owner: String!, $number: Int!, $first: Int!, $after: String) {{
      {owner_fragment}(login: $owner) {{
        projectV2(number: $number) {{
          items(first: $first, after: $after) {{
            pageInfo {{
              hasNextPage
              endCursor
            }}
            nodes {{
              content {{
                ... on Issue {{
                  number
                  repository {{
                    nameWithOwner
                  }}
                }}
              }}
              fieldValues(first: 50) {{
                nodes {{
                  ... on ProjectV2ItemFieldSingleSelectValue {{
                    field {{
                      ... on ProjectV2FieldCommon {{
                        name
                      }}
                    }}
                    name
                  }}
                  ... on ProjectV2ItemFieldTextValue {{
                    field {{
                      ... on ProjectV2FieldCommon {{
                        name
                      }}
                    }}
                    text
                  }}
                }}
              }}
            }}
          }}
        }}
      }}
    }}
    """

    overrides: dict[str, dict[str, str]] = {}
    cursor: str | None = None
    while True:
        command = [
            "gh",
            "api",
            "graphql",
            "-f",
            f"query={query}",
            "-F",
            f"owner={cfg['owner']}",
            "-F",
            f"number={cfg['number']}",
            "-F",
            "first=100",
        ]
        if cursor:
            command.extend(["-F", f"after={cursor}"])
        try:
            result = run_command(command, allow_failure=True)
        except FileNotFoundError:
            PROJECT_OVERRIDE_CACHE = {}
            return PROJECT_OVERRIDE_CACHE
        if result.returncode != 0:
            PROJECT_OVERRIDE_CACHE = {}
            return PROJECT_OVERRIDE_CACHE

        payload = json.loads(result.stdout)
        owner_payload = payload["data"].get(owner_fragment)
        if not owner_payload or not owner_payload.get("projectV2"):
            break

        items_payload = owner_payload["projectV2"]["items"]
        for node in items_payload["nodes"]:
            content = node.get("content")
            if not content or "number" not in content:
                continue
            issue_ref = f"{content['repository']['nameWithOwner']}#{content['number']}"
            field_map: dict[str, str] = {}
            for field_node in node.get("fieldValues", {}).get("nodes", []):
                field_name = field_node.get("field", {}).get("name")
                if not field_name:
                    continue
                value = field_node.get("name") or field_node.get("text")
                if value:
                    field_map[field_name] = value
            overrides[issue_ref] = field_map

        if not items_payload["pageInfo"]["hasNextPage"]:
            break
        cursor = items_payload["pageInfo"]["endCursor"]

    PROJECT_OVERRIDE_CACHE = overrides
    return overrides


def project_fields_for_issue(issue_ref: str | None) -> dict[str, str]:
    if not issue_ref:
        return {}
    return fetch_project_overrides().get(issue_ref, {})


def project_execution_mode(project_fields: dict[str, str]) -> str | None:
    cfg = project_control_plane()
    if not cfg:
        return None
    field_name = cfg.get("execution_mode_field")
    if not field_name:
        return None
    value = project_fields.get(field_name)
    return value or None


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


def build_validation_policy(
    playbook: dict[str, Any] | None,
    issue_class: str,
    evidence_plan: dict[str, Any],
    *,
    execution_mode_override: str | None = None,
) -> dict[str, Any]:
    defaults = REPO_ADAPTER.get("validation_defaults", {})
    requirements = (playbook or {}).get("validation_requirements", {})
    execution_mode = execution_mode_override or (playbook or {}).get("execution_mode") or defaults.get("execution_mode", "safe-unattended")

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
    human_review_required = requirements.get("human_review_required")
    if human_review_required is None:
        human_review_required = execution_mode == "needs-human-design-review"

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
        "human_review_required": human_review_required,
        "stop_conditions": requirements.get("stop_conditions", []),
    }


def apply_execution_mode_override(validation_policy: dict[str, Any], execution_mode: str) -> dict[str, Any]:
    updated = dict(validation_policy)
    updated["execution_mode"] = execution_mode
    updated["fix_allowed"] = execution_mode in FIX_ALLOWED_EXECUTION_MODES
    updated["human_review_required"] = updated.get("human_review_required", False) or execution_mode == "needs-human-design-review"
    return updated


def keyword_matches_text(text: str, keyword: str) -> bool:
    escaped = re.escape(keyword.lower())
    if re.fullmatch(r"[a-z]+", keyword.lower()):
        pattern = rf"(?<![a-z0-9]){escaped}(?:s|es|ed|ing)?(?![a-z0-9])"
    else:
        pattern = rf"(?<![a-z0-9]){escaped}(?![a-z0-9])"
    return re.search(pattern, text) is not None


def classify_issue_text(text: str) -> dict[str, Any]:
    lowered = text.lower()
    candidates: list[tuple[int, int, str, list[str]]] = []
    for rule in CLASSIFICATION_RULES["rules"]:
        matches = [keyword for keyword in rule["keywords"] if keyword_matches_text(lowered, keyword)]
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


def detect_local_paths(text: str) -> list[str]:
    return sorted(
        {
            match.group("path").rstrip("`\"'.,:);]")
            for match in LOCAL_PATH_PATTERN.finditer(text)
        }
    )


def detect_private_references(text: str) -> list[str]:
    hits: list[str] = []
    for pattern in PRIVATE_REFERENCE_PATTERNS:
        hits.extend(match.group(0) for match in pattern.finditer(text))
    return unique_strings(hits)


def is_portability_meta_issue_text(text: str) -> bool:
    lowered = text.lower()
    return "portability preflight" in lowered and "remote agents" in lowered


def is_game_issue(text: str, playbook: dict[str, Any] | None) -> bool:
    lowered = text.lower()
    if playbook and playbook.get("surface") == "game":
        return True
    if is_portability_meta_issue_text(text):
        return False
    if GAME_ROUTE_PATTERN.search(text):
        return True
    return any(keyword in lowered for keyword in GAME_SURFACE_KEYWORDS)


def detect_route_context(text: str, playbook: dict[str, Any] | None) -> dict[str, Any]:
    route_match = GAME_ROUTE_PATTERN.search(text)
    if route_match:
        return {"present": True, "source": "issue body", "value": route_match.group("route")}
    if playbook and playbook.get("route_template"):
        return {"present": True, "source": "repo adapter playbook", "value": playbook["route_template"]}
    if playbook and playbook.get("surface"):
        return {"present": True, "source": "repo adapter playbook", "value": playbook["surface"]}
    return {"present": False, "source": None, "value": None}


def detect_proof_context(
    text: str,
    playbook: dict[str, Any] | None,
    evidence_plan: dict[str, Any],
    project_fields: dict[str, str],
) -> dict[str, Any]:
    lowered = text.lower()
    if playbook and (playbook.get("steps") or playbook.get("screenshot_targets") or playbook.get("state_targets")):
        proof_bits = []
        if playbook.get("steps"):
            proof_bits.append(f"{len(playbook['steps'])} step(s)")
        if playbook.get("screenshot_targets"):
            proof_bits.append(f"{len(playbook['screenshot_targets'])} screenshot target(s)")
        if playbook.get("state_targets"):
            proof_bits.append(f"{len(playbook['state_targets'])} state target(s)")
        return {
            "present": True,
            "source": "repo adapter playbook",
            "value": ", ".join(proof_bits),
        }

    hits = [keyword for keyword in PROOF_CONTEXT_KEYWORDS if keyword in lowered]
    if hits:
        return {"present": True, "source": "issue body", "value": ", ".join(hits[:4])}

    proof_required = project_fields.get("Proof Required")
    if proof_required and proof_required != "None":
        return {"present": False, "source": "project field", "value": proof_required}
    if evidence_plan.get("requires_ui_capture"):
        return {"present": False, "source": "evidence plan", "value": "ui capture required"}
    return {"present": False, "source": None, "value": None}


def detect_remote_dependencies_context(
    text: str,
    project_fields: dict[str, str],
    local_only_keywords: list[str],
) -> dict[str, Any]:
    lowered = text.lower()
    remote_dependencies = (project_fields.get("Remote Dependencies") or "").strip()
    if remote_dependencies:
        return {"present": True, "source": "project field", "value": remote_dependencies}

    if REMOTE_DEPENDENCIES_NONE_PATTERN.search(text):
        return {"present": True, "source": "issue body", "value": "remote dependencies: none"}

    explicit_repo_only = (
        "repo-only",
        "no remote dependencies",
        "no external dependencies",
        "no outside repo checkout should be required",
    )
    repo_only_hit = next((keyword for keyword in explicit_repo_only if keyword in lowered), None)
    if repo_only_hit:
        return {"present": True, "source": "issue body", "value": repo_only_hit}

    if local_only_keywords:
        return {
            "present": True,
            "source": "issue body",
            "value": ", ".join(local_only_keywords[:4]),
        }

    if any(keyword in lowered for keyword in REMOTE_DEPENDENCY_KEYWORDS):
        return {"present": False, "source": None, "value": None}

    return {"present": False, "source": None, "value": None}


def detect_checkpoint_context(
    text: str,
    project_fields: dict[str, str],
    playbook: dict[str, Any] | None,
) -> dict[str, Any]:
    scenario_seed = (project_fields.get("Scenario Seed") or "").strip()
    if scenario_seed:
        return {"present": True, "source": "project field", "value": scenario_seed}

    route_template = (playbook or {}).get("route_template", "")
    if route_template and any(hint in route_template for hint in CHECKPOINT_ROUTE_HINTS):
        return {"present": True, "source": "repo adapter playbook", "value": route_template}

    lowered = text.lower()
    hint = next((keyword for keyword in CHECKPOINT_HINTS if keyword in lowered), None)
    if hint:
        return {"present": True, "source": "issue body", "value": hint}

    checkpoint_needed = project_fields.get("Checkpoint Needed")
    if checkpoint_needed == "No" or not checkpoint_needed:
        return {
            "present": True,
            "source": "project field" if checkpoint_needed == "No" else "inferred",
            "value": "not required",
        }
    return {"present": False, "source": "project field", "value": checkpoint_needed}


def portability_preflight(
    issue_payload: dict[str, Any],
    *,
    project_fields: dict[str, str] | None = None,
    playbook: dict[str, Any] | None = None,
    evidence_plan: dict[str, Any] | None = None,
) -> dict[str, Any]:
    project_fields = project_fields or {}
    evidence_plan = evidence_plan or {"requires_ui_capture": False}

    text = f"{issue_payload.get('title', '')}\n\n{issue_payload.get('body', '')}".strip()
    lowered = text.lower()
    portability_meta_issue = is_portability_meta_issue_text(text)
    local_paths = [] if portability_meta_issue else detect_local_paths(text)
    private_references = [] if portability_meta_issue else detect_private_references(text)
    local_only_keywords = (
        []
        if portability_meta_issue
        else unique_strings(
            [
                keyword
                for keyword in CLOUD_CONFIG.get("local_only_keywords", [])
                if keyword != "/users/" and keyword in lowered
            ]
        )
    )

    blockers: list[str] = []
    warnings: list[str] = []

    if local_paths:
        blockers.append("Found local filesystem references: " + ", ".join(local_paths[:3]))
    if private_references:
        blockers.append("Found private-repo-only references: " + ", ".join(private_references[:3]))
    if local_only_keywords:
        blockers.append("Found local-only dependency signals: " + ", ".join(local_only_keywords[:4]))

    game_issue = is_game_issue(text, playbook)
    route_context = detect_route_context(text, playbook)
    proof_context = detect_proof_context(text, playbook, evidence_plan, project_fields)
    remote_dependencies_context = detect_remote_dependencies_context(text, project_fields, local_only_keywords)
    checkpoint_context = detect_checkpoint_context(text, project_fields, playbook)

    portable_context_field = project_control_plane().get("portable_context_field") if project_control_plane() else "Portable Context"
    portable_context_value = project_fields.get(portable_context_field)
    if portable_context_value == "No":
        blockers.append("Project marks `Portable Context=No`.")

    proof_required = (
        (project_fields.get("Proof Required") and project_fields.get("Proof Required") != "None")
        or evidence_plan.get("requires_ui_capture", False)
        or (playbook and playbook.get("surface") == "game")
    )
    if game_issue and not route_context["present"]:
        warnings.append("Missing repo-visible `/game` route or surface under test.")
    if game_issue and proof_required and not proof_context["present"]:
        warnings.append("Missing visible proof sequence or reviewer-facing proof targets for this `/game` issue.")
    if game_issue and not remote_dependencies_context["present"]:
        warnings.append(
            "Missing remote dependency context; say `repo-only`, `remote dependencies: none`, or name the required asset/env dependency."
        )
    if project_fields.get("Checkpoint Needed") == "Yes" and not checkpoint_context["present"]:
        warnings.append("Checkpoint Needed=Yes but no Scenario Seed or deterministic checkpoint is recorded.")
    if portable_context_value == "Yes" and blockers:
        warnings.append("Project marks `Portable Context=Yes`, but the issue text still contains non-portable references.")

    status = "non-portable" if blockers else "portable-with-warnings" if warnings else "portable"
    portability = {
        "status": status,
        "portable": not blockers,
        "blocking": bool(blockers),
        "summary": "",
        "blockers": blockers,
        "warnings": warnings,
        "project_portable_context": portable_context_value,
        "detected_local_paths": local_paths,
        "detected_private_references": private_references,
        "detected_local_only_keywords": local_only_keywords,
        "game_issue": game_issue,
        "route_context": route_context,
        "proof_context": proof_context,
        "remote_dependencies_context": remote_dependencies_context,
        "checkpoint_context": checkpoint_context,
    }
    portability["summary"] = format_portability_summary(portability)
    return portability


def render_template(path: Path, replacements: dict[str, str]) -> str:
    rendered = path.read_text(encoding="utf-8")
    for needle, value in replacements.items():
        rendered = rendered.replace(needle, value)
    return rendered


def build_browser_route(playbook: dict[str, Any], run_id: str) -> str:
    defaults = REPO_ADAPTER.get("browser_defaults", {})
    route = playbook["route_template"]
    route = route.replace("{{run_id}}", run_id)
    route = route.replace("{{demo_password}}", defaults.get("demo_password", "TONG-DEMO-ACCESS"))
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
    portability: dict[str, Any],
) -> tuple[str, str, dict[str, Any]]:
    summary_lines = [
        "# Summary",
        "",
        f"- Mode: `{mode}`",
        f"- Target: `{issue_payload['issue_ref'] if issue_payload else 'ad-hoc target'}`",
        f"- Execution mode: `{validation_policy['execution_mode']}`",
        f"- Portability preflight: `{portability['status']}`",
        "- Verdict: pending",
        "- Confidence: 0.0",
        "",
        "## Notes",
        "",
        "- Replace this scaffold with the actual validation findings.",
    ]
    if portability["blockers"] or portability["warnings"]:
        summary_lines.extend(["", "## Portability Notes", ""])
        summary_lines.extend(render_portability_lines(portability))

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
    steps_lines.extend(["", "### Portability Preflight", ""])
    steps_lines.extend(render_portability_lines(portability))
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
        "reviewer_proof": {
            "classification": "not-evaluated",
            "status": "not-evaluated",
            "surface": "",
            "route": "",
            "scenario_seed": "",
            "proof_moment": "",
            "deterministic_setup": {
                "used": False,
                "description": "",
            },
            "artifacts": {
                "proof_video": "",
                "gif_preview": "",
            },
            "ordered_frames": {
                "pre_action": "",
                "ready_state": "",
                "immediate_post_input": "",
                "later_transition": "",
                "stable_post_action": "",
            },
            "cue_timestamps_ms": {},
            "checks": {
                "real_route": False,
                "semantically_coherent": False,
                "ready_state_legible": False,
                "input_visible": False,
                "pre_action_hold": False,
                "stable_post_action": False,
                "reviewer_visible_media": False,
            },
            "notes": [],
            "missing_requirements": [],
        },
        "portability": {
            **portability,
            "notes": [],
        },
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


def reviewer_proof_required(run: dict[str, Any], *, for_fixed_claim: bool) -> bool:
    if not for_fixed_claim:
        return False
    if not run.get("validation_policy", {}).get("ui_acceptance_required"):
        return False
    issue_class = run.get("classification", {}).get("issue_class")
    return issue_class in REVIEWER_PROOF_REQUIRED_CLASSES


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

    if reviewer_proof_required(run, for_fixed_claim=for_fixed_claim):
        reviewer_proof = evidence.get("reviewer_proof") or {}
        status = reviewer_proof.get("status") or reviewer_proof.get("classification") or "missing"
        if status != "reviewer-proof":
            failures.append(f"reviewer-proof pack status is `{status}`")
        for item in reviewer_proof.get("missing_requirements", []):
            failures.append(f"reviewer-proof requirement missing: {item}")

    return failures


EVIDENCE_SECTION_BY_REQUIREMENT = {
    "screenshots": "screenshots",
    "comparison-panel": "comparison_panels",
    "comparison-focus-crop": "comparison_focus_crops",
    "temporal-capture": "temporal_capture",
    "console-state-trace": "console_logs",
    "network-trace": "network_traces",
    "contract-assertions": "contract_assertions",
    "perf-profile": "perf_profiles",
    "cross-env-matrix": "cross_env_matrix",
}

VISUAL_EVIDENCE_SECTIONS = {
    "screenshots",
    "comparison_panels",
    "comparison_focus_crops",
    "temporal_capture",
}


def sync_validation_markers(run: dict[str, Any], evidence: dict[str, Any]) -> None:
    """Populate validation gate markers from current evidence entries.

    This keeps `publish-github` and `finalize-run` aligned with the evidence plan
    without requiring runners to manually toggle validation booleans.
    """

    validation = evidence.setdefault("validation", {})
    required = run.get("evidence_plan", {}).get("required", [])

    missing_required: list[str] = []
    for requirement in required:
        section = EVIDENCE_SECTION_BY_REQUIREMENT.get(requirement)
        if not section:
            continue
        entries = evidence.get(section, [])
        if not entries:
            missing_required.append(requirement)

    existing_missing = [
        item
        for item in validation.get("missing_requirements", [])
        if not str(item).startswith("required evidence missing:")
    ]
    for requirement in missing_required:
        note = f"required evidence missing: {requirement}"
        if note not in existing_missing:
            existing_missing.append(note)
    validation["missing_requirements"] = existing_missing

    if run.get("validation_policy", {}).get("requires_direct_issue_evidence"):
        if not validation.get("direct_issue_evidence_complete", False):
            validation["direct_issue_evidence_complete"] = not missing_required

    if run.get("validation_policy", {}).get("ui_acceptance_required"):
        visual_present = any(evidence.get(section) for section in VISUAL_EVIDENCE_SECTIONS)
        missing_visual = any(
            requirement in missing_required
            and EVIDENCE_SECTION_BY_REQUIREMENT.get(requirement) in VISUAL_EVIDENCE_SECTIONS
            for requirement in required
        )
        if not validation.get("ui_acceptance_complete", False):
            validation["ui_acceptance_complete"] = visual_present and not missing_visual


def render_validation_gate_lines(run: dict[str, Any], evidence: dict[str, Any]) -> str:
    policy = run.get("validation_policy", {})
    validation = evidence.get("validation", {})
    runtime_modes = validation.get("runtime_modes_exercised", [])
    failures = validation_gate_failures(run, evidence, for_fixed_claim=run["functional"]["fix_status"] == "fixed" or run["functional"]["verdict"] == "fixed")
    reviewer_proof = evidence.get("reviewer_proof") or {}
    reviewer_proof_required_for_run = reviewer_proof_required(run, for_fixed_claim=True)
    reviewer_proof_status = reviewer_proof.get("status") or reviewer_proof.get("classification") or "missing"

    lines = [
        f"- Execution mode: `{policy.get('execution_mode', 'safe-unattended')}`",
        f"- Direct issue evidence: `{'complete' if validation.get('direct_issue_evidence_complete', False) else 'missing' if policy.get('requires_direct_issue_evidence') else 'not-required'}`",
        f"- UI acceptance gate: `{'complete' if validation.get('ui_acceptance_complete', False) else 'missing' if policy.get('ui_acceptance_required') else 'not-required'}`",
        f"- Reviewer-proof pack: `{reviewer_proof_status if reviewer_proof_required_for_run else 'not-required'}`",
        f"- Runtime modes exercised: `{', '.join(runtime_modes) if runtime_modes else 'none recorded'}`",
        f"- Live model confirmation: `{'confirmed' if validation.get('live_model_confirmed', False) else 'missing' if policy.get('requires_live_model_for_fixed') else 'not-required'}`",
        f"- Human review: `{'complete' if validation.get('human_review_completed', False) else 'missing' if policy.get('human_review_required') else 'not-required'}`",
    ]
    if failures:
        lines.append("- Remaining validation gaps:")
        lines.extend(f"  - {item}" for item in failures)
    return "\n".join(lines)


def render_portability_section(run: dict[str, Any], evidence: dict[str, Any]) -> str:
    portability = evidence.get("portability") or run.get("portability_preflight") or {}
    if not portability:
        return "- No portability preflight recorded."
    return "\n".join(render_portability_lines(portability))


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
        "{{portability_preflight}}": render_portability_section(run, evidence),
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


def load_evidence(run_dir: Path) -> dict[str, Any]:
    evidence_path = run_dir / "evidence.json"
    if not evidence_path.exists():
        return {}
    return load_json(evidence_path)


def maybe_generate_reviewer_proof(run_dir: Path) -> bool:
    reviewer_proof = (load_evidence(run_dir).get("reviewer_proof") or {})
    classification = reviewer_proof.get("classification") or reviewer_proof.get("status") or "not-evaluated"
    if classification in {"", "not-evaluated", "missing", None}:
        return True

    script_path = SCRIPT_PATH.parent / "capture_reviewer_proof.py"
    if not script_path.exists():
        print(f"Reviewer-proof script missing: {relative_to_repo(script_path)}")
        return False

    result = run_command(
        [
            sys.executable,
            str(script_path),
            "--run-dir",
            str(run_dir),
        ],
        allow_failure=True,
    )
    if result.returncode != 0:
        print_command_failure("Reviewer-proof pack generation", result)
        return False
    return True


def should_attempt_uploaded_reviewer_comment(run: dict[str, Any], evidence: dict[str, Any]) -> bool:
    if run.get("evidence_plan", {}).get("requires_ui_capture"):
        return True

    visual_sections = (
        "screenshots",
        "comparison_panels",
        "comparison_focus_crops",
        "temporal_capture",
    )
    return any(evidence.get(section) for section in visual_sections)


def render_uploaded_comment(run_dir: Path, *, dry_run: bool) -> Path | None:
    upload_script = REPO_ROOT / "scripts" / "upload-qa-evidence.mjs"
    render_script = REPO_ROOT / "scripts" / "render-qa-comment.mjs"
    if not upload_script.exists() or not render_script.exists():
        return None

    upload_command = [
        "node",
        str(upload_script),
        "--run-dir",
        str(run_dir),
        "--include-supporting",
    ]
    if dry_run:
        upload_command.append("--dry-run")

    upload_result = run_command(upload_command, allow_failure=True)
    if upload_result.returncode != 0:
        print_command_failure("Evidence upload", upload_result)
        return None

    if not maybe_generate_reviewer_proof(run_dir):
        return None

    render_result = run_command(
        [
            "node",
            str(render_script),
            "--run-dir",
            str(run_dir),
        ],
        allow_failure=True,
    )
    if render_result.returncode != 0:
        print_command_failure("Uploaded comment render", render_result)
        return None

    uploaded_comment_path = run_dir / "uploaded-comment.md"
    if not uploaded_comment_path.exists():
        print(f"Uploaded comment render succeeded but {relative_to_repo(uploaded_comment_path)} was not created.")
        return None

    return uploaded_comment_path


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
    issue_ref = issue_payload["issue_ref"] if issue_payload else None
    project_fields = project_fields_for(issue_ref)
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
    playbook = issue_playbook(issue_ref)
    validation_policy = build_validation_policy(playbook, classification["issue_class"], evidence_plan)
    execution_mode_field = project_control_plane().get("execution_mode_field") if project_control_plane() else None
    if execution_mode_field and project_fields.get(execution_mode_field):
        validation_policy = apply_execution_mode_override(validation_policy, project_fields[execution_mode_field])
    portability = portability_preflight(
        issue_payload or {"title": args.target, "body": ""},
        project_fields=project_fields,
        playbook=playbook,
        evidence_plan=evidence_plan,
    )

    target_slug = slugify(issue_ref if issue_payload else args.target)
    run_timestamp = timestamp_slug()
    run_id = f"functional-qa-{args.mode}-{run_timestamp}-{target_slug}"
    run_dir = artifact_root() / "functional-qa" / target_slug / run_timestamp
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "screenshots").mkdir(exist_ok=True)
    (run_dir / "logs").mkdir(exist_ok=True)

    previous_run = find_previous_run(issue_ref, target_slug, exclude_dir=run_dir)
    summary_text, steps_text, evidence = bootstrap_text(
        args.mode,
        issue_payload,
        args.verify_fix,
        previous_run,
        validation_policy,
        portability,
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
        "issue_ref": issue_ref,
        "project_fields": project_fields,
        "classification": classification,
        "evidence_plan": evidence_plan,
        "validation_policy": validation_policy,
        "portability_preflight": portability,
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
        "repo_notes": collect_issue_notes(issue_ref),
    }

    if playbook:
        create_browser_artifacts(run_dir, run_manifest, playbook)

    (run_dir / "run.json").write_text(json.dumps(run_manifest, indent=2) + "\n", encoding="utf-8")
    (run_dir / "summary.md").write_text(summary_text, encoding="utf-8")
    (run_dir / "steps.md").write_text(steps_text, encoding="utf-8")
    (run_dir / "evidence.json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    (run_dir / "publish.md").write_text("Publish draft will be rendered after finalize-run.\n", encoding="utf-8")
    if issue_payload:
        issue_payload["project_fields"] = project_fields
        (run_dir / "issue.json").write_text(json.dumps(issue_payload, indent=2) + "\n", encoding="utf-8")

    print(str(run_dir))
    return 0


def finalize_run(args: argparse.Namespace) -> int:
    run_dir = Path(args.run_dir).resolve()
    run = load_run_manifest(run_dir)
    evidence = load_json(run_dir / "evidence.json")
    sync_validation_markers(run, evidence)
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
    (run_dir / "evidence.json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    rendered = render_publish(run, run_dir)
    (run_dir / "publish.md").write_text(rendered + "\n", encoding="utf-8")
    print(str(run_dir / "publish.md"))
    return 0


def publish_github(args: argparse.Namespace) -> int:
    run_dir = Path(args.run_dir).resolve()
    run = load_run_manifest(run_dir)
    evidence = load_json(run_dir / "evidence.json")
    sync_validation_markers(run, evidence)
    (run_dir / "evidence.json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
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

    body_path = run_dir / "publish.md"
    if not args.no_auto_evidence_upload:
        evidence = load_evidence(run_dir)
        if should_attempt_uploaded_reviewer_comment(run, evidence):
            uploaded_comment_path = render_uploaded_comment(run_dir, dry_run=args.dry_run)
            if uploaded_comment_path:
                body_path = uploaded_comment_path

    body = body_path.read_text(encoding="utf-8")
    if args.dry_run:
        print(f"Dry run: would publish comment for {issue_ref} from {relative_to_repo(body_path)}")
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
    publish_parser.add_argument(
        "--no-auto-evidence-upload",
        action="store_true",
        help="Skip reviewer-proof upload/comment generation and publish publish.md directly.",
    )
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
