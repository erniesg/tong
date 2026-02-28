# apps/extension

Fresh Tong MV3 extension for YouTube overlay demo testing.

## Load in Chrome

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click **Load unpacked**
4. Select `/Users/erniesg/code/erniesg/tong/apps/extension`

## Test flow

1. Start Tong server: `npm --prefix apps/server run dev`
2. Open any YouTube watch page (`https://www.youtube.com/watch?v=...`)
3. Verify overlay renders near video bottom with:
- Script lane
- Romanization lane
- English lane
4. Click any token chip and verify dictionary panel updates.
5. Navigate between YouTube pages/videos and confirm overlay survives SPA transitions.
6. Toggle overlay using popup button or keyboard shortcut `Alt+T`.

## Notes

- API target defaults to `http://localhost:8787` and can be updated in the popup.
- Content script now loads on all YouTube pages and activates on `/watch` routes.
- This extension is intentionally minimal and demo-focused (no build step).
