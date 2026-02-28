# Critical Path Plan (ASAP Demo)

## Principle
Ship the complete demo first in `local-mock` mode, then swap backend mode without rewriting UI.

## Track A: Demo-critical (must finish first)
1. Client shell and navigation flow.
2. Subtitle overlay and token dictionary popover.
3. Profile onboarding and first food hangout.
4. Learn mode loop with XP/SP/RP updates.
5. Shanghai advanced texting reward flow.

## Track B: Data and personalization
1. Last-72h vocab ranking pipeline contract.
2. Topic clustering + orthography family extraction.
3. Fixture-backed personalization insights UI.
4. Local-server implementation behind same contract.

## Track C: Deployment (parallel, swappable)
1. Keep backend access behind `TONG_BACKEND_MODE`.
2. Build adapters for:
- Local mock fixtures.
- Local server.
- Remote server.
3. Deploy whichever backend is ready without changing core demo UI.

## Definition of done for hackathon demo
1. Full run-of-show executes with no external dependency.
2. One command verifies demo contracts (`npm run demo:smoke`).
3. iOS, Android, and web can all present same narrative flow.
