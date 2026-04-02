---
name: transparent-video
description: Convert videos with transparency for cross-browser playback (Chrome + Safari). Handles VP9 alpha WebM and HEVC alpha MOV encoding. Use when creating character overlays, transparent animations, or any video that needs to composite over game backgrounds.
argument-hint: <input-file> <output-basename>
---

# Transparent Video

Create cross-browser transparent videos. Two formats needed — browser picks automatically:

```html
<video autoplay muted loop playsinline>
  <source src="character_hevc.mov" type="video/quicktime">
  <source src="character.webm" type="video/webm">
</video>
```

## How it works

| Format | Browser | Encoder | Alpha support |
|--------|---------|---------|--------------|
| WebM VP9 | Chrome, Firefox | `libvpx-vp9` | BlockAdditional alpha stream |
| HEVC MOV | Safari (macOS + iOS) | macOS `avconvert` | Native Apple alpha layer |

## Convert a video

```bash
.agents/skills/transparent-video/scripts/convert.sh <input> <output_basename>
```

### From WebM with alpha (most common)
```bash
.agents/skills/transparent-video/scripts/convert.sh assets/tong_intro.webm assets/tong_intro
# Produces: assets/tong_intro.webm + assets/tong_intro_hevc.mov
```

### From PNG sequence
```bash
.agents/skills/transparent-video/scripts/convert.sh /tmp/frames/ assets/character_idle
```

### From ProRes 4444
```bash
.agents/skills/transparent-video/scripts/convert.sh render_output.mov assets/npc_animation
```

## Pipeline

```
Source (WebM/PNG/ProRes)
  → ProRes 4444 intermediate (yuva444p10le, alpha_bits 16)
    → WebM VP9 alpha (Chrome/Firefox)
    → HEVC alpha MOV via avconvert (Safari)
```

## Critical details

### VP9 alpha in WebM
- Alpha stored as **BlockAdditional** in Matroska container, NOT as pixel format
- `ffprobe` reports `yuv420p` even when alpha exists — this is misleading
- Must use `-vcodec libvpx-vp9` flag to decode alpha (default decoder ignores it)
- Verify: `ffmpeg -vcodec libvpx-vp9 -i file.webm ... 2>&1 | grep yuva` — should show `yuva420p`

### HEVC alpha for Safari
- **MIME type must be `video/quicktime`** — NOT `video/mp4` or `video/mp4; codecs="hvc1"`
- Safari rejects HEVC alpha with wrong MIME type even if the file is valid
- Encode via `avconvert --preset PresetHEVCHighestQualityWithAlpha` (macOS CLI)
- Alternative: Finder → right-click MOV → Services → Encode Selected Video Files → check "Preserve Transparency"
- `ffmpeg hevc_videotoolbox` does NOT produce Safari-compatible alpha (broken output)

### Common mistakes
1. Using `type="video/mp4"` for Safari HEVC alpha — must be `type="video/quicktime"`
2. Using ffmpeg's HEVC encoder instead of Apple's avconvert — different internal code paths
3. Trusting ffprobe's `pix_fmt` for VP9 alpha detection — it doesn't report BlockAdditional
4. Not using `-vcodec libvpx-vp9` when decoding WebM — default decoder drops alpha

## Verify transparency

```bash
# Extract a frame and check alpha percentage
ffmpeg -vcodec libvpx-vp9 -i input.webm \
  -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le \
  /tmp/check.mov

ffmpeg -i /tmp/check.mov -vf "select=eq(n\,10)" -vframes 1 -update 1 -pix_fmt rgba /tmp/frame.png

python3 -c "
from PIL import Image
img = Image.open('/tmp/frame.png')
alpha = img.split()[-1]
pixels = list(alpha.getdata())
transparent = sum(1 for p in pixels if p < 10)
print(f'{transparent/len(pixels)*100:.1f}% transparent')
"
```

## Test page

Serve locally and open in both Safari and Chrome:
```bash
python3 -m http.server 8899 --directory apps/client/public
# Open http://localhost:8899/test-video.html
```
