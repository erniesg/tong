#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_ZIP="${1:-$ROOT_DIR/tong.zip}"
STAGING_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$STAGING_DIR"
}
trap cleanup EXIT

mkdir -p "$STAGING_DIR/apps/extension"
mkdir -p "$STAGING_DIR/assets/presets/characters"

cp -R "$ROOT_DIR/apps/extension/." "$STAGING_DIR/apps/extension/"
cp -R "$ROOT_DIR/assets/presets/characters/tong" "$STAGING_DIR/assets/presets/characters/tong"

# Avoid bundling local metadata/cache files.
find "$STAGING_DIR" -name ".DS_Store" -delete
find "$STAGING_DIR" -type d -name "__pycache__" -prune -exec rm -rf {} +
find "$STAGING_DIR" -type f -name "*.pyc" -delete

rm -f "$OUTPUT_ZIP"
(
  cd "$STAGING_DIR"
  zip -qr "$OUTPUT_ZIP" apps/extension assets/presets/characters/tong
)

echo "Created extension bundle: $OUTPUT_ZIP"
