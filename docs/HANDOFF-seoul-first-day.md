# Handoff: Seoul first day, after the owner's playtest (15 Nov 2026)

For whoever picks up PR #439 next. The owner played the staging build and left nine notes. None of them is started. This file is the list, where each one lives in the code, and what I would do first.

## State

- Branch `feat/seoul-first-quest`, draft PR [#439](https://github.com/erniesg/tong/pull/439), stacked on #438 (which is stacked on #437). Worktree `~/code/erniesg/tong-first-quest`.
- Staging https://staging.tong.berlayar.ai/cozy serves `dd6cef4` (deploy: `gh workflow run deploy-staging.yml -f ref=<full sha> -f pr_number=439`).
- Requirements and what was built: [`seoul-first-day.md`](seoul-first-day.md). What is and isn't verified, and the review findings still open: the PR description.
- Game code is plain ES modules under `apps/client/public/cozy/`; scenes are TypeScript under `apps/client/lib/content/routes/` and are compiled into `public/cozy/js/relationship/scenes.js` by `node scripts/build-relationship-lab.mjs` (run from `apps/client`; the content test fails if the bundle is stale).

## The owner's notes (verbatim)

> hmmm there's still too much hangeul u should like vary the amount of english and hangeul exposed to the play'ers level for complete beginners im expecting to read in english and see hangeul introduced in a very phased manner; also there's this weird fuzz around tong; also how come thjere's like men in the girls' dorm rooms; also i find it weird that sometimes the scene doesnt kind of like show u in the same place as ppl talking and can see who's talking eg in thje dorm w the girls, i think u should make sure the npcs do not reuse any of the story characters too; can we enhance the character avatars somewhat; i also dun like it when you do storytelling exposition inside dialogue box or sms, any messages should have a dedicated kakaotalk interface that shows u hv a msg; and then the map it should be possible to kind of like select quests and guide you to it or sth; anw these are all notes for improvement

Sent while this handoff was being written:

> a lot of the exercises are also not scaffolded enough i was expecting some repetition around like ok first we will teach the vowels or consonants or whatever and u get to hear, play block crush, trace, whatever, variety of exercises and building up the lingo bit by bit

Earlier requests, also verbatim, are at the top of `seoul-first-day.md`. Standing rules from this owner: very short copy, no pill tags, propose design changes that touch canon rather than shipping them (`docs/seoul-evals-tbc.md`), never put undecided story facts into canon.

## The notes, one by one

### 1. Too much Hangul for a complete beginner

**What the owner expects:** a beginner reads English, and Hangul arrives in phases tied to their level.

**What the build does:** every line shows Korean first and large, with English underneath (`#line-ko` then `#line-en`, `js/dialogue.js` `go()`); replies show Korean with romanisation and English below (`renderChoices`). The small games cut what you have to *spell* to eight letters, but what you have to *look at* is unchanged: full Korean sentences from the first second.

**Where the levers are:**
- `S.inputTier` already exists (`js/scene-player.js` `choicesFor`: tier 0 shows the English intent instead of the Korean reply) but nothing sets it for a new player, and it only affects replies.
- `world.playerLevel` (from phrasebook size) already gates Tong's hints (`tong.maxLevel`).
- Each line has `ko`, `en`, optional `rom`; vocab the scene teaches is in `effects.vocab`; letters met are the `hangul:<word>` flags (`js/hangul.js`).

**Suggested shape (a proposal; confirm the levels with the owner before building all of it):**
- A display level per save, starting at 0 for "new to Korean" (ask once in the creator, or infer from the letter count).
- Level 0: English is the main line. Korean appears only for the words this scene teaches or that the player has already met, set inside the English line as tappable words (the gloss spans from `js/gloss.js` already do this for Tong's hints), plus the speaker's line as audio. Replies are English intents with the one Korean phrase being practised shown beside them.
- Level 1 (letters met, roughly day 2–3): Korean line shown small under the English, known words highlighted.
- Level 2+: today's layout (Korean first).
- The small games keep working as they are; they are the places Hangul is introduced.
- This is a rendering change in `dialogue.js` and `scene-player.js` plus one setting; the scenes should not need rewriting.

### 2. Fuzz around Tong

`makeTong()` in `js/characters.js` (about line 1425) draws fur as concentric alpha-tested shells (`alphaTest: 0.18 + i * 0.13`). At low pixel ratios and under bloom the shell edges read as noisy speckle (visible in the staging screenshots as a dotted rim). Options: fewer shells with a softer alpha map, drop the shells below a pixel-ratio threshold, or exclude Tong from bloom. Check against the dialogue portrait art (`img/tong-*.png`), which is smooth.

### 3. Men in the girls' dorm

Two sources to check:
- Generic residents. `js/occupants.js:62` staffs every level of every apartment with `makePedestrian(seed)`, and `makePedestrian` (`js/characters.js:1395`) picks hair style at random, `short` included, with no notion of who lives there. The dorm building (`seoul-home`, `layout: 'dorm'`, Yeonnam) gets these on its other floors and lobby.
- The dorm cast itself is `js/dorm.js` with fixed looks from `js/cohort-data.js`; those should all be the trainees. Confirm none falls back to a pedestrian.
Fix: give `makePedestrian` a `presentation` option and have the dorm building (and the girls' floor of Onsae during practice) request it; canon is in `apps/client/lib/content/canon/world.ts` (separate dorm buildings by gender).

### 4. Scenes that don't show you with the people talking

**What the owner saw:** in the dorm, lines play while the camera shows neither you nor the speaker together.

**Why:** the dialogue camera's two-shot (`js/main.js` `updateCamera`, the `chars[node.who]` branch) only works for speakers registered in `chars` and standing where the scene implies. I fixed Room B, orientation and the 2F corridor with fixed in-room shots (`d1Shot()` in `main.js`) and by moving the player onto a mark (`cutPlayerTo`, `seatOrientation`). The dorm scene `haeun.h0.dorm` was not touched: it starts when you step onto the floor, the speakers (Manager Choi, Ha-eun, Da-on, Bo-ram) are in three different rooms, and the dorm cast is not in `chars`.

**Fix pattern:** for every story scene, a mark for the player and a mark for each speaker, set by `stage:` cues (the `Cue` type in `lib/relationship/types.ts`; handler `stageCue` in `main.js`), and either register the speakers in `chars` so the two-shot can find them or add a fixed shot to `d1Shot()`. Scenes to do: `haeun.h0.dorm`, `haeun.h0` (lockers: Manager Choi and Coach Park speak but stand in Room A), `seoul.d1.bedtime`, then day 2 (`haeun.h1`, `seoul.d2.drill`). Check each with the light staging script pattern (below).

### 5. NPCs that look like story characters

Street strollers, train passengers, tent customers and listeners are `makePedestrian(seed)` with random hair, tops and faces from small palettes, so some come out looking like Ha-eun, Da-on or the player. Give story characters reserved looks (hair style + colour + outfit combinations from `js/cohort-data.js`, `makeHaeun`, `makeJin`) and make `makePedestrian` reject or re-roll any seed that lands on one. `js/hongdae-life.js` and `js/cities/incheon.js` pick their seeds explicitly, so a unit test can assert no collision.

### 6. Better character avatars

Open-ended. The chibis are built in `js/characters.js` (`makeChibi`, canvas-drawn faces, lathe bodies, hair styles). Dialogue portraits are emoji for everyone except Ha-eun, Jin and Tong (`SPEAKERS` in `js/dialogue.js`), which is the cheapest visible upgrade: a portrait per named character. Ask the owner what "enhance" means before spending on it (proportions, outfits, faces, portraits). There is a separate character pipeline project (`~/code/erniesg/charizard`, MPFB to Godot) that may be the intended source; do not assume.

### 7. No exposition or messages in the dialogue box; KakaoTalk gets its own interface

**What the owner rejects:** narration lines doing storytelling in the dialogue box, and texts (Manager Choi's 5pm message, Mum, the teammate, notifications) shown as dialogue lines with a "KakaoTalk." note.

**What exists:** authored threads in `apps/client/lib/content/kakao/` (k01–k15) and a spec on issue #369, but no KakaoTalk interface in the cozy game.

**To build:** a phone notification (buzz, banner with sender and preview) and a chat screen in the cozy UI, fed by the kakao thread format; then move every message out of the scenes: `t_choi`, `t_mum`, `t_teammate`, `t_notifs` in `seoul/d1-train.ts`, "Splits?" in `d1-sprint.ts`, Mum's day-2 text in `d2-mum.ts`.

**Narration:** audit every `speaker: 'narration'` beat in the day-one scenes. Keep what is a stage direction the world can show instead (a cue, a camera move, a prop), cut what explains, and move the rest into something a character says or the player sees. The reviewer and the owner both flagged this; Room B (`haeun/d1-room-b.ts`) and the lobby are the heaviest.

### 8. Pick a quest on the map and be guided to it

**What exists:** the Today list (`ARRIVAL_STEPS` in `js/day1.js`, `QUESTS` in `main.js`), a minimap (`drawMinimap`), and a wayfinding label that points at the nearest place or at `waypointId` (`updateWayfinding`, `main.js` about line 3072). Nothing connects a quest to a place.

**To build:** give each quest step a target (a place id or a spot such as `ONS.locker`, `STREET.tent`), make the Today rows and map pins selectable, set `waypointId` (extend it to accept spots, including floors inside Onsae), and draw a path or a pulsing marker in the world and on the map. The current step should be selected by default so a new player is always being led somewhere.

### 9. Exercises aren't scaffolded: teach a small set, repeat it several ways, then build

**What the owner expects:** a lesson shape. First a small set (some vowels, say), then the same set several times in different forms (hear it, block crush, trace it, and so on), then the next set built on top.

**What the build does:** each letter group gets exactly one game, once, at a story moment (아 on the train, 이 in the lobby, 수아 at the lockers, 다온 in the dorm), then one match at bedtime. That is variety across the day but no repetition within a set, and no sense of "now we are learning the vowels". The independent review said the same: only ㅇ ㅏ are built by hand; ㄷ ㅗ ㄴ are never introduced at all.

**What already exists to build from:**
- `js/tongplay.js`: five small in-world games (build a block, hear and pick, missing piece, match, order a line). Easy to add kinds to; each takes a request and returns pass/fail.
- The Tong host's exercises, reachable from the cozy game through the bridge (`lib/cozy/bridge.ts`, `components/cozy/CozyHost.tsx`): `block_crush`, `stroke_tracing`, `pronunciation_select`, `matching`, `multiple_choice`, `sentence_builder` (`lib/exercises/generators.ts`). The bridge currently accepts five of them (`EXERCISE_TYPES` in `bridge.ts`); tracing is not on the list yet.
- Tong's Learn and Review (tap Tong): `lib/cozy/review.ts` already has a format ladder ("untried format first, then stretch a rung") per word. That ladder is the closest thing to what the owner describes and is not used by the story at all.
- The Hangul teaching order in `lib/content/scripts/hangul.ts`.

**Suggested shape (a proposal; agree the sets with the owner first):**
- Define day-one sets explicitly, e.g. set 1 vowels ㅏ ㅣ ㅗ ㅜ with the silent ㅇ (아 이 오 우), set 2 consonants ㅅ ㄷ ㄴ, set 3 blocks and names built from both (수아, 다온, 나, 누나).
- A "Tong moment" for each set is a short run of three or four different games over the *same* letters: hear each one, pick by ear, trace, build a block, block crush a word. Two or three minutes, with the story moment as the reason for it (the grandmother's 아이고, the floor guide, the locker label).
- Each later set starts by replaying one game from the previous set.
- Bedtime becomes the day's review using the existing ladder, not one match.
- This pairs with note 1: at reading level 0 the Tong moments are where Hangul lives, and dialogue stays English.
- Keep the owner's earlier rule in mind: these must stay organic to the scene, not a lesson screen that interrupts it.

## Also still open (from the review, in the PR description)

- The first meeting barely carries forward into later scenes (H1, the dorm).
- On touch, tapping the Korean in a reply opens the lookup instead of answering.
- Da-on's ㄷ ㅗ ㄴ are never built by hand.
- A possible held clock if a player skips Onsae and naps to day two.
- Frame rate on real devices is unmeasured; the tent area is the heaviest spot.
- Ha-eun-first has not been replayed in a browser since the review fixes; the day-2, eval, dorm and showcase browser proofs have not been rerun.

## Suggested order

1. Notes 1 and 9 together (reading level, and letter sets taught through a run of games): they decide how every scene reads and where Hangul appears, so do them before more writing. Send the owner the level table and the day-one sets first.
2. Note 7 (KakaoTalk interface, narration audit): changes the scene files, so batch it with 1.
3. Note 4 (staging for the dorm and lockers) and note 3/5 (who the NPCs are): correctness the owner noticed immediately.
4. Note 8 (quest guidance).
5. Notes 2 and 6 (Tong's fur, avatars): ask what "enhance" means first.

## How to check things on this host

- The host is shared and often overloaded. Serve the game statically: `python3 -m http.server 3032 --directory apps/client/public`. Playwright that matches the cached browsers: `~/code/erniesg/erniesg/node_modules/playwright/index.mjs`.
- Full play-through: `PLAYWRIGHT_MODULE=… node scripts/cozy-day1-browser.mjs <haeun|jin> <outdir> [desktop|phone] [athlete|creator|intl_kid]`. Ten to twenty minutes; one at a time.
- Targeted checks are much cheaper (about four minutes): open `/cozy/index.html?debug`, start a game, then `await __cozy.d1Jump(flags, position)` to stand anywhere on day one with story flags set; lower `__cozy.renderer.setPixelRatio(0.6)` and turn `shadowMap.enabled` off; hide `#dialogue` before a screenshot to see the staging.
- Under software rendering the tent area draws about one frame every five seconds; anything timed in game seconds there will look stuck. It isn't.
- Unit: `cd apps/client && node --test lib/relationship/*.test.ts`; from the repo root `node --test scripts/cozy-day1.test.mjs scripts/cozy-onsae.test.mjs scripts/cozy-romanize.test.mjs`. The cozy tests that need `COZY_THREE_MODULE` fail here.
