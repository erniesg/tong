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

## Notes

- API target is currently hardcoded to `http://localhost:8787` in `content.js`.
- This extension is intentionally minimal and demo-focused (no build step).
