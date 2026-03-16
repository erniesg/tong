#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$ROOT_DIR/.env}"

if ! command -v npx >/dev/null 2>&1; then
  echo "Missing required command: npx" >&2
  exit 1
fi

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

PUBLIC_DOMAIN="${NEXT_PUBLIC_TONG_PUBLIC_DOMAIN:-}"
if [[ -z "$PUBLIC_DOMAIN" ]]; then PUBLIC_DOMAIN="$(read_env_value NEXT_PUBLIC_TONG_PUBLIC_DOMAIN)"; fi
if [[ -z "$PUBLIC_DOMAIN" ]]; then PUBLIC_DOMAIN="${TONG_PUBLIC_DOMAIN:-}"; fi
if [[ -z "$PUBLIC_DOMAIN" ]]; then PUBLIC_DOMAIN="tong.berlayar.ai"; fi

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

echo "[1/5] Installing client dependencies..."
npm --prefix "$ROOT_DIR/apps/client" install

echo "[2/5] Publishing runtime assets to R2..."
NEXT_PUBLIC_TONG_ASSETS_BASE_URL="$ASSETS_BASE_URL" \
TONG_ASSETS_R2_BUCKET="$ASSETS_BUCKET" \
TONG_RUNTIME_ASSET_MANIFEST_KEY="$RUNTIME_ASSET_MANIFEST_KEY" \
  npm --prefix "$ROOT_DIR" run runtime-assets:upload

echo "[3/5] Building + deploying Next.js app to Cloudflare Workers (OpenNext)..."
NEXT_PUBLIC_TONG_PUBLIC_DOMAIN="$PUBLIC_DOMAIN" \
NEXT_PUBLIC_TONG_API_BASE="$API_BASE" \
NEXT_PUBLIC_TONG_ASSETS_BASE_URL="$ASSETS_BASE_URL" \
NEXT_PUBLIC_TONG_EXTENSION_ZIP_URL="$EXTENSION_ZIP_URL" \
NEXT_PUBLIC_TONG_YOUTUBE_DEMO_URL="$YOUTUBE_DEMO_URL" \
NEXT_PUBLIC_TONG_DEMO_PASSWORD_HINT="$DEMO_PASSWORD_HINT" \
  npm --prefix "$ROOT_DIR/apps/client" run cf:deploy

echo "[4/5] Attaching custom domain trigger ($PUBLIC_DOMAIN)..."
npx --prefix "$ROOT_DIR/apps/client" wrangler deploy \
  --config "$ROOT_DIR/apps/client/wrangler.toml" \
  --domain "$PUBLIC_DOMAIN" \
  --keep-vars

echo "[5/5] Deployment complete."
echo
echo "Public URL: https://$PUBLIC_DOMAIN"
echo "Workers URL: https://tong-berlayar-web.erniesg.workers.dev"
echo "API base wired into frontend build: $API_BASE"
echo "Runtime assets wired into frontend build: $ASSETS_BASE_URL"
