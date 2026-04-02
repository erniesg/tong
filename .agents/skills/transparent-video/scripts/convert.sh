#!/usr/bin/env bash
set -euo pipefail

# Convert a source video with transparency to cross-browser formats:
#   1. WebM VP9 alpha (Chrome/Firefox)
#   2. ProRes 4444 alpha intermediate
#   3. HEVC alpha MOV (Safari) via macOS avconvert
#
# Usage:
#   ./convert.sh <input.webm|input.mov|input.png_sequence_dir> <output_basename>
#
# Examples:
#   ./convert.sh tong_intro.webm assets/tong_intro
#   ./convert.sh /tmp/frames/ assets/character_idle
#
# Output:
#   <output_basename>.webm        — VP9 alpha for Chrome/Firefox
#   <output_basename>_hevc.mov    — HEVC alpha for Safari
#   <output_basename>_prores.mov  — ProRes 4444 intermediate (can delete after)
#
# Requirements:
#   - ffmpeg with libvpx-vp9
#   - macOS with avconvert (ships with macOS)

INPUT="$1"
OUTPUT_BASE="$2"

if [ -z "$INPUT" ] || [ -z "$OUTPUT_BASE" ]; then
  echo "Usage: $0 <input> <output_basename>"
  echo ""
  echo "Input can be:"
  echo "  - WebM with VP9 alpha (e.g. character.webm)"
  echo "  - ProRes 4444 MOV with alpha (e.g. character_prores.mov)"
  echo "  - PNG sequence directory (e.g. /tmp/frames/)"
  echo ""
  echo "Output produces:"
  echo "  <basename>.webm       — Chrome/Firefox (VP9 alpha)"
  echo "  <basename>_hevc.mov   — Safari (HEVC alpha)"
  exit 1
fi

WEBM_OUT="${OUTPUT_BASE}.webm"
PRORES_OUT="${OUTPUT_BASE}_prores.mov"
HEVC_OUT="${OUTPUT_BASE}_hevc.mov"

echo "=== Transparent Video Converter ==="
echo "Input:  $INPUT"
echo "WebM:   $WEBM_OUT"
echo "HEVC:   $HEVC_OUT"
echo ""

# Step 1: Create ProRes 4444 intermediate with alpha
echo "[1/3] Creating ProRes 4444 intermediate..."

if [ -d "$INPUT" ]; then
  # PNG sequence
  ffmpeg -y -framerate 24 -i "${INPUT}/%04d.png" \
    -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le -alpha_bits 16 \
    "$PRORES_OUT" 2>&1 | tail -3
elif [[ "$INPUT" == *.webm ]]; then
  # WebM — force libvpx-vp9 decoder for alpha
  ffmpeg -y -vcodec libvpx-vp9 -i "$INPUT" \
    -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le -alpha_bits 16 \
    "$PRORES_OUT" 2>&1 | tail -3
elif [[ "$INPUT" == *prores*.mov ]] || [[ "$INPUT" == *4444*.mov ]]; then
  # Already ProRes
  cp "$INPUT" "$PRORES_OUT"
  echo "  Input is already ProRes, copied."
else
  # Generic video — try to extract alpha
  ffmpeg -y -i "$INPUT" \
    -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le -alpha_bits 16 \
    "$PRORES_OUT" 2>&1 | tail -3
fi

# Verify alpha in ProRes
ALPHA_PCT=$(python3 -c "
from PIL import Image
import subprocess, tempfile, os
tmp = tempfile.mktemp(suffix='.png')
subprocess.run(['ffmpeg', '-y', '-i', '$PRORES_OUT', '-vf', 'select=eq(n\,10)', '-vframes', '1', '-update', '1', '-pix_fmt', 'rgba', tmp], capture_output=True)
img = Image.open(tmp)
if 'A' in img.mode:
    alpha = img.split()[-1]
    pixels = list(alpha.getdata())
    transparent = sum(1 for p in pixels if p < 10)
    print(f'{transparent/len(pixels)*100:.1f}')
else:
    print('0')
os.unlink(tmp)
" 2>/dev/null || echo "0")

echo "  Alpha coverage: ${ALPHA_PCT}% transparent"
if [ "$(echo "$ALPHA_PCT < 1" | bc)" = "1" ]; then
  echo "  WARNING: No alpha detected in intermediate. Output may not have transparency."
fi

# Step 2: Create WebM VP9 alpha (if input wasn't already WebM)
if [[ "$INPUT" == *.webm ]] && [ -f "$INPUT" ]; then
  cp "$INPUT" "$WEBM_OUT"
  echo "[2/3] WebM already exists, copied."
else
  echo "[2/3] Encoding WebM VP9 alpha..."
  ffmpeg -y -i "$PRORES_OUT" \
    -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 1M -auto-alt-ref 0 \
    "$WEBM_OUT" 2>&1 | tail -3
fi

# Step 3: Create HEVC alpha for Safari via macOS avconvert
echo "[3/3] Encoding HEVC alpha for Safari via avconvert..."
if command -v avconvert &> /dev/null; then
  avconvert \
    --source "$PRORES_OUT" \
    --output "$HEVC_OUT" \
    --preset PresetHEVCHighestQualityWithAlpha \
    --replace --progress 2>&1
else
  echo "  ERROR: avconvert not found. This step requires macOS."
  echo "  Alternative: right-click the ProRes file in Finder → Services → Encode Selected Video Files → Preserve Transparency"
fi

# Summary
echo ""
echo "=== Done ==="
echo "WebM (Chrome/Firefox): $WEBM_OUT ($(du -h "$WEBM_OUT" 2>/dev/null | cut -f1))"
echo "HEVC (Safari):         $HEVC_OUT ($(du -h "$HEVC_OUT" 2>/dev/null | cut -f1))"
echo "ProRes intermediate:   $PRORES_OUT ($(du -h "$PRORES_OUT" 2>/dev/null | cut -f1)) — safe to delete"
echo ""
echo "HTML usage:"
echo '  <video autoplay muted loop playsinline>'
echo "    <source src=\"$(basename "$HEVC_OUT")\" type=\"video/quicktime\">"
echo "    <source src=\"$(basename "$WEBM_OUT")\" type=\"video/webm\">"
echo '  </video>'
