#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
SESSION_NAME="${SESSION_NAME:-tong-hackathon}"
BASE_BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"
LAUNCH_TMUX="${LAUNCH_TMUX:-1}"

"$ROOT_DIR/scripts/setup-hackathon-worktrees.sh" "$BASE_BRANCH"

streams=(
  "client-shell"
  "client-overlay"
  "server-api"
  "server-ingestion"
  "game-engine"
  "infra-deploy"
  "mock-ui"
  "creative-assets"
)

commands_file="$ROOT_DIR/.worktrees/agent-launch-commands.sh"
{
  echo "#!/usr/bin/env bash"
  echo "set -euo pipefail"
  echo
  for stream in "${streams[@]}"; do
    branch="codex/${stream}"
    path="$ROOT_DIR/.worktrees/${stream}"
    echo "# ${branch}"
    echo "cd \"$path\""
    echo "echo \"[$branch] Ready in $path\""
    echo
  done
} > "$commands_file"
chmod +x "$commands_file"

echo "[ok] Wrote per-workstream launch commands to $commands_file"

if [[ "$LAUNCH_TMUX" != "1" ]]; then
  echo "[skip] tmux launch disabled (LAUNCH_TMUX=$LAUNCH_TMUX)"
  exit 0
fi

if ! command -v tmux >/dev/null 2>&1; then
  echo "[skip] tmux not installed. Use $commands_file to launch manually."
  exit 0
fi

if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "[skip] tmux session '$SESSION_NAME' already exists"
  exit 0
fi

first_stream="${streams[0]}"
first_path="$ROOT_DIR/.worktrees/$first_stream"
tmux new-session -d -s "$SESSION_NAME" -n "$first_stream" "cd '$first_path' && bash"

for stream in "${streams[@]:1}"; do
  path="$ROOT_DIR/.worktrees/$stream"
  tmux new-window -t "$SESSION_NAME" -n "$stream" "cd '$path' && bash"
done

echo "[ok] tmux session '$SESSION_NAME' created with ${#streams[@]} windows"
echo "Attach with: tmux attach -t $SESSION_NAME"
