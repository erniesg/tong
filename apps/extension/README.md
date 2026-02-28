# apps/extension

Tong extension package ported to Tong interaction/runtime for karaoke-style captions.

## Load

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click **Load unpacked**
4. Select `/Users/erniesg/code/erniesg/tong/apps/extension`

## Validate on YouTube

1. Open a `youtube.com/watch` video with captions available
2. Confirm karaoke subtitle overlay appears and follows playback timing
3. Confirm romanization appears above/with current cue text
4. Use popup controls to toggle overlay and track selection

## Notes

- This directory now uses the compiled Tong extension runtime (`content.js`, `background.js`, `interceptor.js`, assets/chunks).
- If behavior seems stale, click **Reload** in `chrome://extensions` and hard refresh YouTube tab.
