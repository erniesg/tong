# VideoClaw Recreate Flow

Local bridge from Tong's clustered reference videos to Humeo generated media.

This flow is generation-only. The earlier recording / teleprompter path is disabled.

What it does:
- builds a reference pack from `05-scene-clusters.json`, `06-video-transcripts.json`, and `05-scene-sources.json`
- picks a reference motif from the analyzed sample videos
- turns the motif + transcript structure + Tong product brief into:
  - an image prompt
  - a video prompt
- calls Humeo `generate-image`
- feeds that image into Humeo `generate-video`
- optionally polls until the final generated `videoUrl` is ready

## Prerequisites

- valid PAT in `~/.videoclaw_personal_mcp_token`
- local scene/transcript artifacts already generated

## Common flows

Build a fresh reference pack only:

```bash
npm run videoclaw:pack
```

Dry-run the recreate flow without calling Humeo:

```bash
npm run videoclaw:recreate -- --dry-run
```

Generate a recreated segment from the strongest current motif:

```bash
npm run videoclaw:recreate -- --wait
```

Generate from a specific source video:

```bash
npm run videoclaw:recreate -- --video-id 2476db64807e --wait
```

Generate from a specific motif:

```bash
npm run videoclaw:recreate -- --motif-id 2476db64807e:m02 --wait
```

Keep the camera fixed and override the reference image:

```bash
npm run videoclaw:recreate -- \
  --motif-id 2476db64807e:m02 \
  --reference-image-url "https://example.com/reference-frame.png" \
  --camera-fixed \
  --wait
```

## Outputs

Artifacts land in `artifacts/videoclaw/`:

- `latest-reference-pack.json`
- `latest-reference-pack.txt`
- `latest-recreate-image-prompt.txt`
- `latest-recreate-video-prompt.txt`
- `latest-recreate.json`

`latest-recreate.json` is the main file to inspect. When the generation finishes, it contains the Humeo task status and final `videoUrl`.
