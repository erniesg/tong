# Lesson: rejected Seoul 3D prototype

## Disposition

The Seoul 3D prototype was removed after user rejection. The rejected state is
preserved at Git ref `01d5c6f504fb1d20504cd17b10b71c2459738566`, tagged
`codex/archive-seoul-3d-2026-09-10`; the original work checkpoint is `721669e`.
The original Tong game and GitHub/Rucksack source synchronization are retained.

## The request was narrowed incorrectly

The user wanted the current Tong game transformed into a cosy, playable 3D
adventure, retaining its language-learning and dating-sim experience. Instead,
the implementation substituted a separate authored prototype with its own
browser-local save and no connection to the existing game's backend. That was
an assistant-imposed reduction of scope, not an agreed definition of done.

Calling that work complete against self-selected technical checks was wrong.
The instruction required understanding how a player actually plays the current
game, preserving that experience, and making it work as a 3D adventure. Rendering
a world and providing static menus did not satisfy that request.

## What failed in the experience

The user found the visuals unacceptable and could not tell how to do anything.
They did not see a player avatar, found the map poor, saw objects appearing to
poke through one another, and could not identify how to start or play a game.
From their perspective, nothing happened after arrival. These are product and
visual failures, not merely polish issues: the prototype did not communicate a
playable world, the player's presence, or a rewarding first action.

The user's screenshots show the consequences:

- [Exploration view](assets/seoul-3d-2026-09-10/world-without-visible-player.png): sky,
  mountains, and a roof dominate; no player is discernible, and the map's dots
  do not make the next interaction clear.
- [Companion selector](assets/seoul-3d-2026-09-10/companion-selector.png): names
  appear as toggles without explaining the action or consequence. The user
  reports that switching them does nothing useful.
- [Journal](assets/seoul-3d-2026-09-10/empty-journal.png): zero balances, an empty
  history, and a link back to the map provide no concrete first playable action.

We have not verified a technical root cause for the avatar visibility,
occlusion/clipping, map quality, or stalled interaction. Do not infer exact
rendering, camera, collision, state, or input defects from the report alone.

## Accountability and lessons

The implementation was declared done using build/unit checks and scripted
browser checks. Those checks did not establish visual quality, a visible avatar
during exploration, camera handling of occluders, route clearance, a useful
map, an obvious start and first action, or rewarding feedback. Screenshot and
test success are evidence of limited execution paths; they are not acceptance
evidence for this kind of game experience.

Design from the player's first minute: see the character walk, recognise a
person to approach, initiate an interaction, and see the world or relationship
respond. Menus, currency counters, destination navigation, and vague objectives
cannot substitute for that loop. A dating sim needs a character encounter with
clear response and consequence; a companion toggle alone does not deliver one.
The "Nearby Convenience Store" badge did not establish a recognisable arrival,
entrance, NPC introduction, or conversation for the player. Proximity detection
and moving the view to a destination are not a playable encounter. The player
must understand where they arrived, who is there, how to engage, and what their
action changes without instructions from the developer.

Future work must establish a coherent art reference and validate one playable
street before adding a larger world. The exploration view needs an unmistakably
visible avatar and camera behavior that handles occluding objects. Geometry
must be reviewed for clearance at actual travel routes and camera orientations.
The minimap must connect the player to the world through usable landmarks.
Entry must make the start action, current objective, available interaction, and
resulting feedback unmistakable.

Before implementation, derive the definition of done from the requested player
experience and the existing game. Trace start/resume, the player and companions,
location entry, learn/hangout sessions, objectives, dialogue and choices,
XP/SP/RP, mission gates, rewards, and persistence. Map each required existing
capability to the 3D experience and its verification; do not quietly replace
existing systems with independent mock state or omit integration from scope.

Acceptance evidence must include a first-time, unaided walkthrough rather than
only scripted known selectors. Review gameplay video in both orientations
before claiming completion: visible walking, camera and occlusion behavior,
route clearance, map comprehension, start/resume, location arrival, NPC setup,
initiated conversation, language-learning action, meaningful response,
progression, and saved continuity. Verify visual quality against the intended
cosy art direction as well as functional parity. Separate technical checks,
player usability, visual quality, and requested scope in the completion report;
passing one does not imply the others passed.
