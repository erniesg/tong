#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
DEPLOY_ENV="${TONG_DEPLOY_ENV:-production}"
SUMMARY_PATH="${TONG_DEPLOY_SUMMARY_PATH:-}"
DEPLOY_REF="${TONG_DEPLOY_REF:-${GITHUB_SHA:-}}"
DEPLOY_PR_NUMBER="${TONG_DEPLOY_PR_NUMBER:-}"
DEPLOY_ISSUE_REF="${TONG_DEPLOY_ISSUE_REF:-}"
DEPLOY_NOTE="${TONG_DEPLOY_NOTE:-}"

usage() {
  cat <<'EOF'
Usage: ./scripts/deploy-client-cloudflare.sh [options]

Options:
  --environment, --env <staging|production>  Deployment target (default: production)
  --env-file <path>                          Optional env file to read fallback values from
  --summary-file <path>                      Optional JSON summary output path
  --ref <git-ref>                            Optional source ref to record in the summary
  --pr-number <number>                       Optional PR number to record in the summary
  --issue-ref <owner/repo#123>               Optional issue ref to record in the summary
  --note <text>                              Optional promotion note to record in the summary
  -h, --help                                 Show this help text
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --environment|--env)
      DEPLOY_ENV="${2:-}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --summary-file)
      SUMMARY_PATH="${2:-}"
      shift 2
      ;;
    --ref)
      DEPLOY_REF="${2:-}"
      shift 2
      ;;
    --pr-number)
      DEPLOY_PR_NUMBER="${2:-}"
      shift 2
      ;;
    --issue-ref)
      DEPLOY_ISSUE_REF="${2:-}"
      shift 2
      ;;
    --note)
      DEPLOY_NOTE="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [[ "$1" == /* || "$1" == .* || "$1" == *.env ]]; then
        ENV_FILE="$1"
        shift
      else
        echo "Unknown argument: $1" >&2
        usage >&2
        exit 1
      fi
      ;;
  esac
done

if ! command -v npx >/dev/null 2>&1; then
  echo "Missing required command: npx" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "Missing required command: python3" >&2
  exit 1
fi

case "$DEPLOY_ENV" in
  staging|production)
    ;;
  *)
    echo "Unsupported deployment environment: $DEPLOY_ENV" >&2
    exit 1
    ;;
esac

read_env_value() {
  local key="$1"
  if [[ ! -f "$ENV_FILE" ]]; then
    printf ""
    return 0
  fi
  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    printf ""
    return 0
  fi
  printf "%s" "${line#*=}"
}

default_public_domain() {
  if [[ "$DEPLOY_ENV" == "staging" ]]; then
    printf "staging.tong.berlayar.ai"
  else
    printf "tong.berlayar.ai"
  fi
}

default_worker_name() {
  if [[ "$DEPLOY_ENV" == "staging" ]]; then
    printf "tong-berlayar-web-staging"
  else
    printf "tong-berlayar-web"
  fi
}

PUBLIC_DOMAIN="${NEXT_PUBLIC_TONG_PUBLIC_DOMAIN:-}"
if [[ -z "$PUBLIC_DOMAIN" ]]; then PUBLIC_DOMAIN="$(read_env_value NEXT_PUBLIC_TONG_PUBLIC_DOMAIN)"; fi
if [[ -z "$PUBLIC_DOMAIN" ]]; then PUBLIC_DOMAIN="${TONG_PUBLIC_DOMAIN:-}"; fi
if [[ -z "$PUBLIC_DOMAIN" ]]; then PUBLIC_DOMAIN="$(default_public_domain)"; fi

API_BASE="${NEXT_PUBLIC_TONG_API_BASE:-}"
if [[ -z "$API_BASE" ]]; then API_BASE="$(read_env_value NEXT_PUBLIC_TONG_API_BASE)"; fi
if [[ -z "$API_BASE" ]]; then API_BASE="$(read_env_value TONG_REMOTE_API_BASE_URL)"; fi
if [[ -z "$API_BASE" ]]; then API_BASE="https://tong-api.erniesg.workers.dev"; fi

EXTENSION_ZIP_URL="${NEXT_PUBLIC_TONG_EXTENSION_ZIP_URL:-}"
if [[ -z "$EXTENSION_ZIP_URL" ]]; then EXTENSION_ZIP_URL="$(read_env_value NEXT_PUBLIC_TONG_EXTENSION_ZIP_URL)"; fi
if [[ -z "$EXTENSION_ZIP_URL" ]]; then EXTENSION_ZIP_URL="https://github.com/erniesg/tong/archive/refs/heads/master.zip"; fi

YOUTUBE_DEMO_URL="${NEXT_PUBLIC_TONG_YOUTUBE_DEMO_URL:-}"
if [[ -z "$YOUTUBE_DEMO_URL" ]]; then YOUTUBE_DEMO_URL="$(read_env_value NEXT_PUBLIC_TONG_YOUTUBE_DEMO_URL)"; fi
if [[ -z "$YOUTUBE_DEMO_URL" ]]; then YOUTUBE_DEMO_URL="https://www.youtube.com/watch?v=dQw4w9WgXcQ"; fi

DEMO_PASSWORD_HINT="${NEXT_PUBLIC_TONG_DEMO_PASSWORD_HINT:-}"
if [[ -z "$DEMO_PASSWORD_HINT" ]]; then DEMO_PASSWORD_HINT="$(read_env_value NEXT_PUBLIC_TONG_DEMO_PASSWORD_HINT)"; fi
if [[ -z "$DEMO_PASSWORD_HINT" ]]; then DEMO_PASSWORD_HINT="Ask demo host for access password."; fi

ASSETS_BASE_URL="${NEXT_PUBLIC_TONG_ASSETS_BASE_URL:-}"
if [[ -z "$ASSETS_BASE_URL" ]]; then ASSETS_BASE_URL="$(read_env_value NEXT_PUBLIC_TONG_ASSETS_BASE_URL)"; fi
if [[ -z "$ASSETS_BASE_URL" ]]; then ASSETS_BASE_URL="https://assets.tong.berlayar.ai"; fi

ASSETS_BUCKET="${TONG_ASSETS_R2_BUCKET:-}"
if [[ -z "$ASSETS_BUCKET" ]]; then ASSETS_BUCKET="$(read_env_value TONG_ASSETS_R2_BUCKET)"; fi
if [[ -z "$ASSETS_BUCKET" ]]; then ASSETS_BUCKET="tong-assets"; fi

RUNTIME_ASSET_MANIFEST_KEY="${TONG_RUNTIME_ASSET_MANIFEST_KEY:-}"
if [[ -z "$RUNTIME_ASSET_MANIFEST_KEY" ]]; then RUNTIME_ASSET_MANIFEST_KEY="$(read_env_value TONG_RUNTIME_ASSET_MANIFEST_KEY)"; fi
if [[ -z "$RUNTIME_ASSET_MANIFEST_KEY" ]]; then RUNTIME_ASSET_MANIFEST_KEY="runtime-assets/manifest.json"; fi

WRANGLER_ENV="${TONG_CLOUDFLARE_ENV:-}"
if [[ -z "$WRANGLER_ENV" ]]; then WRANGLER_ENV="$(read_env_value TONG_CLOUDFLARE_ENV)"; fi
if [[ -z "$WRANGLER_ENV" ]]; then WRANGLER_ENV="$DEPLOY_ENV"; fi

CLIENT_WORKER_NAME="${TONG_CLIENT_WORKER_NAME:-}"
if [[ -z "$CLIENT_WORKER_NAME" ]]; then CLIENT_WORKER_NAME="$(read_env_value TONG_CLIENT_WORKER_NAME)"; fi
if [[ -z "$CLIENT_WORKER_NAME" ]]; then CLIENT_WORKER_NAME="$(default_worker_name)"; fi

WORKERS_URL="${TONG_CLIENT_WORKERS_URL:-}"
if [[ -z "$WORKERS_URL" ]]; then WORKERS_URL="$(read_env_value TONG_CLIENT_WORKERS_URL)"; fi
if [[ -z "$WORKERS_URL" ]]; then WORKERS_URL="https://${CLIENT_WORKER_NAME}.erniesg.workers.dev"; fi

echo "[1/5] Installing client dependencies..."
npm --prefix "$ROOT_DIR/apps/client" ci

echo "[2/5] Publishing runtime assets to R2..."
NEXT_PUBLIC_TONG_ASSETS_BASE_URL="$ASSETS_BASE_URL" \
TONG_ASSETS_R2_BUCKET="$ASSETS_BUCKET" \
TONG_RUNTIME_ASSET_MANIFEST_KEY="$RUNTIME_ASSET_MANIFEST_KEY" \
  npm --prefix "$ROOT_DIR" run runtime-assets:upload

echo "[3/5] Building Next.js app for Cloudflare Workers (OpenNext)..."
NEXT_PUBLIC_TONG_PUBLIC_DOMAIN="$PUBLIC_DOMAIN" \
NEXT_PUBLIC_TONG_API_BASE="$API_BASE" \
NEXT_PUBLIC_TONG_ASSETS_BASE_URL="$ASSETS_BASE_URL" \
NEXT_PUBLIC_TONG_EXTENSION_ZIP_URL="$EXTENSION_ZIP_URL" \
NEXT_PUBLIC_TONG_YOUTUBE_DEMO_URL="$YOUTUBE_DEMO_URL" \
NEXT_PUBLIC_TONG_DEMO_PASSWORD_HINT="$DEMO_PASSWORD_HINT" \
  npm --prefix "$ROOT_DIR/apps/client" run cf:build

echo "[4/5] Deploying Cloudflare worker environment ($WRANGLER_ENV) + custom domain ($PUBLIC_DOMAIN)..."
npx --prefix "$ROOT_DIR/apps/client" wrangler deploy \
  --config "$ROOT_DIR/apps/client/wrangler.toml" \
  --env "$WRANGLER_ENV" \
  --domain "$PUBLIC_DOMAIN" \
  --keep-vars

echo "[5/5] Deployment complete."
echo
echo "Deployment environment: $DEPLOY_ENV"
echo "Public URL: https://$PUBLIC_DOMAIN"
echo "Workers URL: $WORKERS_URL"
echo "API base wired into frontend build: $API_BASE"
echo "Runtime assets wired into frontend build: $ASSETS_BASE_URL"

if [[ -n "$SUMMARY_PATH" ]]; then
  mkdir -p "$(dirname "$SUMMARY_PATH")"
  export DEPLOY_ENV DEPLOY_REF DEPLOY_PR_NUMBER DEPLOY_ISSUE_REF DEPLOY_NOTE
  export PUBLIC_DOMAIN API_BASE ASSETS_BASE_URL ASSETS_BUCKET RUNTIME_ASSET_MANIFEST_KEY
  export WRANGLER_ENV CLIENT_WORKER_NAME WORKERS_URL
  python3 - "$SUMMARY_PATH" <<'PY'
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

summary_path = Path(sys.argv[1])
payload = {
    "environment": os.environ.get("DEPLOY_ENV", "production"),
    "deployed_at": datetime.now(timezone.utc).isoformat(),
    "ref": os.environ.get("DEPLOY_REF", ""),
    "pr_number": os.environ.get("DEPLOY_PR_NUMBER", ""),
    "issue_ref": os.environ.get("DEPLOY_ISSUE_REF", ""),
    "note": os.environ.get("DEPLOY_NOTE", ""),
    "public_domain": os.environ["PUBLIC_DOMAIN"],
    "public_url": f"https://{os.environ['PUBLIC_DOMAIN']}",
    "workers_url": os.environ["WORKERS_URL"],
    "api_base": os.environ["API_BASE"],
    "assets_base_url": os.environ["ASSETS_BASE_URL"],
    "assets_bucket": os.environ["ASSETS_BUCKET"],
    "runtime_asset_manifest_key": os.environ["RUNTIME_ASSET_MANIFEST_KEY"],
    "wrangler_env": os.environ["WRANGLER_ENV"],
    "client_worker_name": os.environ["CLIENT_WORKER_NAME"],
}
summary_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY
  echo "Deployment summary JSON: $SUMMARY_PATH"
fi
