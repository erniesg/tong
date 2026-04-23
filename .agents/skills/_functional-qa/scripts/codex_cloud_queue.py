#!/usr/bin/env python3
"""Compatibility wrapper for the repo-native remote agent queue planner."""

from __future__ import annotations

import sys

from remote_agent_queue import main as remote_agent_queue_main


def main(argv: list[str] | None = None) -> int:
    args = list(argv or sys.argv[1:])
    if "--provider" not in args and not any(arg.startswith("--provider=") for arg in args):
        args.extend(["--provider", "codex"])
    return remote_agent_queue_main(args)


if __name__ == "__main__":
    raise SystemExit(main())
