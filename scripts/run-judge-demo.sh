#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_PORT="${TONG_SERVER_PORT:-8787}"
CLIENT_PORT="${TONG_CLIENT_PORT:-3000}"
OPEN_BROWSER="${TONG_OPEN_BROWSER:-1}"
DEMO_USER_ID="${TONG_DEMO_USER_ID:-demo-user-1}"
DEMO_PASSWORD="${TONG_DEMO_PASSWORD:-${TONG_DEMO_CODE:-TONG-JUDGE-DEMO}}"

SERVER_LOG="$(mktemp -t tong-server-log.XXXXXX)"
CLIENT_LOG="$(mktemp -t tong-client-log.XXXXXX)"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

wait_for_http() {
  local label="$1"
  local url="$2"
  local attempts="${3:-90}"

  for ((i = 1; i <= attempts; i += 1)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "[ok] $label ready: $url"
      return 0
    fi
    sleep 1
  done

  echo "[error] Timed out waiting for $label at $url" >&2
  return 1
}

open_url() {
  local url="$1"
  if [[ "$OPEN_BROWSER" != "1" ]]; then
    return 0
  fi

  if command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 || true
    return 0
  fi

  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 || true
    return 0
  fi
}

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "${CLIENT_PID:-}" ]] && kill -0 "$CLIENT_PID" >/dev/null 2>&1; then
    kill "$CLIENT_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

require_command node
require_command npm
require_command curl

echo "[1/6] Installing dependencies..."
npm --prefix "$ROOT_DIR/apps/server" install
npm --prefix "$ROOT_DIR/apps/client" install

echo "[2/6] Running contract smoke checks..."
(cd "$ROOT_DIR" && npm run demo:smoke)

echo "[3/6] Generating mock ingestion snapshots..."
(cd "$ROOT_DIR" && npm run ingest:mock)

echo "[4/6] Starting mock API server on :$SERVER_PORT..."
TONG_DEMO_PASSWORD="$DEMO_PASSWORD" PORT="$SERVER_PORT" \
  npm --prefix "$ROOT_DIR/apps/server" run start >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
wait_for_http "server" "http://localhost:${SERVER_PORT}/health"

echo "[5/6] Starting Next.js client on :$CLIENT_PORT..."
ENCODED_DEMO_PASSWORD="$(node -e "console.log(encodeURIComponent(process.argv[1] || ''))" "$DEMO_PASSWORD")"
NEXT_PUBLIC_TONG_API_BASE="http://localhost:${SERVER_PORT}" \
  NEXT_PUBLIC_TONG_DEMO_PASSWORD_HINT="Use the demo password provided by Tong judges host." \
  npm --prefix "$ROOT_DIR/apps/client" run dev -- -p "$CLIENT_PORT" >"$CLIENT_LOG" 2>&1 &
CLIENT_PID=$!
wait_for_http "client" "http://localhost:${CLIENT_PORT}"

BASE_URL="http://localhost:${CLIENT_PORT}"
open_url "${BASE_URL}/?demo=${ENCODED_DEMO_PASSWORD}"
open_url "${BASE_URL}/overlay?demo=${ENCODED_DEMO_PASSWORD}"
open_url "${BASE_URL}/game?demo=${ENCODED_DEMO_PASSWORD}"
open_url "${BASE_URL}/insights?demo=${ENCODED_DEMO_PASSWORD}"

echo "[6/6] Tong demo is ready."
echo
echo "Demo URLs:"
echo "- ${BASE_URL}/?demo=${ENCODED_DEMO_PASSWORD}"
echo "- ${BASE_URL}/overlay?demo=${ENCODED_DEMO_PASSWORD}"
echo "- ${BASE_URL}/game?demo=${ENCODED_DEMO_PASSWORD}"
echo "- ${BASE_URL}/insights?demo=${ENCODED_DEMO_PASSWORD}"
echo
echo "Demo access for judges:"
echo "- Demo user id: ${DEMO_USER_ID}"
echo "- Demo password: ${DEMO_PASSWORD}"
echo "- Password is required by API (header or ?demo=...) and auto-applied in opened URLs."
echo
echo "Logs:"
echo "- Server: $SERVER_LOG"
echo "- Client: $CLIENT_LOG"
echo
echo "Press Ctrl+C to stop both services."

while true; do
  if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    echo "[error] Server process exited. Check log: $SERVER_LOG" >&2
    exit 1
  fi
  if ! kill -0 "$CLIENT_PID" >/dev/null 2>&1; then
    echo "[error] Client process exited. Check log: $CLIENT_LOG" >&2
    exit 1
  fi
  sleep 2
done
