# Seoul, at your own pace

## Intent

Build a playable, responsive 3D Seoul neighborhood for Tong: a cozy open-world language-learning and dating-sim prototype. The user authorized preserving current work, syncing remote/VM source as needed, and building this experience. The prototype lives at `/seoul` (with `/game/seoul` redirect) and keeps existing game sessions intact.

## Direction

Visual thesis: a warm miniature Seoul at golden hour, with tactile pastel storefronts, greenery, glowing signs and intimate conversations.

Content plan: the town is the main canvas; a compact objective guides exploration; locations reveal Korean practice and hangouts; a journal holds progress and memories.

Interaction thesis: a camera follows leisurely walks, the world gently breathes with foliage and light, and hangouts move into a first-person view with dialogue and Tong hints.

## Architecture and interfaces

- `components/seoul-world/SeoulWorld.tsx` owns Three.js rendering, movement, collision, camera and cleanup. It consumes plain location coordinates and emits proximity and position. No renderer object enters game state.
- `lib/seoul-adventure/` owns typed, authored Korean content and pure progression functions.
- `components/seoul-world/SeoulAdventure.tsx` owns the accessible HUD, mode transitions, touch controls and local save lifecycle.
- `app/seoul/page.tsx` is the additive route. Existing backend and `packages/contracts` interfaces remain unchanged. This is an explicitly separate local prototype, with no cross-device persistence or generative conversation calls.

The renderer receives locations, target, input, paused, conversation, focusId, companion, onNear, onPosition, onReady and onError. The UI passes `paused` during modal interactions. Conversation mode hides the exploration HUD and player model.

## Playable loop

The five canonical locations are Food Street, Cafe, Convenience Store, Subway Hub and Practice Studio. Players can explore in any order. Every location has an explicit Korean objective, a lesson and a contextual hangout reply.

Correct practice awards 20 XP and 5 SP once per location and enables that location's hangout. A correct contextual hangout reply awards 15 XP and 8 RP for the chosen companion once per location. Three distinct validated hangouts enable an assessment. Passing it awards 50 XP, 15 SP and a first-evening memory/mastery reward once. Replaying sessions does not farm rewards. Wrong answers explain the mistake and allow another attempt. Jin and Ha-eun are adults; interactions are warm and do not assume the player's gender.

Progress uses the separate versioned key `tong.seoul-adventure.v1`, validates stored values, keeps a bounded session history and tolerates unavailable storage. It never updates existing Tong save keys or server progress.

## Responsive and failure behavior

- Desktop: WASD/arrows, tap/click ground, keyboard interaction and destination map.
- Touch: visible directional controls, reachable actions and tappable destinations.
- Portrait, desktop landscape and short phone landscape keep the scene full screen and scroll long panels internally.
- Reduced motion removes ambient movement where practical. WebGL failure presents a usable location-selection alternative and states that 3D is unavailable.
- All event listeners, textures, geometries, materials, observers and animation frames are released on unmount. Rendering resolution is bounded for mobile.

## Acceptance evidence

Run pure progression tests covering prerequisites, answer validation, reward idempotency, mission gating and malformed saves. Run the client build/typecheck, graph contract checks and the imported orchestration tests. Browser-check desktop, phone portrait and phone landscape; play lesson/hangout/mission flows; verify persistence, keyboard/touch movement, overlays and fallback. Obtain independent review of the final integrated commit and address actionable defects before completion.
