# Handoff: Seoul trainee cohort + the girls' dorm

Written 2026-11-01 for the next agent. Goal: name and build the girls' trainee cohort and the dorm, and write them into the first encounters (H0 arrival, H1, the dorm), so the world, the eval 1 ranking board and the sleep loop all use real people and a real place.

Issues: #423 (dorm), #416 (roster, ranking, probation). Epic #408. Sibling relationship epic #397.

## Where things are

- **PR #424** (`feat/seoul-loop-m1-next`, worktree `~/code/erniesg/tong-loop-next`) holds everything below; not merged. Branch off it (`git worktree add ~/code/erniesg/tong-dorm -b feat/seoul-dorm-cohort feat/seoul-loop-m1-next` from `~/code/erniesg/tong`), or off main once #424 merges.
- **Staging** runs #424: https://staging.tong.berlayar.ai/cozy (`?evaldebug` adds Force unlock on the studio schedule board). Deploy: `gh workflow run deploy-staging.yml -R erniesg/tong -f ref=<sha>`.
- **Design:** `docs/seoul-evals.md` (time, day loop, evals), `docs/seoul-evals-tbc.md` (open questions and closed decisions; read before deciding anything), `docs/relationship-plan.md` (routes, scene format, principles).
- **Canon (binding):** `apps/client/lib/content/canon/{world,haeun,sua,jin}.ts`. Scenes and code must not contradict it.
- **Scenes:** `apps/client/lib/content/routes/haeun/h0-arrival.ts`, `h1-paired.ts`, `h2-again.ts`; Kakao threads in `lib/content/kakao/`. They are built into the cozy bundle by `node apps/client/scripts/build-relationship-lab.mjs` (the content test fails if the bundle is stale).
- **Cozy runtime:** `apps/client/public/cozy/js/`. `main.js` (state `S`, save/load), `day.js` + `day-ui.js` (기력, bed, recap, morning board; `getDayLoop()`), `eval/` (chapter, runner, eval 1 content, UI). The current "your bed" is a stand-in: the existing bed on the first floor of the generic `seoul-home` apartment (`cities/seoul.js`, built by `level-support.js createApartmentPlan` + `apartments.js`), which a resident ("Min 1") also lives in.
- **Eval ranking roster:** `ROSTER` in `apps/client/public/cozy/js/eval/eval1.js` (하은 86, 민지 74, 예린 69, `연습생 A`/`연습생 B` placeholders marked `TODO-roster`). Lunch-run chat and reactions use 민지, 예린 and `연습생 A`.

## Owner decisions so far (2026-11-01)

- **Female player's route first.** The male route comes later with its own trainee world; don't build male branching.
- **Follow what agencies actually do** for the dorm. Owner doubts that agencies put boys and girls in the same building. What's commonly reported is separate dorms by gender (separate apartments, usually separate buildings), agency-rented, a dorm manager, rooms of 2–4 trainees on bunk beds, a shared kitchen and bathroom, phones and dating restricted, curfew; Seoul-local trainees sometimes commute. **Verify with a quick search, then propose** changing `world.ts`'s dorm note ("Girls and boys on separate floors") to a girls-only dorm. Canon edits need the owner's OK.
- **You can room with Haeun** on the female route. The current canon rule in `world.ts` ("Nothing may depend on sharing a dorm room with Haeun. You inherit Sua's lineup spot and her agency locker, not her bed.") was written for an either-gender player and must be revised. **Open for the owner:** do you room with her always, or only by some choice? And do you get Sua's empty bunk in her room (a strong beat, but it contradicts "not her bed")? Propose options; don't decide.
- **Working cohort (girls), roles agreed, no names yet:**

| Role | Notes from owner and design |
|---|---|
| 하은 Haeun | Canon. Strongest dancer, polite wall, Jeju. |
| 민지 Minji | Canon. Gossip; fast, slangy speech. Eval 9 rumour mill is her month. |
| 예린 Yerin | Canon. Minji's shadow ("그치?"), quietly the best vocalist. |
| The youngest, 15 | Calls you 언니, idolises Haeun. Teaches 호칭. |
| The foreign trainee | Country tbc (T15): fixed (China fits; real agencies have many Chinese trainees; ties to Shanghai) or random per save, never the player's own country. |
| The ex-survival-show contestant | Hugely popular on a survival show; the debut was scrapped by a show/company scandal. **Haeun's rival** (her popularity vs Haeun's skill). Maybe a love interest later (don't build that). |
| The rich kid | Flawless honorifics; extra-polite -세요 as condescension. Golden Bell (eval 5) rival. |
| The oldest, 22 | Seven years in; likely cut at eval 6 (T2), stays on as assistant choreographer. |
| Neighbouring agency's group | Rivals nearby; possibly the "fan found the dorm" beat (T4). |

- **Center** is the player's choice (take it, or it's Haeun's); not a score race.
- **Sua:** can be discovered before Act 3, but how is undecided (T10). **Do not write early Sua scenes.**

## What to do

1. **Cohort canon (propose first).** Draft names (Korean + romanisation), ages, hometowns, looks, voice and speech rules (`speech.rules / tics / texting / underPressure / neverSays`), schedule, who they're close to, and a short `model` (public/private layer, want/need) for each new trainee, in the `CharacterCanon` shape (`lib/relationship/canon-types.ts`). Show the owner a short table before writing files. Keep to the roles above; don't invent big secrets or arcs.
2. **Room assignments (propose).** Rooms of 3–4 on bunks. Offer the owner 2–3 options, including rooming with Haeun (with and without Sua's bunk). Note what each does to H0–H2 and the polite-wall arc (sharing a room with someone who won't drop 존댓말 is a strong, awkward setup).
3. **The dorm (build after the owner OKs 1–2).**
   - A girls' trainee apartment you can walk through: 2–3 bedrooms with bunk beds, a kitchen table and rice cooker, one bathroom, a shoe pile, a whiteboard with the schedule and chore rota, a laundry rack, Manager Choi's room or desk by the door, stairs to the rooftop (canon: Haeun's place, 평상, drying rack, string lights).
   - Real people in it at the right hours (`schedule` in canon; `occupants.js` / `characters.js` for NPCs), using the night check and curfew hook from `day.js` (`on('curfew')`).
   - Move "your bed" to your bunk; the day loop's bed interaction (`day.js` / `main.js`) must point at it. Remove the resident flat as your home in Seoul.
   - Look at `cozy-apartments.test.mjs`, `cozy-level-integration.test.mjs` and `cozy-playability.test.mjs` before changing the apartment builder.
4. **First encounters.** Write the cohort and the dorm into the opening: H0 currently ends at the lockers ("Coach Park: studio, 10am"). Add or extend a beat where you're shown to the dorm and meet your roommates (keep Haeun's glimpse cold, per canon). Use the scene format in `routes/haeun/*.ts` with `en` on every line and `review: 'native'` on new Korean. Rebuild the bundle and keep `node --test lib/relationship/engine.test.ts lib/relationship/content.test.ts` green (run from `apps/client`).
5. **Replace placeholders.** `ROSTER` and the lunch-run lines in `eval1.js` use the new names; score bases follow the roles (rich kid strong on written, oldest strong dance but slipping, and so on). Update `docs/seoul-evals-tbc.md` (close T1, T14, T16 when decided; add the rooming decision).

## Rules of the road

- **Propose, don't ship, undecided design.** The owner has pushed back twice on invented specifics (Sua's backstory, a door-code quest). Anything not in the decisions above goes to the owner as options first, or into the tbc log as a proposal.
- **Owner copy taste:** very short copy, no pills, Korean first with English second.
- **No real people's private data** in code, tests, commits or artifacts.
- **Korean** that isn't from the design docs is placeholder until native review (#395).
- **Worktrees:** use your own worktree; never bare `git stash` (the stack is shared). Use WIP commits.
- **Killing processes:** `pkill -f` / `pgrep -f` match your own shell if the pattern appears anywhere in the command; use the `[n]ext dev -p 3014` bracket trick and keep the pattern out of the rest of the command line.
- **Installs:** pnpm at the repo root; `npm ci` in `apps/client` (a shim rewrites it to pnpm).

## Verification

- Unit: `node --test scripts/cozy-eval.test.mjs scripts/cozy-day.test.mjs` (33 pass today), relationship 61 pass. `cozy-creator` tests fail on main too without `COZY_THREE_MODULE`.
- Browser: `PLAYWRIGHT_MODULE=/tmp/opencode/app-e02-fix-review/scratch/node_modules/playwright/index.mjs COZY_HOST_URL=http://127.0.0.1:<port>/cozy EVAL_SHOTS=<dir> node scripts/cozy-eval1-browser.mjs` (dev server: `npx next dev -p <port>` in `apps/client`). It takes about 25 minutes on this host (software rendering, two viewports). Add a dorm walk-through: arrive → meet roommates → find your bunk → sleep → morning board, at 1280×800 and 390×844, and look at the screenshots yourself.
- Deploy to staging and give the owner the link; don't merge to main without asking.
