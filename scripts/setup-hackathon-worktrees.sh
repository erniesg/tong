#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
BASE_BRANCH="${1:-master}"

mkdir -p "$ROOT_DIR/.worktrees"

create_worktree() {
  local slug="$1"
  local branch="codex/${slug}"
  local path="$ROOT_DIR/.worktrees/${slug}"

  if [ -e "$path" ]; then
    echo "[skip] $path already exists"
    return 0
  fi

  if git show-ref --verify --quiet "refs/heads/$branch"; then
    git worktree add "$path" "$branch"
  else
    git worktree add "$path" -b "$branch" "$BASE_BRANCH"
  fi

  echo "[ok] created $branch at $path"
}

create_worktree "client-shell"
create_worktree "client-overlay"
create_worktree "server-api"
create_worktree "server-ingestion"
create_worktree "game-engine"
create_worktree "infra-deploy"
create_worktree "mock-ui"
create_worktree "creative-assets"

echo "Done. Run 'git worktree list' to verify."
