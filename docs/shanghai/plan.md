# Shanghai Content Plan

## Issue 2.2 — Shanghai character sheets

Scope for `erniesg/tong#191`:

- Provide character sheets for `守成 (shoucheng)`, `丁漫 (dingman)`, and `方阿姨 (fangayi)`.
- Keep physical descriptions minimal in character sheets.
- Keep full visual direction in `docs/shanghai/h1-generation-prompts.md`.

### Voice-rule requirements

- **守成**
  - forbiddenTokens: `不一样的`, `就是这样`, `你懂的`, `明白吧`, `对吧`
  - never echo own earlier words
  - never reference unwitnessed history
- **丁漫**
  - minimum viable response pattern
  - food-as-deflection pattern
  - mirror-to-strip-authority pattern
  - never reference past fame/scandal in H1
- **方阿姨**
  - only character who uses diminutives `小瞿/小丁`
  - narrator/chorus role
  - not romanceable

### Acceptance checklist

- `getCharacter("shoucheng")`, `getCharacter("dingman")`, and `getCharacter("fangayi")` return complete sheets.
- `voiceRulesBlock(characterId)` emits prompt-ready voice rule text.
- Romance flags: `shoucheng=true`, `dingman=true`, `fangayi=false`.
- Default relationship stage for all three: `strangers`.
