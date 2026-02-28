#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$ROOT_DIR/.env}"
WORKER_NAME="${TONG_CF_WORKER_NAME:-tong-api}"

if ! command -v wrangler >/dev/null 2>&1; then
  echo "wrangler is required but not found in PATH." >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

read_env_value() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    printf ""
    return 0
  fi
  printf "%s" "${line#*=}"
}

put_secret() {
  local key="$1"
  local value="$2"
  printf "%s" "$value" | wrangler secret put "$key" --name "$WORKER_NAME" >/dev/null
  echo "  - synced $key"
}

delete_secret_if_exists() {
  local key="$1"
  wrangler secret delete "$key" --name "$WORKER_NAME" >/dev/null 2>&1 || true
  echo "  - removed $key (if present)"
}

DEMO_PASSWORD="$(read_env_value "TONG_DEMO_PASSWORD")"
SPOTIFY_CLIENT_ID_VALUE="$(read_env_value "SPOTIFY_CLIENT_ID")"
SPOTIFY_CLIENT_SECRET_VALUE="$(read_env_value "SPOTIFY_CLIENT_SECRET")"
YOUTUBE_CLIENT_ID_VALUE="$(read_env_value "YOUTUBE_CLIENT_ID")"
YOUTUBE_CLIENT_SECRET_VALUE="$(read_env_value "YOUTUBE_CLIENT_SECRET")"
TONG_YOUTUBE_API_KEY_VALUE="$(read_env_value "TONG_YOUTUBE_API_KEY")"
OAUTH_CLIENT_ID_VALUE="$(read_env_value "OAUTH_CLIENT_ID")"
OAUTH_CLIENT_SECRET_VALUE="$(read_env_value "OAUTH_CLIENT_SECRET")"
OPENAI_API_KEY_VALUE="$(read_env_value "OPENAI_API_KEY")"

if [[ -z "$SPOTIFY_CLIENT_ID_VALUE" ]]; then
  SPOTIFY_CLIENT_ID_VALUE="$(read_env_value "TONG_SPOTIFY_CLIENT_ID")"
fi
if [[ -z "$SPOTIFY_CLIENT_SECRET_VALUE" ]]; then
  SPOTIFY_CLIENT_SECRET_VALUE="$(read_env_value "TONG_SPOTIFY_CLIENT_SECRET")"
fi
if [[ -z "$YOUTUBE_CLIENT_ID_VALUE" ]]; then
  YOUTUBE_CLIENT_ID_VALUE="$(read_env_value "TONG_YOUTUBE_CLIENT_ID")"
fi
if [[ -z "$YOUTUBE_CLIENT_SECRET_VALUE" ]]; then
  YOUTUBE_CLIENT_SECRET_VALUE="$(read_env_value "TONG_YOUTUBE_CLIENT_SECRET")"
fi

if [[ -z "$DEMO_PASSWORD" ]]; then
  echo "Missing required key in $ENV_FILE: TONG_DEMO_PASSWORD" >&2
  exit 1
fi
if [[ -z "$SPOTIFY_CLIENT_ID_VALUE" || -z "$SPOTIFY_CLIENT_SECRET_VALUE" ]]; then
  echo "Missing Spotify credentials in $ENV_FILE (SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET)" >&2
  exit 1
fi
if [[ -z "$YOUTUBE_CLIENT_ID_VALUE" || -z "$YOUTUBE_CLIENT_SECRET_VALUE" ]]; then
  echo "Missing YouTube credentials in $ENV_FILE (YOUTUBE_CLIENT_ID/YOUTUBE_CLIENT_SECRET)" >&2
  exit 1
fi

echo "Syncing Cloudflare Worker secrets for \"$WORKER_NAME\" from $ENV_FILE ..."

put_secret "TONG_DEMO_PASSWORD" "$DEMO_PASSWORD"

put_secret "SPOTIFY_CLIENT_ID" "$SPOTIFY_CLIENT_ID_VALUE"
put_secret "SPOTIFY_CLIENT_SECRET" "$SPOTIFY_CLIENT_SECRET_VALUE"
put_secret "TONG_SPOTIFY_CLIENT_ID" "$SPOTIFY_CLIENT_ID_VALUE"
put_secret "TONG_SPOTIFY_CLIENT_SECRET" "$SPOTIFY_CLIENT_SECRET_VALUE"

put_secret "YOUTUBE_CLIENT_ID" "$YOUTUBE_CLIENT_ID_VALUE"
put_secret "YOUTUBE_CLIENT_SECRET" "$YOUTUBE_CLIENT_SECRET_VALUE"
put_secret "TONG_YOUTUBE_CLIENT_ID" "$YOUTUBE_CLIENT_ID_VALUE"
put_secret "TONG_YOUTUBE_CLIENT_SECRET" "$YOUTUBE_CLIENT_SECRET_VALUE"

if [[ -n "$TONG_YOUTUBE_API_KEY_VALUE" ]]; then
  put_secret "TONG_YOUTUBE_API_KEY" "$TONG_YOUTUBE_API_KEY_VALUE"
else
  delete_secret_if_exists "TONG_YOUTUBE_API_KEY"
fi

if [[ -n "$OAUTH_CLIENT_ID_VALUE" ]]; then
  put_secret "OAUTH_CLIENT_ID" "$OAUTH_CLIENT_ID_VALUE"
fi
if [[ -n "$OAUTH_CLIENT_SECRET_VALUE" ]]; then
  put_secret "OAUTH_CLIENT_SECRET" "$OAUTH_CLIENT_SECRET_VALUE"
fi
if [[ -n "$OPENAI_API_KEY_VALUE" ]]; then
  put_secret "OPENAI_API_KEY" "$OPENAI_API_KEY_VALUE"
fi

echo "Done. Current secret names:"
wrangler secret list --name "$WORKER_NAME"
