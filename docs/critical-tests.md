# Critical Tests

## Contract tests (blocking)
1. Validate all fixture JSON parses.
2. Validate objective payload always includes:
- `vocabulary`
- `grammar`
- `sentenceStructures`
3. Validate Hangout payload includes immersive UI policy.
4. Validate Learn session payload includes session history metadata.

## Behavior tests (blocking)
1. Hangout flow:
- start scene
- submit 3 to 5 user turns
- verify XP/SP/RP deltas and objective progress
2. Learn flow:
- list previous sessions
- start new session
- verify objective-linked opening message
3. Vocab insights:
- verify top clusters return labels + keywords
- verify top items include rationale/objective link

## Demo path tests (blocking)
1. Korean caption overlay demo path.
2. First food-location hangout objective path.
3. Shanghai advanced texting reward path.

## Resilience tests (recommended)
1. Remote API unavailable -> fallback to `local-mock`.
2. Missing personalization signal -> still generate base objectives.
3. Empty transcript window -> use last stable objective set.
