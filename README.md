# Tong

Tong is a Chrome extension + dating-sim style mini game for learning Chinese, Japanese, and Korean through dialogue choices.

## Current scope (v0.1)

- Chrome MV3 extension scaffold
- Popup launcher for game page
- Branching conversation loop with score + affinity
- Built-in language packs: Mandarin, Japanese, Korean
- Options page to set defaults

## Run locally

1. Open Chrome and go to `chrome://extensions`.
2. Enable Developer mode.
3. Click **Load unpacked** and select this `tong/` folder.
4. Click the Tong extension icon and press **Start game**.

## Project structure

- `manifest.json`: extension config
- `src/popup.*`: quick launcher
- `src/game.*`: playable story UI + logic
- `src/data/phrases.js`: language/story content
- `src/options.*`: default settings
- `src/background.js`: install-time defaults

## Next steps

1. Add more characters and route trees per language level.
2. Add spaced repetition by tracking missed phrases.
3. Add audio playback per line (native speaker voice assets).
4. Add a save system + weekly streak progression.
5. Add adaptive translation hints based on learner performance.
