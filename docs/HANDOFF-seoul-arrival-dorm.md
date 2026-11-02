# Handoff: Seoul arrival day, the girls' dorm and the cohort

Written 2026-11-01 (late) for the next agent. Supersedes the "What to do" list in [`HANDOFF-seoul-trainees-dorm.md`](HANDOFF-seoul-trainees-dorm.md); its rules of the road still apply.

## Where things are

- **Draft PR #434** (`feat/seoul-dorm-cohort`, worktree `~/code/erniesg/tong-dorm`), stacked on **#424** (`feat/seoul-loop-m1-next`). Neither is merged. Production and `main` have none of this. Don't merge without the owner.
- **Staging** runs #434 at commit 1dcc93f: https://staging.tong.berlayar.ai/cozy. To deploy, run `gh workflow run deploy-staging.yml -R erniesg/tong -f ref=<FULL sha>`. A short sha fails at checkout.
- **Issues:**
  - Dorm #423 (female route done, see comment) and roster #416.
  - Evals epic #408, relationship epic #397.
  - Origins epic #425 with children #426–#433.
  - Native Korean review #395.

## Done

### Decisions recorded (owner, 2026-11-01)
In `docs/seoul-evals-tbc.md` (closed table), canon and `docs/seoul-origins.md`:
- **Dorms:** separate buildings by gender, spread out. Yeonnam Apartments is the girls' dorm. The female route comes first; the boys' dorm comes later.
- **Rooming:** you live in Haeun's dorm from day one but not her room. On arrival, Manager Choi offers Sua's bed, and Haeun gives a polite excuse that sends you to Da-on's room. Sua's bed stays empty. After the eval 6 cut, rooms merge and you can ask Haeun for Sua's bed (she agrees on trust; if trust is low, Da-on gets it).
- **Cohort:**

  | Who | Age | Notes |
  |---|---|---|
  | 하은 Haeun | 18 | |
  | 도희 Do-hee | 18 | Ex-survival contestant, Haeun's rival |
  | 다온 Da-on | 15 | The youngest |
  | 보람 Bo-ram | 22 | The oldest |
  | 윤서 Yun-seo | 19 | The rich kid |
  | 민지 Minji | | |
  | 예린 Yerin | | Quietly the best vocalist |
  | The foreign trainee | | Picked per save from nationalities that aren't the player's; the others live on the floor above in other units |

- **Eval 6 cut is Bo-ram:** the industry's fixed cost, and unpreventable. She stays on as assistant choreographer and moves out.
- **Origins:**
  - The Athlete's fate is now "the unit debuts whole".
  - Only the International-School Kid can miss debut regardless of scores.
  - Haeun's mum is a cook in Jeju-si who has long wanted her own restaurant (in `haeun.ts`).
- **Day one order:** company (H0) first, then the registration card, then the dorm.

### Built
- **Canon** (`apps/client/lib/content/canon/`):
  - `cohort.ts` holds four `CharacterCanon` entries, `FOREIGN_TRAINEES` with `pickForeignTrainee`, and `DORM_ROOMS`.
  - `world.ts` has the new people, dorm note and rooming rule.
  - Both are built into the lab and bundle by `scripts/build-relationship-lab.mjs`.
- **Dorm building:** `createApartmentPlan({ layout: 'dorm' })` in `public/cozy/js/level-support.js`.
  - Each upper floor has three bunk rooms off a corridor, one bathroom, a kitchen table and rice cooker, a chore whiteboard, a laundry rack, a shoe pile and Manager Choi's desk.
  - Room B's lower bunk (`your-bunk`) is the player's bed on level 1.
  - Staff: Manager Choi on level 1, a generic other-unit trainee on level 2.
  - The Seoul home (`cities/seoul.js`) uses this layout.
- **Dorm life** (`public/cozy/js/dorm.js`):
  - Da-on, Bo-ram, Do-hee, Minji and Yerin are home at night and render only while you're on their floor. Tapping one shows a short line.
  - Haeun's schedule has a `dorm` spot in room A.
- **Arrival scene** `haeun.h0.dorm` (`lib/content/routes/haeun/h0-dorm.ts`): it auto-plays when you reach the dorm floor after H0, once no panel is open.
- **Arrival quest** (`main.js`): an `ARRIVAL` chain (locker → register → dorm → firstNight) on the Today list, ticked by `checkArrival()` from game state. The old `QUESTS` list returns on day 2.
- **Tong hints** (`story.js` `tongHint`): locker → dorm → sleep ("studio at 10") → on day 2 before 9, "Studio at 10".
- **Bed fix:** the bed prompt measures to the mattress edge and is only offered inside room B, so a roommate at the foot of the bed can't steal it.
- **Eval 1:** `ROSTER` uses the real cohort. `rosterFor(seed, nationality)` adds the foreign trainee. The lunch run uses 다온. The pool is mirrored in `public/cozy/js/cohort-data.js`.

### Verified
- Unit tests: 72 cozy pass, 65 relationship pass. The dorm runs the same route and traversal checks as the other flats. A test checks that the cozy pool mirror matches canon.
- `scripts/cozy-dorm-browser.mjs`: dorm scene → night roommates → bunk → morning. Passes at 1280×800 and 390×844.
- `scripts/cozy-arrival-browser.mjs` is retired: Day 1 now starts at Incheon, and `scripts/cozy-day1-browser.mjs` walks it from the creator to day 2 (see [`seoul-day1.md`](seoul-day1.md)). Older proofs call `__cozy.skipDayOne()` to start in Hongdae.
- Not run: `cozy-city-occupancy`, `cozy-occupants` and `cozy-creator` need `COZY_THREE_MODULE`. They fail the same way on #424.

## Next

**Day 1 starts at Incheon** (branch `feat/seoul-day1`, issue #435): see [`seoul-day1.md`](seoul-day1.md) for what plays, the flags and what's not built yet. H0's lockers are now the end of orientation.

### Needs the owner
1. **Merge #424, then #434.**
2. **Today panel:** it starts collapsed, so during the arrival you only see "2/4". Open it automatically on day one? (proposed)
3. **H0:** have Manager Choi say she'll see you at the dorm, to give the dorm step a time? (proposed, not built)
4. **Open canon from #426:**
   - Grandma's death and the funeral in month 11.
   - Yerin's month-8 overtraining cut (the Athlete's preventable loss).
   - Haeun's mum and the player's parents as characters.
   - Origin roles for Coach Park and Manager Choi.
   - Reciprocity in the bid rules.
5. **T10 (Sua's line) is still undecided.** Bo-ram has a secret (she helped Sua carry her bags out) with no reveal scene. Don't write one until T10 is decided.

### Build (female route)
1. **Room lights at night.** Rooms are very dark after 19:00. Add ceiling or desk lamp props (an emissive `bulb` colour already exists) in `dormFlat`.
2. **Missing roommates.** Yun-seo and the per-save foreign trainee aren't in `DORM_CAST` (room C only has Minji and Yerin). The foreign trainee needs a name from `pickForeignTrainee(S.seed, S.nationality)`, so `createDormCast` needs the save.
3. **The upper floor.** Show the other foreign trainees there (the rest of the pool) instead of the generic "Trainee (another unit)" staff.
4. **The reshuffle (T17).** Needs eval 6 and Bo-ram's cut:
   - She moves out, the rooms merge, and you ask Haeun for Sua's bed (trust-gated; on low trust Da-on takes it).
   - Move `your-bunk` to room A when you win it.
   - Losing the room after a betrayal is a consequence.
   - Today `bunk(..., { mine })` is fixed to room B, so make it depend on save state.
5. **Night check and curfew in the dorm.** Manager Choi's flashlight round at 23:00 (`day.js` `on('curfew')`), with roommates in bed.
6. **Roommate tap lines** in `dorm.js` are placeholders. Make them scene-driven or time-aware later, deterministic per the relationship plan.

### Later
- **The boys' dorm and male route,** with their own building and cohort. Nothing is built.
- **Origins** (#425): start after evals 1–3 and the dorm play well. #427 (state layer) comes first.
- **Native review** of all new Korean (#395). Lines carry `review: 'native'`.

## Gotchas

- **Speed:** browser proofs take about 40 minutes per viewport on this host (software rendering). Run them in the background and watch with Monitor.
- **The studio sign:** walking up to the studio triggers `sign_build`, a block-crush exercise. Scripts must close it with `.exercise-dismiss-btn` (the Learn panel uses `.cozy-practice__close`).
- **The registration card** opens by itself after H0 and hides prompts until handed in (`#seoul-eval [data-action="profile-save"]`).
- **pkill:** `pkill -f '[x]yz'` still kills your own shell if `xyz` appears anywhere else in that command line. Run it as its own command.
- **Bundle:** after editing canon or scenes, run `node scripts/build-relationship-lab.mjs` from `apps/client`, or the content test fails as stale.
- **Installs:** in a new worktree, `pnpm import && pnpm install --frozen-lockfile` in `apps/client`, then delete the generated `pnpm-lock.yaml`.
